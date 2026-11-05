import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { isSafeUrl, videoEmbedUrl, videoFileUrl } from '../lib/validation';
import { fetchActiveCategories } from './categoryService';

const text = (value) => (typeof value === 'string' ? value.trim() : '');

// Maps a project document to the fields the public pages need. Unsafe URLs and unknown video
// providers are dropped here. The admin preview uses it too, so it shows what visitors will see.
export function mapPublicProject(id, data) {
  const video = (data.media || []).find((m) => m.type === 'video');
  return {
    id,
    slug: data.slug,
    previousSlugs: Array.isArray(data.previousSlugs) ? data.previousSlugs.filter((s) => typeof s === 'string') : [],
    role: text(data.role),
    year: text(data.year),
    problem: text(data.problem),
    process: text(data.process),
    outcome: text(data.outcome),
    type: data.type,
    title: data.title,
    description: data.shortDescription,
    fullDescription: typeof data.description === 'string' ? data.description : '',
    thumbnail: isSafeUrl(data.coverMedia?.url) ? data.coverMedia.url : null,
    thumbnailAlt: data.coverMedia?.alt || '',
    tags: Array.isArray(data.techStack) ? data.techStack : [],
    // Cards open the primary link directly, or show the post popup for gallery posts.
    display: data.display === 'gallery' ? 'gallery' : 'link',
    href: isSafeUrl(data.projectUrl) ? data.projectUrl : null,
    links: (Array.isArray(data.links) ? data.links : [])
      .filter((link) => isSafeUrl(link.url) && link.label)
      .map((link) => ({ label: link.label, url: link.url })),
    gallery: (Array.isArray(data.gallery) ? data.gallery : [])
      .filter((img) => isSafeUrl(img.url))
      .map((img) => ({ url: img.url, alt: img.alt || '' })),
    videoEmbedUrl: videoEmbedUrl(video),
    videoFileUrl: videoFileUrl(video),
    categoryIds: Array.isArray(data.categoryIds) ? data.categoryIds : [],
    featured: Boolean(data.featured),
    sortOrder: Number(data.sortOrder) || 0,
  };
}

const toPublicProject = (snap) => mapPublicProject(snap.id, snap.data());

const byDisplayOrder = (a, b) =>
  Number(b.featured) - Number(a.featured) || a.sortOrder - b.sortOrder || a.title.localeCompare(b.title);

export async function fetchPublicPortfolio() {
  const [projectSnap, categories] = await Promise.all([
    // The status filter is required: Security Rules reject queries that could return drafts.
    getDocs(query(collection(db, 'projects'), where('status', '==', 'published'))),
    fetchActiveCategories(),
  ]);
  return {
    projects: projectSnap.docs.map(toPublicProject).sort(byDisplayOrder),
    categories,
  };
}
