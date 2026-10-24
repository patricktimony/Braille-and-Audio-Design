// Share a Project: send a link, invite helpers, or (with clear permission)
// make a private project public.
import { h, api, uid, copyText, canShare, shareThing, confirmAction, announce } from './ui.js';
import {
  state, page, loading, errorPage, showStatus, showError, getProject, projectLine, projectHash, menuItem,
  setFlash, go, rerender, forgetProjectCache, visibilityText,
} from './core.js';

const enc = encodeURIComponent;
const apiBase = (o, r) => `/projects/${enc(o)}/${enc(r)}`;

// A read-only link with Copy and Share buttons, plus email and text message.
export function linkSharer({ label, url, shareTitle, shareText, copyLabel = 'Copy Link', shareLabel = 'Share Link' }) {
  const id = uid('link');
  const input = h('input', { type: 'text', id, value: url, readonly: true, onfocus: (e) => e.target.select() });
  const buttons = [
    h('button', { type: 'button', class: 'btn primary', onclick: async () => {
      const ok = await copyText(url);
      if (ok) showStatus({ type: 'success', title: 'Link copied', message: 'You can now paste it into a message or an email.' });
      else { input.focus(); input.select(); showStatus({ type: 'warning', title: 'The link could not be copied automatically', message: 'The link is now selected in the box. Copy it using your device\'s Copy command.' }); }
    } }, h('span', { 'aria-hidden': 'true' }, '📋 '), copyLabel),
  ];
  if (canShare()) {
    buttons.push(h('button', { type: 'button', class: 'btn', onclick: async () => {
      const r = await shareThing({ title: shareTitle, text: shareText, url });
      if (r === 'shared') showStatus({ type: 'success', title: 'Shared' });
      else if (r === 'failed') showStatus({ type: 'warning', title: 'Sharing did not work', message: 'Use Copy Link instead, then paste it into a message.' });
    } }, h('span', { 'aria-hidden': 'true' }, '📤 '), shareLabel));
  }
  const body = `${shareText} ${url}`;
  buttons.push(
    h('a', { class: 'btn', href: `mailto:?subject=${enc(shareTitle)}&body=${enc(body)}` }, h('span', { 'aria-hidden': 'true' }, '✉️ '), 'Send by Email'),
    h('a', { class: 'btn', href: `sms:?&body=${enc(body)}` }, h('span', { 'aria-hidden': 'true' }, '💬 '), 'Send by Text Message'),
  );
  return h('div', { class: 'link-box' },
    h('div', { class: 'field' }, h('label', { for: id }, label), input),
    h('div', { class: 'button-row' }, buttons));
}

async function loadSharing(owner, repo, back) {
  const nav = state.nav;
  try {
    const data = await api('GET', `${apiBase(owner, repo)}/sharing`);
    return nav === state.nav ? data : null;
  } catch (err) {
    if (nav === state.nav) errorPage(err, back);
    return null;
  }
}

export async function shareScreen(owner, repo, sub) {
  if (sub === 'see') return shareSee(owner, repo);
  if (sub === 'help') return shareHelp(owner, repo);
  if (sub === 'public') return makePublic(owner, repo);
  loading();
  const nav = state.nav;
  let p;
  try { p = await getProject(owner, repo, { fresh: true }); } catch (err) { if (nav === state.nav) errorPage(err); return; }
  if (nav !== state.nav) return;
  page({
    title: 'Share a Project',
    instruction: 'Choose how you want to share.',
    back: projectHash(owner, repo),
    body: [
      projectLine(p),
      h('p', {}, visibilityText(p)),
      h('ul', { class: 'menu' },
        menuItem({ label: 'A. Let someone see my project', desc: 'Get a link to send. They can look, but not change anything.', icon: '👀', href: projectHash(owner, repo, 'share/see') }),
        menuItem({ label: 'B. Let someone help work on my project', desc: 'Invite a person so they can make changes too.', icon: '🧑‍🤝‍🧑', href: projectHash(owner, repo, 'share/help') })),
      h('p', {}, 'Want people to use your app or website, not just see the files? Use ', h('a', { href: projectHash(owner, repo, 'try') }, 'Try My Project'), ' instead.'),
    ],
  });
}

