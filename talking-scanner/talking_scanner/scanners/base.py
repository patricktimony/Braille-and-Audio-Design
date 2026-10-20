"""Scanner backend interface.

To add a new way of talking to scanners (for example SANE or the Windows
Runtime scanning API), write a class with this interface and register it in
scanners/__init__.py.  The reading application only ever sees ScannerDevice
objects, image files and ScannerError messages.
"""

from dataclasses import dataclass


@dataclass(frozen=True)
class ScannerDevice:
    backend: str  # backend name, e.g. "WIA"
    device_id: str  # stable id used to remember the patron's choice
    name: str  # spoken name, e.g. "CanoScan LiDE 400"
    connection: str = "unknown"  # "USB", "network" or "unknown"

    @property
    def key(self):
        return f"{self.backend}:{self.device_id}"

    def spoken(self):
        if self.connection in ("USB", "network"):
            return f"{self.name}, {self.connection}"
        return self.name


class ScannerError(Exception):
    """An error with a message that is safe to speak to the patron.

    kind is one of: not_found, disconnected, busy, cover_open, paper,
    driver, unavailable, general.  "disconnected" and "not_found" make the
    app forget the selected scanner so the next scan searches again.
    """

    def __init__(self, spoken, kind="general", detail=""):
        super().__init__(spoken)
        self.spoken = spoken
        self.kind = kind
        self.detail = detail


class ScannerBackend:
    name = "base"

    def available(self):
        """Return (True, "") if this backend can run on this computer, else (False, reason)."""
        raise NotImplementedError

    def list_devices(self):
        """Return a list of ScannerDevice.  Must not show any window."""
        raise NotImplementedError

    def scan(self, device, out_path, dpi=300):
        """Scan one flatbed page to out_path (any format Pillow reads).

        Returns the path actually written.  Raises ScannerError.
        """
        raise NotImplementedError
