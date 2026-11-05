"""The transaction investigation agent.

It follows a fixed, inspectable plan, calls local tools, and builds every
statement from tool results. It has no other source of knowledge about the
user's purchases, so it cannot invent purchase details or merchant identity.
"""
from __future__ import annotations

import re
import statistics
from datetime import date, timedelta

from ..analysis.evidence import absence_evidence, calc_evidence, receipt_evidence, tx_evidence
from ..analysis.matching import WINDOW_AFTER, WINDOW_BEFORE
from ..normalize import format_money
from .base import (BaseAgent, Fact, Hypothesis, Interpretation, Investigation, NextAction,
                   PlanStep, Unknown, register)
from .tools import Toolbox

PLAN = [
    ("Retrieve the transaction and its source record", "Know exactly what the statement says"),
    ("Decode the descriptor text", "Separate the printed merchant name from codes and numbers"),
    ("Look for a matching receipt", "A receipt is the strongest evidence of what was bought"),
    ("Review history with this merchant name", "See whether the amount fits earlier charges"),
    ("Check arithmetic relationships", "Exact multiples or sums can point to related charges"),
    ("Check for refunds or credits afterwards", "A reversal may already have happened"),
    ("Check the app's pattern findings", "Duplicates, cancellations and similar checks"),
    ("Compare the evidence and list what is missing", "Separate facts from hypotheses"),
    ("Prepare an evidence-based next action", "Suggest steps; draft letters only with approval"),
]

PAYMENT_LINE = re.compile(r"^\s*(billed to|payment|paid with|card)\b.*$", re.I | re.M)
TOTAL_LINE = re.compile(r"\b(sub)?total|amount (charged|billed|paid)|refund amount\b", re.I)


def receipt_items(r: dict) -> list[str]:
    """Lines of a receipt that carry a price and are not totals: quoted verbatim."""
    out = []
    for line in (r.get("body") or "").splitlines():
        line = line.strip()
        if "$" in line and not TOTAL_LINE.search(line):
            out.append(line)
    return out[:5]


def payment_lines(r: dict) -> list[str]:
    return [m.group(0).strip() for m in PAYMENT_LINE.finditer(r.get("body") or "")]


def dispute_window(tx: dict) -> dict:
    """General information about notice deadlines; not legal advice."""
    tx_date = date.fromisoformat(tx["date"])
    earliest = tx_date + timedelta(days=60)
    if tx["account_type"] == "credit_card":
        rule = ("For credit cards, the US Fair Credit Billing Act generally requires a written "
                "billing-error notice to the card issuer within 60 days after the first statement "
                "showing the error was sent to you.")
        letter_to = "the card issuer"
    else:
        rule = ("For debit cards and other electronic transfers from a bank account, the US "
                "Electronic Fund Transfer Act (Regulation E) generally asks you to report an "
                "error to the bank within 60 days after the statement showing it was sent.")
        letter_to = "the bank"
    days_left = (earliest - date.today()).days
    return {"rule": rule, "letter_to": letter_to, "conservative_date": earliest.isoformat(),
            "days_left": days_left,
            "text": f"{rule} The 60 days count from the statement date, which is on or after "
                    f"the transaction date, so {earliest.isoformat()} is a cautious estimate "
                    f"({days_left} days from today). Check your statement date. This is general "
                    "information, not legal advice."}


