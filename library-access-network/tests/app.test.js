'use strict';
// Unit and page-level checks: escaping, passwords, CSRF, preferences, search,
// requests, and basic accessibility structure on every page.

const test = require('node:test');
const assert = require('node:assert/strict');
const { startApp, Client, titleOf } = require('./helpers');
const { html, escape, prose } = require('../src/html');
const { hashPassword, verifyPassword } = require('../src/auth');
const { COMMANDS, SOURCES } = require('../src/content/jaws-commands');
const { LESSONS } = require('../src/content/lessons');

test('html escapes interpolated values', () => {
  assert.equal(String(html`<p>${'<script>alert(1)</script>'}</p>`), '<p>&lt;script&gt;alert(1)&lt;/script&gt;</p>');
  assert.equal(escape('"a" & \'b\''), '&quot;a&quot; &amp; &#39;b&#39;');
  assert.equal(String(prose('1. one\n2. <two>')), '<ol><li>one</li><li>&lt;two&gt;</li></ol>');
});

test('passwords are hashed with scrypt and verified', () => {
  const h = hashPassword('secret-pass');
  assert.match(h, /^scrypt\$[0-9a-f]{32}\$[0-9a-f]{64}$/);
  assert.ok(verifyPassword('secret-pass', h));
  assert.ok(!verifyPassword('wrong', h));
});

test('every command and lesson cites a known source', () => {
  for (const c of COMMANDS) assert.ok(SOURCES[c.source], `${c.id} has a source`);
  for (const l of LESSONS) {
    for (const s of l.sources) assert.ok(SOURCES[s]);
    for (const id of l.commands) assert.ok(COMMANDS.some((c) => c.id === id), `${l.id} uses known command ${id}`);
  }
});

