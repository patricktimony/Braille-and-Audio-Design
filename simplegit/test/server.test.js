// Server tests: project detection, secret detection, plain-English errors and
// security protections.
import { startAll } from './harness.js';
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { analyzeProject, secretFileFindings, secretContentFindings, publishWorkflow } from '../server/analyze.js';
import { toFriendly, GitHubError } from '../server/github.js';

// ---------- project detection ----------

const fakeGh = (files) => ({
  get: async (path) => {
    const sha = path.split('/').pop();
    return { content: Buffer.from(files[sha] ?? '').toString('base64') };
  },
});
const tree = (files) => Object.keys(files).map((p) => ({ path: p, type: 'blob', sha: p, size: String(files[p]).length }));
const analyze = (files) => analyzeProject(fakeGh(Object.fromEntries(Object.entries(files).map(([k, v]) => [k, v]))), 'o', 'r', tree(files));

test('plain website with index.html is published from the top folder', async () => {
  const a = await analyze({ 'index.html': '<h1>Hi</h1>', 'style.css': '' });
  assert.equal(a.canPublish, true);
  assert.deepEqual(a.plan, { method: 'branch', path: '/' });
});

test('website in a docs folder is published from docs', async () => {
  const a = await analyze({ 'README.md': '#', 'docs/index.html': '<h1>Hi</h1>' });
  assert.deepEqual(a.plan, { method: 'branch', path: '/docs' });
});

test('loose web pages without index.html are still publishable, each with its own link', async () => {
  const a = await analyze({ 'timer.html': '<h1>Timer</h1>', 'motionsound/index.html': '<h1>x</h1>', 'README.md': '#' });
  assert.equal(a.kind, 'static-pages');
  assert.deepEqual(a.htmlPages.sort(), ['motionsound/index.html', 'timer.html']);
});

test('Vite apps are built by GitHub before publishing', async () => {
  const a = await analyze({ 'index.html': '<div id=app>', 'package.json': JSON.stringify({ devDependencies: { vite: '5' } }) });
  assert.equal(a.kind, 'vite');
  assert.equal(a.plan.method, 'workflow');
  const yml = publishWorkflow({ branch: 'main', repo: 'my-app', owner: 'me', plan: a.plan });
  assert.match(yml, /--base=\/my-app\//);
  assert.match(yml, /actions\/deploy-pages@v4/);
});

test('apps that need a server are not offered GitHub Pages', async () => {
  const a = await analyze({ 'server.js': '', 'package.json': JSON.stringify({ scripts: { start: 'node server.js' }, dependencies: { express: '4' } }) });
  assert.equal(a.canPublish, false);
  assert.equal(a.hosting, true);
  assert.match(a.reason, /server/);
  const py = await analyze({ 'app.py': 'from flask import Flask', 'requirements.txt': 'flask' });
  assert.equal(py.canPublish, false);
  const next = await analyze({ 'package.json': JSON.stringify({ dependencies: { next: '14' } }) });
  assert.equal(next.kind, 'nextjs');
});

test('empty projects and projects without pages are explained', async () => {
  assert.equal((await analyze({})).kind, 'empty');
  assert.equal((await analyze({ 'data.csv': '1,2' })).canPublish, false);
});

// ---------- secret detection ----------

test('secret files are found, example files are not', () => {
  const t = ['.env', '.env.local', '.env.example', 'keys/server.pem', 'id_rsa', 'id_rsa.pub', 'credentials.json', 'src/app.js']
    .map((path) => ({ path, type: 'blob' }));
  const found = secretFileFindings(t).map((f) => f.path).sort();
  assert.deepEqual(found, ['.env', '.env.local', 'credentials.json', 'id_rsa', 'keys/server.pem']);
});

test('keys inside files are found', () => {
  assert.equal(secretContentFindings('a.js', 'const k = "sk-ant-api03-abcdefghijklmnopqrstuvwxyz";')[0].level, 'block');
  assert.equal(secretContentFindings('a.js', `token = "ghp_${'a'.repeat(36)}"`)[0].level, 'block');
  assert.equal(secretContentFindings('a.js', 'AKIAABCDEFGHIJKLMNOP')[0].level, 'block');
  assert.equal(secretContentFindings('a.js', 'const apiKey = "abcdefghijklmnop";')[0].level, 'check');
  assert.deepEqual(secretContentFindings('a.js', 'const greeting = "hello world";'), []);
});

// ---------- plain-English errors ----------

test('GitHub errors become plain English with a next step', () => {
  const headers = new Headers({ 'x-ratelimit-remaining': '0', 'x-ratelimit-reset': String(Math.floor(Date.now() / 1000) + 600) });
  const rate = toFriendly(new GitHubError(403, { message: 'API rate limit exceeded' }, headers));
  assert.equal(rate.status, 429);
  assert.match(rate.next, /in about 10 minutes/);
  for (const status of [401, 403, 404, 409, 422, 500]) {
    const f = toFriendly(new GitHubError(status, { message: 'x' }, new Headers()), 'save the file');
    assert.ok(f.title && f.message && f.next, `status ${status} needs a title, message and next step`);
    assert.doesNotMatch(`${f.title} ${f.message} ${f.next}`, /\b(repository|commit|branch|merge|fork|pull request|clone|push)\b/i);
  }
});

// ---------- security, through the real server ----------

let env;
let cookie = '';

async function call(path, opts = {}) {
  return fetch(`${env.appUrl}${path}`, { redirect: 'manual', ...opts, headers: { cookie, ...(opts.headers || {}) } });
}

before(async () => {
  env = await startAll();
  // Sign in by following the redirects by hand, keeping the cookie.
  let res = await call('/auth/login');
  cookie = res.headers.get('set-cookie').split(';')[0];
  res = await fetch(res.headers.get('location'), { redirect: 'manual' });
  res = await call(new URL(res.headers.get('location')).pathname + new URL(res.headers.get('location')).search);
  cookie = res.headers.get('set-cookie').split(';')[0];
  assert.equal(res.headers.get('location'), '/#/');
});

after(() => env?.stop());

test('the sign-in cookie cannot be read by page scripts, and tokens never reach the browser', async () => {
  let res = await call('/auth/login');
  const setCookie = res.headers.get('set-cookie');
  assert.match(setCookie, /HttpOnly/i);
  assert.match(setCookie, /SameSite=Lax/i);
  res = await call('/api/me');
  const text = await res.text();
  assert.doesNotMatch(text, new RegExp(env.mock.TOKEN));
  assert.doesNotMatch(text, /ghr_refresh/);
  assert.doesNotMatch(decodeURIComponent(cookie), new RegExp(env.mock.TOKEN));
});

test('changes are refused unless they come from SimpleGit\'s own page', async () => {
  const res = await call('/api/projects/tester/recipes/file', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ path: 'index.html' }) });
  assert.equal(res.status, 403);
  assert.ok(env.mock.readFile('tester', 'recipes', 'index.html'));
});

