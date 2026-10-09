'use strict';
// Home, sign-in, preferences, profiles, search, and information pages.

const { html, prose } = require('../html');
const v = require('../views');
const auth = require('../auth');
const { DEMO_PASSWORD, defaultPrefs } = require('../seed');
const { searchKb, searchLessons, searchAllCommands } = require('../search');
const { INTEGRATIONS } = require('../integrations');
const { HttpError } = require('../errors');

const DEMO_MODE = process.env.LAN_DEMO_MODE !== 'off';

const PREF_OPTIONS = {
  screenReader: [['jaws', 'JAWS'], ['nvda', 'NVDA'], ['narrator', 'Windows Narrator'], ['voiceover', 'VoiceOver (Mac or iPhone)'], ['magnifier', 'Screen magnifier only (for example ZoomText)'], ['none', 'I do not use a screen reader'], ['other', 'Something else']],
  textSize: [['100', 'Standard'], ['125', 'Large (125%)'], ['150', 'Larger (150%)'], ['200', 'Largest (200%)']],
  contrast: [['default', 'Standard: dark text on a light background'], ['high', 'High contrast: white and yellow text on black'], ['dark', 'Dark: light text on a dark gray background']],
  inputMethod: [['keyboard', 'Keyboard only'], ['keyboard-braille', 'Keyboard and a refreshable braille display'], ['mouse-keyboard', 'Mouse and keyboard'], ['touch', 'Touch screen'], ['voice-switch', 'Voice control or switch access']],
  learningStyle: [
    ['step-by-step', 'Step-by-step written instructions', 'Works with speech, braille, and print.'],
    ['hands-on', 'Hands-on practice', 'Try it on a practice page first, then on the real site.'],
    ['one-on-one', 'One-on-one with a trainer', 'We will suggest requesting a trainer with each lesson.'],
    ['audio-video', 'Listening to an audio or video lesson', 'Planned. Audio and video lessons are not available yet; we will show text lessons for now.'],
  ],
  morphicFeatures: [['text-size', 'Text size'], ['magnifier', 'Magnifier'], ['read-aloud', 'Read selected text aloud'], ['contrast', 'High contrast'], ['color-filters', 'Color vision filters'], ['dark-mode', 'Dark mode'], ['night-mode', 'Night mode']],
};

function pick(value, options, fallback) {
  return options.some(([v]) => v === value) ? value : fallback;
}

function asArray(x) { return x === undefined ? [] : [].concat(x); }

