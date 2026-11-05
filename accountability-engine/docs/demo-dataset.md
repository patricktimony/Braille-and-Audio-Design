# The demonstration dataset

Everything in the dataset is fictional. Merchant email addresses use the
reserved `.example` domain. The generator is
`accountability_engine/demo/generate.py`.

## Files (100 transactions)

| File | Account | Transactions |
|---|---|---|
| `checking_statement.csv` (Debit and Credit columns) | Demo Checking | 82 |
| `card_statement.pdf` (3 monthly pages, text-based) | Demo Rewards Card | 12 |
| `card_app_screenshot.png` (read by OCR) | Demo Rewards Card | 6 |
| `receipts_export.mbox` | | 18 emails |
| `receipts/*.eml` | | 3 emails |

## Planted issues and what the app reports

| # | Planted issue | Finding |
|---|---|---|
| 1 | `PP*APPLE.COM/BILL402-935-7733 CA 8231`, $295.98 on 2026-09-18. It has no receipt. It is the largest Apple-named charge, and exactly 2 × a $147.99 Apple receipt. | Unusual amount, and No receipt. The investigation is described in the README. |
| 2 | `AMZN Mktp US*2K4RT9` $64.27, charged on 2026-09-22 and 2026-09-23, with one order email. | Possible duplicate charge (Review) |
| 3 | FitLife Gym cancellation confirmed, effective 2026-08-31. $39.99 was still charged on Sep 1, Oct 1 and Nov 1. | Charged after cancellation (Review) |
| 4 | Streamflix went from $15.49 to $22.99 in October, with no price-change email. | Price change (Notice) |
| 5 | City Water bill of $412.60, against about $48 before. | Unusual amount (Notice) |
| 6 | Northwind Electronics promised a $129.00 refund on 2026-09-02. No credit ever appears. | Refund not found (Review) |
| 7 | Harbor Hardware charged $75.12, but the receipt says $57.12 (the same digits, swapped). | Charge differs from receipt (Review) |
| 8 | `WWW.NETSVCS-BILL.COM` charges $9.99 a month, with no email of any kind. | Recurring payment, with "No receipts or emails" (Info) |
| 9 | Page Turner Books order confirmation for $36.20, with no charge yet. | Receipt with no matching charge (Notice) |

Most other transactions are ordinary: payroll, rent, groceries, fuel, coffee,
utilities, and Apple subscriptions that each have a matching receipt.
