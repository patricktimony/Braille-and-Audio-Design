"""Accessible HTML and plain-text reports, and dispute-letter drafts.

Letters contain only verified facts. Hypotheses never appear in a letter.
Every draft is marked as not sent; the app has no way to send it.
"""
from __future__ import annotations

from datetime import date
from html import escape

from ..normalize import format_money

DRAFT_BANNER = ("DRAFT — NOT SENT. The Accountability Engine never sends letters or contacts "
                "anyone. Check every line, choose the statements that are true, and send it "
                "yourself only if you decide to.")
DISCLAIMER = ("This report was prepared by software from the files you imported. It is not legal "
              "advice. Absence of a record in the imported files does not prove the record does "
              "not exist elsewhere.")

CSS = """
:root{color-scheme:light dark;--fg:#1a1a1a;--bg:#fff;--muted:#4a4a4a;--line:#767676;--accent:#0b5cad}
@media (prefers-color-scheme:dark){:root{--fg:#f2f2f2;--bg:#121212;--muted:#c8c8c8;--line:#8a8a8a;--accent:#8cc4ff}}
body{font:1.0625rem/1.6 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;color:var(--fg);background:var(--bg);max-width:52rem;margin:0 auto;padding:1rem}
h1,h2,h3{line-height:1.25}
table{border-collapse:collapse;width:100%;margin:0.5rem 0 1rem}
th,td{border:1px solid var(--line);padding:0.4rem 0.5rem;text-align:left;vertical-align:top}
caption{text-align:left;font-weight:600;padding:0.25rem 0}
.note{border-left:4px solid var(--accent);padding:0.25rem 0.75rem;color:var(--muted)}
.draft{border:3px solid var(--accent);padding:0.75rem;font-weight:600}
a{color:var(--accent)}
pre{white-space:pre-wrap;font:inherit}
"""


def _page(title: str, body: str) -> str:
    return (f'<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n'
            f'<meta name="viewport" content="width=device-width, initial-scale=1">\n'
            f"<title>{escape(title)}</title>\n<style>{CSS}</style>\n</head>\n<body>\n"
            f"<main>\n{body}\n</main>\n</body>\n</html>\n")


def _evidence_list_html(evidence: list[dict]) -> str:
    if not evidence:
        return "<p>No supporting record; see “how to check”.</p>"
    items = "".join(f"<li>{escape(e['text'])} <span class=\"src\">(Source: "
                    f"{escape(e['source'])})</span></li>" for e in evidence)
    return f"<ul>{items}</ul>"


def _evidence_text(evidence: list[dict], indent: str = "      ") -> str:
    return "\n".join(f"{indent}Evidence: {e['text']} (Source: {e['source']})" for e in evidence)


# ------------------------------------------------------------ investigation

