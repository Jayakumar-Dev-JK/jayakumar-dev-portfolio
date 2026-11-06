import { isFirebaseConfigured } from '../lib/firebaseConfig';
import { queryEquals } from '../lib/firestoreRest';
import { slugify } from '../lib/validation';
import { TECH_STACK_SEED } from '../data/techStackSeed';

// Public read of the tech stack. Kept apart from techStackService (the admin's write layer) and
// fetched with a plain request, so the home page doesn't download the Firebase SDK for it.

const bySortOrder = (a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.name.localeCompare(b.name);
const toItem = ({ id, data }) => ({ id, ...data });

function group(categories, skills) {
  return categories.sort(bySortOrder).map((category) => ({
    ...category,
    skills: skills.filter((s) => s.categoryId === category.id).sort(bySortOrder),
  }));
}

export function seedAsCategories() {
  return TECH_STACK_SEED.map((c, ci) => ({
    id: c.slug,
    name: c.name,
    slug: c.slug,
    icon: c.icon,
    sortOrder: ci,
    isActive: true,
    skills: c.skills.map(([name, icon], si) => ({
      id: `${c.slug}--${slugify(name)}`,
      categoryId: c.slug,
      name,
      slug: slugify(name),
      icon,
      iconUrl: '',
      iconSvg: '',
      sortOrder: si,
      isActive: true,
    })),
  }));
}

// Active categories with their active skills, in admin order. Queries must filter on
// isActive == true because Security Rules are not filters. Categories with no visible
// skills are dropped. Without Firebase configured (local dev) the starter content is shown.
export async function fetchPublicTechStack() {
  if (!isFirebaseConfigured) return seedAsCategories();
  const [categoryDocs, skillDocs] = await Promise.all([
    queryEquals('techCategories', 'isActive', true),
    queryEquals('techSkills', 'isActive', true),
  ]);
  return group(categoryDocs.map(toItem), skillDocs.map(toItem)).filter((c) => c.skills.length > 0);
}