module.exports = function register(route) {
  // ---------- Welcome ----------
  route('GET', '/', (ctx) => {
    const { user, db } = ctx;
    const solvedCount = db.where('kb', (k) => (k.status || 'published') === 'published').length;
    ctx.render('Welcome', html`
      <h1>Welcome to the Library Access Network</h1>
      <p class="lead">Get help with your screen reader and computer, learn a new skill, or share what you know with patrons at other libraries.</p>
      <ul class="big-choices">
        <li><a class="big-choice" href="/help"><span class="choice-title">Get help</span>
          <span class="choice-text">Search answers from the community, ask a question, or request a trainer.</span></a></li>
        <li><a class="big-choice" href="/learn"><span class="choice-title">Learn a skill</span>
          <span class="choice-text">Short lessons for JAWS, Gmail, web pages, and forms.</span></a></li>
        <li><a class="big-choice" href="/share"><span class="choice-title">Share a tip</span>
          <span class="choice-text">Teach others something that works for you. You choose what is shared.</span></a></li>
      </ul>
      <h2>How this network works</h2>
      <ol>
        <li>You ask a question at your library, in person or here.</li>
        <li>A trainer, librarian, or another patron answers.</li>
        <li>When it is solved, you can choose to share the answer with every library in the network, with credit.</li>
      </ol>
      <p>The shared knowledge base has ${solvedCount} answers so far. Nothing is shared without the permission of the people who wrote it.</p>
      ${user ? '' : html`<h2>New here?</h2><p><a href="/demo">Follow the demonstration walkthrough</a>, or <a href="/signin">sign in with a demonstration account</a>.</p>`}
    `);
  });

  // ---------- Get help ----------
  route('GET', '/help', (ctx) => {
    ctx.render('Get help', html`
      <h1>Get help</h1>
      <p class="lead">Start by searching. Someone at another library may already have solved your problem.</p>
      ${searchForm('')}
      <h2>Other ways to get help</h2>
      <ul class="action-list">
        <li><a href="/discuss/new">Ask the community a question</a> — trainers, librarians, and other patrons can answer.</li>
        <li><a href="/requests/new">Request a trainer</a> — in person at your library or by phone.</li>
        <li><a href="/jaws">Look up a JAWS keyboard command</a></li>
        <li><a href="/libraries">Find your library's help desk hours</a> — staff can help you set up an accessible computer.</li>
      </ul>
      <h2>If JAWS is not talking</h2>
      <p>Press Ctrl to stop speech, then Insert+T to hear where you are. If there is no speech at all, ask library staff for help. Staff will not change your JAWS settings without asking you first.</p>
    `);
  });

  route('GET', '/search', (ctx) => {
    const q = (ctx.query.q || '').trim().slice(0, 200);
    const kb = q ? searchKb(q) : [];
    const lessons = q ? searchLessons(q) : [];
    const commands = q ? searchAllCommands(q).slice(0, 8) : [];
    const total = kb.length + lessons.length + commands.length;
    ctx.render(q ? `Search results for “${q}”` : 'Search', html`
      <h1>Search</h1>
      ${searchForm(q)}
      ${q ? html`
        <p id="result-count">${total} result${total === 1 ? '' : 's'} for “${q}”.</p>
        <section aria-labelledby="kb-results"><h2 id="kb-results">Community answers (${kb.length})</h2>
          ${kb.length ? kbList(kb) : html`<p>No community answers yet. <a href="/discuss/new?title=${encodeURIComponent(q)}">Ask this as a question</a>.</p>`}
        </section>
        <section aria-labelledby="lesson-results"><h2 id="lesson-results">Lessons (${lessons.length})</h2>
          ${lessons.length ? html`<ul>${lessons.map((l) => html`<li><a href="/learn/${l.id}">${l.title}</a> — ${l.summary}</li>`)}</ul>` : html`<p>No lessons matched.</p>`}
        </section>
        <section aria-labelledby="cmd-results"><h2 id="cmd-results">JAWS and Gmail commands (${commands.length})</h2>
          ${commands.length ? html`<ul>${commands.map((c) => html`<li><kbd>${c.keys}</kbd>: ${c.action}</li>`)}</ul>` : html`<p>No commands matched.</p>`}
          <p><a href="/jaws?q=${encodeURIComponent(q)}">Search the full command guide</a></p>
        </section>
        <h2>Still stuck?</h2>
        <p><a href="/discuss/new?title=${encodeURIComponent(q)}">Ask the community</a> or <a href="/requests/new?topic=${encodeURIComponent(q)}">request a trainer</a>.</p>
      ` : ''}
    `, { status: q ? `${total} results` : undefined });
  });

  // ---------- Sign in / out ----------
  route('GET', '/signin', (ctx) => signinPage(ctx, {}));

  route('POST', '/signin', (ctx) => {
    const username = String(ctx.body.username || '').trim().toLowerCase();
    const password = String(ctx.body.password || '');
    const user = ctx.db.all('users').find((u) => u.username === username);
    if (!user || !auth.verifyPassword(password, user.passwordHash)) {
      return signinPage(ctx, { username: 'Enter a correct username and password.' }, username);
    }
    ctx.res.setHeader('Set-Cookie', auth.startUserSession(ctx.session, user.id));
    const next = String(ctx.body.next || '');
    ctx.redirect(next.startsWith('/') && !next.startsWith('//') ? next : '/', `Signed in as ${user.displayName}`);
  });

  route('POST', '/signout', (ctx) => {
    auth.endSession(ctx.session);
    ctx.redirect('/', 'You are signed out');
  });

  // ---------- Preferences ----------
  route('GET', '/preferences', (ctx) => preferencesPage(ctx, {}));

  route('POST', '/preferences', (ctx) => {
    const b = ctx.body;
    const prefs = {
      screenReader: pick(b.screenReader, PREF_OPTIONS.screenReader, 'jaws'),
      textSize: pick(b.textSize, PREF_OPTIONS.textSize, '100'),
      contrast: pick(b.contrast, PREF_OPTIONS.contrast, 'default'),
      inputMethod: pick(b.inputMethod, PREF_OPTIONS.inputMethod, 'keyboard'),
      learningStyle: pick(b.learningStyle, PREF_OPTIONS.learningStyle, 'step-by-step'),
      morphicFeatures: asArray(b.morphicFeatures).filter((f) => PREF_OPTIONS.morphicFeatures.some(([v]) => v === f)),
    };
    if (ctx.user) ctx.db.update('users', ctx.user.id, { prefs });
    else ctx.session.prefs = prefs;
    ctx.redirect('/preferences', 'Preferences saved');
  });

  // ---------- Profiles ----------
  route('GET', '/me', (ctx) => {
    const user = ctx.requireUser();
    profileEditPage(ctx, user, {});
  });

  route('POST', '/me', (ctx) => {
    const user = ctx.requireUser();
    const displayName = String(ctx.body.displayName || '').trim().slice(0, 60);
    const bio = String(ctx.body.bio || '').trim().slice(0, 500);
    const skills = String(ctx.body.skills || '').split(',').map((s) => s.trim()).filter(Boolean).slice(0, 12);
    const libraryId = ctx.db.get('libraries', ctx.body.libraryId) ? ctx.body.libraryId : user.libraryId;
    if (!displayName) return profileEditPage(ctx, { ...user, bio, skills, libraryId }, { displayName: 'Enter the name you want others to see.' });
    ctx.db.update('users', user.id, { displayName, bio, skills, libraryId });
    ctx.redirect(`/people/${user.id}`, 'Profile saved');
  });

  route('GET', '/people/:id', (ctx) => {
    const person = ctx.db.get('users', ctx.params.id);
    if (!person) ctx.notFound();
    const lib = ctx.db.get('libraries', person.libraryId);
    const credits = ctx.db.where('kb', (k) => (k.status || 'published') === 'published' && k.contributors.some((c) => c.userId === person.id && !c.anonymous));
    const isMe = ctx.user && ctx.user.id === person.id;
    ctx.render(person.displayName, html`
      <h1>${person.displayName}</h1>
      <p>${v.ROLE_LABEL[person.role]} at <a href="/libraries/${lib.id}">${lib.name}</a>, ${lib.place}.${person.networkTrainer ? ' Available to patrons across the network.' : ''}</p>
      ${person.bio ? html`<h2>About</h2>${prose(person.bio)}` : ''}
      ${person.skills && person.skills.length ? html`<h2>Can help with</h2><ul>${person.skills.map((s) => html`<li>${s}</li>`)}</ul>` : ''}
      <h2>Contributions to the knowledge base (${credits.length})</h2>
      ${credits.length ? html`<ul>${credits.map((k) => html`<li><a href="/kb/${k.id}">${k.title}</a></li>`)}</ul>` : html`<p>None yet.</p>`}
      ${isMe ? html`<p><a href="/me">Edit my profile</a> · <a href="/preferences">Edit my accessibility preferences</a></p>` : ''}
    `);
  });

  // ---------- Information pages ----------
  route('GET', '/about', (ctx) => {
    ctx.render('About this prototype', html`
      <h1>About this prototype</h1>
      <p class="lead">The Library Access Network is a working demonstration. It runs on one computer with fictional data. It works alongside JAWS and Morphic; it does not control them.</p>
      <h2>What works now</h2>
      <ul>
        <li>Welcome page with Get help, Learn a skill, and Share a tip.</li>
        <li>Demonstration sign-in with hashed passwords. Library and patron profiles.</li>
        <li>Accessibility preferences. Text size and contrast change this site immediately.</li>
        <li>Searchable JAWS and Gmail keyboard-command guide, with a source for every command.</li>
        <li>Short lessons and a practice page.</li>
        <li>Discussions for each library and for the whole network.</li>
        <li>Mark a question solved, and turn it into an editable knowledge-base entry with the consent and credit of everyone quoted.</li>
        <li>Searchable shared knowledge base.</li>
        <li>Trainer requests, and a staff dashboard of requests and common problems.</li>
      </ul>
      <h2>Integration status</h2>
      <table>
        <caption>Each planned integration and what it does today</caption>
        <thead><tr><th scope="col">Integration</th><th scope="col">Status</th><th scope="col">Works now</th><th scope="col">Planned</th></tr></thead>
        <tbody>${INTEGRATIONS.map((i) => html`<tr><th scope="row">${i.name}</th><td>${i.status === 'available' ? 'Available' : 'Planned, not functional'}</td><td>${i.now}</td><td>${i.later}</td></tr>`)}</tbody>
      </table>
      <h2>What this prototype will never do</h2>
      <ul>
        <li>Read or record what JAWS says.</li>
        <li>Change JAWS or Morphic settings, or install software, without the patron's permission.</li>
        <li>Monitor what patrons do on library computers.</li>
        <li>Publish a conversation to the network without permission from the people in it.</li>
      </ul>
    `);
  });

  route('GET', '/privacy', (ctx) => {
    ctx.render('Privacy', html`
      <h1>Privacy</h1>
      <div class="warning"><p><strong>Do not use this prototype for real patron data.</strong> It has no production-grade authentication, permissions review, encryption at rest, backups, or audit log. It stores data in a file on the computer running it.</p></div>
      <h2>What we collect</h2>
      <ul>
        <li>A username, a display name you choose, your library, and an optional short bio and skills list.</li>
        <li>Accessibility preferences you choose to save.</li>
        <li>Questions, answers, tips, and trainer requests you write.</li>
      </ul>
      <h2>What we do not collect</h2>
      <ul>
        <li>No email, phone number, address, birth date, or library card number.</li>
        <li>No medical or disability information. You never have to say why you use a screen reader.</li>
        <li>No JAWS speech output, keystrokes, or activity monitoring. No analytics or tracking cookies.</li>
      </ul>
      <h2>Passwords and sessions</h2>
      <p>Passwords are stored only as salted scrypt hashes. One cookie keeps you signed in; it contains a random number, not personal data.</p>
      <h2>Sharing</h2>
      <p>Library discussions are visible to people at that library and to network staff. Network discussions are visible to every signed-in member. A conversation becomes a public knowledge-base entry only when each person quoted agrees, and you can withdraw your contribution later. You can choose to be credited by name or as “a patron at your library”. Trainer requests are visible only to you and to staff.</p>
    `);
  });

  route('GET', '/accessibility', (ctx) => {
    ctx.render('Accessibility statement', html`
      <h1>Accessibility statement</h1>
      <p>We aim to meet the Web Content Accessibility Guidelines (WCAG) 2.2 at level AA.</p>
      <h2>How this site is built</h2>
      <ul>
        <li>Plain HTML pages with headings, landmarks, and labeled form controls. No JavaScript is needed.</li>
        <li>Every page has a “Skip to main content” link and a visible keyboard focus outline.</li>
        <li>After you submit a form, the result is announced in the page title, for example “Preferences saved”.</li>
        <li>Problems with a form are listed at the top of the page, with links to each field.</li>
        <li>No drag-and-drop, pop-ups, time limits, or automatic focus changes.</li>
        <li>Text size and contrast can be changed on the <a href="/preferences">preferences page</a>.</li>
      </ul>
      <h2>Testing so far</h2>
      <p>Automated checks with axe-core on every page, in each contrast setting, plus keyboard-only checks. See the project's docs/ACCESSIBILITY.md file.</p>
      <h2>Not yet tested</h2>
      <p>This prototype has not yet been tested by blind JAWS users, braille display users, or people using magnification or voice control. That testing must happen before any real use.</p>
    `);
  });

  // ---------- Demonstration walkthrough ----------
  route('GET', '/demo', (ctx) => {
    const users = ctx.db.all('users');
    ctx.render('Demonstration walkthrough', html`
      <h1>Demonstration walkthrough</h1>
      <p class="lead">Scenario: Maya, a blind patron at the Downtown Demo Library in Washington, DC, asks “How do I use JAWS to read Gmail?”</p>
      <ol class="steps">
        <li><strong>Sign in as Maya</strong> (username <code>maya</code>) and open <a href="/learn/gmail-with-jaws">the lesson “Read Gmail with JAWS”</a>.</li>
        <li>At the end of the lesson, choose <strong>Ask a question about this lesson</strong>. Post “How do I use JAWS to read Gmail?” to the network.</li>
        <li><strong>Sign out, then sign in as Andre</strong> (username <code>andre</code>), a trainer in Arlington. Open the question from <a href="/dashboard">the staff dashboard</a> and answer it. Tick the box that allows the answer to be shared.</li>
        <li><strong>Sign in as Maya again.</strong> Open your question, choose <strong>This answer solved my problem</strong>, then choose <strong>Share this solution with the network</strong>. Edit the short summary and publish.</li>
        <li><strong>Sign in as Jordan</strong> (username <code>jordan</code>) from Prince George's County and <a href="/kb?q=gmail">search the knowledge base for “gmail”</a>. Maya and Andre's answer is there, with credit.</li>
      </ol>
      <h2>Demonstration accounts</h2>
      <p>Every account uses the password <code>${DEMO_PASSWORD}</code>.</p>
      <table>
        <caption>Fictional accounts for the demonstration</caption>
        <thead><tr><th scope="col">Username</th><th scope="col">Name</th><th scope="col">Role</th><th scope="col">Library</th></tr></thead>
        <tbody>${users.filter((u) => u.demo).map((u) => html`<tr><td><code>${u.username}</code></td><td>${u.displayName}</td><td>${v.ROLE_LABEL[u.role]}</td><td>${ctx.db.get('libraries', u.libraryId).name}, ${ctx.db.get('libraries', u.libraryId).place}</td></tr>`)}</tbody>
      </table>
      ${DEMO_MODE ? html`<h2>Start over</h2>
      <form method="post" action="/demo/reset">${v.csrfField(ctx.session)}
        <p>This removes everything added since the demonstration started and restores the sample data.</p>
        <button type="submit">Reset demonstration data</button>
      </form>` : ''}
    `);
  });

  route('POST', '/demo/reset', (ctx) => {
    if (!DEMO_MODE) throw new HttpError(403, 'Resetting is turned off.');
    ctx.db.reset();
    auth.endSession(ctx.session);
    ctx.redirect('/demo', 'Demonstration data reset. You are signed out');
  });
};

