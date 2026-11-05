import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  where,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { LEGACY_PROJECTS } from '../data/legacyProjects';
import { SAMPLE_POST } from '../data/samplePost';
import { nextPreviousSlugs, parseTags, parseVideoUrl, validateProject } from '../lib/validation';
import { auditWrite } from './auditService';
import { listCategories, seedDefaultCategories } from './categoryService';

// Admin-side project operations. Every write is also checked by Firestore Security Rules.

const projectsCol = () => collection(db, 'projects');
const ADMIN_LIST_LIMIT = 500;

export class ValidationError extends Error {
  constructor(fieldErrors) {
    super('Please fix the highlighted fields.');
    this.fieldErrors = fieldErrors;
  }
}

export class ConflictError extends Error {}

function editableFields(input) {
  const gallery = (input.gallery || []).map((img) => ({ url: img.url.trim(), alt: (img.alt || '').trim() }));
  // A post without its own cover uses its first image.
  const cover = input.coverMedia?.url ? input.coverMedia : gallery[0] || {};
  const video = input.videoUrl ? parseVideoUrl(input.videoUrl) : null;
  return {
    title: input.title.trim(),
    slug: input.slug,
    type: input.type,
    shortDescription: input.shortDescription.trim(),
    description: (input.description || '').trim(),
    categoryIds: input.categoryIds,
    techStack: input.techStack,
    coverMedia: cover.url ? { type: 'image', url: cover.url.trim(), alt: (cover.alt || '').trim() } : null,
    // media[] currently holds at most one external video: { type, provider, videoId }.
    media: video ? [{ type: 'video', ...video }] : [],
    links: (input.links || []).map((link) => ({ label: link.label.trim(), type: link.type, url: link.url.trim() })),
    projectUrl: (input.projectUrl || '').trim(),
    featured: Boolean(input.featured),
    sortOrder: Number(input.sortOrder) || 0,
    display: input.display === 'gallery' ? 'gallery' : 'link',
    gallery,
  };
}

// The old web address of a published project is kept when its slug changes (see nextPreviousSlugs).
function slugHistory(existing, newSlug) {
  const next = nextPreviousSlugs(existing, newSlug);
  const before = Array.isArray(existing?.previousSlugs) ? existing.previousSlugs : [];
  return JSON.stringify(next) === JSON.stringify(before) ? {} : { previousSlugs: next };
}

export async function listProjects() {
  const snap = await getDocs(query(projectsCol(), orderBy('updatedAt', 'desc'), limit(ADMIN_LIST_LIMIT)));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function getProject(id) {
  const snap = await getDoc(doc(db, 'projects', id));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export async function isSlugTaken(slug, exceptId) {
  const snap = await getDocs(query(projectsCol(), where('slug', '==', slug), limit(2)));
  return snap.docs.some((d) => d.id !== exceptId);
}

// An address a published project used before. It redirects to that project, so it can't be reused.
export async function isSlugReserved(slug, exceptId) {
  const snap = await getDocs(query(projectsCol(), where('previousSlugs', 'array-contains', slug), limit(2)));
  return snap.docs.some((d) => d.id !== exceptId);
}

async function assertValid(input, { publish, exceptId }) {
  const errors = validateProject(input, { publish, categories: await listCategories() });
  if (!errors.slug && (await isSlugTaken(input.slug, exceptId))) {
    errors.slug = 'Another project already uses this slug.';
  } else if (!errors.slug && (await isSlugReserved(input.slug, exceptId))) {
    errors.slug = 'This address belonged to another project before and now redirects to it. Choose a different slug.';
  }
  if (Object.keys(errors).length) throw new ValidationError(errors);
}

// New projects always start as drafts.
export async function createProject(input, uid) {
  await assertValid(input, { publish: false });
  const ref = doc(projectsCol());
  const batch = writeBatch(db);
  batch.set(ref, {
    ...editableFields(input),
    status: 'draft',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    publishedAt: null,
    createdBy: uid,
    updatedBy: uid,
    deletedAt: null,
  });
  batch.set(...auditWrite(uid, 'create', 'project', ref.id));
  await batch.commit();
  return ref.id;
}

// `expectedUpdatedAt` (millis) guards against overwriting a newer save made elsewhere.
export async function updateProject(id, input, uid, expectedUpdatedAt) {
  const ref = doc(db, 'projects', id);
  const stored = await getProject(id);
  if (!stored) throw new Error('This project no longer exists.');
  await assertValid(input, { publish: stored.status === 'published', exceptId: id });

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error('This project no longer exists.');
    const current = snap.data().updatedAt?.toMillis?.() ?? null;
    if (expectedUpdatedAt != null && current !== expectedUpdatedAt) {
      throw new ConflictError('This project was changed somewhere else after you opened it. Reload to see the latest version.');
    }
    const existing = snap.data();
    tx.update(ref, {
      ...editableFields(input),
      ...slugHistory(existing, input.slug),
      updatedAt: serverTimestamp(),
      updatedBy: uid,
    });
    const [auditRef, auditData] = auditWrite(uid, 'update', 'project', id);
    tx.set(auditRef, auditData);
  });
}

