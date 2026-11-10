// Run with: npm run test:functions
const test = require('node:test');
const assert = require('node:assert');
const seo = require('../lib/seo');
const { createHandler: createPageHandler } = require('../functions/project-page');
const { createHandler: createHomeHandler } = require('../functions/home-page');
const { createHandler: createSitemapHandler } = require('../functions/sitemap');

const SHELL = `<!doctype html><html lang="en"><head><meta charset="utf-8"/><title>Home</title>
<meta
  name="description"
  content="Home description"
/>
<link rel="canonical" href="https://jayakumarwebdev.netlify.app/" />
<meta property="og:title" content="Home" />
<meta property="og:description" content="Home description" />
<meta property="og:image" content="https://jayakumarwebdev.netlify.app/logo512.png" />
<meta property="og:url" content="https://jayakumarwebdev.netlify.app/" />
<meta name="twitter:title" content="Home" />
<meta name="twitter:description" content="Home description" />
<meta name="twitter:image" content="https://jayakumarwebdev.netlify.app/logo512.png" />
<meta name="robots" content="index, follow" />
</head><body><div id="root"></div></body></html>`;

const str = (stringValue) => ({ stringValue });
const doc = (fields, updateTime = '2026-11-01T10:00:00.000000Z') => ({
  name: 'projects/x/documents/projects/p1',
  fields,
  updateTime,
});
const WHY_WEDS = doc({
  slug: str('why-weds'),
  title: str('Why Weds: Wedding Events Arrangements'),
  type: str('Development'),
  shortDescription: str('A web application for planning and arranging wedding events.'),
  description: str('Couples manage vendors and guests in one place.\n\nBuilt for real event planners.'),
  techStack: { arrayValue: { values: [str('React'), str('Node')] } },
  coverMedia: {
    mapValue: { fields: { url: str('https://res.cloudinary.com/demo/image/upload/v1/a.png'), alt: str('Home screen') } },
  },
  projectUrl: str('https://example.com/why-weds'),
  links: {
    arrayValue: { values: [{ mapValue: { fields: { label: str('Behance'), url: str('https://behance.net/x') } } }] },
  },
  publishedAt: { timestampValue: '2026-10-01T00:00:00Z' },
});

test('parseProject keeps safe fields and drops unsafe urls', () => {
  const p = seo.parseProject(
    doc({
      slug: str('a'),
      title: str('A'),
      type: str('Design'),
      shortDescription: str('s'),
      projectUrl: str('javascript:alert(1)'),
      coverMedia: { mapValue: { fields: { url: str('http://insecure.test/a.png') } } },
    })
  );
  assert.strictEqual(p.projectUrl, '');
  assert.strictEqual(p.coverUrl, '');
  assert.deepStrictEqual(p.techStack, []);
  assert.strictEqual(p.type, 'Design');
});

test('seoTitle appends the site name only when it fits', () => {
  assert.strictEqual(seo.seoTitle('Laya'), 'Laya | Jayakumar');
  const long = 'Nalaiya Thiran Project: ICT Academy-IBM: Plasma Donor Application - Cloud web Application Development';
  const t = seo.seoTitle(long);
  assert.ok(t.length <= 70, t);
  assert.ok(t.endsWith('…'));
});

test('seoDescription pads a short description from the full text and clips at 158', () => {
  const p = seo.parseProject(WHY_WEDS);
  const d = seo.seoDescription(p);
  assert.ok(d.startsWith('A web application for planning'));
  assert.ok(d.includes('Couples manage vendors'));
  assert.ok(d.length <= 158);
  const empty = seo.seoDescription({ title: 'T', type: 'Design', shortDescription: '', description: '' });
  assert.match(empty, /design project/);
});

