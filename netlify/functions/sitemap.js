/* Netlify Function: GET /sitemap.xml, built live from the published projects.
 * New projects appear here as soon as they are published; unpublished ones disappear.
 * Environment: FIREBASE_PROJECT_ID (falls back to REACT_APP_FIREBASE_PROJECT_ID).
 */
const seo = require('../lib/seo');

function createHandler({ fetchImpl = fetch, env = process.env, now = () => new Date() } = {}) {
  return async function handler() {
    const projectId = env.FIREBASE_PROJECT_ID || env.REACT_APP_FIREBASE_PROJECT_ID;
    const siteUrl = env.SITE_URL || seo.DEFAULT_SITE_URL;
    let projects = [];
    try {
      if (projectId) projects = await seo.fetchPublishedProjects({ projectId, fetchImpl });
    } catch (err) {
      // Still return a valid sitemap (homepage only) rather than an error Google would retry.
      console.error('sitemap: Firestore error', err.message);
    }
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/xml; charset=UTF-8',
        'Cache-Control': 'public, max-age=0, must-revalidate',
        'Netlify-CDN-Cache-Control': 'public, s-maxage=600, stale-while-revalidate=3600',
      },
      body: seo.buildSitemap(projects, siteUrl, now()),
    };
  };
}

exports.handler = createHandler();
exports.createHandler = createHandler;
