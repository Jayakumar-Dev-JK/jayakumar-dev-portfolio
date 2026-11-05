/* SEO helpers shared by the project-page and sitemap Netlify functions.
 *
 * Everything here is pure (no network, no Netlify APIs) so it can be unit tested with
 * `npm run test:functions`. The browser has its own copy of the title/description rules in
 * src/lib/pageMeta.js - keep the two in sync.
 */
const SITE_NAME = 'Jayakumar';
const DEFAULT_SITE_URL = 'https://jayakumarwebdev.netlify.app';
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const TITLE_MAX = 70;
const DESCRIPTION_MAX = 158;

const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ESCAPES[c]);
const isHttps = (value) => typeof value === 'string' && /^https:\/\/[^\s"<>]+$/.test(value);
const collapse = (value) => String(value ?? '').replace(/\s+/g, ' ').trim();

// ---------- Firestore REST values -> plain objects ----------

function fromValue(value) {
  if (!value || typeof value !== 'object') return null;
  if ('stringValue' in value) return value.stringValue;
  if ('integerValue' in value) return Number(value.integerValue);
  if ('doubleValue' in value) return value.doubleValue;
  if ('booleanValue' in value) return value.booleanValue;
  if ('timestampValue' in value) return value.timestampValue;
  if ('arrayValue' in value) return (value.arrayValue.values || []).map(fromValue);
  if ('mapValue' in value) return fromFields(value.mapValue.fields);
  return null;
}

function fromFields(fields) {
  const out = {};
  Object.entries(fields || {}).forEach(([key, value]) => {
    out[key] = fromValue(value);
  });
  return out;
}

// A Firestore REST document -> the fields the public page needs. Unsafe URLs are dropped.
function parseProject(doc) {
  const data = fromFields(doc.fields);
  const asList = (v) => (Array.isArray(v) ? v : []);
  return {
    slug: data.slug,
    title: collapse(data.title),
    type: data.type === 'Design' ? 'Design' : 'Development',
    shortDescription: collapse(data.shortDescription),
    description: typeof data.description === 'string' ? data.description.trim() : '',
    techStack: asList(data.techStack).filter((t) => typeof t === 'string' && t.trim()).map((t) => t.trim()),
    coverUrl: isHttps(data.coverMedia?.url) ? data.coverMedia.url : '',
    coverAlt: collapse(data.coverMedia?.alt),
    gallery: asList(data.gallery)
      .filter((img) => img && isHttps(img.url))
      .map((img) => ({ url: img.url, alt: collapse(img.alt) })),
    projectUrl: isHttps(data.projectUrl) ? data.projectUrl : '',
    links: asList(data.links)
      .filter((link) => link && isHttps(link.url) && link.label)
      .map((link) => ({ label: collapse(link.label), url: link.url })),
    publishedAt: typeof data.publishedAt === 'string' ? data.publishedAt : '',
    updatedAt: doc.updateTime || (typeof data.updatedAt === 'string' ? data.updatedAt : ''),
  };
}

// ---------- title / description ----------

function clip(text, max) {
  const t = collapse(text);
  if (t.length <= max) return t;
  const cut = t.slice(0, max - 1);
  const space = cut.lastIndexOf(' ');
  return `${(space > max * 0.6 ? cut.slice(0, space) : cut).replace(/[.,;:\s]+$/, '')}…`;
}

function seoTitle(title) {
  const full = `${title} | ${SITE_NAME}`;
  if (full.length <= TITLE_MAX) return full;
  return clip(title, TITLE_MAX);
}

function seoDescription(project) {
  let text = project.shortDescription;
  if (text.length < 110 && project.description) text = `${text} ${collapse(project.description)}`.trim();
  if (!text) text = `${project.title} - a ${project.type.toLowerCase()} project by ${SITE_NAME}.`;
  return clip(text, DESCRIPTION_MAX);
}

// Social previews are more reliable with a JPEG at 1200x630 than with the original upload.
function socialImage(url, siteUrl) {
  if (!url) return `${siteUrl}/logo512.png`;
  if (/^https:\/\/res\.cloudinary\.com\/[a-z0-9_-]+\/image\/upload\//i.test(url)) {
    return url.replace('/image/upload/', '/image/upload/c_fill,g_north,w_1200,h_630,f_jpg,q_auto/');
  }
  return url;
}

function buildProjectHead(project, siteUrl = DEFAULT_SITE_URL) {
  const canonical = `${siteUrl}/projects/${project.slug}`;
  const image = socialImage(project.coverUrl, siteUrl);
  const description = seoDescription(project);
  const work = {
    '@context': 'https://schema.org',
    '@type': 'CreativeWork',
    '@id': `${canonical}#project`,
    name: project.title,
    description,
    url: canonical,
    image,
    genre: project.type === 'Design' ? 'UI/UX design' : 'Web development',
    author: { '@id': `${siteUrl}/#person` },
  };
  if (project.techStack.length) work.keywords = project.techStack.join(', ');
  if (project.publishedAt) work.datePublished = project.publishedAt;
  if (project.updatedAt) work.dateModified = project.updatedAt;
  const breadcrumbs = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: `${siteUrl}/` },
      { '@type': 'ListItem', position: 2, name: 'Projects', item: `${siteUrl}/#projects` },
      { '@type': 'ListItem', position: 3, name: project.title, item: canonical },
    ],
  };
  return { title: seoTitle(project.title), description, canonical, image, jsonLd: [work, breadcrumbs] };
}