async function setStatus(id, uid, action, fields) {
  const batch = writeBatch(db);
  batch.update(doc(db, 'projects', id), { ...fields, updatedAt: serverTimestamp(), updatedBy: uid });
  batch.set(...auditWrite(uid, action, 'project', id));
  await batch.commit();
}

export async function publishProject(id, uid) {
  const stored = await getProject(id);
  if (!stored) throw new Error('This project no longer exists.');
  if (stored.deletedAt) throw new Error('Restore this project from the trash before publishing it.');
  await assertValid(stored, { publish: true, exceptId: id });
  await setStatus(id, uid, 'publish', { status: 'published', publishedAt: serverTimestamp() });
}

export const unpublishProject = (id, uid) => setStatus(id, uid, 'unpublish', { status: 'draft' });
export const archiveProject = (id, uid) => setStatus(id, uid, 'archive', { status: 'archived' });
export const restoreProject = (id, uid) => setStatus(id, uid, 'restore', { status: 'draft', deletedAt: null });
// Soft delete: hidden from public output and normal lists; recoverable from the trash.
export const softDeleteProject = (id, uid) => setStatus(id, uid, 'delete', { status: 'draft', deletedAt: serverTimestamp() });

// Only projects already in the trash can be permanently deleted (the rules enforce this too).
export async function permanentlyDeleteProject(id, uid) {
  const batch = writeBatch(db);
  batch.delete(doc(db, 'projects', id));
  batch.set(...auditWrite(uid, 'purge', 'project', id));
  await batch.commit();
}

// One-time migration of the original hard-coded projects. Skips any slug that already exists.
export async function importLegacyProjects(uid) {
  await seedDefaultCategories(uid);
  let imported = 0;
  for (const [index, legacy] of LEGACY_PROJECTS.entries()) {
    if (await isSlugTaken(legacy.slug)) continue;
    const id = await createProject(
      {
        title: legacy.title,
        slug: legacy.slug,
        type: 'Development',
        shortDescription: legacy.description,
        description: '',
        categoryIds: [legacy.category],
        techStack: parseTags(legacy.platform),
        coverMedia: { url: legacy.thumbnail, alt: legacy.title },
        links: [],
        projectUrl: '',
        featured: false,
        sortOrder: index,
      },
      uid
    );
    await publishProject(id, uid);
    imported += 1;
  }
  return imported;
}

// Creates and publishes the sample Design post (see src/data/samplePost.js).
// Returns the new project ID, or null if the sample already exists.
export async function createSamplePost(uid) {
  await seedDefaultCategories(uid); // makes sure the "Others" category exists
  if (await isSlugTaken(SAMPLE_POST.slug)) return null;
  const id = await createProject(SAMPLE_POST, uid);
  await publishProject(id, uid);
  return id;
}
