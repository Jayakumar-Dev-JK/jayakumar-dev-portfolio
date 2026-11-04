// Shared validation for the admin forms. Firestore Security Rules repeat the critical
// checks server-side; this module exists for usable, field-level error messages.

export const PROJECT_TYPES = ['Design', 'Development'];
// What a project card does when clicked: open its primary link, or show the post popup.
export const DISPLAY_MODES = ['link', 'gallery'];
export const LINK_TYPES = ['Live Demo', 'Case Study', 'Figma', 'Behance', 'Repository', 'Other'];
export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const LIMITS = {
  title: 120,
  slug: 80,
  shortDescription: 300,
  description: 5000,
  techStack: 20,
  tag: 40,
  links: 10,
  categories: 5,
  url: 2000,
  alt: 200,
  categoryName: 60,
  categoryDescription: 300,
  gallery: 20,
};

export function slugify(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, LIMITS.slug)
    .replace(/-+$/, '');
}

// Short slug for a new project: the part of the title before " - ", " – ", ":" or "|",
// at most 6 words. "Deskmate - Tracking office seats" -> "deskmate".
export function slugFromTitle(title) {
  const head = String(title || '').split(/\s[-–—|]\s|:|\|/)[0];
  return slugify(head.trim().split(/\s+/).slice(0, 6).join(' '));
}

// Only https:// URLs are accepted. Rejects javascript:, data:, http: and malformed values.
export function isSafeUrl(value) {
  if (typeof value !== 'string' || !value || value.length > LIMITS.url) return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && Boolean(url.hostname);
  } catch {
    return false;
  }
}

/* ---------- Video: YouTube / Vimeo links, or files uploaded to Cloudinary ----------
   For YouTube/Vimeo only the provider and a validated video ID are stored, and embed URLs
   are rebuilt from those, so an arbitrary URL can never end up in an iframe. Uploaded
   videos are played with <video>, and only from res.cloudinary.com video URLs. */

const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/;
const VIMEO_ID = /^\d{6,12}$/;
const CLOUDINARY_VIDEO = /^https:\/\/res\.cloudinary\.com\/[a-z0-9_-]+\/video\/upload\/[^\s?#"<>]+$/i;

export function parseVideoUrl(value) {
  if (!isSafeUrl(value)) return null;
  const url = new URL(value);
  const host = url.hostname.replace(/^(www|m)\./, '');
  let provider = null;
  let id = null;

  if (host === 'res.cloudinary.com') {
    const fileUrl = `${url.origin}${url.pathname}`;
    return CLOUDINARY_VIDEO.test(fileUrl) ? { provider: 'cloudinary', url: fileUrl } : null;
  }

  if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
    provider = 'youtube';
    id = url.pathname === '/watch' ? url.searchParams.get('v') : url.pathname.match(/^\/(?:embed|shorts|live)\/([^/]+)/)?.[1];
  } else if (host === 'youtu.be') {
    provider = 'youtube';
    id = url.pathname.split('/')[1];
  } else if (host === 'vimeo.com') {
    provider = 'vimeo';
    id = url.pathname.split('/').filter(Boolean).pop();
  } else if (host === 'player.vimeo.com') {
    provider = 'vimeo';
    id = url.pathname.match(/^\/video\/(\d+)/)?.[1];
  }

  if (provider === 'youtube' && YOUTUBE_ID.test(id || '')) return { provider, videoId: id };
  if (provider === 'vimeo' && VIMEO_ID.test(id || '')) return { provider, videoId: id };
  return null;
}

export function videoEmbedUrl(video) {
  if (video?.provider === 'youtube' && YOUTUBE_ID.test(video.videoId || '')) {
    return `https://www.youtube-nocookie.com/embed/${video.videoId}`;
  }
  if (video?.provider === 'vimeo' && VIMEO_ID.test(video.videoId || '')) {
    return `https://player.vimeo.com/video/${video.videoId}?dnt=1`;
  }
  return null;
}

// Direct file URL for uploaded videos (played with <video>, never in an iframe).
export function videoFileUrl(video) {
  return video?.provider === 'cloudinary' && CLOUDINARY_VIDEO.test(video.url || '') ? video.url : null;
}

// Canonical URL, used to show a stored video back in the admin form.
export function videoWatchUrl(video) {
  if (videoFileUrl(video)) return video.url;
  if (!videoEmbedUrl(video)) return '';
  return video.provider === 'youtube'
    ? `https://www.youtube.com/watch?v=${video.videoId}`
    : `https://vimeo.com/${video.videoId}`;
}

