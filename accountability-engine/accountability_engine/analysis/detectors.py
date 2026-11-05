"""Pattern detectors. Each returns findings; none of them draws conclusions
about intent. Wording is deliberately neutral: a finding is a question worth
checking, not an accusation.

Levels:
  review — a likely billing error worth acting on (e.g. a repeated charge)
  notice — something unusual worth a look
  info   — context, such as a recurring payment
"""
from __future__ import annotations

import re
import statistics
from collections import defaultdict
from dataclasses import dataclass, field
from typing import Callable

from ..normalize import days_between, format_money, merchant_similarity, parse_date
from .evidence import absence_evidence, calc_evidence, receipt_evidence, tx_evidence
from .matching import WINDOW_AFTER, WINDOW_BEFORE, receipt_merchant_text, tx_merchant_text


@dataclass
class Context:
    txs: list[dict]
    receipts: list[dict]
    tx_by_id: dict[int, dict]
    receipt_by_id: dict[int, dict]
    receipt_for_tx: dict[int, int]
    tx_for_receipt: dict[int, int]
    recurring_tx_ids: set[int] = field(default_factory=set)
    flagged_tx_ids: set[int] = field(default_factory=set)

    def debits(self) -> list[dict]:
        return [t for t in self.txs if t["amount_cents"] < 0]

    def merchant_receipts(self, tx: dict) -> list[dict]:
        return [r for r in self.receipts
                if merchant_similarity(receipt_merchant_text(r), tx_merchant_text(tx)) >= 0.8]


def finding(kind: str, level: str, title: str, summary: str, txs: list[dict],
            receipts: list[dict], evidence: list[dict]) -> dict:
    return {"kind": kind, "level": level, "title": title, "summary": summary,
            "transaction_ids": [t["id"] for t in txs], "receipt_ids": [r["id"] for r in receipts],
            "evidence": evidence}


# ------------------------------------------------------------ duplicates

def detect_duplicates(ctx: Context) -> list[dict]:
    out = []
    groups: dict[tuple, list[dict]] = defaultdict(list)
    for t in ctx.debits():
        groups[(t["account_name"], t["merchant_key"], t["amount_cents"])].append(t)
    for (_acct, _key, cents), items in groups.items():
        items.sort(key=lambda t: t["date"])
        for a, b in zip(items, items[1:]):
            gap = days_between(a["date"], b["date"])
            if gap > 3:
                continue
            ra, rb = ctx.receipt_for_tx.get(a["id"]), ctx.receipt_for_tx.get(b["id"])
            receipts = [ctx.receipt_by_id[r] for r in (ra, rb) if r]
            ev = [tx_evidence(a), tx_evidence(b),
                  calc_evidence(f"Same account, same merchant name, same amount "
                                f"({format_money(cents)}), {gap} day(s) apart.", [a["id"], b["id"]])]
            for r in receipts:
                ev.append(receipt_evidence(r, "matched to one of the two charges"))
            summary = (f"{a['merchant_name']} charged {format_money(cents)} twice within "
                       f"{gap} day(s).")
            if len(receipts) == 1:
                summary += " Only one matching receipt was found in the imported emails."
                ev.append(absence_evidence("No second receipt or order email for this amount.",
                                           "imported email receipts"))
            elif not receipts:
                summary += " No receipts were found for either charge."
            summary += (" This can be a billing error, but it can also be two genuine "
                        "purchases; the order history would tell.")
            out.append(finding("possible_duplicate", "review",
                               f"Possible duplicate charge: {a['merchant_name']} "
                               f"{format_money(cents)}", summary, [a, b], receipts, ev))
            ctx.flagged_tx_ids.add(b["id"])
    return out


# ------------------------------------------------------------- recurring

def _clusters(items: list[dict], tolerance: float = 0.2) -> list[list[dict]]:
    clusters: list[list[dict]] = []
    for t in sorted(items, key=lambda t: t["date"]):
        amt = abs(t["amount_cents"])
        for c in clusters:
            ref = statistics.median(abs(x["amount_cents"]) for x in c)
            if abs(amt - ref) <= ref * tolerance:
                c.append(t)
                break
        else:
            clusters.append([t])
    return clusters


