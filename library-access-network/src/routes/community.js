'use strict';
// Discussions, the knowledge base, tips, and trainer requests.
//
// The core loop: a patron asks -> someone answers -> the patron marks it solved
// -> the patron (or a librarian) drafts a knowledge-base entry -> it is published
// only once everyone quoted has agreed. Nothing is published automatically.

const { html, prose } = require('../html');
const v = require('../views');
const { LESSONS } = require('../content/lessons');
const { searchKb } = require('../search');
const { HttpError } = require('../errors');

const isStaff = (u) => u && (u.role === 'librarian' || u.role === 'trainer');
const clean = (s, max) => String(s || '').replace(/\r\n/g, '\n').trim().slice(0, max);
const parseTags = (s) => [...new Set(String(s || '').toLowerCase().split(',').map((t) => t.trim()).filter(Boolean))].slice(0, 8);

function canView(user, post) {
  if (!user) return false;
  if (post.scope === 'network') return true;
  return user.libraryId === post.libraryId || isStaff(user);
}

function canManagePost(user, post) {
  return user && (user.id === post.authorId || isStaff(user));
}

function creditLabel(db, c) {
  const u = db.get('users', c.userId);
  if (!u) return html`A former member`;
  if (c.anonymous) {
    const lib = db.get('libraries', u.libraryId);
    return html`A ${v.ROLE_LABEL[u.role].toLowerCase()} at ${lib.name}`;
  }
  return html`<a href="/people/${u.id}">${u.displayName}</a>`;
}

function personLink(db, userId) {
  const u = db.get('users', userId);
  if (!u) return 'A former member';
  const lib = db.get('libraries', u.libraryId);
  return html`<a href="/people/${u.id}">${u.displayName}</a> <span class="meta">(${v.ROLE_LABEL[u.role]}, ${lib.place})</span>`;
}

function kbVisible(user, k) {
  const status = k.status || 'published';
  if (status === 'published') return true;
  if (status === 'withdrawn') return false;
  return user && (isStaff(user) || k.contributors.some((c) => c.userId === user.id));
}

