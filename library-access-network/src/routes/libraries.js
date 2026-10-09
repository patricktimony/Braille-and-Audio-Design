'use strict';
// Library profiles, each library's discussion space, and the staff dashboard.

const { html, prose } = require('../html');
const v = require('../views');
const { requestCard, postCard, REQUEST_STATUS, isStaff, canView } = require('./community');
const { HttpError } = require('../errors');

module.exports = function register(route) {
  route('GET', '/libraries', (ctx) => {
    const { db } = ctx;
    ctx.render('Libraries', html`
      <h1>Libraries in the network</h1>
      <p class="note">Demonstration data: these libraries are fictional and do not represent any real library system.</p>
      <ul class="card-list">${db.all('libraries').map((l) => {
        const trainers = db.where('users', (u) => u.libraryId === l.id && u.role === 'trainer').length;
        return html`<li class="card">
          <h2><a href="/libraries/${l.id}">${l.name}</a></h2>
          <p class="meta">${l.place}. ${trainers} trainer${trainers === 1 ? '' : 's'}.</p>
          <p>${l.about}</p>
        </li>`;
      })}</ul>
    `);
  });

  route('GET', '/libraries/:id', (ctx) => {
    const { db, user } = ctx;
    const lib = db.get('libraries', ctx.params.id);
    if (!lib) ctx.notFound();
    const people = db.where('users', (u) => u.libraryId === lib.id);
    const trainers = people.filter((u) => u.role === 'trainer');
    const staff = people.filter((u) => u.role === 'librarian');
    const networkTrainers = db.where('users', (u) => u.networkTrainer && u.libraryId !== lib.id);
    const posts = user ? db.where('posts', (p) => p.libraryId === lib.id && canView(user, p)).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 6) : [];
    const kb = db.where('kb', (k) => k.libraryId === lib.id && (k.status || 'published') === 'published');
    ctx.render(lib.name, html`
      <p class="breadcrumb"><a href="/libraries">Libraries</a></p>
      <h1>${lib.name}</h1>
      <p class="lead">${lib.place}</p>
      <p class="note">Demonstration library. Not a real branch.</p>
      ${prose(lib.about)}
      <h2>Hours</h2>
      <p>${lib.hours}</p>
      <h2>Accessibility resources</h2>
      <dl class="resources">${lib.resources.map((r) => html`<dt>${r.name}</dt><dd>${r.detail}</dd>`)}</dl>
      <h2>Trainers and staff</h2>
      <ul>${[...trainers, ...staff].map((u) => html`<li><a href="/people/${u.id}">${u.displayName}</a>, ${v.ROLE_LABEL[u.role].toLowerCase()}${u.skills.length ? ` — ${u.skills.join(', ')}` : ''}</li>`)}</ul>
      ${networkTrainers.length ? html`<p>Trainers from other libraries who help across the network: ${networkTrainers.map((u, i) => html`${i ? ', ' : ''}<a href="/people/${u.id}">${u.displayName}</a>`)}.</p>` : ''}
      <p><a class="button" href="/requests/new">Request a trainer</a></p>
      <h2>Discussion space</h2>
      ${user ? html`
        ${posts.length ? html`<ul class="card-list">${posts.map((p) => postCard(db, p))}</ul>` : html`<p>No discussions yet.</p>`}
        <p><a href="/discuss?space=${lib.id}">All ${lib.name} discussions</a></p>`
      : html`<p><a href="/signin?next=/libraries/${lib.id}">Sign in</a> to read and join this library's discussions.</p>`}
      <h2>Knowledge shared from this library (${kb.length})</h2>
      ${kb.length ? html`<ul>${kb.map((k) => html`<li><a href="/kb/${k.id}">${k.title}</a></li>`)}</ul>` : html`<p>None yet.</p>`}
    `);
  });

  // ---------- Staff dashboard ----------
  route('GET', '/dashboard', (ctx) => {
    const user = ctx.requireStaff();
    const { db } = ctx;
    const libs = db.all('libraries');
    const libId = ctx.query.library === 'all' || libs.some((l) => l.id === ctx.query.library) ? ctx.query.library : user.libraryId;
    const inScope = (x) => libId === 'all' || x.libraryId === libId;
    const scopeName = libId === 'all' ? 'all libraries' : db.get('libraries', libId).name;

    const requests = db.where('requests', (r) => inScope(r) && (r.status === 'new' || r.status === 'scheduled'))
      .sort((a, b) => (a.status === b.status ? a.createdAt.localeCompare(b.createdAt) : a.status === 'new' ? -1 : 1));
    const answerCount = (p) => db.where('answers', (a) => a.postId === p.id).length;
    const open = db.where('posts', (p) => p.type === 'question' && p.status === 'open' && (inScope(p) || p.scope === 'network'))
      .sort((a, b) => answerCount(a) - answerCount(b) || b.createdAt.localeCompare(a.createdAt));
    const unanswered = open.filter((p) => answerCount(p) === 0);
    const solvedNotShared = db.where('posts', (p) => p.status === 'solved' && !p.kbEntryId && inScope(p));
    const pendingKb = db.where('kb', (k) => k.status === 'pending' && inScope(k));
    const common = commonProblems(db, inScope);

    ctx.render(`Staff dashboard: ${scopeName}`, html`
      <h1>Staff dashboard</h1>
      <form method="get" action="/dashboard" class="filters">
        ${v.select({ name: 'library', label: 'Show library', value: libId, options: [...libs.map((l) => [l.id, `${l.name}, ${l.place}`]), ['all', 'All libraries in the network']] })}
        <button type="submit">Show</button>
      </form>
      <h2>Summary for ${scopeName}</h2>
      <ul class="stats">
        <li><span class="stat">${requests.filter((r) => r.status === 'new').length}</span> new trainer requests</li>
        <li><span class="stat">${unanswered.length}</span> questions with no answer</li>
        <li><span class="stat">${open.length}</span> open questions, including network-wide ones</li>
        <li><span class="stat">${solvedNotShared.length}</span> solved questions not yet in the knowledge base</li>
      </ul>

      <section aria-labelledby="req-heading">
        <h2 id="req-heading">Trainer requests (${requests.length})</h2>
        ${requests.length ? html`<ul class="card-list">${requests.map((r) => html`${requestCard(db, r, { staffView: true })}
          <li class="card-actions">${requestForm(ctx, r)}</li>`)}</ul>` : html`<p>No open requests.</p>`}
      </section>

      <section aria-labelledby="q-heading">
        <h2 id="q-heading">Open questions (${open.length})</h2>
        <p>Questions with no answers are listed first.</p>
        ${open.length ? html`<table>
          <caption>Open questions for ${scopeName} and the whole network</caption>
          <thead><tr><th scope="col">Question</th><th scope="col">Asked by</th><th scope="col">Answers</th><th scope="col">Asked on</th></tr></thead>
          <tbody>${open.map((p) => html`<tr>
            <th scope="row"><a href="/discuss/${p.id}">${p.title}</a></th>
            <td>${db.get('users', p.authorId)?.displayName}, ${db.get('libraries', p.libraryId).place}</td>
            <td>${answerCount(p)}</td><td>${v.formatDate(p.createdAt)}</td></tr>`)}</tbody>
        </table>` : html`<p>No open questions.</p>`}
      </section>

      <section aria-labelledby="common-heading">
        <h2 id="common-heading">Common problems</h2>
        <p>Topics that come up most in questions and trainer requests. Use these to plan classes and computer setup.</p>
        ${common.length ? html`<table>
          <caption>Most frequent topics, ${scopeName}</caption>
          <thead><tr><th scope="col">Topic</th><th scope="col">Questions</th><th scope="col">Trainer requests</th><th scope="col">Knowledge-base entries</th></tr></thead>
          <tbody>${common.map((c) => html`<tr><th scope="row"><a href="/search?q=${encodeURIComponent(c.topic)}">${c.topic}</a></th><td>${c.posts}</td><td>${c.requests}</td><td>${c.kb}</td></tr>`)}</tbody>
        </table>` : html`<p>Not enough activity yet.</p>`}
      </section>

      <section aria-labelledby="kb-heading">
        <h2 id="kb-heading">Knowledge to share</h2>
        ${solvedNotShared.length ? html`<p>These questions are solved. Offer to turn them into knowledge-base entries; the person who asked must agree.</p>
          <ul>${solvedNotShared.map((p) => html`<li><a href="/discuss/${p.id}">${p.title}</a></li>`)}</ul>` : html`<p>Every solved question is shared or waiting for permission.</p>`}
        ${pendingKb.length ? html`<h3>Waiting for permission</h3><ul>${pendingKb.map((k) => html`<li><a href="/kb/${k.id}">${k.title}</a></li>`)}</ul>` : ''}
      </section>
    `);
  });

  route('POST', '/requests/:id', (ctx) => {
    const user = ctx.requireStaff();
    const r = ctx.db.get('requests', ctx.params.id);
    if (!r) ctx.notFound();
    const status = Object.keys(REQUEST_STATUS).includes(ctx.body.status) ? ctx.body.status : r.status;
    const trainer = ctx.db.get('users', ctx.body.trainerId);
    if (ctx.body.trainerId && (!trainer || !isStaff(trainer))) throw new HttpError(400, 'Choose a trainer from the list.');
    ctx.db.update('requests', r.id, {
      status, trainerId: trainer ? trainer.id : null,
      staffNote: String(ctx.body.staffNote || '').trim().slice(0, 500), updatedBy: user.id,
    });
    ctx.redirect(`/dashboard?library=${encodeURIComponent(ctx.body.returnLibrary || r.libraryId)}`, `Request “${r.topic}” updated`);
  });
};

function requestForm(ctx, r) {
  const trainers = ctx.db.where('users', (u) => isStaff(u));
  const id = r.id;
  return html`<form method="post" action="/requests/${id}" class="request-form">
    ${v.csrfField(ctx.session)}
    <input type="hidden" name="returnLibrary" value="${ctx.query.library || ''}">
    <fieldset><legend>Update request: ${r.topic}</legend>
      ${v.select({ name: 'status', id: `status-${id}`, label: 'Status', value: r.status, options: Object.entries(REQUEST_STATUS).map(([k, [l]]) => [k, l]) })}
      ${v.select({ name: 'trainerId', id: `trainer-${id}`, label: 'Trainer', value: r.trainerId || '', options: [['', 'Not assigned'], ...trainers.map((t) => [t.id, `${t.displayName} (${v.ROLE_LABEL[t.role].toLowerCase()}, ${ctx.db.get('libraries', t.libraryId).place})`])] })}
      ${v.textarea({ name: 'staffNote', id: `note-${id}`, label: 'Note to the patron', hint: 'The patron sees this on their requests page.', value: r.staffNote || '', rows: 2 })}
      <button type="submit">Save update</button>
    </fieldset>
  </form>`;
}

// Count topic tags across questions, trainer requests, and knowledge-base entries.
// Request topics have no tags, so match them on known tag words.
function commonProblems(db, inScope) {
  const counts = new Map();
  const bump = (topic, field) => {
    if (!counts.has(topic)) counts.set(topic, { topic, posts: 0, requests: 0, kb: 0 });
    counts.get(topic)[field]++;
  };
  db.where('posts', (p) => p.type === 'question' && inScope(p)).forEach((p) => p.tags.forEach((t) => bump(t, 'posts')));
  db.where('kb', (k) => k.status !== 'withdrawn' && inScope(k)).forEach((k) => k.tags.forEach((t) => bump(t, 'kb')));
  const known = [...counts.keys()];
  db.where('requests', inScope).forEach((r) => {
    const text = `${r.topic} ${r.details}`.toLowerCase();
    known.filter((t) => text.includes(t)).forEach((t) => bump(t, 'requests'));
  });
  return [...counts.values()].sort((a, b) => (b.posts + b.requests + b.kb) - (a.posts + a.requests + a.kb) || a.topic.localeCompare(b.topic)).slice(0, 10);
}
