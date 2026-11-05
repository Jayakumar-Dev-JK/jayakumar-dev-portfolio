import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ProjectsPage, { ProjectCard } from './projects';

// No REACT_APP_FIREBASE_* variables in tests, so the section uses its built-in data.

function renderProjects() {
  return render(
    <MemoryRouter>
      <ProjectsPage />
    </MemoryRouter>
  );
}

test('design is selected by default and shows the empty state', () => {
  renderProjects();
  expect(screen.getByRole('button', { name: 'Design' })).toHaveAttribute('aria-pressed', 'true');
  expect(screen.getByText('Design projects are coming soon.')).toBeInTheDocument();
});

test('development opens on its first category that has projects, and the chips filter', () => {
  renderProjects();
  fireEvent.click(screen.getByRole('button', { name: 'Development' }));
  // There is no "All" chip: the tab opens on Web Apps (the first category with projects).
  expect(screen.queryByRole('button', { name: /^All/ })).toBeNull();
  expect(screen.getByRole('button', { name: /Web Apps/ })).toHaveAttribute('aria-pressed', 'true');
  expect(screen.getAllByRole('heading', { level: 3 })).toHaveLength(2);

  fireEvent.click(screen.getByRole('button', { name: /E-Commerce/ }));
  const titles = screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent);
  expect(titles).toEqual([expect.stringContaining('Laya')]);

  // Switching tabs goes back to that tab's default category.
  fireEvent.click(screen.getByRole('button', { name: 'Design' }));
  fireEvent.click(screen.getByRole('button', { name: 'Development' }));
  expect(screen.getByRole('button', { name: /Web Apps/ })).toHaveAttribute('aria-pressed', 'true');
});

test('cards without an image, or with a broken one, show the placeholder', () => {
  const base = { id: 'p', type: 'Design', title: 'No image', description: 'd', tags: [], href: null, categoryIds: [] };
  const { container, rerender } = render(
    <MemoryRouter>
      <ul>
        <ProjectCard project={{ ...base, thumbnail: null }} />
      </ul>
    </MemoryRouter>
  );
  expect(screen.getByText('Preview coming soon')).toBeInTheDocument();

  rerender(
    <MemoryRouter>
      <ul>
        <ProjectCard project={{ ...base, id: 'q', thumbnail: 'https://images.example.com/missing.png', thumbnailAlt: 'Cover' }} />
      </ul>
    </MemoryRouter>
  );
  fireEvent.error(container.querySelector('img'));
  expect(screen.getByText('Preview coming soon')).toBeInTheDocument();
});

test('development cards open their own project page', () => {
  renderProjects();
  fireEvent.click(screen.getByRole('button', { name: 'Development' }));
  fireEvent.click(screen.getByRole('button', { name: /E-Commerce/ }));
  const link = screen.getByRole('link', { name: /Laya/ });
  expect(link).toHaveAttribute('href', '/projects/laya');
  expect(link).not.toHaveAttribute('target');
});