def investigation_html(inv: dict) -> str:
    tx = inv["subject"]["transaction"]
    money = format_money(abs(tx["amount_cents"]))
    title = f"Investigation: {money} on {tx['date']}"
    b = [f"<h1>{escape(title)}</h1>",
         f'<p class="note">{escape(DISCLAIMER)}</p>',
         "<h2>Source transaction</h2>",
         "<table><caption>The transaction as imported</caption><tbody>"]
    for label, val in [("Date", tx["date"]), ("Amount", format_money(tx["amount_cents"], True)),
                       ("Original description", tx["raw_description"]),
                       ("Merchant name as printed", tx["merchant_name"]),
                       ("Account", tx["account_name"]),
                       ("Source file", f"{tx['source_file']}, {tx['source_ref']}")]:
        b.append(f'<tr><th scope="row">{escape(label)}</th><td>{escape(str(val))}</td></tr>')
    b.append("</tbody></table>")
    b.append("<h2>Summary</h2>")
    b.append(f"<p>Written by: {escape(inv.get('summary_source', 'local'))}.</p>")
    b += [f"<p>{escape(p)}</p>" for p in inv["summary"].split("\n\n")]
    b.append("<h2>Verified facts</h2><p>Each statement is backed by an imported record or by "
             "arithmetic on imported records.</p><ol>")
    for f in inv["verified_facts"]:
        b.append(f"<li><p>{escape(f['text'])}</p>{_evidence_list_html(f['evidence'])}</li>")
    b.append("</ol><h2>How the description was read</h2><p>These are readings of the text, "
             "not verified facts.</p><ul>")
    for i in inv["interpretations"]:
        b.append(f"<li>{escape(i['text'])}. {escape(i['basis'])}</li>")
    b.append("</ul><h2>Hypotheses (not confirmed)</h2>")
    if inv["hypotheses"]:
        b.append("<ol>")
        for h in inv["hypotheses"]:
            b.append(f"<li><p>{escape(h['text'])}</p><p>Confidence: {escape(h['confidence'])}. "
                     f"How to check: {escape(h['how_to_check'])}</p>"
                     f"{_evidence_list_html(h['basis']) if h['basis'] else ''}</li>")
        b.append("</ol>")
    else:
        b.append("<p>None. The records explain this transaction.</p>")
    b.append("<h2>Unknowns</h2>")
    if inv["unknowns"]:
        b.append("<ol>")
        for u in inv["unknowns"]:
            b.append(f"<li><p>{escape(u['question'])}</p><p>Why it matters: "
                     f"{escape(u['why_it_matters'])} How to find out: "
                     f"{escape(u['how_to_find_out'])}</p></li>")
        b.append("</ol>")
    else:
        b.append("<p>None identified.</p>")
    b.append("<h2>Next actions</h2><ol>")
    for a in inv["next_actions"]:
        approval = " Requires your approval." if a["requires_approval"] else ""
        b.append(f"<li>{escape(a['text'])} (Done by: {escape(a['performed_by'])}.{approval})</li>")
    b.append("</ol>")
    if inv.get("related_findings"):
        b.append("<h2>Related findings</h2><ul>")
        for f in inv["related_findings"]:
            b.append(f"<li>{escape(f['title'])}: {escape(f['summary'])}</li>")
        b.append("</ul>")
    b.append("<h2>How this investigation was carried out</h2><table><caption>Plan steps"
             '</caption><thead><tr><th scope="col">Step</th><th scope="col">Purpose</th>'
             '<th scope="col">Status</th></tr></thead><tbody>')
    for s in inv["plan"]:
        b.append(f"<tr><td>{escape(s['step'])}</td><td>{escape(s['purpose'])}</td>"
                 f"<td>{escape(s['status'])}</td></tr>")
    b.append('</tbody></table><table><caption>Local tools called</caption><thead><tr>'
             '<th scope="col">Tool</th><th scope="col">Arguments</th><th scope="col">Result</th>'
             "</tr></thead><tbody>")
    for c in inv["tool_calls"]:
        args = ", ".join(f"{k}={v}" for k, v in c["args"].items())
        b.append(f"<tr><td>{escape(c['tool'])}</td><td>{escape(args)}</td>"
                 f"<td>{escape(c['result'])}</td></tr>")
    b.append("</tbody></table><h2>Safeguards</h2><ul>")
    b += [f"<li>{escape(s)}</li>" for s in inv["safeguards"]]
    b.append("</ul>")
    return _page(title, "\n".join(b))


