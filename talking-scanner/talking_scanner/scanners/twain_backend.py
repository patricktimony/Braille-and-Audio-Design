"""TWAIN fallback backend (EXPERIMENTAL, NOT YET TESTED ON HARDWARE).

Used only for scanners that have a TWAIN driver but no WIA driver.  Needs
the optional "pytwain" package and a 64-bit TWAIN Data Source Manager
(TWAINDSM.dll), which most scanner driver installers add.

TWAIN drivers are allowed to show their own window even when asked not to;
if a driver does that, the patron cannot use it without help, and that
scanner should be listed as unsupported in README.md.
"""

import sys

from .base import ScannerBackend, ScannerDevice, ScannerError


class TwainBackend(ScannerBackend):
    name = "TWAIN"

    def __init__(self, parent_window=0):
        self.parent_window = parent_window

    def _twain(self):
        import twain  # pytwain

        return twain

    def available(self):
        if sys.platform != "win32":
            return False, "TWAIN backend is only used on Windows"
        try:
            twain = self._twain()
            sm = twain.SourceManager(self.parent_window)
            sm.close()
        except ImportError:
            return False, "pytwain is not installed (optional)"
        except Exception as exc:
            return False, f"TWAIN Data Source Manager not available: {exc}"
        return True, ""

    def list_devices(self):
        twain = self._twain()
        try:
            sm = twain.SourceManager(self.parent_window)
            try:
                names = list(sm.source_list)
            finally:
                sm.close()
        except Exception as exc:
            raise ScannerError("Could not list TWAIN scanners.", "driver", str(exc))
        return [ScannerDevice(self.name, n, n) for n in names]

    def scan(self, device, out_path, dpi=300):
        twain = self._twain()
        out_path = out_path.rsplit(".", 1)[0] + ".bmp"
        try:
            twain.acquire(
                out_path,
                ds_name=device.device_id,
                dpi=dpi,
                pixel_type="gray",
                parent_window=self.parent_window,
                show_ui=False,
            )
        except Exception as exc:
            raise ScannerError(
                "The scanner did not respond. Check that it is plugged in and switched on, then press scan again.",
                "disconnected",
                f"TWAIN: {exc}",
            )
        return out_path
