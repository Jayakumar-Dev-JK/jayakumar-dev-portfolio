import { addDoc, deleteDoc, doc, writeBatch } from 'firebase/firestore';
import { deleteCloudinaryFile, uploadToCloudinary } from './mediaService';
import { deleteResume, publishResume, renameResume, uploadResume, validateResumeTitle } from './resumeService';
import { fetchPublishedResume } from './publicResumeService';

jest.mock('../lib/firebase', () => ({ db: {} }));
jest.mock('./auditService', () => ({ auditWrite: () => ['audit-ref', { audit: true }] }));
jest.mock('./mediaService', () => ({ uploadToCloudinary: jest.fn(), deleteCloudinaryFile: jest.fn() }));
jest.mock('firebase/firestore', () => ({
  addDoc: jest.fn(),
  collection: jest.fn(),
  deleteDoc: jest.fn(),
  doc: jest.fn(),
  getDoc: jest.fn(),
  getDocs: jest.fn(),
  orderBy: jest.fn(),
  query: jest.fn(),
  serverTimestamp: jest.fn(),
  writeBatch: jest.fn(),
}));

let batch;
beforeEach(() => {
  batch = { set: jest.fn(), update: jest.fn(), delete: jest.fn(), commit: jest.fn(() => Promise.resolve()) };
  writeBatch.mockReturnValue(batch);
  doc.mockImplementation((db, col, id) => `${col}/${id}`);
  deleteCloudinaryFile.mockResolvedValue({});
});

const resume = {
  id: 'r2',
  title: 'UI/UX resume 2026',
  url: 'https://res.cloudinary.com/demo/raw/upload/v1/portfolio/resumes/cv.pdf',
  fileName: 'cv.pdf',
  publicId: 'portfolio/resumes/cv.pdf',
  published: false,
};

test('resume names are required and bounded', () => {
  expect(validateResumeTitle('  ')).toMatch(/name/);
  expect(validateResumeTitle('x'.repeat(121))).toMatch(/under 120/);
  expect(validateResumeTitle('UI/UX resume')).toBeNull();
});

test('publishing replaces the single public pointer', async () => {
  await publishResume(resume, 'uid-1');
  expect(batch.set).toHaveBeenCalledWith('siteSettings/resume', {
    resumeId: 'r2',
    title: resume.title,
    url: resume.url,
    fileName: 'cv.pdf',
    updatedAt: undefined,
    updatedBy: 'uid-1',
  });
  expect(batch.commit).toHaveBeenCalled();
});

test('the published resume cannot be deleted', async () => {
  await expect(deleteResume({ ...resume, published: true }, 'uid-1')).rejects.toThrow(/Unpublish/);
  expect(deleteCloudinaryFile).not.toHaveBeenCalled();
  expect(deleteDoc).not.toHaveBeenCalled();

  await deleteResume(resume, 'uid-1');
  expect(deleteCloudinaryFile).toHaveBeenCalledWith('raw', 'portfolio/resumes/cv.pdf');
  expect(deleteDoc).toHaveBeenCalledWith('resumes/r2');
});

test('renaming the published resume also renames the public pointer', async () => {
  await renameResume({ ...resume, published: true }, '  New name ', 'uid-1');
  expect(batch.update).toHaveBeenCalledWith('resumes/r2', expect.objectContaining({ title: 'New name' }));
  expect(batch.update).toHaveBeenCalledWith('siteSettings/resume', expect.objectContaining({ title: 'New name' }));
});

test('a failed save removes the uploaded PDF so no orphan file is left', async () => {
  uploadToCloudinary.mockResolvedValue({ url: resume.url, publicId: resume.publicId, bytes: 1000 });
  addDoc.mockRejectedValue({ code: 'permission-denied' });
  await expect(uploadResume({ name: 'cv.pdf' }, 'CV', 'uid-1')).rejects.toEqual({ code: 'permission-denied' });
  expect(deleteCloudinaryFile).toHaveBeenCalledWith('raw', resume.publicId);
});

test('the public site only gets a safe published resume', async () => {
  const field = (stringValue) => ({ stringValue });
  global.fetch = jest.fn();

  global.fetch.mockResolvedValueOnce({ status: 404, ok: false });
  expect(await fetchPublishedResume()).toBeNull();

  global.fetch.mockResolvedValueOnce({ status: 200, ok: true, json: async () => ({ fields: { title: field('CV'), url: field('javascript:alert(1)'), fileName: field('cv.pdf') } }) });
  expect(await fetchPublishedResume()).toBeNull();

  global.fetch.mockResolvedValueOnce({ status: 200, ok: true, json: async () => ({ fields: { title: field('CV'), url: field(resume.url), fileName: field('cv.pdf'), resumeId: field('r2') } }) });
  expect(await fetchPublishedResume()).toEqual({ title: 'CV', url: resume.url, fileName: 'cv.pdf' });
});

