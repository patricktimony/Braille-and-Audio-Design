"""Build a single-file web demo that works on any phone, with no server.

    python tools/build_web_demo.py OUTPUT.html

The real app runs once, in-process, over the fictional demonstration data.
Every API answer the interface needs is saved into the page: findings,
transactions, an investigation of each transaction, and its reports and
letter drafts. A small script in the page answers the interface's requests
from that saved data, and a port of the chat matcher answers questions.
Importing your own files needs the full app running on a computer, so the
web demo leaves that out.
"""
from __future__ import annotations

import json
import re
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from fastapi.testclient import TestClient  # noqa: E402

from accountability_engine import normalize  # noqa: E402
from accountability_engine.agents import chat  # noqa: E402
from accountability_engine.config import STATIC_DIR  # noqa: E402
from accountability_engine.main import create_app  # noqa: E402


def collect() -> dict:
    with tempfile.TemporaryDirectory() as tmp, \
            TestClient(create_app(str(Path(tmp) / "demo.db"))) as c:
        c.post("/api/demo/load").raise_for_status()
        txs = c.get("/api/transactions").json()
        investigations, docs = {}, {}
        for t in txs:
            inv = c.post(f"/api/investigate/{t['id']}").json()
            investigations[t["id"]] = inv
            base = f"/api/investigations/{inv['id']}"
            docs[f"{base}/report.txt"] = c.get(f"{base}/report.txt").text
            for kind in ("issuer", "merchant"):
                docs[f"{base}/letter.txt?kind={kind}"] = c.get(f"{base}/letter.txt?kind={kind}").text
        docs["/api/reports/findings.txt"] = c.get("/api/reports/findings.txt").text
        token_map = {t["id"]: sorted(normalize.tokens(
            f"{t['merchant_name']} {t['merchant_key']} {t['raw_description']}")) for t in txs}
        name_tokens = {t["id"]: sorted(normalize.tokens(
            f"{t['merchant_name']} {t['merchant_key']}")) for t in txs}
        return {
            "status": c.get("/api/status").json(),
            "transactions": txs,
            "findings": c.get("/api/findings").json(),
            "investigations": investigations,
            "docs": docs,
            "tokens": token_map,
            "nameTokens": name_tokens,
            "stop": sorted(normalize.STOP),
            "chatStop": sorted(chat.CHAT_STOP),
            "aliases": normalize.ALIASES,
            "intents": [[p.pattern, sorted(k) if k else None, label]
                        for p, k, label in chat.FINDING_INTENTS],
            "help": chat.HELP,
        }


def section(html: str, view: str, replacement: str) -> str:
    pattern = re.compile(rf'<section id="view-{view}".*?</section>', re.S)
    assert pattern.search(html), view
    return pattern.sub(lambda _m: replacement, html, count=1)


def must_replace(text: str, old: str, new: str) -> str:
    assert old in text, old[:60]
    return text.replace(old, new)


IMPORT_VIEW = """<section id="view-import" data-view-section="import" aria-labelledby="h-import" hidden>
  <h1 id="h-import" tabindex="-1">Import</h1>
  <p>This web demo uses fictional sample files only: a CSV statement, a PDF statement, a
  screenshot, and email receipts. Your phone does not send anything anywhere.</p>
  <p>To import your own statements and receipts, run the full app on a Mac or Windows
  computer. It keeps your files on that computer. The setup steps are in the README on GitHub:</p>
  <p><a href="https://github.com/patricktimony/Braille-and-Audio-Design/tree/claude/accountability-engine/accountability-engine">The Accountability Engine on GitHub</a></p>
</section>"""

PRIVACY_VIEW = """<section id="view-privacy" data-view-section="privacy" aria-labelledby="h-privacy" hidden>
  <h1 id="h-privacy" tabindex="-1">Privacy</h1>
  <p>Everything on this page was worked out in advance by the real app from fictional data.
  Nothing you type here is sent anywhere. Questions are answered by matching them against
  that data in your browser.</p>
  <p>In the full app, the analysis runs on your own computer. An optional AI summary stays off
  unless you give consent in its settings. External AI is not available in this web demo.</p>
  <p>Neither the full app nor this demo ever contacts banks, merchants or regulators. Approving
  a draft only records your decision.</p>
</section>"""