// ---------- page builders ----------

function searchForm(q) {
  return html`<form method="get" action="/search" role="search" class="search-form">
    <label for="q">Describe your problem or search for a topic</label>
    <p class="hint" id="q-hint">For example: read Gmail, PDF, mute in Zoom.</p>
    <div class="search-row"><input type="search" id="q" name="q" value="${q}" aria-describedby="q-hint"><button type="submit">Search</button></div>
  </form>`;
}

function kbList(entries) {
  return html`<ul class="card-list">${entries.map((k) => html`<li class="card">
    <h3><a href="/kb/${k.id}">${k.title}</a></h3>
    <p>${k.summary}</p>
  </li>`)}</ul>`;
}

function signinPage(ctx, errors, username = '') {
  const next = ctx.query.next || ctx.body?.next || '';
  const demoUsers = ctx.db.all('users').filter((u) => u.demo);
  ctx.render('Sign in', html`
    <h1>Sign in</h1>
    ${v.errorSummary(errors)}
    <form method="post" action="/signin" novalidate>
      ${v.csrfField(ctx.session)}
      <input type="hidden" name="next" value="${next}">
      ${v.input({ name: 'username', label: 'Username', value: username, required: true, autocomplete: 'username', error: errors.username })}
      ${v.input({ name: 'password', label: 'Password', type: 'password', required: true, autocomplete: 'current-password' })}
      <button type="submit">Sign in</button>
    </form>
    ${DEMO_MODE ? html`
    <h2>Demonstration accounts</h2>
    <p>All accounts are fictional. The password for every account is <code>${DEMO_PASSWORD}</code>. Or sign in with one button:</p>
    <ul class="demo-accounts">${demoUsers.map((u) => html`<li>
      <form method="post" action="/signin">
        ${v.csrfField(ctx.session)}
        <input type="hidden" name="username" value="${u.username}">
        <input type="hidden" name="password" value="${DEMO_PASSWORD}">
        <input type="hidden" name="next" value="${next}">
        <button type="submit" class="secondary">Sign in as ${u.displayName}, ${v.ROLE_LABEL[u.role].toLowerCase()}, ${ctx.db.get('libraries', u.libraryId).place}</button>
      </form></li>`)}</ul>` : ''}
  `, { code: Object.keys(errors).length ? 400 : 200, status: Object.keys(errors).length ? 'Error' : undefined });
}

