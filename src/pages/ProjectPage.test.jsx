import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import ProjectPage from './ProjectPage';

// No REACT_APP_FIREBASE_* variables in tests, so the page uses the built-in projects.

function renderAt(path) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/projects/:slug" element={<ProjectPage />} />
      </Routes>
    </MemoryRouter>
  );
}

const tag = (selector) => document.head.querySelector(selector);

beforeEach(() => {
  document.title = 'Home title';
});

test('shows the project with a single h1, its technologies, and sets the page metadata', () => {
  renderAt('/projects/laya');
  expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
  expect(screen.getByRole('heading', { level: 1 }).textContent).toMatch(/Laya/);
  expect(screen.getByRole('heading', { name: 'Technologies' })).toBeInTheDocument();
  expect(screen.getByText('MongoDB')).toBeInTheDocument();

  expect(document.title).toMatch(/Laya.*Jayakumar Jayakrishnan|Laya/);
  expect(tag('link[rel="canonical"]').getAttribute('href')).toBe('https://jayakumarwebdev.netlify.app/projects/laya');
  expect(tag('meta[name="description"]').getAttribute('content')).toMatch(/e-commerce web application/i);
  const ld = [...document.head.querySelectorAll('script[type="application/ld+json"][data-page-meta]')].map((s) =>
    JSON.parse(s.textContent)
  );
  expect(ld.map((d) => d['@type'])).toEqual(['CreativeWork', 'BreadcrumbList']);
});

test('removes its tags and restores the title when it unmounts', () => {
  const { unmount } = renderAt('/projects/laya');
  expect(document.title).not.toBe('Home title');
  unmount();
  expect(document.title).toBe('Home title');
  expect(document.head.querySelector('script[data-page-meta]')).toBeNull();
});

test('an unknown project shows the not-found page, marked noindex', () => {
  renderAt('/projects/does-not-exist');
  expect(screen.getByRole('heading', { name: 'Page not found' })).toBeInTheDocument();
  expect(tag('meta[name="robots"]').getAttribute('content')).toBe('noindex, nofollow');
  expect(document.title).toMatch(/Page not found/);
});

test('links back to the projects section of the homepage', () => {
  renderAt('/projects/laya');
  expect(screen.getByRole('link', { name: /Projects/ })).toHaveAttribute('href', '/#projects');
});