DOC_VIEW = """<section id="view-doc" data-view-section="doc" aria-labelledby="h-doc" hidden>
  <h1 id="h-doc" tabindex="-1">Document</h1>
  <p><button type="button" id="doc-back" class="secondary">Back</button></p>
  <p class="hint">Plain-text version. In the full app this is also available as an HTML page.</p>
  <pre id="doc-body" class="letter-preview" tabindex="0" aria-labelledby="h-doc"></pre>
</section>"""

SHIM = r"""
"use strict";
const DEMO = JSON.parse(document.getElementById("demo-data").textContent);
(function () {
  const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
  const text = (body) => new Response(body, { status: 200, headers: { "content-type": "text/plain" } });
  const fail = (detail, status = 400) => json({ detail }, status);
  const STOP = new Set(DEMO.stop), CHAT_STOP = new Set(DEMO.chatStop);
  const txById = {}; for (const t of DEMO.transactions) txById[t.id] = t;
  const invById = {}, invByAction = {};
  for (const inv of Object.values(DEMO.investigations)) {
    invById[inv.id] = inv;
    for (const a of inv.next_actions) if (a.action_id) invByAction[a.action_id] = [inv, a];
  }
  function tokens(s) {
    const out = new Set();
    for (const p of String(s || "").toLowerCase().split(/[^a-z0-9]+/)) {
      if (p.length >= 3 && !/^\d+$/.test(p) && !STOP.has(p)) out.add(DEMO.aliases[p] || p);
    }
    return out;
  }
  const overlap = (set, arr) => arr.some((w) => set.has(w));
  const fmt = (c) => "$" + (Math.abs(c) / 100).toLocaleString("en-US", { minimumFractionDigits: 2 });
  function amounts(q) {
    const out = [];
    for (const m of q.matchAll(/\$?\s?(\d[\d,]*\.\d{2})|\$\s?(\d[\d,]*)/g)) {
      const s = (m[1] || m[2] + ".00").replace(/,/g, "");
      out.push(Math.round(parseFloat(s) * 100));
    }
    return out;
  }
  function investigate(id) {
    const inv = DEMO.investigations[id];
    return { reply: `I investigated transaction #${id}.`, investigation: inv };
  }
  function chat(question) {
    const q = (question || "").trim();
    if (!q || /^(hi|hello|hey|help|\?)[.!]?$/i.test(q)) return { reply: DEMO.help };
    const txs = DEMO.transactions;
    const m = q.match(/(?:transaction|#)\s*(\d+)/i);
    if (m && txById[m[1]]) return investigate(Number(m[1]));
    const amts = amounts(q);
    const words = new Set([...tokens(q)].filter((w) => !CHAT_STOP.has(w)));
    const wordList = [...words].sort();
    if (/how much|total|spend|spent/i.test(q) && words.size) {
      const hits = txs.filter((t) => t.amount_cents < 0 && DEMO.nameTokens[t.id].some((w) => words.has(w)));
      if (!hits.length) return { reply: `I found no charges matching “${wordList.join(" ")}” in the imported statements.` };
      const total = hits.reduce((n, t) => n - t.amount_cents, 0);
      return { reply: `${hits.length} charges match “${wordList.join(" ")}”, totalling ${fmt(total)}, from ${hits[0].date} to ${hits[hits.length - 1].date}. This counts only imported statements.`, candidates: hits };
    }
    if (!amts.length) {
      for (const [pattern, kinds, label] of DEMO.intents) {
        if (new RegExp(pattern, "i").test(q)) {
          let fs = DEMO.findings.filter((f) => !kinds || kinds.includes(f.kind));
          if (!kinds) fs = fs.filter((f) => f.level !== "info");
          if (!fs.length) return { reply: `The pattern checks found no ${label} in the imported data.` };
          const listing = fs.map((f, i) => `(${i + 1}) ${f.title}.`).join(" ");
          return { reply: `I found ${fs.length} ${label}: ${listing} Each one is listed with its evidence on the Findings page.`, findings: fs };
        }
      }
    }
    let cands = txs;
    if (amts.length) cands = cands.filter((t) => amts.includes(Math.abs(t.amount_cents)));
    if (words.size) {
      const narrowed = cands.filter((t) => overlap(words, DEMO.tokens[t.id]));
      if (narrowed.length || !amts.length) cands = narrowed;
    }
    if (!amts.length && !words.size) return { reply: "I could not tell which transaction you mean. " + DEMO.help };
    if (!cands.length) {
      const what = [amts.map(fmt).join(", "), wordList.join(" ")].filter(Boolean).join(" and ");
      return { reply: `No imported transaction matches ${what}. I will not guess; check the amount, or import the statement that contains it.` };
    }
    if (cands.length === 1) return investigate(cands[0].id);
    if (!amts.length && new Set(cands.map((t) => t.merchant_key)).size === 1) return investigate(cands[cands.length - 1].id);
    const shown = cands.slice(0, 12);
    return { reply: `${cands.length} transactions match. Which one do you mean? Say “investigate transaction” and the number.`, candidates: shown };
  }
  function docKey(href) {
    const u = new URL(href, "https://demo.invalid");
    let path = u.pathname.replace(/\.html$/, ".txt");
    const kind = u.searchParams.get("kind");
    return kind ? `${path}?kind=${kind}` : path;
  }
  window.fetch = async function (path, opts = {}) {
    const method = (opts.method || "GET").toUpperCase();
    const u = new URL(path, "https://demo.invalid");
    const p = u.pathname;
    let m;
    if (p === "/api/status") return json(DEMO.status);
    if (p === "/api/demo/load") return json({ imports: [], findings: DEMO.findings.length });
    if (p === "/api/transactions") {
      const q = (u.searchParams.get("q") || "").toLowerCase();
      return json(DEMO.transactions.filter((t) => !q || t.raw_description.toLowerCase().includes(q) || (Math.abs(t.amount_cents) / 100).toFixed(2).includes(q) || t.date.includes(q)));
    }
    if (p === "/api/findings") return json(DEMO.findings);
    if ((m = p.match(/^\/api\/investigate\/(\d+)$/))) {
      return DEMO.investigations[m[1]] ? json(DEMO.investigations[m[1]]) : fail("Transaction not found", 404);
    }
    if (p.startsWith("/api/investigations/") || p.startsWith("/api/reports/")) {
      const doc = DEMO.docs[docKey(path)];
      return doc ? text(doc) : fail("Not found", 404);
    }
    if (p === "/api/chat") return json(chat(JSON.parse(opts.body || "{}").question));
    if ((m = p.match(/^\/api\/actions\/(\d+)$/)) && method === "POST") {
      const decision = JSON.parse(opts.body || "{}").decision;
      const pair = invByAction[m[1]];
      if (!pair) return fail("Action not found", 404);
      if (decision !== "approve") return json({ id: Number(m[1]), status: "declined", note: "Declined. Nothing was done." });
      const [inv, a] = pair;
      const kind = a.letter || "issuer";
      return json({ id: Number(m[1]), status: "approved",
        note: "Approved for you to use. The app has not sent or submitted anything, and cannot: copy the letter and send it yourself.",
        letter_text: DEMO.docs[`/api/investigations/${inv.id}/letter.txt?kind=${kind}`],
        letter_url: `/api/investigations/${inv.id}/letter.html?kind=${kind}` });
    }
    return fail("Not available in the web demo. Run the full app on a computer for this.");
  };
  // Report and letter links open inside the page.
  document.addEventListener("click", (ev) => {
    const a = ev.target.closest && ev.target.closest('a[href^="/api/"]');
    if (!a) return;
    ev.preventDefault();
    const doc = DEMO.docs[docKey(a.getAttribute("href"))];
    document.getElementById("h-doc").textContent = a.textContent.replace(/\s*\((HTML|plain text)\)\s*$/, "") || "Document";
    document.getElementById("doc-body").textContent = doc || "This document is not available in the web demo.";
    if (location.hash === "#doc") document.getElementById("h-doc").focus();
    else location.hash = "doc";
  });
  document.addEventListener("DOMContentLoaded", () => {
    document.getElementById("doc-back").addEventListener("click", () => history.back());
  });
})();
"""


