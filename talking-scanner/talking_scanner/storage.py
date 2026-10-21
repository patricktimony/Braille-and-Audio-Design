"""Settings, the reading session, and saving books.

Privacy rules:
* Scans live in a private session folder under %LOCALAPPDATA% (never synced
  by OneDrive) and are deleted when the program closes, unless the patron
  presses Y to save the book.
* Session folders left behind by a crash or power cut are deleted the next
  time the program starts.
* Saved books go to "%USERPROFILE%\\Talking Scanner Books".  Folders inside
  OneDrive or other sync folders are refused so scans are never uploaded.
* Nothing in this program uses the network.
"""

import json
import os
import shutil
import sys
import tempfile
import time

from .document import Book

SYNC_FOLDER_MARKERS = ("onedrive", "dropbox", "google drive", "googledrive", "icloud", "box sync")


def data_dir():
    root = os.environ.get("TALKING_SCANNER_HOME")
    if not root:
        if sys.platform == "win32":
            root = os.path.join(os.environ.get("LOCALAPPDATA") or os.path.expanduser("~"), "TalkingScanner")
        else:
            root = os.path.join(os.path.expanduser("~"), ".local", "share", "talking-scanner")
    os.makedirs(root, exist_ok=True)
    return root


def default_books_dir():
    return os.path.join(os.path.expanduser("~"), "Talking Scanner Books")


def is_sync_folder(path):
    lowered = os.path.abspath(path).lower()
    return any(marker in lowered for marker in SYNC_FOLDER_MARKERS)


def _write_json(path, data):
    tmp = path + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    os.replace(tmp, path)


class Settings:
    DEFAULTS = {
        "layout": None,  # "numpad" or "laptop", chosen once on first run
        "scanner": None,  # ScannerDevice.key of the chosen scanner
        "dpi": 300,
        "language": "eng",
        "speech_rate": 0,
        "voice": None,
        "books_dir": None,
    }

    def __init__(self, path):
        self.path = path
        self.values = dict(self.DEFAULTS)
        try:
            with open(path, encoding="utf-8") as f:
                self.values.update(json.load(f))
        except (OSError, ValueError):
            pass

    def __getitem__(self, key):
        return self.values.get(key)

    def __setitem__(self, key, value):
        self.values[key] = value
        _write_json(self.path, self.values)


class AppLock:
    """Allows only one copy of the program, so cleanup never deletes a live session."""

    def __init__(self, folder):
        self.path = os.path.join(folder, "running.lock")
        self._f = None

    def acquire(self):
        f = open(self.path, "a+")
        try:
            if sys.platform == "win32":
                import msvcrt

                f.seek(0)
                msvcrt.locking(f.fileno(), msvcrt.LK_NBLCK, 1)
            else:
                import fcntl

                fcntl.flock(f.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
        except OSError:
            f.close()
            return False
        self._f = f
        return True

    def release(self):
        if self._f:
            self._f.close()
            self._f = None


def sessions_root(root=None):
    path = os.path.join(root or data_dir(), "sessions")
    os.makedirs(path, exist_ok=True)
    return path


def delete_stale_sessions(root=None):
    """Delete sessions left by a crash.  Call only while holding AppLock."""
    base = sessions_root(root)
    for name in os.listdir(base):
        shutil.rmtree(os.path.join(base, name), ignore_errors=True)


class Session:
    def __init__(self, root=None):
        self.dir = tempfile.mkdtemp(prefix="session-", dir=sessions_root(root))
        self.book = Book()
        self._counter = 0

    def new_image_path(self):
        self._counter += 1
        return os.path.join(self.dir, f"scan-{self._counter:03d}.png")

    def save(self):
        if os.path.isdir(self.dir):
            _write_json(os.path.join(self.dir, "session.json"), self.book.to_dict())

    def save_book(self, books_dir=None):
        """Copy the session to a permanent folder and return its path."""
        books_dir = books_dir or default_books_dir()
        if is_sync_folder(books_dir):
            raise OSError(f"Refusing to save into a cloud sync folder: {books_dir}")
        stamp = time.strftime("%Y-%m-%d %H-%M-%S")
        dest = os.path.join(books_dir, f"Book {stamp}")
        os.makedirs(dest, exist_ok=False)
        for page in self.book.pages:
            if page.image_name and os.path.exists(os.path.join(self.dir, page.image_name)):
                shutil.copy2(os.path.join(self.dir, page.image_name), dest)
        with open(os.path.join(dest, "book.txt"), "w", encoding="utf-8") as f:
            for i, page in enumerate(self.book.pages, 1):
                f.write(f"Page {i}\n\n{page.text}\n\n")
        _write_json(os.path.join(dest, "session.json"), self.book.to_dict())
        return dest

    def discard(self):
        shutil.rmtree(self.dir, ignore_errors=True)
