"""A pretend scanner that returns image files from a folder.

Used for testing OCR, speech and keyboard handling before any real scanner
is connected.  Each scan returns the next image (sorted by name), wrapping
around at the end.
"""

import os
import shutil

from .base import ScannerBackend, ScannerDevice, ScannerError

IMAGE_EXTENSIONS = (".png", ".jpg", ".jpeg", ".tif", ".tiff", ".bmp")


class SimulatedBackend(ScannerBackend):
    name = "Simulated"

    def __init__(self, images, device_names=("Simulated scanner",)):
        if isinstance(images, str):
            folder = images
            images = sorted(
                os.path.join(folder, f)
                for f in os.listdir(folder)
                if f.lower().endswith(IMAGE_EXTENSIONS)
            )
        self.images = list(images)
        self.device_names = list(device_names)
        self.connected = True
        self.fail_next = None  # set to a ScannerError to make the next scan fail
        self._next = 0

    def available(self):
        return (True, "") if self.images else (False, "no sample images")

    def list_devices(self):
        if not self.connected:
            return []
        return [
            ScannerDevice(self.name, f"sim{i}", name, "USB")
            for i, name in enumerate(self.device_names)
        ]

    def scan(self, device, out_path, dpi=300):
        if not self.connected:
            raise ScannerError(
                "The scanner is not connected. Check the USB cable and power, then press scan again.",
                "disconnected",
            )
        if self.fail_next is not None:
            err, self.fail_next = self.fail_next, None
            raise err
        src = self.images[self._next % len(self.images)]
        self._next += 1
        out_path = os.path.splitext(out_path)[0] + os.path.splitext(src)[1].lower()
        shutil.copyfile(src, out_path)
        return out_path