function preferencesPage(ctx, errors) {
  const prefs = { ...defaultPrefs, ...((ctx.user && ctx.user.prefs) || ctx.session.prefs || {}) };
  ctx.render('My accessibility preferences', html`
    <h1>My accessibility preferences</h1>
    <p class="lead">Tell us what works for you. Text size and contrast change this website right away. The rest helps trainers and library staff prepare.</p>
    ${ctx.user ? '' : html`<p>You are not signed in, so these settings last only until you close the browser. <a href="/signin?next=/preferences">Sign in</a> to keep them.</p>`}
    <p>These settings are stored only in this website. They do not change JAWS, Morphic, or the computer's settings.</p>
    ${v.errorSummary(errors)}
    <form method="post" action="/preferences">
      ${v.csrfField(ctx.session)}
      ${v.choices({ name: 'screenReader', legend: 'Which screen reader or magnifier do you use?', options: PREF_OPTIONS.screenReader, value: prefs.screenReader })}
      ${v.choices({ name: 'textSize', legend: 'Text size on this website', options: PREF_OPTIONS.textSize, value: prefs.textSize })}
      ${v.choices({ name: 'contrast', legend: 'Colors and contrast on this website', options: PREF_OPTIONS.contrast, value: prefs.contrast })}
      ${v.choices({ name: 'inputMethod', legend: 'How do you usually control a computer?', options: PREF_OPTIONS.inputMethod, value: prefs.inputMethod })}
      ${v.choices({ name: 'learningStyle', legend: 'How do you prefer to learn?', options: PREF_OPTIONS.learningStyle, value: prefs.learningStyle })}
      ${v.choices({ name: 'morphicFeatures', type: 'checkbox', legend: 'Which Morphic features help you? Choose any.', hint: 'Staff can use this to set up a library computer with the MorphicBar. This is not sent to Morphic.', options: PREF_OPTIONS.morphicFeatures, value: prefs.morphicFeatures })}
      <button type="submit">Save preferences</button>
    </form>
  `);
}

