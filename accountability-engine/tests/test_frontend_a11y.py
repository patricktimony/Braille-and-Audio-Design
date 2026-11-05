"""Static accessibility checks on the front end. (The README also describes
the manual screen-reader checks with NVDA, JAWS and VoiceOver.)"""
import re
from html.parser import HTMLParser

from accountability_engine.config import STATIC_DIR

HTML = (STATIC_DIR / "index.html").read_text()
JS = (STATIC_DIR / "app.js").read_text()


class Collector(HTMLParser):
    def __init__(self):
        super().__init__()
        self.tags = []

    def handle_starttag(self, tag, attrs):
        self.tags.append((tag, dict(attrs)))


def tags():
    c = Collector()
    c.feed(HTML)
    return c.tags


def test_document_basics():
    assert '<html lang="en">' in HTML
    assert re.search(r"<title>[^<]+</title>", HTML)
    assert 'name="viewport"' in HTML and "user-scalable=no" not in HTML
    assert 'class="skip-link" href="#main"' in HTML
    for landmark in ("<header", "<nav", "<main", "<footer"):
        assert landmark in HTML


def test_every_form_control_has_a_label():
    all_tags = tags()
    label_for = {a.get("for") for t, a in all_tags if t == "label"}
    for t, a in all_tags:
        if t in ("input", "select", "textarea") and a.get("type") != "hidden":
            assert a.get("id") in label_for or a.get("aria-label"), a


def test_buttons_have_type_and_text():
    for m in re.finditer(r"<button([^>]*)>(.*?)</button>", HTML, re.S):
        assert 'type="' in m.group(1)
        assert re.sub(r"<[^>]+>", "", m.group(2)).strip()


def test_each_view_has_one_focusable_h1():
    views = re.findall(r'data-view-section="(\w+)"', HTML)
    assert len(views) == 9
    for v in views:
        assert re.search(rf'<h1 id="h-{v}" tabindex="-1">', HTML), v


def test_no_positive_tabindex_and_live_regions():
    assert not re.search(r'tabindex="[1-9]', HTML)
    assert 'role="status"' in HTML and 'role="log"' in HTML


def test_tables_have_captions_and_header_scope():
    assert "<caption" in HTML and 'scope="col"' in HTML


def test_js_inserts_untrusted_text_safely():
    assert "innerHTML" not in JS and "insertAdjacentHTML" not in JS and "eval(" not in JS


def test_no_single_key_shortcuts():
    assert "keydown" not in JS and "keypress" not in JS


def test_no_external_resources():
    assert not re.search(r'(src|href)="https?://', HTML)
    assert "https://" not in JS


def test_css_focus_and_motion():
    css = (STATIC_DIR / "styles.css").read_text()
    assert ":focus-visible" in css and "outline: 3px" in css
    assert "prefers-reduced-motion" in css and "prefers-color-scheme: dark" in css
    assert "min-height: 44px" in css  # target size
