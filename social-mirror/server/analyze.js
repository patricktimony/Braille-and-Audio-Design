// AI extraction of descriptors + server-side verification + counting.
//
// Trust model: the LLM only *labels* real comments. Every descriptor must cite an
// exact quote from the comment it came from; quotes that don't appear verbatim in
// that comment are discarded. Counts are computed here, never by the model.
import Anthropic from '@anthropic-ai/sdk';

export const MODEL = process.env.ANTHROPIC_MODEL || 'claude-opus-5-5';
export const PROMPT_VERSION = 3; // bump to invalidate cached analyses when the prompt changes
const BATCH_SIZE = 80;
const CONCURRENCY = 3;
export const MAX_COMMENT_CHARS = 1500;

export const PERSON_CATEGORIES = ['personality', 'facial_expression', 'voice', 'mannerisms'];
export const OTHER_CATEGORIES = ['music_or_work', 'politics', 'other_topic'];
const CATEGORIES = [...PERSON_CATEGORIES, ...OTHER_CATEGORIES];
const POLARITIES = ['positive', 'negative', 'mixed', 'neutral'];

const EXTRACTION_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['results'],
  properties: {
    results: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['id', 'descriptors'],
        properties: {
          id: { type: 'string' },
          descriptors: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              required: ['term', 'category', 'polarity', 'quote'],
              properties: {
                term: { type: 'string' },
                category: { type: 'string', enum: CATEGORIES },
                polarity: { type: 'string', enum: POLARITIES },
                quote: { type: 'string' },
              },
            },
          },
        },
      },
    },
  },
};

const SUBJECT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['person'],
  properties: { person: { type: 'string' } },
};

let client = null;
const getClient = () => (client ??= new Anthropic());