async function shareSee(owner, repo) {
  loading();
  const back = projectHash(owner, repo, 'share');
  const data = await loadSharing(owner, repo, back);
  if (!data) return;
  const p = data.project;
  const body = [projectLine(p)];
  const websiteSection = data.website ? [
    h('h2', {}, 'Your project also has a website'),
    h('p', {}, 'If you want people to use your app, send them the website link instead. It opens your project as a working website.'),
    linkSharer({ label: 'Website link', url: data.website, shareTitle: p.name, shareText: `Try my project "${p.name}":`, copyLabel: 'Copy Website Link', shareLabel: 'Share Website' }),
  ] : [];

  if (!p.private) {
    body.push(
      h('h2', {}, 'Your project link'),
      linkSharer({ label: 'Project link', url: p.link, shareTitle: p.name, shareText: `Here is my project "${p.name}" on GitHub:` }),
      h('h2', {}, 'What they will see'),
      h('ul', {},
        h('li', {}, 'A page on GitHub\'s website showing your project\'s files and its description.'),
        h('li', {}, 'They can read and download the files.'),
        h('li', {}, 'They cannot change anything.'),
        h('li', {}, 'They do not need a GitHub account.')),
      ...websiteSection);
    page({ title: 'Let someone see my project', kicker: 'Share a Project', instruction: 'Press Copy Link, then paste the link into a message.', back, body });
    return;
  }

  body.push(
    h('div', { class: 'status warning' },
      h('p', { class: 'status-title' }, h('span', { 'aria-hidden': 'true' }, '🔒 '), 'Please note: this project is private'),
      h('p', {}, 'Only you and the people you invite can see it. If you send its link to anyone else, they will only see a "Page not found" message.')),
    h('h2', {}, 'Your choices'),
    h('ul', { class: 'menu' },
      menuItem({ label: 'Invite the person', desc: 'They will need a free GitHub account. The project stays private.', icon: '✉️', href: projectHash(owner, repo, 'share/help') }),
      p.isAdmin ? menuItem({ label: 'Make my project public', desc: 'Anyone with the link could see it. SimpleGit checks it for passwords first and asks you to confirm.', icon: '🌍', href: projectHash(owner, repo, 'share/public') }) : ''),
    ...websiteSection,
    h('h2', {}, 'Link for people you have already invited'),
    linkSharer({ label: 'Project link', url: p.link, shareTitle: p.name, shareText: `Here is my project "${p.name}" on GitHub:` }));
  page({ title: 'Let someone see my project', kicker: 'Share a Project', instruction: 'This project is private. Choose how to let someone see it.', back, body });
}

// ----- Invite helpers -----