module.exports = function register(route) {
  // ---------- Discussions ----------
  route('GET', '/discuss', (ctx) => {
    const user = ctx.requireUser();
    const { db } = ctx;
    const libs = db.all('libraries');
    const space = ctx.query.space === 'network' || libs.some((l) => l.id === ctx.query.space) ? ctx.query.space : 'all';
    const status = ['open', 'solved'].includes(ctx.query.status) ? ctx.query.status : '';
    const posts = db.where('posts', (p) => canView(user, p)
      && (space === 'all' || (space === 'network' ? p.scope === 'network' : p.libraryId === space))
      && (!status || (status === 'solved' ? p.status === 'solved' : p.status === 'open')))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const spaceName = space === 'all' ? 'All discussions' : space === 'network' ? 'Network-wide discussions' : `${db.get('libraries', space).name} discussions`;
    ctx.render(spaceName, html`
      <h1>Discussions</h1>
      <p class="lead">Questions, answers, and tips from patrons, trainers, and librarians.</p>
      <p><a class="button" href="/discuss/new">Ask a question</a> <a class="button secondary" href="/share">Share a tip</a></p>
      <form method="get" action="/discuss" class="filters">
        ${v.select({ name: 'space', label: 'Discussion space', value: space, options: [['all', 'All spaces I can see'], ['network', 'Whole network'], ...libs.map((l) => [l.id, `${l.name}, ${l.place}`])] })}
        ${v.select({ name: 'status', label: 'Status', value: status, options: [['', 'Any'], ['open', 'Open questions'], ['solved', 'Solved questions']] })}
        <button type="submit">Show discussions</button>
      </form>
      <h2>${spaceName} (${posts.length})</h2>
      ${posts.length ? html`<ul class="card-list">${posts.map((p) => postCard(db, p))}</ul>` : html`<p>Nothing here yet. <a href="/discuss/new">Ask the first question</a>.</p>`}
    `);
  });

  route('GET', '/discuss/new', (ctx) => {
    ctx.requireUser();
    const lesson = LESSONS.find((l) => l.id === ctx.query.lesson);
    newQuestionPage(ctx, { title: ctx.query.title || (lesson ? '' : ''), tags: lesson ? lesson.tags.join(', ') : '', scope: 'network', lesson: lesson ? lesson.id : '' }, {});
  });

  route('POST', '/discuss/new', (ctx) => {
    const user = ctx.requireUser();
    const b = ctx.body;
    const values = { title: clean(b.title, 150), body: clean(b.body, 4000), tags: clean(b.tags, 200), scope: b.scope === 'library' ? 'library' : 'network', lesson: clean(b.lesson, 60) };
    const errors = {};
    if (values.title.length < 5) errors.title = 'Write your question in a few words, at least 5 characters.';
    if (Object.keys(errors).length) return newQuestionPage(ctx, values, errors);
    const post = ctx.db.insert('posts', {
      type: 'question', title: values.title, body: values.body, authorId: user.id, libraryId: user.libraryId,
      scope: values.scope, tags: parseTags(values.tags), status: 'open', lessonId: values.lesson || null,
    });
    ctx.redirect(`/discuss/${post.id}`, 'Your question was posted');
  });

  route('GET', '/discuss/:id', (ctx) => {
    const user = ctx.requireUser();
    const { db } = ctx;
    const post = db.get('posts', ctx.params.id);
    if (!post || !canView(user, post)) ctx.notFound();
    const answers = db.where('answers', (a) => a.postId === post.id).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    const lib = db.get('libraries', post.libraryId);
    const kb = post.kbEntryId ? db.get('kb', post.kbEntryId) : null;
    const isAuthor = user.id === post.authorId;
    const canSolve = post.type === 'question' && canManagePost(user, post);
    const lesson = post.lessonId ? LESSONS.find((l) => l.id === post.lessonId) : null;
    ctx.render(post.title, html`
      <p class="breadcrumb"><a href="/discuss">Discussions</a></p>
      <article aria-labelledby="post-title">
        <h1 id="post-title">${post.title}</h1>
        <p class="meta">${post.type === 'tip' ? 'Tip' : 'Question'} from ${personLink(db, post.authorId)} on ${v.formatDate(post.createdAt)}.
          Posted in ${post.scope === 'network' ? 'the whole network' : html`the ${lib.name} discussion space`}.
          ${post.status === 'solved' ? v.statusBadge('Solved', 'good') : post.status === 'open' ? v.statusBadge('Open', 'neutral') : ''}</p>
        ${post.body ? prose(post.body) : ''}
        ${lesson ? html`<p>Related lesson: <a href="/learn/${lesson.id}">${lesson.title}</a></p>` : ''}
        ${v.tagList(post.tags)}
      </article>
      ${kbStatusBox(ctx, post, kb)}
      ${post.type === 'question' ? html`
      <section aria-labelledby="answers-heading">
        <h2 id="answers-heading">${answers.length} answer${answers.length === 1 ? '' : 's'}</h2>
        ${answers.length ? html`<ol class="answers">${answers.map((a) => html`<li class="answer${a.id === post.solvedAnswerId ? ' solved' : ''}" id="${a.id}">
          <h3>Answer from ${db.get('users', a.authorId)?.displayName || 'a former member'}${a.id === post.solvedAnswerId ? html` <span class="badge badge-good">Solved the problem</span>` : ''}</h3>
          <p class="meta">${personLink(db, a.authorId)}, ${v.formatDate(a.createdAt)}. ${a.shareConsent ? 'May be shared to the knowledge base with credit.' : 'Not yet agreed to be shared.'}</p>
          ${prose(a.body)}
          ${canSolve && post.status !== 'solved' ? html`<form method="post" action="/discuss/${post.id}/solve">${v.csrfField(ctx.session)}
            <input type="hidden" name="answerId" value="${a.id}">
            <button type="submit">This answer solved my problem</button></form>` : ''}
          ${user.id === a.authorId && !a.shareConsent ? html`<form method="post" action="/answers/${a.id}/consent">${v.csrfField(ctx.session)}
            <button type="submit" class="secondary">Allow my answer to be shared with credit</button></form>` : ''}
        </li>`)}</ol>` : html`<p>No answers yet. Trainers and librarians see new questions on their dashboard.</p>`}
      </section>
      ${post.status === 'solved' && canSolve ? html`<form method="post" action="/discuss/${post.id}/reopen" class="inline-form">${v.csrfField(ctx.session)}
        <button type="submit" class="secondary">Not solved after all — reopen</button></form>` : ''}
      <section aria-labelledby="reply-heading">
        <h2 id="reply-heading">${isAuthor ? 'Add more detail or reply' : 'Write an answer'}</h2>
        <form method="post" action="/discuss/${post.id}/answers">
          ${v.csrfField(ctx.session)}
          ${v.textarea({ name: 'body', label: 'Your answer', hint: 'Plain steps work best. Name the exact keys to press.', required: true, rows: 6 })}
          ${isAuthor ? '' : v.choices({ name: 'shareConsent', type: 'checkbox', legend: 'Sharing', options: [['yes', 'If this question is solved, my answer may be shared in the network knowledge base with my name.', 'You can change your mind later.']], value: [] })}
          <button type="submit">Post answer</button>
        </form>
      </section>` : ''}
    `);
  });

  route('POST', '/discuss/:id/answers', (ctx) => {
    const user = ctx.requireUser();
    const post = ctx.db.get('posts', ctx.params.id);
    if (!post || !canView(user, post) || post.type !== 'question') ctx.notFound();
    const body = clean(ctx.body.body, 4000);
    if (body.length < 2) return ctx.redirect(`/discuss/${post.id}#reply-heading`, 'Error: your answer was empty, nothing was posted');
    ctx.db.insert('answers', { postId: post.id, authorId: user.id, body, shareConsent: ctx.body.shareConsent === 'yes' && user.id !== post.authorId });
    ctx.redirect(`/discuss/${post.id}`, 'Your answer was posted');
  });

  route('POST', '/answers/:id/consent', (ctx) => {
    const user = ctx.requireUser();
    const answer = ctx.db.get('answers', ctx.params.id);
    if (!answer || answer.authorId !== user.id) ctx.notFound();
    ctx.db.update('answers', answer.id, { shareConsent: true });
    ctx.redirect(`/discuss/${answer.postId}`, 'Thank you. Your answer may now be shared with credit');
  });

  route('POST', '/discuss/:id/solve', (ctx) => {
    const user = ctx.requireUser();
    const post = ctx.db.get('posts', ctx.params.id);
    if (!post || !canView(user, post)) ctx.notFound();
    if (!canManagePost(user, post)) throw new HttpError(403, 'Only the person who asked, or library staff, can mark a question solved.');
    const answer = ctx.db.get('answers', ctx.body.answerId);
    if (!answer || answer.postId !== post.id) ctx.notFound();
    ctx.db.update('posts', post.id, { status: 'solved', solvedAnswerId: answer.id, solvedAt: ctx.db.now() });
    ctx.redirect(`/discuss/${post.id}`, 'Marked as solved');
  });

  route('POST', '/discuss/:id/reopen', (ctx) => {
    const user = ctx.requireUser();
    const post = ctx.db.get('posts', ctx.params.id);
    if (!post || !canView(user, post)) ctx.notFound();
    if (!canManagePost(user, post)) throw new HttpError(403, 'Only the person who asked, or library staff, can reopen a question.');
    ctx.db.update('posts', post.id, { status: 'open', solvedAnswerId: null });
    ctx.redirect(`/discuss/${post.id}`, 'Question reopened');
  });

  // ---------- Turn a solved question into knowledge ----------
  route('GET', '/discuss/:id/share', (ctx) => {
    const { post, answers } = loadShareable(ctx);
    const solved = answers.find((a) => a.id === post.solvedAnswerId) || answers[0];
    const firstPara = solved.body.split(/\n\s*\n/)[0];
    sharePage(ctx, post, answers, {
      title: post.title.replace(/\?$/, ''),
      summary: firstPara.length > 240 ? firstPara.slice(0, 237) + '…' : firstPara,
      steps: solved.body,
      tags: post.tags.join(', '),
      include: [solved.id],
      credit: 'name',
    }, {});
  });

  route('POST', '/discuss/:id/share', (ctx) => {
    const user = ctx.user;
    const { post, answers } = loadShareable(ctx);
    const b = ctx.body;
    const values = {
      title: clean(b.title, 120), summary: clean(b.summary, 400), steps: clean(b.steps, 4000), tags: clean(b.tags, 200),
      include: [].concat(b.include || []).filter((id) => answers.some((a) => a.id === id)),
      credit: b.credit === 'anonymous' ? 'anonymous' : 'name', agree: b.agree === 'yes',
    };
    const errors = {};
    if (values.title.length < 5) errors.title = 'Enter a short title, at least 5 characters.';
    if (values.summary.length < 10) errors.summary = 'Enter a one or two sentence summary.';
    if (values.steps.length < 10) errors.steps = 'Enter the steps that solved the problem.';
    if (!values.include.length) errors.include = 'Choose at least one answer to include.';
    if (!values.agree) errors.agree = 'Confirm that you agree to share this entry.';
    if (Object.keys(errors).length) return sharePage(ctx, post, answers, values, errors);

    const isAsker = user.id === post.authorId;
    const contributors = [{ userId: post.authorId, role: 'asked the question', anonymous: isAsker && values.credit === 'anonymous' }];
    const pending = isAsker ? [] : [post.authorId];
    for (const a of answers.filter((x) => values.include.includes(x.id))) {
      if (!contributors.some((c) => c.userId === a.authorId)) {
        contributors.push({ userId: a.authorId, role: 'answered', anonymous: a.authorId === user.id && values.credit === 'anonymous' });
      }
      if (!a.shareConsent && a.authorId !== user.id && !pending.includes(a.authorId)) pending.push(a.authorId);
    }
    if (!contributors.some((c) => c.userId === user.id)) contributors.push({ userId: user.id, role: 'wrote this summary', anonymous: values.credit === 'anonymous' });

    const entry = ctx.db.insert('kb', {
      title: values.title, summary: values.summary, steps: values.steps, tags: parseTags(values.tags),
      sourcePostId: post.id, libraryId: post.libraryId, helpful: 0, contributors,
      includedAnswerIds: values.include, pendingConsents: pending,
      status: pending.length ? 'pending' : 'published', createdBy: user.id,
    });
    ctx.db.update('posts', post.id, { kbEntryId: entry.id });
    ctx.redirect(`/kb/${entry.id}`, pending.length ? 'Draft saved. Waiting for permission from everyone quoted' : 'Shared with the network. Thank you');
  });

  // ---------- Knowledge base ----------
  route('GET', '/kb', (ctx) => {
    const q = (ctx.query.q || '').trim().slice(0, 200);
    const results = searchKb(q);
    const { kbList } = require('./core');
    ctx.render(q ? `Knowledge base: ${results.length} results for “${q}”` : 'Knowledge base', html`
      <h1>Shared knowledge base</h1>
      <p class="lead">Solutions from patrons, trainers, and librarians across every library in the network, shared with their permission.</p>
      <form method="get" action="/kb" role="search" class="search-form">
        <label for="kq">Search the knowledge base</label>
        <div class="search-row"><input type="search" id="kq" name="q" value="${q}"><button type="submit">Search</button></div>
      </form>
      <h2>${q ? `${results.length} result${results.length === 1 ? '' : 's'} for “${q}”` : `All entries (${results.length})`}</h2>
      ${results.length ? kbList(results) : html`<p>No entries matched. <a href="/discuss/new?title=${encodeURIComponent(q)}">Ask the community</a>.</p>`}
    `, { status: q ? `${results.length} results` : undefined });
  });

  route('GET', '/kb/:id', (ctx) => {
    const { db, user } = ctx;
    const k = db.get('kb', ctx.params.id);
    if (!k || !kbVisible(user, k)) ctx.notFound();
    const lib = db.get('libraries', k.libraryId);
    const source = k.sourcePostId ? db.get('posts', k.sourcePostId) : null;
    const isContributor = user && k.contributors.some((c) => c.userId === user.id);
    const awaitingMe = user && (k.pendingConsents || []).includes(user.id);
    const canEdit = user && (isContributor || isStaff(user));
    ctx.render(k.title, html`
      <p class="breadcrumb"><a href="/kb">Knowledge base</a></p>
      <article aria-labelledby="kb-title">
        <h1 id="kb-title">${k.title}</h1>
        ${k.status === 'pending' ? html`<div class="warning"><p><strong>Draft, not public yet.</strong> Waiting for permission from: ${k.pendingConsents.map((id, i) => html`${i ? ', ' : ''}${db.get('users', id)?.displayName}`)}.</p></div>` : ''}
        <p class="lead">${k.summary}</p>
        <h2>Steps</h2>
        ${prose(k.steps)}
        ${v.tagList(k.tags)}
        <h2>Credit</h2>
        <ul>${k.contributors.map((c) => html`<li>${creditLabel(db, c)} — ${c.role}</li>`)}</ul>
        <p class="meta">First shared from ${lib.name}, ${lib.place}, on ${v.formatDate(k.createdAt)}.${k.lastEditedAt ? ` Last edited ${v.formatDate(k.lastEditedAt)}.` : ''}
        ${source && user && canView(user, source) ? html` <a href="/discuss/${source.id}">Read the original conversation</a>.` : ''}</p>
      </article>
      ${awaitingMe ? html`<section aria-labelledby="consent-heading" class="panel">
        <h2 id="consent-heading">Your permission is needed</h2>
        <p>This entry quotes you. It will be published to every library in the network only if you agree.</p>
        <form method="post" action="/kb/${k.id}/consent">${v.csrfField(ctx.session)}
          ${v.choices({ name: 'credit', legend: 'How should we credit you?', options: [['name', 'Use my display name'], ['anonymous', 'Say “a member at my library” instead of my name']], value: 'name' })}
          <button type="submit">I agree to share this</button>
        </form>
        <form method="post" action="/kb/${k.id}/withdraw" class="inline-form">${v.csrfField(ctx.session)}
          <button type="submit" class="secondary">I do not agree</button></form>
      </section>` : ''}
      ${k.status === 'published' ? html`<form method="post" action="/kb/${k.id}/helpful" class="inline-form">${v.csrfField(ctx.session)}
        <p>${k.helpful} ${k.helpful === 1 ? 'person' : 'people'} found this helpful.</p>
        <button type="submit" class="secondary">This helped me</button></form>` : ''}
      ${canEdit ? html`<h2>Manage this entry</h2><ul class="action-list">
        <li><a href="/kb/${k.id}/edit">Edit this entry</a></li>
        ${isContributor && !awaitingMe ? html`<li><form method="post" action="/kb/${k.id}/withdraw">${v.csrfField(ctx.session)}
          <button type="submit" class="link-button">Withdraw my contribution (removes this entry from the network)</button></form></li>` : ''}
      </ul>` : ''}
    `);
  });

  route('POST', '/kb/:id/consent', (ctx) => {
    const user = ctx.requireUser();
    const k = ctx.db.get('kb', ctx.params.id);
    if (!k || !(k.pendingConsents || []).includes(user.id)) ctx.notFound();
    const pending = k.pendingConsents.filter((id) => id !== user.id);
    const contributors = k.contributors.map((c) => (c.userId === user.id ? { ...c, anonymous: ctx.body.credit === 'anonymous' } : c));
    ctx.db.update('kb', k.id, { pendingConsents: pending, contributors, status: pending.length ? 'pending' : 'published' });
    ctx.redirect(`/kb/${k.id}`, pending.length ? 'Thank you. Still waiting for others to agree' : 'Thank you. The entry is now shared with the network');
  });

  route('POST', '/kb/:id/withdraw', (ctx) => {
    const user = ctx.requireUser();
    const k = ctx.db.get('kb', ctx.params.id);
    if (!k || !k.contributors.some((c) => c.userId === user.id)) ctx.notFound();
    ctx.db.update('kb', k.id, { status: 'withdrawn', withdrawnBy: user.id, pendingConsents: [] });
    if (k.sourcePostId) ctx.db.update('posts', k.sourcePostId, { kbEntryId: null });
    ctx.redirect(k.sourcePostId ? `/discuss/${k.sourcePostId}` : '/kb', 'Entry withdrawn. It is no longer shared');
  });

  route('POST', '/kb/:id/helpful', (ctx) => {
    const k = ctx.db.get('kb', ctx.params.id);
    if (!k || k.status === 'withdrawn' || k.status === 'pending') ctx.notFound();
    ctx.session.helpful = ctx.session.helpful || [];
    if (!ctx.session.helpful.includes(k.id)) {
      ctx.session.helpful.push(k.id);
      ctx.db.update('kb', k.id, { helpful: (k.helpful || 0) + 1 }, { touch: false });
    }
    ctx.redirect(`/kb/${k.id}`, 'Thank you for your feedback');
  });

  route('GET', '/kb/:id/edit', (ctx) => {
    const { k } = loadEditable(ctx);
    kbEditPage(ctx, k, { title: k.title, summary: k.summary, steps: k.steps, tags: k.tags.join(', ') }, {});
  });

  route('POST', '/kb/:id/edit', (ctx) => {
    const { k, user } = loadEditable(ctx);
    const b = ctx.body;
    const values = { title: clean(b.title, 120), summary: clean(b.summary, 400), steps: clean(b.steps, 4000), tags: clean(b.tags, 200) };
    const errors = {};
    if (values.title.length < 5) errors.title = 'Enter a short title, at least 5 characters.';
    if (values.summary.length < 10) errors.summary = 'Enter a one or two sentence summary.';
    if (values.steps.length < 10) errors.steps = 'Enter the steps.';
    if (Object.keys(errors).length) return kbEditPage(ctx, k, values, errors);
    const contributors = k.contributors.some((c) => c.userId === user.id) ? k.contributors : [...k.contributors, { userId: user.id, role: 'edited', anonymous: false }];
    ctx.db.update('kb', k.id, { ...values, tags: parseTags(values.tags), contributors, lastEditedBy: user.id, lastEditedAt: ctx.db.now() });
    ctx.redirect(`/kb/${k.id}`, 'Entry updated');
  });

  // ---------- Share a tip ----------
  route('GET', '/share', (ctx) => {
    if (!ctx.user) {
      return ctx.render('Share a tip', html`
        <h1>Share a tip</h1>
        <p class="lead">Patrons are teachers too. A shortcut, a workaround, or a website that works well with JAWS can help someone at another library.</p>
        <p><a href="/signin?next=/share">Sign in to share a tip</a>.</p>`);
    }
    tipPage(ctx, { scope: 'network', addToKb: 'yes', credit: 'name' }, {});
  });

  route('POST', '/share', (ctx) => {
    const user = ctx.requireUser();
    const b = ctx.body;
    const values = { title: clean(b.title, 150), body: clean(b.body, 4000), tags: clean(b.tags, 200), scope: b.scope === 'library' ? 'library' : 'network', addToKb: b.addToKb === 'yes' ? 'yes' : '', credit: b.credit === 'anonymous' ? 'anonymous' : 'name' };
    const errors = {};
    if (values.title.length < 5) errors.title = 'Give your tip a short title, at least 5 characters.';
    if (values.body.length < 10) errors.body = 'Describe your tip in at least a sentence.';
    if (Object.keys(errors).length) return tipPage(ctx, values, errors);
    const post = ctx.db.insert('posts', { type: 'tip', title: values.title, body: values.body, authorId: user.id, libraryId: user.libraryId, scope: values.scope, tags: parseTags(values.tags), status: 'shared' });
    if (values.addToKb) {
      const summary = values.body.split(/(?<=[.!?])\s/)[0].slice(0, 300);
      const k = ctx.db.insert('kb', { title: values.title.replace(/^tip:\s*/i, ''), summary, steps: values.body, tags: parseTags(values.tags), sourcePostId: post.id, libraryId: user.libraryId, helpful: 0, contributors: [{ userId: user.id, role: 'shared the tip', anonymous: values.credit === 'anonymous' }], pendingConsents: [], status: 'published', createdBy: user.id });
      ctx.db.update('posts', post.id, { kbEntryId: k.id });
      return ctx.redirect(`/kb/${k.id}`, 'Tip shared and added to the knowledge base. Thank you');
    }
    ctx.redirect(`/discuss/${post.id}`, 'Tip shared. Thank you');
  });

  // ---------- Trainer requests ----------
  route('GET', '/requests', (ctx) => {
    const user = ctx.requireUser();
    const { db } = ctx;
    const mine = db.where('requests', (r) => r.patronId === user.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    ctx.render('My trainer requests', html`
      <h1>My trainer requests</h1>
      <p><a class="button" href="/requests/new">Request a trainer</a></p>
      ${isStaff(user) ? html`<p>Staff: see every request for your library on the <a href="/dashboard">staff dashboard</a>.</p>` : ''}
      ${mine.length ? html`<ul class="card-list">${mine.map((r) => requestCard(db, r))}</ul>` : html`<p>You have not requested a trainer yet.</p>`}
    `);
  });

  route('GET', '/requests/new', (ctx) => {
    const user = ctx.requireUser();
    requestPage(ctx, { topic: ctx.query.topic || '', format: 'in-person', libraryId: user.libraryId }, {});
  });

  route('POST', '/requests/new', (ctx) => {
    const user = ctx.requireUser();
    const b = ctx.body;
    const values = { topic: clean(b.topic, 150), details: clean(b.details, 2000), format: ['in-person', 'phone', 'either'].includes(b.format) ? b.format : '', availability: clean(b.availability, 200), libraryId: ctx.db.get('libraries', b.libraryId) ? b.libraryId : '' };
    const errors = {};
    if (values.topic.length < 3) errors.topic = 'Tell us what you would like to learn.';
    if (!values.format) errors.format = 'Choose how you would like to meet.';
    if (!values.libraryId) errors.libraryId = 'Choose a library.';
    if (Object.keys(errors).length) return requestPage(ctx, values, errors);
    ctx.db.insert('requests', { patronId: user.id, ...values, status: 'new', trainerId: null });
    ctx.redirect('/requests', 'Request sent. Library staff will reply here');
  });
};

// ---------- helpers and page builders ----------

function postCard(db, p) {
  const answers = db.where('answers', (a) => a.postId === p.id).length;
  const lib = db.get('libraries', p.libraryId);
  return html`<li class="card">
    <h3><a href="/discuss/${p.id}">${p.title}</a></h3>
    <p class="meta">${p.type === 'tip' ? 'Tip' : 'Question'} from ${db.get('users', p.authorId)?.displayName}, ${lib.place}.
      ${p.type === 'question' ? `${answers} answer${answers === 1 ? '' : 's'}.` : ''}
      ${p.status === 'solved' ? v.statusBadge('Solved', 'good') : p.status === 'open' ? v.statusBadge('Open', 'neutral') : ''}
      ${p.kbEntryId ? v.statusBadge('In knowledge base', 'good') : ''}
      ${p.scope === 'library' ? v.statusBadge(`${lib.name} only`, 'neutral') : ''}</p>
  </li>`;
}

function kbStatusBox(ctx, post, kb) {
  if (post.type !== 'question') {
    return kb && kb.status !== 'withdrawn' ? html`<p class="note">This tip is in the knowledge base: <a href="/kb/${kb.id}">${kb.title}</a>.</p>` : '';
  }
  if (kb && kb.status === 'published') return html`<p class="note">This solution is shared with the network: <a href="/kb/${kb.id}">${kb.title}</a>.</p>`;
  if (kb && kb.status === 'pending') return html`<p class="note">A knowledge-base draft is waiting for permission: <a href="/kb/${kb.id}">${kb.title}</a>.</p>`;
  if (post.status === 'solved' && canManagePost(ctx.user, post)) {
    return html`<section class="panel" aria-labelledby="share-heading">
      <h2 id="share-heading">Help the next person</h2>
      <p>This question is solved. You can turn it into a short knowledge-base entry so patrons at other libraries can find it. You choose what is shared and how you are credited. Nothing is shared until you publish it.</p>
      <p><a class="button" href="/discuss/${post.id}/share">Share this solution with the network</a></p>
    </section>`;
  }
  return '';
}

function loadShareable(ctx) {
  const user = ctx.requireUser();
  const post = ctx.db.get('posts', ctx.params.id);
  if (!post || !canView(user, post)) ctx.notFound();
  if (!canManagePost(user, post)) throw new HttpError(403, 'Only the person who asked, or library staff, can share this conversation.');
  if (post.status !== 'solved') throw new HttpError(403, 'Mark the question solved before sharing it.');
  if (post.kbEntryId) {
    const existing = ctx.db.get('kb', post.kbEntryId);
    if (existing && existing.status !== 'withdrawn') throw new HttpError(403, 'This conversation is already in the knowledge base.');
  }
  const answers = ctx.db.where('answers', (a) => a.postId === post.id && a.authorId !== post.authorId);
  if (!answers.length) throw new HttpError(403, 'There are no answers to share yet.');
  return { post, answers, user };
}

function loadEditable(ctx) {
  const user = ctx.requireUser();
  const k = ctx.db.get('kb', ctx.params.id);
  if (!k || k.status === 'withdrawn') ctx.notFound();
  if (!(isStaff(user) || k.contributors.some((c) => c.userId === user.id))) throw new HttpError(403, 'Only contributors and library staff can edit this entry.');
  return { k, user };
}

function sharePage(ctx, post, answers, values, errors) {
  const { db, user } = ctx;
  const isAsker = user.id === post.authorId;
  ctx.render('Share this solution', html`
    <p class="breadcrumb"><a href="/discuss/${post.id}">Back to the question</a></p>
    <h1>Share this solution with the network</h1>
    <p class="lead">Write a short entry that someone at another library can follow. Edit anything below. Private details, like names of websites you use or personal information, should be removed.</p>
    ${v.errorSummary(errors)}
    <form method="post" action="/discuss/${post.id}/share" novalidate>
      ${v.csrfField(ctx.session)}
      ${v.input({ name: 'title', label: 'Title', hint: 'What does this help someone do? For example: Read Gmail with JAWS.', value: values.title, required: true, error: errors.title })}
      ${v.textarea({ name: 'summary', label: 'Summary', hint: 'One or two sentences.', value: values.summary, required: true, rows: 3, error: errors.summary })}
      ${v.textarea({ name: 'steps', label: 'Steps', hint: 'Put each step on its own line, starting with 1., 2., 3. or a dash.', value: values.steps, required: true, rows: 10, error: errors.steps })}
      ${v.input({ name: 'tags', label: 'Topics', hint: 'Separate with commas, for example: gmail, email.', value: values.tags })}
      ${v.choices({ name: 'include', type: 'checkbox', legend: 'Which answers does this entry use? Their authors will be credited.', error: errors.include, value: values.include,
        options: answers.map((a) => [a.id, html`Answer from ${db.get('users', a.authorId).displayName}${a.id === post.solvedAnswerId ? ' (solved the problem)' : ''}`,
          a.shareConsent || a.authorId === user.id ? 'Has agreed to be shared with credit.' : `We will ask ${db.get('users', a.authorId).displayName} for permission before this is published.`]) })}
      ${isAsker ? '' : html`<p class="note">You are sharing on behalf of ${db.get('users', post.authorId).displayName}, who asked the question. The entry will be published only after they agree.</p>`}
      ${v.choices({ name: 'credit', legend: 'How should we credit you?', value: values.credit, options: [['name', `Use my display name (${user.displayName})`], ['anonymous', 'Say “a member at my library” instead of my name']] })}
      ${v.choices({ name: 'agree', type: 'checkbox', legend: 'Permission', error: errors.agree, value: values.agree ? ['yes'] : [], options: [['yes', 'I agree to share this entry with every library in the network. I can withdraw it later.']] })}
      <button type="submit">Publish to the knowledge base</button>
    </form>
  `, { code: Object.keys(errors).length ? 400 : 200, status: Object.keys(errors).length ? 'Error' : undefined });
}

function kbEditPage(ctx, k, values, errors) {
  ctx.render(`Edit: ${k.title}`, html`
    <p class="breadcrumb"><a href="/kb/${k.id}">Back to the entry</a></p>
    <h1>Edit knowledge-base entry</h1>
    ${v.errorSummary(errors)}
    <form method="post" action="/kb/${k.id}/edit" novalidate>
      ${v.csrfField(ctx.session)}
      ${v.input({ name: 'title', label: 'Title', value: values.title, required: true, error: errors.title })}
      ${v.textarea({ name: 'summary', label: 'Summary', value: values.summary, required: true, rows: 3, error: errors.summary })}
      ${v.textarea({ name: 'steps', label: 'Steps', hint: 'Put each step on its own line, starting with 1., 2., 3. or a dash.', value: values.steps, required: true, rows: 10, error: errors.steps })}
      ${v.input({ name: 'tags', label: 'Topics', hint: 'Separate with commas.', value: values.tags })}
      <button type="submit">Save changes</button>
    </form>
  `, { code: Object.keys(errors).length ? 400 : 200, status: Object.keys(errors).length ? 'Error' : undefined });
}

function newQuestionPage(ctx, values, errors) {
  const lib = ctx.library;
  const lesson = LESSONS.find((l) => l.id === values.lesson);
  ctx.render('Ask a question', html`
    <h1>Ask a question</h1>
    <p class="lead">Trainers, librarians, and other patrons can answer. Please do not include passwords, phone numbers, or other private information.</p>
    ${lesson ? html`<p class="note">Your question will be linked to the lesson “${lesson.title}”.</p>` : ''}
    ${v.errorSummary(errors)}
    <form method="post" action="/discuss/new" novalidate>
      ${v.csrfField(ctx.session)}
      <input type="hidden" name="lesson" value="${values.lesson || ''}">
      ${v.input({ name: 'title', label: 'Your question', hint: 'For example: How do I use JAWS to read Gmail?', value: values.title, required: true, error: errors.title })}
      ${v.textarea({ name: 'body', label: 'More detail', hint: 'What did you try? What did JAWS say?', value: values.body, rows: 5 })}
      ${v.input({ name: 'tags', label: 'Topics', hint: 'Separate with commas, for example: gmail, email.', value: values.tags })}
      ${v.choices({ name: 'scope', legend: 'Who can see this question?', value: values.scope, options: [
        ['network', 'Everyone in the network', 'More people can help, including trainers at other libraries.'],
        ['library', `Only people at ${lib.name} and network staff`, 'Use this for questions about your library\'s own computers or printers.']] })}
      <button type="submit">Post question</button>
    </form>
  `, { code: Object.keys(errors).length ? 400 : 200, status: Object.keys(errors).length ? 'Error' : undefined });
}

function tipPage(ctx, values, errors) {
  ctx.render('Share a tip', html`
    <h1>Share a tip</h1>
    <p class="lead">Patrons are teachers too. A shortcut, a workaround, or a website that works well with JAWS can help someone at another library.</p>
    ${v.errorSummary(errors)}
    <form method="post" action="/share" novalidate>
      ${v.csrfField(ctx.session)}
      ${v.input({ name: 'title', label: 'Tip title', hint: 'For example: Jump to the search box in Gmail with the slash key.', value: values.title, required: true, error: errors.title })}
      ${v.textarea({ name: 'body', label: 'Your tip', hint: 'Name the exact keys and the program or website.', value: values.body, required: true, rows: 6, error: errors.body })}
      ${v.input({ name: 'tags', label: 'Topics', hint: 'Separate with commas.', value: values.tags })}
      ${v.choices({ name: 'scope', legend: 'Who can see this tip in discussions?', value: values.scope, options: [['network', 'Everyone in the network'], ['library', 'Only people at my library and network staff']] })}
      ${v.choices({ name: 'addToKb', type: 'checkbox', legend: 'Knowledge base', value: values.addToKb ? ['yes'] : [], options: [['yes', 'Also add this tip to the shared knowledge base so anyone can find it.', 'You can withdraw it later.']] })}
      ${v.choices({ name: 'credit', legend: 'How should we credit you?', value: values.credit, options: [['name', 'Use my display name'], ['anonymous', 'Say “a member at my library” instead of my name']] })}
      <button type="submit">Share tip</button>
    </form>
  `, { code: Object.keys(errors).length ? 400 : 200, status: Object.keys(errors).length ? 'Error' : undefined });
}

const FORMAT_LABEL = { 'in-person': 'In person at the library', phone: 'By phone', either: 'Either' };
const REQUEST_STATUS = { new: ['New', 'neutral'], scheduled: ['Scheduled', 'good'], completed: ['Completed', 'good'], cancelled: ['Cancelled', 'planned'] };

function requestCard(db, r, { staffView = false } = {}) {
  const lib = db.get('libraries', r.libraryId);
  const trainer = r.trainerId ? db.get('users', r.trainerId) : null;
  const [label, kind] = REQUEST_STATUS[r.status] || ['Unknown', 'neutral'];
  return html`<li class="card">
    <h3>${r.topic}</h3>
    <p class="meta">${v.statusBadge(label, kind)} ${FORMAT_LABEL[r.format]}, ${lib.name}. Requested ${v.formatDate(r.createdAt)}${staffView ? html` by ${personLink(db, r.patronId)}` : ''}.</p>
    ${r.details ? prose(r.details) : ''}
    ${r.availability ? html`<p>Availability: ${r.availability}</p>` : ''}
    ${trainer ? html`<p>Trainer: ${personLink(db, trainer.id)}</p>` : ''}
    ${r.staffNote ? html`<p><strong>Note from staff:</strong> ${r.staffNote}</p>` : ''}
  </li>`;
}

function requestPage(ctx, values, errors) {
  const libs = ctx.db.all('libraries');
  ctx.render('Request a trainer', html`
    <h1>Request a trainer</h1>
    <p class="lead">A trainer or librarian will reply on your <a href="/requests">trainer requests page</a> and at the library help desk.</p>
    <p>Please do not include your phone number, address, or other private details here.</p>
    ${v.errorSummary(errors)}
    <form method="post" action="/requests/new" novalidate>
      ${v.csrfField(ctx.session)}
      ${v.input({ name: 'topic', label: 'What would you like to learn?', hint: 'For example: Read Gmail with JAWS.', value: values.topic, required: true, error: errors.topic })}
      ${v.textarea({ name: 'details', label: 'Anything the trainer should know', hint: 'For example, what you already know, or equipment you will bring.', value: values.details, rows: 4 })}
      ${v.choices({ name: 'format', legend: 'How would you like to meet?', value: values.format, error: errors.format, options: Object.entries(FORMAT_LABEL) })}
      ${v.input({ name: 'availability', label: 'When are you usually available?', hint: 'For example: weekday mornings.', value: values.availability })}
      ${v.select({ name: 'libraryId', label: 'Which library?', value: values.libraryId, error: errors.libraryId, options: libs.map((l) => [l.id, `${l.name}, ${l.place}`]) })}
      <button type="submit">Send request</button>
    </form>
  `, { code: Object.keys(errors).length ? 400 : 200, status: Object.keys(errors).length ? 'Error' : undefined });
}

module.exports.requestCard = requestCard;
module.exports.postCard = postCard;
module.exports.REQUEST_STATUS = REQUEST_STATUS;
module.exports.isStaff = isStaff;
module.exports.canView = canView;
