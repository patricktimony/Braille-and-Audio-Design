"""Build the fictional demonstration dataset.

Run:  python -m accountability_engine.demo.generate

Writes, into accountability_engine/demo/data/:
  checking_statement.csv      82 transactions (Demo Checking, debit card)
  card_statement.pdf          12 transactions (Demo Rewards Card, text-based PDF)
  card_app_screenshot.png      6 transactions (screenshot of a card app)
  receipts_export.mbox        email receipts exported from a mail program
  receipts/*.eml              individual saved emails

Everything is fictional. Merchant email addresses use the reserved
".example" domain. Planted issues are listed in PLANTED below and in
docs/demo-dataset.md.
"""
from __future__ import annotations

import csv
from email.message import EmailMessage
from email.utils import format_datetime
from datetime import datetime, timezone
from pathlib import Path

from ..config import DEMO_DATA_DIR

YEAR = 2026
CHECKING = "Demo Checking"
CARD = "Demo Rewards Card"
APPLE_DESC = "APPLE.COM/BILL 866-712-7753 CA"
EXAMPLE_DESC = "PP*APPLE.COM/BILL402-935-7733 CA 8231"

PLANTED = [
    "PP*APPLE.COM/BILL402-935-7733 CA 8231 for $295.98 on 2026-09-18: no receipt, largest "
    "Apple-named charge, exactly 2 x a $147.99 Apple receipt from 2026-09-10.",
    "AMZN Mktp US*2K4RT9 charged $64.27 on 2026-09-22 and again on 2026-09-23; one order email.",
    "FITLIFE GYM MEMBERSHIP keeps charging $39.99 after a cancellation email effective 2026-08-31.",
    "STREAMFLIX.COM rises from $15.49 to $22.99 in October with no price-change notice on file.",
    "CITY WATER UTIL bill of $412.60 in October versus about $48 in earlier months.",
    "NORTHWIND ELECTRONICS refund of $129.00 promised on 2026-09-02 never appears as a credit.",
    "HARBOR HARDWARE charged $75.12 but its receipt says $57.12.",
    "WWW.NETSVCS-BILL.COM charges $9.99 monthly with no receipt on file.",
    "PAGE TURNER BOOKS order confirmation for $36.20 has no matching charge yet.",
]


def d(month: int, day: int) -> str:
    return f"{YEAR}-{month:02d}-{day:02d}"


def checking_transactions() -> list[tuple[str, str, int]]:
    """(iso date, description, signed cents)."""
    tx: list[tuple[str, str, int]] = []
    add = lambda m, day, desc, cents: tx.append((d(m, day), desc, cents))  # noqa: E731
    for m, day in [(8, 7), (8, 21), (9, 4), (9, 18), (10, 2), (10, 16), (10, 30)]:
        add(m, day, "PAYROLL DEPOSIT ACME CORP", 215000)
    for m in (8, 9, 10):
        add(m, 1, "MAPLE GROVE APTS RENT", -145000)
        add(m, 22, "CELLWAVE WIRELESS", -6500)
        add(m, 5, APPLE_DESC, -299)          # iCloud+
        add(m, 12, APPLE_DESC, -1099)        # Apple Music
        add(m, 3, "WWW.NETSVCS-BILL.COM 8005550142", -999)
    add(8, 15, "CITY WATER UTIL", -4782)
    add(9, 15, "CITY WATER UTIL", -4910)
    add(10, 15, "CITY WATER UTIL", -41260)
    add(8, 18, "BRIGHTGRID ENERGY", -8834)
    add(9, 18, "BRIGHTGRID ENERGY", -10277)
    add(10, 19, "BRIGHTGRID ENERGY", -7945)
    add(9, 10, APPLE_DESC, -14799)           # PhotoStudio Pro annual
    add(9, 18, EXAMPLE_DESC, -29598)         # the example transaction
    add(8, 9, "AMZN Mktp US*7H2KL4", -3418)
    add(8, 27, "AMZN Mktp US*9Q3MX1", -2156)
    add(9, 22, "AMZN Mktp US*2K4RT9", -6427)
    add(9, 23, "AMZN Mktp US*2K4RT9", -6427)
    add(10, 14, "AMZN Mktp US*5T8WP2", -4290)
    add(8, 20, "NORTHWIND ELECTRONICS #221", -12900)
    add(10, 8, "HARBOR HARDWARE #0412", -7512)
    groceries = [8734, 6412, 11250, 9388, 7020, 13499, 8167, 6955, 10423, 9112, 7789, 12045, 8590]
    days = [(8, 2), (8, 9), (8, 16), (8, 23), (8, 30), (9, 6), (9, 13), (9, 20), (9, 27),
            (10, 4), (10, 11), (10, 18), (10, 25)]
    for (m, day), cents in zip(days, groceries):
        add(m, day, "FRESHMART #1182", -cents)
    for (m, day), cents in zip([(8, 6), (8, 19), (9, 2), (9, 16), (9, 30), (10, 13), (10, 27)],
                               [4210, 3875, 5120, 4498, 3990, 4733, 4605]):
        add(m, day, "QUIKFUEL 0457", -cents)
    for (m, day), cents in zip([(8, 4), (8, 11), (8, 25), (9, 1), (9, 9), (9, 24), (10, 6),
                                (10, 10), (10, 20), (10, 28)],
                               [425, 580, 615, 470, 780, 535, 660, 495, 710, 550]):
        add(m, day, "SQ *BLUE HERON CAFE", -cents)
    add(8, 26, "CORNER PHARMACY", -1840)
    add(10, 9, "CORNER PHARMACY", -1215)
    add(8, 14, "TST* LUNA TAQUERIA", -3260)
    add(9, 11, "TST* LUNA TAQUERIA", -2845)
    add(10, 23, "TST* LUNA TAQUERIA", -4115)
    for m, day in [(8, 8), (9, 5), (10, 3)]:
        add(m, day, "ONLINE TRANSFER TO SAVINGS", -20000)
    add(8, 25, "DEMO REWARDS CARD PAYMENT", -31000)
    add(9, 25, "DEMO REWARDS CARD PAYMENT", -26540)
    add(10, 25, "DEMO REWARDS CARD PAYMENT", -29855)
    add(9, 27, "PAGE TURNER BOOKS", -2345)
    add(8, 31, "MONTHLY MAINTENANCE FEE", -1200)
    add(9, 30, "MONTHLY MAINTENANCE FEE", -1200)
    add(10, 31, "MONTHLY MAINTENANCE FEE", -1200)
    tx.sort(key=lambda t: t[0])
    return tx