async function shareHelp(owner, repo) {
  loading();
  const back = projectHash(owner, repo, 'share');
  const data = await loadSharing(owner, repo, back);
  if (!data) return;
  const p = data.project;
  if (!p.isAdmin) {
    page({ title: 'Let someone help work on my project', kicker: 'Share a Project', instruction: 'Only the owner can invite helpers.', back, body: [
      projectLine(p), h('p', {}, `This project belongs to ${p.owner}. Ask them to invite the person.`)] });
    return;
  }

  const id = uid('username');
  const err = h('p', { class: 'field-error', id: `${id}-err` });
  const input = h('input', { type: 'text', id, autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false', 'aria-describedby': `${id}-hint ${id}-err` });
  const result = h('div', {});
  const findBtn = h('button', { type: 'submit', class: 'btn primary huge' }, 'Find This Person');

  async function find() {
    const name = input.value.trim().replace(/^@/, '');
    if (!name) { err.textContent = 'Please type their GitHub username.'; input.setAttribute('aria-invalid', 'true'); input.focus(); return; }
    err.textContent = ''; input.removeAttribute('aria-invalid');
    findBtn.disabled = true;
    result.replaceChildren(h('p', { class: 'loading' }, 'Looking for this person…'));
    announce('Looking for this person.');
    try {
      const { person } = await api('GET', `/people/${enc(name)}`);
      findBtn.disabled = false;
      if (person.isOrg) {
        result.replaceChildren();
        err.textContent = `"${person.login}" is an organization, not a person. Please ask for the person's own username.`;
        input.setAttribute('aria-invalid', 'true');
        input.focus();
        return;
      }
      const heading = h('h2', { tabindex: '-1' }, 'Is this the right person?');
      result.replaceChildren(heading,
        h('div', { class: 'person' },
          h('img', { src: person.avatar, alt: '' }),
          h('span', {}, h('span', { class: 'person-name' }, person.name || person.login), `GitHub username: ${person.login}`)),
        h('p', {}, 'Helpers can see and change the files in this project. They cannot delete the project or invite other people.'),
        h('div', { class: 'button-row' },
          h('button', { type: 'button', class: 'btn primary', onclick: (e) => invite(person, e.currentTarget) }, 'Yes, Send the Invitation'),
          h('button', { type: 'button', class: 'btn', onclick: () => { result.replaceChildren(); input.value = ''; input.focus(); } }, 'No, Try Again')));
      heading.focus();
    } catch (e) {
      findBtn.disabled = false;
      result.replaceChildren();
      if (e.status === 404 || e.status === 400) { err.textContent = `${e.message} ${e.next}`; input.setAttribute('aria-invalid', 'true'); input.focus(); }
      else showError(e, { retry: find });
    }
  }

  async function invite(person, btn) {
    btn.disabled = true;
    showStatus({ type: 'working', title: 'Sending the invitation…' });
    try {
      const r = await api('POST', `${apiBase(owner, repo)}/helpers`, { username: person.login });
      if (r.alreadyHelping) {
        setFlash({ type: 'success', title: `${person.login} can already help`, message: 'They already have permission to work on this project.' });
      } else {
        setFlash({
          type: 'success', title: `Invitation sent to ${person.login}`,
          message: 'GitHub will email them. They must accept the invitation before they can help. You can also send them this message:',
          extra: linkSharer({ label: 'Invitation link', url: r.invitationLink, shareTitle: `Help with my project "${p.name}"`, shareText: `I've invited you to help with my project "${p.name}" on GitHub. To accept, open this link:`, copyLabel: 'Copy Invitation Link', shareLabel: 'Share Invitation' }),
        });
      }
      go(projectHash(owner, repo, 'share/help'));
    } catch (e) { btn.disabled = false; showError(e); }
  }

  const people = data.helpers.length ? h('ul', { class: 'items' }, data.helpers.map((hp) => h('li', {}, h('div', { class: 'person' },
    h('img', { src: hp.avatar, alt: '' }),
    h('span', { style: 'flex:1' }, h('span', { class: 'person-name' }, hp.login), 'Can help'),
    h('button', { type: 'button', class: 'btn small-btn', onclick: () => removeHelper(hp.login) }, `Stop sharing with ${hp.login}`)))))
    : h('p', {}, 'Nobody else is helping yet.');
  const invites = data.invites.length ? h('ul', { class: 'items' }, data.invites.map((inv) => h('li', {}, h('div', { class: 'person' },
    h('span', { style: 'flex:1' }, h('span', { class: 'person-name' }, inv.login), 'Has not answered yet'),
    h('button', { type: 'button', class: 'btn small-btn', onclick: () => cancelInvite(inv) }, `Cancel invitation for ${inv.login}`))))) : null;

  async function removeHelper(login) {
    const ok = await confirmAction({ title: `Stop sharing with ${login}?`, message: [`${login} will no longer be able to change this project${p.private ? ' or see it' : ''}.`, 'You can invite them again later.'], no: 'No, Keep Sharing', yes: 'Yes, Stop Sharing', danger: true });
    if (!ok) return;
    try {
      await api('DELETE', `${apiBase(owner, repo)}/helpers/${enc(login)}`);
      setFlash({ type: 'success', title: `${login} can no longer help` });
      rerender();
    } catch (e) { showError(e); }
  }
  async function cancelInvite(inv) {
    const ok = await confirmAction({ title: `Cancel the invitation for ${inv.login}?`, message: 'They will not be able to accept it any more.', no: 'No, Keep It', yes: 'Yes, Cancel It', danger: true });
    if (!ok) return;
    try {
      await api('DELETE', `${apiBase(owner, repo)}/invites/${inv.id}`);
      setFlash({ type: 'success', title: 'The invitation was cancelled' });
      rerender();
    } catch (e) { showError(e); }
  }

  page({
    title: 'Let someone help work on my project', kicker: 'Share a Project',
    instruction: 'Type the person\'s GitHub username. Then press Find This Person.',
    back,
    body: [projectLine(p),
      h('form', { onsubmit: (e) => { e.preventDefault(); find(); }, novalidate: true },
        h('div', { class: 'field' },
          h('label', { for: id }, 'Their GitHub username'),
          h('p', { class: 'hint', id: `${id}-hint` }, 'Ask the person for it. If they do not have a GitHub account, they can make one for free at github.com/signup.'),
          err, input),
        findBtn),
      result,
      h('h2', {}, 'People who can help now'), people,
      invites ? h('h2', {}, 'Invitations waiting for an answer') : '', invites || ''],
  });
}

// ----- Make public (only with clear permission) -----

async function makePublic(owner, repo) {
  loading('Checking your project for passwords and keys…');
  const back = projectHash(owner, repo, 'share/see');
  const nav = state.nav;
  let p; let scan;
  try {
    p = await getProject(owner, repo, { fresh: true });
    if (!p.private) { setFlash({ type: 'info', title: 'This project is already public' }); go(back); return; }
    scan = await api('GET', `${apiBase(owner, repo)}/safety-check`);
  } catch (err) { if (nav === state.nav) errorPage(err, back); return; }
  if (nav !== state.nav) return;

  const blockers = scan.findings.filter((f) => f.level === 'block');
  const checks = scan.findings.filter((f) => f.level !== 'block');
  const body = [projectLine(p), h('h2', {}, 'Safety check')];
  body.push(...safetyReport(scan, owner, repo));
  if (blockers.length) {
    page({ title: 'Make my project public', kicker: 'Share a Project', instruction: 'This project cannot be made public until the private files are removed.', back, body });
    return;
  }
  const understand = h('input', { type: 'checkbox', id: uid('ok') });
  const checked = checks.length ? h('input', { type: 'checkbox', id: uid('ok') }) : null;
  const err = h('p', { class: 'field-error', 'aria-live': 'assertive' });
  body.push(
    h('h2', {}, 'What will happen'),
    h('ul', {},
      h('li', {}, 'Anyone on the internet will be able to see and download every file in this project.'),
      h('li', {}, 'They will also be able to see older versions of the files.'),
      h('li', {}, 'Nobody can change your files unless you invite them.'),
      h('li', {}, 'You can make it private again later on GitHub, but people may already have copied it.')),
    err,
    checked ? h('label', { class: 'check' }, checked, h('span', {}, 'I have checked the files listed above, and they are safe to share.')) : '',
    h('label', { class: 'check' }, understand, h('span', {}, 'I understand that everyone will be able to see this project.')),
    h('button', { type: 'button', class: 'btn danger huge', onclick: async (e) => {
      if (checked && !checked.checked) { err.textContent = 'Please tick the box to confirm you checked the files.'; checked.focus(); return; }
      if (!understand.checked) { err.textContent = 'Please tick the box to confirm you understand.'; understand.focus(); return; }
      err.textContent = '';
      const btn = e.currentTarget;
      btn.disabled = true;
      showStatus({ type: 'working', title: 'Making your project public…' });
      try {
        await api('POST', `${apiBase(owner, repo)}/make-public`, { confirm: 'make-public', secretsChecked: Boolean(checked?.checked) });
        forgetProjectCache(owner, repo);
        setFlash({ type: 'success', title: 'Your project is now public', message: 'Anyone with the link can now see it.' });
        go(back);
      } catch (e2) { btn.disabled = false; showError(e2); }
    } }, 'Make My Project Public'),
    h('div', { class: 'button-row' }, h('a', { class: 'btn', href: back }, 'Keep It Private')));
  page({ title: 'Make my project public', kicker: 'Share a Project', instruction: 'Read what will happen. If you agree, tick both boxes and press Make My Project Public.', back, body });
}

// Plain-English results of the password and key check.
export function safetyReport(scan, owner, repo) {
  const out = [];
  const blockers = scan.findings.filter((f) => f.level === 'block');
  const checks = scan.findings.filter((f) => f.level !== 'block');
  if (!scan.findings.length) {
    out.push(h('p', {}, h('span', { 'aria-hidden': 'true' }, '✅ '), `No passwords or keys were found. SimpleGit looked through ${scan.scanned} ${scan.scanned === 1 ? 'file' : 'files'}.`));
    if (!scan.complete) out.push(h('p', {}, 'This project is large, so not every file could be checked. Please make sure it does not contain any passwords.'));
    return out;
  }
  const list = (items) => h('ul', {}, items.map((f) => h('li', {},
    h('a', { href: projectHash(owner, repo, 'changefile', f.path) }, f.path), ` — ${f.why}`)));
  if (blockers.length) {
    out.push(h('div', { class: 'status error' },
      h('p', { class: 'status-title' }, h('span', { 'aria-hidden': 'true' }, '⚠️ '), 'Problem: private information was found'),
      h('p', {}, 'These files look like they contain passwords or secret keys. For your safety, SimpleGit will not make them public:'),
      list(blockers),
      h('p', {}, h('strong', {}, 'What you can do: '), 'Delete these files (choose a file name above, then Delete it). Older versions are still kept by GitHub, so if a real password or key was in a file, also change that password or key with the company that gave it to you. If you made this project with Claude Code, you can ask it to "remove all secrets and API keys from this project".')));
  }
  if (checks.length) {
    out.push(h('div', { class: 'status warning' },
      h('p', { class: 'status-title' }, h('span', { 'aria-hidden': 'true' }, '❗ '), 'Please check these files'),
      h('p', {}, 'These might contain private information. Some keys are meant to be public, but please make sure:'),
      list(checks)));
  }
  return out;
}
