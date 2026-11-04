/* Netlify Function: signed Cloudinary uploads for the portfolio admin.
 *
 * POST /.netlify/functions/cloudinary   Authorization: Bearer <Firebase ID token>
 *   { action: 'sign',   resourceType: 'image' | 'video' | 'raw' } -> upload signature ('raw' = resume PDFs)
 *   { action: 'sign',   resourceType: 'logo', variant: 'default' | 'hover' } -> tech-stack logo signature
 *   { action: 'upload-svg', resourceType: 'logo', variant, name, svg } -> raw SVG code, prepared and uploaded here
 *   { action: 'verify', resourceType, publicId }              -> checked asset metadata (bad uploads are deleted)
 *   { action: 'delete', resourceType, publicId }                -> removes an asset in the portfolio folder
 *
 * Folder structure (root = CLOUDINARY_FOLDER, default "PortFolio"):
 *   PortFolio/images   project covers, post images, media-library images
 *   PortFolio/videos   uploaded project videos
 *   PortFolio/resumes  resume PDFs
 *   PortFolio/tech-stack/default  skill logos as shown at rest
 *   PortFolio/tech-stack/hover    skill logos as shown on hover (original colours)
 *
 * Every request must carry a valid Firebase ID token for this project whose user has an
 * active admins/{uid} record. The record is read through the Firestore REST API with the
 * caller's own token, so Firestore Security Rules decide (no service account needed).
 *
 * Server-side environment (Netlify → Site configuration → Environment variables):
 *   CLOUDINARY_URL=cloudinary://<api_key>:<api_secret>@<cloud_name>
 *     (or CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET; these win if both are set)
 *   FIREBASE_PROJECT_ID (falls back to REACT_APP_FIREBASE_PROJECT_ID)
 *   CLOUDINARY_FOLDER (optional, default "PortFolio"; case-sensitive)
 * No dependencies: Node's crypto and fetch only.
 */
const crypto = require('crypto');

const JWKS_URL = 'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com';

const DEFAULT_FOLDER = 'PortFolio';

const LIMITS = {
  image: { maxBytes: 10 * 1024 * 1024, formats: ['jpg', 'jpeg', 'png', 'webp', 'avif', 'gif'], subfolder: 'images' },
  video: { maxBytes: 100 * 1024 * 1024, formats: ['mp4', 'webm', 'mov'], subfolder: 'videos' },
  // Resume PDFs, stored as Cloudinary "raw" files. Raw uploads have no format detection, so the
  // extension and the file's first bytes ("%PDF-") are checked after upload instead.
  raw: { maxBytes: 10 * 1024 * 1024, formats: ['pdf'], subfolder: 'resumes', signature: '%PDF-' },
  // Tech-stack skill logos: Cloudinary image assets, one subfolder per variant.
  logo: {
    maxBytes: 1024 * 1024,
    formats: ['svg', 'png', 'webp', 'jpg', 'jpeg', 'avif', 'gif'],
    subfolder: 'tech-stack',
    variants: ['default', 'hover'],
    cloudinaryType: 'image',
  },
};

