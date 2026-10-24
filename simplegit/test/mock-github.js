// A small fake of GitHub's API, used only by the automated tests. It keeps
// projects in memory with real version history (blobs, trees, commits).
import express from 'express';
import crypto from 'node:crypto';

const TOKEN = 'gho_testtoken';
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');

export function createMockGitHub() {
  const app = express();
  app.use(express.json({ limit: '60mb' }));
  let base = '';
  const blobs = new Map();
  const trees = new Map();
  const commits = new Map();
  const repos = new Map();
  const users = {
    tester: { login: 'tester', name: 'Test Person', type: 'User' },
    helperperson: { login: 'helperperson', name: 'Helpful Friend', type: 'User' },
    otherperson: { login: 'otherperson', name: 'Other Person', type: 'User' },
    someorg: { login: 'someorg', name: 'Some Org', type: 'Organization' },
  };
  const userJson = (u) => ({ ...u, avatar_url: 'data:image/gif;base64,R0lGODlhAQABAAAAACw=' });
  const sha1 = (s) => crypto.createHash('sha1').update(s).digest('hex');

  function putBlob(buf) {
    const sha = sha1(Buffer.concat([Buffer.from(`blob ${buf.length}\0`), buf]));
    blobs.set(sha, buf);
    return sha;
  }
  function putTree(map) {
    const sha = sha1(JSON.stringify([...map.entries()].sort()) + Math.random());
    trees.set(sha, new Map(map));
    return sha;
  }
  function makeCommit(r, map, message) {
    const sha = sha1(`commit${Math.random()}`);
    commits.set(sha, { sha, message, tree: putTree(map), parents: r.head ? [r.head] : [] });
    r.head = sha;
    r.pushedAt = new Date().toISOString();
    afterPush(r);
    return sha;
  }
  const headMap = (r) => (r.head ? new Map(trees.get(commits.get(r.head).tree)) : new Map());

  function addRepo({ owner, name, description = '', isPrivate = false, files = {}, perms = { admin: true, push: true, pull: true }, homepage = '' }) {
    const r = { owner, name, description, private: isPrivate, perms, homepage, head: null, pages: null, collaborators: new Set(), invitations: [], runs: [], pushedAt: new Date().toISOString() };
    repos.set(`${owner}/${name}`.toLowerCase(), r);
    if (Object.keys(files).length) {
      const map = new Map();
      for (const [p, c] of Object.entries(files)) map.set(p, { sha: putBlob(Buffer.isBuffer(c) ? c : Buffer.from(c)), mode: '100644' });
      makeCommit(r, map, 'Initial files');
    }
    return r;
  }

  function repoJson(r) {
    return {
      name: r.name, full_name: `${r.owner}/${r.name}`, owner: { login: r.owner }, description: r.description,
      private: r.private, default_branch: 'main', permissions: r.perms, homepage: r.homepage, has_pages: Boolean(r.pages),
      html_url: `${base}/web/${r.owner}/${r.name}`, size: r.head ? 10 : 0, pushed_at: r.pushedAt, archived: false,
    };
  }

  // After every save: simulate GitHub Pages rebuilding.
  function afterPush(r) {
    if (!r.pages) return;
    if (r.pages.build_type === 'workflow') {
      if (!headMap(r).has('.github/workflows/simplegit-publish.yml')) return;
      const run = { id: r.runs.length + 1, status: 'in_progress', conclusion: null };
      r.runs.unshift(run);
      setTimeout(() => { run.status = 'completed'; run.conclusion = r.failBuild ? 'failure' : 'success'; if (!r.failBuild) r.pages.status = 'built'; }, 1200);
    } else {
      r.pages.status = 'building';
      setTimeout(() => { r.pages.status = 'built'; }, 1200);
    }
  }

  // ----- OAuth -----
  app.get('/login/oauth/authorize', (req, res) => {
    const url = new URL(req.query.redirect_uri);
    url.searchParams.set('code', 'test-code');
    url.searchParams.set('state', req.query.state);
    res.redirect(url.toString());
  });
  app.post('/login/oauth/access_token', (req, res) => {
    if (req.body.code !== 'test-code' && req.body.grant_type !== 'refresh_token') return res.json({ error: 'bad_verification_code' });
    res.json({ access_token: TOKEN, refresh_token: 'ghr_refresh', expires_in: 28800, token_type: 'bearer' });
  });

  // Fake published websites.
  app.get(['/site/:owner/:repo', '/site/:owner/:repo/*'], (req, res) => {
    const r = repos.get(`${req.params.owner}/${req.params.repo}`.toLowerCase());
    if (r?.pages?.status === 'built') return res.send('<!doctype html><title>Site</title><h1>It works</h1>');
    res.status(404).send('Not found');
  });

  // ----- Authenticated API -----
  const api = express.Router();
  api.use((req, res, next) => {
    if (req.get('Authorization') !== `Bearer ${TOKEN}`) return res.status(401).json({ message: 'Bad credentials' });
    next();
  });
  const me = 'tester';

  api.get('/user', (req, res) => res.json(userJson(users[me])));
  api.get('/user/installations', (req, res) => res.json({ total_count: 1, installations: [{ id: 1 }] }));
  api.get('/user/repos', (req, res) => {
    const page = Number(req.query.page || 1);
    res.json(page > 1 ? [] : [...repos.values()].map(repoJson));
  });
  api.post('/user/repos', (req, res) => {
    const key = `${me}/${req.body.name}`.toLowerCase();
    if (repos.has(key)) return res.status(422).json({ message: 'Repository creation failed.', errors: [{ message: 'name already exists on this account' }] });
    const r = addRepo({ owner: me, name: req.body.name, description: req.body.description, isPrivate: req.body.private, files: req.body.auto_init ? { 'README.md': `# ${req.body.name}\n\n${req.body.description || ''}\n` } : {} });
    res.status(201).json(repoJson(r));
  });
  api.get('/users/:u', (req, res) => {
    const u = users[req.params.u.toLowerCase()];
    if (!u) return res.status(404).json({ message: 'Not Found' });
    res.json(userJson(u));
  });

  // Find the repo for /repos/:owner/:repo routes.
  api.use('/repos/:owner/:repo', (req, res, next) => {
    req.r = repos.get(`${req.params.owner}/${req.params.repo}`.toLowerCase());
    if (!req.r) return res.status(404).json({ message: 'Not Found' });
    next();
  });
  const R = '/repos/:owner/:repo';
  const needPush = (req, res) => { if (!req.r.perms.push) { res.status(403).json({ message: 'Resource not accessible by integration' }); return false; } return true; };
  const needAdmin = (req, res) => { if (!req.r.perms.admin) { res.status(403).json({ message: 'Must have admin rights' }); return false; } return true; };

  api.get(R, (req, res) => res.json(repoJson(req.r)));
  api.patch(R, (req, res) => {
    if (!needAdmin(req, res)) return;
    if ('private' in req.body) req.r.private = req.body.private;
    if ('homepage' in req.body) req.r.homepage = req.body.homepage;
    res.json(repoJson(req.r));
  });

  // Contents
  api.get([`${R}/contents`, `${R}/contents/*`], (req, res) => {
    const r = req.r;
    const path = (req.params[0] || '').replace(/\/$/, '');
    if (!r.head) return res.status(404).json({ message: 'This repository is empty.' });
    const map = headMap(r);
    const entry = map.get(path);
    if (entry) {
      const buf = blobs.get(entry.sha);
      if (req.get('Accept') === 'application/vnd.github.raw') return res.type('application/octet-stream').send(buf);
      return res.json({ type: 'file', name: path.split('/').pop(), path, sha: entry.sha, size: buf.length, encoding: 'base64', content: buf.toString('base64'), html_url: `${base}/web/${r.owner}/${r.name}/blob/main/${path}` });
    }
    const prefix = path ? `${path}/` : '';
    const children = new Map();
    for (const [p, e] of map) {
      if (!p.startsWith(prefix)) continue;
      const rest = p.slice(prefix.length);
      const first = rest.split('/')[0];
      if (rest.includes('/')) children.set(first, { type: 'dir', name: first, path: prefix + first, sha: sha1(prefix + first), size: 0 });
      else children.set(first, { type: 'file', name: first, path: p, sha: e.sha, size: blobs.get(e.sha).length });
    }
    if (!children.size) return res.status(404).json({ message: 'Not Found' });
    res.json([...children.values()]);
  });
  api.put(`${R}/contents/*`, (req, res) => {
    if (!needPush(req, res)) return;
    const r = req.r;
    const path = req.params[0];
    const map = headMap(r);
    const existing = map.get(path);
    if (existing && !req.body.sha) return res.status(422).json({ message: '"sha" wasn\'t supplied.' });
    if (existing && req.body.sha !== existing.sha) return res.status(409).json({ message: `${path} does not match ${req.body.sha}` });
    if (path.startsWith('.github/workflows/') && r.noWorkflowPermission) return res.status(403).json({ message: 'refusing to allow a GitHub App to create or update workflow without `workflows` permission' });
    const buf = Buffer.from(req.body.content || '', 'base64');
    const sha = putBlob(buf);
    map.set(path, { sha, mode: existing?.mode || '100644' });
    const commit = makeCommit(r, map, req.body.message);
    res.status(existing ? 200 : 201).json({ content: { sha, path }, commit: { sha: commit } });
  });
  api.delete(`${R}/contents/*`, (req, res) => {
    if (!needPush(req, res)) return;
    const r = req.r;
    const path = req.params[0];
    const map = headMap(r);
    const existing = map.get(path);
    if (!existing) return res.status(404).json({ message: 'Not Found' });
    if (req.body.sha !== existing.sha) return res.status(409).json({ message: 'sha does not match' });
    map.delete(path);
    res.json({ commit: { sha: makeCommit(r, map, req.body.message) } });
  });

  // Git data
  api.get(`${R}/git/ref/heads/*`, (req, res) => {
    if (!req.r.head) return res.status(409).json({ message: 'Git Repository is empty.' });
    res.json({ ref: `refs/heads/${req.params[0]}`, object: { sha: req.r.head, type: 'commit' } });
  });
  api.patch(`${R}/git/refs/heads/*`, (req, res) => {
    const c = commits.get(req.body.sha);
    if (!c) return res.status(422).json({ message: 'Object does not exist' });
    if (!req.body.force && !c.parents.includes(req.r.head)) return res.status(422).json({ message: 'Update is not a fast forward' });
    req.r.head = c.sha;
    afterPush(req.r);
    res.json({ object: { sha: c.sha } });
  });
  api.get(`${R}/git/commits/:sha`, (req, res) => {
    const c = commits.get(req.params.sha);
    if (!c) return res.status(404).json({ message: 'Not Found' });
    res.json({ sha: c.sha, message: c.message, tree: { sha: c.tree }, parents: c.parents.map((sha) => ({ sha })) });
  });
  api.post(`${R}/git/trees`, (req, res) => {
    const map = new Map(trees.get(req.body.base_tree) || []);
    for (const e of req.body.tree) {
      if (e.sha === null) map.delete(e.path);
      else map.set(e.path, { sha: e.sha, mode: e.mode });
    }
    res.status(201).json({ sha: putTree(map) });
  });
  api.post(`${R}/git/commits`, (req, res) => {
    const sha = sha1(`commit${Math.random()}`);
    commits.set(sha, { sha, message: req.body.message, tree: req.body.tree, parents: req.body.parents });
    res.status(201).json({ sha });
  });
  api.get(`${R}/git/trees/:ref`, (req, res) => {
    if (!req.r.head) return res.status(409).json({ message: 'Git Repository is empty.' });
    const map = headMap(req.r);
    const dirs = new Set();
    const tree = [];
    for (const [p, e] of map) {
      const parts = p.split('/');
      for (let i = 1; i < parts.length; i++) dirs.add(parts.slice(0, i).join('/'));
      tree.push({ path: p, mode: e.mode, type: 'blob', sha: e.sha, size: blobs.get(e.sha).length });
    }
    for (const d of dirs) tree.push({ path: d, mode: '040000', type: 'tree', sha: sha1(d) });
    res.json({ sha: commits.get(req.r.head).tree, tree, truncated: false });
  });
  api.get(`${R}/git/blobs/:sha`, (req, res) => {
    const b = blobs.get(req.params.sha);
    if (!b) return res.status(404).json({ message: 'Not Found' });
    res.json({ sha: req.params.sha, size: b.length, encoding: 'base64', content: b.toString('base64') });
  });

  api.get(`${R}/zipball/:ref`, (req, res) => {
    res.type('application/zip').send(Buffer.concat([Buffer.from([0x50, 0x4b, 0x05, 0x06]), Buffer.alloc(18)]));
  });

  // Collaborators
  api.get(`${R}/collaborators`, (req, res) => res.json([{ login: req.r.owner }, ...[...req.r.collaborators].map((login) => ({ login }))].map(userJson)));
  api.put(`${R}/collaborators/:u`, (req, res) => {
    if (!needAdmin(req, res)) return;
    const u = req.params.u.toLowerCase();
    if (!users[u]) return res.status(404).json({ message: 'Not Found' });
    if (req.r.collaborators.has(u)) return res.status(204).end();
    const inv = { id: req.r.invitations.length + 100, invitee: userJson(users[u]) };
    req.r.invitations.push(inv);
    res.status(201).json(inv);
  });
  api.delete(`${R}/collaborators/:u`, (req, res) => { req.r.collaborators.delete(req.params.u.toLowerCase()); res.status(204).end(); });
  api.get(`${R}/invitations`, (req, res) => res.json(req.r.invitations));
  api.delete(`${R}/invitations/:id`, (req, res) => { req.r.invitations = req.r.invitations.filter((i) => String(i.id) !== req.params.id); res.status(204).end(); });

  // Pages
  const pagesJson = (r) => ({ html_url: `${base}/site/${r.owner}/${r.name}/`, status: r.pages.status, build_type: r.pages.build_type, source: r.pages.source });
  api.get(`${R}/pages`, (req, res) => (req.r.pages ? res.json(pagesJson(req.r)) : res.status(404).json({ message: 'Not Found' })));
  const setPages = (req, res, code) => {
    if (!needAdmin(req, res)) return;
    if (req.r.private) return res.status(422).json({ message: 'Your current plan does not support GitHub Pages for this repository.' });
    req.r.pages = { build_type: req.body.build_type || 'legacy', source: req.body.source, status: null };
    if (req.r.pages.build_type === 'legacy') afterPush(req.r);
    res.status(code).json(pagesJson(req.r));
  };
  api.post(`${R}/pages`, (req, res) => setPages(req, res, 201));
  api.put(`${R}/pages`, (req, res) => setPages(req, res, 204));
  api.get(`${R}/pages/builds/latest`, (req, res) => (req.r.pages ? res.json({ status: req.r.pages.status === 'built' ? 'built' : 'building' }) : res.status(404).json({ message: 'Not Found' })));
  api.post(`${R}/pages/builds`, (req, res) => { afterPush(req.r); res.status(201).json({ status: 'queued' }); });
  api.get(`${R}/actions/workflows/:file/runs`, (req, res) => res.json({ total_count: req.r.runs.length, workflow_runs: req.r.runs }));
  api.post(`${R}/actions/workflows/:file/dispatches`, (req, res) => { afterPush(req.r); res.status(204).end(); });

  app.use(api);

  // Helpers for tests.
  const helpers = {
    TOKEN,
    PNG,
    repos,
    addRepo,
    setBase(url) { base = url; },
    readFile(owner, name, path) {
      const r = repos.get(`${owner}/${name}`.toLowerCase());
      const e = headMap(r).get(path);
      return e ? blobs.get(e.sha).toString('utf8') : null;
    },
    files(owner, name) { return [...headMap(repos.get(`${owner}/${name}`.toLowerCase())).keys()].sort(); },
    // Simulates someone else changing a file outside SimpleGit.
    writeFile(owner, name, path, text) {
      const r = repos.get(`${owner}/${name}`.toLowerCase());
      const map = headMap(r);
      map.set(path, { sha: putBlob(Buffer.from(text)), mode: '100644' });
      makeCommit(r, map, `Outside change to ${path}`);
    },
  };
  return { app, helpers };
}
