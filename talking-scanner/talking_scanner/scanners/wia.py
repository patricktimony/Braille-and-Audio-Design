"""Windows Image Acquisition (WIA) backend.

Uses the WIA Automation Library (wiaaut.dll, part of Windows) through
pywin32.  Scans with item.Transfer(), which never shows the manufacturer's
dialog boxes.  Any scanner whose Windows driver supports WIA should work,
but only the scanners listed in README.md have actually been tested.
"""

import os
import sys

from .base import ScannerBackend, ScannerDevice, ScannerError

WIA_DEVICE_TYPE_SCANNER = 1
WIA_FORMAT_PNG = "{B96B3CAF-0728-11D3-9D7B-0000F81EF32E}"

# Property ids from wia.h
WIA_IPA_ITEM_NAME = 4098
WIA_DPS_DOCUMENT_HANDLING_SELECT = 3088
WIA_FLATBED = 2
WIA_IPS_CUR_INTENT = 6146
WIA_INTENT_IMAGE_TYPE_GRAYSCALE = 2
WIA_IPS_XRES = 6147
WIA_IPS_YRES = 6148
WIA_IPS_XPOS = 6149
WIA_IPS_YPOS = 6150
WIA_IPS_XEXTENT = 6151
WIA_IPS_YEXTENT = 6152
WIA_RANGE_SUBTYPE = 1

# Error codes from wia.h, with patron-friendly spoken explanations.
WIA_ERRORS = {
    0x80210001: ("general", "The scanner reported an error. Switch it off and on, then press scan again."),
    0x80210002: ("paper", "The scanner reports a paper jam."),
    0x80210003: ("paper", "The scanner reports there is no paper."),
    0x80210004: ("paper", "The scanner reports a paper problem."),
    0x80210005: ("disconnected", "The scanner is offline. Check the USB cable and that it is switched on, then press scan again."),
    0x80210006: ("busy", "The scanner is busy. Wait a moment, then press scan again."),
    0x80210007: ("busy", "The scanner is warming up. Wait a moment, then press scan again."),
    0x80210008: ("general", "The scanner needs attention. Please ask library staff for help."),
    0x80210009: ("disconnected", "The scanner was disconnected. Check the USB cable, then press scan again."),
    0x8021000A: ("disconnected", "The computer cannot talk to the scanner. Check the USB cable and power, then press scan again."),
    0x8021000B: ("driver", "The scanner driver did not accept the scan command. Please ask library staff for help."),
    0x8021000C: ("driver", "The scanner settings are not supported by this scanner. Please ask library staff for help."),
    0x8021000D: ("busy", "The scanner is locked or in use by another program. Close other scanning programs, then press scan again."),
    0x8021000E: ("driver", "The scanner driver failed. Switch the scanner off and on, then press scan again."),
    0x8021000F: ("driver", "The scanner driver gave an invalid response. Switch the scanner off and on, then press scan again."),
    0x80210010: ("cover_open", "The scanner lid is open. Close the lid, then press scan again."),
    0x80210011: ("general", "The scanner lamp is off. Wait a moment, then press scan again."),
    0x80210015: ("disconnected", "No scanner is available. Check the USB cable and power, then press scan again."),
}


def _hresult(exc):
    """Pull the most specific error code out of a pywintypes.com_error."""
    codes = []
    args = getattr(exc, "args", ())
    if len(args) > 2 and args[2] and len(args[2]) > 5 and isinstance(args[2][5], int):
        codes.append(args[2][5] & 0xFFFFFFFF)
    if args and isinstance(args[0], int):
        codes.append(args[0] & 0xFFFFFFFF)
    for code in codes:
        if code in WIA_ERRORS:
            return code
    return codes[0] if codes else None


def wia_error(exc):
    code = _hresult(exc)
    kind, spoken = WIA_ERRORS.get(
        code,
        ("general", "The scanner did not respond. Check that it is plugged in and switched on, then press scan again."),
    )
    detail = f"WIA error 0x{code:08X}: {exc}" if code is not None else str(exc)
    return ScannerError(spoken, kind, detail)