def _monthly(series: list[dict]) -> bool:
    gaps = [days_between(a["date"], b["date"]) for a, b in zip(series, series[1:])]
    return bool(gaps) and all(26 <= g <= 35 for g in gaps)


def detect_recurring(ctx: Context) -> list[dict]:
    out = []
    by_merchant: dict[tuple, list[dict]] = defaultdict(list)
    for t in ctx.debits():
        by_merchant[(t["account_name"], t["merchant_key"])].append(t)
    for (_acct, _key), items in by_merchant.items():
        for cluster in _clusters(items):
            same_amount = len({t["amount_cents"] for t in cluster}) == 1
            if len(cluster) < (2 if same_amount else 3) or not _monthly(cluster):
                continue
            series = sorted(cluster, key=lambda t: t["date"])
            ctx.recurring_tx_ids.update(t["id"] for t in series)
            first = series[0]
            amounts = sorted({abs(t["amount_cents"]) for t in series})
            amount_text = (format_money(amounts[0]) if len(amounts) == 1 else
                           f"{format_money(amounts[0])} to {format_money(amounts[-1])}")
            receipts = ctx.merchant_receipts(first)
            ev = [tx_evidence(t) for t in series]
            ev.append(calc_evidence(f"{len(series)} charges about one month apart "
                                    f"({series[0]['date']} to {series[-1]['date']}).",
                                    [t["id"] for t in series]))
            level = "info"
            if receipts:
                extra = f" {len(receipts)} related email(s) on file."
            else:
                extra = (" No receipts or emails from this merchant were found in the imported "
                         "exports, so what the payment is for is not documented here.")
                ev.append(absence_evidence(f"No email from a sender resembling "
                                           f"“{first['merchant_name']}”.", "imported email receipts"))
            out.append(finding("recurring", level,
                               f"Recurring payment: {first['merchant_name']} ({amount_text} monthly)",
                               f"{first['merchant_name']} appears {len(series)} times at roughly "
                               f"monthly intervals.{extra}", series, receipts, ev))
            out.extend(_price_change(ctx, series, items))
            out.extend(_after_cancellation(ctx, series))
    return out


def _price_change(ctx: Context, series: list[dict], all_items: list[dict]) -> list[dict]:
    last = series[-1]
    base = statistics.median(abs(t["amount_cents"]) for t in series)
    for t in sorted(all_items, key=lambda t: t["date"]):
        if t in series or t["date"] <= last["date"]:
            continue
        gap = days_between(last["date"], t["date"])
        change = (abs(t["amount_cents"]) - base) / base
        if 26 <= gap <= 35 and 0.05 < abs(change) <= 1.0:
            receipts = ctx.merchant_receipts(t)
            notices = [r for r in receipts if r["kind"] == "notice"]
            ev = [tx_evidence(x) for x in series] + [tx_evidence(t, "new amount")]
            ev.append(calc_evidence(f"Previous amount {format_money(int(base))}; new amount "
                                    f"{format_money(abs(t['amount_cents']))} "
                                    f"({change:+.0%}).", [x["id"] for x in series] + [t["id"]]))
            if notices:
                ev += [receipt_evidence(n, "price-change notice") for n in notices]
                summary_tail = " A price-change notice is on file."
            else:
                ev.append(absence_evidence("No price-change notice from this merchant.",
                                           "imported emails"))
                summary_tail = (" No price-change notice was found in the imported emails; "
                                "whether advance notice was given is unknown.")
            return [finding("price_change", "notice",
                            f"Price change: {t['merchant_name']} "
                            f"{format_money(int(base))} → {format_money(abs(t['amount_cents']))}",
                            f"The recurring {t['merchant_name']} charge changed by {change:+.0%} "
                            f"on {t['date']}.{summary_tail}", series + [t], notices, ev)]
    return []


EFFECTIVE_RE = re.compile(r"effective(?: date)?[:\s]+([A-Za-z]+\.? \d{1,2},? \d{4}|\d{1,2}/\d{1,2}/\d{2,4}|"
                          r"\d{4}-\d{2}-\d{2})", re.I)


