"""Compatibility report: run `python -m talking_scanner --diagnose`.

Lists what is actually present on this computer (scanners and their
drivers, voices, Tesseract, Narrator, Num Lock) so library staff can record
what has been tested.  It changes nothing and uses no network.
"""

import os
import platform
import subprocess
import sys

from . import APP_NAME, __version__


def _section(out, title, fn):
    out.append(f"\n== {title} ==")
    try:
        fn(out)
    except Exception as exc:
        out.append(f"  ERROR: {type(exc).__name__}: {exc}")


def _system(out):
    out.append(f"  {APP_NAME} {__version__}")
    out.append(f"  OS: {platform.platform()}  ({platform.version()})")
    out.append(f"  Python: {sys.version.split()[0]} {platform.architecture()[0]}")
    out.append(f"  Packaged executable: {bool(getattr(sys, 'frozen', False))}")


def _run(cmd):
    flags = getattr(subprocess, "CREATE_NO_WINDOW", 0)
    r = subprocess.run(cmd, capture_output=True, text=True, timeout=60, creationflags=flags)
    return (r.stdout or r.stderr).strip()


def _pnp(out):
    text = _run([
        "powershell", "-NoProfile", "-Command",
        "Get-PnpDevice -Class Image,Camera -ErrorAction SilentlyContinue | "
        "Format-Table -AutoSize Status,FriendlyName,InstanceId | Out-String -Width 200",
    ])
    out.append("  Imaging devices known to Windows (Device Manager):")
    out.extend("    " + line for line in (text or "(none)").splitlines())
    out.append("  WIA service (stisvc):")
    out.extend("    " + line.strip() for line in _run(["sc", "query", "stisvc"]).splitlines() if "STATE" in line)


def _wia(out):
    from .scanners.wia import WiaBackend, _collection, _named_prop

    backend = WiaBackend()
    ok, reason = backend.available()
    out.append(f"  WIA available: {ok} {reason}")
    if not ok:
        return
    infos = list(_collection(backend._manager().DeviceInfos))
    out.append(f"  WIA devices: {len(infos)}  (type 1 = scanner, 2 = camera, 3 = video)")
    for info in infos:
        props = info.Properties
        out.append(
            f"    type={info.Type} name={_named_prop(props, 'Name')!r} "
            f"manufacturer={_named_prop(props, 'Manufacturer')!r} port={_named_prop(props, 'Port')!r} "
            f"id={info.DeviceID}"
        )
    for dev in backend.list_devices():
        out.append(f"  Usable scanner: {dev.spoken()}  [{dev.key}]")


def _twain(out):
    from .scanners.twain_backend import TwainBackend

    backend = TwainBackend()
    ok, reason = backend.available()
    out.append(f"  TWAIN available: {ok} {reason}")
    if ok:
        for dev in backend.list_devices():
            out.append(f"  TWAIN source: {dev.name}")


def _tesseract(out):
    from .ocr import OcrEngine

    engine = OcrEngine()
    out.append(f"  tesseract: {engine.cmd}")
    out.append(f"  version: {engine.check()}")
    out.append(f"  languages: {', '.join(engine._pt.get_languages(config=''))}")


def _voices(out):
    from .speech.sapi import SapiSpeaker

    speaker = SapiSpeaker()
    out.append(f"  Default voice: {speaker.voice.Voice.GetDescription()}")
    for v in speaker.voices():
        out.append(f"    {v.GetDescription()}")


def _narrator_keyboard(out):
    import ctypes

    user32 = ctypes.windll.user32
    flag = ctypes.c_int(0)
    user32.SystemParametersInfoW(0x0046, 0, ctypes.byref(flag), 0)  # SPI_GETSCREENREADER
    running = "Narrator.exe" in _run(["tasklist", "/FI", "IMAGENAME eq Narrator.exe"])
    out.append(f"  Screen reader flag set: {bool(flag.value)}")
    out.append(f"  Narrator running: {running}")
    out.append(f"  Num Lock on: {bool(user32.GetKeyState(0x90) & 1)}")
    out.append(f"  Keyboard type: {user32.GetKeyboardType(0)} subtype {user32.GetKeyboardType(1)} "
               f"function keys {user32.GetKeyboardType(2)}")
    out.append("  Note: Windows cannot tell whether a keyboard has a number pad;")
    out.append("  the patron chooses once on first run, and both layouts always work.")


def report():
    out = [f"{APP_NAME} diagnostics"]
    _section(out, "System", _system)
    if sys.platform == "win32":
        _section(out, "Scanner drivers", _pnp)
        _section(out, "WIA", _wia)
        _section(out, "TWAIN (optional fallback)", _twain)
    _section(out, "Tesseract OCR", _tesseract)
    if sys.platform == "win32":
        _section(out, "Speech voices (SAPI 5)", _voices)
        _section(out, "Narrator and keyboard", _narrator_keyboard)
    out.append("\n== Network ==\n  Talking Scanner makes no network connections.")
    return "\n".join(out)


def run():
    from .storage import data_dir

    text = report()
    path = os.path.join(data_dir(), "diagnostics.txt")
    with open(path, "w", encoding="utf-8") as f:
        f.write(text + "\n")
    print(text)
    print(f"\nSaved to {path}")
    return 0
