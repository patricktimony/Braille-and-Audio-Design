"""Command line entry point.

    python -m talking_scanner                 normal use
    python -m talking_scanner --diagnose      report scanners, voices, Tesseract, Narrator
    python -m talking_scanner --key-test      hear what each key does (checks Num Lock)
    python -m talking_scanner --simulate DIR  use images in DIR instead of a scanner
    python -m talking_scanner --reset         choose keys and scanner again
"""

import argparse
import logging
import os
import sys

from . import APP_NAME


def parse_args(argv):
    p = argparse.ArgumentParser(prog="talking_scanner", description=APP_NAME)
    p.add_argument("--diagnose", action="store_true", help="print a compatibility report and exit")
    p.add_argument("--key-test", action="store_true", help="speak the name and action of each key")
    p.add_argument("--simulate", metavar="DIR", help="use images in DIR instead of a real scanner")
    p.add_argument("--reset", action="store_true", help="forget the chosen keys and scanner")
    p.add_argument("--no-speech", action="store_true", help="print speech instead of speaking")
    return p.parse_args(argv)


def main(argv=None):
    args = parse_args(sys.argv[1:] if argv is None else argv)
    if args.diagnose:
        from .diagnostics import run

        return run()

    from .controller import Controller
    from .ocr import OcrEngine
    from .scanners import ScannerManager
    from .speech import ConsoleSpeaker, default_speaker
    from .storage import AppLock, Session, Settings, data_dir, delete_stale_sessions

    root = data_dir()
    logging.basicConfig(
        filename=os.path.join(root, "talking-scanner.log"),
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(name)s: %(message)s",
    )
    settings = Settings(os.path.join(root, "settings.json"))
    if args.reset:
        settings["layout"] = None
        settings["scanner"] = None
    speaker = ConsoleSpeaker() if args.no_speech else default_speaker(settings["speech_rate"], settings["voice"])

    from .ui_wx import KeyTester, run_app

    if args.key_test:
        run_app(lambda run_job, on_change, on_exit: KeyTester(speaker, on_change, on_exit), speaker.close)
        return 0

    lock = AppLock(root)
    if not lock.acquire():
        speaker.say(f"{APP_NAME} is already running. Press Alt and Tab to find it.")
        while speaker.is_busy():
            import time

            time.sleep(0.1)
        return 1
    delete_stale_sessions(root)
    session = Session(root)

    def build(run_job, on_change, on_exit):
        return Controller(
            speaker,
            ScannerManager.default(args.simulate),
            OcrEngine(lang=settings["language"] or "eng"),
            session,
            settings,
            run_job,
            on_change=on_change,
            on_exit=on_exit,
        )

    def finish():
        session.discard()  # saved books were already copied elsewhere
        speaker.close()
        lock.release()

    try:
        run_app(build, finish)
    finally:
        session.discard()
        lock.release()
    return 0