def _collection(coll):
    """Yield items of a 1-based WIA collection."""
    for i in range(1, coll.Count + 1):
        yield coll.Item(i)


def _prop(props, prop_id):
    for p in _collection(props):
        if p.PropertyID == prop_id:
            return p
    return None


def _named_prop(props, name):
    for p in _collection(props):
        if p.Name == name:
            return p.Value
    return None


def _set(props, prop_id, value):
    """Set a property if the driver has it; ignore drivers that refuse."""
    p = _prop(props, prop_id)
    if p is None:
        return False
    try:
        p.Value = value
        return True
    except Exception:
        return False


def _set_max(props, prop_id):
    p = _prop(props, prop_id)
    if p is None:
        return
    try:
        if p.SubType == WIA_RANGE_SUBTYPE:
            p.Value = p.SubTypeMax
    except Exception:
        pass


class WiaBackend(ScannerBackend):
    name = "WIA"

    def _manager(self):
        import pythoncom
        import win32com.client

        try:
            pythoncom.CoInitialize()
        except pythoncom.com_error:
            pass
        return win32com.client.Dispatch("WIA.DeviceManager")

    def available(self):
        if sys.platform != "win32":
            return False, "WIA is only available on Windows"
        try:
            self._manager()
        except ImportError:
            return False, "pywin32 is not installed"
        except Exception as exc:  # WIA service missing or stopped
            return False, f"WIA is not available: {exc}"
        return True, ""

    def _scanner_infos(self):
        for info in _collection(self._manager().DeviceInfos):
            if info.Type == WIA_DEVICE_TYPE_SCANNER:
                yield info

    def list_devices(self):
        devices = []
        try:
            for info in self._scanner_infos():
                props = info.Properties
                name = _named_prop(props, "Name") or "Unnamed scanner"
                port = str(_named_prop(props, "Port") or "")
                if any(t in port.upper() for t in ("WSD", "HTTP", "IP", "NET")):
                    connection = "network"
                elif "USB" in port.upper() or port.startswith("\\\\.\\"):
                    connection = "USB"
                else:
                    connection = "unknown"
                devices.append(ScannerDevice(self.name, info.DeviceID, str(name), connection))
        except Exception as exc:
            raise wia_error(exc)
        return devices

    def scan(self, device, out_path, dpi=300):
        try:
            info = next((i for i in self._scanner_infos() if i.DeviceID == device.device_id), None)
            if info is None:
                raise ScannerError(
                    f"The scanner {device.name} is not connected. Check the USB cable and power, then press scan again.",
                    "disconnected",
                )
            dev = info.Connect()
            # Scanners that also have a document feeder: use the glass.
            _set(dev.Properties, WIA_DPS_DOCUMENT_HANDLING_SELECT, WIA_FLATBED)
            items = list(_collection(dev.Items))
            if not items:
                raise ScannerError("The scanner has no flatbed to scan from.", "driver")
            item = items[0]
            for candidate in items:
                p = _prop(candidate.Properties, WIA_IPA_ITEM_NAME)
                if p is not None and "flatbed" in str(p.Value).lower():
                    item = candidate
                    break
            props = item.Properties
            # Intent first: drivers reset other settings when it changes.
            _set(props, WIA_IPS_CUR_INTENT, WIA_INTENT_IMAGE_TYPE_GRAYSCALE)
            _set(props, WIA_IPS_XRES, dpi)
            _set(props, WIA_IPS_YRES, dpi)
            _set(props, WIA_IPS_XPOS, 0)
            _set(props, WIA_IPS_YPOS, 0)
            _set_max(props, WIA_IPS_XEXTENT)
            _set_max(props, WIA_IPS_YEXTENT)
            try:
                image = item.Transfer(WIA_FORMAT_PNG)
            except Exception:
                image = item.Transfer()  # driver's default format, usually BMP
            ext = str(getattr(image, "FileExtension", "") or "bmp").lower()
            out_path = os.path.splitext(out_path)[0] + "." + ext
            if os.path.exists(out_path):
                os.remove(out_path)
            image.SaveFile(out_path)
            return out_path
        except ScannerError:
            raise
        except Exception as exc:
            raise wia_error(exc)
