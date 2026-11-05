import { collection, deleteField, doc, getDoc, getDocs, runTransaction, serverTimestamp, writeBatch } from 'firebase/firestore';
import { listCategories } from './categoryService';
import { auditWrite } from './auditService';
import { createProject, updateProject } from './projectService';

jest.mock('../lib/firebase', () => ({ db: {} }));
jest.mock('./categoryService', () => ({ listCategories: jest.fn(), seedDefaultCategories: jest.fn() }));
jest.mock('./auditService', () => ({ auditWrite: jest.fn() }));
jest.mock('firebase/firestore', () => ({
  collection: jest.fn(),
  deleteField: jest.fn(),
  doc: jest.fn(),
  getDoc: jest.fn(),
  getDocs: jest.fn(),
  limit: jest.fn(),
  orderBy: jest.fn(),
  query: jest.fn(),
  runTransaction: jest.fn(),
  serverTimestamp: jest.fn(),
  where: jest.fn(),
  writeBatch: jest.fn(),
}));

// CRA resets mock implementations before every test, so the defaults are set here.
beforeEach(() => {
  collection.mockReturnValue({});
  deleteField.mockReturnValue('DELETE_FIELD');
  doc.mockReturnValue({ id: 'new-id' });
  serverTimestamp.mockReturnValue('SERVER_TIME');
  auditWrite.mockReturnValue([{ path: 'audit' }, { action: 'audit' }]);
});

const CATEGORIES = [{ id: 'web', active: true, projectTypes: ['Development'] }];
const stored = (extra = {}) => ({
  slug: 'why-weds',
  status: 'published',
  publishedAt: 1,
  updatedAt: { toMillis: () => 5 },
  ...extra,
});
const input = (extra = {}) => ({
  title: 'Why Weds',
  slug: 'why-weds',
  type: 'Development',
  shortDescription: 'Wedding planning web app.',
  description: '',
  categoryIds: ['web'],
  techStack: ['React'],
  coverMedia: { url: 'https://img.example/a.png', alt: 'Home' },
  links: [],
  projectUrl: '',
  featured: false,
  sortOrder: 0,
  display: 'link',
  gallery: [],
  ...extra,
});

// Runs updateProject against a fake Firestore and returns what was written.
async function runUpdate(existing, nextInput, { slugOwnedBy = [] } = {}) {
  listCategories.mockResolvedValue(CATEGORIES);
  getDoc.mockResolvedValue({ exists: () => true, id: 'p1', data: () => existing });
  // First query: slug in use? Second: slug reserved by an old address?
  getDocs.mockResolvedValueOnce({ docs: [] }).mockResolvedValueOnce({ docs: slugOwnedBy.map((id) => ({ id })) });
  const tx = { get: jest.fn(async () => ({ exists: () => true, data: () => existing })), update: jest.fn(), set: jest.fn() };
  runTransaction.mockImplementation(async (db, fn) => fn(tx));
  await updateProject('p1', nextInput, 'admin-uid', 5);
  return tx.update.mock.calls[0][1];
}

test('a project that does not use the new fields is saved without them (works before the rules update)', async () => {
  const written = await runUpdate(stored(), input());
  ['role', 'year', 'problem', 'process', 'outcome', 'previousSlugs'].forEach((key) => {
    expect(written).not.toHaveProperty(key);
  });
});

test('filled-in case-study fields are saved trimmed; cleared ones are removed from the project', async () => {
  const written = await runUpdate(
    stored({ role: 'Designer', outcome: 'Old outcome' }),
    input({ role: '  Lead designer ', year: '2024', problem: 'The problem.', process: '', outcome: '' })
  );
  expect(written.role).toBe('Lead designer');
  expect(written.year).toBe('2024');
  expect(written.problem).toBe('The problem.');
  expect(written).not.toHaveProperty('process'); // was never set: nothing to remove
  expect(written.outcome).toBe('DELETE_FIELD'); // was set before, now cleared
});

test('renaming a published project keeps its old address for the redirect', async () => {
  const written = await runUpdate(stored(), input({ slug: 'why-weds-app' }));
  expect(written.slug).toBe('why-weds-app');
  expect(written.previousSlugs).toEqual(['why-weds']);
});

test('renaming a draft that was never published keeps no history', async () => {
  const written = await runUpdate(stored({ status: 'draft', publishedAt: null }), input({ slug: 'new-name' }));
  expect(written).not.toHaveProperty('previousSlugs');
});

test('an address another project used before cannot be reused', async () => {
  await expect(runUpdate(stored(), input({ slug: 'taken-before' }), { slugOwnedBy: ['other-project'] })).rejects.toMatchObject({
    fieldErrors: { slug: expect.stringMatching(/belonged to another project/) },
  });
});

test('new projects start as drafts and carry the case-study fields only when filled in', async () => {
  listCategories.mockResolvedValue(CATEGORIES);
  getDocs.mockResolvedValue({ docs: [] });
  const batch = { set: jest.fn(), commit: jest.fn() };
  writeBatch.mockReturnValue(batch);

  await createProject(input({ role: 'Designer', year: '', problem: '' }), 'admin-uid');
  const data = batch.set.mock.calls[0][1];
  expect(data.status).toBe('draft');
  expect(data.role).toBe('Designer');
  expect(data).not.toHaveProperty('year');
  expect(data).not.toHaveProperty('problem');
  expect(data).not.toHaveProperty('previousSlugs');
});