test('pages', async (t) => {
  const app = await startApp();
  t.after(app.close);
  const c = new Client(app.base);

  await t.test('seed data has no plain-text passwords and is marked as demo', () => {
    const raw = JSON.stringify(app.db.load());
    assert.doesNotMatch(raw, /demo-library/);
    assert.ok(app.db.all('users').every((u) => u.demo && u.passwordHash.startsWith('scrypt$')));
  });

  const publicPages = ['/', '/help', '/learn', '/learn/gmail-with-jaws', '/learn/practice', '/jaws', '/jaws?q=heading', '/jaws?category=gmail',
    '/morphic', '/kb', '/kb/kb-pdf', '/search?q=pdf', '/libraries', '/libraries/lib-arl', '/signin', '/preferences',
    '/about', '/privacy', '/accessibility', '/demo', '/share', '/people/usr-devon'];

  await t.test('public pages have one h1, a skip link, landmarks, lang, and a title', async () => {
    for (const p of publicPages) {
      const r = await c.get(p);
      assert.equal(r.status, 200, p);
      assert.equal((r.text.match(/<h1[ >]/g) || []).length, 1, `${p} has exactly one h1`);
      assert.match(r.text, /<html lang="en"/);
      assert.match(r.text, /<a class="skip-link" href="#main">/);
      assert.match(r.text, /<main id="main"/);
      assert.match(r.text, /<nav class="site-nav" aria-label="Main">/);
      assert.match(r.text, /Demonstration prototype/);
      assert.ok(titleOf(r.text).endsWith('Library Access Network'), p);
      // every input/select/textarea with an id has a matching label
      for (const [, attrs] of r.text.matchAll(/<(?:input|select|textarea)\b([^>]*)>/g)) {
        if (/type="hidden"/.test(attrs)) continue;
        const id = (attrs.match(/\bid="([^"]+)"/) || [])[1];
        assert.ok(id, `${p}: every form control has an id`);
        assert.match(r.text, new RegExp(`<label for="${id}"`), `${p}: control #${id} has a label`);
      }
    }
  });

  await t.test('signed-in pages require sign-in', async () => {
    const anon = new Client(app.base);
    const r = await anon.request('GET', '/discuss');
    assert.equal(r.status, 303);
    assert.match(r.location, /^\/signin\?next=%2Fdiscuss/);
    const d = await anon.request('GET', '/dashboard');
    assert.equal(d.status, 303);
  });

  await t.test('POST without a CSRF token is refused', async () => {
    const r = await c.request('POST', '/preferences', { textSize: '200' });
    assert.equal(r.status, 403);
  });

  await t.test('wrong password shows an error summary linked to the field', async () => {
    const r = await c.submit('/signin', '/signin', { username: 'maya', password: 'nope' });
    assert.equal(r.status, 400);
    assert.match(r.text, /class="error-summary" role="alert"/);
    assert.match(r.text, /<a href="#f-username">/);
    assert.match(r.text, /aria-invalid="true"/);
  });

  await t.test('anonymous preferences change text size and contrast', async () => {
    const r = await c.submit('/preferences', '/preferences', { textSize: '150', contrast: 'high', screenReader: 'nvda', learningStyle: 'one-on-one', morphicFeatures: ['magnifier', 'bogus'] });
    assert.match(titleOf(r.text), /^Preferences saved/);
    assert.match(r.text, /data-text-size="150" data-contrast="high"/);
    assert.match(r.text, /id="f-morphicFeatures-1" name="morphicFeatures" value="magnifier" checked/);
    assert.match((await c.get('/jaws')).text, /screen reader other than JAWS/);
  });

  await t.test('patron profile and preferences are saved to the account', async () => {
    const m = new Client(app.base);
    await m.signIn('maya');
    await m.submit('/preferences', '/preferences', { textSize: '200', contrast: 'dark', learningStyle: 'hands-on' });
    assert.equal(app.db.get('users', 'usr-maya').prefs.textSize, '200');
    const r = await m.submit('/me', '/me', { displayName: 'Maya <R>', bio: 'Learning.', skills: 'Word, Gmail', libraryId: 'lib-dc' });
    assert.match(r.text, /<h1>Maya &lt;R&gt;<\/h1>/);
  });

  await t.test('JAWS guide search filters commands', async () => {
    const r = await c.get('/jaws?q=headings+list');
    assert.match(r.text, /Insert\+F6/);
    assert.doesNotMatch(r.text, /Insert\+F7<\/kbd>/);
  });

  await t.test('trainer request: patron creates, staff updates, patron sees note', async () => {
    const h = new Client(app.base);
    await h.signIn('harold');
    let r = await h.submit('/requests/new', '/requests/new', { topic: 'Learn Gmail', format: 'in-person', libraryId: 'lib-dc' });
    assert.match(titleOf(r.text), /^Request sent/);
    const req = app.db.where('requests', (x) => x.topic === 'Learn Gmail')[0];
    const rosa = new Client(app.base);
    await rosa.signIn('rosa');
    r = await rosa.get('/dashboard');
    assert.match(r.text, /Learn Gmail/);
    assert.match(r.text, /Common problems/);
    r = await rosa.submit('/dashboard', `/requests/${req.id}`, { status: 'scheduled', trainerId: 'usr-lin', staffNote: 'Tuesday at 10 am with Lin.' });
    assert.match(titleOf(r.text), /updated/);
    r = await h.get('/requests');
    assert.match(r.text, /Tuesday at 10 am with Lin\./);
    // Patrons cannot open the staff dashboard.
    assert.equal((await h.get('/dashboard')).status, 403);
  });

  await t.test('form validation errors keep what the person typed', async () => {
    const j = new Client(app.base);
    await j.signIn('jordan');
    const r = await j.submit('/requests/new', '/requests/new', { topic: 'x', details: 'keep me', libraryId: 'lib-pgc' });
    assert.equal(r.status, 400);
    assert.match(r.text, /keep me/);
    assert.match(r.text, /href="#f-topic"/);
    assert.match(r.text, /href="#f-format"/);
  });

  await t.test('sharing a tip adds it to the knowledge base with credit', async () => {
    const d = new Client(app.base);
    await d.signIn('devon');
    const r = await d.submit('/share', '/share', { title: 'Tip: Gmail search with slash', body: 'Press / in Gmail to jump to the search box. Then type and press Enter.', tags: 'gmail', scope: 'network', addToKb: 'yes', credit: 'name' });
    assert.match(titleOf(r.text), /added to the knowledge base/);
    assert.match(r.text, /Devon P\.<\/a> — shared the tip/);
  });
});
