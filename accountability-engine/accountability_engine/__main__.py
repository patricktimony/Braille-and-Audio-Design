"""Start the app:  python -m accountability_engine [--port 8000] [--demo]"""
from __future__ import annotations

import argparse
import webbrowser


def main() -> None:
    parser = argparse.ArgumentParser(description="The Accountability Engine (local only)")
    parser.add_argument("--port", type=int, default=8000)
    parser.add_argument("--demo", action="store_true", help="load the demonstration data first")
    parser.add_argument("--no-browser", action="store_true", help="do not open a browser")
    args = parser.parse_args()

    if args.demo:
        from .analysis import run_analysis
        from .db import Database
        from .demo.generate import load_demo
        from .importers.image_importer import ocr_available

        db = Database()
        load_demo(db, include_screenshot=ocr_available())
        run_analysis(db)
        db.conn.close()

    import uvicorn

    url = f"http://127.0.0.1:{args.port}/"
    print(f"The Accountability Engine is running at {url}  (press Ctrl+C to stop)")
    if not args.no_browser:
        try:
            webbrowser.open(url)
        except Exception:
            pass
    uvicorn.run("accountability_engine.main:app", host="127.0.0.1", port=args.port,
                log_level="warning")


if __name__ == "__main__":
    main()
