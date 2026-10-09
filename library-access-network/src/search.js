'use strict';
// Simple keyword search across community knowledge, lessons, and commands.
// Extension point: swap for SQLite FTS5 or a hosted search service later.

const db = require('./db');
const { LESSONS } = require('./content/lessons');
const { searchCommands } = require('./content/jaws-commands');

function terms(q) {
  return String(q || '').toLowerCase().replace(/[^\p{L}\p{N}+\s'-]/gu, ' ').split(/\s+/)
    .filter((t) => t.length > 1 && !STOP.has(t));
}
const STOP = new Set(['how', 'do', 'to', 'the', 'a', 'an', 'in', 'on', 'with', 'my', 'and', 'or', 'of', 'for', 'is', 'it', 'can', 'use', 'what', 'i']);

// Score = number of query terms found, with title matches counted double.
function score(qTerms, title, rest) {
  const t = title.toLowerCase();
  const r = rest.toLowerCase();
  let s = 0;
  let matched = 0;
  for (const term of qTerms) {
    const inTitle = t.includes(term);
    const inRest = r.includes(term);
    if (inTitle || inRest) matched++;
    s += (inTitle ? 2 : 0) + (inRest ? 1 : 0);
  }
  return matched ? s + matched * 3 : 0;
}

function searchKb(q) {
  const published = db.where('kb', (k) => (k.status || 'published') === 'published');
  const qTerms = terms(q);
  if (!qTerms.length) return published.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return published
    .map((k) => ({ k, s: score(qTerms, k.title, `${k.summary} ${k.steps} ${(k.tags || []).join(' ')}`) }))
    .filter((x) => x.s > 0).sort((a, b) => b.s - a.s).map((x) => x.k);
}

function searchLessons(q) {
  const qTerms = terms(q);
  if (!qTerms.length) return LESSONS;
  return LESSONS
    .map((l) => ({ l, s: score(qTerms, l.title, `${l.summary} ${l.tags.join(' ')} ${l.steps.join(' ')}`) }))
    .filter((x) => x.s > 0).sort((a, b) => b.s - a.s).map((x) => x.l);
}

function searchAllCommands(q) {
  const qTerms = terms(q);
  if (!qTerms.length) return [];
  // Match any term (looser than the command guide's own filter).
  const seen = new Map();
  for (const t of qTerms) for (const c of searchCommands(t)) seen.set(c.id, c);
  return [...seen.values()];
}

module.exports = { searchKb, searchLessons, searchAllCommands, terms };