test('renderProjectPage replaces head tags, adds JSON-LD and pre-renders content', () => {
  const html = seo.renderProjectPage(SHELL, seo.parseProject(WHY_WEDS));
  assert.match(html, /<title>Why Weds: Wedding Events Arrangements \| Jayakumar<\/title>/);
  assert.ok(!html.includes('Home description'));
  assert.match(html, /rel="canonical" href="https:\/\/jayakumarwebdev\.netlify\.app\/projects\/why-weds"/);
  assert.match(
    html,
    /property="og:image" content="https:\/\/res\.cloudinary\.com\/demo\/image\/upload\/c_fill,g_north,w_1200,h_630,f_jpg,q_auto\/v1\/a\.png"/
  );
  assert.match(html, /<script type="application\/ld\+json">\{"@context":"https:\/\/schema\.org","@type":"CreativeWork"/);
  assert.match(html, /"@type":"BreadcrumbList"/);
  assert.match(html, /<div id="root"><main data-prerendered="project"><p><a href="\/">/);
  assert.match(html, /<h1>Why Weds: Wedding Events Arrangements<\/h1>/);
  assert.match(html, /<li>React<\/li>/);
  assert.match(html, /<a href="https:\/\/example\.com\/why-weds" rel="noopener noreferrer">View project<\/a>/);
  assert.strictEqual((html.match(/<title>/g) || []).length, 1);
});

test('renderProjectPage escapes project text so it cannot inject markup', () => {
  const evil = seo.parseProject(
    doc({
      slug: str('x'),
      title: str('</title><script>alert(1)</script>'),
      type: str('Design'),
      shortDescription: str('"><img src=x onerror=alert(1)>'),
    })
  );
  const html = seo.renderProjectPage(SHELL, evil);
  assert.ok(!html.includes('<script>alert(1)'));
  assert.ok(!html.includes('<img src=x'));
});

test('renderProjectPage works when the shell has minified tags in a different order', () => {
  const minified =
    '<html><head><title>Home</title><meta content="Home description" name="description"><link href="/" rel="canonical"></head><body><div id="root"></div></body></html>';
  const html = seo.renderProjectPage(minified, seo.parseProject(WHY_WEDS));
  assert.ok(!html.includes('Home description'));
  assert.match(html, /rel="canonical" href="https:\/\/jayakumarwebdev\.netlify\.app\/projects\/why-weds"/);
});

test('renderNotFoundPage sets noindex and drops the canonical', () => {
  const html = seo.renderNotFoundPage(SHELL);
  assert.match(html, /<title>Page not found \| Jayakumar<\/title>/);
  assert.match(html, /name="robots" content="noindex, nofollow"/);
  assert.ok(!html.includes('rel="canonical"'));
});

test('buildSitemap lists the homepage and every valid project slug', () => {
  const xml = seo.buildSitemap(
    [
      { slug: 'why-weds', updatedAt: '2026-11-01T10:00:00Z' },
      { slug: 'Bad Slug!', updatedAt: '2026-11-02T10:00:00Z' },
    ],
    'https://example.com',
    new Date('2026-11-05T00:00:00Z')
  );
  assert.match(xml, /<loc>https:\/\/example\.com\/<\/loc>\s*<lastmod>2026-11-01<\/lastmod>/);
  assert.match(xml, /<loc>https:\/\/example\.com\/projects\/why-weds<\/loc>/);
  assert.ok(!xml.includes('Bad Slug'));
  assert.match(seo.buildSitemap([], 'https://example.com', new Date('2026-11-05T00:00:00Z')), /<lastmod>2026-11-05<\/lastmod>/);
});

function fakeFetch({ rows = [{ document: WHY_WEDS }], shellOk = true, firestoreStatus = 200 } = {}) {
  const calls = [];
  const impl = async (url, init) => {
    calls.push({ url, init });
    if (String(url).endsWith('/index.html')) return { ok: shellOk, status: shellOk ? 200 : 500, text: async () => SHELL };
    return { ok: firestoreStatus === 200, status: firestoreStatus, json: async () => rows };
  };
  impl.calls = calls;
  return impl;
}
const ENV = { FIREBASE_PROJECT_ID: 'portfolio-test' };
const event = (slug) => ({ queryStringParameters: { slug }, headers: { host: 'jayakumarwebdev.netlify.app' } });

test('project-page returns the rendered page for a published slug', async () => {
  const fetchImpl = fakeFetch();
  const res = await createPageHandler({ fetchImpl, env: ENV })(event('why-weds'));
  assert.strictEqual(res.statusCode, 200);
  assert.match(res.body, /<h1>Why Weds/);
  const body = JSON.parse(fetchImpl.calls[1].init.body);
  const filters = body.structuredQuery.where.compositeFilter.filters.map((f) => [
    f.fieldFilter.field.fieldPath,
    f.fieldFilter.value.stringValue,
  ]);
  assert.deepStrictEqual(filters, [
    ['status', 'published'],
    ['slug', 'why-weds'],
  ]);
});

test('project-page returns a real 404 for unknown or invalid slugs', async () => {
  const missing = await createPageHandler({ fetchImpl: fakeFetch({ rows: [{}] }), env: ENV })(event('nope'));
  assert.strictEqual(missing.statusCode, 404);
  assert.match(missing.body, /noindex/);
  const invalid = await createPageHandler({ fetchImpl: fakeFetch(), env: ENV })(event('../etc/passwd'));
  assert.strictEqual(invalid.statusCode, 404);
});

test('project-page falls back to the plain app when Firestore fails, and redirects if the shell is unavailable', async () => {
  const fallback = await createPageHandler({ fetchImpl: fakeFetch({ firestoreStatus: 503 }), env: ENV })(
    event('why-weds')
  );
  assert.strictEqual(fallback.statusCode, 200);
  assert.ok(fallback.body.includes('Home description'));
  const redirect = await createPageHandler({ fetchImpl: fakeFetch({ shellOk: false }), env: ENV })(
    event('why-weds')
  );
  assert.strictEqual(redirect.statusCode, 302);
});

test('sitemap handler returns XML with published projects, and a homepage-only sitemap on errors', async () => {
  const ok = await createSitemapHandler({ fetchImpl: fakeFetch(), env: ENV })();
  assert.strictEqual(ok.statusCode, 200);
  assert.match(ok.headers['Content-Type'], /application\/xml/);
  assert.match(ok.body, /\/projects\/why-weds/);
  const failed = await createSitemapHandler({ fetchImpl: fakeFetch({ firestoreStatus: 500 }), env: ENV })();
  assert.strictEqual(failed.statusCode, 200);
  assert.ok(!failed.body.includes('/projects/'));
});

test('project-page redirects a renamed project from its old address with a 301', async () => {
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url, init });
    if (String(url).endsWith('/index.html')) return { ok: true, status: 200, text: async () => SHELL };
    const body = JSON.parse(init.body);
    const filters = body.structuredQuery.where.compositeFilter.filters;
    const bySlug = filters.some((f) => f.fieldFilter.field.fieldPath === 'slug');
    // The current-slug lookup finds nothing; the old-slug lookup finds the renamed project.
    return { ok: true, status: 200, json: async () => (bySlug ? [{}] : [{ document: WHY_WEDS }]) };
  };
  const res = await createPageHandler({ fetchImpl, env: ENV })(event('old-why-weds'));
  assert.strictEqual(res.statusCode, 301);
  assert.strictEqual(res.headers.Location, '/projects/why-weds');
  const lookup = JSON.parse(calls[calls.length - 1].init.body).structuredQuery.where.compositeFilter.filters;
  assert.deepStrictEqual(
    lookup.map((f) => [f.fieldFilter.field.fieldPath, f.fieldFilter.op, f.fieldFilter.value.stringValue]),
    [
      ['status', 'EQUAL', 'published'],
      ['previousSlugs', 'ARRAY_CONTAINS', 'old-why-weds'],
    ]
  );
});

