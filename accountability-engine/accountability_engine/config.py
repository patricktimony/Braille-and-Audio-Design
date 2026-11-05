"""Runtime settings, read from environment variables.

Everything is local by default. No setting here sends data anywhere.
"""
from __future__ import annotations

import os
from pathlib import Path

PACKAGE_DIR = Path(__file__).resolve().parent
PROJECT_DIR = PACKAGE_DIR.parent
STATIC_DIR = PACKAGE_DIR / "static"
DEMO_DATA_DIR = PACKAGE_DIR / "demo" / "data"


def db_path() -> Path:
    return Path(os.environ.get("AE_DB_PATH", PROJECT_DIR / "data" / "accountability.db"))


def llm_model() -> str:
    return os.environ.get("AE_LLM_MODEL", "claude-sonnet-5-5")


def llm_api_key() -> str | None:
    return os.environ.get("ANTHROPIC_API_KEY") or None
