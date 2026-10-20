"""Command line entry point.

    python -m talking_scanner                 normal use
    python -m talking_scanner --diagnose      report scanners, voices, Tesseract, Narrator
    python -m talking_scanner --key-test      hear what each key does (checks Num Lock)
    python -m talking_scanner --simulate DIR  use images in DIR instead of a scanner
    python -m talking_scanner --reset         choose keys and scanner again
    python -m talking_scanner --speech-test   check speech and word tracking
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
    p.add_argument("--speech-test", action="store_true", help="speak a sentence and report word tracking")
    p.add_argument("--no-speech", action="store_true", help="print speech instead of speaking")
    return p.parse_args(argv)


def main(argv=None):
    args = parse_args(sys.argv[1:] if argv is None else argv)
    if args.diagnose:
        from .diagnostics import run

        return run()

    if args.speech_test:
        return speech_test()

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


def speech_test():
    """Speak a sentence, pause halfway, resume, and report how positions were found."""
    import time

    from .speech import default_speaker

    text = ("This is the Talking Scanner speech test. The voice will pause in the middle "
            "of this sentence, and then carry on from the word where it stopped.")
    speaker = default_speaker()
    speaker.say(text)
    positions, sources = [], set()
    end = time.monotonic() + 3.0
    while time.monotonic() < end and speaker.is_busy():
        pos = speaker.position()
        if pos is not None and (not positions or pos != positions[-1]):
            positions.append(pos)
        sources.add(getattr(speaker, "position_source", None))
        time.sleep(0.05)
    paused_at = speaker.position() or 0
    speaker.stop()
    word_start = text.rfind(" ", 0, paused_at + 1) + 1
    print(f"Paused at character {paused_at}: '{text[word_start:word_start + 20]}...'")
    time.sleep(1.0)
    speaker.say(text[word_start:])
    while speaker.is_busy():
        time.sleep(0.05)
    print(f"Positions seen: {positions}")
    print(f"Position source(s): {', '.join(sorted(str(s) for s in sources))}")
    print("'word events' or 'status' means exact word tracking works on this PC.")
    print("'estimate' means the pause point is estimated from time; record this in README.md.")
    speaker.close()
    return 0
