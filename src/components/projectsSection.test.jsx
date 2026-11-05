import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ProjectsPage from './projects';
import { sampleProjects } from '../data/sampleProjects';

// jsdom has no IntersectionObserver or layout, so these cover the structure and the switches;
// the scrolling itself is checked in a real browser.

const renderSection = (props) =>
  render(
    <MemoryRouter>
      <ProjectsPage data={sampleProjects('many')} {...props} />
    </MemoryRouter>
  );


test('shows the data it is given instead of fetching', () => {
  const { container } = renderSection();
  // Design is the default tab: 12 sample design projects.
  expect(container.querySelectorAll('[data-projects-section] > ul > li')).toHaveLength(12);
  fireEvent.click(screen.getByRole('button', { name: 'Development' }));
  expect(container.querySelectorAll('[data-projects-section] > ul > li')).toHaveLength(9);
});

test('the heading and every tab live in one bar, so they can be pinned together', () => {
  const { container } = renderSection();
  const bar = container.querySelector('[data-projects-bar]');
  expect(within(bar).getByRole('heading', { name: 'Projects' })).toBeInTheDocument();
  expect(within(bar).getByRole('group', { name: 'Project type' })).toBeInTheDocument();
  expect(within(bar).getByRole('group', { name: 'Filter projects by category' })).toBeInTheDocument();
});

test('the sticky variant pins the bar; the panel variant keeps it fixed above a scrolling list', () => {
  const sticky = renderSection({ variant: 'sticky' });
  const stickyBar = sticky.container.querySelector('[data-projects-bar]');
  expect(stickyBar).toHaveClass('sticky');
  expect(sticky.container.querySelector('[data-projects-section] > ul')).not.toHaveClass('overflow-y-auto');
  sticky.unmount();

  const panel = renderSection({ variant: 'panel' });
  const section = panel.container.querySelector('[data-projects-section]');
  expect(section).toHaveAttribute('data-variant', 'panel');
  expect(section).toHaveClass('flex-col');
  expect(panel.container.querySelector('[data-projects-bar]')).not.toHaveClass('sticky');
  expect(section.querySelector(':scope > ul')).toHaveClass('overflow-y-auto');
});

test('category chips can be hidden, leaving only the Design / Development tabs', () => {
  renderSection({ showCategories: false });
  expect(screen.queryByRole('group', { name: 'Filter projects by category' })).toBeNull();
  expect(screen.getByRole('group', { name: 'Project type' })).toBeInTheDocument();
  // Every project of the tab is listed without a category filter.
  expect(screen.getAllByRole('heading', { level: 3 })).toHaveLength(12);
});

test('cards are visible straight away when the browser cannot observe scrolling', () => {
  const { container } = renderSection();
  container.querySelectorAll('[data-projects-section] > ul > li').forEach((li) => {
    expect(li).toHaveClass('opacity-100');
  });
});

test('the category chips still filter, and switching Design/Development resets them', () => {
  renderSection();
  fireEvent.click(screen.getByRole('button', { name: /Mobile App/ }));
  expect(screen.getAllByRole('heading', { level: 3 })).toHaveLength(3);
  fireEvent.click(screen.getByRole('button', { name: 'Development' }));
  expect(screen.getByRole('button', { name: /^All/ })).toHaveAttribute('aria-pressed', 'true');
});