def build_css() -> str:
    css = (STATIC_DIR / "styles.css").read_text()
    m = re.search(r"@media \(prefers-color-scheme: dark\) \{\s*:root \{(.*?)\}\s*\}", css, re.S)
    assert m
    dark = m.group(1).strip()
    themed = (f"@media (prefers-color-scheme: dark) {{\n  :root:not([data-theme=\"light\"]) {{\n"
              f"    {dark}\n    color-scheme: dark;\n  }}\n}}\n"
              f":root[data-theme=\"dark\"] {{\n  {dark}\n  color-scheme: dark;\n}}")
    css = css.replace(m.group(0), themed)
    css = must_replace(css, "color-scheme: light dark;", "color-scheme: light;")
    css += """
main, .site-header, .site-footer, .status-bar, .demo-banner > p {
  padding-left: max(16px, env(safe-area-inset-left, 0px));
  padding-right: max(16px, env(safe-area-inset-right, 0px));
}
.demo-banner { background: var(--panel); border-bottom: 1px solid var(--line); }
.demo-banner > p { max-width: 60rem; margin: 0 auto; padding-block: 0.6rem; }
#doc-body { white-space: pre-wrap; overflow-wrap: anywhere; }
"""
    return css


def build_js() -> str:
    js = (STATIC_DIR / "app.js").read_text()
    js = must_replace(js, '"reports", "settings", "help"];', '"reports", "privacy", "help", "doc"];')
    js = must_replace(js, 'settings: "Privacy and settings", help: "Help" };',
                      'privacy: "Privacy", help: "Help", doc: "Document" };')
    js = re.sub(r'\$\("(#[\w-]+)"\)\.addEventListener', r'$("\1")?.addEventListener', js)
    js = js.replace('"use strict";', "", 1)
    return js


