import { seoDescription, seoTitle } from './pageMeta';

// These cases mirror netlify/tests/seo.test.js: the browser and the server must agree.

test('seoTitle appends the site name only when it fits', () => {
  expect(seoTitle('Laya')).toBe('Laya | Jayakumar Jayakrishnan');
  const long = 'Nalaiya Thiran Project: ICT Academy-IBM: Plasma Donor Application - Cloud web Application Development';
  const title = seoTitle(long);
  expect(title.length).toBeLessThanOrEqual(70);
  expect(title.endsWith('…')).toBe(true);
});

test('seoDescription pads a short description from the full text and clips at 158', () => {
  const d = seoDescription({
    title: 'Why Weds',
    type: 'Development',
    description: 'A web application for planning and arranging wedding events.',
    fullDescription: 'Couples manage vendors and guests in one place.\n\nBuilt for real event planners.',
  });
  expect(d.startsWith('A web application for planning')).toBe(true);
  expect(d).toContain('Couples manage vendors');
  expect(d.length).toBeLessThanOrEqual(158);
  expect(seoDescription({ title: 'T', type: 'Design', description: '' })).toMatch(/design project/);
});
