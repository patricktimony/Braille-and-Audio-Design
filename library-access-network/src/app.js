'use strict';
// HTTP app: a tiny router, form-body parsing, sessions, CSRF checks, and static
// files. Uses only Node.js built-in modules.

const fs = require('node:fs');
const path = require('node:path');
const db = require('./db');
const auth = require('./auth');
const views = require('./views');
const { HttpError } = require('./errors');
const { html } = require('./html');

const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const MAX_BODY = 64 * 1024;

const routes = [];
function route(method, pattern, handler) {
  const keys = [];
  const regex = new RegExp('^' + pattern.replace(/:(\w+)/g, (_, k) => { keys.push(k); return '([^/]+)'; }) + '/?$');
  routes.push({ method, regex, keys, handler });
}

// Route modules register themselves with route().
require('./routes/core')(route);
require('./routes/learn')(route);
require('./routes/community')(route);
require('./routes/libraries')(route);


function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > MAX_BODY) { reject(new HttpError(413, 'That form was too large.')); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => {
      const params = new URLSearchParams(Buffer.concat(chunks).toString('utf8'));
      const body = {};
      for (const [k, v] of params) {
        if (k in body) body[k] = [].concat(body[k], v);
        else body[k] = v;
      }
      resolve(body);
    });
    req.on('error', reject);
  });
}

const SECURITY_HEADERS = {
  'Content-Security-Policy': "default-src 'self'; script-src 'none'; object-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'",
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'Cache-Control': 'no-store',
};

function serveStatic(req, res, pathname) {
  const file = path.normalize(path.join(PUBLIC_DIR, pathname));
  if (!file.startsWith(PUBLIC_DIR + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) return false;
  const types = { '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.txt': 'text/plain; charset=utf-8' };
  res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream', 'X-Content-Type-Options': 'nosniff' });
  fs.createReadStream(file).pipe(res);
  return true;
}

async function handle(req, res) {
  const url = new URL(req.url, 'http://localhost');
  let pathname;
  try { pathname = decodeURIComponent(url.pathname); } catch { pathname = '/__bad_path__'; }

  if (req.method === 'GET' && pathname !== '/' && serveStatic(req, res, pathname)) return;

  const session = auth.getSession(req, res);
  const user = session.userId ? db.get('users', session.userId) : null;
  for (const [k, v] of Object.entries(SECURITY_HEADERS)) res.setHeader(k, v);

  const ctx = {
    req, res, url, session, user, db, path: pathname, query: Object.fromEntries(url.searchParams),
    library: user ? db.get('libraries', user.libraryId) : null,
    render(title, body, opts = {}) {
      const flash = session.flash;
      session.flash = null;
      const page = views.layout({ title, body, user: ctx.user, session, path: pathname, status: opts.status || flash, library: ctx.library });
      res.writeHead(opts.code || 200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(page);
    },
    redirect(location, flash) {
      if (flash) session.flash = flash;
      res.writeHead(303, { Location: location });
      res.end();
    },
    requireUser() {
      if (!ctx.user) throw new HttpError(401, 'Please sign in to do that.');
      return ctx.user;
    },
    requireStaff() {
      const u = ctx.requireUser();
      if (u.role !== 'librarian' && u.role !== 'trainer') throw new HttpError(403, 'Only librarians and trainers can open this page.');
      return u;
    },
    notFound() { throw new HttpError(404, 'We could not find that page.'); },
  };

  try {
    const match = routes.find((r) => r.method === req.method && r.regex.test(pathname));
    if (!match) {
      if (routes.some((r) => r.regex.test(pathname))) throw new HttpError(405, 'That action is not available here.');
      ctx.notFound();
    }
    ctx.params = {};
    const m = pathname.match(match.regex);
    match.keys.forEach((k, i) => { ctx.params[k] = m[i + 1]; });

    if (req.method === 'POST') {
      ctx.body = await readBody(req);
      if (!auth.checkCsrf(session, ctx.body._csrf)) {
        throw new HttpError(403, 'This form expired. Go back, reload the page, and try again.');
      }
    }
    await match.handler(ctx);
  } catch (err) {
    const status = err.status || 500;
    if (status === 500) console.error(err);
    if (res.headersSent) { res.end(); return; }
    if (status === 401) {
      return ctx.redirect(`/signin?next=${encodeURIComponent(pathname + url.search)}`, err.message);
    }
    const titles = { 403: 'Not allowed', 404: 'Page not found', 405: 'Not available', 413: 'Too large', 500: 'Something went wrong' };
    ctx.render(titles[status] || 'Error', html`<h1>${titles[status] || 'Error'}</h1>
      <p>${status === 500 ? 'Sorry, something went wrong on our side. Please try again.' : err.message}</p>
      <p><a href="/">Go to the home page</a> or <a href="/help">get help</a>.</p>`, { code: status });
  }
}

function createServer() {
  db.load();
  return require('node:http').createServer((req, res) => { handle(req, res); });
}

module.exports = { createServer };
