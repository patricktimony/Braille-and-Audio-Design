"""Investigation agents. Import order registers the built-in agents."""
from __future__ import annotations

import json

from ..db import Database, now_iso
from . import transaction_agent  # noqa: F401  (registers TransactionAgent)
from .base import AGENTS, Investigation, agent_for  # noqa: F401
from .narrator import MODE_KEY, consent_granted, external_summary, local_summary
from .transaction_agent import investigate_transaction


def run_investigation(db: Database, transaction_id: int, mode: str | None = None) -> dict:
    """Investigate a transaction, store the result and its proposed actions."""
    mode = mode or db.get_setting(MODE_KEY, "local")
    inv, _tools = investigate_transaction(db, transaction_id)
    inv.summary = local_summary(inv)
    notes = []
    if mode == "external":
        try:
            inv.summary = external_summary(db, inv)
            inv.summary_source = "external AI (with your consent), from redacted verified statements"
            inv.safeguards[0] = ("A redacted copy of the verified statements was sent to an external "
                                 "AI service, with your consent, only to word the summary.")
        except Exception as exc:  # fall back to local, and say why
            notes.append(str(exc))
            mode = "local"
    result = inv.as_dict()
    result["mode"] = mode
    result["notes"] = notes
    cur = db.execute("INSERT INTO investigations (transaction_id, agent, mode, created_at, result) "
                     "VALUES (?,?,?,?,?)", (transaction_id, inv.agent, mode, now_iso(), "{}"))
    inv_id = cur.lastrowid
    result["id"] = inv_id
    for i, act in enumerate(result["next_actions"]):
        if act["requires_approval"]:
            a = db.execute("INSERT INTO actions (investigation_id, kind, description, status, "
                           "created_at) VALUES (?,?,?,?,?)",
                           (inv_id, act["kind"] + (":" + act["letter"] if act["letter"] else ""),
                            act["text"], "proposed", now_iso()))
            act["action_id"] = a.lastrowid
    db.execute("UPDATE investigations SET result=? WHERE id=?", (json.dumps(result), inv_id))
    db.audit("investigation_run", {"investigation_id": inv_id, "transaction_id": transaction_id,
                                   "mode": mode})
    return result


def get_investigation(db: Database, inv_id: int) -> dict | None:
    row = db.one("SELECT result FROM investigations WHERE id=?", (inv_id,))
    return json.loads(row["result"]) if row else None


__all__ = ["run_investigation", "get_investigation", "consent_granted", "AGENTS"]
