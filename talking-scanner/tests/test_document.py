from talking_scanner.document import Book, Page


def make_book():
    book = Book()
    book.add_page(Page("One two three\nfour five\n\nsix"))
    book.add_page(Page("Second page here\nlast line"))
    book.page, book.word = 0, 0
    return book


def test_page_words_and_lines():
    p = Page("  One   two\n\n three  \n")
    assert p.lines == ["One two", "three"]
    assert [p.word_text(i) for i in range(len(p.words))] == ["One", "two", "three"]
    assert p.line_first_word == [0, 2]
    assert p.word_at_char(p.text.index("two") + 1) == 1
    assert p.word_at_char(p.text.index("three")) == 2


def test_word_navigation_stays_on_page():
    b = make_book()
    assert not b.prev_word()
    for _ in range(5):
        assert b.next_word()
    assert b.current.word_text(b.word) == "six"
    assert not b.next_word()
    assert b.page == 0


def test_line_navigation():
    b = make_book()
    assert not b.prev_line()
    assert b.next_line() and b.current_line_text() == "four five"
    assert b.next_line() and b.current_line_text() == "six"
    assert not b.next_line()
    b.word = 4  # "five", middle of line 2
    assert b.prev_line() and b.current_line_text() == "One two three"


def test_end_of_page_position_moves_back_sensibly():
    b = make_book()
    b.word = len(b.current.words)  # read to the end
    assert b.at_end_of_page()
    assert b.prev_line() and b.current_line_text() == "six"
    b.word = len(b.current.words)
    assert b.prev_word() and b.current.word_text(b.word) == "six"


def test_page_navigation_and_serialisation():
    b = make_book()
    assert not b.prev_page()
    assert b.next_page() and b.page == 1 and b.word == 0
    assert not b.next_page()
    b.word = 2
    restored = Book.from_dict(b.to_dict())
    assert (restored.page, restored.word) == (1, 2)
    assert [p.text for p in restored.pages] == [p.text for p in b.pages]