def investigation_text(inv: dict) -> str:
    tx = inv["subject"]["transaction"]
    money = format_money(abs(tx["amount_cents"]))
    out = [f"INVESTIGATION: {money} on {tx['date']}", "=" * 60, DISCLAIMER, "",
           "SOURCE TRANSACTION",
           f"  Date: {tx['date']}",
           f"  Amount: {format_money(tx['amount_cents'], True)}",
           f"  Original description: {tx['raw_description']}",
           f"  Account: {tx['account_name']}",
           f"  Source file: {tx['source_file']}, {tx['source_ref']}", "",
           f"SUMMARY (written by: {inv.get('summary_source', 'local')})", inv["summary"], "",
           "VERIFIED FACTS"]
    for i, f in enumerate(inv["verified_facts"], 1):
        out += [f"  {i}. {f['text']}", _evidence_text(f["evidence"])]
    out += ["", "HOW THE DESCRIPTION WAS READ (interpretations, not facts)"]
    out += [f"  - {i['text']}. {i['basis']}" for i in inv["interpretations"]]
    out += ["", "HYPOTHESES (not confirmed)"]
    out += [f"  {i}. {h['text']}\n     Confidence: {h['confidence']}. How to check: "
            f"{h['how_to_check']}" for i, h in enumerate(inv["hypotheses"], 1)] or ["  None."]
    out += ["", "UNKNOWNS"]
    out += [f"  {i}. {u['question']}\n     Why it matters: {u['why_it_matters']}\n"
            f"     How to find out: {u['how_to_find_out']}"
            for i, u in enumerate(inv["unknowns"], 1)] or ["  None."]
    out += ["", "NEXT ACTIONS"]
    out += [f"  {i}. {a['text']} (Done by: {a['performed_by']}."
            f"{' Requires your approval.' if a['requires_approval'] else ''})"
            for i, a in enumerate(inv["next_actions"], 1)]
    out += ["", "LOCAL TOOLS CALLED"]
    out += [f"  - {c['tool']}({', '.join(f'{k}={v}' for k, v in c['args'].items())}) -> "
            f"{c['result']}" for c in inv["tool_calls"]]
    out += ["", "SAFEGUARDS"] + [f"  - {s}" for s in inv["safeguards"]]
    return "\n".join(out) + "\n"


# ----------------------------------------------------------------- findings

def findings_html(findings: list[dict], db) -> str:
    title = "Findings report"
    b = [f"<h1>{title}</h1>", f'<p class="note">{escape(DISCLAIMER)}</p>',
         f"<p>{len(findings)} findings. A finding is a question worth checking, not a "
         "conclusion.</p>"]
    for f in findings:
        b.append(f"<section><h2>{escape(f['title'])}</h2><p>Level: {escape(f['level'])}. "
                 f"{escape(f['summary'])}</p>")
        txs = [db.transaction(t) for t in f["transaction_ids"]]
        if txs:
            b.append('<table><caption>Source transactions</caption><thead><tr>'
                     '<th scope="col">Date</th><th scope="col">Amount</th>'
                     '<th scope="col">Original description</th><th scope="col">Source</th>'
                     "</tr></thead><tbody>")
            for t in txs:
                b.append(f"<tr><td>{t['date']}</td><td>{format_money(t['amount_cents'], True)}"
                         f"</td><td>{escape(t['raw_description'])}</td><td>"
                         f"{escape(t['source_file'])}, {escape(t['source_ref'])}</td></tr>")
            b.append("</tbody></table>")
        b.append("<h3>Evidence</h3>" + _evidence_list_html(f["evidence"]) + "</section>")
    return _page(title, "\n".join(b))


def findings_text(findings: list[dict], db) -> str:
    out = ["FINDINGS REPORT", "=" * 60, DISCLAIMER, "",
           f"{len(findings)} findings. A finding is a question worth checking, not a conclusion.", ""]
    for i, f in enumerate(findings, 1):
        out += [f"{i}. {f['title']} [{f['level']}]", f"   {f['summary']}"]
        for tid in f["transaction_ids"]:
            t = db.transaction(tid)
            out.append(f"   Transaction: {t['date']} {format_money(t['amount_cents'], True)} "
                       f"\"{t['raw_description']}\" ({t['source_file']}, {t['source_ref']})")
        out.append(_evidence_text(f["evidence"], "   "))
        out.append("")
    return "\n".join(out)


# ------------------------------------------------------------------ letters

