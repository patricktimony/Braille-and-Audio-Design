/* The Accountability Engine — accessible front end.
 * No frameworks, no external requests. Untrusted text (descriptions, email
 * bodies) is always inserted as text, never as HTML.
 */
"use strict";

const state = { investigations: [], current: null, findingsLoaded: false };
const VIEWS = ["overview", "import", "transactions", "findings", "ask", "investigation",
  "reports", "settings", "help"];
const TITLES = { overview: "Overview", import: "Import", transactions: "Transactions",
  findings: "Findings", ask: "Ask", investigation: "Investigation", reports: "Reports",
  settings: "Privacy and settings", help: "Help" };

// ---------------------------------------------------------------- helpers
function h(tag, attrs, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === null || v === undefined || v === false) continue;
    if (k === "class") el.className = v;
    else if (k === "text") el.textContent = v;
    else if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v === true ? "" : v);
  }
  for (const c of children.flat()) {
    if (c === null || c === undefined || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}
const $ = (sel) => document.querySelector(sel);
const money = (cents) => "$" + (Math.abs(cents) / 100).toLocaleString("en-US",
  { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const signed = (cents) => (cents < 0 ? "debit " : "credit ") + money(cents);
const hidden = (text) => h("span", { class: "visually-hidden" }, text);

let statusTimer = null;
function announce(message) {
  const el = $("#status");
  el.textContent = "";
  clearTimeout(statusTimer);
  // A short delay makes screen readers treat a repeated message as new.
  statusTimer = setTimeout(() => { el.textContent = message; }, 60);
}

async function api(path, options = {}) {
  const opts = { ...options };
  if (opts.json !== undefined) {
    opts.body = JSON.stringify(opts.json);
    opts.headers = { "Content-Type": "application/json" };
    delete opts.json;
  }
  const resp = await fetch(path, opts);
  const type = resp.headers.get("content-type") || "";
  const body = type.includes("json") ? await resp.json() : await resp.text();
  if (!resp.ok) {
    const detail = body && body.detail ? body.detail : resp.statusText;
    throw new Error(typeof detail === "string" ? detail : JSON.stringify(detail));
  }
  return body;
}

function busy(on) { $("#main").setAttribute("aria-busy", on ? "true" : "false"); }

async function guarded(label, fn) {
  busy(true);
  announce(label + "…");
  try { return await fn(); }
  catch (err) { announce("Problem: " + err.message); return null; }
  finally { busy(false); }
}

// ----------------------------------------------------------------- router
function show(view, moveFocus) {
  if (!VIEWS.includes(view)) view = "overview";
  for (const sec of document.querySelectorAll("[data-view-section]")) {
    sec.hidden = sec.dataset.viewSection !== view;
  }
  for (const a of document.querySelectorAll("nav a[data-view]")) {
    if (a.dataset.view === view) a.setAttribute("aria-current", "page");
    else a.removeAttribute("aria-current");
  }
  document.title = TITLES[view] + " — The Accountability Engine";
  if (moveFocus) $("#h-" + view).focus();
  if (view === "transactions") loadTransactions();
  if (view === "findings") loadFindings();
  if (view === "overview") refreshStatus();
  if (view === "settings") loadSettings();
}
window.addEventListener("hashchange", () => show(location.hash.slice(1), true));
function go(view) {
  if (location.hash === "#" + view) show(view, true);
  else location.hash = view;
}

// ---------------------------------------------------------------- overview
async function refreshStatus() {
  try {
    const s = await api("/api/status");
    $("#count-transactions").textContent = s.transactions;
    $("#count-receipts").textContent = s.receipts;
    $("#count-findings").textContent = s.findings;
    const badge = $("#privacy-badge");
    if (s.analysis_mode === "external" && s.external_ai_consent) {
      badge.textContent = "External AI summaries are on, with your consent. Redacted statements may leave this computer.";
      badge.classList.add("external");
    } else {
      badge.textContent = "Local-only mode: your data stays on this computer.";
      badge.classList.remove("external");
    }
    return s;
  } catch (err) { announce("Could not reach the app: " + err.message); return null; }
}

async function loadDemo() {
  const res = await guarded("Loading demonstration data", () => api("/api/demo/load", { method: "POST" }));
  if (!res) return;
  const added = res.imports.reduce((n, r) => n + (r.transactions || 0), 0);
  const receipts = res.imports.reduce((n, r) => n + (r.receipts || 0), 0);
  const s = await refreshStatus();
  state.findingsLoaded = false;
  announce(added || receipts
    ? `Demonstration loaded: ${added} transactions and ${receipts} emails added. ${res.findings} findings.`
    : `Demonstration data was already loaded. ${s ? s.transactions : ""} transactions, ${res.findings} findings.`);
}

async function deleteData() {
  if (!window.confirm("Delete all imported files, findings and investigations from this computer? This cannot be undone.")) {
    announce("Nothing was deleted.");
    return;
  }
  const res = await guarded("Deleting", () => api("/api/data?confirm=DELETE", { method: "DELETE" }));
  if (res) {
    state.investigations = []; state.current = null; state.findingsLoaded = false;
    renderInvestigationReports();
    await refreshStatus();
    announce("All imported data was deleted.");
  }
}

// ------------------------------------------------------------------ import
async function submitImport(form, kind) {
  const files = form.querySelector('input[type="file"]').files;
  if (!files.length) { announce("Choose at least one file first."); form.querySelector('input[type="file"]').focus(); return; }
  const data = new FormData();
  for (const f of files) data.append("files", f);
  if (kind === "statement") {
    const name = $("#account-name").value.trim();
    data.append("account_name", name);
    data.append("account_type", $("#account-type").value);
    data.append("year", $("#statement-year").value.trim());
    try { localStorage.setItem("ae-account-name", name); localStorage.setItem("ae-account-type", $("#account-type").value); } catch (e) { /* storage unavailable */ }
  }
  const res = await guarded("Importing " + files.length + " file(s)", () => api("/api/import", { method: "POST", body: data }));
  if (!res) return;
  const list = $("#import-results");
  if (list.dataset.empty !== "no") { list.textContent = ""; list.dataset.empty = "no"; }
  const parts = [];
  for (const r of res.imports) {
    let text;
    if (r.error) text = `${r.filename}: could not import. ${r.error}`;
    else if (r.skipped_duplicate_file) text = `${r.filename}: already imported, nothing added.`;
    else text = `${r.filename}: ${r.transactions} transactions and ${r.receipts} emails added.`;
    if (r.warnings && r.warnings.length && !r.skipped_duplicate_file) text += " Notes: " + r.warnings.join(" ");
    list.append(h("li", {}, text));
    parts.push(text);
  }
  form.reset();
  restoreAccount();
  state.findingsLoaded = false;
  refreshStatus();
  announce("Import finished. " + parts.join(" ") + ` ${res.findings} findings in total.`);
}

function restoreAccount() {
  try {
    const n = localStorage.getItem("ae-account-name"); if (n) $("#account-name").value = n;
    const t = localStorage.getItem("ae-account-type"); if (t) $("#account-type").value = t;
  } catch (e) { /* storage unavailable */ }
}

// ------------------------------------------------------------ transactions
let txCache = [];
async function loadTransactions() {
  try { txCache = await api("/api/transactions"); } catch (err) { announce(err.message); return; }
  renderTransactions();
}

function investigateButton(t) {
  return h("button", { type: "button", class: "secondary", onclick: () => investigate(t.id) },
    "Investigate", hidden(` transaction ${t.id}, ${money(t.amount_cents)} on ${t.date}`));
}

function renderTransactions() {
  const q = $("#tx-filter").value.trim().toLowerCase();
  const rows = q ? txCache.filter((t) => t.raw_description.toLowerCase().includes(q) ||
    (Math.abs(t.amount_cents) / 100).toFixed(2).includes(q) || t.date.includes(q)) : txCache;
  const body = $("#tx-body");
  body.textContent = "";
  for (const t of rows) {
    const lowConf = t.confidence < 1 ? h("span", { class: "badge" }, "read by OCR") : null;
    body.append(h("tr", {},
      h("td", {}, t.date),
      h("td", {}, t.raw_description, " ", lowConf),
      h("td", { class: "num" }, signed(t.amount_cents)),
      h("td", {}, t.account_name),
      h("td", {}, t.has_receipt ? "Matched" : "None found"),
      h("td", {}, t.finding_count ? `${t.finding_count}` : "None"),
      h("td", {}, investigateButton(t))));
  }
  $("#tx-caption").textContent = `Imported transactions (${rows.length} shown of ${txCache.length})`;
  $("#tx-filter-count").textContent = txCache.length ? `${rows.length} of ${txCache.length} transactions shown.` :
    "No transactions yet. Import a statement or load the demonstration data.";
}

let filterTimer = null;
function onFilter() {
  clearTimeout(filterTimer);
  filterTimer = setTimeout(() => { renderTransactions(); announce($("#tx-filter-count").textContent); }, 400);
}

// ---------------------------------------------------------------- findings
let findingsCache = [];
async function loadFindings() {
  try { findingsCache = await api("/api/findings"); } catch (err) { announce(err.message); return; }
  renderFindings();
}

function evidenceList(evidence) {
  if (!evidence || !evidence.length) return h("p", {}, "No supporting record.");
  return h("ul", { class: "evidence" }, evidence.map((e) =>
    h("li", {}, e.text, " ", h("span", { class: "source" }, `(Source: ${e.source})`))));
}

function txTable(txs, captionText) {
  return h("div", { class: "table-wrap" }, h("table", {},
    h("caption", {}, captionText),
    h("thead", {}, h("tr", {}, ["Date", "Original description", "Amount", "Source", "Action"]
      .map((c) => h("th", { scope: "col" }, c)))),
    h("tbody", {}, txs.map((t) => h("tr", {},
      h("td", {}, t.date), h("td", {}, t.raw_description),
      h("td", { class: "num" }, signed(t.amount_cents)),
      h("td", {}, `${t.source_file}, ${t.source_ref}`),
      h("td", {}, investigateButton(t)))))));
}

function renderFindings() {
  const level = $("#finding-level").value;
  const list = $("#findings-list");
  list.textContent = "";
  const rows = findingsCache.filter((f) => level === "all" || (level === "review" ? f.level === "review" : f.level !== "info"));
  $("#findings-count").textContent = findingsCache.length
    ? `${rows.length} findings shown of ${findingsCache.length}.`
    : "No findings yet. Import statements and receipts, or load the demonstration data.";
  rows.forEach((f, i) => {
    const hid = `finding-${f.id}`;
    const levelName = { review: "Review", notice: "Notice", info: "Info" }[f.level];
    list.append(h("article", { class: `finding level-${f.level}`, "aria-labelledby": hid },
      h("h2", { id: hid }, `${i + 1}. ${f.title}`),
      h("p", {}, h("span", { class: "level" }, `Level: ${levelName}.`), " ", f.summary),
      f.transactions.length ? txTable(f.transactions, "Source transactions for this finding") : null,
      f.receipts.length ? [h("h3", {}, "Related emails"), h("ul", {}, f.receipts.map((r) =>
        h("li", {}, `${r.date || "undated"}: ${r.kind} from ${r.merchant_name}, `,
          r.total_cents !== null ? money(r.total_cents) : "no amount", `, subject “${r.subject || ""}” `,
          h("span", { class: "source" }, `(Source: ${r.source_file}, ${r.source_ref})`))))] : null,
      h("h3", {}, "Evidence"), evidenceList(f.evidence)));
  });
}

// ----------------------------------------------------------- investigation
async function investigate(txId) {
  const inv = await guarded("Investigating transaction " + txId, () => api(`/api/investigate/${txId}`, { method: "POST" }));
  if (!inv) return;
  setInvestigation(inv);
  go("investigation");
  announce(`Investigation ready: ${inv.verified_facts.length} verified facts, ${inv.hypotheses.length} hypotheses, ${inv.unknowns.length} unknowns.`);
}

function setInvestigation(inv) {
  state.current = inv;
  if (!state.investigations.some((x) => x.id === inv.id)) state.investigations.push(inv);
  renderInvestigation(inv);
  renderInvestigationReports();
}

function section(title, id, ...content) {
  return h("section", { "aria-labelledby": id }, h("h2", { id }, title), ...content);
}

function renderInvestigation(inv) {
  const tx = inv.subject.transaction;
  const root = $("#investigation-body");
  root.textContent = "";
  $("#h-investigation").textContent = `Investigation: ${money(tx.amount_cents)} on ${tx.date}`;
  const rowsData = [["Date", tx.date], ["Amount", signed(tx.amount_cents)],
    ["Original description", tx.raw_description], ["Merchant name as printed", tx.merchant_name],
    ["Account", tx.account_name], ["Source file", `${tx.source_file}, ${tx.source_ref}`]];
  const parts = [
    h("div", { class: "table-wrap" }, h("table", {}, h("caption", {}, "Source transaction"),
      h("tbody", {}, rowsData.map(([k, v]) => h("tr", {}, h("th", { scope: "row" }, k), h("td", {}, v)))))),
    inv.notes && inv.notes.length ? h("p", { class: "hint" }, "Note: " + inv.notes.join(" ")) : null,
    section("Summary", "inv-summary", h("p", { class: "hint" }, `Written by: ${inv.summary_source}.`),
      inv.summary.split("\n\n").map((p) => h("p", {}, p))),
    section("Verified facts", "inv-facts",
      h("p", {}, "Each statement is backed by an imported record or arithmetic on imported records."),
      h("ol", {}, inv.verified_facts.map((f) => h("li", {}, h("p", {}, f.text), evidenceList(f.evidence))))),
    section("How the description was read", "inv-interp",
      h("p", {}, "These are readings of the text, not verified facts."),
      h("ul", {}, inv.interpretations.map((i) => h("li", {}, `${i.text}. ${i.basis}`)))),
    section("Hypotheses (not confirmed)", "inv-hyp",
      inv.hypotheses.length ? h("ol", {}, inv.hypotheses.map((x) => h("li", {},
        h("p", {}, x.text), h("p", {}, h("strong", {}, "Confidence: "), x.confidence, ". ",
          h("strong", {}, "How to check: "), x.how_to_check),
        x.basis.length ? evidenceList(x.basis) : null)))
        : h("p", {}, "None. The records explain this transaction.")),
    section("Unknowns", "inv-unknown",
      inv.unknowns.length ? h("ol", {}, inv.unknowns.map((u) => h("li", {},
        h("p", {}, h("strong", {}, u.question)),
        h("p", {}, "Why it matters: ", u.why_it_matters, " How to find out: ", u.how_to_find_out))))
        : h("p", {}, "None identified.")),
    section("Next actions", "inv-actions",
      h("p", {}, "Nothing here is sent anywhere. Drafts are for you to review, edit and send yourself if you choose."),
      h("ol", {}, inv.next_actions.map((a) => actionItem(inv, a)))),
    inv.related_findings.length ? section("Related findings", "inv-related",
      h("ul", {}, inv.related_findings.map((f) => h("li", {}, `${f.title}: ${f.summary}`)))) : null,
    section("Reports", "inv-reports", reportLinks(inv)),
    section("How this investigation was carried out", "inv-method",
      h("div", { class: "table-wrap" }, h("table", {}, h("caption", {}, "Plan"),
        h("thead", {}, h("tr", {}, ["Step", "Purpose", "Status"].map((c) => h("th", { scope: "col" }, c)))),
        h("tbody", {}, inv.plan.map((s) => h("tr", {}, h("td", {}, s.step), h("td", {}, s.purpose), h("td", {}, s.status)))))),
      h("div", { class: "table-wrap" }, h("table", {}, h("caption", {}, "Local tools called, in order"),
        h("thead", {}, h("tr", {}, ["Tool", "Arguments", "Result"].map((c) => h("th", { scope: "col" }, c)))),
        h("tbody", {}, inv.tool_calls.map((c) => h("tr", {}, h("td", {}, c.tool),
          h("td", {}, Object.entries(c.args).map(([k, v]) => `${k}=${v}`).join(", ") || "none"),
          h("td", {}, c.result))))))),
    section("Safeguards", "inv-safe", h("ul", {}, inv.safeguards.map((s) => h("li", {}, s))))];
  root.append(...parts.filter(Boolean));
}

function actionItem(inv, a) {
  const li = h("li", {}, h("p", {}, a.text, " ", h("span", { class: "hint" }, `(Done by: ${a.performed_by}.)`)));
  if (a.requires_approval && a.action_id) {
    const preview = h("div", { id: `preview-${a.action_id}` });
    const kind = a.letter || "issuer";
    li.append(h("div", { class: "button-row" },
      h("button", { type: "button", class: "secondary", "aria-controls": `preview-${a.action_id}`,
        onclick: async () => {
          const text = await guarded("Preparing draft", () => api(`/api/investigations/${inv.id}/letter.txt?kind=${kind}`));
          if (text === null) return;
          preview.textContent = "";
          const hid = `preview-h-${a.action_id}`;
          preview.append(h("h3", { id: hid, tabindex: "-1" }, "Draft letter preview (not sent)"),
            h("pre", { class: "letter-preview", tabindex: "0", "aria-labelledby": hid }, text));
          preview.querySelector("h3").focus();
          announce("Draft shown below. It has not been sent.");
        } }, "Preview draft", hidden(` ${kind === "merchant" ? "letter to merchant" : "billing-error notice"}`)),
      h("button", { type: "button", onclick: () => decide(a.action_id, "approve", preview) }, "Approve draft for my use"),
      h("button", { type: "button", class: "secondary", onclick: () => decide(a.action_id, "decline", preview) }, "Decline")),
      preview);
  }
  return li;
}

async function decide(actionId, decision, preview) {
  const res = await guarded(decision === "approve" ? "Recording approval" : "Recording decision",
    () => api(`/api/actions/${actionId}`, { method: "POST", json: { decision } }));
  if (!res) return;
  if (res.letter_url) {
    preview.append(h("p", {}, res.note, " ", h("a", { href: res.letter_url }, "Open the approved draft as a printable page")));
  } else {
    preview.append(h("p", {}, res.note));
  }
  announce(res.note);
}

function reportLinks(inv) {
  const base = `/api/investigations/${inv.id}`;
  return h("ul", { class: "plain-list" },
    h("li", {}, h("a", { href: `${base}/report.html` }, "Investigation report (HTML)")),
    h("li", {}, h("a", { href: `${base}/report.txt` }, "Investigation report (plain text)")),
    h("li", {}, h("a", { href: `${base}/letter.html?kind=issuer` }, "Draft billing-error notice (HTML)"),
      " · ", h("a", { href: `${base}/letter.txt?kind=issuer` }, "plain text")),
    h("li", {}, h("a", { href: `${base}/letter.html?kind=merchant` }, "Draft letter to the merchant (HTML)"),
      " · ", h("a", { href: `${base}/letter.txt?kind=merchant` }, "plain text")));
}

function renderInvestigationReports() {
  const list = $("#investigation-reports");
  list.textContent = "";
  if (!state.investigations.length) { list.append(h("li", {}, "None yet.")); return; }
  for (const inv of state.investigations) {
    const tx = inv.subject.transaction;
    list.append(h("li", {}, h("p", {}, `${money(tx.amount_cents)} on ${tx.date}, “${tx.raw_description}”`), reportLinks(inv)));
  }
}

// -------------------------------------------------------------------- chat
async function ask(question) {
  const log = $("#chat-log");
  log.append(h("li", { class: "user" }, h("p", { class: "who" }, "You asked:"), h("p", {}, question)));
  const res = await guarded("Looking into it", () => api("/api/chat", { method: "POST", json: { question } }));
  if (!res) return;
  const item = h("li", { class: "engine" }, h("p", { class: "who" }, "The Engine:"));
  if (res.investigation) {
    const inv = res.investigation;
    setInvestigation(inv);
    item.append(...[h("p", {}, `I investigated transaction #${inv.subject.transaction.id}: ${money(inv.subject.transaction.amount_cents)} on ${inv.subject.transaction.date}, “${inv.subject.transaction.raw_description}”.`),
      h("p", {}, h("strong", {}, "Verified from your records:")),
      h("ul", {}, inv.verified_facts.map((f) => h("li", {}, f.text))),
      h("p", {}, h("strong", {}, "Possible explanations, not confirmed:")),
      h("ul", {}, inv.hypotheses.map((x) => h("li", {}, `${x.text} (Confidence: ${x.confidence}.)`))),
      h("p", {}, h("strong", {}, "Still unknown:")),
      h("ul", {}, inv.unknowns.map((u) => h("li", {}, u.question))),
      inv.next_actions.length ? h("p", {}, h("strong", {}, "Suggested next step: "), inv.next_actions[0].text) : null,
      h("p", {}, h("a", { href: "#investigation" }, "Open the full investigation with evidence and draft letters"))].filter(Boolean));
  } else {
    item.append(h("p", {}, res.reply));
    if (res.candidates && res.candidates.length && !res.findings) {
      item.append(h("ul", {}, res.candidates.map((t) => h("li", {},
        `#${t.id}: ${t.date}, ${signed(t.amount_cents)}, “${t.raw_description}” `, investigateButton(t)))));
    }
  }
  log.append(item);
  announce("Answer ready.");
}

// ---------------------------------------------------------------- settings
async function loadSettings() {
  let s;
  try { s = await api("/api/settings"); } catch (err) { announce(err.message); return; }
  $("#mode-local").checked = s.analysis_mode !== "external";
  $("#mode-external").checked = s.analysis_mode === "external";
  $("#consent-text").textContent = s.consent_text;
  $("#consent-check").checked = s.external_ai_consent;
  $("#consent-state").textContent = (s.external_ai_consent ? "Consent is given." : "Consent has not been given.") +
    (s.api_key_configured ? "" : " No API key is configured on this computer, so external AI cannot run in any case.");
}

async function saveMode(ev) {
  ev.preventDefault();
  const mode = document.querySelector('input[name="mode"]:checked').value;
  const res = await guarded("Saving", () => api("/api/settings", { method: "POST", json: { analysis_mode: mode } }));
  if (res) { announce(mode === "local" ? "Saved: local-only mode." : "Saved: external AI summaries on."); refreshStatus(); }
  else loadSettings();
}

async function giveConsent(ev) {
  ev.preventDefault();
  if (!$("#consent-check").checked) { announce("Tick the checkbox to confirm you understand, then choose Give consent."); $("#consent-check").focus(); return; }
  const res = await guarded("Recording consent", () => api("/api/settings", { method: "POST",
    json: { external_ai_consent: true, acknowledgement: $("#consent-text").textContent.trim().replace(/\s+/g, " ") } }));
  if (res) { await loadSettings(); announce("Consent recorded. External AI is still off until you choose it as the analysis mode."); }
}

async function withdrawConsent() {
  const res = await guarded("Withdrawing consent", () => api("/api/settings", { method: "POST", json: { external_ai_consent: false } }));
  if (res) { await loadSettings(); refreshStatus(); announce("Consent withdrawn. Local-only mode is on."); }
}

async function loadAudit() {
  const rows = await guarded("Loading activity log", () => api("/api/audit"));
  if (!rows) return;
  const wrap = $("#audit-wrap");
  wrap.textContent = "";
  wrap.append(h("div", { class: "table-wrap" }, h("table", {}, h("caption", {}, `Activity log (${rows.length} most recent entries)`),
    h("thead", {}, h("tr", {}, ["Time (UTC)", "Event", "Detail"].map((c) => h("th", { scope: "col" }, c)))),
    h("tbody", {}, rows.map((r) => h("tr", {}, h("td", {}, r.ts), h("td", {}, r.event), h("td", {}, r.detail)))))));
  announce(`Activity log shown, ${rows.length} entries.`);
}

// -------------------------------------------------------------------- init
document.addEventListener("DOMContentLoaded", () => {
  $("#load-demo").addEventListener("click", loadDemo);
  $("#ask-example").addEventListener("click", async () => {
    const s = await refreshStatus();
    if (s && !s.transactions) await loadDemo();
    go("ask");
    await ask("What was this $295.98 Apple charge?");
  });
  $("#delete-data").addEventListener("click", deleteData);
  $("#statement-form").addEventListener("submit", (e) => { e.preventDefault(); submitImport(e.target, "statement"); });
  $("#receipt-form").addEventListener("submit", (e) => { e.preventDefault(); submitImport(e.target, "receipt"); });
  $("#tx-filter").addEventListener("input", onFilter);
  $("#finding-level").addEventListener("change", () => { renderFindings(); announce($("#findings-count").textContent); });
  $("#chat-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const q = $("#chat-input").value.trim();
    if (!q) { announce("Type a question first."); return; }
    $("#chat-input").value = "";
    ask(q);
  });
  for (const b of document.querySelectorAll(".suggestion")) b.addEventListener("click", () => ask(b.textContent));
  $("#mode-form").addEventListener("submit", saveMode);
  $("#consent-form").addEventListener("submit", giveConsent);
  $("#withdraw-consent").addEventListener("click", withdrawConsent);
  $("#load-audit").addEventListener("click", loadAudit);
  restoreAccount();
  show(location.hash.slice(1) || "overview", false);
  refreshStatus();
});
