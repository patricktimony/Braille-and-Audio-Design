"""Agent interface and registry.

An agent investigates one *subject* (today: a transaction) using only the
local Toolbox, and returns an Investigation that separates:

  verified_facts   — statements backed by stored records or arithmetic on them
  interpretations  — readings of text (e.g. descriptor conventions), labelled as such
  hypotheses       — possible explanations, each with its basis and how to check it
  unknowns         — what the evidence cannot answer, and how to find out
  next_actions     — proposed steps; anything that reaches outside the app is
                     only a draft and needs the user's explicit approval

To add an agent (contracts, insurance billing, government fees, ...):
subclass BaseAgent, implement `can_investigate` and `investigate`, and
decorate the class with @register. See docs/adding-an-agent.md.
"""
from __future__ import annotations

from dataclasses import asdict, dataclass, field
from typing import Any


@dataclass
class Fact:
    text: str
    evidence: list[dict]
    in_letter: bool = False    # core facts about this transaction, safe to quote in a letter


@dataclass
class Interpretation:
    text: str
    basis: str


@dataclass
class Hypothesis:
    text: str
    confidence: str            # "low" | "moderate" | "not assessable"
    basis: list[dict]          # evidence items supporting the idea (may be empty)
    how_to_check: str


@dataclass
class Unknown:
    question: str
    why_it_matters: str
    how_to_find_out: str


@dataclass
class NextAction:
    kind: str
    text: str
    performed_by: str          # "you" | "app (draft only)"
    requires_approval: bool
    letter: str | None = None  # letter kind for drafts: "issuer" | "merchant"


@dataclass
class PlanStep:
    step: str
    purpose: str
    status: str = "pending"    # pending | done | skipped


@dataclass
class Investigation:
    agent: str
    subject: dict
    plan: list[PlanStep] = field(default_factory=list)
    tool_calls: list[dict] = field(default_factory=list)
    verified_facts: list[Fact] = field(default_factory=list)
    interpretations: list[Interpretation] = field(default_factory=list)
    hypotheses: list[Hypothesis] = field(default_factory=list)
    unknowns: list[Unknown] = field(default_factory=list)
    next_actions: list[NextAction] = field(default_factory=list)
    related_findings: list[dict] = field(default_factory=list)
    summary: str = ""
    summary_source: str = "local"   # "local" or "external AI (with consent)"
    safeguards: list[str] = field(default_factory=list)

    def as_dict(self) -> dict[str, Any]:
        return asdict(self)


class BaseAgent:
    name = "base"
    description = ""

    def can_investigate(self, subject: dict) -> bool:  # pragma: no cover - interface
        raise NotImplementedError

    def investigate(self, subject: dict, tools) -> Investigation:  # pragma: no cover
        raise NotImplementedError


AGENTS: dict[str, type[BaseAgent]] = {}


def register(cls: type[BaseAgent]) -> type[BaseAgent]:
    AGENTS[cls.name] = cls
    return cls


def agent_for(subject: dict) -> BaseAgent:
    for cls in AGENTS.values():
        agent = cls()
        if agent.can_investigate(subject):
            return agent
    raise LookupError("No agent can investigate this subject yet.")
