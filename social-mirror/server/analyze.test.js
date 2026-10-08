import test from 'node:test';
import assert from 'node:assert/strict';
import { aggregate, quoteIsGenuine, usesWord } from './analyze.js';
import { parseVideoId } from './youtube.js';
import { demoComments, demoLabels } from './demo.js';

test('quotes must appear in the comment', () => {
  assert.ok(quoteIsGenuine('so  ARROGANT', 'He is so arrogant.'));
  assert.ok(quoteIsGenuine('he’s smug', "he's smug"));
  assert.ok(!quoteIsGenuine('so rude', 'He is so arrogant.'));
  assert.ok(!quoteIsGenuine('', 'anything'));
});

test('usesWord matches whole words with simple suffixes only', () => {
  assert.ok(usesWord('snide', 'That was SNIDE.'));
  assert.ok(usesWord('kind', 'kindly put'));
  assert.ok(!usesWord('kind', 'mankind'));
  assert.ok(!usesWord('arrogant', 'arrogance'));
  assert.ok(usesWord('soft-spoken', 'very soft-spoken guy'));
});

test('aggregate counts distinct commenters, not comments', () => {
  const terms = aggregate(demoLabels, demoComments);
  const arrogant = terms.find((t) => t.term === 'arrogant');
  // SampleUser_B said it twice (comments 2 and 13) — counted once.
  assert.equal(arrogant.commenters, 2);
  assert.equal(arrogant.evidence.length, 3);
  assert.equal(arrogant.verbatimCommenters, 2);
  const condescending = terms.find((t) => t.term === 'condescending');
  assert.equal(condescending.verbatimCommenters, 0);
  assert.deepEqual(terms.find((t) => t.term === 'snide').byPlatform, { youtube: 1, reddit: 1 });
  assert.equal(terms.find((t) => t.term === 'overrated').aboutPerson, false);
});

test('every demo label quote is genuine', () => {
  for (const l of demoLabels) {
    const c = demoComments.find((x) => x.id === l.commentId);
    assert.ok(quoteIsGenuine(l.quote, c.text), `${l.term}: ${l.quote}`);
  }
});

test('parseVideoId', () => {
  assert.equal(parseVideoId('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=5'), 'dQw4w9WgXcQ');
  assert.equal(parseVideoId('https://youtu.be/dQw4w9WgXcQ?si=x'), 'dQw4w9WgXcQ');
  assert.equal(parseVideoId('youtube.com/shorts/dQw4w9WgXcQ'), 'dQw4w9WgXcQ');
  assert.equal(parseVideoId('https://example.com/watch?v=dQw4w9WgXcQ'), null);
});

test('parseDuration', async () => {
  const { parseDuration } = await import('./youtube.js');
  assert.equal(parseDuration('PT4M13S'), 253);
  assert.equal(parseDuration('PT1H'), 3600);
  assert.equal(parseDuration('P0D'), 0);
  assert.equal(parseDuration('garbage'), null);
});
