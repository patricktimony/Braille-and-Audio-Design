// Optional: serve the app AND add language-model interpretations.
//
// The API key lives only here, on the server, in an environment variable.
// The browser never sees it. Without a key this still serves the app, and the
// page simply uses its built-in engine.
//
//   cd half-heard/server
//   npm install
//   ANTHROPIC_API_KEY=your-key npm start
//   open http://localhost:8787/?llm=1
//
// The page only calls /api/interpret when ?llm=1 is in the address, or when
// llmEndpoint is set in index.html.

import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const appDir = path.resolve(here, '..');
const PORT = Number(process.env.PORT) || 8787;
const MODEL = process.env.HALF_HEARD_MODEL || 'claude-opus-5-5';

let client = null;
if (process.env.ANTHROPIC_API_KEY) {
  const { default: Anthropic } = await import('@anthropic-ai/sdk');
  client = new Anthropic();
}

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.md': 'text/plain; charset=utf-8' };

const SYSTEM = `You are the creative engine of "Half-Heard Genius Engine", a playful app that deliberately mishears speech.
Given a phrase, invent alternative interpretations that SOUND similar but MEAN something different, using techniques such as
homophones, similar-sounding words, moving word boundaries ("recognize speech" -> "wreck a nice beach"), taking idioms literally,
combining unrelated meanings, or hearing the phrase as the name of an invention.
For each one, write a short, surprising idea: an invention, a philosophical observation, a joke, or an art concept/poem.
Aim for playful, surprising and sometimes profound — never random nonsense, never cruel or crude.
Reply with JSON only, no prose, in exactly this shape:
{"interpretations":[{"text":"the misheard phrase","methodLabel":"e.g. Homophone","explanation":"one sentence on how it was misheard","kindLabel":"Invention | Philosophical observation | Joke | Art concept | Poem","idea":"one to three sentences"}]}`;

async function interpret(body) {
  const phrase = String(body.phrase || '').slice(0, 200);
  const count = Math.min(Math.max(Number(body.count) || 5, 1), 10);
  const avoid = (Array.isArray(body.avoid) ? body.avoid : []).slice(0, 60).map(String);
  const alternatives = (Array.isArray(body.alternatives) ? body.alternatives : []).slice(0, 5).map(String);
  const user = [
    `Phrase: "${phrase}"`,
    alternatives.length ? `The speech recogniser also considered: ${alternatives.map((a) => `"${a}"`).join(', ')}` : '',
    avoid.length ? `Do not repeat these interpretations: ${avoid.map((a) => `"${a}"`).join(', ')}` : '',
    `Give ${count} interpretations, each using a different technique where possible, with a mix of idea kinds.`
  ].filter(Boolean).join('\n');

  const response = await client.beta.messages.create({
    model: MODEL,
    max_tokens: 4000,
    output_config: { effort: 'low' },
    // If the model declines, let the API retry on its recommended fallback model.
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    system: SYSTEM,
    messages: [{ role: 'user', content: user }]
  });

  if (response.stop_reason === 'refusal') throw new Error('Model declined');
  const text = response.content.filter((b) => b.type === 'text').map((b) => b.text).join('');
  const json = text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1);
  const data = JSON.parse(json);
  if (!Array.isArray(data.interpretations)) throw new Error('Bad shape');
  return { heard: phrase, interpretations: data.interpretations.slice(0, count) };
}

function send(res, status, body, type = 'application/json; charset=utf-8') {
  res.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store' });
  res.end(typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body));
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');

  if (url.pathname === '/api/interpret') {
    if (req.method !== 'POST') return send(res, 405, { error: 'POST only' });
    if (!client) return send(res, 503, { error: 'No ANTHROPIC_API_KEY set on the server' });
    let raw = '';
    for await (const chunk of req) { raw += chunk; if (raw.length > 20000) return send(res, 413, { error: 'Too large' }); }
    try {
      return send(res, 200, await interpret(JSON.parse(raw || '{}')));
    } catch (err) {
      console.error('interpret failed:', err.message);
      return send(res, 502, { error: 'Language model unavailable' });
    }
  }

  // Static files from the app folder only.
  const rel = url.pathname === '/' ? 'index.html' : decodeURIComponent(url.pathname).replace(/^\/+/, '');
  const file = path.resolve(appDir, rel);
  if (!file.startsWith(appDir + path.sep) || file.startsWith(here)) return send(res, 404, 'Not found', 'text/plain');
  try {
    let content = await fs.readFile(file);
    if (rel === 'index.html' && url.searchParams.has('llm')) {
      content = content.toString().replace("llmEndpoint: ''", "llmEndpoint: '/api/interpret'");
    }
    send(res, 200, content, TYPES[path.extname(file)] || 'application/octet-stream');
  } catch {
    send(res, 404, 'Not found', 'text/plain');
  }
});

server.listen(PORT, () => {
  console.log(`Half-Heard Genius Engine on http://localhost:${PORT}`);
  console.log(client ? `Language model ready (${MODEL}). Add ?llm=1 to the address to use it.` : 'No ANTHROPIC_API_KEY: serving the built-in engine only.');
});
