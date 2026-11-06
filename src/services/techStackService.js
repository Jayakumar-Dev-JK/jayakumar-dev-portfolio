import { collection, doc, getDoc, getDocs, query, serverTimestamp, where, writeBatch } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { slugify } from '../lib/validation';
import { auditWrite } from './auditService';
import { seedAsCategories } from './publicTechStackService';

// Tech Stack & Skills data layer. The backend is Firestore (client SDK + Security Rules), so
// "endpoints" are the functions below; writes are protected by firestore.rules (admins only).
// Multi-document changes use a write batch, which commits atomically.
//
//   techCategories/{slug}  name, slug, icon, sortOrder, isActive, createdAt, updatedAt
//   techSkills/{id}        categoryId, name, slug, icon, logoDefault, logoHover, sortOrder, isActive,
//                          createdAt, updatedAt (+ legacy iconUrl / iconSvg, cleared on save)
//     logoDefault / logoHover = { url, publicId, source: 'builtin' | 'custom', iconKey } or null:
//     logo files in Cloudinary (PortFolio/tech-stack/default and /hover).
//   techStackMeta/seed     marker so the starter content is only ever created once

const categoriesCol = () => collection(db, 'techCategories');
const skillsCol = () => collection(db, 'techSkills');

const bySortOrder = (a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.name.localeCompare(b.name);
const toItem = (snap) => ({ id: snap.id, ...snap.data() });

function group(categories, skills) {
  return categories.sort(bySortOrder).map((category) => ({
    ...category,
    skills: skills.filter((s) => s.categoryId === category.id).sort(bySortOrder),
  }));
}

/* ---------- Admin: read ---------- */

export async function listTechStack() {
  const [categorySnap, skillSnap] = await Promise.all([getDocs(categoriesCol()), getDocs(skillsCol())]);
  return group(categorySnap.docs.map(toItem), skillSnap.docs.map(toItem));
}

/* ---------- Admin: categories ---------- */

function categoryFields(input) {
  return {
    name: input.name.trim(),
    icon: input.icon || '',
    sortOrder: Number(input.sortOrder) || 0,
    isActive: Boolean(input.isActive),
  };
}

// The document ID is the slug, which keeps category slugs unique.
export async function createTechCategory(input, uid) {
  const slug = slugify(input.name);
  const ref = doc(db, 'techCategories', slug);
  if ((await getDoc(ref)).exists()) throw new Error(`A category named "${input.name.trim()}" already exists.`);
  const batch = writeBatch(db);
  batch.set(ref, { ...categoryFields(input), slug, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
  batch.set(...auditWrite(uid, 'create', 'tech-category', slug));
  await batch.commit();
  return slug;
}

// The slug (document ID) never changes; renaming only changes the display name.
export async function updateTechCategory(id, input, uid) {
  const batch = writeBatch(db);
  batch.update(doc(db, 'techCategories', id), { ...categoryFields(input), updatedAt: serverTimestamp() });
  batch.set(...auditWrite(uid, 'update', 'tech-category', id));
  await batch.commit();
}

export async function setTechCategoryActive(id, isActive, uid) {
  const batch = writeBatch(db);
  batch.update(doc(db, 'techCategories', id), { isActive, updatedAt: serverTimestamp() });
  batch.set(...auditWrite(uid, 'update', 'tech-category', id));
  await batch.commit();
}

// A category that still has skills needs an explicit decision:
//   { mode: 'delete' }            → delete the category and all of its skills
//   { mode: 'move', moveTo: id }  → move the skills to another category first
export async function deleteTechCategory(id, uid, { mode, moveTo } = {}) {
  const skills = (await getDocs(query(skillsCol(), where('categoryId', '==', id)))).docs.map(toItem);
  const batch = writeBatch(db);

  if (skills.length > 0) {
    if (mode === 'move') {
      if (!moveTo || moveTo === id) throw new Error('Choose another category for the skills.');
      const target = (await getDocs(query(skillsCol(), where('categoryId', '==', moveTo)))).docs.map(toItem);
      const taken = new Set(target.map((s) => s.slug));
      const clash = skills.find((s) => taken.has(s.slug));
      if (clash) throw new Error(`"${clash.name}" already exists in the target category. Rename or delete it first.`);
      let order = target.reduce((max, s) => Math.max(max, s.sortOrder ?? 0), -1) + 1;
      skills.sort(bySortOrder).forEach((s) =>
        batch.update(doc(db, 'techSkills', s.id), { categoryId: moveTo, sortOrder: order++, updatedAt: serverTimestamp() })
      );
    } else if (mode === 'delete') {
      skills.forEach((s) => batch.delete(doc(db, 'techSkills', s.id)));
    } else {
      throw new Error('This category still has skills. Choose whether to move or delete them.');
    }
  }

  batch.delete(doc(db, 'techCategories', id));
  batch.set(...auditWrite(uid, 'delete', 'tech-category', id));
  await batch.commit();
}

// orderedIds is the full list in its new order; sortOrder becomes the position.
export async function reorderTechCategories(orderedIds, uid) {
  const batch = writeBatch(db);
  orderedIds.forEach((id, index) => batch.update(doc(db, 'techCategories', id), { sortOrder: index, updatedAt: serverTimestamp() }));
  batch.set(...auditWrite(uid, 'reorder', 'tech-category', 'all'));
  await batch.commit();
}

/* ---------- Admin: skills ---------- */

const logoRecord = (logo) =>
  logo ? { url: logo.url, publicId: logo.publicId, source: logo.source, iconKey: logo.iconKey || '' } : null;

// `input.logoDefault` / `input.logoHover` are already-uploaded logo records (see admin/logoSvg.js).
function skillFields(input) {
  const name = input.name.trim();
  return {
    categoryId: input.categoryId,
    name,
    slug: slugify(name),
    icon: input.icon || '',
    logoDefault: logoRecord(input.logoDefault),
    logoHover: logoRecord(input.logoHover),
    iconUrl: '',
    iconSvg: '',
    sortOrder: Number(input.sortOrder) || 0,
    isActive: Boolean(input.isActive),
  };
}

// Exported so the admin can check before uploading logo files.
export async function assertNoDuplicate(categoryId, slug, ignoreId) {
  const snap = await getDocs(query(skillsCol(), where('categoryId', '==', categoryId)));
  if (snap.docs.some((d) => d.id !== ignoreId && d.data().slug === slug)) {
    throw new Error('This category already has a skill with that name.');
  }
}

export async function createTechSkill(input, uid) {
  const fields = skillFields(input);
  await assertNoDuplicate(fields.categoryId, fields.slug);
  const ref = doc(skillsCol());
  const batch = writeBatch(db);
  batch.set(ref, { ...fields, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
  batch.set(...auditWrite(uid, 'create', 'tech-skill', ref.id));
  await batch.commit();
  return ref.id;
}

// `nextSortOrder` is used when the skill moves to another category (it goes to the end).
export async function updateTechSkill(id, input, uid, { moved = false, nextSortOrder = 0 } = {}) {
  const fields = skillFields(input);
  await assertNoDuplicate(fields.categoryId, fields.slug, id);
  if (moved) fields.sortOrder = nextSortOrder;
  const batch = writeBatch(db);
  batch.update(doc(db, 'techSkills', id), { ...fields, updatedAt: serverTimestamp() });
  batch.set(...auditWrite(uid, 'update', 'tech-skill', id));
  await batch.commit();
}

export async function setTechSkillActive(id, isActive, uid) {
  const batch = writeBatch(db);
  batch.update(doc(db, 'techSkills', id), { isActive, updatedAt: serverTimestamp() });
  batch.set(...auditWrite(uid, 'update', 'tech-skill', id));
  await batch.commit();
}

export async function deleteTechSkill(id, uid) {
  const batch = writeBatch(db);
  batch.delete(doc(db, 'techSkills', id));
  batch.set(...auditWrite(uid, 'delete', 'tech-skill', id));
  await batch.commit();
}

export async function reorderTechSkills(orderedIds, uid) {
  const batch = writeBatch(db);
  orderedIds.forEach((id, index) => batch.update(doc(db, 'techSkills', id), { sortOrder: index, updatedAt: serverTimestamp() }));
  batch.set(...auditWrite(uid, 'reorder', 'tech-skill', 'batch'));
  await batch.commit();
}

// Stores uploaded logo records on many skills: updates is [{ id, logoDefault, logoHover }].
// Legacy logo fields are cleared. Batches hold at most 500 writes, so large lists are
// committed in chunks (each chunk is atomic).
export async function saveSkillLogos(updates, uid) {
  for (let start = 0; start < updates.length; start += 400) {
    const batch = writeBatch(db);
    updates.slice(start, start + 400).forEach(({ id, logoDefault, logoHover }) =>
      batch.update(doc(db, 'techSkills', id), {
        logoDefault: logoRecord(logoDefault),
        logoHover: logoRecord(logoHover),
        iconUrl: '',
        iconSvg: '',
        updatedAt: serverTimestamp(),
      })
    );
    batch.set(...auditWrite(uid, 'update-logos', 'tech-skill', 'batch'));
    await batch.commit();
  }
}

/* ---------- Seeding ---------- */

// Creates the starter categories and skills once. Safe to run repeatedly: a marker document
// records that seeding happened, so later runs (and app restarts) never recreate or overwrite
// anything the admin has changed or deleted. If content already exists, only the marker is set.
// Returns the number of categories created.
export async function seedTechStack(uid) {
  const marker = doc(db, 'techStackMeta', 'seed');
  if ((await getDoc(marker)).exists()) return 0;

  const existing = await getDocs(categoriesCol());
  const batch = writeBatch(db);
  let created = 0;
  if (existing.empty) {
    seedAsCategories().forEach((category) => {
      const { skills, id, ...fields } = category;
      batch.set(doc(db, 'techCategories', id), { ...fields, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
      skills.forEach(({ id: skillId, ...skill }) =>
        batch.set(doc(db, 'techSkills', skillId), { ...skill, createdAt: serverTimestamp(), updatedAt: serverTimestamp() })
      );
      created += 1;
    });
  }
  batch.set(marker, { seededAt: serverTimestamp(), seededBy: uid });
  batch.set(...auditWrite(uid, 'seed', 'tech-category', 'defaults'));
  await batch.commit();
  return created;
}