def cancellation_effective(r: dict) -> str | None:
    m = EFFECTIVE_RE.search(r.get("body") or "")
    if m:
        return parse_date(m.group(1))
    return r.get("date")


def _after_cancellation(ctx: Context, series: list[dict]) -> list[dict]:
    cancels = [r for r in ctx.merchant_receipts(series[0]) if r["kind"] == "cancellation"]
    out = []
    for c in cancels:
        effective = cancellation_effective(c)
        if not effective:
            continue
        later = [t for t in series if t["date"] > effective]
        if not later:
            continue
        total = sum(abs(t["amount_cents"]) for t in later)
        ev = [receipt_evidence(c, f"cancellation effective {effective}")]
        ev += [tx_evidence(t, "charged after the cancellation date") for t in later]
        ev.append(calc_evidence(f"{len(later)} charge(s) dated after {effective}, totalling "
                                f"{format_money(total)}.", [t["id"] for t in later], [c["id"]]))
        out.append(finding("charge_after_cancellation", "review",
                           f"Charged after cancellation: {series[0]['merchant_name']}",
                           f"A cancellation confirmation from {c['merchant_name']} gives an "
                           f"effective date of {effective}, yet {len(later)} charge(s) totalling "
                           f"{format_money(total)} posted afterwards. Possible reasons include a "
                           "billing error or a cancellation that did not take effect.",
                           later, [c], ev))
        ctx.flagged_tx_ids.update(t["id"] for t in later)
    return out


# --------------------------------------------------------- unusual amount

def detect_unusual(ctx: Context) -> list[dict]:
    out = []
    by_key: dict[str, list[dict]] = defaultdict(list)
    for t in ctx.debits():
        by_key[t["merchant_key"]].append(t)
    for key, items in by_key.items():
        if len(items) < 3 or key == "unknown":
            continue
        for t in items:
            others = [abs(x["amount_cents"]) for x in items if x["id"] != t["id"]]
            med = statistics.median(others)
            amt = abs(t["amount_cents"])
            if amt < 3 * med or amt - med < 5000 or t["id"] in ctx.receipt_for_tx:
                continue
            ev = [tx_evidence(t)]
            ev.append(calc_evidence(
                f"{format_money(amt)} is {amt / med:.1f} times the median "
                f"({format_money(int(med))}) of the other {len(others)} charges with this "
                f"merchant name; the range of those was {format_money(min(others))} to "
                f"{format_money(max(others))}.", [x["id"] for x in items]))
            ev.append(absence_evidence("No receipt matching this amount.", "imported email receipts"))
            out.append(finding("unusual_amount", "notice",
                               f"Unusual amount: {t['merchant_name']} {format_money(amt)}",
                               f"This charge is much larger than earlier charges with the same "
                               f"merchant name, and no receipt explains it. Large amounts are "
                               f"not wrong in themselves; this is worth confirming.",
                               [t], [], ev))
    return out


# ------------------------------------------------------- receipt problems

def _plausible_mismatch(receipt_cents: int, charge_cents: int) -> bool:
    """Same digits rearranged, or within 20% of the receipt total."""
    if sorted(str(receipt_cents)) == sorted(str(charge_cents)):
        return True
    return abs(receipt_cents - charge_cents) <= 0.2 * receipt_cents


