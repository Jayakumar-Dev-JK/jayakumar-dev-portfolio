import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { PagePreview, SeoBadge, SeoPanel } from './SeoPanel';
import { ProjectDetails } from '../pages/ProjectPage';

const input = {
  title: 'Why Weds',
  slug: 'why-weds',
  shortDescription: 'A web application for planning and arranging wedding events.',
  description: '',
  problem: '',
  process: '',
  outcome: '',
  techStack: [],
  coverMedia: { url: '', alt: '' },
  gallery: [],
  projectUrl: '',
  links: [],
};

test('the search panel previews the Google result and lists what to improve', () => {
  render(<SeoPanel input={input} type="Development" />);
  const preview = screen.getByLabelText('Google result preview');
  expect(within(preview).getByText('Why Weds | Jayakumar Jayakrishnan')).toBeInTheDocument();
  expect(within(preview).getByText(/jayakumarwebdev\.netlify\.app › projects › why-weds/)).toBeInTheDocument();
  expect(within(preview).getByText(/A web application for planning/)).toBeInTheDocument();
  expect(screen.getByText(/Title \d+\/70/)).toBeInTheDocument();

  const checklist = screen.getByRole('list', { name: 'Search checklist' });
  expect(within(checklist).getByText(/Written content\./)).toBeInTheDocument();
  expect(within(checklist).getByText(/Link to the project\./)).toBeInTheDocument();
  expect(screen.getByText(/Thin page/)).toBeInTheDocument();
});

test('the badge names the level and lists the problems on hover', () => {
  render(<SeoBadge project={input} />);
  const badge = screen.getByText('Thin page');
  expect(badge).toHaveAttribute('title', expect.stringContaining('Written content'));
});

test('the page preview shows the project, leaves the head alone, and closes with Escape', () => {
  document.title = 'Admin';
  const onClose = jest.fn();
  const project = {
    id: 'preview',
    slug: 'why-weds',
    type: 'Development',
    title: 'Why Weds',
    description: 'A web application for planning wedding events.',
    fullDescription: 'Couples manage vendors.',
    role: 'Designer and developer',
    year: '2024',
    problem: 'Planning was scattered.',
    process: 'Wireframes first.',
    outcome: 'Faster planning.',
    thumbnail: null,
    thumbnailAlt: '',
    tags: ['React'],
    href: 'https://example.com',
    links: [],
    gallery: [],
    categoryIds: [],
  };
  render(
    <MemoryRouter>
      <PagePreview project={project} categories={[]} onClose={onClose} />
    </MemoryRouter>
  );
  const dialog = screen.getByRole('dialog', { name: 'Project page preview' });
  expect(within(dialog).getByRole('heading', { level: 1, name: 'Why Weds' })).toBeInTheDocument();
  expect(within(dialog).getByText('Role')).toBeInTheDocument();
  expect(within(dialog).getByText('Designer and developer')).toBeInTheDocument();
  expect(within(dialog).getByRole('heading', { name: 'The problem' })).toBeInTheDocument();
  expect(within(dialog).getByRole('heading', { name: 'Process' })).toBeInTheDocument();
  expect(within(dialog).getByRole('heading', { name: 'Outcome' })).toBeInTheDocument();
  expect(within(dialog).getByText(/not public/)).toBeInTheDocument();
  // The admin's own title and tags must not be replaced by the project's.
  expect(document.title).toBe('Admin');
  expect(document.head.querySelector('script[data-page-meta]')).toBeNull();

  fireEvent.keyDown(document, { key: 'Escape' });
  expect(onClose).toHaveBeenCalled();
});

test('project details leave out empty case-study sections', () => {
  render(
    <MemoryRouter>
      <ProjectDetails
        project={{ id: 'p', slug: 'p', type: 'Design', title: 'Plain', description: 'Short', fullDescription: '', tags: [], links: [], gallery: [], categoryIds: [] }}
        categories={[]}
        preview
      />
    </MemoryRouter>
  );
  expect(screen.queryByRole('heading', { name: 'The problem' })).toBeNull();
  expect(screen.queryByText('Role')).toBeNull();
});
