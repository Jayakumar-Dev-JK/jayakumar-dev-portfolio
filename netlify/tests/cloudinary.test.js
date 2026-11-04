// Run with: npm run test:functions (kept outside netlify/functions so it is never deployed)
const test = require('node:test');
const assert = require('node:assert');
const crypto = require('crypto');
const { createHandler, cloudinarySignature } = require('../functions/cloudinary');

const PROJECT = 'portfolio-test';
const NOW = 1_800_000_000_000;
const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
const jwk = { ...publicKey.export({ format: 'jwk' }), kid: 'k1', alg: 'RS256' };

function makeToken(overrides = {}, key = privateKey) {
  const enc = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const header = enc({ alg: 'RS256', kid: 'k1' });
  const payload = enc({
    aud: PROJECT,
    iss: `https://securetoken.google.com/${PROJECT}`,
    sub: 'admin-uid',
    iat: NOW / 1000 - 10,
    exp: NOW / 1000 + 3600,
    ...overrides,
  });
  const signature = crypto.sign('RSA-SHA256', Buffer.from(`${header}.${payload}`), key).toString('base64url');
  return `${header}.${payload}.${signature}`;
}

const env = {
  FIREBASE_PROJECT_ID: PROJECT,
  CLOUDINARY_CLOUD_NAME: 'demo',
  CLOUDINARY_API_KEY: 'key123',
  CLOUDINARY_API_SECRET: 'secret456',
};

const response = (body, ok = true, status = 200) => ({ ok, status, json: async () => body, headers: { get: () => 'max-age=600' } });

function setup({ adminFields = { role: { stringValue: 'admin' }, active: { booleanValue: true } }, asset } = {}) {
  const calls = [];
  const fetch = async (url, options = {}) => {
    calls.push({ url, options });
    if (url.includes('securetoken')) return response({ keys: [jwk] });
    if (url.includes('firestore.googleapis.com')) return adminFields ? response({ fields: adminFields }) : response({}, false, 403);
    if (url.includes('/resources/')) return response(asset);
    if (url.endsWith('/destroy')) return response({ result: 'ok' });
    throw new Error(`unexpected fetch ${url}`);
  };
  return { handler: createHandler({ fetch, env, now: () => NOW }), calls };
}

const call = (handler, body, token = makeToken()) =>
  handler({ httpMethod: 'POST', headers: { authorization: `Bearer ${token}` }, body: JSON.stringify(body) }).then((r) => ({
    status: r.statusCode,
    body: JSON.parse(r.body),
  }));

test('rejects requests without a valid token', async () => {
  const { handler } = setup();
  assert.equal((await call(handler, { action: 'sign', resourceType: 'image' }, '')).status, 401);
  const otherKey = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 }).privateKey;
  assert.equal((await call(handler, { action: 'sign', resourceType: 'image' }, makeToken({}, otherKey))).status, 401);
  assert.equal((await call(handler, { action: 'sign', resourceType: 'image' }, makeToken({ aud: 'other-project' }))).status, 401);
  assert.equal((await call(handler, { action: 'sign', resourceType: 'image' }, makeToken({ exp: NOW / 1000 - 1 }))).status, 401);
});

test('rejects signed-in users without an active admin record', async () => {
  assert.equal((await call(setup({ adminFields: null }).handler, { action: 'sign', resourceType: 'image' })).status, 403);
  const inactive = { role: { stringValue: 'admin' }, active: { booleanValue: false } };
  assert.equal((await call(setup({ adminFields: inactive }).handler, { action: 'sign', resourceType: 'image' })).status, 403);
});

test('admin check uses the caller token against Firestore', async () => {
  const { handler, calls } = setup();
  const token = makeToken();
  await call(handler, { action: 'sign', resourceType: 'image' }, token);
  const firestoreCall = calls.find((c) => c.url.includes('firestore.googleapis.com'));
  assert.match(firestoreCall.url, /\/admins\/admin-uid$/);
  assert.equal(firestoreCall.options.headers.Authorization, `Bearer ${token}`);
});

test('signs uploads into PortFolio subfolders without exposing the secret', async () => {
  const { status, body } = await call(setup().handler, { action: 'sign', resourceType: 'image' });
  assert.equal(status, 200);
  assert.equal(body.folder, 'PortFolio/images');
  assert.equal(body.allowed_formats, 'jpg,jpeg,png,webp,avif,gif');
  assert.equal(
    body.signature,
    cloudinarySignature({ allowed_formats: body.allowed_formats, folder: 'PortFolio/images', timestamp: body.timestamp }, 'secret456')
  );
  assert.ok(!JSON.stringify(body).includes('secret456'));
  assert.equal((await call(setup().handler, { action: 'sign', resourceType: 'video' })).body.folder, 'PortFolio/videos');
});

