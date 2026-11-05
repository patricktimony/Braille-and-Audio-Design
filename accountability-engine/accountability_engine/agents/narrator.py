"""Plain-language summaries of an investigation.

Local mode (the default) builds the summary from templates on this computer.

External mode is optional and off by default. It sends a *redacted* copy of
the already-verified statements (not the raw files) to an AI service to
rephrase them. It runs only if the user has explicitly granted consent in
Settings AND an API key is configured. Its output is checked by the
neutral-language guard and labelled as AI-written.
"""
from __future__ import annotations

import re

import httpx

from .. import config
from ..db import Database
from .base import Investigation
from .language import is_neutral

CONSENT_KEY = "external_ai_consent"
MODE_KEY = "analysis_mode"


class ConsentRequired(PermissionError):
    pass


def consent_granted(db: Database) -> bool:
    return db.get_setting(CONSENT_KEY) == "granted"


def local_summary(inv: Investigation) -> str:
    tx = inv.subject["transaction"]
    from ..normalize import format_money
    money = format_money(abs(tx["amount_cents"]))
    lines = [f"Investigation of the {money} item dated {tx['date']}, described as "
             f"“{tx['raw_description']}”."]
    lines.append(f"Verified from your records ({len(inv.verified_facts)} statements): "
                 + " ".join(f.text for f in inv.verified_facts[2:5]))
    if inv.hypotheses:
        lines.append("Possible explanations, none confirmed: "
                     + " ".join(f"({i}) {h.text}" for i, h in enumerate(inv.hypotheses, 1)
                                if h.confidence != "not assessable"))
    if inv.unknowns:
        lines.append("Still unknown: " + " ".join(u.question for u in inv.unknowns))
    if inv.next_actions:
        lines.append("Suggested next step: " + inv.next_actions[0].text)
    return "\n\n".join(lines)


REDACT_PATTERNS = [
    (re.compile(r"\b(ending|••••|x{2,}|\*{2,})\s*\d{4}\b", re.I), r"\1 ####"),
    (re.compile(r"[\w.+-]+@[\w-]+\.[\w.]+"), "[email]"),
    (re.compile(r"\b\d{3}-\d{7}-\d{7}\b"), "[order number]"),
]


def redact(text: str, account_names: list[str]) -> str:
    for pattern, repl in REDACT_PATTERNS:
        text = pattern.sub(repl, text)
    for name in account_names:
        if name:
            text = text.replace(name, "[account]")
    return text


def external_payload(inv: Investigation) -> str:
    tx = inv.subject["transaction"]
    parts = ["VERIFIED FACTS:"] + [f"- {f.text}" for f in inv.verified_facts]
    parts += ["HYPOTHESES (unconfirmed):"] + [f"- {h.text} [{h.confidence}]" for h in inv.hypotheses]
    parts += ["UNKNOWNS:"] + [f"- {u.question}" for u in inv.unknowns]
    return redact("\n".join(parts), [tx["account_name"]])


SYSTEM = ("You rewrite consumer transaction investigation notes in plain, calm language for a "
          "screen-reader user. Use ONLY the statements given. Keep facts, hypotheses and unknowns "
          "clearly separated under those three headings. Do not add any purchase details, merchant "
          "identities or evidence that are not in the notes. Never call anything fraud, theft or a "
          "scam. Under 200 words.")


def external_summary(db: Database, inv: Investigation, client: httpx.Client | None = None) -> str:
    if not consent_granted(db):
        raise ConsentRequired("External AI is off. Turn it on in Settings and confirm consent first.")
    key = config.llm_api_key()
    if not key:
        raise RuntimeError("External AI is enabled but no ANTHROPIC_API_KEY is set.")
    payload = external_payload(inv)
    db.audit("external_ai_request", {"chars": len(payload), "model": config.llm_model()})
    client = client or httpx.Client(timeout=60)
    resp = client.post("https://api.anthropic.com/v1/messages", headers={
        "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json"},
        json={"model": config.llm_model(), "max_tokens": 600, "system": SYSTEM,
              "messages": [{"role": "user", "content": payload}]})
    resp.raise_for_status()
    text = "".join(b.get("text", "") for b in resp.json().get("content", []) if b.get("type") == "text")
    if not text.strip() or not is_neutral(text):
        db.audit("external_ai_rejected", "Output failed the neutral-language check")
        raise ValueError("The AI summary was discarded because it did not meet the app's "
                         "neutral-language rules. The local summary is shown instead.")
    return text.strip()
