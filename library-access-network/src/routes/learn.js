'use strict';
// Lessons, the practice page, the JAWS command guide, and the Morphic page.

const { html } = require('../html');
const v = require('../views');
const { LESSONS } = require('../content/lessons');
const { COMMANDS, CATEGORIES, SOURCES, searchCommands } = require('../content/jaws-commands');
const { morphic } = require('../integrations');

const byId = (id) => COMMANDS.find((c) => c.id === id);

function commandTable(commands, caption) {
  return html`<table class="commands">
    <caption>${caption}</caption>
    <thead><tr><th scope="col">Keys</th><th scope="col">What it does</th><th scope="col">Source</th></tr></thead>
    <tbody>${commands.map((c) => html`<tr>
      <th scope="row"><kbd>${c.keys}</kbd></th>
      <td>${c.action}</td>
      <td><a href="${SOURCES[c.source].url}">${SOURCES[c.source].name.split(' — ')[0]}</a></td>
    </tr>`)}</tbody>
  </table>`;
}

module.exports = function register(route) {
  route('GET', '/learn', (ctx) => {
    const style = ctx.user ? ctx.user.prefs.learningStyle : (ctx.session.prefs || {}).learningStyle;
    ctx.render('Learn a skill', html`
      <h1>Learn a skill</h1>
      <p class="lead">Short lessons you can follow with JAWS. Each one takes about ten minutes.</p>
      ${style === 'one-on-one' ? html`<p class="note">You said you prefer learning one-on-one. You can <a href="/requests/new">request a trainer</a> for any lesson.</p>` : ''}
      ${style === 'audio-video' ? html`<p class="note">You said you prefer audio or video lessons. Those are planned but not ready yet, so these are text lessons for now.</p>` : ''}
      <ul class="card-list">${LESSONS.map((l) => html`<li class="card">
        <h2><a href="/learn/${l.id}">${l.title}</a></h2>
        <p>${l.summary}</p>
        <p class="meta">${l.level}. About ${l.minutes} minutes.</p>
      </li>`)}</ul>
      <h2>Practice safely</h2>
      <p>The <a href="/learn/practice">practice page</a> has headings, links, a table, and a form you can explore. Nothing you type there is sent anywhere.</p>
      <h2>Other ways to learn</h2>
      <ul>
        <li><a href="/jaws">Search JAWS keyboard commands</a></li>
        <li><a href="/kb">Read answers from other patrons</a></li>
        <li><a href="/requests/new">Request a trainer</a></li>
      </ul>
    `);
  });

  route('GET', '/learn/practice', (ctx) => {
    const submitted = ctx.query.checked === '1';
    ctx.render(submitted ? 'Practice form checked' : 'Practice page', html`
      <h1>Practice page</h1>
      <p>Use this page to practice moving by headings (H), regions (R), lists (L), tables (T), and form fields (F). It belongs to a fictional library.</p>
      ${submitted ? html`<div class="status-message" role="status"><p>Well done. You filled in and submitted the practice form. Nothing was sent or saved.</p></div>` : ''}
      <section aria-labelledby="practice-hours"><h2 id="practice-hours">Library hours</h2>
        <table><caption>Practice library opening hours</caption>
          <thead><tr><th scope="col">Day</th><th scope="col">Opens</th><th scope="col">Closes</th></tr></thead>
          <tbody>
            <tr><th scope="row">Monday to Friday</th><td>9 am</td><td>8 pm</td></tr>
            <tr><th scope="row">Saturday</th><td>10 am</td><td>5 pm</td></tr>
            <tr><th scope="row">Sunday</th><td>1 pm</td><td>5 pm</td></tr>
          </tbody></table>
      </section>
      <section aria-labelledby="practice-events"><h2 id="practice-events">Upcoming events</h2>
        <h3>Peer-learning circle</h3><p>Patrons teach patrons. Second Saturday, 11 am.</p>
        <h3>Talking books sign-up</h3><p>Ask at the front desk.</p>
        <h3>Job search with a screen reader</h3><p>Wednesdays, 2 pm.</p>
      </section>
      <section aria-labelledby="practice-form"><h2 id="practice-form">Practice form: sign up for an event</h2>
        <form method="get" action="/learn/practice">
          <input type="hidden" name="checked" value="1">
          <div class="field"><label for="p-name">First name (make one up)</label><input id="p-name" name="pname" autocomplete="off"></div>
          <div class="field"><fieldset><legend>Which event?</legend><div class="choices">
            <div class="choice"><input type="radio" id="p-ev1" name="pevent" value="circle"><label for="p-ev1">Peer-learning circle</label></div>
            <div class="choice"><input type="radio" id="p-ev2" name="pevent" value="books"><label for="p-ev2">Talking books sign-up</label></div>
            <div class="choice"><input type="radio" id="p-ev3" name="pevent" value="jobs"><label for="p-ev3">Job search with a screen reader</label></div>
          </div></fieldset></div>
          <div class="field"><div class="choice"><input type="checkbox" id="p-remind" name="premind" value="yes"><label for="p-remind">Remind me the day before</label></div></div>
          <button type="submit">Check my answers</button>
        </form>
      </section>
      <p><a href="/learn">Back to lessons</a></p>
    `);
  });

  route('GET', '/learn/:id', (ctx) => {
    const lesson = LESSONS.find((l) => l.id === ctx.params.id);
    if (!lesson) ctx.notFound();
    const style = ctx.user ? ctx.user.prefs.learningStyle : (ctx.session.prefs || {}).learningStyle;
    const related = ctx.db.where('kb', (k) => (k.status || 'published') === 'published' && k.tags.some((t) => lesson.tags.includes(t)));
    ctx.render(lesson.title, html`
      <p class="breadcrumb"><a href="/learn">Lessons</a></p>
      <h1>${lesson.title}</h1>
      <p class="lead">${lesson.summary}</p>
      <p class="meta">${lesson.level}. About ${lesson.minutes} minutes.</p>
      ${style === 'one-on-one' ? html`<p class="note">Prefer to learn this with a person? <a href="/requests/new?topic=${encodeURIComponent(lesson.title)}">Request a trainer for this lesson</a>.</p>` : ''}
      <h2>Before you start</h2>
      <p>${lesson.before}</p>
      <h2>Steps</h2>
      <ol class="steps">${lesson.steps.map((s) => html`<li>${s}</li>`)}</ol>
      <h2>Practice</h2>
      <p>${lesson.practice}</p>
      ${style === 'hands-on' ? html`<p class="note">You like hands-on practice. Try the <a href="/learn/practice">practice page</a> first.</p>` : ''}
      <h2>Commands in this lesson</h2>
      ${commandTable(lesson.commands.map(byId).filter(Boolean), `Keyboard commands used in ${lesson.title}`)}
      <p class="hint">Keys are for the JAWS desktop keyboard layout. On a laptop layout, Caps Lock is often the JAWS key. Ask staff if a key does not work.</p>
      ${related.length ? html`<h2>Answers from the community</h2>
        <ul>${related.map((k) => html`<li><a href="/kb/${k.id}">${k.title}</a></li>`)}</ul>` : ''}
      <h2>Still have a question?</h2>
      <ul class="action-list">
        <li><a href="/discuss/new?lesson=${lesson.id}">Ask a question about this lesson</a></li>
        <li><a href="/requests/new?topic=${encodeURIComponent(lesson.title)}">Request a trainer</a></li>
      </ul>
      <h2>Sources</h2>
      <ul>${lesson.sources.map((s) => html`<li><a href="${SOURCES[s].url}">${SOURCES[s].name}</a></li>`)}</ul>
    `);
  });

  route('GET', '/jaws', (ctx) => {
    const q = (ctx.query.q || '').trim().slice(0, 100);
    const category = CATEGORIES.some((c) => c.id === ctx.query.category) ? ctx.query.category : '';
    const results = searchCommands(q, category);
    const sr = ctx.user ? ctx.user.prefs.screenReader : (ctx.session.prefs || {}).screenReader;
    const filtered = q || category;
    ctx.render(filtered ? `JAWS commands: ${results.length} found` : 'JAWS keyboard commands', html`
      <h1>JAWS keyboard commands</h1>
      <p class="lead">A small, checked set of commands for getting around. Every command links to its public source.</p>
      ${sr && sr !== 'jaws' && sr !== 'none' ? html`<p class="note">Your preferences say you use a screen reader other than JAWS. These commands are for JAWS; many web shortcuts like H for headings also work in NVDA.</p>` : ''}
      <p>Keys are for the JAWS desktop layout, where Insert is the JAWS key. Gmail commands are Gmail's own shortcuts and must be turned on in Gmail.</p>
      <form method="get" action="/jaws" role="search" class="search-form">
        <div class="field"><label for="jq">Search commands</label>
          <p class="hint" id="jq-hint">For example: heading, links, stop, form, gmail.</p>
          <input type="search" id="jq" name="q" value="${q}" aria-describedby="jq-hint"></div>
        ${v.select({ name: 'category', id: 'jcat', label: 'Show', options: [['', 'All categories'], ...CATEGORIES.map((c) => [c.id, c.name])], value: category })}
        <button type="submit">Search commands</button>
      </form>
      <p id="count">${filtered ? `${results.length} command${results.length === 1 ? '' : 's'} found.` : `Showing all ${results.length} commands.`}</p>
      ${CATEGORIES.map((c) => {
        const rows = results.filter((r) => r.category === c.id);
        return rows.length ? html`<h2>${c.name}</h2>${commandTable(rows, `${c.name} commands`)}` : '';
      })}
      ${results.length ? '' : html`<p>No commands matched. Try a shorter word, or <a href="/discuss/new?title=${encodeURIComponent(q)}">ask the community</a>.</p>`}
      <h2>About these commands</h2>
      <p>Commands can differ between JAWS versions, keyboard layouts, and custom settings. For the complete list, press Insert+J to open JAWS and look in Help, or read the sources below. This website never sends keystrokes to JAWS or changes JAWS settings.</p>
      <ul>${Object.values(SOURCES).map((s) => html`<li><a href="${s.url}">${s.name}</a></li>`)}</ul>
    `);
  });

  route('GET', '/morphic', (ctx) => {
    const prefs = ctx.user ? ctx.user.prefs : (ctx.session.prefs || {});
    const chosen = prefs.morphicFeatures || [];
    ctx.render('Morphic', html`
      <h1>Morphic</h1>
      <p class="lead">Morphic is a free accessibility toolbar for Windows and macOS from Raising the Floor, the nonprofit led by Gregg Vanderheiden. It makes the accessibility features already built into a computer easier to find and use.</p>
      <h2>What the MorphicBar offers</h2>
      <p>According to Morphic's public information, the free MorphicBar includes:</p>
      <ul>
        <li>Text size</li><li>Magnifier</li><li>Read selected text aloud</li><li>High contrast</li>
        <li>Color vision filters</li><li>Dark mode</li><li>Night mode</li><li>A snip (screenshot) button</li>
      </ul>
      <p>With a Morphic account, you can save your settings and apply them on other computers that have Morphic installed. Morphic does not run on iPhone, iPad, or Android.</p>
      <h2>Setting up Morphic at a library</h2>
      <ol class="steps">
        <li>Ask library staff whether Morphic is installed on the public computers. Staff must install software; this website will never install it.</li>
        <li>Look for the MorphicBar on the screen, or ask staff to open it.</li>
        <li>Try the features you need. Many library computers reset when you sign out, so a Morphic account can help you bring your settings back.</li>
        <li>Tell us which features help you on your <a href="/preferences">preferences page</a>, so staff can prepare a computer for you.</li>
      </ol>
      ${chosen.length ? html`<p class="note">Your preferences list these Morphic features: ${chosen.join(', ').replace(/-/g, ' ')}.</p>` : ''}
      <h2>Official links</h2>
      <ul>
        <li><a href="https://morphic.org/">Morphic website (morphic.org)</a> — downloads, features, and help</li>
        <li><a href="https://morphic.org/faq/">Morphic frequently asked questions</a></li>
        <li><a href="https://raisingthefloor.org/">Raising the Floor</a> — the nonprofit behind Morphic</li>
        <li><a href="https://github.com/raisingthefloor/morphic-windows">Morphic for Windows source code on GitHub</a></li>
      </ul>
      <h2>Integration status</h2>
      <p>This website works alongside Morphic. It does not connect to Morphic or control it. We did not find a documented public interface that lets a website read or apply Morphic settings, so those features are planned only.</p>
      <table>
        <caption>Morphic features in this prototype</caption>
        <thead><tr><th scope="col">Feature</th><th scope="col">Status</th></tr></thead>
        <tbody>${morphic.capabilities.map((c) => html`<tr><th scope="row">${c.name}</th><td>${c.status === 'available' ? v.statusBadge('Works now', 'good') : v.statusBadge('Planned, not functional', 'planned')}</td></tr>`)}</tbody>
      </table>
    `);
  });
};