test('file names that try to escape the project are refused', async () => {
  const res = await call('/api/projects/tester/recipes/file', {
    method: 'PUT', headers: { 'Content-Type': 'application/json', 'X-SimpleGit': '1' }, body: JSON.stringify({ path: '../evil.txt', text: 'x' }),
  });
  assert.equal(res.status, 400);
  const body = await res.json();
  assert.ok(body.error.message && body.error.next);
});

test('only pictures are shown inside SimpleGit; other files are downloaded and sandboxed', async () => {
  let res = await call('/api/projects/tester/recipes/raw?path=index.html');
  assert.equal(res.headers.get('content-type'), 'application/octet-stream');
  assert.match(res.headers.get('content-disposition'), /^attachment/);
  assert.match(res.headers.get('content-security-policy'), /sandbox/);
  res = await call('/api/projects/tester/recipes/raw?path=images/cake.png');
  assert.equal(res.headers.get('content-type'), 'image/png');
});

test('not signed in: a clear message instead of a crash', async () => {
  const res = await fetch(`${env.appUrl}/api/projects`);
  assert.equal(res.status, 401);
  const body = await res.json();
  assert.equal(body.error.signedOut, true);
  assert.match(body.error.next, /Sign in with GitHub/);
});

test('setup cannot be repeated once SimpleGit is connected', async () => {
  const res = await call('/setup/manifest');
  assert.equal(res.status, 403);
});

test('publishing and making public both require explicit confirmation', async () => {
  const headers = { 'Content-Type': 'application/json', 'X-SimpleGit': '1' };
  let res = await call('/api/projects/tester/recipes/publish', { method: 'POST', headers, body: '{}' });
  assert.equal(res.status, 400);
  assert.equal(env.mock.repos.get('tester/recipes').pages, null);
  res = await call('/api/projects/tester/secret-app/make-public', { method: 'POST', headers, body: '{}' });
  assert.equal(res.status, 400);
  // Even with confirmation, a project containing keys stays private.
  res = await call('/api/projects/tester/secret-app/make-public', { method: 'POST', headers, body: JSON.stringify({ confirm: 'make-public', secretsChecked: true }) });
  assert.equal(res.status, 400);
  assert.equal((await res.json()).error.code, 'secrets');
  assert.equal(env.mock.repos.get('tester/secret-app').private, true);
});

test('a download that cannot work shows a readable page, not raw data', async () => {
  const res = await fetch(`${env.appUrl}/api/projects/tester/recipes/download`);
  assert.equal(res.status, 401);
  assert.match(res.headers.get('content-type'), /html/);
  const text = await res.text();
  assert.match(text, /You need to sign in/);
  assert.match(text, /Return to SimpleGit/);
});

test('security headers are set', async () => {
  const res = await call('/');
  const csp = res.headers.get('content-security-policy');
  assert.match(csp, /script-src 'self'/);
  assert.match(csp, /frame-ancestors 'none'/);
  assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
});
