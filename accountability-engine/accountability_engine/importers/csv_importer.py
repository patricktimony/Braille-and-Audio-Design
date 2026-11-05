"""CSV bank exports. Column names vary by bank, so headers are matched by alias."""
from __future__ import annotations

import csv
import io

from ..normalize import parse_amount, parse_date
from .common import ParsedTransaction, resolve_sign

DATE_COLS = ["date", "transaction date", "posted date", "posting date", "trans date", "post date"]
DESC_COLS = ["description", "original description", "details", "memo", "payee", "name",
             "transaction description", "merchant"]
AMOUNT_COLS = ["amount", "transaction amount", "amount (usd)"]
DEBIT_COLS = ["debit", "withdrawal", "withdrawals", "debit amount", "charges"]
CREDIT_COLS = ["credit", "deposit", "deposits", "credit amount", "payments"]


def _find(headers: list[str], names: list[str]) -> int | None:
    lowered = [h.strip().lower() for h in headers]
    for name in names:
        if name in lowered:
            return lowered.index(name)
    return None


def parse(data: bytes, account_type: str) -> tuple[list[ParsedTransaction], list[str]]:
    text = data.decode("utf-8-sig", errors="replace")
    reader = csv.reader(io.StringIO(text))
    rows = [r for r in reader]
    warnings: list[str] = []
    header_idx = next((i for i, r in enumerate(rows[:15])
                       if _find(r, DATE_COLS) is not None and _find(r, DESC_COLS) is not None), None)
    if header_idx is None:
        raise ValueError("Could not find a header row with a date column and a description column.")
    headers = rows[header_idx]
    di, ti = _find(headers, DATE_COLS), _find(headers, DESC_COLS)
    ai, dbi, cri = _find(headers, AMOUNT_COLS), _find(headers, DEBIT_COLS), _find(headers, CREDIT_COLS)
    if ai is None and dbi is None and cri is None:
        raise ValueError("Could not find an amount column (Amount, or Debit and Credit).")
    out: list[ParsedTransaction] = []
    for n, row in enumerate(rows[header_idx + 1:], start=header_idx + 2):
        if not any(c.strip() for c in row):
            continue
        ref = f"row {n}"
        get = lambda i: row[i].strip() if i is not None and i < len(row) else ""  # noqa: E731
        iso = parse_date(get(di))
        desc = get(ti)
        if not iso or not desc:
            warnings.append(f"Skipped {ref}: missing or unreadable date or description.")
            continue
        notes: list[str] = []
        if ai is not None and get(ai):
            parsed = parse_amount(get(ai))
            if not parsed:
                warnings.append(f"Skipped {ref}: unreadable amount '{get(ai)}'.")
                continue
            cents, sign = parsed
            if sign is None:
                # A plain number in a single Amount column: positive means money in.
                signed = cents if account_type != "credit_card" else -cents
            else:
                signed, note = resolve_sign(cents, sign, account_type, desc)
                if note:
                    notes.append(note)
        else:
            debit = parse_amount(get(dbi)) if get(dbi) else None
            credit = parse_amount(get(cri)) if get(cri) else None
            if debit and debit[0]:
                signed = -debit[0]
            elif credit and credit[0]:
                signed = credit[0]
            else:
                warnings.append(f"Skipped {ref}: no amount in Debit or Credit columns.")
                continue
        out.append(ParsedTransaction(date=iso, amount_cents=signed, raw_description=desc,
                                     source_ref=ref, notes=notes))
    return out, warnings