@register
class TransactionAgent(BaseAgent):
    name = "transaction-investigator"
    description = "Investigates a single bank or card transaction using local evidence."

    def can_investigate(self, subject: dict) -> bool:
        return subject.get("type") == "transaction"

    def investigate(self, subject: dict, tools: Toolbox) -> Investigation:
        tx_id = subject["transaction_id"]
        inv = Investigation(agent=self.name, subject=subject,
                            plan=[PlanStep(s, p) for s, p in PLAN])
        inv.safeguards = [
            "Only imported files were searched; nothing was sent outside this computer.",
            "Statements of fact are limited to what imported records show.",
            "No one has been contacted. Drafts are not sent anywhere by this app.",
        ]
        step = iter(inv.plan)

        # 1. transaction
        tx = tools.get_transaction(tx_id)
        if not tx:
            raise LookupError(f"Transaction {tx_id} not found")
        inv.subject = {**subject, "transaction": tx}
        next(step).status = "done"
        money = format_money(abs(tx["amount_cents"]))
        kind = "charge" if tx["amount_cents"] < 0 else "credit"
        inv.verified_facts.append(Fact(
            f"{tx['account_name']} shows a {kind} of {money} dated {tx['date']}.", [tx_evidence(tx)],
            True))
        inv.verified_facts.append(Fact(
            f"The original description reads exactly: “{tx['raw_description']}”.", [tx_evidence(tx)],
            True))
        if tx.get("confidence", 1.0) < 1.0:
            inv.unknowns.append(Unknown(
                "Was the screenshot read correctly?",
                "This transaction was read by OCR, which can misread digits or letters.",
                "Compare the amount and description with the original screenshot."))

        # 2. descriptor
        d = tools.descriptor(tx["raw_description"])
        next(step).status = "done"
        for part in d["parts"]:
            inv.interpretations.append(Interpretation(f"“{part['text']}” — {part['label']}",
                                                      part["note"]))

        # 3. receipt
        receipt = tools.matched_receipt(tx_id)
        merchant_receipts = tools.find_receipts(merchant_of_transaction=tx_id)
        next(step).status = "done"
        if receipt:
            items = receipt_items(receipt)
            ev = [receipt_evidence(receipt, receipt.get("match_reason"))]
            inv.verified_facts.append(Fact(
                f"A {receipt['kind']} from {receipt['merchant_name']} dated {receipt['date']} for "
                f"{format_money(receipt['total_cents'])} matches this {kind}"
                + (f" (order or receipt number {receipt['order_id']})" if receipt.get("order_id") else "")
                + ".", ev, True))
            if items:
                inv.verified_facts.append(Fact(
                    "The receipt lists: " + "; ".join(f"“{i}”" for i in items) + ".", ev, True))
        else:
            n_all = tools.receipt_count()
            inv.verified_facts.append(Fact(
                f"None of the {n_all} imported emails is a receipt for {money} dated between "
                f"{WINDOW_BEFORE} days before and {WINDOW_AFTER} days after {tx['date']} from a "
                "sender resembling this merchant.",
                [absence_evidence(f"No receipt for {money} near {tx['date']}.",
                                  f"{n_all} imported emails")], True))

        # 4. history
        history = tools.merchant_history(tx_id)
        next(step).status = "done"
        if history and tx["amount_cents"] < 0:
            amounts = [abs(h["amount_cents"]) for h in history]
            med = statistics.median(amounts)
            rank = ("the largest" if abs(tx["amount_cents"]) > max(amounts) else
                    "the smallest" if abs(tx["amount_cents"]) < min(amounts) else None)
            text = (f"There are {len(history)} other charges with a corresponding merchant name "
                    f"between {history[0]['date']} and {history[-1]['date']}, ranging from "
                    f"{format_money(min(amounts))} to {format_money(max(amounts))} (median "
                    f"{format_money(int(med))}).")
            if rank:
                text += f" This {kind} is {rank} of them."
            inv.verified_facts.append(Fact(text, [calc_evidence(text, [h["id"] for h in history])]))
            prefixed = [h for h in history if h.get("processor")]
            if tx.get("processor") and not prefixed:
                text = (f"This is the only charge with this merchant name whose description "
                        f"begins with the “{d['parts'][0]['text']}” prefix; the other "
                        f"{len(history)} do not.")
                inv.verified_facts.append(Fact(text, [tx_evidence(tx)] +
                                               [tx_evidence(h) for h in history[:3]]))
        elif tx["amount_cents"] < 0:
            inv.verified_facts.append(Fact(
                "No other charges with a corresponding merchant name were found in the imported "
                "statements.", [absence_evidence("No earlier charges.", "imported statements")]))

        other_receipts = [r for r in merchant_receipts if not receipt or r["id"] != receipt["id"]]
        if other_receipts:
            described = []
            for r in other_receipts[:6]:
                items = receipt_items(r)
                label = items[0] if items else (r.get("subject") or r["kind"])
                described.append(f"{r['date']}: “{label}”")
            text = (f"{len(other_receipts)} other email(s) from a sender resembling this merchant "
                    "were imported: " + "; ".join(described)
                    + ("; …" if len(other_receipts) > 6 else "") + ".")
            inv.verified_facts.append(Fact(text, [receipt_evidence(r) for r in other_receipts[:6]]))
            pay = sorted({p for r in other_receipts for p in payment_lines(r)})
            if pay:
                inv.verified_facts.append(Fact(
                    "Those emails state the payment method as: " + "; ".join(f"“{p}”" for p in pay)
                    + ".", [receipt_evidence(r) for r in other_receipts if payment_lines(r)][:4]))

        # 5. arithmetic
        relations = tools.amount_relationships(tx_id)
        next(step).status = "done"
        multiples = [r for r in relations if r["relation"] == "multiple"]
        for rel in relations:
            ev = []
            if rel.get("record_type") == "receipt":
                ev.append(receipt_evidence(rel["record"]))
            elif rel.get("record_type") == "transaction":
                ev.append(tx_evidence(rel["record"]))
            ev.append(calc_evidence(rel["text"]))
            where = ""
            if rel.get("record_type") == "receipt":
                items = receipt_items(rel["record"])
                where = (f", the amount of a receipt dated {rel['record']['date']}"
                         + (f" for “{items[0]}”" if items else ""))
            elif rel.get("record_type") == "transaction":
                where = f", the amount of the charge on {rel['record']['date']}"
            inv.verified_facts.append(Fact(f"Arithmetic: {rel['text']}{where}.", ev))

        # 6. credits
        credits = tools.find_credits_after(tx_id)
        rng = tools.data_range()
        next(step).status = "done"
        if tx["amount_cents"] < 0:
            if credits:
                inv.verified_facts.append(Fact(
                    f"{len(credits)} credit(s) with a corresponding merchant name posted on or after "
                    f"{tx['date']}.", [tx_evidence(c) for c in credits], True))
            else:
                inv.verified_facts.append(Fact(
                    f"No refund or credit with a corresponding merchant name appears between "
                    f"{tx['date']} and {rng['last']}, the last date in the imported statements.",
                    [absence_evidence("No later credit.", "imported statements")], True))

        # 7. findings
        findings = tools.findings_for_transaction(tx_id)
        next(step).status = "done"
        inv.related_findings = [{"id": f["id"], "kind": f["kind"], "level": f["level"],
                                 "title": f["title"], "summary": f["summary"],
                                 "evidence": f["evidence"]} for f in findings]
        kinds = {f["kind"] for f in findings}

        # 8. compare -> hypotheses and unknowns
        next(step).status = "done"
        explained = receipt is not None and "amount_mismatch" not in kinds
        if tx["amount_cents"] < 0 and not explained:
            for rel in multiples:
                rec = rel.get("record")
                label = ""
                if rel.get("record_type") == "receipt":
                    items = receipt_items(rec)
                    label = f"“{items[0]}”" if items else f"the receipt dated {rec['date']}"
                else:
                    label = f"the {format_money(rel['amount_cents'])} charge on {rec['date']}"
                inv.hypotheses.append(Hypothesis(
                    f"The charge may be related to {label}: {rel['text']}. For example, "
                    f"{rel['factor']} billing periods or {rel['factor']} units billed together, or "
                    "a repeat of that charge.",
                    "low", [calc_evidence(rel["text"])],
                    "Check the merchant's purchase history for this date and amount."))
            if tx.get("processor"):
                inv.hypotheses.append(Hypothesis(
                    f"The payment may have gone through a {tx['processor']} account rather than "
                    "directly by card. If so, a receipt may be in that account or in an email "
                    "inbox that was not exported.",
                    "moderate" if not receipt else "low",
                    [tx_evidence(tx, f"description begins with a {tx['processor']}-style prefix")],
                    f"Look at your {tx['processor']} activity for {tx['date']} and "
                    f"{money}."))
            if not receipt:
                inv.hypotheses.append(Hypothesis(
                    "A receipt may exist that was not part of the imported exports, for example "
                    "in another email address or sent to another person who shares the account.",
                    "low", [], "Search your other inboxes for the amount and date, then import "
                    "any receipt you find."))
            if "possible_duplicate" in kinds:
                inv.hypotheses.append(Hypothesis(
                    "This may be an accidental second charge for the same purchase.", "moderate",
                    [e for f in findings if f["kind"] == "possible_duplicate"
                     for e in self._finding_evidence(tools, f["id"])],
                    "Compare your order history: one order or two?"))
            inv.hypotheses.append(Hypothesis(
                "The charge was not authorized by you or anyone permitted to use the account.",
                "not assessable", [],
                "Only you can say whether you recognize it. Nothing in the imported records "
                "points either way, so the app makes no claim about it."))

        if tx["amount_cents"] < 0 and not receipt:
            inv.unknowns.append(Unknown(
                "What was purchased?", "Without a receipt there is no record of the item or service.",
                "Your purchase history with the merchant named in the description."))
            inv.unknowns.append(Unknown(
                "Do you, or someone allowed to use the account, recognize this charge?",
                "This decides whether it is a billing error to dispute or simply an undocumented purchase.",
                "Your own memory and household; the merchant's account history."))
        if tx.get("processor"):
            inv.unknowns.append(Unknown(
                f"Which {tx['processor']} account, if any, made this payment?",
                "It identifies who initiated the payment and where its receipt went.",
                f"Your {tx['processor']} activity for {tx['date']}."))
        for part in d["parts"]:
            if part["label"] in ("unexplained reference number", "phone-number-shaped digits"):
                inv.unknowns.append(Unknown(
                    f"What does “{part['text']}” in the description refer to?",
                    "Codes in a descriptor are not explained by the statement.",
                    "Your bank can provide the full transaction details for this charge."))
        if "refund_not_found" in kinds:
            inv.unknowns.append(Unknown("Is a refund still pending?",
                                        "A refund may post after the imported statement period.",
                                        "Your next statement or the merchant's return status."))

        # 9. next actions
        next(step).status = "done"
        inv.next_actions = self._next_actions(tx, receipt, kinds, money)
        window = dispute_window(tx)
        inv.subject["dispute_window"] = window
        return inv

    @staticmethod
    def _finding_evidence(tools: Toolbox, finding_id: int) -> list[dict]:
        f = tools.db.finding(finding_id)
        return f["evidence"] if f else []

    @staticmethod
    def _next_actions(tx: dict, receipt: dict | None, kinds: set[str], money: str) -> list[NextAction]:
        acts: list[NextAction] = []
        if tx["amount_cents"] >= 0:
            return [NextAction("review", "No action suggested for a credit.", "you", False)]
        window = dispute_window(tx)
        if "charge_after_cancellation" in kinds:
            acts.append(NextAction("gather", "Keep the cancellation confirmation email; it is your "
                                   "main evidence.", "you", False))
            acts.append(NextAction("draft_letter", "Review a draft letter asking the merchant to "
                                   "refund charges made after the cancellation date.",
                                   "app (draft only)", True, "merchant"))
        if "possible_duplicate" in kinds:
            acts.append(NextAction("check", "Check your order history: was there one order or two?",
                                   "you", False))
            acts.append(NextAction("draft_letter", "If there was one order, review a draft letter "
                                   "asking the merchant to reverse the second charge.",
                                   "app (draft only)", True, "merchant"))
        if "amount_mismatch" in kinds:
            acts.append(NextAction("draft_letter", "Review a draft letter asking the merchant to "
                                   "correct the charge to the receipt total.",
                                   "app (draft only)", True, "merchant"))
        if not receipt:
            where = f" and your {tx['processor']} activity" if tx.get("processor") else ""
            acts.append(NextAction("check", f"Check your purchase history with the merchant named "
                                   f"in the description{where} for {tx['date']} and {money}.",
                                   "you", False))
            acts.append(NextAction("import", "If you find a receipt, export it and import it here; "
                                   "then run this investigation again.", "you", False))
        acts.append(NextAction("draft_letter", f"If the charge is still unexplained or wrong after "
                               f"those checks, review a draft billing-error notice to "
                               f"{window['letter_to']}. {window['text']}",
                               "app (draft only)", True, "issuer"))
        return acts


def investigate_transaction(db, transaction_id: int) -> tuple[Investigation, Toolbox]:
    tools = Toolbox(db)
    agent = TransactionAgent()
    inv = agent.investigate({"type": "transaction", "transaction_id": transaction_id}, tools)
    inv.tool_calls = tools.calls
    return inv, tools
