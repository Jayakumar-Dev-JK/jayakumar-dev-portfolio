import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { getProject, unpublishProject } from '../services/projectService';
import { listCategories } from '../services/categoryService';
import { SessionContext, UnsavedGuardProvider } from './ui';
import { ProjectEditor } from './ProjectsAdmin';

// The services are replaced, so these tests cover the editor's own behaviour only.
jest.mock('../services/projectService', () => ({
  ConflictError: class ConflictError extends Error {},
  ValidationError: class ValidationError extends Error {},
  archiveProject: jest.fn(),
  createProject: jest.fn(),
  createSamplePost: jest.fn(),
  getProject: jest.fn(),
  importLegacyProjects: jest.fn(),
  listProjects: jest.fn(),
  permanentlyDeleteProject: jest.fn(),
  publishProject: jest.fn(),
  restoreProject: jest.fn(),
  softDeleteProject: jest.fn(),
  unpublishProject: jest.fn(),
  updateProject: jest.fn(),
}));
jest.mock('../services/categoryService', () => ({ listCategories: jest.fn() }));
jest.mock('../services/mediaService', () => ({
  MEDIA_LIMITS: { image: { label: 'image', maxBytes: 1, formats: [] }, video: { label: 'video', maxBytes: 1, formats: [] } },
  deleteMedia: jest.fn(),
  findMediaUsage: jest.fn(),
  listMedia: jest.fn(),
  uploadFile: jest.fn(),
}));

const project = (extra = {}) => ({
  id: 'p1',
  title: 'Why Weds',
  slug: 'why-weds',
  type: 'Development',
  status: 'published',
  shortDescription: 'Wedding planning web app.',
  description: '',
  categoryIds: ['web'],
  techStack: ['React'],
  coverMedia: { type: 'image', url: 'https://img.example/a.png', alt: 'Home' },
  media: [],
  links: [],
  projectUrl: '',
  featured: false,
  sortOrder: 0,
  display: 'link',
  gallery: [],
  publishedAt: { toMillis: () => 1 },
  updatedAt: { toMillis: () => 1 },
  ...extra,
});

function renderEditor() {
  return render(
    <MemoryRouter initialEntries={['/admin/projects/p1']}>
      <SessionContext.Provider value={{ status: 'admin', user: { uid: 'admin-uid' } }}>
        <UnsavedGuardProvider>
          <Routes>
            <Route path="/admin/projects/:id" element={<ProjectEditor />} />
          </Routes>
        </UnsavedGuardProvider>
      </SessionContext.Provider>
    </MemoryRouter>
  );
}

beforeEach(() => {
  listCategories.mockResolvedValue([{ id: 'web', name: 'Web Apps', active: true, projectTypes: ['Development'] }]);
  unpublishProject.mockResolvedValue(undefined);
});

const bar = () => screen.getByRole('status', { name: '' }).parentElement; // the sticky action bar

