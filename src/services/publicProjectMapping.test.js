import { mapPublicProject } from './publicProjectService';

jest.mock('../lib/firebase', () => ({ db: {} }));
jest.mock('./categoryService', () => ({ fetchActiveCategories: jest.fn() }));
jest.mock('firebase/firestore', () => ({ collection: jest.fn(), where: jest.fn(), query: jest.fn(), getDocs: jest.fn() }));

test('old slugs are exposed and anything that is not a string is dropped', () => {
  const project = mapPublicProject('p1', {
    slug: 'deskmate',
    previousSlugs: ['desk-mate', 42, 'office-desks'],
    type: 'Design',
    title: 'Deskmate',
    shortDescription: 'Office seat booking',
  });
  expect(project.previousSlugs).toEqual(['desk-mate', 'office-desks']);
});

test('projects saved before slug history existed still map cleanly', () => {
  const project = mapPublicProject('old', { slug: 'laya', type: 'Development', title: 'Laya', shortDescription: 'Shop' });
  expect(project.previousSlugs).toEqual([]);
});
