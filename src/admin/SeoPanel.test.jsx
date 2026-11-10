import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { PagePreview, SeoBadge, SeoPanel } from './SeoPanel';

const input = {
  title: 'Why Weds',
  slug: 'why-weds',
  shortDescription: 'A web application for planning and arranging wedding events.',
  description: '',
  techStack: [],
  coverMedia: { url: '', alt: '' },
  gallery: [],
  projectUrl: '',
  links: [],
};

const words = (n) => Array.from({ length: n }, (_, i) => `word${i}`).join(' ');
const GOOD = {
  ...input,
  shortDescription: 'A web application for planning and arranging wedding events, built for real event planners.',
  description: words(160),
  techStack: ['React'],
  coverMedia: { url: 'https://img.example/a.png', alt: 'Home screen' },
  projectUrl: 'https://example.com',
};

test('the search panel previews the Google result and lists what to improve', () => {
  render(<SeoPanel input={input} type="Development" />);
  const preview = screen.getByLabelText('Google result preview');
  expect(within(preview).getByText('Why Weds | Jayakumar')).toBeInTheDocument();
  expect(within(preview).getByText(/jayakumarwebdev\.netlify\.app › projects › why-weds/)).toBeInTheDocument();
  expect(within(preview).getByText(/A web application for planning/)).toBeInTheDocument();
  expect(screen.getByText('Thin page')).toBeInTheDocument();

  // What is wrong comes first, each with a way to fix it; what passed is tucked away.
  const todo = screen.getByRole('list', { name: 'Things to improve' });
  expect(within(todo).getByText('Written description')).toBeInTheDocument();
  expect(within(todo).getByText('Link to the project')).toBeInTheDocument();
  expect(within(todo).getAllByRole('button', { name: /^Fix:/ }).length).toBeGreaterThan(1);
  expect(screen.getByText(/Passed checks \(\d\)/)).toBeInTheDocument();
});

test('length meters say in words whether the title and description fit', () => {
  render(<SeoPanel input={{ ...input, title: 'Why Weds wedding events planner' }} type="Development" />);
  const [title, description] = screen.getAllByRole('meter');
  expect(title).toHaveAttribute('aria-valuetext', expect.stringMatching(/characters\. Good length\.$/));
  // A 62-character description is under the 70-character target.
  expect(description).toHaveAttribute('aria-valuetext', expect.stringMatching(/A bit short\.$/));
  expect(description).toHaveAttribute('aria-valuemax', '158');
});

test('there is one Google preview and no desktop/mobile switch', () => {
  render(<SeoPanel input={input} type="Development" />);
  expect(screen.getAllByLabelText('Google result preview')).toHaveLength(1);
  expect(screen.queryByRole('radio')).toBeNull();
  expect(screen.queryByRole('radiogroup')).toBeNull();
  expect(screen.queryByText('Mobile')).toBeNull();
  expect(screen.queryByText('Desktop')).toBeNull();
});

test('"Fix" moves focus to the field that needs work', () => {
  render(
    <>
      <textarea id="shortDescription" aria-label="Short description" />
      <textarea id="description" aria-label="Project description field" />
      <SeoPanel input={input} type="Development" />
    </>
  );
  Element.prototype.scrollIntoView = jest.fn();
  fireEvent.click(screen.getByRole('button', { name: 'Fix: Written description' }));
  expect(screen.getByLabelText("Project description field")).toHaveFocus();
});

test('a complete project shows a clear all-good message instead of a to-do list', () => {
  render(<SeoPanel input={GOOD} type="Development" />);
  expect(screen.getByText('SEO ready')).toBeInTheDocument();
  expect(screen.getByText('Everything looks good for search.')).toBeInTheDocument();
  expect(screen.queryByRole('list', { name: 'Things to improve' })).toBeNull();
});

test('the badge names the level and lists the problems on hover', () => {
  render(<SeoBadge project={input} />);
  const badge = screen.getByText('Thin page');
  expect(badge).toHaveAttribute('title', expect.stringContaining('Written description'));
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
  expect(within(dialog).getByText('Couples manage vendors.')).toBeInTheDocument();
  expect(within(dialog).getByRole('heading', { name: 'Technologies' })).toBeInTheDocument();
  expect(within(dialog).getByText(/not public/)).toBeInTheDocument();
  // The admin's own title and tags must not be replaced by the project's.
  expect(document.title).toBe('Admin');
  expect(document.head.querySelector('script[data-page-meta]')).toBeNull();

  fireEvent.keyDown(document, { key: 'Escape' });
  expect(onClose).toHaveBeenCalled();
});