# Credit card statement: unsigned amounts are charges, "CR" marks credits.
CARD_PAGES = [
    ("August 1 - August 31, 2026", [
        ("08/01", "FITLIFE GYM MEMBERSHIP", "39.99"),
        ("08/15", "STREAMFLIX.COM", "15.49"),
        ("08/25", "PAYMENT THANK YOU", "310.00 CR"),
        ("08/29", "GREEN BOWL KITCHEN", "27.80"),
    ]),
    ("September 1 - September 30, 2026", [
        ("09/01", "FITLIFE GYM MEMBERSHIP", "39.99"),
        ("09/15", "STREAMFLIX.COM", "15.49"),
        ("09/19", "SKYLINE CINEMAS", "31.50"),
        ("09/25", "PAYMENT THANK YOU", "265.40 CR"),
    ]),
    ("October 1 - October 31, 2026", [
        ("10/01", "FITLIFE GYM MEMBERSHIP", "39.99"),
        ("10/15", "STREAMFLIX.COM", "22.99"),
        ("10/21", "GREEN BOWL KITCHEN", "24.35"),
        ("10/25", "PAYMENT THANK YOU", "298.55 CR"),
    ]),
]

SCREENSHOT_ROWS = [
    ("Nov 1", "FITLIFE GYM MEMBERSHIP", "$39.99"),
    ("Nov 1", "SQ *BLUE HERON CAFE", "$5.60"),
    ("Nov 2", "QUIKFUEL 0457", "$44.10"),
    ("Nov 3", "FRESHMART #1182", "$87.25"),
    ("Nov 3", "SKYLINE CINEMAS", "$18.00"),
    ("Nov 4", "PAGE TURNER BOOKS", "$14.99"),
]


def _mail(sender: str, subject: str, when: str, body: str) -> EmailMessage:
    msg = EmailMessage()
    msg["From"] = sender
    msg["To"] = "Demo User <demo.user@example.com>"
    msg["Subject"] = subject
    y, m, day = (int(x) for x in when.split("-"))
    msg["Date"] = format_datetime(datetime(y, m, day, 9, 30, tzinfo=timezone.utc))
    msg.set_content(body)
    return msg


APPLE = "Apple (demo) <no_reply@apple.example>"
AMAZON = "Amazon (demo) <orders@amazon.example>"


def apple_receipt(when: str, order: str, item: str, price: str) -> EmailMessage:
    nice = datetime.fromisoformat(when).strftime("%b %-d, %Y")
    return _mail(APPLE, "Your receipt from Apple (demo)", when,
                 f"Receipt\nApple Account: demo.user@example.com\nDate: {nice}\n"
                 f"Order ID: {order}\n\n{item}  ${price}\n\nSubtotal ${price}\nTotal ${price}\n"
                 "Billed to: Visa Debit ending 4417\n\nThis is a fictional demonstration receipt.")


