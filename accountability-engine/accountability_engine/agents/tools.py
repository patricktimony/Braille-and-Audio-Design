"""Local search and analysis tools the agents call.

Every call is logged (tool name, arguments, a one-line result) so the user
can see exactly how an investigation reached its statements. All tools read
the local SQLite database only.
"""
from __future__ import annotations

import functools
import re

from ..analysis.matching import WINDOW_AFTER, WINDOW_BEFORE, receipt_merchant_text, tx_merchant_text
from ..db import Database
from ..normalize import days_between, format_money, merchant_similarity, parse_descriptor


def logged(fn):
    @functools.wraps(fn)
    def wrapper(self, *args, **kwargs):
        result = fn(self, *args, **kwargs)
        self.calls.append({"tool": fn.__name__, "args": {**dict(zip(
            fn.__code__.co_varnames[1:], args)), **kwargs}, "result": self._summarize(result)})
        return result
    return wrapper


class Toolbox:
    def __init__(self, db: Database):
        self.db = db
        self.calls: list[dict] = []

    @staticmethod
    def _summarize(result) -> str:
        if result is None:
            return "nothing found"
        if isinstance(result, list):
            return f"{len(result)} item(s)"
        if isinstance(result, dict):
            return ", ".join(f"{k}" for k in list(result)[:6])
        return str(result)[:120]

    # -- transactions -------------------------------------------------------
    @logged
    def get_transaction(self, transaction_id: int) -> dict | None:
        return self.db.transaction(transaction_id)

    @logged
    def search_transactions(self, amount_cents: int | None = None, merchant: str | None = None,
                            text: str | None = None, date_from: str | None = None,
                            date_to: str | None = None) -> list[dict]:
        out = []
        for t in self.db.transactions():
            if amount_cents is not None and abs(t["amount_cents"]) != abs(amount_cents):
                continue
            if merchant and merchant_similarity(merchant, tx_merchant_text(t)) < 0.8 \
                    and merchant.lower() not in t["raw_description"].lower():
                continue
            if text and text.lower() not in t["raw_description"].lower():
                continue
            if date_from and t["date"] < date_from:
                continue
            if date_to and t["date"] > date_to:
                continue
            out.append(t)
        return out

    @logged
    def merchant_history(self, transaction_id: int) -> list[dict]:
        """Other charges whose merchant name corresponds to this transaction's."""
        t = self.db.transaction(transaction_id)
        if not t:
            return []
        return [x for x in self.db.transactions()
                if x["id"] != t["id"] and x["amount_cents"] < 0 and
                (x["merchant_key"] == t["merchant_key"] or
                 merchant_similarity(x["merchant_name"], t["merchant_name"]) >= 1.0)]

    @logged
    def find_credits_after(self, transaction_id: int) -> list[dict]:
        t = self.db.transaction(transaction_id)
        return [x for x in self.db.transactions()
                if x["amount_cents"] > 0 and x["date"] >= t["date"] and
                merchant_similarity(x["merchant_name"], t["merchant_name"]) >= 0.8]

    @logged
    def descriptor(self, raw_description: str) -> dict:
        return parse_descriptor(raw_description)

    # -- receipts -----------------------------------------------------------
    @logged
    def matched_receipt(self, transaction_id: int) -> dict | None:
        m = self.db.one("SELECT receipt_id, reason FROM matches WHERE transaction_id=?",
                        (transaction_id,))
        if not m:
            return None
        r = self.db.receipt(m["receipt_id"])
        r["match_reason"] = m["reason"]
        return r

    @logged
    def find_receipts(self, amount_cents: int | None = None, merchant_of_transaction: int | None = None,
                      around_date: str | None = None) -> list[dict]:
        t = self.db.transaction(merchant_of_transaction) if merchant_of_transaction else None
        out = []
        for r in self.db.receipts():
            if amount_cents is not None and r.get("total_cents") != abs(amount_cents):
                continue
            if t and merchant_similarity(receipt_merchant_text(r), tx_merchant_text(t)) < 0.8:
                continue
            if around_date and r.get("date"):
                gap = days_between(r["date"], around_date)
                if not -WINDOW_BEFORE <= gap <= WINDOW_AFTER:
                    continue
            elif around_date:
                continue
            out.append(r)
        return out

    @logged
    def search_emails(self, words: list[str]) -> list[dict]:
        pats = [re.compile(re.escape(w), re.I) for w in words if w]
        return [r for r in self.db.receipts()
                if any(p.search((r.get("subject") or "") + "\n" + r["body"]) for p in pats)]

    @logged
    def receipt_count(self) -> int:
        return self.db.one("SELECT COUNT(*) AS n FROM receipts")["n"]

    # -- analysis -----------------------------------------------------------
    @logged
    def amount_relationships(self, transaction_id: int, days: int = 90) -> list[dict]:
        """Exact multiples (2-4x) and two-item sums among other charges and
        receipts with a corresponding merchant name within `days` days."""
        t = self.db.transaction(transaction_id)
        target = abs(t["amount_cents"])
        pool = []
        for x in self.db.transactions():
            if x["id"] != t["id"] and x["amount_cents"] < 0 and \
                    abs(days_between(x["date"], t["date"])) <= days and \
                    merchant_similarity(x["merchant_name"], t["merchant_name"]) >= 0.8:
                pool.append(("transaction", x["id"], abs(x["amount_cents"]), x))
        for r in self.db.receipts():
            if r.get("total_cents") and r.get("date") and r["kind"] == "receipt" and \
                    abs(days_between(r["date"], t["date"])) <= days and \
                    merchant_similarity(receipt_merchant_text(r), tx_merchant_text(t)) >= 0.8:
                pool.append(("receipt", r["id"], r["total_cents"], r))
        found, seen = [], set()
        pool.sort(key=lambda p: p[0] != "receipt")  # prefer receipts: they say what was bought
        for kind, rid, cents, rec in pool:
            for k in (2, 3, 4):
                if cents * k == target and (cents, k) not in seen:
                    seen.add((cents, k))
                    found.append({"relation": "multiple", "factor": k, "amount_cents": cents,
                                  "record_type": kind, "record_id": rid, "record": rec,
                                  "text": f"{format_money(target)} = {k} × {format_money(cents)}"})
        amounts = sorted({c for _, _, c, _ in pool})
        for i, a in enumerate(amounts):
            for b in amounts[i:]:
                if a + b == target and a != b:
                    found.append({"relation": "sum", "amount_cents": a, "other_cents": b,
                                  "text": f"{format_money(target)} = {format_money(a)} + "
                                          f"{format_money(b)}"})
        return found

    @logged
    def findings_for_transaction(self, transaction_id: int) -> list[dict]:
        return [f for f in self.db.findings() if transaction_id in f["transaction_ids"]]

    @logged
    def data_range(self) -> dict:
        row = self.db.one("SELECT MIN(date) AS first, MAX(date) AS last, COUNT(*) AS n "
                          "FROM transactions")
        return row
