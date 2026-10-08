// Spoken Memory: a Cloudflare Worker for two Siri Shortcuts.
// Bindings: KV namespace MEMORY. Secrets: TOKEN, ANTHROPIC_API_KEY.

const SYSTEM = `You answer questions for a blind person, out loud, from their saved memory.
Reply in one or two short sentences meant to be spoken.
Use only the saved facts. If the answer is not in them, say exactly: I don't have that saved.
If facts conflict, use the newest one and briefly mention the conflict.
Plain words only: no markdown, lists, symbols or emoji.`;

const say = (text, status = 200) =>
  new Response(text, { status, headers: { "content-type": "text/plain; charset=utf-8" } });

export default {
  async fetch(request, env) {
    if (request.method !== "POST") return say("Not found.", 404);
    if (request.headers.get("x-token") !== env.TOKEN) return say("Wrong token.", 401);
    const body = await request.json().catch(() => ({}));
    const facts = JSON.parse((await env.MEMORY.get("facts")) || "[]");
    const path = new URL(request.url).pathname;

    if (path === "/remember") {
      const text = String(body.text || "").trim();
      if (!text) return say("I didn't hear anything to remember.", 400);
      facts.push({ text, time: new Date().toISOString() });
      await env.MEMORY.put("facts", JSON.stringify(facts));
      return say("Saved.");
    }

    if (path === "/ask") {
      const question = String(body.question || "").trim();
      if (!question) return say("I didn't hear a question.", 400);
      const list = facts.map((f) => `[${f.time}] ${f.text}`).join("\n") || "(none)";
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": env.ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01",
          "anthropic-beta": "server-side-fallback-2026-07-01",
        },
        body: JSON.stringify({
          model: "claude-opus-5-5",
          max_tokens: 2000,
          output_config: { effort: "low" },
          fallbacks: "default",
          system: SYSTEM,
          messages: [{
            role: "user",
            content: `Saved facts, oldest first, with save times:\n${list}\n\nQuestion: ${question}`,
          }],
        }),
      });
      if (!res.ok) return say("Sorry, my memory isn't working right now.", 502);
      const msg = await res.json();
      if (msg.stop_reason === "refusal") return say("Sorry, I can't answer that.");
      const answer = msg.content.filter((b) => b.type === "text").map((b) => b.text).join(" ").trim();
      return say(answer || "I don't have that saved.");
    }

    return say("Not found.", 404);
  },
};
