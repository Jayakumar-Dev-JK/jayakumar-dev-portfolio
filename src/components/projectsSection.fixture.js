// Test-only data for projectsSection.test.jsx: 10 Design + 5 Development projects, several in two
// categories (as real ones are), so "Websites" is a long list and the others are short. Not used by the site.
import { DEFAULT_CATEGORIES } from '../data/legacyProjects';

const DESIGN = [
  ['Deskmate', ['web-app', 'websites']],
  ['Pulse', ['mobile-app']],
  ['Northwind Studio', ['websites']],
  ['Summer Campaign', ['others']],
  ['Smart Admin', ['web-app', 'websites']],
  ['Wander', ['mobile-app']],
  ['Bloom Florist', ['websites']],
  ['Brand Kit', ['others', 'websites']],
  ['Ledger', ['web-app', 'websites']],
  ['FitLoop', ['mobile-app', 'websites']],
];

const DEVELOPMENT = [
  ['Why Weds', ['web']],
  ['Laya', ['ecommerce']],
  ['Thozhil Admin', ['dashboard', 'web']],
  ['Plasma Donor', ['web']],
  ['Cartwheel', ['ecommerce', 'web']],
];

const build = (rows, type) =>
  rows.map(([title, categoryIds], i) => ({
    id: `${type}-${i}`,
    slug: title.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    type,
    title,
    description: `${title} description`,
    thumbnail: null,
    thumbnailAlt: '',
    tags: ['Figma'],
    display: 'link',
    href: null,
    links: [],
    gallery: [],
    categoryIds,
    featured: false,
    sortOrder: i,
  }));

// "full": 10 Design + 5 Development. "short": 3 Design + 2 Development.
export function fixtureProjects(size) {
  const design = build(DESIGN, 'Design');
  const development = build(DEVELOPMENT, 'Development');
  return {
    projects: size === 'short' ? [...design.slice(0, 3), ...development.slice(0, 2)] : [...design, ...development],
    categories: DEFAULT_CATEGORIES,
  };
}