def amazon_order(when: str, order: str, item: str, price: str) -> EmailMessage:
    return _mail(AMAZON, f"Your order {order} has shipped", when,
                 f"Hello Demo User,\n\nOrder number: {order}\nItem: {item}\nQuantity: 1\n\n"
                 f"Order Total: ${price}\nPayment: Visa Debit ending 4417\n\n"
                 "This is a fictional demonstration email.")


def mbox_messages() -> list[EmailMessage]:
    msgs = []
    for m in (8, 9, 10):
        msgs.append(apple_receipt(d(m, 5), f"MX7Q2L9K0{m}", "iCloud+ with 50 GB (Monthly)", "2.99"))
        msgs.append(apple_receipt(d(m, 12), f"MT4R8N2P1{m}", "Apple Music Individual (Monthly)",
                                  "10.99"))
    msgs.append(apple_receipt(d(9, 10), "MW2H6J9D33",
                              "PhotoStudio Pro - Annual subscription (renews Sep 10, 2027)", "147.99"))
    msgs.append(amazon_order(d(8, 9), "112-4471029-7731", "USB-C charging cable, 2-pack", "34.18"))
    msgs.append(amazon_order(d(8, 27), "112-9930217-4410", "Paperback: Container Gardening", "21.56"))
    msgs.append(amazon_order(d(9, 22), "112-6604381-2209", "Wireless keyboard", "64.27"))
    msgs.append(amazon_order(d(10, 14), "112-3378106-5523", "Kitchen scale", "42.90"))
    msgs.append(_mail("Northwind Electronics (demo) <receipts@northwind.example>",
                      "Thanks for your purchase", d(8, 20),
                      "Receipt number: NW-88213\nPortable Bluetooth speaker  $129.00\n"
                      "Total: $129.00\nPaid with debit card ending 4417\n"))
    msgs.append(_mail("FitLife Gym (demo) <billing@fitlifegym.example>",
                      "FitLife membership receipt", d(8, 1),
                      "Monthly membership dues\nAmount charged: $39.99\n"
                      "Card: Demo Rewards Card ending 9902\n"))
    for m, price in [(8, "15.49"), (9, "15.49"), (10, "22.99")]:
        msgs.append(_mail("Streamflix (demo) <billing@streamflix.example>",
                          "Your Streamflix receipt", d(m, 15),
                          f"Plan: Standard\nTotal charged: ${price}\n"
                          "Card: Demo Rewards Card ending 9902\n"))
    msgs.append(_mail("Blue Heron Cafe (demo) <receipts@blueheron.example>",
                      "Receipt from Blue Heron Cafe", d(9, 9),
                      "1 Oat latte  $6.25\n1 Scone  $1.55\nTotal: $7.80\n"))
    msgs.append(_mail("Page Turner Books (demo) <orders@pageturner.example>",
                      "Order confirmed", d(10, 30),
                      "Order number: PT-50917\n2 books\nOrder Total: $36.20\n"
                      "Your card will be charged when your order ships.\n"))
    return msgs


EML_FILES = {
    "northwind_refund.eml": ("Northwind Electronics (demo) <returns@northwind.example>",
                             "Your return has been received - refund on the way", d(9, 2),
                             "We've received your return for receipt number NW-88213.\n"
                             "Refund amount: $129.00\n"
                             "The refund will be issued to your original payment method within "
                             "5-7 business days.\n"),
    "fitlife_cancellation.eml": ("FitLife Gym (demo) <billing@fitlifegym.example>",
                                 "Your membership cancellation is confirmed", d(8, 28),
                                 "Hi Demo User,\n\nYour FitLife membership cancellation is "
                                 "confirmed.\nEffective date: August 31, 2026\n"
                                 "You will not be billed after this date.\n"
                                 "Confirmation number: FL-CXL-30418\n"),
    "harbor_hardware_receipt.eml": ("Harbor Hardware (demo) <receipts@harborhardware.example>",
                                    "Your Harbor Hardware receipt", d(10, 8),
                                    "Store #0412\nDeck screws (box)  $18.97\nWood stain, 1 qt  "
                                    "$24.98\nPaint brushes  $13.17\nTotal: $57.12\n"
                                    "Debit card ending 4417\n"),
}


def write_csv(path: Path) -> None:
    with path.open("w", newline="") as fh:
        w = csv.writer(fh)
        w.writerow(["Date", "Description", "Debit", "Credit"])
        for iso, desc, cents in checking_transactions():
            y, m, day = iso.split("-")
            amount = f"{abs(cents) / 100:.2f}"
            w.writerow([f"{m}/{day}/{y}", desc, amount if cents < 0 else "",
                        amount if cents > 0 else ""])


