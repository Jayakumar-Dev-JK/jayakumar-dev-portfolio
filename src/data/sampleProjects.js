// TEMPORARY sample data for the local review page (src/pages/ProjectsPreview.jsx). Never used by the real
// site and never written to Firestore. Delete this file with the review page after approval.
// Thumbnails are generated SVGs, so the review works offline.
import { DEFAULT_CATEGORIES } from './legacyProjects';

const PALETTES = [
  ['#0f766e', '#134e4a'],
  ['#1d4ed8', '#1e3a8a'],
  ['#7e22ce', '#581c87'],
  ['#be185d', '#831843'],
  ['#b45309', '#78350f'],
  ['#0e7490', '#164e63'],
];

function thumbnail(index, label) {
  const [from, to] = PALETTES[index % PALETTES.length];
  const svg =
    `<svg xmlns='http://www.w3.org/2000/svg' width='640' height='360' viewBox='0 0 640 360'>` +
    `<defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='${from}'/><stop offset='1' stop-color='${to}'/></linearGradient></defs>` +
    `<rect width='640' height='360' fill='url(#g)'/><rect x='48' y='56' width='544' height='248' rx='16' fill='white' fill-opacity='0.12'/>` +
    `<text x='320' y='196' text-anchor='middle' font-family='Arial, sans-serif' font-size='40' font-weight='700' fill='white'>${label}</text></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

// [title, description, categories, tags]. Several projects sit in two categories, as real ones do.
const DESIGN = [
  ['Deskmate', 'Office seat booking and availability in real time', ['web-app', 'websites'], ['Figma', 'Prototyping', 'UX Research']],
  ['Pulse', 'A social product for quick voice rooms', ['mobile-app'], ['Figma', 'Mobile UI', 'Motion']],
  ['Northwind Studio', 'Marketing website for an architecture studio', ['websites'], ['Figma', 'Webflow']],
  ['Summer Campaign', 'Poster series for a seasonal sale', ['others'], ['Photoshop', 'Poster Design']],
  ['Smart Admin', 'A calm dashboard for operations teams', ['web-app', 'websites'], ['Figma', 'Design System']],
  ['Wander', 'Trip planning with offline maps', ['mobile-app'], ['Figma', 'Mobile UI']],
  ['Bloom Florist', 'Online shop redesign focused on gifting', ['websites'], ['Figma', 'UI Design']],
  ['Brand Kit', 'Logo, colours and social templates', ['others', 'websites'], ['Illustrator', 'Branding']],
  ['Ledger', 'Personal finance dashboard concept', ['web-app', 'websites'], ['Figma', 'Data Viz']],
  ['FitLoop', 'Workout tracking with weekly goals', ['mobile-app', 'websites'], ['Figma', 'Prototyping']],
];

const DEVELOPMENT = [
  ['Why Weds', 'Wedding events planning web application', ['web'], ['React', 'Tailwind CSS', 'Node', 'MongoDB']],
  ['Laya', 'Skin and hair care e-commerce store', ['ecommerce'], ['React', 'Node', 'MongoDB']],
  ['Thozhil Admin', 'Admin module of a job portal', ['dashboard', 'web'], ['React', 'Tailwind CSS']],
  ['Plasma Donor', 'Cloud app that connects plasma donors', ['web'], ['Flask', 'IBM Db2']],
  ['Cartwheel', 'Headless storefront with fast checkout', ['ecommerce', 'web'], ['React', 'Stripe']],
];

function build(rows, type, offset) {
  return rows.map(([title, description, categoryIds, tags], i) => ({
    id: `${type}-${i}`,
    slug: title.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    type,
    title,
    description,
    thumbnail: thumbnail(offset + i, title),
    thumbnailAlt: `${title} preview`,
    tags,
    display: 'link',
    href: null,
    links: [],
    gallery: [],
    categoryIds,
    featured: false,
    sortOrder: i,
  }));
}

// "full": 10 Design + 5 Development. "short": 3 Design + 2 Development (every list fits on screen).
export function sampleProjects(size) {
  const design = build(DESIGN, 'Design', 0);
  const development = build(DEVELOPMENT, 'Development', 3);
  return {
    projects: size === 'short' ? [...design.slice(0, 3), ...development.slice(0, 2)] : [...design, ...development],
    categories: DEFAULT_CATEGORIES,
  };
}