def detect_receipt_gaps(ctx: Context) -> list[dict]:
    out = []
    for r in ctx.receipts:
        if r["id"] in ctx.tx_for_receipt or r["kind"] not in ("receipt", "refund"):
            continue
        if r.get("total_cents") is None:
            continue
        near = []
        if r.get("date"):
            for t in ctx.txs:
                gap = days_between(r["date"], t["date"])
                if (-WINDOW_BEFORE <= gap <= WINDOW_AFTER and t["id"] not in ctx.receipt_for_tx
                        and merchant_similarity(receipt_merchant_text(r), tx_merchant_text(t)) >= 0.8
                        and (t["amount_cents"] < 0) == (r["kind"] == "receipt")):
                    near.append(t)
        if r["kind"] == "refund":
            ev = [receipt_evidence(r, "refund promised")]
            ev.append(absence_evidence(
                f"No credit of {format_money(r['total_cents'])} from a merchant resembling "
                f"“{r['merchant_name']}” on or after {r['date']}.", "imported statements"))
            related = [ctx.tx_by_id[ctx.tx_for_receipt[x["id"]]] for x in ctx.receipts
                       if x["kind"] == "receipt" and x.get("order_id") and
                       x.get("order_id") == r.get("order_id") and x["id"] in ctx.tx_for_receipt]
            ev += [tx_evidence(t, "original purchase") for t in related]
            out.append(finding("refund_not_found", "review",
                               f"Refund not found: {r['merchant_name']} {format_money(r['total_cents'])}",
                               f"An email dated {r['date']} says a refund of "
                               f"{format_money(r['total_cents'])} would be issued, but no matching "
                               "credit appears in the imported statements. It may be pending, "
                               "credited to another account, or not yet issued.",
                               related, [r], ev))
            continue
        near = [t for t in near if _plausible_mismatch(r["total_cents"], abs(t["amount_cents"]))]
        if near:
            t = near[0]
            diff = abs(t["amount_cents"]) - r["total_cents"]
            ev = [receipt_evidence(r), tx_evidence(t),
                  calc_evidence(f"Charge {format_money(abs(t['amount_cents']))} minus receipt "
                                f"{format_money(r['total_cents'])} = {format_money(diff)}"
                                f"{' more than the receipt' if diff > 0 else ' less than the receipt'}.",
                                [t["id"]], [r["id"]])]
            digits_r, digits_t = sorted(str(r["total_cents"])), sorted(str(abs(t["amount_cents"])))
            if digits_r == digits_t:
                ev.append(calc_evidence("The two amounts use the same digits in a different order, "
                                        "a pattern consistent with a keying error.", [t["id"]], [r["id"]]))
            out.append(finding("amount_mismatch", "review",
                               f"Charge differs from receipt: {t['merchant_name']}",
                               f"The receipt total is {format_money(r['total_cents'])} but the "
                               f"charge on {t['date']} is {format_money(abs(t['amount_cents']))}.",
                               [t], [r], ev))
            ctx.flagged_tx_ids.add(t["id"])
        else:
            ev = [receipt_evidence(r), absence_evidence(
                f"No charge of {format_money(r['total_cents'])} from a merchant resembling "
                f"“{r['merchant_name']}” within {WINDOW_BEFORE} days before to {WINDOW_AFTER} days "
                f"after {r['date']}.", "imported statements")]
            out.append(finding("unmatched_receipt", "notice",
                               f"Receipt with no matching charge: {r['merchant_name']} "
                               f"{format_money(r['total_cents'])}",
                               "A receipt or order email has no matching charge in the imported "
                               "statements. It may not have posted yet, or it may have been paid "
                               "from an account that was not imported.", [], [r], ev))
    return out


def detect_missing_receipts(ctx: Context) -> list[dict]:
    out = []
    for t in ctx.debits():
        if (t["id"] in ctx.receipt_for_tx or t["id"] in ctx.flagged_tx_ids
                or abs(t["amount_cents"]) < 2000):
            continue
        receipts = [r for r in ctx.merchant_receipts(t)
                    if r["kind"] == "receipt" and r["id"] in ctx.tx_for_receipt]
        if len(receipts) < 2:
            continue
        ev = [tx_evidence(t),
              absence_evidence(f"No receipt for {format_money(abs(t['amount_cents']))} within "
                               f"{WINDOW_BEFORE} days before to {WINDOW_AFTER} days after "
                               f"{t['date']}.", "imported email receipts"),
              calc_evidence(f"{len(receipts)} other receipt(s) from a sender resembling this "
                            "merchant matched other charges, so receipts from it normally reach "
                            "the export.",
                            [], [r["id"] for r in receipts])]
        out.append(finding("missing_receipt", "notice",
                           f"No receipt: {t['merchant_name']} {format_money(abs(t['amount_cents']))}",
                           "Other purchases from this merchant name have email receipts, but this "
                           "charge does not.", [t], [], ev))
    return out


DETECTORS: list[Callable[[Context], list[dict]]] = [
    detect_duplicates,
    detect_recurring,
    detect_receipt_gaps,
    detect_unusual,
    detect_missing_receipts,
]