function profileEditPage(ctx, user, errors) {
  const libs = ctx.db.all('libraries');
  ctx.render('Edit my profile', html`
    <h1>Edit my profile</h1>
    <p>Share only what you are comfortable with. Other members can see your display name, library, bio, and skills.</p>
    ${v.errorSummary(errors)}
    <form method="post" action="/me" novalidate>
      ${v.csrfField(ctx.session)}
      ${v.input({ name: 'displayName', label: 'Display name', hint: 'A first name and last initial is enough.', value: user.displayName, required: true, error: errors.displayName })}
      ${v.select({ name: 'libraryId', label: 'My library', options: libs.map((l) => [l.id, `${l.name}, ${l.place}`]), value: user.libraryId })}
      ${v.textarea({ name: 'bio', label: 'About me', hint: 'For example, what you are learning or what you can teach.', value: user.bio, rows: 4 })}
      ${v.input({ name: 'skills', label: 'Things I can help others with', hint: 'Separate with commas, for example: Excel, braille displays.', value: (user.skills || []).join(', ') })}
      <button type="submit">Save profile</button>
    </form>
  `, { code: Object.keys(errors).length ? 400 : 200, status: Object.keys(errors).length ? 'Error' : undefined });
}

module.exports.kbList = kbList;
module.exports.searchForm = searchForm;
module.exports.PREF_OPTIONS = PREF_OPTIONS;
