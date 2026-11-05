import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ProjectsPage from './projects';
import { sampleProjects } from '../data/sampleProjects';

// jsdom has no layout, so heights are supplied by mocking offsetHeight; the real scrolling is checked in a
// browser. These cover the structure, the default category and the measurement-based sticky decision.

const renderSection = (data = sampleProjects('full')) =>
  render(
    <MemoryRouter>
      <ProjectsPage data={data} />
    </MemoryRouter>
  );

const items = (container) => container.querySelectorAll('[data-projects-section] > ul > li');

afterEach(() => jest.restoreAllMocks());

test('shows the data it is given instead of fetching, opening on Websites for Design', () => {
  const { container } = renderSection();
  expect(screen.getByRole('button', { name: /Websites/ })).toHaveAttribute('aria-pressed', 'true');
  expect(items(container)).toHaveLength(7);
  fireEvent.click(screen.getByRole('button', { name: 'Development' }));
  expect(screen.getByRole('button', { name: /Web Apps/ })).toHaveAttribute('aria-pressed', 'true');
  expect(items(container)).toHaveLength(4);
});

test('there is no "All" chip, only real categories', () => {
  renderSection();
  const chips = within(screen.getByRole('group', { name: 'Filter projects by category' })).getAllByRole('button');
  expect(chips.map((c) => c.textContent.replace(/\d+$/, ''))).toEqual(['Web App', 'Mobile App', 'Websites', 'Others']);
});

test('falls back to the first category with projects when Websites is empty', () => {
  const data = sampleProjects('full');
  data.projects = data.projects.filter((p) => !p.categoryIds.includes('websites'));
  renderSection(data);
  // Web App is empty without its Websites projects too, so the first chip with projects is Mobile App.
  expect(screen.getByRole('button', { name: /Mobile App/ })).toHaveAttribute('aria-pressed', 'true');
});

test('the chips filter, and switching Design/Development goes back to the default category', () => {
  const { container } = renderSection();
  fireEvent.click(screen.getByRole('button', { name: /Mobile App/ }));
  expect(items(container)).toHaveLength(3);
  fireEvent.click(screen.getByRole('button', { name: 'Development' }));
  fireEvent.click(screen.getByRole('button', { name: 'Design' }));
  expect(screen.getByRole('button', { name: /Websites/ })).toHaveAttribute('aria-pressed', 'true');
});

test('the heading and every tab live in one bar, so they are pinned together', () => {
  const { container } = renderSection();
  const bar = container.querySelector('[data-projects-bar]');
  expect(within(bar).getByRole('heading', { name: 'Projects' })).toBeInTheDocument();
  expect(within(bar).getByRole('group', { name: 'Project type' })).toBeInTheDocument();
  expect(within(bar).getByRole('group', { name: 'Filter projects by category' })).toBeInTheDocument();
});

describe('sticky follows the measured height, never the number of projects', () => {
  const section = (container) => container.querySelector('[data-projects-section]');

  test('content taller than the visible area: the bar sticks', async () => {
    jest.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(5000);
    const { container } = renderSection();
    await waitFor(() => expect(section(container)).toHaveAttribute('data-sticky', 'on'));
    expect(container.querySelector('[data-projects-bar]')).toHaveClass('sticky');
  });

  test('content that fits: the bar stays in normal flow', async () => {
    jest.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(300);
    const { container } = renderSection();
    await waitFor(() => expect(section(container)).toHaveAttribute('data-content-height', '300'));
    expect(section(container)).toHaveAttribute('data-sticky', 'off');
    expect(container.querySelector('[data-projects-bar]')).not.toHaveClass('sticky');
    expect(container.querySelector('[data-projects-bar]')).toHaveClass('relative');
  });

  test('the same two projects can be sticky or not depending only on height', async () => {
    const two = { ...sampleProjects('short'), projects: sampleProjects('short').projects.slice(0, 2) };
    const spy = jest.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(4000);
    const tall = renderSection(two);
    await waitFor(() => expect(section(tall.container)).toHaveAttribute('data-sticky', 'on'));
    tall.unmount();
    spy.mockReturnValue(200);
    const short = renderSection(two);
    await waitFor(() => expect(section(short.container)).toHaveAttribute('data-sticky', 'off'));
  });
});

test('no nested scrolling: the list has no overflow container of its own', () => {
  const { container } = renderSection();
  const list = container.querySelector('[data-projects-section] > ul');
  expect(list.className).not.toMatch(/overflow-y|overflow-auto|max-h-|h-screen/);
});

test('cards are visible straight away when the browser cannot observe scrolling', () => {
  const { container } = renderSection();
  items(container).forEach((li) => expect(li).toHaveClass('opacity-100'));
});