// ---------- HTML injection ----------

const replaceOrAppend = (html, pattern, tag) =>
  pattern.test(html) ? html.replace(pattern, () => tag) : html.replace('</head>', () => `${tag}\n</head>`);

const metaPattern = (attr, name) => new RegExp(`<meta\\b[^>]*\\b${attr}="${name}"[^>]*>`, 'i');
const setMeta = (html, attr, name, content) =>
  replaceOrAppend(html, metaPattern(attr, name), `<meta ${attr}="${name}" content="${escapeHtml(content)}" />`);

// JSON inside <script> must not be able to close the tag.
const safeJson = (value) => JSON.stringify(value).replace(/</g, '\\u003c');

const paragraphsOf = (text) =>
  text ? text.split(/\n{2,}/).map((p) => `<p>${escapeHtml(collapse(p))}</p>`).join('') : '';

function bodyHtml(project) {
  const paragraphs = paragraphsOf(project.description);
  const tech = project.techStack.length
    ? `<h2>Technologies</h2><ul>${project.techStack.map((t) => `<li>${escapeHtml(t)}</li>`).join('')}</ul>`
    : '';
  const links = [
    ...(project.projectUrl ? [{ label: 'View project', url: project.projectUrl }] : []),
    ...project.links,
  ];
  const linkList = links.length
    ? `<ul>${links.map((l) => `<li><a href="${escapeHtml(l.url)}" rel="noopener noreferrer">${escapeHtml(l.label)}</a></li>`).join('')}</ul>`
    : '';
  const image = project.coverUrl
    ? `<img src="${escapeHtml(project.coverUrl)}" alt="${escapeHtml(project.coverAlt || project.title)}" width="1280" height="720" />`
    : '';
  return (
    `<main data-prerendered="project">` +
    `<p><a href="/">Jayakumar</a> / <a href="/#projects">Projects</a></p>` +
    `<h1>${escapeHtml(project.title)}</h1>` +
    `<p>${escapeHtml(project.shortDescription)}</p>${image}${paragraphs}${tech}${linkList}</main>`
  );
}

