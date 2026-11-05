"""Text-based PDF statements (no OCR: scanned PDFs should be imported as images)."""
from __future__ import annotations

import io

from .common import ParsedTransaction
from .text_lines import parse_lines


def parse(data: bytes, account_type: str, year_hint: int | None
          ) -> tuple[list[ParsedTransaction], list[str]]:
    import pdfplumber

    warnings: list[str] = []
    out: list[ParsedTransaction] = []
    with pdfplumber.open(io.BytesIO(data)) as pdf:
        pages = [(i, page.extract_text() or "") for i, page in enumerate(pdf.pages, start=1)]
    full_text = "\n".join(t for _, t in pages)
    if not full_text.strip():
        raise ValueError("This PDF has no text layer. Save the pages as images and import "
                         "them as screenshots so they can be read with OCR.")
    from .text_lines import guess_year
    year = year_hint or guess_year(full_text)
    for page_no, text in pages:
        out.extend(parse_lines(text, account_type, year, ref_prefix=f"page {page_no}, "))
    if not out:
        warnings.append("No transaction lines were recognized in this PDF.")
    return out, warnings
