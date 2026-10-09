'use strict';
// End-to-end test of the first milestone: a patron asks for help, a trainer
// answers, the patron confirms the answer, and the solution becomes searchable
// knowledge that a patron at another library can find.

const test = require('node:test');
const assert = require('node:assert/strict');
const { startApp, Client, titleOf } = require('./helpers');

test('demonstration scenario: Gmail question becomes network knowledge', async (t) => {
  const app = await startApp();
  t.after(app.close);
  const maya = new Client(app.base);
  const andre = new Client(app.base);
  const jordan = new Client(app.base);

  // Before: nobody at any library has shared a Gmail answer.
  await jordan.signIn('jordan');
  let r = await jordan.get('/kb?q=gmail');
  assert.match(r.text, /0 results for “gmail”/);

  // 1. Maya (DC) finds the lesson, then asks her question from it.
  await maya.signIn('maya');
  r = await maya.get('/search?q=How+do+I+use+JAWS+to+read+Gmail');
  assert.match(r.text, /href="\/learn\/gmail-with-jaws"/, 'search finds the Gmail lesson');
  r = await maya.get('/learn/gmail-with-jaws');
  assert.match(r.text, /Insert\+Z/);
  r = await maya.submit('/discuss/new?lesson=gmail-with-jaws', '/discuss/new', {
    title: 'How do I use JAWS to read Gmail?', body: 'JAWS jumps around the page when I press J.',
    tags: 'gmail, email', scope: 'network', lesson: 'gmail-with-jaws',
  });
  assert.equal(r.postStatus, 303);
  const postUrl = r.redirectedTo;
  assert.match(postUrl, /^\/discuss\/pos-/);
  assert.match(titleOf(r.text), /^Your question was posted/);

  // Private: the question is not in the knowledge base yet.
  r = await jordan.get('/kb?q=gmail');
  assert.match(r.text, /0 results/);

  // 2. Andre (trainer, Arlington) sees it on the dashboard and answers, agreeing to share.
  await andre.signIn('andre');
  r = await andre.get('/dashboard?library=all');
  assert.match(r.text, /How do I use JAWS to read Gmail\?/);
  r = await andre.submit(postUrl, `${postUrl}/answers`, {
    body: '1. Press Insert+Z to turn off the Virtual PC Cursor.\n2. Press J and K to move between conversations.\n3. Press O to open one, then Insert+Z and Insert+Down Arrow to read it.',
    shareConsent: 'yes',
  });
  assert.match(titleOf(r.text), /^Your answer was posted/);

  // Only the asker (or staff) may mark it solved: Jordan cannot.
  const answerId = app.db.where('answers', (a) => a.authorId === 'usr-andre' && postUrl.endsWith(a.postId))[0].id;
  r = await jordan.submit(postUrl, `${postUrl}/solve`, { answerId });
  assert.equal(r.postStatus, 403);

  // 3. Maya marks it solved.
  r = await maya.submit(postUrl, `${postUrl}/solve`, { answerId });
  assert.match(titleOf(r.text), /^Marked as solved/);
  assert.match(r.text, /Share this solution with the network/);

  // 4. Maya edits and shares the solution, credited by name.
  r = await maya.get(`${postUrl}/share`);
  assert.match(r.text, /Answer from Andre W\./);
  // Missing agreement checkbox is reported as an error, nothing published.
  r = await maya.submit(`${postUrl}/share`, `${postUrl}/share`, {
    title: 'Read Gmail with JAWS', summary: 'Turn off the Virtual PC Cursor, then use Gmail shortcuts J, K and O.',
    steps: '1. Insert+Z\n2. J and K\n3. O', tags: 'gmail, email, jaws', include: answerId, credit: 'name',
  });
  assert.equal(r.postStatus, 400);
  assert.match(r.text, /Confirm that you agree to share this entry/);
  r = await maya.submit(`${postUrl}/share`, `${postUrl}/share`, {
    title: 'Read Gmail with JAWS', summary: 'Turn off the Virtual PC Cursor, then use Gmail shortcuts J, K and O.',
    steps: '1. Press Insert+Z.\n2. Press J and K to move.\n3. Press O to open.', tags: 'gmail, email, jaws',
    include: answerId, credit: 'name', agree: 'yes',
  });
  assert.match(titleOf(r.text), /^Shared with the network/);
  const kbUrl = r.redirectedTo;

  // 5. Jordan at a different library (Prince George's County) finds it, with credit.
  r = await jordan.get('/kb?q=gmail');
  assert.match(r.text, /1 result for “gmail”/);
  r = await jordan.get(kbUrl);
  assert.match(r.text, /Maya R\.<\/a> — asked the question/);
  assert.match(r.text, /Andre W\.<\/a> — answered/);
  assert.match(r.text, /First shared from Downtown Demo Library, Washington, DC/);
  // Even visitors who are not signed in can find shared knowledge.
  r = await new Client(app.base).get('/search?q=gmail');
  assert.match(r.text, /Read Gmail with JAWS/);
});

