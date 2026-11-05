/* `npm start`
 *
 *  - On your computer: runs the React development server (hot reload), exactly as before.
 *  - On a host such as Render (NODE_ENV=production, or RENDER=true): serves the production build
 *    from ./build as static files. The development server must never run there: it compiles the
 *    whole app in memory and crashes small instances with "JavaScript heap out of memory".
 *
 * The production server has no dependencies. It serves index.html for any path that isn't a file
 * (the app is a single-page app), caches the hashed /static files for a year, and never serves
 * anything outside ./build. Netlify does not use this script: it serves ./build itself.
 */
const fs = require('fs');
const http = require('http');
const path = require('path');
const zlib = require('zlib');
const { spawn, spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const BUILD = path.join(ROOT, 'build');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.mp4': 'video/mp4',
};
const COMPRESSIBLE = new Set(['.html', '.js', '.css', '.json', '.txt', '.xml', '.svg', '.map']);

const isProduction = process.env.NODE_ENV === 'production' || Boolean(process.env.RENDER);

function reactScripts(command) {
  return [process.execPath, [require.resolve('react-scripts/bin/react-scripts.js'), command]];
}

// Maps a request path to a file inside ./build, or null when it would leave that folder.
function resolveFile(urlPath) {
  let decoded;
  try {
    decoded = decodeURIComponent(urlPath.split('?')[0].split('#')[0]);
  } catch {
    return null;
  }
  if (decoded.includes('\0')) return null;
  const file = path.normalize(path.join(BUILD, decoded));
  return file === BUILD || file.startsWith(BUILD + path.sep) ? file : null;
}

function createServer() {
  return http.createServer((req, res) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.writeHead(405, { Allow: 'GET, HEAD' });
      res.end();
      return;
    }
    let file = resolveFile(req.url || '/');
    if (!file) {
      res.writeHead(400);
      res.end('Bad request');
      return;
    }
    let stat = fs.existsSync(file) ? fs.statSync(file) : null;
    if (stat?.isDirectory()) {
      file = path.join(file, 'index.html');
      stat = fs.existsSync(file) ? fs.statSync(file) : null;
    }
    const asset = Boolean(stat?.isFile());
    // Missing files that look like assets are real 404s; any other path is an app route.
    const ext = path.extname(file).toLowerCase();
    if (!asset && ext && ext !== '.html') {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Not found');
      return;
    }
    const target = asset ? file : path.join(BUILD, 'index.html');
    const type = MIME[path.extname(target).toLowerCase()] || 'application/octet-stream';
    const hashed = /[\\/]static[\\/]/.test(target);
    const headers = {
      'Content-Type': type,
      'Cache-Control': hashed ? 'public, max-age=31536000, immutable' : 'no-cache',
      'X-Content-Type-Options': 'nosniff',
      Vary: 'Accept-Encoding',
    };
    const gzip = COMPRESSIBLE.has(path.extname(target).toLowerCase()) && /\bgzip\b/.test(req.headers['accept-encoding'] || '');
    if (gzip) headers['Content-Encoding'] = 'gzip';
    res.writeHead(200, headers);
    if (req.method === 'HEAD') {
      res.end();
      return;
    }
    const stream = fs.createReadStream(target);
    stream.on('error', () => res.destroy());
    (gzip ? stream.pipe(zlib.createGzip()) : stream).pipe(res);
  });
}

function startProduction() {
  if (!fs.existsSync(path.join(BUILD, 'index.html'))) {
    console.log('No production build found: building the site first...');
    const [cmd, args] = reactScripts('build');
    const result = spawnSync(cmd, args, { stdio: 'inherit', cwd: ROOT, env: { ...process.env, NODE_ENV: 'production' } });
    if (result.status !== 0) process.exit(result.status || 1);
  }
  const port = Number(process.env.PORT) || 3000;
  createServer().listen(port, '0.0.0.0', () => console.log(`Serving the production build on port ${port}`));
}

function startDevelopment() {
  const [cmd, args] = reactScripts('start');
  const child = spawn(cmd, args, { stdio: 'inherit', cwd: ROOT });
  child.on('exit', (code) => process.exit(code ?? 0));
  ['SIGINT', 'SIGTERM'].forEach((signal) => process.on(signal, () => child.kill(signal)));
}

if (require.main === module) {
  if (isProduction) startProduction();
  else startDevelopment();
}

module.exports = { createServer, resolveFile, BUILD };
