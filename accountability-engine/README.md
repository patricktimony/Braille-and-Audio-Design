# The Accountability Engine

An open-source, local-first prototype that helps ordinary consumers hold their
bills to account. It investigates unexplained transactions, spots patterns of
questionable billing, and assembles verifiable evidence for lawful consumer
remedies, such as a billing-error notice to your bank.

Every finding is a question worth checking, not an accusation. The app keeps
three things apart:

- **Verified facts.** Each one is backed by an imported record, or by
  arithmetic on imported records, and the record is cited.
- **Hypotheses.** These are possible explanations. Each has a confidence level
  and says how to check it.
- **Unknowns.** These are questions the records cannot answer, with a note on
  where you might find the answer.

## What it promises

- **Local only by default.** It runs on your computer and listens only on
  `127.0.0.1`. Files are read and stored on your computer in one SQLite file.
- **No external AI without consent.** Optional AI summaries stay off until you
  tick a consent box and choose that mode. Even then, the app sends only a
  redacted copy of statements it has already verified. It removes card
  numbers, email addresses and account names first, and never sends your files.
- **Never contacts anyone.** The app has no way to contact banks, merchants or
  regulators, or to start a dispute. It drafts letters for you to review, and
  any approval is recorded only in its own activity log.
- **Never invents evidence.** Purchase details come only from your receipts.
  The app treats a merchant name on a statement as printed text, not as proof
  of who the merchant is.
- **Neutral language.** A language guard checks generated text, so the app
  never calls a transaction theft or fraud.

## Quick start

You need Python 3.10 or newer.

1. Open a terminal in the `accountability-engine` folder.
2. Install the requirements:

   ```
   python -m pip install -r requirements.txt
   ```

3. Start the app with the demonstration data:

   ```
   python -m accountability_engine --demo
   ```

   On Windows you can run `run.bat`. On macOS or Linux you can run `./run.sh`.

4. Your browser opens `http://127.0.0.1:8000/`. If it does not open, type that
   address into your browser yourself.
5. To stop the app, press Ctrl+C in the terminal.

Options:

- `--port 8080` uses a different port.
- `--no-browser` stops the app from opening a browser.
- The `AE_DB_PATH` environment variable sets where the database is kept. By
  default it is `data/accountability.db`.

### Optional: screenshot reading