test('consent: a librarian draft stays private until every participant agrees', async (t) => {
  const app = await startApp();
  t.after(app.close);
  const sam = new Client(app.base);
  const jordan = new Client(app.base);
  await sam.signIn('sam');
  await jordan.signIn('jordan');

  // Jordan asks at the PG branch; Sam answers WITHOUT agreeing to share; Jordan marks solved.
  let r = await jordan.submit('/discuss/new', '/discuss/new', { title: 'How do I scan a letter at the branch?', scope: 'library' });
  const postUrl = r.redirectedTo;
  await sam.submit(postUrl, `${postUrl}/answers`, { body: 'Use the scanner by the front desk and ask staff to email the file.' });
  const answer = app.db.where('answers', (a) => postUrl.endsWith(a.postId))[0];
  await jordan.submit(postUrl, `${postUrl}/solve`, { answerId: answer.id });

  // The librarian shares on Jordan's behalf: becomes a pending draft, not public.
  r = await sam.submit(`${postUrl}/share`, `${postUrl}/share`, {
    title: 'Scanning a letter at the branch', summary: 'Use the scanner by the front desk.', steps: 'Ask staff at the front desk.',
    include: answer.id, credit: 'name', agree: 'yes',
  });
  assert.match(titleOf(r.text), /Waiting for permission/);
  const kbUrl = r.redirectedTo;
  const anon = new Client(app.base);
  assert.equal((await anon.get(kbUrl)).status, 404, 'pending draft is not public');
  assert.doesNotMatch((await anon.get('/kb?q=scanning')).text, /Scanning a letter/);

  // Jordan agrees, choosing anonymous credit. Now it is public, without Jordan's name.
  r = await jordan.submit(kbUrl, `${kbUrl}/consent`, { credit: 'anonymous' });
  assert.match(titleOf(r.text), /now shared/);
  r = await anon.get(kbUrl);
  assert.equal(r.status, 200);
  assert.match(r.text, /A patron at Demo Branch Library — asked the question/);
  assert.doesNotMatch(r.text, /Jordan T\./);

  // Jordan can withdraw; the entry disappears from the network.
  await jordan.submit(kbUrl, `${kbUrl}/withdraw`, {});
  assert.equal((await anon.get(kbUrl)).status, 404);
});

test('library-only discussions are private to that library and staff', async (t) => {
  const app = await startApp();
  t.after(app.close);
  const devon = new Client(app.base); // Arlington patron
  await devon.signIn('devon');
  assert.equal((await devon.get('/discuss/pos-print')).status, 404, 'PG library-only post hidden from Arlington patron');
  const sam = new Client(app.base);
  await sam.signIn('sam');
  assert.equal((await sam.get('/discuss/pos-print')).status, 200);
});
