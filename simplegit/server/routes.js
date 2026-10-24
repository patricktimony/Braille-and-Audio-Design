// SimpleGit's own small API. The browser only talks to these routes; this
// server talks to GitHub using the token kept in the encrypted session.
import express from 'express';
import crypto from 'node:crypto';
import { Readable } from 'node:stream';
import { config, isConfigured, saveEnv } from './config.js';
import { github, FriendlyError, toFriendly, storeTokens, enc, GitHubError } from './github.js';
import { analyzeProject, scanForSecrets, publishWorkflow, checkWebsite } from './analyze.js';

const NAME_RE = /^[A-Za-z0-9_.-]{1,100}$/;
const WORKFLOW_PATH = '.github/workflows/simplegit-publish.yml';
const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

// ---------- small helpers ----------

function bad(title, message, next = 'Please check what you typed and try again.', extra) {
  return new FriendlyError(400, title, message, next, extra);
}

function cleanPath(p, { allowEmpty = false } = {}) {
  if (typeof p !== 'string') p = '';
  p = p.trim().replace(/^\/+|\/+$/g, '');
  if (!p) {
    if (allowEmpty) return '';
    throw bad('A name is needed', 'The name is empty.', 'Type a name and try again.');
  }
  const parts = p.split('/');
  if (parts.some((s) => !s || s === '.' || s === '..' || /[\\\0-\x1f]/.test(s) || s.length > 255)) {
    throw bad('That name cannot be used', `"${p}" contains characters that GitHub does not allow in names.`,
      'Use letters, numbers, dashes, dots or underscores, then try again.');
  }
  if (parts[0] === '.git') throw bad('That name cannot be used', 'Names starting with ".git" are reserved by GitHub.');
  return p;
}

function checkName(s) {
  if (!NAME_RE.test(s || '')) throw new FriendlyError(404, 'We could not find that project', 'The project name in the address is not valid.', 'Return Home and choose the project again.');
  return s;
}

