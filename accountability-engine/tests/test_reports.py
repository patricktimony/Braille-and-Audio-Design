import re

from accountability_engine import reports
from accountability_engine.agents import run_investigation
from accountability_engine.agents.language import is_neutral

from .conftest import apple_tx


def test_investigation_reports(demo_db):
    inv = run_investigation(demo_db, apple_tx(demo_db)["id"])
    html = reports.investigation_html(inv)
    assert '<html lang="en">' in html and "<title>" in html and "<main>" in html
    for heading in ("Verified facts", "Hypotheses (not confirmed)", "Unknowns", "Next actions"):
        assert f"<h2>{heading}</h2>" in html
    assert 'scope="row"' in html and 'scope="col"' in html and "<caption>" in html
    assert "PP*APPLE.COM/BILL402-935-7733 CA 8231" in html
    text = reports.investigation_text(inv)
    assert "VERIFIED FACTS" in text and "HYPOTHESES (not confirmed)" in text and "UNKNOWNS" in text
    assert is_neutral(html) and is_neutral(text)


def test_letter_contains_only_verified_facts(demo_db):
    inv = run_investigation(demo_db, apple_tx(demo_db)["id"])
    letter = reports.letter_text(inv, "issuer")
    assert letter.startswith("DRAFT — NOT SENT")
    assert "Description on my statement: PP*APPLE.COM/BILL402-935-7733 CA 8231" in letter
    for h in inv["hypotheses"]:
        assert h["text"] not in letter
    assert "[ ] I do not recognize this charge" in letter  # user must choose; nothing pre-asserted
    assert "4417" not in letter                          # no card numbers copied in
    assert is_neutral(letter)
    html = reports.letter_html(inv, "merchant")
    assert "Draft letter to the merchant" in html and "NOT SENT" in html


def test_merchant_letter_for_cancellation_cites_confirmation(demo_db):
    f = [x for x in demo_db.findings() if x["kind"] == "charge_after_cancellation"][0]
    inv = run_investigation(demo_db, f["transaction_ids"][0])
    letter = reports.letter_text(inv, "merchant")
    assert "cancellation effective 2026-08-31" in letter
    assert "fitlife_cancellation.eml" in letter


def test_findings_reports(demo_db):
    html = reports.findings_html(demo_db.findings(), demo_db)
    assert html.count("<section>") == len(demo_db.findings())
    assert re.search(r"<h2>Possible duplicate charge", html)
    assert "Source transactions" in html
    text = reports.findings_text(demo_db.findings(), demo_db)
    assert "FINDINGS REPORT" in text and "Transaction:" in text
