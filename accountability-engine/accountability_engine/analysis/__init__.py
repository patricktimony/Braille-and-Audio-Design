"""Analysis: receipt matching and pattern detectors."""
from __future__ import annotations

import json

from ..db import Database, now_iso
from .detectors import DETECTORS, Context
from .matching import match_receipts


def build_context(db: Database) -> Context:
    txs = db.transactions()
    receipts = db.receipts()
    matches = db.query("SELECT receipt_id, transaction_id FROM matches")
    return Context(txs=txs, receipts=receipts, tx_by_id={t["id"]: t for t in txs},
                   receipt_by_id={r["id"]: r for r in receipts},
                   receipt_for_tx={m["transaction_id"]: m["receipt_id"] for m in matches},
                   tx_for_receipt={m["receipt_id"]: m["transaction_id"] for m in matches})


def run_analysis(db: Database) -> list[dict]:
    """Recompute matches and findings from scratch."""
    match_receipts(db)
    ctx = build_context(db)
    findings: list[dict] = []
    for detector in DETECTORS:
        findings.extend(detector(ctx))
    db.execute("DELETE FROM findings")
    for f in findings:
        db.conn.execute("INSERT INTO findings (kind, level, title, summary, transaction_ids, "
                        "receipt_ids, evidence, created_at) VALUES (?,?,?,?,?,?,?,?)",
                        (f["kind"], f["level"], f["title"], f["summary"],
                         json.dumps(f["transaction_ids"]), json.dumps(f["receipt_ids"]),
                         json.dumps(f["evidence"]), now_iso()))
    db.conn.commit()
    db.audit("analysis_run", {"findings": len(findings)})
    return db.findings()