// `shell` is the site's built index.html. React replaces the pre-rendered <main> when it mounts.
function renderProjectPage(shell, project, siteUrl = DEFAULT_SITE_URL) {
  const head = buildProjectHead(project, siteUrl);
  let html = shell;
  html = replaceOrAppend(html, /<title>[\s\S]*?<\/title>/i, `<title>${escapeHtml(head.title)}</title>`);
  html = setMeta(html, 'name', 'description', head.description);
  html = setMeta(html, 'property', 'og:title', head.title);
  html = setMeta(html, 'property', 'og:description', head.description);
  html = setMeta(html, 'property', 'og:url', head.canonical);
  html = setMeta(html, 'property', 'og:image', head.image);
  html = setMeta(html, 'name', 'twitter:title', head.title);
  html = setMeta(html, 'name', 'twitter:description', head.description);
  html = setMeta(html, 'name', 'twitter:image', head.image);
  html = replaceOrAppend(html, /<link\b[^>]*\brel="canonical"[^>]*>/i, `<link rel="canonical" href="${escapeHtml(head.canonical)}" />`);
  const ld = head.jsonLd.map((d) => `<script type="application/ld+json">${safeJson(d)}</script>`).join('\n');
  html = html.replace('</head>', () => `${ld}\n</head>`);
  return html.replace(/<div id="root"><\/div>/, () => `<div id="root">${bodyHtml(project)}</div>`);
}

function renderNotFoundPage(shell) {
  const title = `Page not found | ${SITE_NAME}`;
  let html = replaceOrAppend(shell, /<title>[\s\S]*?<\/title>/i, `<title>${escapeHtml(title)}</title>`);
  html = setMeta(html, 'name', 'robots', 'noindex, nofollow');
  return html.replace(/<link\b[^>]*\brel="canonical"[^>]*>/i, '');
}

// ---------- sitemap ----------

function buildSitemap(projects, siteUrl = DEFAULT_SITE_URL, today = new Date()) {
  const day = (value) => {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
  };
  const entries = projects
    .filter((p) => SLUG_PATTERN.test(p.slug || ''))
    .map((p) => ({ loc: `${siteUrl}/projects/${p.slug}`, lastmod: day(p.updatedAt), priority: '0.8' }));
  const newest = entries.map((e) => e.lastmod).filter(Boolean).sort().pop();
  entries.unshift({ loc: `${siteUrl}/`, lastmod: newest || day(today), priority: '1.0' });
  const urls = entries
    .map(
      (e) =>
        `  <url>\n    <loc>${escapeHtml(e.loc)}</loc>\n${e.lastmod ? `    <lastmod>${e.lastmod}</lastmod>\n` : ''}    <priority>${e.priority}</priority>\n  </url>`
    )
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}

// ---------- Firestore REST ----------

// Public read of published projects, optionally one slug. Security Rules still apply: the
// status filter is required, exactly like the site's own queries.
async function fetchPublishedProjects({ projectId, slug, previousSlug, fetchImpl = fetch }) {
  const field = (path) => ({ fieldPath: path });
  const filters = [{ fieldFilter: { field: field('status'), op: 'EQUAL', value: { stringValue: 'published' } } }];
  if (slug) filters.push({ fieldFilter: { field: field('slug'), op: 'EQUAL', value: { stringValue: slug } } });
  // A slug that a published project used before (see slug history in the admin).
  if (previousSlug) {
    filters.push({ fieldFilter: { field: field('previousSlugs'), op: 'ARRAY_CONTAINS', value: { stringValue: previousSlug } } });
  }
  const response = await fetchImpl(
    `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/databases/(default)/documents:runQuery`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        structuredQuery: {
          from: [{ collectionId: 'projects' }],
          where: { compositeFilter: { op: 'AND', filters } },
          ...(slug || previousSlug ? { limit: 1 } : {}),
        },
      }),
    }
  );
  if (!response.ok) throw new Error(`Firestore query failed (${response.status})`);
  const rows = await response.json();
  return (Array.isArray(rows) ? rows : []).filter((row) => row.document).map((row) => parseProject(row.document));
}

module.exports = {
  SITE_NAME,
  DEFAULT_SITE_URL,
  SLUG_PATTERN,
  escapeHtml,
  parseProject,
  seoTitle,
  seoDescription,
  socialImage,
  buildProjectHead,
  renderProjectPage,
  renderNotFoundPage,
  buildSitemap,
  fetchPublishedProjects,
};