To import screenshots, the app reads them with OCR, using the free
[Tesseract](https://github.com/tesseract-ocr/tesseract) program. OCR runs
locally.

- **Windows:** install Tesseract with the UB Mannheim installer, and make sure
  `tesseract` is on your PATH.
- **macOS:** `brew install tesseract`
- **Debian or Ubuntu:** `sudo apt install tesseract-ocr`

Without Tesseract, everything else still works. The demonstration then loads
94 of its 100 transactions (it leaves out the 6 from the screenshot).

## Using the app with a screen reader

The interface follows WCAG 2.2 AA and was written for NVDA, JAWS and VoiceOver.

- The first Tab stop is **Skip to main content**.
- The main navigation is a list of links. When you choose one, focus moves to
  that page's heading and the browser tab title changes.
- Every page starts with a level-1 heading, and every section has its own
  heading, so you can jump with H (NVDA and JAWS) or the VoiceOver rotor.
- Status messages such as "Import finished" or "Investigation ready" are
  announced through a polite live region. Answers on the **Ask** page are
  added to a log region, so they are read as they arrive.
- Tables have captions and header cells. Each **Investigate** button names its
  transaction, for example "Investigate transaction 45, $295.98 on 2026-09-18".
- There are no single-key shortcuts, no timeouts and no drag-only controls.
  Buttons and links are at least 44 pixels tall.
- Light, dark and Windows high-contrast modes are supported, and so is
  reduced motion.
- Reports and letters are also available as plain text, which works well with
  braille displays.

The full checklist is in [docs/accessibility.md](docs/accessibility.md).

## The demonstration

On the **Overview** page, choose **Investigate the $295.98 Apple charge**. Or go
to **Ask** and type:

> What was this $295.98 Apple charge?

The agent investigates `PP*APPLE.COM/BILL402-935-7733 CA 8231 — $295.98`. It
calls ten local tools, then reports what it found.

**Known facts:**

- The charge was dated 2026-09-18.
- No imported receipt matches it.
- It is the largest of 8 charges with that merchant name.
- It is the only one that starts with the `PP*` prefix.
- Other Apple receipts say they were billed directly to a debit card.
- $295.98 is exactly 2 × $147.99, the amount of a "PhotoStudio Pro" receipt
  from 2026-09-10.
- No refund followed.

**Interpretations, not facts:**

- `PP*` is a prefix commonly used by PayPal.
- `402-935-7733` is shaped like a phone number, but nobody has checked it.
- `CA` might be a state code.
- `8231` cannot be explained from the text alone.

**Hypotheses (not confirmed):**

- It might be two billing periods of the $147.99 subscription.
- It might have been paid through a PayPal account.
- A receipt might be in an inbox that was not exported.
- Whether you authorized it cannot be assessed from the records.

**Unknowns:**

- What was bought.
- Whether you recognize the charge.
- Which PayPal account was used.
- What `402-935-7733` and `8231` mean.

**Next actions:**

1. Check your purchase history with the merchant and your PayPal activity.
2. Import any receipt you find.
3. If the charge is still unexplained, review a draft billing-error notice to
   your bank. The app adds a cautious estimate of the 60-day notice window
   under Regulation E.

Example output: [investigation](docs/example-apple-investigation.txt) and
[draft letter](docs/example-apple-dispute-letter.txt).

The dataset holds 100 fictional transactions with several planted problems:

- a duplicate charge
- charges after a cancellation
- a price rise with no notice
- an unusual utility bill
- a missing refund
- a charge that differs from its receipt
- an undocumented subscription
- a receipt with no charge

See [docs/demo-dataset.md](docs/demo-dataset.md) for the full list.

## Importing your own files

| What | Formats | Notes |
|---|---|---|
| Bank and card statements | `.csv` | The app recognizes common column names: Date or Posted Date, Description or Payee, and Amount or Debit and Credit. |
| | Text-based `.pdf` | Lines must look like `MM/DD  DESCRIPTION  AMOUNT`. For a scanned PDF, save the pages as images first. |
| | Screenshots: `.png`, `.jpg` | Read by local OCR. The app marks these transactions "read by OCR" and asks you to compare them with the image. |
| Receipts | `.eml`, `.mbox`, `.txt`, `.html` | Export them from your mail program. The app never asks for email account access. |

Importing the same file twice adds nothing. Identical rows inside one statement
are all kept, because they may be a real duplicate charge.

## How it is built

```
accountability_engine/
  importers/   csv, pdf, image (OCR), email; shared sign rules and storage
  normalize.py dates, amounts, descriptor decoding, merchant keys
  analysis/    receipt matching and detectors (duplicates, recurring, price
               change, charge after cancellation, unusual amount, refund not
               found, amount mismatch, unmatched or missing receipts)
  agents/      agent interface and registry, local tools, the transaction
               investigator, the chat interface, the narrator (local or
               external with consent), the neutral-language guard
  reports/     accessible HTML and plain-text reports, letter drafts
  demo/        generator for the fictional dataset; the files it builds
  static/      HTML, CSS and JavaScript (no frameworks, no external requests)
  main.py      FastAPI routes
  db.py        SQLite schema (money is stored as integer cents)
```

You can add more agents without changing the rest of the code. They could
cover contracts, insurance billing, subscriptions or government fees. See
[docs/adding-an-agent.md](docs/adding-an-agent.md).

## Tests

```
python -m pip install -r requirements-dev.txt
python -m pytest
```

The tests cover:

- parsing of all four import formats
- detection of every planted anomaly
- that every fact and finding cites a stored record
- that the language guard holds
- consent gating and redaction for external AI
- that approved actions never send anything
- the report and letter structure
- static accessibility checks on the interface

A test fixture blocks network connections, so any test that tries to reach
the internet fails.

To rebuild the demonstration files, run
`python -m accountability_engine.demo.generate`. This needs `reportlab`.

## Limits of this prototype

- The PDF and OCR line parser expects one transaction per line.
- The app does not merge overlapping statements from different sources (for
  example a CSV and a PDF covering the same month). Import one or the other.
- Dispute-window notes give general information about US law (Regulation E
  and the Fair Credit Billing Act). They are not legal advice.
- Data is not encrypted at rest beyond whatever your operating system
  provides. **Delete all imported data** on the Overview page removes it.

## Licence

MIT. See [LICENSE](LICENSE).

## Web demo for phones

`python tools/build_web_demo.py demo.html` builds one self-contained page for
phones and tablets, including iPhone. It needs no server. The real app runs
once over the fictional data, and the page stores every answer, investigation,
report and draft letter. Questions are matched in the browser. Importing your
own files needs the full app on a computer.
