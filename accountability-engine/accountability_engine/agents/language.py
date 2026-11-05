"""Neutral-language guard.

The app must never describe a transaction as theft or fraud. Generated text
is checked against this list; external AI output that fails is discarded.
"""
from __future__ import annotations

import re

FORBIDDEN = ["fraud", "fraudulent", "fraudster", "theft", "thief", "stole", "stolen", "steal",
             "scam", "scammer", "criminal", "crime", "illegal", "embezzle", "con artist"]
_RE = re.compile(r"\b(" + "|".join(re.escape(w) for w in FORBIDDEN) + r")\w*\b", re.I)


def violations(text: str) -> list[str]:
    return sorted({m.group(0).lower() for m in _RE.finditer(text or "")})


def is_neutral(text: str) -> bool:
    return not violations(text)