REASONS = {
    "possible_duplicate": "I was charged twice for what I believe was a single purchase.",
    "charge_after_cancellation": "I was charged after my cancellation took effect.",
    "amount_mismatch": "The amount charged is different from my receipt.",
    "refund_not_found": "A promised refund has not been credited.",
}


def letter_text(inv: dict, kind: str = "issuer") -> str:
    tx = inv["subject"]["transaction"]
    money = format_money(abs(tx["amount_cents"]))
    kinds = [f["kind"] for f in inv.get("related_findings", [])]
    suggested = [REASONS[k] for k in kinds if k in REASONS]
    reasons = ["I do not recognize this charge and did not authorize it."] + list(REASONS.values())
    window = inv["subject"].get("dispute_window", {})
    lines = [DRAFT_BANNER, "", "[Your full name]", "[Your street address]", "[City, state, ZIP]",
             f"[Date — today is {date.today().isoformat()}]", ""]
    if kind == "merchant":
        lines += ["[Merchant name, as shown on your receipt or account]",
                  "[Merchant customer-service or billing address]", "",
                  f"Re: Request to correct a charge of {money} on {tx['date']}", "",
                  "Dear Customer Service,", "",
                  "I am writing about the following charge to my account:"]
    else:
        lines += ["[Name of your bank or card issuer]",
                  "[The billing-error or error-resolution address printed on your statement — "
                  "not the payment address]", "",
                  "Re: Notice of billing error — account ending [last four digits only]", "",
                  "To whom it may concern:", "",
                  f"I am writing to report a possible error on my {tx['account_name']} account "
                  "concerning this transaction:"]
    lines += ["", f"  Date: {tx['date']}", f"  Amount: {money}",
              f"  Description on my statement: {tx['raw_description']}", "",
              "Reason (keep only the statements that are true, and delete the rest):"]
    lines += [f"  [ ] {r}" for r in reasons]
    if suggested:
        lines.append("  (The app's pattern checks suggest: " + " ".join(suggested)
                     + " Confirm this yourself.)")
    lines += ["", "What my records show:"]
    lines += [f"  - {f['text']}" for f in inv["verified_facts"] if f.get("in_letter")]
    support = [e for f in inv.get("related_findings", []) if f["level"] == "review"
               for e in f.get("evidence", []) if e["type"] in ("receipt", "calculation")]
    if support:
        lines += ["", "Related records:"]
        lines += [f"  - {e['text']}" for e in support]
    lines.append("")
    if kind == "merchant":
        lines += [f"Please correct this charge and refund any amount I was not owed, and confirm "
                  "in writing. Please also tell me what this charge was for if your records "
                  "show it.", ""]
    else:
        lines += ["Please investigate this transaction, correct any error, and credit my account "
                  "for any amount charged in error. Please also send me copies of any documentation "
                  "you rely on, including the merchant's name and contact details.", ""]
        if window.get("rule"):
            lines += [f"(For your own reference, delete before sending: {window['text']})", ""]
    lines += ["Enclosed are copies of (keep only what you include):"]
    sources = sorted({e["source"] for f in inv["verified_facts"] if f.get("in_letter")
                      for e in f["evidence"] if e["type"] in ("transaction", "receipt")}
                     | {e["source"] for e in support if e["type"] == "receipt"})
    lines += [f"  [ ] {s}" for s in sources]
    lines += ["", "Sincerely,", "", "[Your name]", "[Phone or email for replies]", ""]
    return "\n".join(lines)


def letter_html(inv: dict, kind: str = "issuer") -> str:
    text = letter_text(inv, kind)
    body_lines = text.split("\n")[2:]  # banner shown separately
    title = ("Draft letter to the merchant" if kind == "merchant"
             else "Draft billing-error notice")
    return _page(title, f"<h1>{escape(title)}</h1>"
                        f'<p class="draft" role="note">{escape(DRAFT_BANNER)}</p>'
                        f"<pre>{escape(chr(10).join(body_lines))}</pre>")