def build_html(data: dict) -> str:
    src = (STATIC_DIR / "index.html").read_text()
    body = src.split("<body>", 1)[1].split("</body>", 1)[0]
    body = must_replace(body, '<li><a href="#settings" data-view="settings">Privacy and settings</a></li>',
                        '<li><a href="#privacy" data-view="privacy">Privacy</a></li>')
    body = body.replace('href="#settings"', 'href="#privacy"')
    body = must_replace(body, "and give consent in <a href=\"#privacy\">Privacy and settings</a>.",
                        "and give consent in the full app's settings. See <a href=\"#privacy\">Privacy</a>.")
    body = section(body, "import", IMPORT_VIEW)
    body = section(body, "settings", PRIVACY_VIEW)
    body = must_replace(body, '<button type="button" id="load-demo">Load demonstration data</button>\n', "")
    body = re.sub(r"\s*<h2>Start over</h2>.*?</button>", "", body, count=1, flags=re.S)
    body = must_replace(body, "<p>The demonstration has 100 fictional transactions",
                        "<p>The sample data is already loaded: 100 fictional transactions")
    body = must_replace(body, "</header>", "</header>\n<div class=\"demo-banner\"><p><strong>Web demo.</strong> "
                        "Fictional sample data, worked out in advance by the real app. To check your own "
                        "statements, run the full app on a computer.</p></div>")
    body = must_replace(body, "\n</main>", "\n" + DOC_VIEW + "\n</main>")
    payload = json.dumps(data, ensure_ascii=False, separators=(",", ":")).replace("</", "<\\/")
    return ("<title>The Accountability Engine</title>\n"
            '<meta name="claude:viewport-fit-sides" content="cover">\n'
            f"<style>\n{build_css()}\n</style>\n"
            f"{body.strip()}\n"
            f'<script type="application/json" id="demo-data">{payload}</script>\n'
            f"<script>{SHIM}\n{build_js()}</script>\n")


def main() -> None:
    out = Path(sys.argv[1] if len(sys.argv) > 1 else "accountability-engine-demo.html")
    out.write_text(build_html(collect()))
    print(f"Wrote {out} ({out.stat().st_size / 1024:.0f} KB)")


if __name__ == "__main__":
    main()