// One JSON-returning call. Uses server-side refusal fallbacks; if the account
// rejects that beta parameter, retries once as a plain request.
async function callJson({ system, user, schema, maxTokens }) {
  const params = {
    model: MODEL,
    max_tokens: maxTokens,
    system,
    output_config: { effort: 'medium', format: { type: 'json_schema', schema } },
    messages: [{ role: 'user', content: user }],
  };
  let msg;
  try {
    msg = await getClient()
      .beta.messages.stream({ ...params, betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' })
      .finalMessage();
  } catch (err) {
    if (!(err instanceof Anthropic.BadRequestError)) throw err;
    msg = await getClient().messages.stream(params).finalMessage();
  }
  if (msg.stop_reason === 'refusal') throw new Error('The model declined this batch.');
  if (msg.stop_reason === 'max_tokens') throw new Error('The model ran out of output tokens on this batch.');
  const text = msg.content.filter((b) => b.type === 'text').map((b) => b.text).join('');
  return JSON.parse(text);
}

export async function identifySubject(video) {
  const out = await callJson({
    system:
      'You identify which real public figure a YouTube video is primarily about, using only its title, channel and description. ' +
      'Return their common full name, or an empty string if it is not clear from the text. Never guess from anything else.',
    user: `Title: ${video.title}\nChannel: ${video.channel}\nDescription:\n${video.description.slice(0, 3000)}`,
    schema: SUBJECT_SCHEMA,
    maxTokens: 2000,
  });
  return out.person.trim();
}

const SYSTEM = `You label public comments for a research tool that shows how audiences describe a public figure.

For each comment, extract the short descriptions the COMMENTER expresses about the SUBJECT (and only the subject — ignore remarks about interviewers, other people, or the commenter themself).

Rules:
- term: 1–3 lowercase words, adjective or short noun phrase ("snide", "warm", "arrogant", "funny", "sincere", "pretentious", "kind", "soft-spoken"). If the commenter used a concise descriptor, use their exact word. If they expressed it in a longer way ("he thinks he's better than everyone"), use the plainest common descriptor ("condescending").
- quote: copy the shortest span of the comment that supports the term, character-for-character. Never paraphrase, fix spelling, or join separate fragments. If no single span supports it, skip the descriptor.
- category: personality | facial_expression | voice | mannerisms for descriptions of the person themself. Use music_or_work for judgments of their art/work ("overrated", "genius songwriter"), politics for political views, other_topic for anything else about them.
- polarity: the commenter's evaluation (positive, negative, mixed, neutral). Read sarcasm by its intended meaning only when it is unmistakable.
- Include ordinary negative opinions plainly; do not soften or censor them. Do not add your own opinions or anything the commenter did not express.
- facial_expression means the commenter's description of the subject's expressions ("smirking", "looks bored"). You never see the video; never infer anything yourself.
- Omit comments that describe nothing about the subject. Return only the JSON.`;

const normalize = (s) =>
  s
    .toLowerCase()
    .replace(/[‘’‛]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/\s+/g, ' ')
    .trim();

export function quoteIsGenuine(quote, text) {
  const q = normalize(quote);
  return q.length > 0 && normalize(text).includes(q);
}

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// Did the commenter literally use this word (allowing simple suffixes like -s, -ly, -ness)?
export function usesWord(term, text) {
  return new RegExp(`(^|[^\\p{L}])${escapeRe(normalize(term))}(s|es|ly|ness)?(?![\\p{L}])`, 'u').test(normalize(text));
}

function cleanTerm(t) {
  return normalize(t).replace(/^["'.,!?\s]+|["'.,!?\s]+$/g, '').slice(0, 40);
}

async function extractBatch(person, video, batch) {
  const lines = batch.map((c, i) => JSON.stringify({ id: String(i), text: c.text.slice(0, MAX_COMMENT_CHARS) }));
  const user =
    `SUBJECT: ${person}\nVIDEO: "${video.title}" (channel: ${video.channel})\n\n` +
    `COMMENTS (one JSON object per line):\n${lines.join('\n')}`;
  const out = await callJson({ system: SYSTEM, user, schema: EXTRACTION_SCHEMA, maxTokens: 32000 });
  return out.results.map((r) => ({ comment: batch[Number(r.id)], descriptors: r.descriptors })).filter((r) => r.comment);
}

// Returns raw labels: [{ commentId, term, category, polarity, quote }] plus diagnostics.
export async function extractDescriptors(person, video, comments) {
  const batches = [];
  for (let i = 0; i < comments.length; i += BATCH_SIZE) batches.push(comments.slice(i, i + BATCH_SIZE));
  const labels = [];
  const failures = [];
  let rejectedQuotes = 0;
  let next = 0;
  async function worker() {
    while (next < batches.length) {
      const idx = next++;
      try {
        for (const { comment, descriptors } of await extractBatch(person, video, batches[idx])) {
          for (const d of descriptors) {
            const term = cleanTerm(d.term);
            if (!term) continue;
            if (!quoteIsGenuine(d.quote, comment.text)) {
              rejectedQuotes++;
              continue;
            }
            labels.push({ commentId: comment.id, term, category: d.category, polarity: d.polarity, quote: d.quote });
          }
        }
      } catch (err) {
        failures.push({ batch: idx + 1, error: err.message });
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, batches.length) }, worker));
  return {
    labels,
    diagnostics: {
      batches: batches.length,
      failedBatches: failures,
      rejectedQuotes,
      truncatedComments: comments.filter((c) => c.text.length > MAX_COMMENT_CHARS).length,
    },
  };
}

// Pure counting: distinct commenters per term. Same person saying it twice counts once.
export function aggregate(labels, comments) {
  const byId = new Map(comments.map((c) => [c.id, c]));
  const terms = new Map();
  for (const l of labels) {
    const c = byId.get(l.commentId);
    if (!c) continue;
    let t = terms.get(l.term);
    if (!t) {
      t = { term: l.term, authors: new Map(), polarity: {}, category: {}, evidence: [] };
      terms.set(l.term, t);
    }
    if (!t.authors.has(c.authorKey)) t.authors.set(c.authorKey, { platform: c.platform, verbatim: false });
    const verbatim = usesWord(l.term, c.text);
    if (verbatim) t.authors.get(c.authorKey).verbatim = true;
    t.polarity[l.polarity] = (t.polarity[l.polarity] || 0) + 1;
    t.category[l.category] = (t.category[l.category] || 0) + 1;
    if (!t.evidence.some((e) => e.commentId === c.id)) {
      t.evidence.push({ commentId: c.id, quote: l.quote, verbatim, category: l.category, polarity: l.polarity });
    }
  }
  const top = (obj) => Object.entries(obj).sort((a, b) => b[1] - a[1])[0]?.[0];
  return [...terms.values()]
    .map((t) => {
      const authors = [...t.authors.values()];
      return {
        term: t.term,
        commenters: authors.length,
        byPlatform: {
          youtube: authors.filter((a) => a.platform === 'youtube').length,
          reddit: authors.filter((a) => a.platform === 'reddit').length,
        },
        verbatimCommenters: authors.filter((a) => a.verbatim).length,
        polarity: top(t.polarity),
        category: top(t.category),
        aboutPerson: PERSON_CATEGORIES.includes(top(t.category)),
        evidence: t.evidence,
      };
    })
    .sort((a, b) => b.commenters - a.commenters || a.term.localeCompare(b.term));
}
