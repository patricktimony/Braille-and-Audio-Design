from accountability_engine.importers.image_importer import ocr_available


def kinds(db):
    return [f["kind"] for f in db.findings()]


def find(db, kind, text=""):
    return [f for f in db.findings() if f["kind"] == kind and text.lower() in f["title"].lower()]


def test_demo_has_100_transactions(demo_db):
    n = demo_db.one("SELECT COUNT(*) AS n FROM transactions")["n"]
    assert n == (100 if ocr_available() else 94)


def test_duplicate_amazon(demo_db):
    f = find(demo_db, "possible_duplicate")
    assert len(f) == 1 and "$64.27" in f[0]["title"]
    assert len(f[0]["transaction_ids"]) == 2 and len(f[0]["receipt_ids"]) == 1
    assert "Only one matching receipt" in f[0]["summary"]


def test_charge_after_cancellation(demo_db):
    f = find(demo_db, "charge_after_cancellation")
    assert len(f) == 1
    dates = sorted(demo_db.transaction(t)["date"] for t in f[0]["transaction_ids"])
    assert dates[:2] == ["2026-09-01", "2026-10-01"]
    assert "2026-08-31" in f[0]["summary"]


def test_price_change_streamflix(demo_db):
    f = find(demo_db, "price_change", "streamflix")
    assert f and "$15.49 → $22.99" in f[0]["title"]
    assert "No price-change notice" in f[0]["summary"]


def test_unusual_water_and_apple(demo_db):
    titles = [f["title"] for f in find(demo_db, "unusual_amount")]
    assert any("CITY WATER" in t and "$412.60" in t for t in titles)
    assert any("APPLE" in t and "$295.98" in t for t in titles)


def test_refund_not_found(demo_db):
    f = find(demo_db, "refund_not_found")
    assert len(f) == 1 and "$129.00" in f[0]["title"]
    assert f[0]["transaction_ids"], "the original purchase should be linked as evidence"


def test_amount_mismatch_harbor(demo_db):
    f = find(demo_db, "amount_mismatch")
    assert len(f) == 1 and "HARBOR" in f[0]["title"]
    assert any("same digits" in e["text"] for e in f[0]["evidence"])


def test_unmatched_receipt_page_turner(demo_db):
    f = find(demo_db, "unmatched_receipt")
    assert len(f) == 1 and "Page Turner" in f[0]["title"]


def test_missing_receipt_for_example(demo_db):
    f = find(demo_db, "missing_receipt", "apple")
    assert f and "$295.98" in f[0]["title"]


def test_recurring_includes_undocumented_netsvcs(demo_db):
    f = find(demo_db, "recurring", "netsvcs")
    assert f and "No receipts or emails" in f[0]["summary"]


def test_no_false_duplicates_for_monthly_charges(demo_db):
    for f in find(demo_db, "possible_duplicate"):
        assert "APPLE" not in f["title"] and "FEE" not in f["title"]


def test_every_finding_cites_existing_records(demo_db):
    for f in demo_db.findings():
        assert f["evidence"], f["title"]
        for e in f["evidence"]:
            if e["type"] == "transaction":
                assert demo_db.transaction(e["transaction_id"])
            if e["type"] == "receipt":
                assert demo_db.receipt(e["receipt_id"])
            assert e["source"]


def test_receipts_matched_one_to_one(demo_db):
    rows = demo_db.query("SELECT transaction_id, COUNT(*) n FROM matches GROUP BY transaction_id")
    assert all(r["n"] == 1 for r in rows)
    rows = demo_db.query("SELECT receipt_id, COUNT(*) n FROM matches GROUP BY receipt_id")
    assert all(r["n"] == 1 for r in rows)
