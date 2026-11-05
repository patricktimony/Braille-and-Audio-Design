"""Evidence items: every claim the app makes points at one of these.

An evidence item always refers to a stored record (transaction or receipt)
or to a calculation over stored records. Nothing else counts as evidence.
"""
from __future__ import annotations

from ..normalize import format_money


def tx_evidence(tx: dict, note: str | None = None) -> dict:
    text = (f"{tx['date']} · {format_money(tx['amount_cents'], signed=True)} · "
            f"“{tx['raw_description']}”")
    if note:
        text += f" — {note}"
    return {"type": "transaction", "transaction_id": tx["id"],
            "source": f"{tx.get('source_file', 'statement')}, {tx['source_ref']}",
            "confidence": tx.get("confidence", 1.0), "text": text}


def receipt_evidence(r: dict, note: str | None = None) -> dict:
    amount = format_money(r["total_cents"]) if r.get("total_cents") is not None else "no amount"
    text = f"{r.get('date') or 'undated'} · {r['kind']} from {r['merchant_name']} · {amount}"
    if r.get("subject"):
        text += f" · subject “{r['subject']}”"
    if note:
        text += f" — {note}"
    return {"type": "receipt", "receipt_id": r["id"],
            "source": f"{r.get('source_file', 'email export')}, {r['source_ref']}", "text": text}


def calc_evidence(text: str, transaction_ids: list[int] | None = None,
                  receipt_ids: list[int] | None = None) -> dict:
    return {"type": "calculation", "text": text, "transaction_ids": transaction_ids or [],
            "receipt_ids": receipt_ids or [], "source": "computed from imported records"}


def absence_evidence(text: str, searched: str) -> dict:
    """Records that a search of imported data found nothing. Absence in the
    imported files is not proof that something does not exist elsewhere."""
    return {"type": "absence", "text": text, "source": f"search of {searched}"}
