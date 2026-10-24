// Run with: node --test tests/
// Checks the built-in engine with no browser and no API key.
const test = require('node:test');
const assert = require('node:assert');
const H = require('../engine.js');

const PHRASES = [
  'I scream', 'recognize speech', 'the human condition', 'break a leg', 'good morning',
  'my cat is a genius', 'where are my keys', 'hello', 'a nice man', 'the weather is nice today',
  'I need coffee before the meeting', 'nowhere', 'Supercalifragilistic', 'xyzzy', '42', 'ok'
];

test('returns five complete interpretations for many phrases', () => {
  for (const p of PHRASES) {
    const r = H.generate(p, { seed: 7 });
    assert.ok(r.heard, `heard is set for "${p}"`);
    assert.strictEqual(r.interpretations.length, 5, `five results for "${p}"`);
    for (const it of r.interpretations) {
      for (const f of ['key', 'text', 'methodLabel', 'explanation', 'kindLabel', 'idea']) {
        assert.ok(typeof it[f] === 'string' && it[f].length, `"${p}" has ${f}`);
      }
      assert.doesNotMatch(it.idea, /\{[a-zA-Z]+\}/, `no unfilled template in "${it.idea}"`);
      assert.doesNotMatch(it.idea, /^(Invention|Observation|Joke|Art concept|Poem):/, 'label is split off');
      assert.notStrictEqual(it.text.toLowerCase(), r.heard.toLowerCase(), 'differs from the original');
    }
    const texts = r.interpretations.map((i) => i.text.toLowerCase());
    assert.strictEqual(new Set(texts).size, texts.length, `no duplicate texts for "${p}"`);
  }
});

test('finds the classic examples', () => {
  const has = (p, want) => {
    const r = H.generate(p, { seed: 1 });
    assert.ok(r.interpretations.some((i) => i.text.toLowerCase() === want), `"${p}" -> "${want}"`);
  };
  has('I scream', 'ice cream');
  has('recognize speech', 'wreck a nice beach');
  has('the human condition', 'the humid condition');
  has('ice cream', 'i scream');
});

test('mixes several methods and kinds of idea', () => {
  const r = H.generate('the weather is nice today', { seed: 3 });
  assert.ok(new Set(r.interpretations.map((i) => i.method)).size >= 3);
  assert.ok(new Set(r.interpretations.map((i) => i.kind)).size >= 3);
});

test('"More" never repeats an interpretation already shown', () => {
  const shown = [];
  const used = {};
  for (let round = 0; round < 6; round++) {
    const r = H.generate('my cat is a genius', { seed: 100 + round, exclude: shown, usedTemplates: used });
    assert.strictEqual(r.interpretations.length, 5);
    for (const it of r.interpretations) {
      assert.ok(!shown.includes(it.key), `round ${round} repeated ${it.key}`);
      shown.push(it.key);
    }
  }
});

test('uses speech recogniser alternatives first', () => {
  const r = H.generate('recognize speech', { seed: 2, alternatives: ['wreck a nice peach'] });
  assert.strictEqual(r.interpretations[0].method, 'recogniser');
  assert.strictEqual(r.interpretations[0].text, 'Wreck a nice peach');
});

test('same seed gives the same result; different seeds vary', () => {
  const a = JSON.stringify(H.generate('good morning', { seed: 5 }));
  const b = JSON.stringify(H.generate('good morning', { seed: 5 }));
  assert.strictEqual(a, b);
  const ideas = new Set();
  for (let s = 0; s < 10; s++) H.generate('good morning', { seed: s }).interpretations.forEach((i) => ideas.add(i.idea));
  assert.ok(ideas.size > 15, 'varied ideas across seeds');
});

test('handles empty and messy input safely', () => {
  assert.strictEqual(H.generate('').interpretations.length, 0);
  assert.strictEqual(H.generate('   !!! ').interpretations.length, 0);
  const r = H.generate('  “Hello,”   WORLD!!  ');
  assert.strictEqual(r.heard, 'Hello world');
  assert.strictEqual(r.interpretations.length, 5);
});

test('sound key treats look-alike spellings as similar', () => {
  const k = H._internal.soundKey;
  assert.strictEqual(k('knight'), k('night'));
  assert.strictEqual(k('phone'), k('fone'));
});
