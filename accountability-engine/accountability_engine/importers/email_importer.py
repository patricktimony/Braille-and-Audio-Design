"""Receipts from email exports (.eml, .mbox, or a saved message as .txt/.html).

No email account access is needed or used: the user exports messages from
their mail program and imports the file.
"""
from __future__ import annotations

import email
import email.policy
import html
import mailbox
import os
import re
import tempfile
from email.utils import parseaddr, parsedate_to_datetime

from ..normalize import parse_amount
from .common import ParsedReceipt

TOTAL_PATTERNS = [
    r"refund (?:amount|of)[:\s]*",
    r"(?:order|grand) total[:\s]*",
    r"total (?:charged|billed|paid)[:\s]*",
    r"amount (?:charged|billed|paid|due)[:\s]*",
    r"\btotal[:\s]*",
    r"\bamount[:\s]*",
]
ORDER_RE = re.compile(r"(?:order|invoice|receipt|document|confirmation)\s*(?:id|no\.?|number|#)"
                      r"[:\s#]*([A-Z0-9][A-Z0-9-]{3,})", re.I)


def _body_text(msg: email.message.Message) -> str:
    plain, rich = [], []
    for part in msg.walk() if msg.is_multipart() else [msg]:
        ctype = part.get_content_type()
        if part.get_content_maintype() == "multipart":
            continue
        try:
            payload = part.get_content()
        except (KeyError, LookupError, AttributeError):
            raw = part.get_payload(decode=True) or b""
            payload = raw.decode("utf-8", "replace")
        if not isinstance(payload, str):
            continue
        (plain if ctype == "text/plain" else rich if ctype == "text/html" else []).append(payload)
    if plain:
        return "\n".join(plain).strip()
    return strip_html("\n".join(rich)).strip()


def strip_html(text: str) -> str:
    text = re.sub(r"(?is)<(script|style).*?</\1>", " ", text)
    text = re.sub(r"(?i)<br\s*/?>|</(p|div|tr|li|h\d)>", "\n", text)
    text = re.sub(r"<[^>]+>", " ", text)
    text = html.unescape(text)
    return "\n".join(re.sub(r"[ \t]+", " ", ln).strip() for ln in text.splitlines() if ln.strip())


def classify(subject: str, body: str) -> str:
    s = f"{subject}\n{body[:600]}".lower()
    if re.search(r"\brefund", s):
        return "refund"
    if re.search(r"\bcancel", s):
        return "cancellation"
    if re.search(r"price (change|increase|update)|new price|changes to your (plan|membership)", s):
        return "notice"
    return "receipt"


def find_total(body: str) -> int | None:
    for pat in TOTAL_PATTERNS:
        m = re.search(pat + r"(\$?\s?\d[\d,]*\.\d{2})", body, re.I)
        if m:
            parsed = parse_amount(m.group(1))
            if parsed:
                return parsed[0]
    return None


def merchant_from(sender: str) -> str:
    name, addr = parseaddr(sender or "")
    if name:
        return re.sub(r"\s+(billing|receipts?|orders?|no-?reply|support)$", "", name.strip(),
                      flags=re.I) or name.strip()
    domain = addr.split("@")[-1] if "@" in addr else addr
    parts = [p for p in domain.split(".") if p not in {"mail", "email", "billing", "www"}]
    return parts[0].capitalize() if parts else "Unknown sender"


def message_to_receipt(msg: email.message.Message, ref: str) -> ParsedReceipt:
    subject = str(msg.get("Subject", "") or "")
    sender = str(msg.get("From", "") or "")
    try:
        iso = parsedate_to_datetime(str(msg.get("Date"))).date().isoformat()
    except (TypeError, ValueError, IndexError):
        iso = None
    body = _body_text(msg)
    order = ORDER_RE.search(body) or ORDER_RE.search(subject)
    return ParsedReceipt(kind=classify(subject, body), sender=sender,
                         merchant_name=merchant_from(sender), subject=subject, date=iso,
                         total_cents=find_total(body), order_id=order.group(1) if order else None,
                         body=body[:6000], source_ref=ref)


def parse(filename: str, data: bytes) -> list[ParsedReceipt]:
    lower = filename.lower()
    text_head = data[:5].decode("latin-1")
    if lower.endswith((".mbox", ".mbx")) or text_head.startswith("From "):
        with tempfile.NamedTemporaryFile(delete=False, suffix=".mbox") as fh:
            fh.write(data)
            path = fh.name
        try:
            box = mailbox.mbox(path, factory=lambda f: email.message_from_binary_file(
                f, policy=email.policy.default))
            return [message_to_receipt(m, f"message {i}") for i, m in enumerate(box, start=1)]
        finally:
            os.unlink(path)
    msg = email.message_from_bytes(data, policy=email.policy.default)
    if not msg.get("From") and not msg.get("Subject"):
        # A saved receipt page without headers.
        body = data.decode("utf-8", "replace")
        if "<" in body and ">" in body:
            body = strip_html(body)
        return [ParsedReceipt(kind=classify("", body), sender=None,
                              merchant_name=body.strip().splitlines()[0][:80] if body.strip() else "Unknown",
                              subject=None, date=None, total_cents=find_total(body),
                              order_id=None, body=body[:6000], source_ref="whole file")]
    return [message_to_receipt(msg, "message 1")]
