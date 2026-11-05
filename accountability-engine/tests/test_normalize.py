import pytest

from accountability_engine.normalize import (format_money, merchant_key, merchant_similarity,
                                             normalize_transaction, parse_amount, parse_date,
                                             parse_descriptor)


@pytest.mark.parametrize("text,year,expected", [
    ("09/18/2026", None, "2026-09-18"),
    ("9/18/26", None, "2026-09-18"),
    ("2026-09-18", None, "2026-09-18"),
    ("Sep 18", 2026, "2026-09-18"),
    ("September 18, 2026", None, "2026-09-18"),
    ("18 Sep 2026", None, "2026-09-18"),
    ("09/18", 2026, "2026-09-18"),
    ("13/45/2026", None, None),
    ("Sep 18", None, None),
    ("", None, None),
])
def test_parse_date(text, year, expected):
    assert parse_date(text, year) == expected


@pytest.mark.parametrize("text,expected", [
    ("$295.98", (29598, None)),
    ("-295.98", (29598, "-")),
    ("($1,234.56)", (123456, "-")),
    ("500.00 CR", (50000, "CR")),
    ("+12.00", (1200, "+")),
    ("−4.25", (425, "-")),
    ("abc", None),
])
def test_parse_amount(text, expected):
    assert parse_amount(text) == expected


def test_format_money():
    assert format_money(-29598) == "$295.98"
    assert format_money(-29598, signed=True) == "debit $295.98"
    assert format_money(123456, signed=True) == "credit $1,234.56"


def test_example_descriptor_is_split_without_claiming_identity():
    d = parse_descriptor("PP*APPLE.COM/BILL402-935-7733 CA 8231")
    labels = {p["label"]: p["text"] for p in d["parts"]}
    assert d["processor"] == "PayPal"
    assert labels["processor prefix"] == "PP*"
    assert labels["merchant name as printed"] == "APPLE.COM/BILL"
    assert labels["phone-number-shaped digits"] == "402-935-7733"
    assert labels["possible state code"] == "CA"
    assert labels["unexplained reference number"] == "8231"
    notes = " ".join(p["note"] for p in d["parts"]).lower()
    assert "not verified" in notes or "not proof" in notes


def test_merchant_keys_group_related_descriptors():
    assert normalize_transaction("PP*APPLE.COM/BILL402-935-7733 CA 8231")["merchant_key"] == "apple"
    assert normalize_transaction("APPLE.COM/BILL 866-712-7753 CA")["merchant_key"] == "apple"
    assert merchant_key("AMZN Mktp US") == "amazon"
    assert merchant_key("WWW.NETSVCS-BILL.COM") == "netsvcs"
    assert normalize_transaction("SQ *BLUE HERON CAFE")["processor"] == "Square"


def test_merchant_similarity():
    assert merchant_similarity("FitLife Gym billing@fitlifegym.example", "FITLIFE GYM MEMBERSHIP") >= 0.8
    assert merchant_similarity("Apple no_reply@apple.example", "APPLE.COM/BILL") == 1.0
    assert merchant_similarity("Streamflix", "FRESHMART #1182") == 0.0
