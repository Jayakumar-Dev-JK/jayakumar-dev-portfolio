/* Netlify Function: GET / - the home page with real text and crawlable links to every published project.
 *
 * public/index.html is an empty React shell, so a crawler that does not run JavaScript sees no links to
 * /projects/*. This adds a visually hidden <main> (h1, intro, project links) to that same shell; React
 * replaces it when the app mounts. If anything fails the plain shell is served, so the home page never breaks.
 * Environment: FIREBASE_PROJECT_ID (falls back to REACT_APP_FIREBASE_PROJECT_ID).
 */
const seo = require('../lib/seo');

const HEADERS = {
  'Content-Type': 'text/html; charset=UTF-8',
  'Cache-Control': 'public, max-age=0, must-revalidate',
  'Netlify-CDN-Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
};

function createHandler({ fetchImpl = fetch, env = process.env } = {}) {
  return async function handler(event) {
    const projectId = env.FIREBASE_PROJECT_ID || env.REACT_APP_FIREBASE_PROJECT_ID;
    const siteUrl = env.SITE_URL || seo.DEFAULT_SITE_URL;
    const host = event.headers?.['x-forwarded-host'] || event.headers?.host;
    const origin = host ? `https://${host}` : siteUrl;

    // Load the shell and the project list at the same time so the page is not slower than it has to be.
    const shellRequest = fetchImpl(`${origin}/index.html`).then((res) => {
      if (!res.ok) throw new Error(`index.html ${res.status}`);
      return res.text();
    });
    const projectsRequest = projectId ? seo.fetchPublishedProjects({ projectId, fetchImpl }) : Promise.resolve([]);
    projectsRequest.catch(() => {}); // handled below; avoids an unhandled rejection if the shell fails first

    let shell;
    try {
      shell = await shellRequest;
    } catch (err) {
      console.error('home-page: could not load the app shell', err.message);
      return { statusCode: 302, headers: { Location: '/index.html', 'Cache-Control': 'no-store' }, body: '' };
    }

    let projects;
    try {
      projects = await projectsRequest;
    } catch (err) {
      console.error('home-page: Firestore error', err.message);
      return { statusCode: 200, headers: { 'Content-Type': 'text/html; charset=UTF-8', 'Cache-Control': 'no-store' }, body: shell };
    }
    return { statusCode: 200, headers: HEADERS, body: seo.renderHomePage(shell, projects, siteUrl) };
  };
}

exports.handler = createHandler();
exports.createHandler = createHandler;
