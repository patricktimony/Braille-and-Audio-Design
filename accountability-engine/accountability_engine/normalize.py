"""Parse and normalize dates, amounts and merchant descriptors.

Descriptor decoding is pattern-based. It reports what the text *looks like*
(e.g. "a ten-digit number shaped like a phone number"); it never claims to
know who a merchant is.
"""
from __future__ import annotations

import re
from datetime import date, datetime

MONTHS = {m: i for i, m in enumerate(
    ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"], 1)}

# ---------------------------------------------------------------- dates


def parse_date(text: str, year_hint: int | None = None) -> str | None:
    """Return an ISO date (yyyy-mm-dd) or None. Accepts common bank formats."""
    s = (text or "").strip().replace(",", " ")
    s = re.sub(r"\s+", " ", s)
    if not s:
        return None
    m = re.fullmatch(r"(\d{4})-(\d{1,2})-(\d{1,2})(?:[T ].*)?", s)
    if m:
        return _iso(int(m[1]), int(m[2]), int(m[3]))
    m = re.fullmatch(r"(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?", s)
    if m:
        year = _year(m[3], year_hint)
        return _iso(year, int(m[1]), int(m[2])) if year else None
    m = re.fullmatch(r"([A-Za-z]{3,9})\.? (\d{1,2})(?: (\d{4}))?", s)
    if m and m[1][:3].lower() in MONTHS:
        year = int(m[3]) if m[3] else year_hint
        return _iso(year, MONTHS[m[1][:3].lower()], int(m[2])) if year else None
    m = re.fullmatch(r"(\d{1,2}) ([A-Za-z]{3,9})\.?(?: (\d{4}))?", s)
    if m and m[2][:3].lower() in MONTHS:
        year = int(m[3]) if m[3] else year_hint
        return _iso(year, MONTHS[m[2][:3].lower()], int(m[1])) if year else None
    return None


def _year(text: str | None, hint: int | None) -> int | None:
    if not text:
        return hint
    y = int(text)
    return y + 2000 if y < 100 else y


def _iso(y: int | None, m: int, d: int) -> str | None:
    try:
        return date(y, m, d).isoformat() if y else None
    except ValueError:
        return None


def days_between(a: str, b: str) -> int:
    return (datetime.fromisoformat(b) - datetime.fromisoformat(a)).days


# -------------------------------------------------------------- amounts

AMOUNT_RE = re.compile(r"[-+−(]?\s*\$?\s*\d[\d,]*\.\d{2}\)?(?:\s*(?:CR|DR))?", re.I)


def parse_amount(text: str) -> tuple[int, str | None] | None:
    """Parse an amount into (cents, explicit_sign).

    explicit_sign is "-" (minus or parentheses), "+" (plus), "CR", "DR" or None
    when the text carries no sign. The caller decides what an unsigned amount
    means, because that depends on the kind of statement.
    """
    s = (text or "").strip().replace("−", "-")
    if not s:
        return None
    sign = None
    if re.search(r"\bCR\b", s, re.I):
        sign = "CR"
    elif re.search(r"\bDR\b", s, re.I):
        sign = "DR"
    elif s.startswith("(") and s.endswith(")"):
        sign = "-"
    elif s.lstrip("$ ").startswith("-") or s.startswith("-"):
        sign = "-"
    elif s.startswith("+"):
        sign = "+"
    digits = re.sub(r"[^\d.]", "", s)
    if not re.fullmatch(r"\d+(\.\d{1,2})?", digits):
        return None
    whole, _, frac = digits.partition(".")
    cents = int(whole) * 100 + int((frac + "00")[:2])
    return cents, sign


def format_money(cents: int, signed: bool = False) -> str:
    text = f"${abs(cents) / 100:,.2f}"
    if signed:
        return ("debit " if cents < 0 else "credit ") + text
    return text


# ----------------------------------------------------------- descriptors

# Prefixes that payment processors commonly put in front of a merchant name.
# This is general descriptor convention, not verification of any one charge.
PROCESSOR_PREFIXES = [
    (re.compile(r"^PP\s*\*\s*", re.I), "PayPal"),
    (re.compile(r"^PAYPAL\s*\*\s*", re.I), "PayPal"),
    (re.compile(r"^SQ\s*\*\s*", re.I), "Square"),
    (re.compile(r"^TST\s*\*\s*", re.I), "Toast"),
    (re.compile(r"^SP\s*\*?\s+", re.I), "Shopify"),
    (re.compile(r"^GOOGLE\s*\*\s*", re.I), "Google"),
]
ALIASES = {"amzn": "amazon", "amazon.com": "amazon", "wm": "walmart"}
STOP = {"com", "www", "bill", "inc", "llc", "the", "payment", "pos", "debit", "purchase",
        "card", "mktp", "us", "co", "store", "online", "recurring", "ach", "net", "org"}
US_STATES = set("AL AK AZ AR CA CO CT DE FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO "
                "MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY DC".split())
PHONE_RE = re.compile(r"(?<!\d)(\d{3})[-. ]?(\d{3})[-. ]?(\d{4})(?!\d)")


def parse_descriptor(raw: str) -> dict:
    """Split a raw bank descriptor into labelled parts.

    Every part carries a plain-language note on how certain the reading is.
    """
    text = re.sub(r"\s+", " ", (raw or "").strip())
    parts: list[dict] = []
    processor = None
    rest = text
    for pattern, name in PROCESSOR_PREFIXES:
        m = pattern.match(rest)
        if m:
            processor = name
            parts.append({"text": m.group(0).strip(), "label": "processor prefix",
                          "note": f"Commonly used for payments processed through {name}. "
                                  "This is a descriptor convention, not proof of how this "
                                  "particular payment was made."})
            rest = rest[m.end():]
            break

    phone = None
    pm = PHONE_RE.search(rest)
    if pm:
        phone = f"{pm[1]}-{pm[2]}-{pm[3]}"
        parts.append({"text": pm.group(0), "label": "phone-number-shaped digits",
                      "note": "Ten digits in the shape of a phone number. The app has not "
                              "checked who answers this number."})
        rest = (rest[:pm.start()] + " " + rest[pm.end():]).strip()

    tokens = rest.split()
    state = None
    trailing: list[str] = []
    # Walk back from the end collecting a state code and trailing reference numbers.
    while tokens:
        tok = tokens[-1]
        if re.fullmatch(r"#?\d{2,}", tok):
            trailing.insert(0, tok)
            tokens.pop()
        elif tok.upper() in US_STATES and state is None and len(tokens) > 1:
            state = tok.upper()
            tokens.pop()
        else:
            break
    if state:
        parts.append({"text": state, "label": "possible state code",
                      "note": f"'{state}' matches a US state abbreviation. It may describe the "
                              "merchant's registered location, not where the purchase happened."})
    for ref in trailing:
        parts.append({"text": ref, "label": "unexplained reference number",
                      "note": "A number at the end of the descriptor. Its meaning (store number, "
                              "terminal, reference) cannot be determined from the text alone."})
    # Store numbers embedded like "#0412"
    name_tokens = []
    for tok in tokens:
        if re.fullmatch(r"#\d+", tok):
            parts.append({"text": tok, "label": "possible store or location number",
                          "note": "A '#' followed by digits, often a store or location number."})
        else:
            name_tokens.append(tok)
    name_text = " ".join(name_tokens).strip(" *-/")
    # Amazon-style order codes: "AMZN Mktp US*2K4RT9"
    m = re.search(r"\*([A-Z0-9]{5,})$", name_text, re.I)
    if m and re.search(r"\d", m[1]):
        parts.append({"text": m[1], "label": "order or reference code",
                      "note": "A code after '*'. Merchants often place an order reference here."})
        name_text = name_text[:m.start()].strip(" *")
    parts.insert(0 if not processor else 1,
                 {"text": name_text, "label": "merchant name as printed",
                  "note": "The name exactly as the bank printed it. A printed name is a claim "
                          "by the payment network, not verified merchant identity."})
    return {
        "raw": raw,
        "processor": processor,
        "merchant_text": name_text,
        "phone": phone,
        "state": state,
        "references": trailing,
        "parts": parts,
    }


def merchant_display(name_text: str) -> str:
    cleaned = re.sub(r"\s+", " ", name_text).strip()
    return cleaned.upper() if cleaned else "UNKNOWN"


def merchant_key(name_text: str) -> str:
    """A grouping key: lower-case first meaningful word(s) of the merchant name."""
    raw_tokens = re.split(r"[\s*]+", name_text.lower())
    words: list[str] = []
    for tok in raw_tokens:
        if not tok:
            continue
        if re.search(r"[a-z0-9]\.(com|net|org|co)\b", tok):  # domain-like: keep the stem
            host = re.sub(r"^www\.", "", tok)
            stem = re.split(r"[^a-z0-9]+", host.split(".")[0])[0]
            if stem:
                words.append(stem)
            break
        for piece in re.split(r"[^a-z0-9]+", tok):
            if piece and not piece.isdigit():
                words.append(piece)
    words = [ALIASES.get(w, w) for w in words]
    meaningful = [w for w in words if w not in STOP and len(w) > 1]
    if not meaningful:
        return "unknown"
    if words and raw_tokens and re.search(r"\.(com|net|org|co)\b", raw_tokens[0]):
        return meaningful[0]
    if meaningful[0] in {"amazon", "apple", "google", "paypal", "walmart"}:
        return meaningful[0]
    return " ".join(meaningful[:2])


def tokens(text: str) -> set[str]:
    out = set()
    for piece in re.split(r"[^a-z0-9]+", (text or "").lower()):
        if len(piece) >= 3 and not piece.isdigit() and piece not in STOP:
            out.add(ALIASES.get(piece, piece))
    return out


def merchant_similarity(a: str, b: str) -> float:
    """0..1 similarity between two merchant texts (names, sender addresses)."""
    ta, tb = tokens(a), tokens(b)
    if not ta or not tb:
        return 0.0
    if ta & tb:
        return 1.0
    for x in ta:
        for y in tb:
            if len(x) >= 4 and len(y) >= 4 and (x in y or y in x):
                return 0.8
    return 0.0


def normalize_transaction(raw_description: str) -> dict:
    d = parse_descriptor(raw_description)
    return {
        "merchant_name": merchant_display(d["merchant_text"]),
        "merchant_key": merchant_key(d["merchant_text"]),
        "processor": d["processor"],
        "descriptor": d,
    }
