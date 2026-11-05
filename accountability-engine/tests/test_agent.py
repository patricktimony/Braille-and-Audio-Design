import json

import pytest

from accountability_engine.agents import run_investigation
from accountability_engine.agents.language import is_neutral, violations
from accountability_engine.agents.narrator import ConsentRequired, external_summary, redact
from accountability_engine.agents.transaction_agent import investigate_transaction

from .conftest import apple_tx


@pytest.fixture
def apple(demo_db):
    return run_investigation(demo_db, apple_tx(demo_db)["id"])


def all_text(inv):
    return json.dumps(inv, ensure_ascii=False)


def test_plan_is_fully_executed_with_logged_tools(apple):
    assert all(s["status"] == "done" for s in apple["plan"])
    tools = [c["tool"] for c in apple["tool_calls"]]
    for t in ("get_transaction", "descriptor", "matched_receipt", "find_receipts",
              "merchant_history", "amount_relationships", "find_credits_after",
              "findings_for_transaction"):
        assert t in tools


def test_verified_facts_about_example(apple):
    facts = " ".join(f["text"] for f in apple["verified_facts"])
    assert "$295.98" in facts and "2026-09-18" in facts
    assert "PP*APPLE.COM/BILL402-935-7733 CA 8231" in facts
    assert "None of the 21 imported emails is a receipt for $295.98" in facts
    assert "$295.98 = 2 × $147.99" in facts
    assert "PhotoStudio Pro" in facts          # quoted from the imported receipt
    assert "the largest of them" in facts
    assert "“PP*” prefix" in facts
    assert "No refund or credit" in facts


def test_every_fact_has_resolvable_evidence(demo_db, apple):
    for f in apple["verified_facts"]:
        assert f["evidence"], f["text"]
        for e in f["evidence"]:
            assert e["type"] in ("transaction", "receipt", "calculation", "absence")
            if e["type"] == "transaction":
                assert demo_db.transaction(e["transaction_id"])
            if e["type"] == "receipt":
                assert demo_db.receipt(e["receipt_id"])


def test_hypotheses_are_labelled_and_checkable(apple):
    hyps = apple["hypotheses"]
    assert len(hyps) >= 3
    assert all(h["confidence"] in ("low", "moderate", "not assessable") for h in hyps)
    assert all(h["how_to_check"] for h in hyps)
    texts = " ".join(h["text"] for h in hyps)
    assert "PayPal" in texts and "2 × $147.99" in texts
    unauthorized = [h for h in hyps if "not authorized" in h["text"]]
    assert unauthorized and unauthorized[0]["confidence"] == "not assessable"
    # Hypotheses must never appear among verified facts.
    facts = " ".join(f["text"] for f in apple["verified_facts"])
    assert "may" not in facts.split()


def test_unknowns_and_next_actions(apple):
    qs = " ".join(u["question"] for u in apple["unknowns"])
    assert "What was purchased?" in qs and "8231" in qs and "PayPal" in qs
    acts = apple["next_actions"]
    assert acts[0]["performed_by"] == "you" and not acts[0]["requires_approval"]
    drafts = [a for a in acts if a["kind"] == "draft_letter"]
    assert drafts and all(a["requires_approval"] and a["performed_by"] == "app (draft only)"
                          for a in drafts)
    assert any("Regulation E" in a["text"] for a in drafts)  # checking account → Reg E


def test_does_not_invent_merchant_identity(apple):
    interp = " ".join(i["basis"] for i in apple["interpretations"])
    assert "not verified merchant identity" in interp
    assert "has not checked who answers" in interp


def test_neutral_language_everywhere(demo_db):
    for t in demo_db.transactions()[:: 7]:
        inv = run_investigation(demo_db, t["id"])
        assert is_neutral(all_text(inv)), violations(all_text(inv))
    for f in demo_db.findings():
        assert is_neutral(f["title"] + f["summary"] + json.dumps(f["evidence"]))


def test_language_guard():
    assert violations("This looks like fraud and theft") == ["fraud", "theft"]
    assert is_neutral("This charge is unexplained")


def test_receipt_backed_charge_has_no_hypotheses(demo_db):
    tx = demo_db.one("SELECT id FROM transactions WHERE amount_cents=-14799")
    inv = run_investigation(demo_db, tx["id"])
    assert inv["hypotheses"] == []
    assert any("PhotoStudio Pro" in f["text"] for f in inv["verified_facts"])


def test_local_mode_is_default_and_external_needs_consent(demo_db):
    inv = run_investigation(demo_db, apple_tx(demo_db)["id"])
    assert inv["mode"] == "local" and inv["summary_source"] == "local"
    i, _ = investigate_transaction(demo_db, apple_tx(demo_db)["id"])
    with pytest.raises(ConsentRequired):
        external_summary(demo_db, i)
    # Asking for external mode without consent falls back to local and says why.
    inv = run_investigation(demo_db, apple_tx(demo_db)["id"], mode="external")
    assert inv["mode"] == "local" and inv["notes"]


class FakeClient:
    def __init__(self, text):
        self.text, self.sent = text, None

    def post(self, url, headers, json):
        self.sent = json

        class R:
            def raise_for_status(self_inner):
                pass

            def json(self_inner):
                return {"content": [{"type": "text", "text": self.text}]}
        return R()


def test_external_summary_redacts_and_guards(demo_db, monkeypatch):
    demo_db.set_setting("external_ai_consent", "granted")
    monkeypatch.setenv("ANTHROPIC_API_KEY", "test-key")
    inv, _ = investigate_transaction(demo_db, apple_tx(demo_db)["id"])
    ok = FakeClient("Verified facts: ... Hypotheses: ... Unknowns: ...")
    assert external_summary(demo_db, inv, client=ok).startswith("Verified")
    sent = ok.sent["messages"][0]["content"]
    assert "4417" not in sent and "Demo Checking" not in sent
    bad = FakeClient("This is clearly fraud.")
    with pytest.raises(ValueError):
        external_summary(demo_db, inv, client=bad)


def test_redact():
    assert redact("Visa Debit ending 4417 me@x.com", []) == "Visa Debit ending #### [email]"


def test_new_agents_can_be_registered(demo_db):
    from accountability_engine.agents.base import AGENTS, BaseAgent, Fact, Investigation, register
    from accountability_engine.agents.base import agent_for
    from accountability_engine.agents.tools import Toolbox
    from accountability_engine.analysis.evidence import tx_evidence

    @register
    class SubscriptionAgent(BaseAgent):
        name = "test-subscription"

        def can_investigate(self, subject):
            return subject.get("type") == "subscription"

        def investigate(self, subject, tools):
            inv = Investigation(agent=self.name, subject=subject)
            charges = tools.search_transactions(merchant=subject["merchant"])
            inv.verified_facts.append(Fact(f"{len(charges)} charges.",
                                           [tx_evidence(t) for t in charges]))
            return inv

    try:
        agent = agent_for({"type": "subscription", "merchant": "FitLife Gym"})
        inv = agent.investigate({"type": "subscription", "merchant": "FitLife Gym"}, Toolbox(demo_db))
        assert inv.verified_facts[0].evidence
        assert agent_for({"type": "transaction"}).name == "transaction-investigator"
    finally:
        AGENTS.pop("test-subscription")
