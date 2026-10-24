// Try My Project: find a working website, or publish the project with
// GitHub Pages when that is appropriate, and help share the link.
import { h, api, uid, copyText, announce } from './ui.js';
import { state, page, loading, errorPage, showStatus, showError, projectLine, projectHash, setFlash, go, rerender } from './core.js';
import { linkSharer, safetyReport } from './screens-share.js';

const enc = encodeURIComponent;
const apiBase = (o, r) => `/projects/${enc(o)}/${enc(r)}`;
const cache = new Map();

async function loadTry(owner, repo, back, { useCache = false } = {}) {
  const key = `${owner}/${repo}`.toLowerCase();
  if (useCache && cache.has(key)) return cache.get(key);
  loading('Checking your project. This can take up to a minute…');
  const nav = state.nav;
  try {
    const data = await api('GET', `${apiBase(owner, repo)}/try`);
    cache.set(key, data);
    return nav === state.nav ? data : null;
  } catch (err) {
    if (nav === state.nav) errorPage(err, back);
    return null;
  }
}

// Links to each web page of a published site.
function pageLinks(site, analysis) {
  if (site.kind !== 'pages' || !analysis?.htmlPages?.length) return [];
  const base = site.url.endsWith('/') ? site.url : `${site.url}/`;
  const docs = analysis.plan?.path === '/docs';
  return analysis.htmlPages.map((path) => {
    let rel = docs ? path.replace(/^docs\//, '') : path;
    rel = rel.replace(/(^|\/)index\.html?$/i, '$1');
    return { label: rel ? rel.replace(/\/$/, '').replace(/\.html?$/i, '') : 'Main page', url: base + rel.split('/').map(enc).join('/') };
  });
}

function mainUrl(site, analysis) {
  const links = pageLinks(site, analysis);
  const hasIndex = links.some((l) => l.label === 'Main page');
  if (!hasIndex && links.length === 1) return links[0].url;
  return site.url;
}

function copyBox(text, label) {
  const id = uid('prompt');
  return h('div', {},
    h('p', { class: 'copy-box', id }, text),
    h('button', { type: 'button', class: 'btn', 'aria-describedby': id, onclick: async () => {
      const ok = await copyText(text);
      showStatus(ok ? { type: 'success', title: 'Copied', message: 'Now paste it into Claude Code.' } : { type: 'warning', title: 'Could not copy', message: 'Please select the text and copy it yourself.' });
    } }, h('span', { 'aria-hidden': 'true' }, '📋 '), label));
}

const CLAUDE_STATIC = 'Please change this project so it works as a website on GitHub Pages: plain HTML, CSS and JavaScript, with an index.html file in the top folder, and no server. Do not include any passwords or API keys.';
const CLAUDE_SERVER = 'Can this project be changed to work without a server, so it can be published for free on GitHub Pages? If not, please explain in simple words which hosting service you recommend, what it would cost, and walk me through it one step at a time. Do not include any passwords or API keys in the project.';

export async function tryScreen(owner, repo, sub) {
  if (sub === 'publish') return publishConfirm(owner, repo);
  if (sub === 'progress') return publishProgress(owner, repo);
  const back = projectHash(owner, repo);
  const data = await loadTry(owner, repo, back);
  if (!data) return;
  const { project: p, site, analysis } = data;
  const body = [projectLine(p)];

  // 1. Already working on the internet.
  if (site?.working) {
    const url = mainUrl(site, analysis);
    const links = pageLinks(site, analysis);
    body.push(
      h('div', { class: 'status success' }, h('p', { class: 'status-title' }, h('span', { 'aria-hidden': 'true' }, '✅ '), 'Good news: your project is working on the internet'),
        h('p', {}, 'Anyone with the link can use it. They do not need a GitHub account.')),
      h('a', { class: 'btn primary huge', href: url, target: '_blank', rel: 'noopener' }, h('span', { 'aria-hidden': 'true' }, '▶️ '), 'Open My Project', h('span', { class: 'visually-hidden' }, ' (opens in a new tab)')),
      h('p', {}, 'It opens in a new tab.'),
      h('h2', {}, 'Send it to someone'),
      linkSharer({ label: 'Website link', url, shareTitle: p.name, shareText: `Try my project "${p.name}":`, copyLabel: 'Copy Website Link', shareLabel: 'Share Website' }));
    if (links.length > 1) {
      body.push(h('h2', {}, 'All the pages'), h('p', {}, 'Your website has several pages. Each one has its own link:'),
        h('ul', {}, links.map((l) => h('li', {}, h('a', { href: l.url, target: '_blank', rel: 'noopener' }, l.label, h('span', { class: 'visually-hidden' }, ' (opens in a new tab)'))))));
    }
    if (site.kind === 'pages') {
      body.push(h('h2', {}, 'Good to know'), h('ul', {},
        h('li', {}, 'When you save changes in SimpleGit, the website updates by itself within a few minutes.'),
        h('li', {}, 'The website is published for free by GitHub Pages.')));
    }
    page({ title: 'Try My Project', instruction: 'Press Open My Project to use it. Press Copy Website Link to send it to someone.', back, body });
    return;
  }

  // 2. A website was set up but is not loading.
  if (site && !site.working) {
    const building = site.kind === 'pages' && site.status !== 'errored';
    body.push(h('div', { class: 'status warning' },
      h('p', { class: 'status-title' }, h('span', { 'aria-hidden': 'true' }, '❗ '), building ? 'Your website is set up, but it is not loading yet' : 'Your website link is not working right now'),
      h('p', {}, building
        ? 'GitHub may still be preparing it. This usually takes a few minutes after a change.'
        : `The project points to ${site.url}, but that address did not load.`),
      h('div', { class: 'button-row' },
        h('button', { type: 'button', class: 'btn primary', onclick: rerender }, 'Check Again'),
        h('a', { class: 'btn', href: site.url, target: '_blank', rel: 'noopener' }, 'Try Opening It Anyway', h('span', { class: 'visually-hidden' }, ' (opens in a new tab)')))));
  } else {
    body.push(h('p', {}, h('strong', {}, 'Right now, this project is stored on GitHub, but it is not yet a working website. '),
      'People can see its files, but they cannot use it.'));
  }

  // 3. Can it be published with GitHub Pages?
  if (analysis.canPublish) {
    body.push(h('h2', {}, site ? 'Publish it again' : 'Good news: it can be published'), h('p', {}, analysis.reason));
    if (analysis.caution) body.push(h('p', {}, h('strong', {}, 'Please note: '), analysis.caution));
    if (!data.canPublishHere) {
      body.push(h('p', {}, `Only the owner (${p.owner}) can publish this project. Ask them to use Try My Project.`));
    } else {
      body.push(h('p', {}, 'SimpleGit can publish it for free using GitHub Pages, a service from GitHub. You will be asked to confirm first.'));
      if (p.private) body.push(h('p', {}, h('strong', {}, 'Your project is private. '), 'On a free GitHub account, only public projects can be published. If that is the case, SimpleGit will explain your choices.'));
      body.push(h('a', { class: 'btn primary huge', href: projectHash(owner, repo, 'try/publish') }, h('span', { 'aria-hidden': 'true' }, '🚀 '), 'Publish My Project'));
    }
    page({ title: 'Try My Project', instruction: data.canPublishHere ? 'Press Publish My Project to make it a working website.' : 'Only the owner can publish this project.', back, body });
    return;
  }

  // 4. Cannot be published on GitHub Pages: explain honestly.
  body.push(h('h2', {}, 'Why it cannot be published here'), h('p', {}, analysis.reason));
  if (analysis.hosting) {
    body.push(
      h('h2', {}, 'Other ways to put it online'),
      h('p', {}, 'Projects like this need a company that keeps them running on a server. Some well-known ones are:'),
      h('ul', {},
        h('li', {}, h('strong', {}, 'Render'), ' – has a free plan for small apps. Free apps can be slow to start after nobody has used them for a while.'),
        h('li', {}, h('strong', {}, 'Railway'), ' – simple to use. Usually costs a few dollars a month after a free trial.'),
        h('li', {}, h('strong', {}, 'Vercel'), ' or ', h('strong', {}, 'Netlify'), ' – free for personal projects, and good for apps built with tools like Next.js.')),
      h('p', {}, 'Prices and free plans change, so check their websites. ', h('strong', {}, 'SimpleGit will not connect to any of these companies, or sign you up for anything that costs money, without asking you first.')),
    );
  }
  body.push(h('h2', {}, 'Made this with Claude Code?'),
    h('p', {}, 'You can ask Claude Code to help. Copy this request and paste it into Claude Code:'),
    copyBox(analysis.hosting ? CLAUDE_SERVER : CLAUDE_STATIC, 'Copy This Request'),
    h('p', {}, 'After Claude Code saves its changes to GitHub, come back here and press Try My Project again.'));
  if (analysis.details) body.push(h('details', {}, h('summary', {}, 'Show technical details'), h('p', {}, analysis.details)));
  page({ title: 'Try My Project', instruction: 'This project cannot become a website on GitHub Pages yet. Read why below.', back, body });
}

// ----- Confirm before publishing -----

async function publishConfirm(owner, repo) {
  const back = projectHash(owner, repo, 'try');
  const data = await loadTry(owner, repo, back, { useCache: true });
  if (!data) return;
  const { project: p, analysis, safety } = data;
  if (!analysis.canPublish || !data.canPublishHere) { go(back); return; }
  const isUserSite = p.name.toLowerCase() === `${p.owner.toLowerCase()}.github.io`;
  const future = isUserSite ? `https://${p.owner.toLowerCase()}.github.io/` : `https://${p.owner.toLowerCase()}.github.io/${p.name}/`;
  const plan = analysis.plan;
  const whatIsPublic = plan.method === 'branch'
    ? (plan.path === '/docs' ? 'Everything in the "docs" folder can be seen by visitors.' : 'Every file in this project can be seen by visitors to the website, not only the pages.')
    : 'Only the finished app is published, not your working files.';

  const body = [projectLine(p),
    h('h2', {}, 'What publishing does'),
    h('ul', {},
      h('li', {}, 'GitHub turns your project into a website with its own link.'),
      h('li', {}, 'The link will be: ', h('strong', {}, future)),
      h('li', {}, 'Whenever you save changes, the website updates by itself within a few minutes.'),
      plan.method === 'workflow' ? h('li', {}, 'SimpleGit adds one small instruction file to your project (in the ".github" folder) that tells GitHub how to prepare your app.') : '',
      h('li', {}, 'It is free.')),
    h('h2', {}, 'What becomes public'),
    h('ul', {},
      h('li', {}, 'Anyone who has the link can visit the website. Search engines like Google may find it too.'),
      h('li', {}, whatIsPublic),
      p.private ? h('li', {}, 'Your project is private. On a free GitHub account, GitHub only publishes public projects, so this may not work until the project is made public.') : '')];

  body.push(h('h2', {}, 'Safety check'));
  const scan = safety || { findings: [], scanned: 0, complete: true };
  body.push(...safetyReport(scan, owner, repo));
  const blockers = scan.findings.filter((f) => f.level === 'block');
  if (blockers.length) {
    page({ title: 'Publish My Project', instruction: 'This project cannot be published until the private files are removed.', back, body });
    return;
  }
  const needsCheck = scan.findings.length > 0;
  const ok = h('input', { type: 'checkbox' });
  const checked = needsCheck ? h('input', { type: 'checkbox' }) : null;
  const err = h('p', { class: 'field-error', 'aria-live': 'assertive' });
  body.push(err,
    checked ? h('label', { class: 'check' }, checked, h('span', {}, 'I have checked the files listed above, and they are safe to publish.')) : '',
    h('label', { class: 'check' }, ok, h('span', {}, 'I understand that anyone with the link will be able to visit this website.')),
    h('button', { type: 'button', class: 'btn primary huge', onclick: async (e) => {
      if (checked && !checked.checked) { err.textContent = 'Please tick the box to confirm you checked the files.'; checked.focus(); return; }
      if (!ok.checked) { err.textContent = 'Please tick the box to confirm you understand.'; ok.focus(); return; }
      err.textContent = '';
      const btn = e.currentTarget;
      btn.disabled = true;
      showStatus({ type: 'working', title: 'Starting to publish…' });
      try {
        await api('POST', `${apiBase(owner, repo)}/publish`, { confirm: true, secretsChecked: Boolean(checked?.checked) });
        cache.delete(`${owner}/${repo}`.toLowerCase());
        go(projectHash(owner, repo, 'try/progress'));
      } catch (e2) {
        btn.disabled = false;
        if (e2.code === 'private-plan') {
          showStatus({
            type: 'error', title: e2.title, message: e2.message, next: e2.next,
            actions: [
              h('a', { class: 'btn primary', href: projectHash(owner, repo, 'share/public') }, 'Make My Project Public'),
              h('a', { class: 'btn', href: back }, 'Keep It Private'),
            ],
          });
        } else showError(e2);
      }
    } }, h('span', { 'aria-hidden': 'true' }, '🚀 '), 'Yes, Publish My Project'),
    h('div', { class: 'button-row' }, h('a', { class: 'btn', href: back }, 'Not Now')));
  page({ title: 'Publish My Project', instruction: 'Read what will happen. If you agree, tick the box and press Yes, Publish My Project.', back, body });
}

// ----- Wait for the website and check it works -----

async function publishProgress(owner, repo) {
  const back = projectHash(owner, repo, 'try');
  const steps = [
    { title: 'Turning on the website', wait: '' },
    { title: 'GitHub prepares your website', wait: 'This usually takes 1 to 3 minutes.' },
    { title: 'Checking that the website works', wait: 'It can take a few more minutes to reach the whole internet.' },
  ];
  const list = h('ol', { class: 'steps' });
  const timeEl = h('p', {});
  const started = Date.now();
  const nav = state.nav;
  let lastAnnounced = '';

  function draw(active, failed = false) {
    list.replaceChildren(...steps.map((s, i) => {
      const status = i < active ? 'done' : i === active ? (failed ? 'failed' : 'active') : 'waiting';
      const label = { done: '✅ Done', active: '⏳ Working on it now', failed: '⚠️ Did not work', waiting: '○ Waiting' }[status];
      return h('li', { class: status }, h('span', { class: 'step-state' }, `Step ${i + 1} of 3: ${label}`), s.title, status === 'active' && s.wait ? h('span', { style: 'display:block' }, s.wait) : '');
    }));
  }
  draw(0);
  page({
    title: 'Publishing your project', kicker: 'Try My Project',
    instruction: 'Please wait. You can stay on this page. SimpleGit will tell you when it is ready.',
    back,
    body: [h('div', { 'aria-live': 'off' }, list), timeEl],
  });

  async function tick() {
    if (nav !== state.nav) return; // the person left this screen
    const minutes = Math.floor((Date.now() - started) / 60000);
    timeEl.textContent = minutes ? `Time so far: about ${minutes} ${minutes === 1 ? 'minute' : 'minutes'}.` : 'Time so far: less than a minute.';
    let s;
    try { s = await api('GET', `${apiBase(owner, repo)}/publish-status`); } catch (err) {
      if (nav !== state.nav) return;
      if (err.status === 401) { showError(err); return; }
      setTimeout(tick, 10000);
      return;
    }
    if (nav !== state.nav) return;
    const say = (text) => { if (text !== lastAnnounced) { lastAnnounced = text; announce(text); } };
    if (s.state === 'live') {
      draw(3);
      setFlash({ type: 'success', title: 'Your project is published', message: 'It is now a working website. Press Open My Project to try it.' });
      go(back);
      return;
    }
    if (s.state === 'failed') {
      draw(1, true);
      showStatus({
        type: 'error', title: 'The website could not be published', message: s.message,
        next: 'If you made this project with Claude Code, ask it: "GitHub Pages could not publish this project. Please find and fix the problem." Then press Try Again.',
        actions: [
          h('a', { class: 'btn primary', href: projectHash(owner, repo, 'try/publish') }, 'Try Again'),
          h('a', { class: 'btn', href: back }, 'Back to Try My Project'),
        ],
      });
      return;
    }
    if (s.state === 'checking') { draw(2); say('Step 3 of 3: checking that the website works.'); }
    else if (s.state === 'building') { draw(1); say('Step 2 of 3: GitHub is preparing your website.'); }
    if (Date.now() - started > 10 * 60000) {
      showStatus({
        type: 'warning', title: 'This is taking longer than usual',
        message: 'GitHub is still working on it. You can leave this page; publishing carries on without you.',
        next: 'Come back to Try My Project in a few minutes.',
        actions: [h('button', { type: 'button', class: 'btn primary', onclick: rerender }, 'Keep Waiting')],
      });
      return;
    }
    setTimeout(tick, 5000);
  }
  setTimeout(tick, 1500);
}