// "React, Tailwind CSS, react" -> ["React", "Tailwind CSS"]
export function parseTags(text) {
  const seen = new Set();
  return String(text || '')
    .split(',')
    .map((tag) => tag.trim())
    .filter((tag) => {
      const key = tag.toLowerCase();
      if (!tag || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

/**
 * Returns an object of field -> message; empty when valid.
 * `publish: true` adds the publish-only requirements (cover image with alt text).
 * `categories` is the loaded category list, used to check category/type compatibility.
 */
export function validateProject(project, { publish = false, categories = [] } = {}) {
  const errors = {};
  const title = (project.title || '').trim();
  const shortDescription = (project.shortDescription || '').trim();
  const categoryIds = project.categoryIds || [];
  const techStack = project.techStack || [];
  const links = project.links || [];
  const cover = project.coverMedia || {};

  if (!title) errors.title = 'Title is required.';
  else if (title.length > LIMITS.title) errors.title = `Keep the title under ${LIMITS.title} characters.`;

  if (!project.slug) errors.slug = 'Slug is required.';
  else if (!SLUG_PATTERN.test(project.slug) || project.slug.length > LIMITS.slug) {
    errors.slug = 'Use lowercase letters, numbers and single hyphens only.';
  }

  if (!PROJECT_TYPES.includes(project.type)) errors.type = 'Choose Design or Development.';

  if (!shortDescription) errors.shortDescription = 'Short description is required.';
  else if (shortDescription.length > LIMITS.shortDescription) {
    errors.shortDescription = `Keep the short description under ${LIMITS.shortDescription} characters.`;
  }

  if ((project.description || '').length > LIMITS.description) {
    errors.description = `Keep the full description under ${LIMITS.description} characters.`;
  }

  if (categoryIds.length === 0) errors.categoryIds = 'Choose at least one category.';
  else if (categoryIds.length > LIMITS.categories) errors.categoryIds = `Choose at most ${LIMITS.categories} categories.`;
  else {
    const allValid = categoryIds.every((id) => {
      const category = categories.find((c) => c.id === id);
      return category && category.active && (category.projectTypes || []).includes(project.type);
    });
    if (!allValid) errors.categoryIds = 'A selected category is inactive or not available for this project type.';
  }

  if (techStack.length > LIMITS.techStack) errors.techStack = `Use at most ${LIMITS.techStack} tags.`;
  else if (techStack.some((tag) => tag.length > LIMITS.tag)) errors.techStack = `Keep each tag under ${LIMITS.tag} characters.`;

  if (cover.url && !isSafeUrl(cover.url)) errors.coverUrl = 'Use a valid https:// image URL.';
  else if (publish && !cover.url && !(project.gallery || []).length) {
    errors.coverUrl = 'A cover image is required to publish.';
  }
  if ((cover.alt || '').length > LIMITS.alt) errors.coverAlt = `Keep alt text under ${LIMITS.alt} characters.`;
  else if (publish && cover.url && !(cover.alt || '').trim()) errors.coverAlt = 'Describe the cover image to publish.';

  if (project.projectUrl && !isSafeUrl(project.projectUrl)) errors.projectUrl = 'Use a valid https:// URL.';

  if (project.videoUrl && !parseVideoUrl(project.videoUrl)) {
    errors.videoUrl = 'Use a YouTube or Vimeo link, or upload a video.';
  }

  if (links.length > LIMITS.links) errors.links = `Add at most ${LIMITS.links} links.`;
  links.forEach((link, i) => {
    if (!(link.label || '').trim()) errors[`link-${i}`] = 'Add a label for this link.';
    else if (!isSafeUrl(link.url)) errors[`link-${i}`] = 'Use a valid https:// URL.';
  });

  if (!Number.isFinite(Number(project.sortOrder))) errors.sortOrder = 'Sort order must be a number.';

  const display = project.display || 'link';
  const gallery = project.gallery || [];
  if (!DISPLAY_MODES.includes(display)) errors.display = 'Choose what happens when the card is clicked.';
  if (gallery.length > LIMITS.gallery) errors.gallery = `Add at most ${LIMITS.gallery} images.`;
  else if (gallery.some((img) => !isSafeUrl(img.url))) errors.gallery = 'Every image needs a valid https:// URL.';
  else if (gallery.some((img) => (img.alt || '').length > LIMITS.alt)) errors.gallery = `Keep alt text under ${LIMITS.alt} characters.`;
  else if (publish && display === 'gallery' && gallery.length === 0) errors.gallery = 'Add at least one image to publish a post.';

  return errors;
}

export function validateCategory(category) {
  const errors = {};
  const name = (category.name || '').trim();
  if (!name) errors.name = 'Name is required.';
  else if (name.length > LIMITS.categoryName) errors.name = `Keep the name under ${LIMITS.categoryName} characters.`;
  if (!category.slug || !SLUG_PATTERN.test(category.slug)) errors.slug = 'Use lowercase letters, numbers and single hyphens only.';
  if (!(category.projectTypes || []).length) errors.projectTypes = 'Choose at least one project type.';
  if ((category.description || '').length > LIMITS.categoryDescription) {
    errors.description = `Keep the description under ${LIMITS.categoryDescription} characters.`;
  }
  if (!Number.isFinite(Number(category.sortOrder))) errors.sortOrder = 'Sort order must be a number.';
  return errors;
}

/* ---------- Tech Stack & Skills ---------- */

export const TECH_LIMITS = { name: 60, svg: 20000 };

// Pasted snippets often leave out xmlns. Without it the file isn't recognised as an image:
// Cloudinary rejects the upload ("raw images are not supported") and <img> won't render it.
// Also add the xlink namespace when xlink:href is used, since that is invalid XML without it.
export function withSvgNamespace(svg) {
  const open = /^<svg\b[^>]*>/i.exec(svg)?.[0] || '';
  let extra = '';
  if (!/\sxmlns\s*=/i.test(open)) extra += ' xmlns="http://www.w3.org/2000/svg"';
  if (/xlink:/i.test(svg) && !/\sxmlns:xlink\s*=/i.test(open)) extra += ' xmlns:xlink="http://www.w3.org/1999/xlink"';
  return extra ? svg.replace(/^<svg\b/i, `<svg${extra}`) : svg;
}

// The skill form takes one "logo" input: an https:// image URL or pasted <svg> markup.
// Returns { iconUrl, iconSvg } or { error }. SVGs are only ever shown through <img>, which
// doesn't run scripts, but markup with scripts or event handlers is still rejected.
export function parseLogoInput(value) {
  const text = String(value || '').trim();
  if (!text) return { iconUrl: '', iconSvg: '' };
  if (/^<svg[\s>]/i.test(text)) {
    if (text.length > TECH_LIMITS.svg) return { error: `Keep the SVG under ${TECH_LIMITS.svg / 1000} KB.` };
    if (!/<\/svg>\s*$/i.test(text)) return { error: 'The SVG looks incomplete. Paste everything from <svg to </svg>.' };
    if (/<script|<foreignObject|\son[a-z]+\s*=|javascript:/i.test(text)) {
      return { error: 'This SVG contains scripts or event handlers. Use a plain SVG.' };
    }
    return { iconUrl: '', iconSvg: withSvgNamespace(text) };
  }
  if (!isSafeUrl(text)) return { error: 'Paste an https:// image URL or SVG code that starts with <svg.' };
  return { iconUrl: text, iconSvg: '' };
}
const ICON_KEY = /^[a-z0-9-]{0,40}$/;

export function validateTechCategory(category) {
  const errors = {};
  const name = (category.name || '').trim();
  if (!name) errors.name = 'Name is required.';
  else if (name.length > TECH_LIMITS.name) errors.name = `Keep the name under ${TECH_LIMITS.name} characters.`;
  else if (!slugify(name)) errors.name = 'Use at least one letter or number.';
  if (!ICON_KEY.test(category.icon || '')) errors.icon = 'Pick an icon from the list.';
  if (!Number.isFinite(Number(category.sortOrder))) errors.sortOrder = 'Sort order must be a number.';
  return errors;
}

export function validateTechSkill(skill) {
  const errors = {};
  const name = (skill.name || '').trim();
  if (!name) errors.name = 'Name is required.';
  else if (name.length > TECH_LIMITS.name) errors.name = `Keep the name under ${TECH_LIMITS.name} characters.`;
  else if (!slugify(name)) errors.name = 'Use at least one letter or number.';
  if (!ICON_KEY.test(skill.icon || '')) errors.icon = 'Pick an icon from the list.';
  const logoDefault = parseLogoInput(skill.logoDefault);
  if (logoDefault.error) errors.logoDefault = logoDefault.error;
  const logoHover = parseLogoInput(skill.logoHover);
  if (logoHover.error) errors.logoHover = logoHover.error;
  if (!skill.categoryId) errors.categoryId = 'Choose a category.';
  if (!Number.isFinite(Number(skill.sortOrder))) errors.sortOrder = 'Sort order must be a number.';
  return errors;
}
