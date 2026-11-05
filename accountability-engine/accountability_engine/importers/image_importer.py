"""Transaction screenshots, read with local OCR (Tesseract). Nothing leaves the computer."""
from __future__ import annotations

import io
import shutil

from .common import ParsedTransaction
from .text_lines import parse_lines

OCR_CONFIDENCE = 0.8


def ocr_available() -> bool:
    try:
        import pytesseract  # noqa: F401
    except ImportError:
        return False
    return shutil.which("tesseract") is not None


def ocr_text(data: bytes) -> str:
    import pytesseract
    from PIL import Image, ImageOps

    image = Image.open(io.BytesIO(data))
    image = ImageOps.grayscale(image)
    if image.width < 1600:  # upscale small phone screenshots for better OCR
        scale = 1600 / image.width
        image = image.resize((int(image.width * scale), int(image.height * scale)))
    return pytesseract.image_to_string(image, config="--psm 6")


def parse(data: bytes, account_type: str, year_hint: int | None
          ) -> tuple[list[ParsedTransaction], list[str]]:
    if not ocr_available():
        raise RuntimeError("Screenshot import needs the free Tesseract OCR program. "
                           "See the README section 'Optional: screenshot reading'.")
    text = ocr_text(data)
    rows = parse_lines(text, account_type, year_hint, ref_prefix="OCR ", confidence=OCR_CONFIDENCE)
    for r in rows:
        r.notes.append("Read by OCR from a screenshot; compare with the original image.")
    warnings = [] if rows else ["OCR found no transaction lines in this image."]
    return rows, warnings