test('an address that nobody used is still a 404, not a redirect', async () => {
  const fetchImpl = async (url) =>
    String(url).endsWith('/index.html')
      ? { ok: true, status: 200, text: async () => SHELL }
      : { ok: true, status: 200, json: async () => [{}] };
  const res = await createPageHandler({ fetchImpl, env: ENV })(event('never-existed'));
  assert.strictEqual(res.statusCode, 404);
});

const { slugFromEvent } = require('../functions/project-page');

test('the project name is read from the requested address, not from a query string Netlify may not fill', async () => {
  // What Netlify really sent for /projects/why-weds: the address is right, the placeholder was left unfilled.
  const real = { path: '/projects/why-weds', queryStringParameters: { slug: ':slug' }, headers: { host: 'jayakumarwebdev.netlify.app' } };
  assert.strictEqual(slugFromEvent(real), 'why-weds');
  const res = await createPageHandler({ fetchImpl: fakeFetch(), env: ENV })(real);
  assert.strictEqual(res.statusCode, 200);
  assert.match(res.body, /<h1>Why Weds/);
});

test('every way the address can arrive gives the same slug', () => {
  assert.strictEqual(slugFromEvent({ path: '/projects/why-weds' }), 'why-weds');
  assert.strictEqual(slugFromEvent({ path: '/projects/why-weds/' }), 'why-weds');
  assert.strictEqual(slugFromEvent({ path: '/projects/Why-Weds' }), 'why-weds');
  assert.strictEqual(slugFromEvent({ rawUrl: 'https://jayakumarwebdev.netlify.app/projects/why-weds?utm=x' }), 'why-weds');
  assert.strictEqual(slugFromEvent({ path: '/.netlify/functions/project-page', queryStringParameters: { slug: 'laya' } }), 'laya');
  assert.strictEqual(slugFromEvent({ path: '/projects/caf%C3%A9' }), 'café');
  assert.strictEqual(slugFromEvent({}), '');
});

