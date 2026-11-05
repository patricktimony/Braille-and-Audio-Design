from accountability_engine.agents.chat import answer


def test_example_question_runs_investigation(demo_db):
    res = answer(demo_db, "What was this $295.98 Apple charge?")
    inv = res["investigation"]
    assert inv["subject"]["transaction"]["raw_description"] == "PP*APPLE.COM/BILL402-935-7733 CA 8231"
    assert "Still unknown" in res["reply"] and "not confirmed" in res["reply"]


def test_ambiguous_amount_asks_which(demo_db):
    res = answer(demo_db, "What was the $64.27 charge?")
    assert "investigation" not in res and len(res["candidates"]) == 2


def test_unknown_amount_does_not_guess(demo_db):
    res = answer(demo_db, "What was this $999.99 charge?")
    assert "I will not guess" in res["reply"]


def test_finding_questions(demo_db):
    assert "possible duplicate" in answer(demo_db, "Show possible duplicate charges")["reply"]
    assert "FITLIFE" in answer(demo_db, "Was I charged after cancelling anything?")["reply"]
    assert "refund" in answer(demo_db, "Any refunds missing?")["reply"].lower()


def test_spending_total(demo_db):
    res = answer(demo_db, "How much did I spend at Amazon?")
    assert "5 charges" in res["reply"] and "$227.18" in res["reply"]


def test_by_transaction_number(demo_db):
    res = answer(demo_db, "Investigate transaction 1")
    assert res["investigation"]["subject"]["transaction"]["id"] == 1


def test_help_and_empty(db):
    assert "You can ask" in answer(db, "help")["reply"]
    assert "No statements are imported" in answer(db, "What was the $5.00 charge?")["reply"]