const escapeHtml = (t) => String(t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// For addresses opened directly by the browser (downloads), errors are shown
// as a simple page instead of raw data.
function errorHtml(f) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(f.title)} – SimpleGit</title><link rel="stylesheet" href="/styles.css"></head>
<body><main class="wrap"><h1>${escapeHtml(f.title)}</h1><div class="status error" role="alert"><p>${escapeHtml(f.message)}</p>
<p><strong>What you can do: </strong>${escapeHtml(f.next)}</p></div><a class="btn primary huge" href="/">Return to SimpleGit</a></main></body></html>`;
}

const route = (what, fn, { html = false } = {}) => async (req, res) => {
  try {
    await fn(req, res);
  } catch (err) {
    const f = toFriendly(err, what);
    if (res.headersSent) res.end();
    else if (html) res.status(f.status).type('html').send(errorHtml(f));
    else res.status(f.status).json(f);
  }
};

function ghFor(req) {
  if (!req.session.token) throw new FriendlyError(401, 'You need to sign in', 'You are not signed in to GitHub yet.', 'Press the Sign in with GitHub button to continue.', { signedOut: true });
  return github(req.session);
}

async function getRepo(gh, owner, repo) {
  return gh.get(`/repos/${owner}/${repo}`);
}

async function headSha(gh, owner, repo, branch) {
  try {
    const ref = await gh.get(`/repos/${owner}/${repo}/git/ref/heads/${enc(branch)}`);
    return ref.object.sha;
  } catch (err) {
    if (err instanceof GitHubError && (err.status === 404 || err.status === 409)) return null; // empty project
    throw err;
  }
}

async function getTree(gh, owner, repo, branch) {
  try {
    const t = await gh.get(`/repos/${owner}/${repo}/git/trees/${enc(branch)}`, { query: { recursive: 1 } });
    return t.tree || [];
  } catch (err) {
    if (err instanceof GitHubError && (err.status === 404 || err.status === 409)) return [];
    throw err;
  }
}

async function getContent(gh, owner, repo, path, branch) {
  try {
    return await gh.get(`/repos/${owner}/${repo}/contents${path ? `/${enc(path)}` : ''}`, { query: { ref: branch } });
  } catch (err) {
    if (err instanceof GitHubError && err.status === 404) return null;
    throw err;
  }
}

// Saves several changes as one step using GitHub's lower-level API. Fails
// safely if anything else was saved at the same moment.
async function commitChanges(gh, owner, repo, branch, entries, message) {
  const head = await headSha(gh, owner, repo, branch);
  if (!head) throw bad('This project is empty', 'There is nothing to change yet.', 'Add a file first.');
  const commit = await gh.get(`/repos/${owner}/${repo}/git/commits/${head}`);
  const tree = await gh.post(`/repos/${owner}/${repo}/git/trees`, { base_tree: commit.tree.sha, tree: entries });
  const newCommit = await gh.post(`/repos/${owner}/${repo}/git/commits`, { message, tree: tree.sha, parents: [head] });
  try {
    await gh.patch(`/repos/${owner}/${repo}/git/refs/heads/${enc(branch)}`, { sha: newCommit.sha, force: false });
  } catch (err) {
    if (err instanceof GitHubError && err.status === 422) throw new GitHubError(409, { message: 'Branch moved' });
    throw err;
  }
  return newCommit.sha;
}

function looksLikeText(buf) {
  const sample = buf.subarray(0, 8000);
  if (sample.includes(0)) return false;
  try { new TextDecoder('utf-8', { fatal: true }).decode(buf); return true; } catch { return false; }
}

const IMAGE_TYPES = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', svg: 'image/svg+xml', ico: 'image/x-icon', bmp: 'image/bmp', avif: 'image/avif' };
const extOf = (p) => (p.match(/\.([^./]+)$/)?.[1] || '').toLowerCase();

function projectSummary(r) {
  return {
    owner: r.owner.login,
    name: r.name,
    description: r.description || '',
    private: r.private,
    defaultBranch: r.default_branch,
    canChange: Boolean(r.permissions?.push),
    isAdmin: Boolean(r.permissions?.admin),
    isOwner: Boolean(r.permissions?.admin),
    homepage: r.homepage || '',
    hasPages: Boolean(r.has_pages),
    archived: Boolean(r.archived),
    updatedAt: r.pushed_at || r.updated_at,
    link: r.html_url,
    empty: r.size === 0,
  };
}

const savedBy = (text) => `${text}\n\nSaved with SimpleGit`;

// ---------- the router ----------

export function apiRouter() {
  const r = express.Router();
  r.use(express.json({ limit: Math.ceil(MAX_UPLOAD_BYTES * 1.4) }));

  // Every request that changes something must come from SimpleGit's own page.
  r.use((req, res, next) => {
    if (req.method !== 'GET' && req.get('X-SimpleGit') !== '1') {
      return res.status(403).json(new FriendlyError(403, 'Request blocked', 'This request did not come from SimpleGit.', 'Reload the page and try again.'));
    }
    next();
  });

  r.get('/me', route('check who is signed in', async (req, res) => {
    const out = {
      configured: isConfigured(),
      setupAllowed: !isConfigured() && setupAllowed(req),
      signedIn: Boolean(req.session.token),
      appMode: Boolean(config.appSlug),
      installUrl: config.appSlug ? `${config.webUrl}/apps/${config.appSlug}/installations/new` : null,
    };
    if (out.signedIn) {
      const gh = github(req.session);
      try {
        const u = await gh.get('/user');
        out.user = { login: u.login, name: u.name || u.login, avatar: u.avatar_url };
        if (config.appSlug) {
          const inst = await gh.get('/user/installations', { query: { per_page: 1 } });
          out.needsInstall = !inst.total_count;
        }
      } catch (err) {
        if (err instanceof GitHubError && err.status === 401) {
          req.session.destroy();
          out.signedIn = false;
        } else throw err;
      }
    }
    res.json(out);
  }));

  // ----- Projects -----

  r.get('/projects', route('list your projects', async (req, res) => {
    const gh = ghFor(req);
    const repos = await gh.paginate('/user/repos', { sort: 'pushed', affiliation: 'owner,collaborator,organization_member' }, 5);
    res.json({ projects: repos.map(projectSummary) });
  }));

  r.post('/projects', route('create the project', async (req, res) => {
    const gh = ghFor(req);
    const name = String(req.body.name || '').trim();
    const description = String(req.body.description || '').trim().slice(0, 350);
    if (!name) throw bad('A project name is needed', 'The project name is empty.', 'Type a name for your project.');
    const safe = name.replace(/\s+/g, '-').replace(/[^A-Za-z0-9_.-]/g, '').replace(/^\.+/, '').slice(0, 100);
    if (!safe) throw bad('That name cannot be used', 'Project names need at least one letter or number.', 'Type a different name.');
    if (typeof req.body.private !== 'boolean') throw bad('Please choose who can see it', 'You have not chosen whether the project is private or public.', 'Choose one of the two options.');
    try {
      const repo = await gh.post('/user/repos', { name: safe, description, private: req.body.private, auto_init: true });
      res.status(201).json({ project: projectSummary(repo) });
    } catch (err) {
      if (err instanceof GitHubError && err.status === 422 && /already exists/i.test(JSON.stringify(err.body))) {
        throw new FriendlyError(422, 'That name is already used', `You already have a project called "${safe}".`, 'Choose a different name.', { code: 'name-taken' });
      }
      throw err;
    }
  }));

  const P = '/projects/:owner/:repo';
  const params = (req) => ({ owner: checkName(req.params.owner), repo: checkName(req.params.repo) });

  r.get(P, route('open the project', async (req, res) => {
    const { owner, repo } = params(req);
    const gh = ghFor(req);
    res.json({ project: projectSummary(await getRepo(gh, owner, repo)) });
  }));

  r.get(`${P}/folder`, route('open the folder', async (req, res) => {
    const { owner, repo } = params(req);
    const gh = ghFor(req);
    const path = cleanPath(req.query.path, { allowEmpty: true });
    const info = await getRepo(gh, owner, repo);
    const data = await getContent(gh, owner, repo, path, info.default_branch);
    if (data === null) {
      if (!path) return res.json({ path, items: [], empty: true });
      throw new GitHubError(404, {});
    }
    if (!Array.isArray(data)) return res.json({ path, isFile: true });
    const items = data
      .filter((i) => i.name !== '.keep' && i.name !== '.gitkeep')
      .map((i) => ({ name: i.name, path: i.path, type: i.type === 'dir' ? 'folder' : 'file', size: i.size, sha: i.sha }))
      .sort((a, b) => (a.type === b.type ? a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }) : a.type === 'folder' ? -1 : 1));
    res.json({ path, items, empty: false });
  }));

  r.get(`${P}/file`, route('open the file', async (req, res) => {
    const { owner, repo } = params(req);
    const gh = ghFor(req);
    const path = cleanPath(req.query.path);
    const info = await getRepo(gh, owner, repo);
    const data = await getContent(gh, owner, repo, path, info.default_branch);
    if (data === null) throw new GitHubError(404, {});
    if (Array.isArray(data)) return res.json({ path, isFolder: true });
    if (data.type !== 'file') {
      throw bad('This item cannot be opened', 'This is a special kind of item (a link to somewhere else) that SimpleGit cannot show.', 'Go back and choose another file.');
    }
    const ext = extOf(path);
    const out = { path, name: data.name, sha: data.sha, size: data.size, isImage: Boolean(IMAGE_TYPES[ext]), link: data.html_url };
    if (data.encoding !== 'base64' || data.size > 1_000_000) {
      out.tooLarge = true;
    } else {
      const buf = Buffer.from(data.content || '', 'base64');
      out.isText = looksLikeText(buf);
      if (out.isText) out.text = buf.toString('utf8');
    }
    res.json(out);
  }));

  // Sends one file's raw bytes. Only pictures are shown in the page; anything
  // else is downloaded so it can never run as part of SimpleGit.
  r.get(`${P}/raw`, route('get the file', async (req, res) => {
    const { owner, repo } = params(req);
    const gh = ghFor(req);
    const path = cleanPath(req.query.path);
    const info = await getRepo(gh, owner, repo);
    const upstream = await gh.request('GET', `/repos/${owner}/${repo}/contents/${enc(path)}`, {
      query: { ref: info.default_branch }, accept: 'application/vnd.github.raw', raw: true,
    });
    const type = IMAGE_TYPES[extOf(path)];
    const name = path.split('/').pop();
    res.set('Content-Type', type && req.query.download !== '1' ? type : 'application/octet-stream');
    res.set('Content-Disposition', `${type && req.query.download !== '1' ? 'inline' : 'attachment'}; filename*=UTF-8''${encodeURIComponent(name)}`);
    res.set('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; sandbox");
    res.set('Cache-Control', 'private, no-store');
    Readable.fromWeb(upstream.body).pipe(res);
  }, { html: true }));

  // Create or update a file.
  r.put(`${P}/file`, route('save the file', async (req, res) => {
    const { owner, repo } = params(req);
    const gh = ghFor(req);
    const path = cleanPath(req.body.path);
    const info = await getRepo(gh, owner, repo);
    const branch = info.default_branch;
    let content;
    if (typeof req.body.base64 === 'string') {
      content = req.body.base64.replace(/^data:[^,]*,/, '');
      if (Buffer.byteLength(content, 'base64') > MAX_UPLOAD_BYTES) throw bad('That file is too big', 'SimpleGit can save files up to 25 megabytes.', 'Choose a smaller file.');
    } else if (typeof req.body.text === 'string') {
      content = Buffer.from(req.body.text, 'utf8').toString('base64');
    } else throw bad('Nothing to save', 'There was no file content to save.', 'Try again.');

    const empty = !(await headSha(gh, owner, repo, branch));
    const current = empty ? null : await getContent(gh, owner, repo, path, branch);
    if (Array.isArray(current)) throw new FriendlyError(409, 'A folder already has that name', `There is already a folder called "${path.split('/').pop()}" here.`, 'Choose a different name for your file.', { code: 'folder-exists' });
    let sha;
    if (!req.body.sha) {
      if (current && !req.body.overwrite) {
        throw new FriendlyError(409, 'A file with that name already exists', `There is already a file called "${current.name}" here. Saving would replace it.`, 'Choose a different name, or confirm that you want to replace the existing file.', { code: 'exists' });
      }
      sha = current?.sha;
    } else {
      if (!current) {
        throw new FriendlyError(409, 'This file was deleted', 'Someone deleted this file after you opened it. Your changes are still on the screen.', 'You can save your changes to put the file back.', { code: 'deleted' });
      }
      if (current.sha !== req.body.sha && !req.body.force) {
        throw new FriendlyError(409, 'This file was changed by someone else', 'This file was changed after you opened it, perhaps by another person or another program. Saving now would replace their changes.', 'You can look at the newer version first, or replace it with yours.', { code: 'changed' });
      }
      sha = current.sha;
    }
    const verb = !current ? 'Added' : req.body.replace ? 'Replaced' : 'Changed';
    const result = await gh.put(`/repos/${owner}/${repo}/contents/${enc(path)}`, {
      message: savedBy(`${verb} ${path}`),
      content,
      ...(sha ? { sha } : {}),
      ...(empty ? {} : { branch }),
    });
    res.json({ ok: true, sha: result.content.sha, commit: result.commit.sha, created: !current });
  }));

  r.delete(`${P}/file`, route('delete the file', async (req, res) => {
    const { owner, repo } = params(req);
    const gh = ghFor(req);
    const path = cleanPath(req.body.path);
    const info = await getRepo(gh, owner, repo);
    const current = await getContent(gh, owner, repo, path, info.default_branch);
    if (!current || Array.isArray(current)) throw new FriendlyError(404, 'This file is already gone', 'The file could not be found. Someone may have deleted or renamed it already.', 'Go back to see the folder as it is now.');
    if (req.body.sha && current.sha !== req.body.sha && !req.body.force) {
      throw new FriendlyError(409, 'This file was changed by someone else', 'This file was changed after you opened it. Deleting it now would also delete those newer changes.', 'Go back and open the file again to see the newest version.', { code: 'changed' });
    }
    const result = await gh.del(`/repos/${owner}/${repo}/contents/${enc(path)}`, {
      message: savedBy(`Deleted ${path}`), sha: current.sha, branch: info.default_branch,
    });
    res.json({ ok: true, commit: result.commit.sha });
  }));

  r.post(`${P}/rename`, route('rename the file', async (req, res) => {
    const { owner, repo } = params(req);
    const gh = ghFor(req);
    const from = cleanPath(req.body.from);
    const to = cleanPath(req.body.to);
    if (from === to) throw bad('The name is the same', 'The new name is the same as the old name.', 'Type a different name, or press Back.');
    const info = await getRepo(gh, owner, repo);
    const tree = await getTree(gh, owner, repo, info.default_branch);
    const entry = tree.find((t) => t.path === from && t.type === 'blob');
    if (!entry) throw new FriendlyError(404, 'This file is gone', 'The file could not be found. Someone may have deleted or renamed it already.', 'Go back to see the folder as it is now.');
    if (req.body.sha && entry.sha !== req.body.sha) {
      throw new FriendlyError(409, 'This file was changed by someone else', 'This file was changed after you opened it.', 'Go back and open the file again, then rename it.', { code: 'changed' });
    }
    const clash = tree.find((t) => t.path === to);
    if (clash?.type === 'tree') throw new FriendlyError(409, 'A folder already has that name', 'There is already a folder with that name.', 'Choose a different name.', { code: 'folder-exists' });
    if (clash && !req.body.overwrite) {
      throw new FriendlyError(409, 'A file with that name already exists', `There is already a file called "${to.split('/').pop()}". Renaming would replace it.`, 'Choose a different name, or confirm that you want to replace it.', { code: 'exists' });
    }
    const commit = await commitChanges(gh, owner, repo, info.default_branch, [
      { path: to, mode: entry.mode, type: 'blob', sha: entry.sha },
      { path: from, mode: entry.mode, type: 'blob', sha: null },
    ], savedBy(`Renamed ${from} to ${to}`));
    res.json({ ok: true, commit, path: to });
  }));

  r.post(`${P}/folders`, route('create the folder', async (req, res) => {
    const { owner, repo } = params(req);
    const gh = ghFor(req);
    const path = cleanPath(req.body.path);
    const info = await getRepo(gh, owner, repo);
    const empty = !(await headSha(gh, owner, repo, info.default_branch));
    const existing = empty ? null : await getContent(gh, owner, repo, path, info.default_branch);
    if (existing) throw new FriendlyError(409, 'That name is already used', `There is already ${Array.isArray(existing) ? 'a folder' : 'a file'} called "${path.split('/').pop()}" here.`, 'Choose a different name.', { code: 'exists' });
    // GitHub cannot store empty folders, so a tiny hidden placeholder file is added.
    const result = await gh.put(`/repos/${owner}/${repo}/contents/${enc(`${path}/.keep`)}`, {
      message: savedBy(`Created folder ${path}`), content: '', ...(empty ? {} : { branch: info.default_branch }),
    });
    res.json({ ok: true, commit: result.commit.sha });
  }));

  r.get(`${P}/folder-size`, route('count the files in the folder', async (req, res) => {
    const { owner, repo } = params(req);
    const gh = ghFor(req);
    const path = cleanPath(req.query.path);
    const info = await getRepo(gh, owner, repo);
    const tree = await getTree(gh, owner, repo, info.default_branch);
    const files = tree.filter((t) => t.type === 'blob' && t.path.startsWith(`${path}/`));
    res.json({ count: files.filter((f) => !/(^|\/)\.(git)?keep$/.test(f.path)).length, total: files.length });
  }));

  r.post(`${P}/delete-folder`, route('delete the folder', async (req, res) => {
    const { owner, repo } = params(req);
    const gh = ghFor(req);
    const path = cleanPath(req.body.path);
    const info = await getRepo(gh, owner, repo);
    const tree = await getTree(gh, owner, repo, info.default_branch);
    const files = tree.filter((t) => t.type === 'blob' && t.path.startsWith(`${path}/`));
    if (!files.length) throw new FriendlyError(404, 'This folder is already gone', 'The folder could not be found.', 'Go back to see the project as it is now.');
    if (typeof req.body.total === 'number' && req.body.total !== files.length) {
      throw new FriendlyError(409, 'This folder was changed by someone else', 'Files were added or removed in this folder after you opened it.', 'Go back, open the folder again, and check what is inside before deleting.', { code: 'changed' });
    }
    if (files.length > 1000) throw bad('This folder is very large', 'SimpleGit can only delete folders with up to 1,000 files.', 'Delete some of the files inside first.');
    const commit = await commitChanges(gh, owner, repo, info.default_branch,
      files.map((f) => ({ path: f.path, mode: f.mode, type: 'blob', sha: null })), savedBy(`Deleted folder ${path}`));
    res.json({ ok: true, commit });
  }));

  // Undoes the most recent change, as long as nothing else was saved after it.
  r.post(`${P}/undo`, route('undo the change', async (req, res) => {
    const { owner, repo } = params(req);
    const gh = ghFor(req);
    const target = String(req.body.commit || '');
    if (!/^[0-9a-f]{40}$/.test(target)) throw bad('Nothing to undo', 'SimpleGit does not know which change to undo.', 'Return Home.');
    const info = await getRepo(gh, owner, repo);
    const branch = info.default_branch;
    const head = await headSha(gh, owner, repo, branch);
    if (head !== target) {
      throw new FriendlyError(409, 'This change cannot be undone automatically', 'Other changes were saved after this one, so undoing it now could remove someone else\'s work.', 'You can change the file back by hand instead.', { code: 'changed' });
    }
    const c = await gh.get(`/repos/${owner}/${repo}/git/commits/${target}`);
    if (!c.parents.length) throw bad('This cannot be undone', 'This was the very first change in the project.', 'You can delete files by hand instead.');
    const parent = await gh.get(`/repos/${owner}/${repo}/git/commits/${c.parents[0].sha}`);
    const undo = await gh.post(`/repos/${owner}/${repo}/git/commits`, {
      message: savedBy(`Undid: ${c.message.split('\n')[0]}`), tree: parent.tree.sha, parents: [target],
    });
    try {
      await gh.patch(`/repos/${owner}/${repo}/git/refs/heads/${enc(branch)}`, { sha: undo.sha, force: false });
    } catch (err) {
      if (err instanceof GitHubError && err.status === 422) throw new GitHubError(409, {});
      throw err;
    }
    res.json({ ok: true, commit: undo.sha });
  }));

  // ----- Download -----

  async function checkDownload(req) {
    const { owner, repo } = params(req);
    const gh = ghFor(req);
    const info = await getRepo(gh, owner, repo);
    if (!(await headSha(gh, owner, repo, info.default_branch))) {
      throw bad('This project is empty', 'There are no files to download yet.', 'Add a file to the project first.');
    }
    return { gh, owner, repo, info };
  }

  // Lets the page check first, so problems are explained before the download.
  r.get(`${P}/download-check`, route('download the project', async (req, res) => {
    await checkDownload(req);
    res.json({ ok: true });
  }));

  r.get(`${P}/download`, route('download the project', async (req, res) => {
    const { gh, owner, repo, info } = await checkDownload(req);
    const upstream = await gh.request('GET', `/repos/${owner}/${repo}/zipball/${enc(info.default_branch)}`, { raw: true });
    res.set('Content-Type', 'application/zip');
    res.set('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(`${repo}.zip`)}`);
    res.set('Cache-Control', 'private, no-store');
    Readable.fromWeb(upstream.body).pipe(res);
  }, { html: true }));

  // ----- Sharing -----

  r.get(`${P}/sharing`, route('find out who can see the project', async (req, res) => {
    const { owner, repo } = params(req);
    const gh = ghFor(req);
    const info = await getRepo(gh, owner, repo);
    const out = { project: projectSummary(info), helpers: [], invites: [], website: null };
    if (info.permissions?.admin) {
      const [collabs, invites] = await Promise.all([
        gh.paginate(`/repos/${owner}/${repo}/collaborators`, { affiliation: 'direct' }, 2).catch(() => []),
        gh.paginate(`/repos/${owner}/${repo}/invitations`, {}, 2).catch(() => []),
      ]);
      out.helpers = collabs.filter((c) => c.login.toLowerCase() !== owner.toLowerCase())
        .map((c) => ({ login: c.login, avatar: c.avatar_url }));
      out.invites = invites.map((i) => ({ id: i.id, login: i.invitee?.login || 'someone' }));
    }
    if (info.has_pages) {
      const pages = await gh.get(`/repos/${owner}/${repo}/pages`).catch(() => null);
      if (pages?.html_url) out.website = pages.html_url;
    }
    res.json(out);
  }));

  r.get('/people/:username', route('find that person', async (req, res) => {
    const gh = ghFor(req);
    const name = String(req.params.username).trim().replace(/^@/, '');
    if (!/^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/.test(name)) {
      throw bad('That is not a GitHub username', 'GitHub usernames use only letters, numbers and dashes, with no spaces.', 'Check the username with the person and try again.');
    }
    try {
      const u = await gh.get(`/users/${name}`);
      res.json({ person: { login: u.login, name: u.name || '', avatar: u.avatar_url, isOrg: u.type !== 'User' } });
    } catch (err) {
      if (err instanceof GitHubError && err.status === 404) {
        throw new FriendlyError(404, 'We could not find that person', `There is no GitHub account called "${name}".`, 'Check the spelling with the person. They need a free GitHub account first.');
      }
      throw err;
    }
  }));

  r.post(`${P}/helpers`, route('invite that person', async (req, res) => {
    const { owner, repo } = params(req);
    const gh = ghFor(req);
    const username = String(req.body.username || '').trim();
    if (!/^[A-Za-z0-9-]{1,39}$/.test(username)) throw bad('That is not a GitHub username', 'GitHub usernames use only letters, numbers and dashes.', 'Check the username and try again.');
    const result = await gh.put(`/repos/${owner}/${repo}/collaborators/${username}`, { permission: 'push' });
    res.json({ ok: true, alreadyHelping: result === null, invitationLink: `${config.webUrl}/${owner}/${repo}/invitations` });
  }));

  r.delete(`${P}/helpers/:username`, route('stop sharing with that person', async (req, res) => {
    const { owner, repo } = params(req);
    const gh = ghFor(req);
    const username = String(req.params.username);
    if (!/^[A-Za-z0-9-]{1,39}$/.test(username)) throw bad('That is not a GitHub username', 'The username is not valid.');
    await gh.del(`/repos/${owner}/${repo}/collaborators/${username}`);
    res.json({ ok: true });
  }));

  r.delete(`${P}/invites/:id`, route('cancel the invitation', async (req, res) => {
    const { owner, repo } = params(req);
    const gh = ghFor(req);
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) throw bad('Invitation not found', 'That invitation is not valid.');
    await gh.del(`/repos/${owner}/${repo}/invitations/${id}`);
    res.json({ ok: true });
  }));

  // Looks for passwords and keys before anything is made public.
  r.get(`${P}/safety-check`, route('check the project for passwords and keys', async (req, res) => {
    const { owner, repo } = params(req);
    const gh = ghFor(req);
    const info = await getRepo(gh, owner, repo);
    const tree = await getTree(gh, owner, repo, info.default_branch);
    res.json(await scanForSecrets(gh, owner, repo, tree));
  }));

  r.post(`${P}/make-public`, route('make the project public', async (req, res) => {
    const { owner, repo } = params(req);
    const gh = ghFor(req);
    if (req.body.confirm !== 'make-public') throw bad('Please confirm first', 'Making a project public needs your clear permission.', 'Tick the box to confirm, then press the button again.');
    const info = await getRepo(gh, owner, repo);
    if (!info.permissions?.admin) throw new FriendlyError(403, 'Only the owner can do this', 'Only the owner of this project can make it public.', 'Ask the owner to do it.');
    if (!info.private) return res.json({ ok: true, already: true });
    const tree = await getTree(gh, owner, repo, info.default_branch);
    const scan = await scanForSecrets(gh, owner, repo, tree);
    const blockers = scan.findings.filter((f) => f.level === 'block');
    if (blockers.length) {
      throw new FriendlyError(400, 'Passwords or keys were found', 'This project seems to contain private information. It stays private for your safety.', 'Remove the files listed below, then try again.', { code: 'secrets', findings: blockers });
    }
    if (scan.findings.length && !req.body.secretsChecked) {
      throw new FriendlyError(400, 'Please check these files first', 'Some files might contain private information.', 'Look at the files listed, then confirm that they are safe to share.', { code: 'secrets-check', findings: scan.findings });
    }
    await gh.patch(`/repos/${owner}/${repo}`, { private: false });
    res.json({ ok: true });
  }));

  // ----- Try My Project -----

  async function getPages(gh, owner, repo) {
    try { return await gh.get(`/repos/${owner}/${repo}/pages`); } catch (err) {
      if (err instanceof GitHubError && err.status === 404) return null;
      throw err;
    }
  }

  r.get(`${P}/try`, route('check whether your project is a working website', async (req, res) => {
    const { owner, repo } = params(req);
    const gh = ghFor(req);
    const info = await getRepo(gh, owner, repo);
    const out = { project: projectSummary(info), site: null };
    const pages = await getPages(gh, owner, repo);
    if (pages?.html_url) {
      const check = await checkWebsite(pages.html_url);
      out.site = { url: pages.html_url, kind: 'pages', working: check.working, status: pages.status, buildType: pages.build_type, source: pages.source };
    } else if (info.homepage && /^https?:\/\//i.test(info.homepage)) {
      const check = await checkWebsite(info.homepage);
      out.site = { url: info.homepage, kind: 'homepage', working: check.working };
    }
    const tree = await getTree(gh, owner, repo, info.default_branch);
    out.analysis = await analyzeProject(gh, owner, repo, tree);
    if (!out.site?.working && out.analysis.canPublish && info.permissions?.admin) {
      out.safety = await scanForSecrets(gh, owner, repo, tree);
    }
    out.canPublishHere = Boolean(info.permissions?.admin);
    res.json(out);
  }));

  r.post(`${P}/publish`, route('publish your project', async (req, res) => {
    const { owner, repo } = params(req);
    const gh = ghFor(req);
    if (req.body.confirm !== true) throw bad('Please confirm first', 'Publishing makes a website that anyone can visit, so it needs your permission.', 'Tick the box to confirm, then press Publish again.');
    const info = await getRepo(gh, owner, repo);
    if (!info.permissions?.admin) throw new FriendlyError(403, 'Only the owner can publish', 'Only the owner of this project can publish it as a website.', 'Ask the owner to publish it.');
    const branch = info.default_branch;
    const tree = await getTree(gh, owner, repo, branch);
    const analysis = await analyzeProject(gh, owner, repo, tree);
    if (!analysis.canPublish) throw bad('This project cannot be published here', analysis.reason, 'Return to Try My Project to see your options.');
    const scan = await scanForSecrets(gh, owner, repo, tree);
    const blockers = scan.findings.filter((f) => f.level === 'block');
    if (blockers.length) {
      throw new FriendlyError(400, 'Passwords or keys were found', 'This project seems to contain private information, so it was not published.', 'Remove the files listed below, then try again.', { code: 'secrets', findings: blockers });
    }
    if (scan.findings.length && !req.body.secretsChecked) {
      throw new FriendlyError(400, 'Please check these files first', 'Some files might contain private information.', 'Look at the files listed, then confirm they are safe to publish.', { code: 'secrets-check', findings: scan.findings });
    }

    const plan = analysis.plan;
    const existing = await getPages(gh, owner, repo);
    const settings = plan.method === 'branch'
      ? { build_type: 'legacy', source: { branch, path: plan.path } }
      : { build_type: 'workflow' };
    try {
      if (existing) await gh.put(`/repos/${owner}/${repo}/pages`, settings);
      else await gh.post(`/repos/${owner}/${repo}/pages`, settings);
    } catch (err) {
      if (err instanceof GitHubError && (err.status === 422 || err.status === 403 || err.status === 400) && info.private) {
        throw new FriendlyError(402, 'Private projects cannot be published on a free GitHub account',
          'GitHub only publishes websites for public projects, unless you pay for a GitHub plan.',
          'You can make the project public first (SimpleGit will check it for passwords), or keep it private. SimpleGit will never sign you up for a paid plan.', { code: 'private-plan' });
      }
      throw err;
    }

    if (plan.method === 'workflow') {
      const yaml = publishWorkflow({ branch, repo, owner, plan });
      const current = await getContent(gh, owner, repo, WORKFLOW_PATH, branch);
      const currentText = current && !Array.isArray(current) ? Buffer.from(current.content || '', 'base64').toString('utf8') : null;
      try {
        if (currentText !== yaml) {
          await gh.put(`/repos/${owner}/${repo}/contents/${enc(WORKFLOW_PATH)}`, {
            message: savedBy('Set up website publishing'), content: Buffer.from(yaml).toString('base64'), branch, ...(current ? { sha: current.sha } : {}),
          });
        } else {
          await gh.post(`/repos/${owner}/${repo}/actions/workflows/simplegit-publish.yml/dispatches`, { ref: branch });
        }
      } catch (err) {
        if (err instanceof GitHubError && (err.status === 403 || err.status === 404 || err.status === 422)) {
          throw new FriendlyError(403, 'SimpleGit needs one more permission',
            'To publish this kind of app, SimpleGit must be allowed to set up GitHub\'s automatic building ("workflows").',
            'Ask whoever set up SimpleGit to give the GitHub App the "Workflows: Read and write" permission, then try again.');
        }
        throw err;
      }
    } else if (existing) {
      await gh.post(`/repos/${owner}/${repo}/pages/builds`).catch(() => {});
    }
    res.json({ ok: true });
  }));

  r.get(`${P}/publish-status`, route('check on your website', async (req, res) => {
    const { owner, repo } = params(req);
    const gh = ghFor(req);
    const pages = await getPages(gh, owner, repo);
    if (!pages) return res.json({ state: 'not-started' });
    const url = pages.html_url;
    let state = 'building';
    let message = 'GitHub is preparing your website.';
    if (pages.build_type === 'workflow') {
      const runs = await gh.get(`/repos/${owner}/${repo}/actions/workflows/simplegit-publish.yml/runs`, { query: { per_page: 1 } }).catch(() => null);
      const run = runs?.workflow_runs?.[0];
      if (run?.status === 'completed') {
        if (run.conclusion === 'success') state = 'checking';
        else {
          state = 'failed';
          message = 'GitHub tried to prepare your app but something in the app stopped it from working. This usually means the app has a mistake that needs fixing.';
        }
      }
    } else {
      const build = await gh.get(`/repos/${owner}/${repo}/pages/builds/latest`).catch(() => null);
      if (build?.status === 'built' || pages.status === 'built') state = 'checking';
      else if (build?.status === 'errored' || pages.status === 'errored') {
        state = 'failed';
        message = 'GitHub could not turn the files into a website.';
      }
    }
    if (state === 'checking') {
      const check = await checkWebsite(url);
      if (check.working) {
        state = 'live';
        message = 'Your website is working.';
        const info = await getRepo(gh, owner, repo);
        if (!info.homepage && info.permissions?.admin) await gh.patch(`/repos/${owner}/${repo}`, { homepage: url }).catch(() => {});
      } else {
        message = 'The website is ready. GitHub is now sending it out to the internet. This can take a few more minutes.';
      }
    }
    res.json({ state, url, message });
  }));

  r.use((req, res) => res.status(404).json(new FriendlyError(404, 'Not found', 'That does not exist in SimpleGit.', 'Return Home.')));
  return r;
}

