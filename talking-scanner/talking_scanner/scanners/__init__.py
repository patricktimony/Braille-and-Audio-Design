"""Scanner backends and the manager that combines them.

Backends are tried in order: WIA first, then TWAIN.  A scanner that shows
up in both is only listed once (the WIA entry wins).  New backends are added
by appending a factory to BACKEND_FACTORIES; nothing else changes.
"""

import logging

from .base import ScannerBackend, ScannerDevice, ScannerError
from .simulated import SimulatedBackend
from .twain_backend import TwainBackend
from .wia import WiaBackend

log = logging.getLogger(__name__)

BACKEND_FACTORIES = [WiaBackend, TwainBackend]


def _norm(name):
    return "".join(ch for ch in name.lower() if ch.isalnum())


class ScannerManager:
    def __init__(self, backends):
        self.backends = list(backends)

    @classmethod
    def default(cls, simulate_folder=None):
        if simulate_folder:
            return cls([SimulatedBackend(simulate_folder)])
        backends = []
        for factory in BACKEND_FACTORIES:
            backend = factory()
            ok, reason = backend.available()
            if ok:
                backends.append(backend)
            else:
                log.info("Scanner backend %s not used: %s", backend.name, reason)
        return cls(backends)

    def discover(self):
        """Return all scanners from all backends, without duplicates."""
        if not self.backends:
            raise ScannerError(
                "No scanning system is available on this computer. Please ask library staff for help.",
                "unavailable",
            )
        devices, seen, errors = [], set(), []
        for backend in self.backends:
            try:
                found = backend.list_devices()
            except ScannerError as exc:
                log.warning("%s: %s", backend.name, exc.detail or exc.spoken)
                errors.append(exc)
                continue
            for dev in found:
                if _norm(dev.name) in seen:
                    continue
                seen.add(_norm(dev.name))
                devices.append(dev)
        if not devices and errors:
            raise errors[0]
        return devices

    def scan(self, device, out_path, dpi=300):
        for backend in self.backends:
            if backend.name == device.backend:
                return backend.scan(device, out_path, dpi)
        raise ScannerError("That scanner is no longer available.", "not_found")


__all__ = [
    "ScannerBackend",
    "ScannerDevice",
    "ScannerError",
    "ScannerManager",
    "SimulatedBackend",
    "TwainBackend",
    "WiaBackend",
]
