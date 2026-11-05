"""SQLite storage. One file, no server, no network.

Money is stored as integer cents. Negative = money out of the account
(a charge / debit); positive = money in (a deposit, refund or credit).
"""
from __future__ import annotations

import json
import sqlite3
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterable

from . import config

SCHEMA = """
CREATE TABLE IF NOT EXISTS sources (
    id INTEGER PRIMARY KEY,
    kind TEXT NOT NULL,              -- csv | pdf | image | email
    filename TEXT NOT NULL,
    sha256 TEXT NOT NULL UNIQUE,
    account_name TEXT,
    account_type TEXT,
    imported_at TEXT NOT NULL,
    notes TEXT
);
CREATE TABLE IF NOT EXISTS transactions (
    id INTEGER PRIMARY KEY,
    source_id INTEGER NOT NULL REFERENCES sources(id),
    source_ref TEXT NOT NULL,         -- e.g. "row 12", "page 1, line 7"
    account_name TEXT NOT NULL,
    account_type TEXT NOT NULL,
    date TEXT NOT NULL,               -- ISO yyyy-mm-dd
    amount_cents INTEGER NOT NULL,
    raw_description TEXT NOT NULL,
    merchant_name TEXT NOT NULL,
    merchant_key TEXT NOT NULL,
    processor TEXT,
    descriptor_json TEXT NOT NULL DEFAULT '{}',
    confidence REAL NOT NULL DEFAULT 1.0,
    parse_notes TEXT
);
CREATE INDEX IF NOT EXISTS idx_tx_merchant ON transactions(merchant_key);
CREATE INDEX IF NOT EXISTS idx_tx_amount ON transactions(amount_cents);
CREATE TABLE IF NOT EXISTS receipts (
    id INTEGER PRIMARY KEY,
    source_id INTEGER NOT NULL REFERENCES sources(id),
    source_ref TEXT NOT NULL,
    kind TEXT NOT NULL,               -- receipt | refund | cancellation | notice
    sender TEXT,
    merchant_name TEXT NOT NULL,
    subject TEXT,
    date TEXT,
    total_cents INTEGER,
    order_id TEXT,
    body TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS matches (
    receipt_id INTEGER NOT NULL REFERENCES receipts(id),
    transaction_id INTEGER NOT NULL REFERENCES transactions(id),
    score REAL NOT NULL,
    reason TEXT NOT NULL,
    PRIMARY KEY (receipt_id, transaction_id)
);
CREATE TABLE IF NOT EXISTS findings (
    id INTEGER PRIMARY KEY,
    kind TEXT NOT NULL,
    level TEXT NOT NULL,              -- review | notice | info
    title TEXT NOT NULL,
    summary TEXT NOT NULL,
    transaction_ids TEXT NOT NULL,    -- JSON list
    receipt_ids TEXT NOT NULL,        -- JSON list
    evidence TEXT NOT NULL,           -- JSON list of evidence items
    created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS investigations (
    id INTEGER PRIMARY KEY,
    transaction_id INTEGER REFERENCES transactions(id),
    agent TEXT NOT NULL,
    mode TEXT NOT NULL,
    created_at TEXT NOT NULL,
    result TEXT NOT NULL              -- JSON
);
CREATE TABLE IF NOT EXISTS actions (
    id INTEGER PRIMARY KEY,
    investigation_id INTEGER REFERENCES investigations(id),
    kind TEXT NOT NULL,
    description TEXT NOT NULL,
    status TEXT NOT NULL,             -- proposed | approved | declined
    created_at TEXT NOT NULL,
    decided_at TEXT
);
CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS audit_log (
    id INTEGER PRIMARY KEY,
    ts TEXT NOT NULL,
    event TEXT NOT NULL,
    detail TEXT NOT NULL
);
"""


def now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