test('verify deletes oversized uploads and returns metadata for valid ones', async () => {
  const big = setup({ asset: { public_id: 'PortFolio/images/a', bytes: 11 * 1024 * 1024, format: 'png' } });
  const rejected = await call(big.handler, { action: 'verify', resourceType: 'image', publicId: 'PortFolio/images/a' });
  assert.equal(rejected.status, 422);
  assert.ok(big.calls.some((c) => c.url.endsWith('/image/destroy')));

  const ok = setup({ asset: { public_id: 'PortFolio/images/b', secure_url: 'https://res.cloudinary.com/demo/image/upload/b.png', bytes: 1000, format: 'png', width: 10, height: 20 } });
  const accepted = await call(ok.handler, { action: 'verify', resourceType: 'image', publicId: 'PortFolio/images/b' });
  assert.equal(accepted.status, 200);
  assert.equal(accepted.body.url, 'https://res.cloudinary.com/demo/image/upload/b.png');
});

test('refuses malformed IDs and assets outside the PortFolio folder', async () => {
  const { handler, calls } = setup();
  for (const publicId of ['PortFolio/../secret', '', '/abs']) {
    assert.equal((await call(handler, { action: 'delete', resourceType: 'image', publicId })).status, 400);
  }
  const outside = setup({ asset: { public_id: 'other/x', asset_folder: 'other' } });
  assert.equal((await call(outside.handler, { action: 'delete', resourceType: 'image', publicId: 'other/x' })).status, 403);
  // Folder names are case-sensitive: "portfolio" is not "PortFolio".
  const lower = setup({ asset: { public_id: 'portfolio/x' } });
  assert.equal((await call(lower.handler, { action: 'delete', resourceType: 'image', publicId: 'portfolio/x' })).status, 403);
  assert.ok(![...calls, ...outside.calls, ...lower.calls].some((c) => c.url.endsWith('/destroy')));
});

test('works with dynamic folders, where the folder is not part of the public ID', async () => {
  const asset = { public_id: 'k3j9cover', asset_folder: 'PortFolio/images', secure_url: 'https://res.cloudinary.com/demo/image/upload/k3j9cover.png', bytes: 1000, format: 'png' };
  const verify = await call(setup({ asset }).handler, { action: 'verify', resourceType: 'image', publicId: 'k3j9cover' });
  assert.equal(verify.status, 200);
  const del = setup({ asset });
  assert.equal((await call(del.handler, { action: 'delete', resourceType: 'image', publicId: 'k3j9cover' })).status, 200);
  assert.ok(del.calls.some((c) => c.url.endsWith('/image/destroy')));
});

test('only POST is accepted', async () => {
  const res = await setup().handler({ httpMethod: 'GET', headers: {} });
  assert.equal(res.statusCode, 405);
});

test('resume PDFs are signed into the resumes folder without allowed_formats', async () => {
  const { status, body } = await call(setup().handler, { action: 'sign', resourceType: 'raw' });
  assert.equal(status, 200);
  assert.equal(body.folder, 'PortFolio/resumes');
  assert.equal(body.allowed_formats, undefined);
  assert.equal(body.signature, cloudinarySignature({ folder: 'PortFolio/resumes', timestamp: body.timestamp }, 'secret456'));
});

function setupPdf(fileStart, { deliverOk = true } = {}) {
  const calls = [];
  const fetch = async (url, options = {}) => {
    calls.push({ url, options });
    if (url.includes('securetoken')) return response({ keys: [jwk] });
    if (url.includes('firestore.googleapis.com')) return response({ fields: { role: { stringValue: 'admin' }, active: { booleanValue: true } } });
    if (url.includes('/resources/raw/')) {
      return response({ public_id: 'PortFolio/resumes/cv.pdf', secure_url: 'https://res.cloudinary.com/demo/raw/upload/v1/PortFolio/resumes/cv.pdf', bytes: 2048 });
    }
    if (url.startsWith('https://res.cloudinary.com/')) {
      return { ok: deliverOk, status: deliverOk ? 206 : 401, arrayBuffer: async () => Buffer.from(fileStart, 'latin1') };
    }
    if (url.endsWith('/destroy')) return response({ result: 'ok' });
    throw new Error(`unexpected fetch ${url}`);
  };
  return { handler: createHandler({ fetch, env, now: () => NOW }), calls };
}

test('verify accepts real PDFs and deletes anything else', async () => {
  const good = setupPdf('%PDF-1.7');
  const ok = await call(good.handler, { action: 'verify', resourceType: 'raw', publicId: 'PortFolio/resumes/cv.pdf' });
  assert.equal(ok.status, 200);
  assert.equal(ok.body.format, 'pdf');
  assert.ok(good.calls.some((c) => c.options.headers?.Range === 'bytes=0-4'));

  const fake = setupPdf('MZ\x90\x00\x03');
  const rejected = await call(fake.handler, { action: 'verify', resourceType: 'raw', publicId: 'PortFolio/resumes/cv.pdf' });
  assert.equal(rejected.status, 422);
  assert.match(rejected.body.error, /not a valid PDF/);
  assert.ok(fake.calls.some((c) => c.url.endsWith('/raw/destroy')));

  const blocked = setupPdf('%PDF-', { deliverOk: false });
  const blockedRes = await call(blocked.handler, { action: 'verify', resourceType: 'raw', publicId: 'PortFolio/resumes/cv.pdf' });
  assert.equal(blockedRes.status, 422);
  assert.match(blockedRes.body.error, /allow delivery of PDF/);
});

