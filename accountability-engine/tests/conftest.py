import os
import socket

import pytest

from accountability_engine.analysis import run_analysis
from accountability_engine.db import Database
from accountability_engine.demo.generate import load_demo
from accountability_engine.importers.image_importer import ocr_available


@pytest.fixture(autouse=True)
def no_network(monkeypatch):
    """Fail any test that tries to open a network connection (other than to itself)."""
    real_connect = socket.socket.connect

    def guarded(self, address):
        host = address[0] if isinstance(address, tuple) else address
        if host not in ("127.0.0.1", "localhost", "::1") and not str(host).startswith("/"):
            raise AssertionError(f"Unexpected network connection to {address}")
        return real_connect(self, address)

    monkeypatch.setattr(socket.socket, "connect", guarded)
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)


@pytest.fixture
def db(tmp_path):
    d = Database(tmp_path / "test.db")
    yield d
    d.conn.close()


@pytest.fixture
def demo_db(db):
    load_demo(db, include_screenshot=ocr_available())
    run_analysis(db)
    return db


@pytest.fixture
def client(tmp_path):
    from fastapi.testclient import TestClient

    from accountability_engine.main import create_app

    os.environ["AE_DB_PATH"] = str(tmp_path / "api.db")
    with TestClient(create_app(str(tmp_path / "api.db"))) as c:
        yield c


def apple_tx(db):
    return db.one("SELECT * FROM transactions WHERE raw_description=?",
                  ("PP*APPLE.COM/BILL402-935-7733 CA 8231",))
