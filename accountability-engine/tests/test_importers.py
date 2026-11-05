import pytest

from accountability_engine.config import DEMO_DATA_DIR
from accountability_engine.importers import import_file
from accountability_engine.importers.image_importer import ocr_available

AMOUNT_CSV = b"""Transaction Date,Description,Amount
09/18/2026,PP*APPLE.COM/BILL402-935-7733 CA 8231,-295.98
09/19/2026,PAYROLL DEPOSIT ACME CORP,"2,150.00"
bad date,SOMETHING,1.00
"""

DEBIT_CREDIT_CSV = b"""Some Bank export
Posted Date,Payee,Debit,Credit
2026-09-22,AMZN Mktp US*2K4RT9,64.27,
2026-09-23,AMZN Mktp US*2K4RT9,64.27,
2026-09-25,REFUND NORTHWIND,,129.00
"""


def test_csv_amount_column(db):
    res = import_file(db, "a.csv", AMOUNT_CSV, "Checking", "checking")
    assert res.transactions == 2
    assert any("Skipped row 4" in w for w in res.warnings)
    rows = db.transactions()
    assert rows[0]["amount_cents"] == -29598
    assert rows[0]["raw_description"] == "PP*APPLE.COM/BILL402-935-7733 CA 8231"
    assert rows[0]["merchant_key"] == "apple"
    assert rows[0]["source_ref"] == "row 2"
    assert rows[1]["amount_cents"] == 215000


def test_csv_debit_credit_columns_keep_identical_rows(db):
    res = import_file(db, "b.csv", DEBIT_CREDIT_CSV, "Checking", "checking")
    assert res.transactions == 3  # two identical rows are both kept: they may be a real duplicate
    amounts = [t["amount_cents"] for t in db.transactions()]
    assert amounts == [-6427, -6427, 12900]


def test_same_file_twice_adds_nothing(db):
    import_file(db, "a.csv", AMOUNT_CSV, "Checking", "checking")
    res = import_file(db, "copy.csv", AMOUNT_CSV, "Checking", "checking")
    assert res.skipped_duplicate_file
    assert len(db.transactions()) == 2


def test_csv_without_headers_is_rejected(db):
    with pytest.raises(ValueError):
        import_file(db, "x.csv", b"a,b,c\n1,2,3\n", "X", "checking")
    assert db.query("SELECT * FROM sources") == []


def test_pdf_statement(db):
    data = (DEMO_DATA_DIR / "card_statement.pdf").read_bytes()
    res = import_file(db, "card_statement.pdf", data, "Card", "credit_card")
    assert res.transactions == 12
    rows = db.transactions()
    gym = [t for t in rows if t["merchant_key"] == "fitlife gym"]
    assert [t["date"] for t in gym] == ["2026-08-01", "2026-09-01", "2026-10-01"]
    assert all(t["amount_cents"] == -3999 for t in gym)
    payments = [t for t in rows if "PAYMENT THANK YOU" in t["raw_description"]]
    assert all(t["amount_cents"] > 0 for t in payments)  # "CR" lines are credits
    assert gym[0]["source_ref"].startswith("page 1")


@pytest.mark.skipif(not ocr_available(), reason="Tesseract OCR not installed")
def test_screenshot_ocr(db):
    data = (DEMO_DATA_DIR / "card_app_screenshot.png").read_bytes()
    res = import_file(db, "shot.png", data, "Card", "credit_card", year_hint=2026)
    assert res.transactions == 6
    rows = db.transactions()
    assert rows[0]["date"] == "2026-11-01" and rows[0]["amount_cents"] == -3999
    assert all(r["confidence"] < 1.0 for r in rows)
    assert all("OCR" in r["parse_notes"] for r in rows)


def test_email_mbox_and_eml(db):
    res = import_file(db, "receipts_export.mbox", (DEMO_DATA_DIR / "receipts_export.mbox").read_bytes())
    assert res.receipts == 18
    res = import_file(db, "fitlife_cancellation.eml",
                      (DEMO_DATA_DIR / "receipts" / "fitlife_cancellation.eml").read_bytes())
    assert res.receipts == 1
    kinds = {r["kind"] for r in db.receipts()}
    assert {"receipt", "cancellation"} <= kinds
    apple = [r for r in db.receipts() if r["merchant_name"] == "Apple" and r["total_cents"] == 14799]
    assert apple and apple[0]["order_id"] == "MW2H6J9D33" and apple[0]["date"] == "2026-09-10"


def test_saved_html_receipt_without_headers(db):
    html = b"<html><body><h1>Corner Pharmacy</h1><p>Total: $18.40</p></body></html>"
    res = import_file(db, "receipt.html", html)
    assert res.receipts == 1
    r = db.receipts()[0]
    assert r["total_cents"] == 1840 and r["merchant_name"] == "Corner Pharmacy"
