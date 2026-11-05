"""Match email receipts to bank transactions."""
from __future__ import annotations

from ..db import Database
from ..normalize import days_between, merchant_similarity

WINDOW_BEFORE = 3   # transaction may post up to 3 days before the email date
WINDOW_AFTER = 7    # ... or up to 7 days after it


def receipt_merchant_text(r: dict) -> str:
    return f"{r['merchant_name']} {r.get('sender') or ''}"


def tx_merchant_text(t: dict) -> str:
    return f"{t['merchant_name']} {t['raw_description']}"


def candidate_score(r: dict, t: dict) -> tuple[float, str] | None:
    if r.get("total_cents") is None or not r.get("date"):
        return None
    if r["kind"] == "refund":
        if t["amount_cents"] <= 0:
            return None
    elif r["kind"] == "receipt":
        if t["amount_cents"] >= 0:
            return None
    else:
        return None
    if abs(t["amount_cents"]) != r["total_cents"]:
        return None
    gap = days_between(r["date"], t["date"])
    if not -WINDOW_BEFORE <= gap <= (WINDOW_AFTER + 7 if r["kind"] == "refund" else WINDOW_AFTER):
        return None
    sim = merchant_similarity(receipt_merchant_text(r), tx_merchant_text(t))
    if sim < 0.8:
        return None
    score = round(sim - abs(gap) * 0.02, 3)
    return score, f"Same amount, merchant names correspond, {abs(gap)} day(s) apart"


def match_receipts(db: Database) -> int:
    """Recompute receipt↔transaction matches. One receipt pairs with at most
    one transaction and vice versa (best score first)."""
    db.execute("DELETE FROM matches")
    txs = db.transactions()
    receipts = db.receipts()
    candidates = []
    for r in receipts:
        for t in txs:
            res = candidate_score(r, t)
            if res:
                candidates.append((res[0], r["id"], t["id"], res[1]))
    candidates.sort(key=lambda c: -c[0])
    used_r, used_t = set(), set()
    for score, rid, tid, reason in candidates:
        if rid in used_r or tid in used_t:
            continue
        used_r.add(rid)
        used_t.add(tid)
        db.conn.execute("INSERT INTO matches (receipt_id, transaction_id, score, reason) "
                        "VALUES (?,?,?,?)", (rid, tid, score, reason))
    db.conn.commit()
    return len(used_r)
