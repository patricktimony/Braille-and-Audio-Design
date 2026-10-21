"""Scanned pages and the reading position.

A Book holds pages in the order they were scanned.  The cursor is a page
index plus a word index into that page.  A word index equal to the number of
words on the page means "after the last word" (the page has been read to the
end).
"""

import bisect
import re
from dataclasses import dataclass


@dataclass(frozen=True)
class Word:
    start: int  # character offset into Page.text
    end: int
    line: int


class Page:
    def __init__(self, text, image_name=None):
        lines = [" ".join(raw.split()) for raw in text.splitlines()]
        self.lines = [line for line in lines if line]
        self.text = "\n".join(self.lines)
        self.image_name = image_name
        self.words = []
        self.line_first_word = []
        pos = 0
        for line_no, line in enumerate(self.lines):
            self.line_first_word.append(len(self.words))
            for m in re.finditer(r"\S+", line):
                self.words.append(Word(pos + m.start(), pos + m.end(), line_no))
            pos += len(line) + 1
        self._starts = [w.start for w in self.words]

    def is_empty(self):
        return not self.words

    def word_text(self, index):
        w = self.words[index]
        return self.text[w.start:w.end]

    def line_text(self, line_no):
        return self.lines[line_no]

    def line_of_word(self, index):
        """Line of a word; the after-the-end position counts as one past the last line."""
        if index >= len(self.words):
            return len(self.lines)
        return self.words[index].line

    def char_of_word(self, index):
        if index >= len(self.words):
            return len(self.text)
        return self.words[index].start

    def word_at_char(self, offset):
        """Index of the word that contains or precedes a character offset."""
        i = bisect.bisect_right(self._starts, offset) - 1
        return max(0, min(i, len(self.words) - 1))

    def to_dict(self):
        return {"text": self.text, "image": self.image_name}

    @classmethod
    def from_dict(cls, data):
        return cls(data["text"], data.get("image"))


class Book:
    def __init__(self):
        self.pages = []
        self.page = 0
        self.word = 0

    # -- state ---------------------------------------------------------
    def __len__(self):
        return len(self.pages)

    @property
    def current(self):
        return self.pages[self.page] if self.pages else None

    def at_end_of_page(self):
        return self.current is not None and self.word >= len(self.current.words)

    def add_page(self, page):
        self.pages.append(page)
        self.page = len(self.pages) - 1
        self.word = 0

    # -- navigation: each returns True if the cursor moved --------------
    def next_word(self):
        if self.current is None or self.word >= len(self.current.words) - 1:
            return False
        self.word += 1
        return True

    def prev_word(self):
        if self.current is None or self.word == 0:
            return False
        self.word = min(self.word, len(self.current.words)) - 1
        return True

    def next_line(self):
        page = self.current
        if page is None:
            return False
        line = page.line_of_word(self.word)
        if line >= len(page.lines) - 1:
            return False
        self.word = page.line_first_word[line + 1]
        return True

    def prev_line(self):
        page = self.current
        if page is None:
            return False
        line = page.line_of_word(self.word)
        if line == 0:
            return False
        self.word = page.line_first_word[line - 1]
        return True

    def next_page(self):
        if self.page >= len(self.pages) - 1:
            return False
        self.page += 1
        self.word = 0
        return True

    def prev_page(self):
        if self.page == 0 or not self.pages:
            return False
        self.page -= 1
        self.word = 0
        return True

    def current_line_text(self):
        page = self.current
        return page.line_text(page.line_of_word(self.word))

    # -- persistence ---------------------------------------------------
    def to_dict(self):
        return {
            "pages": [p.to_dict() for p in self.pages],
            "position": {"page": self.page, "word": self.word},
        }

    @classmethod
    def from_dict(cls, data):
        book = cls()
        book.pages = [Page.from_dict(p) for p in data.get("pages", [])]
        pos = data.get("position", {})
        if book.pages:
            book.page = max(0, min(pos.get("page", 0), len(book.pages) - 1))
            book.word = max(0, min(pos.get("word", 0), len(book.current.words)))
        return book
