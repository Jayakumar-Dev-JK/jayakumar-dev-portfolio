import { pickActiveSection, VISIBILITY_THRESHOLDS } from './activeSection';

const heights = (entries) => new Map(Object.entries(entries));

test('the section filling most of the screen is the current one', () => {
  expect(pickActiveSection(heights({ skills: 120, projects: 640, contact: 0 }))).toBe('projects');
});

test('a section taller than the screen still wins while it fills the screen (the old 60% rule never picked it)', () => {
  // A long projects list: only ever one screen of it is visible, far below 60% of its own height.
  const screen = 836;
  const projectsRatio = screen / 3000;
  expect(projectsRatio).toBeLessThan(0.6);
  expect(pickActiveSection(heights({ skills: 40, projects: screen, contact: 0 }))).toBe('projects');
});

test('the next section takes over as soon as it fills more of the screen than the previous one', () => {
  expect(pickActiveSection(heights({ projects: 300, contact: 536 }))).toBe('contact');
  expect(pickActiveSection(heights({ projects: 536, contact: 300 }))).toBe('projects');
});

test('ties go to the earlier section, and nothing visible gives no answer', () => {
  expect(pickActiveSection(heights({ skills: 400, projects: 400 }))).toBe('skills');
  expect(pickActiveSection(heights({ skills: 0, projects: 0 }))).toBeNull();
  expect(pickActiveSection(new Map())).toBeNull();
});

test('visibility is re-read in fine steps', () => {
  expect(VISIBILITY_THRESHOLDS).toHaveLength(51);
  expect(VISIBILITY_THRESHOLDS[0]).toBe(0);
  expect(VISIBILITY_THRESHOLDS[50]).toBe(1);
});
