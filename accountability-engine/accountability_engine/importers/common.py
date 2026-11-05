"""Shared import plumbing: source registration, sign rules, storage."""
from __future__ import annotations

import hashlib
import json
import re
from dataclasses import dataclass, field
from pathlib import Path

from ..db import Database, now_iso
from ..normalize import normalize_transaction

CREDIT_WORDS = re.compile(r"\b(DEPOSIT|PAYROLL|REFUND|CREDIT|PAYMENT THANK YOU|INTEREST PAID|"
                          r"TRANSFER FROM|REVERSAL)\b", re.I)
ACCOUNT_TYPES = {"checking", "savings", "credit_card", "debit_card", "other"}


@dataclass
class ParsedTransaction:
    date: str
    amount_cents: int          # signed: negative = money out
    raw_description: str
    source_ref: str
    confidence: float = 1.0
    notes: list[str] = field(default_factory=list)


@dataclass
class ParsedReceipt:
    kind: str
    sender: str | None
    merchant_name: str
    subject: str | None
    date: str | None
    total_cents: int | None
    order_id: str | None
    body: str
    source_ref: str


@dataclass
class ImportResult:
    source_id: int | None
    filename: str
    kind: str
    transactions: int = 0
    receipts: int = 0
    skipped_duplicate_file: bool = False
    warnings: list[str] = field(default_factory=list)

    def as_dict(self) -> dict:
        return self.__dict__.copy()


def resolve_sign(cents: int, sign: str | None, account_type: str, description: str
                 ) -> tuple[int, str | None]:
    """Turn a parsed amount into signed cents (negative = money out).

    Returns (signed_cents, note). The note explains any inference made.
    """
    if sign in ("-", "DR"):
        # On card statements a minus usually marks a payment or credit.
        if account_type == "credit_card" and sign == "-":
            return cents, None
        return -cents, None
    if sign in ("+", "CR"):
        return cents, None
    if CREDIT_WORDS.search(description):
        return cents, "No sign printed; treated as money in because the description reads like a credit."
    return -cents, "No sign printed; treated as a charge (money out)."


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def register_source(db: Database, kind: str, filename: str, data: bytes,
                    account_name: str | None, account_type: str | None) -> tuple[int, bool]:
    digest = sha256_bytes(data)
    existing = db.one("SELECT id FROM sources WHERE sha256=?", (digest,))
    if existing:
        return existing["id"], True
    cur = db.execute("INSERT INTO sources (kind, filename, sha256, account_name, account_type, "
                     "imported_at) VALUES (?,?,?,?,?,?)",
                     (kind, filename, digest, account_name, account_type, now_iso()))
    db.audit("source_imported", {"kind": kind, "filename": filename, "sha256": digest})
    return cur.lastrowid, False


def store_transactions(db: Database, source_id: int, account_name: str, account_type: str,
                       rows: list[ParsedTransaction]) -> int:
    for r in rows:
        n = normalize_transaction(r.raw_description)
        db.conn.execute(
            "INSERT INTO transactions (source_id, source_ref, account_name, account_type, date, "
            "amount_cents, raw_description, merchant_name, merchant_key, processor, "
            "descriptor_json, confidence, parse_notes) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)",
            (source_id, r.source_ref, account_name, account_type, r.date, r.amount_cents,
             r.raw_description, n["merchant_name"], n["merchant_key"], n["processor"],
             json.dumps(n["descriptor"]), r.confidence, "; ".join(r.notes) or None))
    db.conn.commit()
    return len(rows)


def store_receipts(db: Database, source_id: int, rows: list[ParsedReceipt]) -> int:
    for r in rows:
        db.conn.execute(
            "INSERT INTO receipts (source_id, source_ref, kind, sender, merchant_name, subject, "
            "date, total_cents, order_id, body) VALUES (?,?,?,?,?,?,?,?,?,?)",
            (source_id, r.source_ref, r.kind, r.sender, r.merchant_name, r.subject, r.date,
             r.total_cents, r.order_id, r.body))
    db.conn.commit()
    return len(rows)


def detect_kind(filename: str, data: bytes) -> str:
    ext = Path(filename).suffix.lower()
    if ext == ".csv":
        return "csv"
    if ext == ".pdf" or data[:5] == b"%PDF-":
        return "pdf"
    if ext in {".png", ".jpg", ".jpeg", ".gif", ".bmp", ".tif", ".tiff", ".webp"}:
        return "image"
    if ext in {".eml", ".mbox", ".mbx", ".txt", ".html", ".htm"}:
        return "email"
    head = data[:200].decode("utf-8", "ignore")
    if head.startswith("From ") or re.search(r"^(From|Subject|Date):", head, re.M):
        return "email"
    if "," in head:
        return "csv"
    raise ValueError(f"Unrecognized file type: {filename}")


def import_file(db: Database, filename: str, data: bytes, account_name: str | None = None,
                account_type: str | None = None, year_hint: int | None = None) -> ImportResult:
    from . import csv_importer, email_importer, image_importer, pdf_importer

    kind = detect_kind(filename, data)
    account_type = account_type if account_type in ACCOUNT_TYPES else "checking"
    account_name = (account_name or "").strip() or Path(filename).stem
    source_id, duplicate = register_source(db, kind, filename, data,
                                           None if kind == "email" else account_name,
                                           None if kind == "email" else account_type)
    result = ImportResult(source_id=source_id, filename=filename, kind=kind)
    if duplicate:
        result.skipped_duplicate_file = True
        result.warnings.append("This exact file was imported before; nothing was added again.")
        return result
    try:
        if kind == "email":
            receipts = email_importer.parse(filename, data)
            result.receipts = store_receipts(db, source_id, receipts)
        else:
            if kind == "csv":
                rows, warnings = csv_importer.parse(data, account_type)
            elif kind == "pdf":
                rows, warnings = pdf_importer.parse(data, account_type, year_hint)
            else:
                rows, warnings = image_importer.parse(data, account_type, year_hint)
            result.warnings.extend(warnings)
            result.transactions = store_transactions(db, source_id, account_name, account_type,
                                                     rows)
    except Exception:
        db.execute("DELETE FROM sources WHERE id=?", (source_id,))
        raise
    db.execute("UPDATE sources SET notes=? WHERE id=?",
               (json.dumps(result.warnings) if result.warnings else None, source_id))
    return result
