import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ProjectsPage from './projects';
import { fixtureProjects } from './projectsSection.fixture';

// jsdom has no layout, so heights are supplied by mocking offsetHeight; the real scrolling is checked in a
// browser. These cover the structure, the default category and the measurement-based sticky decision.

const renderSection = (data = fixtureProjects('full')) =>
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
  const data = fixtureProjects('full');
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
    const two = { ...fixtureProjects('short'), projects: fixtureProjects('short').projects.slice(0, 2) };
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

test('when sticky, the bar releases early and the list margin cancels it, so nothing moves', async () => {
  jest.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(5000);
  const { container } = renderSection();
  const section = container.querySelector('[data-projects-section]');
  await waitFor(() => expect(section).toHaveAttribute('data-sticky', 'on'));
  const bar = container.querySelector('[data-projects-bar]');
  const list = section.querySelector(':scope > ul');
  const release = Math.round(Number(section.dataset.availableHeight) * 0.45);
  expect(release).toBeGreaterThan(100);
  expect(bar.style.marginBottom).toBe(`${release}px`);
  expect(list.style.marginTop).toBe(`-${release}px`);
});

test('when sticky is off there are no release margins at all', async () => {
  jest.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(300);
  const { container } = renderSection();
  const section = container.querySelector('[data-projects-section]');
  await waitFor(() => expect(section).toHaveAttribute('data-content-height', '300'));
  expect(container.querySelector('[data-projects-bar]').style.marginBottom).toBe('');
  expect(section.querySelector(':scope > ul').style.marginTop).toBe('');
});

describe('categories with no projects get no chip', () => {
  const withoutCategory = (data, id) => ({ ...data, projects: data.projects.filter((p) => !p.categoryIds.includes(id)) });
  const chipNames = () =>
    within(screen.getByRole('group', { name: 'Filter projects by category' }))
      .getAllByRole('button')
      .map((c) => c.textContent.replace(/\d+$/, ''));

  test('an empty category is left out of the chips', () => {
    renderSection(withoutCategory(fixtureProjects('full'), 'others'));
    expect(chipNames()).toEqual(['Web App', 'Mobile App', 'Websites']);
  });

  test('it is decided per tab: Development shows only its own categories that have projects', () => {
    renderSection();
    fireEvent.click(screen.getByRole('button', { name: 'Development' }));
    // Thozhil Admin is in both dashboard and web, so all three Development categories have projects here.
    expect(chipNames()).toEqual(['Web Apps', 'E-Commerce', 'Dashboards']);
    cleanup();
    const data = withoutCategory(fixtureProjects('full'), 'dashboard');
    renderSection(data);
    fireEvent.click(screen.getByRole('button', { name: 'Development' }));
    expect(chipNames()).toEqual(['Web Apps', 'E-Commerce']);
  });

  test('every chip that is shown has at least one project', () => {
    renderSection();
    within(screen.getByRole('group', { name: 'Filter projects by category' }))
      .getAllByRole('button')
      .forEach((chip) => expect(Number(chip.textContent.match(/(\d+)$/)[1])).toBeGreaterThan(0));
  });

  test('a selected category that empties out falls back to the default instead of showing a blank list', () => {
    const full = fixtureProjects('full');
    const { container, rerender } = renderSection(full);
    fireEvent.click(screen.getByRole('button', { name: /Others/ }));
    expect(items(container)).toHaveLength(2);
    rerender(
      <MemoryRouter>
        <ProjectsPage data={withoutCategory(full, 'others')} />
      </MemoryRouter>
    );
    expect(screen.getByRole('button', { name: /Websites/ })).toHaveAttribute('aria-pressed', 'true');
    expect(items(container).length).toBeGreaterThan(0);
  });

  test('a tab with no categories configured still lists all of its projects', () => {
    const data = { ...fixtureProjects('full'), categories: [] };
    const { container } = renderSection(data);
    expect(screen.queryByRole('group', { name: 'Filter projects by category' })).toBeNull();
    expect(items(container)).toHaveLength(10);
  });
});

test('the bar has an opaque background in both states, so cards never show through it while pinned', async () => {
  jest.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(5000);
  const { container } = renderSection();
  const bar = container.querySelector('[data-projects-bar]');
  await waitFor(() => expect(bar).toHaveClass('sticky'));
  expect(bar).toHaveClass('bg-slate-900');
  expect(bar).toHaveClass('z-20');
});

test('the list is plain content: no max-height and no scroll box of its own', () => {
  const { container } = renderSection();
  const section = container.querySelector('[data-projects-section]');
  expect(section.querySelector('[data-projects-list]')).toBeNull();
  section.querySelectorAll('ul, div').forEach((el) => {
    expect(el.className).not.toMatch(/overflow-y-(auto|scroll)|\bmax-h-/);
    expect(el.style.maxHeight).toBe('');
  });
});
