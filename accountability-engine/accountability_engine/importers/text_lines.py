"""Parse statement lines from extracted text (PDF text layers and OCR output)."""
from __future__ import annotations

import re

from ..normalize import AMOUNT_RE, parse_amount, parse_date
from .common import ParsedTransaction, resolve_sign

DATE_PART = (r"(?P<date>\d{1,2}/\d{1,2}(?:/\d{2,4})?|\d{4}-\d{2}-\d{2}|"
             r"(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\.? \d{1,2}(?:,? \d{4})?)")
LINE_RE = re.compile(r"^\s*" + DATE_PART + r"(?:\s+" + DATE_PART.replace("?P<date>", "?P<date2>")
                     + r")?\s+(?P<desc>.+?)\s+(?P<amount>" + AMOUNT_RE.pattern + r")\s*$", re.I)
YEAR_RE = re.compile(r"\b(20\d{2})\b")
SKIP_RE = re.compile(r"\b(balance|total|subtotal|minimum payment|page \d)\b", re.I)


MONTH_DAY_OCR = re.compile(r"^(\s*)(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)([a-z]*\.?)\s?"
                           r"([0-9lIO|]{1,2})\b")


def fix_ocr_line(line: str) -> str:
    """Repair common OCR slips in a leading date such as 'Nov1' or 'Novl'."""
    def repl(m: re.Match) -> str:
        day = m[4].translate(str.maketrans("lI|O", "1110"))
        return f"{m[1]}{m[2]}{m[3]} {day}"
    return MONTH_DAY_OCR.sub(repl, line, count=1)


def guess_year(text: str) -> int | None:
    years = YEAR_RE.findall(text)
    return int(max(set(years), key=years.count)) if years else None


def parse_lines(text: str, account_type: str, year_hint: int | None, ref_prefix: str,
                confidence: float = 1.0) -> list[ParsedTransaction]:
    year = year_hint or guess_year(text)
    out: list[ParsedTransaction] = []
    for n, line in enumerate(text.splitlines(), start=1):
        line = line.replace("—", "-").replace("–", "-").strip()
        if confidence < 1.0:
            line = fix_ocr_line(line)
        m = LINE_RE.match(line)
        if not m:
            continue
        desc = re.sub(r"\s+", " ", m["desc"]).strip(" -")
        if SKIP_RE.search(desc) and not re.search(r"payment thank you", desc, re.I):
            continue
        iso = parse_date(m["date"], year)
        parsed = parse_amount(m["amount"])
        if not iso or not parsed:
            continue
        signed, note = resolve_sign(parsed[0], parsed[1], account_type, desc)
        notes = [note] if note else []
        if year_hint is None and not re.search(r"\d{4}", m["date"]):
            notes.append(f"Year not printed on the line; assumed {year}.")
        out.append(ParsedTransaction(date=iso, amount_cents=signed, raw_description=desc,
                                     source_ref=f"{ref_prefix}line {n}", confidence=confidence,
                                     notes=notes))
    return out
