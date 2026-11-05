/* Netlify Function: server-rendered head + content for GET /projects/:slug.
 *
 * Routed by public/_redirects (/projects/:slug -> this function). It reads the published
 * project from Firestore, injects its title, description, canonical, social tags, structured
 * data and visible text into the site's built index.html, and returns that. React then takes
 * over in the browser. Publishing a project in the admin is all that is needed - no redeploy.
 *
 * Unknown, draft, archived or deleted slugs get a real 404 with noindex.
 * Environment: FIREBASE_PROJECT_ID (falls back to REACT_APP_FIREBASE_PROJECT_ID).
 */
const seo = require('../lib/seo');

const CACHE_HEADERS = {
  'Content-Type': 'text/html; charset=UTF-8',
  'Cache-Control': 'public, max-age=0, must-revalidate',
  // Netlify's CDN keeps the page for 5 minutes and refreshes it in the background after that.
  'Netlify-CDN-Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
};

function createHandler({ fetchImpl = fetch, env = process.env } = {}) {
  return async function handler(event) {
    const projectId = env.FIREBASE_PROJECT_ID || env.REACT_APP_FIREBASE_PROJECT_ID;
    const siteUrl = env.SITE_URL || seo.DEFAULT_SITE_URL;
    const host = event.headers?.['x-forwarded-host'] || event.headers?.host;
    const origin = host ? `https://${host}` : siteUrl;
    const slug = String(event.queryStringParameters?.slug || '').toLowerCase();

    let shell;
    try {
      const res = await fetchImpl(`${origin}/index.html`);
      if (!res.ok) throw new Error(`index.html ${res.status}`);
      shell = await res.text();
    } catch (err) {
      console.error('project-page: could not load the app shell', err.message);
      return { statusCode: 302, headers: { Location: '/#projects', 'Cache-Control': 'no-store' }, body: '' };
    }

    const notFound = () => ({
      statusCode: 404,
      headers: { ...CACHE_HEADERS, 'Netlify-CDN-Cache-Control': 'public, s-maxage=60' },
      body: seo.renderNotFoundPage(shell),
    });

    if (!projectId || !seo.SLUG_PATTERN.test(slug) || slug.length > 80) return notFound();

    let project;
    try {
      [project] = await seo.fetchPublishedProjects({ projectId, slug, fetchImpl });
    } catch (err) {
      console.error('project-page: Firestore error', err.message);
      // Serve the plain app so the page still works; the app loads the project itself.
      return { statusCode: 200, headers: { 'Content-Type': 'text/html; charset=UTF-8', 'Cache-Control': 'no-store' }, body: shell };
    }
    if (!project || project.slug !== slug) return notFound();

    return { statusCode: 200, headers: CACHE_HEADERS, body: seo.renderProjectPage(shell, project, siteUrl) };
  };
}

exports.handler = createHandler();
exports.createHandler = createHandler;