test('a published project has an Unpublish button next to Save changes, and no Save & publish', async () => {
  getProject.mockResolvedValue(project());
  renderEditor();
  await screen.findByRole('heading', { name: 'Edit project' });
  expect(screen.getByRole('button', { name: 'Save changes' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Unpublish' })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /Save & publish/ })).toBeNull();
  // They share the same action bar.
  expect(within(bar()).getByRole('button', { name: 'Unpublish' })).toBeInTheDocument();
});

test('a draft has no Unpublish button', async () => {
  getProject.mockResolvedValue(project({ status: 'draft', publishedAt: null }));
  renderEditor();
  await screen.findByRole('heading', { name: 'Edit project' });
  expect(screen.queryByRole('button', { name: 'Unpublish' })).toBeNull();
  expect(screen.getByRole('button', { name: /Save & publish/ })).toBeInTheDocument();
});

test('"View live page" sits next to "Preview page", not in the title row', async () => {
  getProject.mockResolvedValue(project());
  renderEditor();
  await screen.findByRole('heading', { name: 'Edit project' });
  const live = screen.getByRole('link', { name: /View live page/ });
  expect(live).toHaveAttribute('href', '/projects/why-weds');
  expect(live).toHaveAttribute('target', '_blank');
  const preview = screen.getByRole('button', { name: 'Preview page' });
  expect(live.parentElement).toBe(preview.parentElement);
  // The title row no longer carries it.
  expect(screen.getByRole('heading', { name: 'Edit project' }).parentElement).not.toContainElement(live);
});

test('a draft has no "View live page" (there is no live page)', async () => {
  getProject.mockResolvedValue(project({ status: 'draft', publishedAt: null }));
  renderEditor();
  await screen.findByRole('heading', { name: 'Edit project' });
  expect(screen.queryByRole('link', { name: /View live page/ })).toBeNull();
  expect(screen.getByRole('button', { name: 'Preview page' })).toBeInTheDocument();
});

test('Unpublish asks first, and Cancel changes nothing', async () => {
  getProject.mockResolvedValue(project());
  renderEditor();
  await screen.findByRole('heading', { name: 'Edit project' });
  fireEvent.click(screen.getByRole('button', { name: 'Unpublish' }));
  const dialog = await screen.findByRole('dialog');
  expect(dialog).toHaveTextContent('Unpublish "Why Weds"?');
  expect(dialog).toHaveTextContent('It disappears from the public portfolio');
  fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  expect(unpublishProject).not.toHaveBeenCalled();
  expect(screen.getByRole('button', { name: 'Unpublish' })).toBeInTheDocument();
});

test('confirming unpublishes, then the editor behaves like a draft', async () => {
  getProject.mockResolvedValueOnce(project()).mockResolvedValue(project({ status: 'draft', updatedAt: { toMillis: () => 2 } }));
  renderEditor();
  await screen.findByRole('heading', { name: 'Edit project' });
  fireEvent.click(screen.getByRole('button', { name: 'Unpublish' }));
  const dialog = await screen.findByRole('dialog');
  fireEvent.click(within(dialog).getByRole('button', { name: 'Unpublish' }));

  await waitFor(() => expect(unpublishProject).toHaveBeenCalledWith('p1', 'admin-uid'));
  expect(await screen.findByText('"Why Weds" is now a draft.')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Unpublish' })).toBeNull();
  expect(screen.getByRole('button', { name: /Save & publish/ })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Save draft' })).toBeInTheDocument();
  expect(screen.queryByRole('link', { name: /View live page/ })).toBeNull();
});

test('unsaved edits are not lost when unpublishing, and the dialog says so', async () => {
  getProject.mockResolvedValueOnce(project()).mockResolvedValue(project({ status: 'draft', updatedAt: { toMillis: () => 2 } }));
  renderEditor();
  await screen.findByRole('heading', { name: 'Edit project' });
  fireEvent.change(screen.getByLabelText(/^Title/), { target: { value: 'Why Weds (new name)' } });
  fireEvent.click(screen.getByRole('button', { name: 'Unpublish' }));
  const dialog = await screen.findByRole('dialog');
  expect(dialog).toHaveTextContent('Your unsaved changes stay in the form.');
  fireEvent.click(within(dialog).getByRole('button', { name: 'Unpublish' }));

  await screen.findByText('"Why Weds" is now a draft.');
  expect(screen.getByLabelText(/^Title/)).toHaveValue('Why Weds (new name)');
  expect(screen.getByText('Unsaved changes')).toBeInTheDocument();
});

test('a failed unpublish shows the error and leaves the project published', async () => {
  getProject.mockResolvedValue(project());
  unpublishProject.mockRejectedValue(new Error('Network down.'));
  renderEditor();
  await screen.findByRole('heading', { name: 'Edit project' });
  fireEvent.click(screen.getByRole('button', { name: 'Unpublish' }));
  fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Unpublish' }));
  expect(await screen.findByText(/Network down\./)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Unpublish' })).toBeInTheDocument();
});