def write_pdf(path: Path) -> None:
    from reportlab.lib.pagesizes import letter
    from reportlab.pdfgen import canvas

    c = canvas.Canvas(str(path), pagesize=letter)
    c.setTitle("Demo Rewards Card statement (fictional)")
    for period, rows in CARD_PAGES:
        y = 740
        c.setFont("Helvetica-Bold", 14)
        c.drawString(60, y, "Demo Rewards Card - Account ending 9902 (fictional)")
        y -= 20
        c.setFont("Helvetica", 11)
        c.drawString(60, y, f"Statement period: {period}")
        y -= 30
        c.setFont("Helvetica-Bold", 11)
        c.drawString(60, y, "Date")
        c.drawString(120, y, "Description")
        c.drawRightString(540, y, "Amount")
        y -= 18
        c.setFont("Helvetica", 11)
        for date_text, desc, amount in rows:
            c.drawString(60, y, date_text)
            c.drawString(120, y, desc)
            c.drawRightString(540, y, amount)
            y -= 16
        c.showPage()
    c.save()


def write_screenshot(path: Path) -> None:
    from PIL import Image, ImageDraw, ImageFont

    width, height = 900, 120 + 70 * len(SCREENSHOT_ROWS)
    img = Image.new("RGB", (width, height), "white")
    draw = ImageDraw.Draw(img)
    font_path = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
    try:
        title = ImageFont.truetype(font_path, 34)
        font = ImageFont.truetype(font_path, 30)
    except OSError:
        title = font = ImageFont.load_default()
    draw.text((30, 30), "Recent activity - November 2026", fill="black", font=title)
    y = 110
    for date_text, desc, amount in SCREENSHOT_ROWS:
        draw.text((30, y), date_text, fill="black", font=font)
        draw.text((160, y), desc, fill="black", font=font)
        w = draw.textlength(amount, font=font)
        draw.text((width - 30 - w, y), amount, fill="black", font=font)
        y += 70
    img.save(path)


def build(out_dir: Path = DEMO_DATA_DIR) -> dict[str, Path]:
    out_dir.mkdir(parents=True, exist_ok=True)
    (out_dir / "receipts").mkdir(exist_ok=True)
    paths = {
        "csv": out_dir / "checking_statement.csv",
        "pdf": out_dir / "card_statement.pdf",
        "image": out_dir / "card_app_screenshot.png",
        "mbox": out_dir / "receipts_export.mbox",
    }
    write_csv(paths["csv"])
    write_pdf(paths["pdf"])
    write_screenshot(paths["image"])
    with paths["mbox"].open("wb") as fh:
        for msg in mbox_messages():
            fh.write(b"From demo@example.com Thu Jan  1 00:00:00 2026\n")
            data = msg.as_bytes().replace(b"\nFrom ", b"\n>From ")
            fh.write(data.rstrip(b"\n") + b"\n\n")
    for name, (sender, subject, when, body) in EML_FILES.items():
        p = out_dir / "receipts" / name
        p.write_bytes(_mail(sender, subject, when, body).as_bytes())
        paths[name] = p
    return paths


# Account settings used when the demo is loaded.
DEMO_IMPORTS = [
    ("checking_statement.csv", CHECKING, "checking"),
    ("card_statement.pdf", CARD, "credit_card"),
    ("card_app_screenshot.png", CARD, "credit_card"),
    ("receipts_export.mbox", None, None),
    ("receipts/northwind_refund.eml", None, None),
    ("receipts/fitlife_cancellation.eml", None, None),
    ("receipts/harbor_hardware_receipt.eml", None, None),
]


def load_demo(db, data_dir: Path = DEMO_DATA_DIR, include_screenshot: bool = True) -> list[dict]:
    """Import the demo files into a database. Builds them first if missing."""
    from ..importers import import_file

    if not (data_dir / "checking_statement.csv").exists():
        build(data_dir)
    results = []
    for rel, account, acct_type in DEMO_IMPORTS:
        if rel.endswith(".png") and not include_screenshot:
            continue
        p = data_dir / rel
        res = import_file(db, p.name, p.read_bytes(), account, acct_type, year_hint=YEAR)
        results.append(res.as_dict())
    return results


if __name__ == "__main__":
    for key, path in build().items():
        print(f"{key}: {path}")
    print(f"{len(checking_transactions())} checking + "
          f"{sum(len(r) for _, r in CARD_PAGES)} card statement + "
          f"{len(SCREENSHOT_ROWS)} screenshot transactions")
