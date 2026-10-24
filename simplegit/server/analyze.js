// Looks at a project's files to decide whether it can become a website on
// GitHub Pages, and checks for passwords or keys that must never be published.
import dns from 'node:dns/promises';
import net from 'node:net';
import { config } from './config.js';

// ---------- Secret detection ----------

const SECRET_FILE_PATTERNS = [
  { re: /(^|\/)\.env(\.[^/]*)?$/i, why: 'a settings file that often holds passwords and keys', allow: /\.(example|sample|template|dist)$/i },
  { re: /\.(pem|key|p12|pfx|keystore|jks|ppk)$/i, why: 'a security key file' },
  { re: /(^|\/)id_(rsa|dsa|ecdsa|ed25519)(\.pub)?$/i, why: 'a private computer key', allow: /\.pub$/i },
  { re: /(^|\/)(credentials|service[-_]?account[^/]*|client_secret[^/]*)\.json$/i, why: 'a file of login details' },
  { re: /(^|\/)\.npmrc$/i, why: 'a settings file that can hold a password' },
  { re: /(^|\/)\.htpasswd$/i, why: 'a password file' },
  { re: /(^|\/)secrets?\.(json|ya?ml|txt|toml|js|ts)$/i, why: 'a file named "secrets"' },
];

const SECRET_CONTENT_PATTERNS = [
  { re: /-----BEGIN (RSA |EC |DSA |OPENSSH |PGP |ENCRYPTED )?PRIVATE KEY( BLOCK)?-----/, why: 'a private security key', level: 'block' },
  { re: /\bAKIA[0-9A-Z]{16}\b/, why: 'an Amazon Web Services key', level: 'block' },
  { re: /\bgh[pousr]_[A-Za-z0-9]{36,}\b/, why: 'a GitHub password-like key', level: 'block' },
  { re: /\bgithub_pat_[A-Za-z0-9_]{40,}\b/, why: 'a GitHub password-like key', level: 'block' },
  { re: /\bsk-(ant-|proj-)?[A-Za-z0-9_-]{20,}/, why: 'an AI service key (such as Anthropic or OpenAI)', level: 'block' },
  { re: /\bsk_live_[0-9a-zA-Z]{20,}\b/, why: 'a Stripe payment key', level: 'block' },
  { re: /\bxox[baprs]-[A-Za-z0-9-]{10,}/, why: 'a Slack key', level: 'block' },
  { re: /\bAIza[0-9A-Za-z_-]{35}\b/, why: 'a Google key (some of these are meant to be public, but please check)', level: 'check' },
  { re: /(api[_-]?key|secret|passw(or)?d|access[_-]?token|auth[_-]?token)["']?\s*[:=]\s*["'][^"'\s]{12,}["']/i, why: 'something that looks like a password or key', level: 'check' },
];

const TEXT_EXT = /\.(js|mjs|cjs|jsx|ts|tsx|json|html?|css|py|rb|php|ya?ml|toml|ini|cfg|conf|txt|md|env|sh|vue|svelte|java|kt|go|rs|swift|cs|xml|properties)$|(^|\/)\.env[^/]*$|(^|\/)[^./]+$/i;

export function secretFileFindings(tree) {
  const findings = [];
  for (const item of tree) {
    if (item.type !== 'blob') continue;
    for (const p of SECRET_FILE_PATTERNS) {
      if (p.re.test(item.path) && !(p.allow && p.allow.test(item.path))) {
        findings.push({ path: item.path, why: `This looks like ${p.why}.`, level: 'block' });
        break;
      }
    }
  }
  return findings;
}

export function secretContentFindings(path, text) {
  const out = [];
  for (const p of SECRET_CONTENT_PATTERNS) {
    if (p.re.test(text)) { out.push({ path, why: `This file seems to contain ${p.why}.`, level: p.level }); break; }
  }
  return out;
}

// Reads text files (within limits) and looks for keys inside them.
export async function scanForSecrets(gh, owner, repo, tree) {
  const findings = secretFileFindings(tree);
  const flagged = new Set(findings.map((f) => f.path));
  const candidates = tree
    .filter((t) => t.type === 'blob' && !flagged.has(t.path) && (t.size ?? 0) <= 200_000 && TEXT_EXT.test(t.path)
      && !/(^|\/)(node_modules|vendor|dist\/assets)\//.test(t.path) && !/(package-lock\.json|yarn\.lock|pnpm-lock\.yaml)$/.test(t.path))
    .slice(0, 150);
  let scanned = 0;
  const queue = [...candidates];
  async function worker() {
    while (queue.length) {
      const item = queue.shift();
      try {
        const blob = await gh.get(`/repos/${owner}/${repo}/git/blobs/${item.sha}`);
        const text = Buffer.from(blob.content || '', 'base64').toString('utf8');
        findings.push(...secretContentFindings(item.path, text));
        scanned++;
      } catch { /* skip unreadable file */ }
    }
  }
  await Promise.all(Array.from({ length: 6 }, worker));
  const textFiles = tree.filter((t) => t.type === 'blob' && TEXT_EXT.test(t.path)).length;
  return { findings, scanned, complete: scanned >= textFiles };
}

// ---------- Project type detection ----------

const SERVER_DEPS = ['express', 'koa', 'fastify', '@hapi/hapi', 'hapi', 'socket.io', 'nuxt', '@remix-run/node',
  '@sveltejs/adapter-node', 'mongoose', 'pg', 'mysql', 'mysql2', 'sqlite3', 'better-sqlite3', 'prisma', '@prisma/client',
  'nest', '@nestjs/core', 'restify'];

const OTHER_BUILD_TOOLS = { astro: 'Astro', gatsby: 'Gatsby', parcel: 'Parcel', webpack: 'Webpack', '@sveltejs/kit': 'SvelteKit', '@angular/core': 'Angular', 'vue-cli-service': 'Vue CLI', '@vue/cli-service': 'Vue CLI', 'ember-cli': 'Ember', eleventy: 'Eleventy', '@11ty/eleventy': 'Eleventy' };

async function readText(gh, owner, repo, tree, path) {
  const item = tree.find((t) => t.path === path && t.type === 'blob');
  if (!item) return null;
  try {
    const blob = await gh.get(`/repos/${owner}/${repo}/git/blobs/${item.sha}`);
    return Buffer.from(blob.content || '', 'base64').toString('utf8');
  } catch { return null; }
}

// Returns a plain-English verdict about how (or whether) the project can be
// published as a website.
export async function analyzeProject(gh, owner, repo, tree) {
  const files = tree.filter((t) => t.type === 'blob').map((t) => t.path);
  const has = (p) => files.includes(p);
  const htmlRoot = files.filter((p) => !p.includes('/') && /\.html?$/i.test(p));
  const htmlPages = files.filter((p) => /\.html?$/i.test(p) && !/(^|\/)(node_modules|src|dist|build|out)\//.test(p)
    && (!p.includes('/') || /(^|\/)index\.html?$/i.test(p))).slice(0, 25);

  if (files.length === 0) {
    return { kind: 'empty', canPublish: false, reason: 'This project has no files yet, so there is nothing to show as a website.' };
  }

  let pkg = null;
  if (has('package.json')) {
    try { pkg = JSON.parse(await readText(gh, owner, repo, tree, 'package.json') || '{}'); } catch { pkg = {}; }
  }
  const deps = pkg ? { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) } : {};
  const scripts = pkg?.scripts || {};
  const serverDeps = Object.keys(deps).filter((d) => SERVER_DEPS.includes(d));

  const pyServer = has('requirements.txt') || has('Pipfile') || has('pyproject.toml') || has('manage.py') || has('app.py');
  const otherServer = [
    has('Gemfile') && !has('_config.yml') && 'Ruby',
    files.some((p) => /\.php$/i.test(p)) && 'PHP',
    has('go.mod') && 'Go',
    has('Cargo.toml') && 'Rust',
    (has('pom.xml') || has('build.gradle')) && 'Java',
    pyServer && 'Python',
  ].filter(Boolean);

  const serverReason = (tech) => ({
    kind: 'server',
    canPublish: false,
    reason: `This project includes a part that has to keep running on a computer (a "server")${tech ? `, written in ${tech}` : ''}. GitHub Pages can only show fixed web pages, so it cannot run this kind of project.`,
    details: serverDeps.length ? `Signs found: ${serverDeps.join(', ')}.` : undefined,
    hosting: true,
  });

  // Projects that need a build step.
  if (deps.next) {
    return {
      kind: 'nextjs', canPublish: false, hosting: true,
      reason: 'This project is built with a tool called Next.js. It usually needs a server, and SimpleGit cannot set it up on GitHub Pages automatically.',
    };
  }
  if (deps.vite && has('index.html')) {
    if (serverDeps.length) return serverReason('JavaScript');
    return {
      kind: 'vite', canPublish: true, plan: { method: 'workflow', build: 'vite', output: 'dist' }, htmlPages: [],
      reason: 'This is a web app that needs to be "built" (prepared) before it can be shown. SimpleGit can ask GitHub to build it and publish it for you every time you save changes.',
      caution: 'Most apps like this work, but some need extra settings. SimpleGit will check the website after publishing and tell you if it does not load.',
    };
  }
  if (deps['react-scripts']) {
    if (serverDeps.length) return serverReason('JavaScript');
    return {
      kind: 'cra', canPublish: true, plan: { method: 'workflow', build: 'cra', output: 'build' }, htmlPages: [],
      reason: 'This is a web app that needs to be "built" (prepared) before it can be shown. SimpleGit can ask GitHub to build it and publish it for you every time you save changes.',
      caution: 'Most apps like this work. SimpleGit will check the website after publishing and tell you if it does not load.',
    };
  }
  const otherTool = Object.keys(OTHER_BUILD_TOOLS).find((t) => deps[t]);
  if (otherTool && !serverDeps.length) {
    for (const out of ['dist', 'build', 'out', '_site', 'public']) {
      if (has(`${out}/index.html`)) {
        return { kind: 'static-folder', canPublish: true, plan: { method: 'workflow', output: out }, htmlPages: [],
          reason: `This project already contains a finished website in the "${out}" folder. SimpleGit can publish that folder.` };
      }
    }
    return {
      kind: 'build-unsupported', canPublish: false, hosting: false, askClaude: true,
      reason: `This project uses a tool called ${OTHER_BUILD_TOOLS[otherTool]} that prepares the website before it can be shown. SimpleGit cannot do that preparation automatically yet.`,
    };
  }

  const startsServer = /\bnode\s+\S+|nodemon|ts-node|tsx\s/.test(scripts.start || '') && !has('index.html');
  if (serverDeps.length || startsServer) {
    if (has('index.html') || has('docs/index.html')) {
      const path = has('index.html') ? '/' : '/docs';
      return {
        kind: 'static-with-server', canPublish: true, plan: { method: 'branch', path }, htmlPages: path === '/' ? htmlPages : htmlPages.filter((p) => p.startsWith('docs/')),
        reason: 'This project has web pages that GitHub Pages can show.',
        caution: 'It also seems to have a part that runs on a server. Anything that depends on that part (such as saving data or logging in) will not work on GitHub Pages.',
      };
    }
    return serverReason('JavaScript');
  }
  if (otherServer.length && !has('index.html')) return serverReason(otherServer[0]);

  // Plain web pages.
  if (has('index.html') || has('index.htm')) {
    return { kind: 'static-root', canPublish: true, plan: { method: 'branch', path: '/' }, htmlPages,
      reason: 'This project is made of ordinary web pages. GitHub Pages can show it as a website for free.' };
  }
  if (has('docs/index.html')) {
    return { kind: 'static-docs', canPublish: true, plan: { method: 'branch', path: '/docs' }, htmlPages: htmlPages.filter((p) => p.startsWith('docs/')),
      reason: 'This project keeps its web pages in the "docs" folder. GitHub Pages can show that folder as a website for free.' };
  }
  for (const out of ['dist', 'build', 'public', 'site', 'www']) {
    if (has(`${out}/index.html`)) {
      return { kind: 'static-folder', canPublish: true, plan: { method: 'workflow', output: out }, htmlPages: [],
        reason: `This project keeps its finished website in the "${out}" folder. SimpleGit can publish that folder.` };
    }
  }
  if (htmlRoot.length || htmlPages.length) {
    return { kind: 'static-pages', canPublish: true, plan: { method: 'branch', path: '/' }, htmlPages,
      reason: `This project has ${htmlPages.length === 1 ? 'a web page' : `${htmlPages.length} web pages`}. GitHub Pages can show ${htmlPages.length === 1 ? 'it' : 'them'} for free. Each page will get its own link.` };
  }
  if (otherServer.length) return serverReason(otherServer[0]);
  if (files.some((p) => /\.(md|markdown)$/i.test(p))) {
    return { kind: 'writing', canPublish: true, plan: { method: 'branch', path: '/' }, htmlPages: [],
      reason: 'This project is mostly writing, not an app. GitHub Pages can turn the writing into a simple website.' };
  }
  return { kind: 'unknown', canPublish: false, askClaude: true,
    reason: 'SimpleGit could not find any web pages in this project, so it cannot be shown as a website yet.' };
}

// GitHub Actions instructions that build the project and publish it.
export function publishWorkflow({ branch, repo, owner, plan }) {
  const base = repo.toLowerCase() === `${owner.toLowerCase()}.github.io` ? '/' : `/${repo}/`;
  const install = '      - name: Install\n        run: if [ -f package-lock.json ]; then npm ci; else npm install; fi\n';
  let steps = '';
  if (plan.build === 'vite') {
    steps = `      - uses: actions/setup-node@v4\n        with:\n          node-version: 20\n${install}      - name: Build\n        run: npx vite build --base=${base} --outDir dist\n      - name: Allow page refreshes\n        run: cp dist/index.html dist/404.html\n`;
  } else if (plan.build === 'cra') {
    steps = `      - uses: actions/setup-node@v4\n        with:\n          node-version: 20\n${install}      - name: Build\n        run: npm run build\n        env:\n          PUBLIC_URL: ${base}\n          CI: false\n`;
  }
  return `# Made by SimpleGit. This tells GitHub how to publish this project as a website.
name: Publish website
on:
  push:
    branches: [${JSON.stringify(branch)}]
  workflow_dispatch:
permissions:
  contents: read
  pages: write
  id-token: write
concurrency:
  group: pages
  cancel-in-progress: true
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
${steps}      - uses: actions/upload-pages-artifact@v3
        with:
          path: ${plan.output}
  publish:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: \${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
`;
}

// ---------- Website checking ----------

function isPrivateIp(ip) {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split('.').map(Number);
    return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31)
      || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224;
  }
  const low = ip.toLowerCase();
  return low === '::1' || low === '::' || low.startsWith('fc') || low.startsWith('fd') || low.startsWith('fe80')
    || (low.startsWith('::ffff:') && isPrivateIp(low.slice(7)));
}

// Visits a website address to see whether it loads. Refuses private network
// addresses so the checker cannot be misused to probe the server's network.
export async function checkWebsite(url) {
  let u;
  try { u = new URL(url); } catch { return { working: false, why: 'not a web address' }; }
  if (!config.allowLocalSiteCheck) {
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return { working: false, why: 'not a web address' };
    try {
      const addrs = await dns.lookup(u.hostname, { all: true });
      if (!addrs.length || addrs.some((a) => isPrivateIp(a.address))) return { working: null, why: 'cannot check this address' };
    } catch { return { working: false, why: 'address not found' }; }
  }
  try {
    const res = await fetch(u, { method: 'GET', redirect: 'follow', signal: AbortSignal.timeout(8000), headers: { 'User-Agent': 'SimpleGit website check' } });
    res.body?.cancel().catch(() => {});
    return { working: res.ok, status: res.status };
  } catch {
    return { working: false, why: 'no answer' };
  }
}