test('credentials can come from CLOUDINARY_URL', () => {
  const { cloudinaryCredentials } = require('../functions/cloudinary');
  assert.deepEqual(cloudinaryCredentials({ CLOUDINARY_URL: 'cloudinary://111:s3cr%40t@mycloud' }), {
    cloudName: 'mycloud',
    apiKey: '111',
    apiSecret: 's3cr@t',
  });
  // Separate variables win over the URL.
  assert.equal(cloudinaryCredentials({ CLOUDINARY_URL: 'cloudinary://111:x@a', CLOUDINARY_CLOUD_NAME: 'b' }).cloudName, 'b');
  assert.deepEqual(cloudinaryCredentials({ CLOUDINARY_URL: 'not-a-url' }), { cloudName: undefined, apiKey: undefined, apiSecret: undefined });
});

test('signs tech-stack logo uploads into a folder per variant', async () => {
  const { handler } = setup();
  const res = await call(handler, { action: 'sign', resourceType: 'logo', variant: 'hover' });
  assert.equal(res.status, 200);
  assert.equal(res.body.folder, 'PortFolio/tech-stack/hover');
  assert.ok(res.body.allowed_formats.split(',').includes('svg'));
  assert.equal((await call(handler, { action: 'sign', resourceType: 'logo', variant: 'default' })).body.folder, 'PortFolio/tech-stack/default');
  assert.equal((await call(handler, { action: 'sign', resourceType: 'logo', variant: 'other' })).status, 400);
  assert.equal((await call(handler, { action: 'sign', resourceType: 'logo' })).status, 400);
});

test('upload-svg prepares raw SVG code for Cloudinary and uploads it server-side', async () => {
  const uploads = [];
  const fetch = async (url, options = {}) => {
    if (url.endsWith('/image/upload')) {
      uploads.push(options.body);
      return response({ public_id: 'PortFolio/tech-stack/default/x1', secure_url: 'https://res.cloudinary.com/demo/image/upload/x1.svg', format: 'svg', bytes: 120 });
    }
    if (url.includes('securetoken')) return response({ keys: [jwk] });
    return response({ fields: { role: { stringValue: 'admin' }, active: { booleanValue: true } } });
  };
  const h = createHandler({ fetch, env, now: () => NOW });
  const res = await call(h, { action: 'upload-svg', resourceType: 'logo', variant: 'default', name: 'UX Pilot', svg: '<svg viewBox="0 0 1 1"><path d="M0 0"/></svg>' });
  assert.equal(res.status, 200);
  assert.equal(res.body.publicId, 'PortFolio/tech-stack/default/x1');
  const form = uploads[0];
  assert.equal(form.get('folder'), 'PortFolio/tech-stack/default');
  assert.equal(form.get('api_key'), 'key123');
  const file = form.get('file');
  assert.equal(file.name, 'ux-pilot.svg');
  const text = await file.text();
  assert.ok(text.startsWith('<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" viewBox'));
  assert.equal(form.get('signature'), cloudinarySignature({ allowed_formats: form.get('allowed_formats'), folder: form.get('folder'), timestamp: form.get('timestamp') }, 'secret456'));

  const bad = (svg, variant = 'default') => call(h, { action: 'upload-svg', resourceType: 'logo', variant, svg });
  assert.equal((await bad('<svg><script>x</script></svg>')).status, 400);
  assert.equal((await bad('<svg><path/>')).status, 400);
  assert.equal((await bad('<svg></svg>', 'other')).status, 400);
});

test('verifies and deletes logos as Cloudinary image assets', async () => {
  const asset = { public_id: 'PortFolio/tech-stack/hover/abc', asset_folder: 'PortFolio/tech-stack/hover', format: 'svg', bytes: 2048, secure_url: 'https://res.cloudinary.com/demo/image/upload/abc.svg' };
  const { handler, calls } = setup({ asset });
  const res = await call(handler, { action: 'verify', resourceType: 'logo', publicId: asset.public_id });
  assert.equal(res.status, 200);
  assert.equal(res.body.format, 'svg');
  assert.ok(calls.some((c) => c.url.includes('/resources/image/upload/PortFolio/tech-stack/hover/abc')));
  await call(handler, { action: 'delete', resourceType: 'logo', publicId: asset.public_id });
  assert.ok(calls.some((c) => c.url.endsWith('/image/destroy')));
});