// ---------- sign in and setup ----------

function isLoopback(req) {
  const a = req.socket.remoteAddress || '';
  return a === '127.0.0.1' || a === '::1' || a === '::ffff:127.0.0.1';
}

export function setupAllowed(req) {
  return config.allowRemoteSetup || isLoopback(req);
}

export function authRouter() {
  const r = express.Router();

  r.get('/auth/login', async (req, res) => {
    if (!isConfigured()) return res.redirect('/#/setup');
    const state = crypto.randomBytes(16).toString('hex');
    req.session.oauthState = state;
    await req.session.save();
    const url = new URL(`${config.webUrl}/login/oauth/authorize`);
    url.searchParams.set('client_id', config.clientId);
    url.searchParams.set('redirect_uri', `${config.baseUrl}/auth/callback`);
    url.searchParams.set('state', state);
    if (!config.appSlug) url.searchParams.set('scope', config.oauthScopes);
    res.redirect(url.toString());
  });

  r.get('/auth/callback', async (req, res) => {
    const { code, state, error } = req.query;
    if (error) return res.redirect('/#/signin-problem/cancelled');
    if (!code || !state || state !== req.session.oauthState) return res.redirect('/#/signin-problem/expired');
    delete req.session.oauthState;
    try {
      const tokenRes = await fetch(`${config.webUrl}/login/oauth/access_token`, {
        method: 'POST',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({ client_id: config.clientId, client_secret: config.clientSecret, code, redirect_uri: `${config.baseUrl}/auth/callback` }),
      });
      const data = await tokenRes.json();
      if (!data.access_token) return res.redirect('/#/signin-problem/failed');
      storeTokens(req.session, data);
      await req.session.save();
      res.redirect('/#/');
    } catch (err) {
      console.error('Sign-in failed:', err.message);
      res.redirect('/#/signin-problem/network');
    }
  });

  r.post('/auth/logout', async (req, res) => {
    if (req.get('X-SimpleGit') !== '1') return res.status(403).end();
    req.session.destroy();
    res.json({ ok: true });
  });

  // One-click setup: GitHub creates a correctly configured GitHub App from
  // this description ("manifest") and hands the keys back to this server.
  r.get('/setup/manifest', async (req, res) => {
    if (isConfigured() || !setupAllowed(req)) return res.status(403).json(new FriendlyError(403, 'Setup is not available', 'SimpleGit is already set up, or setup must be done on the computer that runs SimpleGit.', 'Return Home.'));
    const state = crypto.randomBytes(16).toString('hex');
    req.session.setupState = state;
    await req.session.save();
    const suffix = crypto.randomBytes(3).toString('hex');
    const manifest = {
      name: `SimpleGit ${suffix}`,
      url: config.baseUrl,
      redirect_url: `${config.baseUrl}/setup/callback`,
      callback_urls: [`${config.baseUrl}/auth/callback`],
      setup_url: `${config.baseUrl}/`,
      description: 'A simple, accessible way to use GitHub.',
      public: false,
      request_oauth_on_install: false,
      hook_attributes: { url: `${config.baseUrl}/no-webhooks`, active: false },
      default_permissions: {
        contents: 'write', // read and save files
        metadata: 'read', // list projects
        administration: 'write', // create projects, invite helpers, public/private
        pages: 'write', // publish websites
        workflows: 'write', // set up automatic building for apps
        actions: 'read', // see whether a website build finished
      },
      default_events: [],
    };
    res.json({ action: `${config.webUrl}/settings/apps/new?state=${state}`, manifest: JSON.stringify(manifest) });
  });

  r.get('/setup/callback', async (req, res) => {
    if (isConfigured() || !setupAllowed(req)) return res.redirect('/');
    const { code, state } = req.query;
    if (!code || state !== req.session.setupState) return res.redirect('/#/setup/problem');
    try {
      const conv = await fetch(`${config.apiUrl}/app-manifests/${encodeURIComponent(code)}/conversions`, {
        method: 'POST', headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'SimpleGit' },
      });
      const app = await conv.json();
      if (!app.client_id || !app.client_secret) return res.redirect('/#/setup/problem');
      config.clientId = app.client_id;
      config.clientSecret = app.client_secret;
      config.appSlug = app.slug;
      // The app's private key (pem) is not needed and is deliberately not kept.
      saveEnv({ GITHUB_CLIENT_ID: app.client_id, GITHUB_CLIENT_SECRET: app.client_secret, GITHUB_APP_SLUG: app.slug });
      delete req.session.setupState;
      await req.session.save();
      res.redirect('/#/setup/done');
    } catch (err) {
      console.error('Setup failed:', err.message);
      res.redirect('/#/setup/problem');
    }
  });

  return r;
}
