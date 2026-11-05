"""Conversational interface. Runs locally: questions are interpreted with
patterns and answered by the same tools and agents the rest of the app uses.
"""
from __future__ import annotations

import re

from ..db import Database
from ..normalize import format_money, parse_amount, tokens
from . import run_investigation

CHAT_STOP = {"what", "was", "this", "that", "charge", "charges", "charged", "payment", "payments",
             "who", "why", "how", "much", "did", "spend", "spent", "show", "list", "find", "the",
             "and", "for", "from", "with", "have", "any", "are", "there", "about", "tell", "explain",
             "transaction", "transactions", "me", "my", "all", "is", "on", "at", "it", "please",
             "investigate", "look", "into", "can", "you", "help", "duplicate", "duplicates",
             "recurring", "subscription", "subscriptions", "receipt", "receipts", "missing",
             "refund", "refunds", "unusual", "price", "cancel", "cancelled", "canceled", "summary",
             "findings", "problems", "issues", "total", "dollar", "dollars", "where", "when",
             "which", "after", "cancellation", "increase", "biggest", "largest", "since", "does"}

FINDING_INTENTS = [
    (re.compile(r"duplicat|twice|double", re.I), {"possible_duplicate"}, "possible duplicate charges"),
    (re.compile(r"cancel", re.I), {"charge_after_cancellation"}, "charges after a cancellation"),
    (re.compile(r"refund", re.I), {"refund_not_found"}, "refunds that have not appeared"),
    (re.compile(r"price|increase|went up", re.I), {"price_change"}, "price changes"),
    (re.compile(r"recurring|subscription|monthly", re.I), {"recurring", "price_change",
                                                           "charge_after_cancellation"},
     "recurring payments"),
    (re.compile(r"unusual|strange|odd|large", re.I), {"unusual_amount"}, "unusual amounts"),
    (re.compile(r"receipt", re.I), {"missing_receipt", "unmatched_receipt", "amount_mismatch"},
     "receipt problems"),
    (re.compile(r"finding|problem|issue|summary|anything wrong|overview", re.I), None, "findings"),
]

HELP = ("You can ask, for example: “What was this $295.98 Apple charge?”, “Show possible "
        "duplicate charges”, “Which subscriptions do I have?”, “How much did I spend at "
        "Amazon?”, or “Investigate transaction 45”. Everything is answered from your imported "
        "files on this computer.")


def _amounts(q: str) -> list[int]:
    out = []
    for m in re.finditer(r"\$?\s?(\d[\d,]*\.\d{2})|\$\s?(\d[\d,]*)", q):
        parsed = parse_amount(m.group(1) or (m.group(2) + ".00"))
        if parsed:
            out.append(parsed[0])
    return out


def _merchant_words(q: str) -> set[str]:
    return {w for w in tokens(q) if w not in CHAT_STOP}


def _tx_line(t: dict) -> str:
    return (f"#{t['id']}: {t['date']}, {format_money(t['amount_cents'], signed=True)}, "
            f"“{t['raw_description']}” ({t['account_name']})")


def answer(db: Database, question: str, mode: str | None = None) -> dict:
    q = (question or "").strip()
    if not q:
        return {"reply": HELP}
    if re.fullmatch(r"(hi|hello|hey|help|\?)[.!]?", q, re.I):
        return {"reply": HELP}
    txs = db.transactions()
    if not txs:
        return {"reply": "No statements are imported yet. Use Import, or load the demonstration "
                         "data from the Overview page."}

    m = re.search(r"(?:transaction|#)\s*(\d+)", q, re.I)
    if m and db.transaction(int(m.group(1))):
        return _investigate(db, int(m.group(1)), mode)

    amounts = _amounts(q)
    words = _merchant_words(q)

    if re.search(r"how much|total|spend|spent", q, re.I) and words:
        hits = [t for t in txs if t["amount_cents"] < 0 and words & tokens(
            t["merchant_name"] + " " + t["merchant_key"])]
        if not hits:
            return {"reply": f"I found no charges matching “{' '.join(sorted(words))}” in the "
                             "imported statements."}
        total = sum(-t["amount_cents"] for t in hits)
        return {"reply": f"{len(hits)} charges match “{' '.join(sorted(words))}”, totalling "
                         f"{format_money(total)}, from {hits[0]['date']} to {hits[-1]['date']}. "
                         "This counts only imported statements.",
                "candidates": hits}

    if not amounts:
        for pattern, kinds, label in FINDING_INTENTS:
            if pattern.search(q):
                fs = [f for f in db.findings() if kinds is None or f["kind"] in kinds]
                if kinds is None:
                    fs = [f for f in fs if f["level"] != "info"]
                if not fs:
                    return {"reply": f"The pattern checks found no {label} in the imported data."}
                listing = " ".join(f"({i}) {f['title']}." for i, f in enumerate(fs, 1))
                return {"reply": f"I found {len(fs)} {label}: {listing} Each one is listed with "
                                 "its evidence on the Findings page.", "findings": fs}

    candidates = txs
    if amounts:
        candidates = [t for t in candidates if abs(t["amount_cents"]) in amounts]
    if words:
        narrowed = [t for t in candidates if words & tokens(
            t["merchant_name"] + " " + t["merchant_key"] + " " + t["raw_description"])]
        if narrowed or not amounts:
            candidates = narrowed
    if not amounts and not words:
        return {"reply": "I could not tell which transaction you mean. " + HELP}
    if not candidates:
        what = " and ".join(filter(None, [", ".join(format_money(a) for a in amounts),
                                          " ".join(sorted(words))]))
        return {"reply": f"No imported transaction matches {what}. I will not guess; check the "
                         "amount, or import the statement that contains it."}
    if len(candidates) == 1:
        return _investigate(db, candidates[0]["id"], mode)
    if not amounts and len({t["merchant_key"] for t in candidates}) == 1:
        latest = candidates[-1]
        res = _investigate(db, latest["id"], mode)
        res["reply"] = (f"There are {len(candidates)} charges like this; I investigated the most "
                        f"recent one. " + res["reply"])
        res["candidates"] = candidates
        return res
    shown = candidates[:12]
    return {"reply": f"{len(candidates)} transactions match. Which one do you mean? "
                     + " ".join(_tx_line(t) + "." for t in shown)
                     + (" …" if len(candidates) > len(shown) else "")
                     + " Say “investigate transaction” and the number.",
            "candidates": shown}


def _investigate(db: Database, tx_id: int, mode: str | None) -> dict:
    inv = run_investigation(db, tx_id, mode)
    tx = inv["subject"]["transaction"]
    facts = " ".join(f"• {f['text']}" for f in inv["verified_facts"])
    hyps = " ".join(f"• {h['text']} (confidence: {h['confidence']})" for h in inv["hypotheses"])
    unknowns = " ".join(f"• {u['question']}" for u in inv["unknowns"])
    reply = (f"I investigated transaction #{tx['id']}. What the records show: {facts}"
             + (f" Possible explanations, not confirmed: {hyps}" if hyps else "")
             + (f" Still unknown: {unknowns}" if unknowns else "")
             + (f" Suggested next step: {inv['next_actions'][0]['text']}"
                if inv["next_actions"] else "")
             + " The full investigation, with evidence and draft letters, is on the "
               "Investigation page.")
    return {"reply": reply, "investigation": inv}
