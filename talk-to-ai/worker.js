// Talk: voice assistant for blind iPhone users.
// Serves the single page and proxies chat requests to Anthropic so the API key
// never reaches the browser. Conversations are not stored or logged.
import PAGE from "./index.html";

const MODEL = "claude-haiku-5-5";
const MAX_MESSAGES = 24;
const MAX_CHARS = 2000;
const RATE_PER_MINUTE = 20;

const SYSTEM = `You are a friendly, helpful voice assistant talking with a person who is blind, through their iPhone.
Everything you write is read aloud by a speech synthesizer, so:
- Answer in plain spoken sentences. Never use markdown, bullet points, numbered lists, headings, tables, emoji, URLs or code.
- Keep answers short: usually one to three sentences. Give more only when the person asks for detail, then offer to continue.
- Write numbers, times and symbols the way a person would say them.
- If you did not understand, or the words look garbled by speech recognition, say so briefly and ask them to repeat.
- You cannot see the screen, the camera, or the internet, and you have no live information such as news, weather or traffic. Say so plainly when asked.
- Never describe the app's buttons or visual layout unless asked.
Today's date is {DATE}.`;

const hits = new Map(); // ip -> [timestamps]; per isolate, best-effort cost guard

function rateLimited(ip) {
  const now = Date.now();
  const list = (hits.get(ip) || []).filter((t) => now - t < 60000);
  list.push(now);
  hits.set(ip, list);
  if (hits.size > 5000) hits.clear();
  return list.length > RATE_PER_MINUTE;
}

const SECURITY_HEADERS = {
  "x-content-type-options": "nosniff",
  "referrer-policy": "no-referrer",
  "permissions-policy": "microphone=(self), camera=(), geolocation=()",
};

function text(body, status = 200, extra = {}) {
  return new Response(body, {
    status,
    headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store", ...SECURITY_HEADERS, ...extra },
  });
}

function cleanMessages(input) {
  if (!Array.isArray(input) || input.length === 0) return null;
  const msgs = input.slice(-MAX_MESSAGES).map((m) => ({
    role: m && m.role === "assistant" ? "assistant" : "user",
    content: String((m && m.content) || "").slice(0, MAX_CHARS).trim() || "…",
  }));
  while (msgs.length && msgs[0].role !== "user") msgs.shift();
  // Merge consecutive same-role turns (e.g. after an interrupted reply).
  const merged = [];
  for (const m of msgs) {
    const last = merged[merged.length - 1];
    if (last && last.role === m.role) last.content += "\n" + m.content;
    else merged.push({ ...m });
  }
  if (!merged.length || merged[merged.length - 1].role !== "user") return null;
  return merged;
}

async function chat(request, env) {
  if (!env.ANTHROPIC_API_KEY) return text("Server is missing its AI key.", 500);
  const ip = request.headers.get("cf-connecting-ip") || "unknown";
  if (rateLimited(ip)) return text("Too many requests. Wait a minute and try again.", 429);

  let body;
  try {
    body = await request.json();
  } catch {
    return text("Bad request.", 400);
  }
  const messages = cleanMessages(body && body.messages);
  if (!messages) return text("Bad request.", 400);

  const date = new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric", timeZone: "America/New_York" });
  const upstream = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: env.MODEL || MODEL,
      max_tokens: 600,
      stream: true,
      system: SYSTEM.replace("{DATE}", date),
      messages,
    }),
  });

  if (!upstream.ok || !upstream.body) {
    const status = upstream.status === 429 || upstream.status === 529 ? 503 : 502;
    return text("The AI service is busy or unavailable.", status);
  }

  // Convert Anthropic's server-sent events into a plain text stream.
  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();
  const enc = new TextEncoder();
  (async () => {
    const reader = upstream.body.getReader();
    const dec = new TextDecoder();
    let buf = "";
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        let nl;
        while ((nl = buf.indexOf("\n")) >= 0) {
          const line = buf.slice(0, nl).trim();
          buf = buf.slice(nl + 1);
          if (!line.startsWith("data:")) continue;
          let ev;
          try {
            ev = JSON.parse(line.slice(5));
          } catch {
            continue;
          }
          if (ev.type === "content_block_delta" && ev.delta && ev.delta.type === "text_delta") {
            await writer.write(enc.encode(ev.delta.text));
          } else if (ev.type === "error") {
            await writer.write(enc.encode("\u0000ERROR"));
          }
        }
      }
    } catch {
      try { await writer.write(enc.encode("\u0000ERROR")); } catch {}
    } finally {
      try { await writer.close(); } catch {}
    }
  })();

  return new Response(readable, {
    headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store", ...SECURITY_HEADERS },
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/api/chat") {
      if (request.method !== "POST") return text("Method not allowed.", 405);
      return chat(request, env);
    }
    if (url.pathname === "/health") return text("ok");
    if (url.pathname === "/" || url.pathname === "/index.html") {
      return new Response(PAGE, {
        headers: {
          "content-type": "text/html; charset=utf-8",
          "cache-control": "no-cache",
          "content-security-policy":
            "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; connect-src 'self'; img-src 'self' data:; media-src 'self'; base-uri 'none'; frame-ancestors 'none'",
          ...SECURITY_HEADERS,
        },
      });
    }
    return text("Not found.", 404);
  },
};
