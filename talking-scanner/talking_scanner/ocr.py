"""Offline text recognition with Tesseract.

Tesseract runs as a local program; images never leave the computer.
Pages placed upside down or sideways are turned the right way up using
Tesseract's orientation detection before recognition.
"""

import os
import shutil
import sys

from PIL import Image, ImageOps


class OcrError(Exception):
    def __init__(self, spoken, detail=""):
        super().__init__(spoken)
        self.spoken = spoken
        self.detail = detail


def find_tesseract():
    """Locate tesseract.exe: env var, bundled copy, PATH, then usual install folders."""
    candidates = [os.environ.get("TESSERACT_CMD")]
    # A copy bundled next to TalkingScanner.exe (or in PyInstaller's _internal folder).
    for base in (os.path.dirname(os.path.abspath(sys.argv[0] or ".")), getattr(sys, "_MEIPASS", None)):
        if base:
            candidates.append(os.path.join(base, "tesseract", "tesseract.exe"))
    candidates.append(shutil.which("tesseract"))
    for env in ("ProgramFiles", "ProgramFiles(x86)", "LOCALAPPDATA"):
        root = os.environ.get(env)
        if root:
            candidates.append(os.path.join(root, "Tesseract-OCR", "tesseract.exe"))
            candidates.append(os.path.join(root, "Programs", "Tesseract-OCR", "tesseract.exe"))
    for path in candidates:
        if path and os.path.isfile(path):
            return path
    return None


class OcrEngine:
    def __init__(self, lang="eng", tesseract_cmd=None, auto_rotate=True):
        import pytesseract

        self._pt = pytesseract
        self.lang = lang
        self.auto_rotate = auto_rotate
        cmd = tesseract_cmd or find_tesseract()
        if cmd:
            pytesseract.pytesseract.tesseract_cmd = cmd
        self.cmd = cmd

    def check(self):
        """Return the Tesseract version, or raise OcrError with a spoken message."""
        try:
            return str(self._pt.get_tesseract_version())
        except Exception as exc:
            raise OcrError(
                "The text recognition program Tesseract is not installed. Please ask library staff for help.",
                str(exc),
            )

    def _prepare(self, path):
        img = Image.open(path)
        img = ImageOps.exif_transpose(img).convert("L")
        # Small images (low resolution scans) recognise better when enlarged.
        if img.width < 1500:
            factor = 1500 / img.width
            img = img.resize((int(img.width * factor), int(img.height * factor)), Image.LANCZOS)
        if self.auto_rotate:
            try:
                osd = self._pt.image_to_osd(img, output_type=self._pt.Output.DICT)
                angle = int(osd.get("rotate", 0))
                if angle and float(osd.get("orientation_conf", 0)) >= 1.0:
                    # Tesseract reports clockwise degrees; PIL rotates counter-clockwise.
                    img = img.rotate(-angle, expand=True, fillcolor=255)
            except Exception:
                pass  # too little text to decide; recognise as is
        return img

    def recognize(self, path):
        try:
            img = self._prepare(path)
            return self._pt.image_to_string(img, lang=self.lang, config="--psm 3")
        except OcrError:
            raise
        except self._pt.TesseractNotFoundError as exc:
            raise OcrError(
                "The text recognition program Tesseract is not installed. Please ask library staff for help.",
                str(exc),
            )
        except Exception as exc:
            raise OcrError("Text recognition failed on this page. Please scan it again.", str(exc))
