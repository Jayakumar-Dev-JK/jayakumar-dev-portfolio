import { mapPublicProject } from './publicProjectService';

jest.mock('../lib/firebase', () => ({ db: {} }));
jest.mock('./categoryService', () => ({ fetchActiveCategories: jest.fn() }));
jest.mock('firebase/firestore', () => ({ collection: jest.fn(), where: jest.fn(), query: jest.fn(), getDocs: jest.fn() }));

test('case-study fields and old slugs are exposed, trimmed and type-checked', () => {
  const project = mapPublicProject('p1', {
    slug: 'deskmate',
    previousSlugs: ['desk-mate', 42, 'office-desks'],
    role: '  Designer  ',
    year: '2024',
    problem: 'Seats were double-booked.',
    process: 123,
    outcome: '',
    type: 'Design',
    title: 'Deskmate',
    shortDescription: 'Office seat booking',
  });
  expect(project.previousSlugs).toEqual(['desk-mate', 'office-desks']);
  expect(project.role).toBe('Designer');
  expect(project.year).toBe('2024');
  expect(project.problem).toBe('Seats were double-booked.');
  expect(project.process).toBe('');
  expect(project.outcome).toBe('');
});

test('projects saved before these fields existed still map cleanly', () => {
  const project = mapPublicProject('old', { slug: 'laya', type: 'Development', title: 'Laya', shortDescription: 'Shop' });
  expect(project.previousSlugs).toEqual([]);
  expect(project.role).toBe('');
  expect(project.problem).toBe('');
});