test('a malformed address is a 404, never an error', async () => {
  for (const path of ['/projects/%E0%A4%A', '/projects/..%2F..%2Fetc', '/projects/']) {
    const res = await createPageHandler({ fetchImpl: fakeFetch(), env: ENV })({ path, headers: { host: 'x.netlify.app' } });
    assert.strictEqual(res.statusCode, 404, path);
  }
});

test('renderHomePage adds an h1, intro and crawlable project links, and escapes text', () => {
  const projects = [
    seo.parseProject(WHY_WEDS),
    seo.parseProject(doc({ slug: str('bad slug!'), title: str('Skipped') })),
    seo.parseProject(doc({ slug: str('x-y'), title: str('<b>X</b>'), shortDescription: str('a & b') })),
  ];
  const html = seo.renderHomePage(SHELL, projects, 'https://jayakumarwebdev.netlify.app');
  assert.match(html, /<h1>Jayakumar - UI\/UX Designer &amp; Frontend Developer<\/h1>/);
  assert.match(html, /href="https:\/\/jayakumarwebdev\.netlify\.app\/projects\/why-weds"/);
  assert.match(html, /href="https:\/\/jayakumarwebdev\.netlify\.app\/projects\/x-y">&lt;b&gt;X&lt;\/b&gt;<\/a> - a &amp; b/);
  assert.doesNotMatch(html, /Skipped/);
  assert.match(html, /<title>Home<\/title>/);
});

test('home-page serves the enriched shell, and the plain shell when Firestore fails', async () => {
  const shellRes = { ok: true, text: async () => SHELL };
  const good = createHomeHandler({
    env: { FIREBASE_PROJECT_ID: 'p' },
    fetchImpl: async (url) => (String(url).endsWith('/index.html') ? shellRes : { ok: true, json: async () => [{ document: WHY_WEDS }] }),
  });
  const ok = await good({ headers: { host: 'jayakumarwebdev.netlify.app' } });
  assert.strictEqual(ok.statusCode, 200);
  assert.match(ok.body, /data-prerendered="home"/);
  assert.match(ok.body, /\/projects\/why-weds/);

  const bad = createHomeHandler({
    env: { FIREBASE_PROJECT_ID: 'p' },
    fetchImpl: async (url) => (String(url).endsWith('/index.html') ? shellRes : { ok: false, status: 500 }),
  });
  const plain = await bad({ headers: { host: 'jayakumarwebdev.netlify.app' } });
  assert.strictEqual(plain.statusCode, 200);
  assert.strictEqual(plain.body, SHELL);

  const noShell = createHomeHandler({ env: {}, fetchImpl: async () => ({ ok: false, status: 500 }) });
  assert.strictEqual((await noShell({ headers: {} })).statusCode, 302);
});