// Cloud name, key and secret from the separate variables, falling back to CLOUDINARY_URL.
function cloudinaryCredentials(env) {
  const fromUrl = /^cloudinary:\/\/([^:]+):([^@]+)@([^/?#]+)$/.exec((env.CLOUDINARY_URL || '').trim()) || [];
  return {
    cloudName: env.CLOUDINARY_CLOUD_NAME || fromUrl[3],
    apiKey: env.CLOUDINARY_API_KEY || fromUrl[1],
    apiSecret: env.CLOUDINARY_API_SECRET || (fromUrl[2] && decodeURIComponent(fromUrl[2])),
  };
}

const slugName = (name) =>
  String(name || 'logo').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'logo';

// Turns pasted SVG code into a file Cloudinary accepts as an image. Cloudinary refuses an SVG
// ("Raw file format svg not allowed") unless it has the SVG namespace and an XML declaration.
// Also rejects anything that is not plain, script-free SVG.
function prepareSvg(input, maxBytes) {
  let svg = String(input || '').trim().replace(/^<\?xml[^>]*\?>\s*/i, '');
  if (!/^<svg[\s>]/i.test(svg) || !/<\/svg>\s*$/i.test(svg)) throw new HttpError(400, 'The SVG looks incomplete. Paste everything from <svg to </svg>.');
  if (/<script|<foreignObject|\son[a-z]+\s*=|javascript:/i.test(svg)) throw new HttpError(400, 'This SVG contains scripts or event handlers. Use a plain SVG.');
  if (Buffer.byteLength(svg) > maxBytes) throw new HttpError(413, `The SVG is too large (max ${maxBytes / 1024 / 1024} MB).`);
  const open = /^<svg\b[^>]*>/i.exec(svg)[0];
  let extra = '';
  if (!/\sxmlns\s*=/i.test(open)) extra += ' xmlns="http://www.w3.org/2000/svg"';
  if (/xlink:/i.test(svg) && !/\sxmlns:xlink\s*=/i.test(open)) extra += ' xmlns:xlink="http://www.w3.org/1999/xlink"';
  if (extra) svg = svg.replace(/^<svg\b/i, `<svg${extra}`);
  return `<?xml version="1.0" encoding="UTF-8"?>\n${svg}`;
}

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

const json = (statusCode, body) => ({
  statusCode,
  headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  body: JSON.stringify(body),
});

const base64UrlJson = (part) => JSON.parse(Buffer.from(part, 'base64url').toString('utf8'));

// Cloudinary signature: SHA-1 of the sorted "key=value" params joined with "&", followed by the API secret.
function cloudinarySignature(params, apiSecret) {
  const payload = Object.keys(params)
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join('&');
  return crypto.createHash('sha1').update(payload + apiSecret).digest('hex');
}

function createHandler({ fetch = globalThis.fetch, env = process.env, now = () => Date.now() } = {}) {
  let jwksCache = { keys: null, expires: 0 };

  async function getJwks() {
    if (jwksCache.keys && jwksCache.expires > now()) return jwksCache.keys;
    const res = await fetch(JWKS_URL);
    if (!res.ok) throw new HttpError(503, 'Could not reach the sign-in service.');
    const maxAge = Number(/max-age=(\d+)/.exec(res.headers?.get?.('cache-control') || '')?.[1] || 3600);
    jwksCache = { keys: (await res.json()).keys, expires: now() + maxAge * 1000 };
    return jwksCache.keys;
  }

  async function verifyIdToken(token, projectId) {
    const parts = (token || '').split('.');
    if (parts.length !== 3) throw new HttpError(401, 'Sign in again to continue.');
    let header;
    let payload;
    try {
      header = base64UrlJson(parts[0]);
      payload = base64UrlJson(parts[1]);
    } catch {
      throw new HttpError(401, 'Sign in again to continue.');
    }
    if (header.alg !== 'RS256') throw new HttpError(401, 'Sign in again to continue.');

    const jwk = (await getJwks()).find((key) => key.kid === header.kid);
    if (!jwk) throw new HttpError(401, 'Sign in again to continue.');
    const valid = crypto.verify(
      'RSA-SHA256',
      Buffer.from(`${parts[0]}.${parts[1]}`),
      crypto.createPublicKey({ key: jwk, format: 'jwk' }),
      Buffer.from(parts[2], 'base64url')
    );
    const seconds = now() / 1000;
    if (
      !valid ||
      payload.aud !== projectId ||
      payload.iss !== `https://securetoken.google.com/${projectId}` ||
      typeof payload.sub !== 'string' ||
      !payload.sub ||
      payload.exp <= seconds ||
      payload.iat > seconds + 300
    ) {
      throw new HttpError(401, 'Sign in again to continue.');
    }
    return payload.sub;
  }

  async function assertActiveAdmin(uid, token, projectId) {
    const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/admins/${encodeURIComponent(uid)}`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) throw new HttpError(403, 'This account does not have admin access.');
    const fields = (await res.json()).fields || {};
    if (fields.role?.stringValue !== 'admin' || fields.active?.booleanValue !== true) {
      throw new HttpError(403, 'This account does not have admin access.');
    }
  }

  return async function handler(event) {
    try {
      if (event.httpMethod !== 'POST') throw new HttpError(405, 'Method not allowed.');

      const projectId = env.FIREBASE_PROJECT_ID || env.REACT_APP_FIREBASE_PROJECT_ID;
      const { cloudName, apiKey, apiSecret } = cloudinaryCredentials(env);
      const folder = env.CLOUDINARY_FOLDER || DEFAULT_FOLDER;
      if (!projectId || !cloudName || !apiKey || !apiSecret) {
        throw new HttpError(500, 'Uploads are not configured on the server yet.');
      }

      const token = (event.headers?.authorization || event.headers?.Authorization || '').replace(/^Bearer\s+/i, '');
      const uid = await verifyIdToken(token, projectId);
      await assertActiveAdmin(uid, token, projectId);

      let body;
      try {
        body = JSON.parse(event.body || '{}');
      } catch {
        throw new HttpError(400, 'Invalid request.');
      }
      const limits = LIMITS[body.resourceType];
      if (!limits) throw new HttpError(400, 'Unsupported media type.');
      // Cloudinary's own resource type ("logo" files are images).
      const cloudType = limits.cloudinaryType || body.resourceType;

      // Is this asset inside the portfolio folder? Checks Cloudinary's own record, which works in
      // both folder modes: fixed folders (folder is part of the public ID) and dynamic folders
      // (the folder is kept separately as asset_folder).
      const inPortfolio = (asset) => {
        const assetFolder = asset.asset_folder ?? asset.folder ?? '';
        return (
          assetFolder === folder ||
          assetFolder.startsWith(`${folder}/`) ||
          String(asset.public_id || '').startsWith(`${folder}/`)
        );
      };

      if (body.action === 'sign') {
        let subfolder = limits.subfolder;
        if (limits.variants) {
          if (!limits.variants.includes(body.variant)) throw new HttpError(400, 'Unknown logo variant.');
          subfolder = `${subfolder}/${body.variant}`;
        }
        const params = {
          ...(body.resourceType === 'raw' ? {} : { allowed_formats: limits.formats.join(',') }),
          folder: `${folder}/${subfolder}`,
          timestamp: Math.floor(now() / 1000),
        };
        return json(200, {
          cloudName,
          apiKey,
          ...params,
          signature: cloudinarySignature(params, apiSecret),
        });
      }

      // Raw SVG code from the admin: made Cloudinary-ready here, then uploaded server-side.
      if (body.action === 'upload-svg') {
        if (body.resourceType !== 'logo') throw new HttpError(400, 'Unsupported media type.');
        if (!limits.variants.includes(body.variant)) throw new HttpError(400, 'Unknown logo variant.');
        const svg = prepareSvg(body.svg, limits.maxBytes);
        const params = {
          allowed_formats: limits.formats.join(','),
          folder: `${folder}/${limits.subfolder}/${body.variant}`,
          timestamp: Math.floor(now() / 1000),
        };
        const form = new FormData();
        form.append('file', new Blob([svg], { type: 'image/svg+xml' }), `${slugName(body.name)}.svg`);
        form.append('api_key', apiKey);
        Object.entries(params).forEach(([key, value]) => form.append(key, String(value)));
        form.append('signature', cloudinarySignature(params, apiSecret));
        const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, { method: 'POST', body: form });
        const uploaded = await res.json().catch(() => ({}));
        if (!res.ok) throw new HttpError(422, `Cloudinary rejected the SVG: ${uploaded.error?.message || res.status}`);
        return json(200, { publicId: uploaded.public_id, url: uploaded.secure_url, format: uploaded.format, bytes: uploaded.bytes });
      }

      const publicId = body.publicId;
      if (typeof publicId !== 'string' || !publicId || publicId.length > 255 || publicId.includes('..') || publicId.startsWith('/')) {
        throw new HttpError(400, 'Invalid asset.');
      }
      const basicAuth = `Basic ${Buffer.from(`${apiKey}:${apiSecret}`).toString('base64')}`;
      const destroy = async () => {
        const params = { public_id: publicId, timestamp: Math.floor(now() / 1000) };
        const form = new URLSearchParams({ ...params, api_key: apiKey, signature: cloudinarySignature(params, apiSecret) });
        const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/${cloudType}/destroy`, {
          method: 'POST',
          body: form,
        });
        const result = res.ok ? await res.json() : {};
        return result.result === 'ok' || result.result === 'not found';
      };

      // The asset's record from the Cloudinary Admin API, or null when it doesn't exist.
      const fetchAsset = async () => {
        const path = publicId.split('/').map(encodeURIComponent).join('/');
        const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/resources/${cloudType}/upload/${path}`, {
          headers: { Authorization: basicAuth },
        });
        if (res.status === 404) return null;
        if (!res.ok) throw new HttpError(502, 'Could not reach Cloudinary. Try again.');
        return res.json();
      };

      if (body.action === 'verify') {
        const asset = await fetchAsset();
        if (!asset) throw new HttpError(404, 'The uploaded file was not found.');
        if (!inPortfolio(asset)) throw new HttpError(403, `This file isn't in the ${folder} folder.`);
        // Raw files keep their extension in the public ID instead of having a detected format.
        const format = String(asset.format || asset.public_id.split('.').pop() || '').toLowerCase();
        let problem =
          asset.bytes > limits.maxBytes
            ? `File is too large (max ${limits.maxBytes / 1024 / 1024} MB).`
            : !limits.formats.includes(format)
              ? 'This file type is not allowed.'
              : null;
        if (!problem && limits.signature) {
          // Never trust the extension alone: read the first bytes of the delivered file.
          const head = await fetch(asset.secure_url, { headers: { Range: `bytes=0-${limits.signature.length - 1}` } });
          if (!head.ok) {
            problem =
              'Cloudinary would not deliver this file. In Cloudinary go to Settings → Security and allow delivery of PDF files, then upload again.';
          } else {
            const bytes = Buffer.from(await head.arrayBuffer()).subarray(0, limits.signature.length).toString('latin1');
            if (bytes !== limits.signature) problem = 'This file is not a valid PDF.';
          }
        }
        if (problem) {
          await destroy();
          throw new HttpError(422, problem);
        }
        return json(200, {
          publicId: asset.public_id,
          url: asset.secure_url,
          format,
          bytes: asset.bytes,
          width: asset.width ?? null,
          height: asset.height ?? null,
          duration: asset.duration ?? null,
        });
      }

      if (body.action === 'delete') {
        const asset = await fetchAsset();
        if (!asset) return json(200, { deleted: true }); // already gone
        if (!inPortfolio(asset)) throw new HttpError(403, `This file isn't in the ${folder} folder.`);
        if (!(await destroy())) throw new HttpError(502, 'Cloudinary could not delete the file. Try again.');
        return json(200, { deleted: true });
      }

      throw new HttpError(400, 'Unknown action.');
    } catch (err) {
      if (err instanceof HttpError) return json(err.status, { error: err.message });
      console.error('cloudinary function error', err);
      return json(500, { error: 'Something went wrong. Try again.' });
    }
  };
}

exports.handler = createHandler();
exports.createHandler = createHandler;
exports.cloudinarySignature = cloudinarySignature;
exports.cloudinaryCredentials = cloudinaryCredentials;
exports.LIMITS = LIMITS;
exports.prepareSvg = prepareSvg;