class Database:
    def __init__(self, path: str | Path | None = None):
        self.path = Path(path) if path else config.db_path()
        if str(self.path) != ":memory:":
            self.path.parent.mkdir(parents=True, exist_ok=True)
        self.conn = sqlite3.connect(str(self.path), check_same_thread=False)
        self.conn.row_factory = sqlite3.Row
        self.conn.execute("PRAGMA foreign_keys = ON")
        self.conn.executescript(SCHEMA)
        self.conn.commit()

    # -- generic helpers -------------------------------------------------
    def execute(self, sql: str, params: Iterable[Any] = ()) -> sqlite3.Cursor:
        cur = self.conn.execute(sql, tuple(params))
        self.conn.commit()
        return cur

    def query(self, sql: str, params: Iterable[Any] = ()) -> list[dict]:
        return [dict(r) for r in self.conn.execute(sql, tuple(params)).fetchall()]

    def one(self, sql: str, params: Iterable[Any] = ()) -> dict | None:
        row = self.conn.execute(sql, tuple(params)).fetchone()
        return dict(row) if row else None

    def audit(self, event: str, detail: dict | str) -> None:
        if not isinstance(detail, str):
            detail = json.dumps(detail, default=str)
        self.execute("INSERT INTO audit_log (ts, event, detail) VALUES (?,?,?)",
                     (now_iso(), event, detail))

    # -- settings --------------------------------------------------------
    def get_setting(self, key: str, default: str | None = None) -> str | None:
        row = self.one("SELECT value FROM settings WHERE key=?", (key,))
        return row["value"] if row else default

    def set_setting(self, key: str, value: str) -> None:
        self.execute("INSERT INTO settings (key, value) VALUES (?,?) "
                     "ON CONFLICT(key) DO UPDATE SET value=excluded.value", (key, value))

    # -- domain helpers --------------------------------------------------
    def transaction(self, tx_id: int) -> dict | None:
        row = self.one("SELECT t.*, s.filename AS source_file, s.kind AS source_kind "
                       "FROM transactions t JOIN sources s ON s.id=t.source_id WHERE t.id=?",
                       (tx_id,))
        if row:
            row["descriptor"] = json.loads(row.pop("descriptor_json") or "{}")
        return row

    def transactions(self) -> list[dict]:
        rows = self.query("SELECT t.*, s.filename AS source_file, s.kind AS source_kind "
                          "FROM transactions t JOIN sources s ON s.id=t.source_id "
                          "ORDER BY t.date, t.id")
        for row in rows:
            row["descriptor"] = json.loads(row.pop("descriptor_json") or "{}")
        return rows

    def receipt(self, receipt_id: int) -> dict | None:
        return self.one("SELECT r.*, s.filename AS source_file FROM receipts r "
                        "JOIN sources s ON s.id=r.source_id WHERE r.id=?", (receipt_id,))

    def receipts(self) -> list[dict]:
        return self.query("SELECT r.*, s.filename AS source_file FROM receipts r "
                          "JOIN sources s ON s.id=r.source_id ORDER BY r.date, r.id")

    def findings(self) -> list[dict]:
        rows = self.query("SELECT * FROM findings ORDER BY "
                          "CASE level WHEN 'review' THEN 0 WHEN 'notice' THEN 1 ELSE 2 END, id")
        return [self._finding(r) for r in rows]

    def finding(self, finding_id: int) -> dict | None:
        row = self.one("SELECT * FROM findings WHERE id=?", (finding_id,))
        return self._finding(row) if row else None

    @staticmethod
    def _finding(row: dict) -> dict:
        for key in ("transaction_ids", "receipt_ids", "evidence"):
            row[key] = json.loads(row[key])
        return row

    def matches_for_transaction(self, tx_id: int) -> list[dict]:
        return self.query("SELECT m.*, r.merchant_name, r.subject, r.total_cents, r.date "
                          "FROM matches m JOIN receipts r ON r.id=m.receipt_id "
                          "WHERE m.transaction_id=?", (tx_id,))

    def clear_all(self) -> None:
        for table in ("actions", "investigations", "findings", "matches", "receipts",
                      "transactions", "sources"):
            self.conn.execute(f"DELETE FROM {table}")
        self.conn.commit()
        self.audit("data_cleared", "All imported data deleted by user request")
