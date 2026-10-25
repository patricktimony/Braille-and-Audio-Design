# Talking Scanner

A free, offline talking flatbed scanner for blind library patrons on Windows 11.

## Download

**[Download TalkingScannerSetup.exe for Windows 11](https://github.com/patricktimony/Braille-and-Audio-Design/releases/latest/download/TalkingScannerSetup.exe)**

One file, and nothing else to install. Open it, press Enter to install, and
press Enter to finish. Then start Talking Scanner at any time with
**Control + Alt + T**. If Windows says "Windows protected your PC", press Tab
to *More info*, press Enter, then press Tab to *Run anyway* and press Enter.
The full spoken-friendly guide is [installer/USER-GUIDE.txt](installer/USER-GUIDE.txt);
it is also installed in the Start menu as *Talking Scanner user guide*.

Put a page face down on the glass, press one key, and the page is read aloud.
You only need the keyboard. You do not need a mouse, cloud service, account or API key.
It works with or without a screen reader such as JAWS or Narrator.

* Scanning uses Windows' own scanner drivers (WIA first, with TWAIN as a fallback).
* Text recognition uses Tesseract OCR, which runs on this computer.
* Speech uses the voices built into Windows.
* Nothing is ever sent to the internet.

> **Testing status (read this first).** This is a first prototype. What has
> and has not been tested is listed under [Testing record](#testing-record).
> **No physical scanner has been tested yet, and the app has not been tested
> with Narrator yet.** Those two checks have to be done on the library's PC.

---

## Keys

Each action is **one key**. You never have to hold two keys at once.

| Action | Number pad (layout A) | Main keyboard (layout B) |
|---|---|---|
| Scan and read | Number pad **Enter** | **Enter** |
| Play / pause | **5** | **Space** |
| Previous / next word | **4** / **6** | **Left** / **Right** arrow |
| Previous / next line | **8** / **2** | **Up** / **Down** arrow |
| Previous / next page | **7** / **9** | **Page Up** / **Page Down** |
| Help | F1 | F1 |
| Quit (asks first) | Escape | Escape |

* **Both layouts always work.** On first run you press the Enter key you
  want to scan with. That choice only decides which keys the spoken help
  describes. Windows cannot tell whether a keyboard has a number pad, so it
  asks instead of guessing.
* **Num Lock does not matter.** With Num Lock on, the number pad sends
  digits. With Num Lock off, it sends arrow, Home and Page Up keys that are
  marked as number-pad keys. Both are handled. Number pad 9 with Num Lock off
  still means *next page*, even though the separate Page Up key means
  *previous page*.
* **Tactile keys:** the number pad 5 key has a raised dot. Enter, Space, the
  arrow cluster and Page Up/Down are at fixed edges of the keyboard.
* Keys held with Ctrl, Alt, Shift or the Windows key go to Windows untouched.
  The program only receives keys while its window is in front, and it never
  installs a system-wide keyboard hook.

**How the reading keys behave**

* *Word* keys stop reading, then say one word. Press play to continue from that word.
* *Line* keys: while reading, reading carries on from the new line. While
  paused, they say just that line.
* *Page* keys say "Page 2 of 5". While reading, reading carries on.
* When a page ends, reading continues on the next scanned page.
* Spoken progress: "Scanning.", "Recognizing text.", "Reading page 3."
  While a step is still running, you hear "Still scanning." every 10 seconds.

---

## Install from source (developers only)

Most people should use the [installer](#download) instead. Everything below is free and open source.

1. Download this folder (for example, *Code → Download ZIP* on GitHub) and unzip it,
   for example to `C:\TalkingScanner`.
2. Double-click **`install.bat`**. It installs:
   * **Python 3.12** with `winget` (built into Windows 11). If Python was just
     installed, run `install.bat` a second time.
   * **Tesseract OCR** (UB Mannheim build) with `winget`. It includes English and page-orientation data.
   * The Python packages in `requirements.txt` (pytesseract, Pillow, pywin32 and wxPython),
     inside a private `.venv` folder.
   * A **Start menu** shortcut called *Talking Scanner*.
3. Install the scanner's normal Windows driver from the manufacturer if
   Windows did not install one automatically. You do not need the
   manufacturer's scanning app. For a Canon CanoScan LiDE 400, the driver
   package is *LiDE 400 Scanner Driver*.

**If you prefer to do it by hand:**

```
winget install -e --id Python.Python.3.12
winget install -e --id UB-Mannheim.TesseractOCR
py -m venv .venv
.venv\Scripts\python -m pip install -r requirements.txt
```

To use another OCR language, tick it in the Tesseract installer. Then set
`"language"` in `%LOCALAPPDATA%\TalkingScanner\settings.json`, for example to `"spa"` or `"eng+spa"`.

### Launch (one command)

```
run.bat
```

You can also press the Windows key, type *Talking Scanner*, and press Enter.
The program **does not start with Windows**, and the installer adds nothing to startup.

| Command | Purpose |
|---|---|
| `run.bat --diagnose` | Report the scanners, drivers, voices, Tesseract, Narrator and Num Lock state found on this PC. Run this first on a new PC. |
| `run.bat --key-test` | Speaks the name and action of every key you press. Use it to check a keyboard. Press Escape twice to finish. |
| `run.bat --simulate samples` | Practise with sample page images instead of a scanner. |
| `run.bat --reset` | Choose the keys and the scanner again. |
| `run.bat --speech-test` | Speaks a sentence, pauses halfway, carries on, and reports whether the exact word position was available. |
| `run.bat --practice` | Same as `--simulate samples`, using the sample pages shipped with the program. |
| `run.bat --self-test` | Recognizes the sample pages and checks the Windows voices, then says "Self test passed" or "failed". Saves `self-test.txt`. |

### Installer and releases

`build_exe.bat` (or `installer\build_windows.ps1`) builds
`dist\TalkingScanner\TalkingScanner.exe` with PyInstaller, bundles Tesseract
OCR and the sample pages, and packs everything into the single installer
`dist\TalkingScannerSetup.exe` with [Inno Setup](https://jrsoftware.org/isinfo.php)
(`installer\TalkingScanner.iss`).

The installer is per-user (no administrator prompt) and has two pages: Install
and Finish. It speaks each step with the Windows voice, unless a screen reader
(JAWS, NVDA or Narrator) is running, in which case it stays quiet and the
screen reader reads the pages. It adds a Start menu shortcut with the hotkey **Ctrl+Alt+T**, a
desktop shortcut, and a *Talking Scanner Tools* folder (practice with sample
pages, key test, self test, user guide, uninstall). It adds nothing to startup.

The GitHub Actions workflow `.github/workflows/talking-scanner-windows.yml`
runs on every change: the tests, then the build, then
`installer\test_installer.py`, which installs by pressing Enter only, reads
each installer page and the program window through UI Automation, presses a
real key in the installed program, runs its `--self-test` with the system
Tesseract hidden, upgrades, and uninstalls.

**Publishing a new version:** raise `__version__` in
`talking_scanner/__init__.py`. When that change is merged into `main`, and
every test passes, the workflow publishes release `talking-scanner-v<version>`
with `TalkingScannerSetup.exe`. The download link above always points at the
newest release. Merging the pull request is the approval: nothing is published
from other branches, or if any test fails.

---

## Narrator and speech: why the program speaks for itself

The brief asks for Narrator first, unless Narrator cannot reliably handle
automatic speech and navigation. It cannot:

* Windows Narrator has **no public programming interface** for another program
  to start continuous reading at a chosen word, pause it, resume it, or find
  out which word is being spoken.
* A program can only send Narrator one-off *notifications* (UI Automation
  `RaiseNotificationEvent`). Narrator may drop these or cut them short
  when a key is pressed. They cannot be paused and they report no position.
  That is not enough for word, line and page navigation with a remembered
  reading position.

So Talking Scanner reads with **Windows' built-in offline voices through SAPI 5**.
These are the same Microsoft voices (such as David and Zira) that ship with
Windows. SAPI can report which word it is speaking, so pausing remembers the
exact word. If SAPI does not report it (as on the test server, which had no
sound card), the position is estimated from time and speech rate.
`run.bat --speech-test` shows which happens on your PC.

How it works with Narrator:

* The window uses native Windows controls (wxPython), so Narrator can read it.
  The status line and the **window title always hold the last announcement**,
  so a Narrator user can press *Narrator key + T* to hear it again.
* Narrator's own commands (Caps Lock or Insert combinations) never reach the
  program, so they keep working.
* Narrator and the program's voice can talk at the same time, for example
  when the window first opens. Some libraries prefer to turn on *Narrator
  settings → Lower the volume of other apps when Narrator is speaking*.
* If arrow keys or Space seem to do nothing while Narrator is on, Narrator's
  **scan mode** is probably on. Press **Caps Lock + Space** to turn it off.
  This has **not been tested yet**. Please record the result below.

## JAWS

Talking Scanner works next to JAWS the same way as next to Narrator: it reads
pages with its own Windows voice, and JAWS keeps its own keys.

* JAWS uses the **number pad** for its own commands while **Num Lock is off**
  (for example number pad 5 says the current character), so those keys never
  reach Talking Scanner. With Num Lock on, all number pad keys work. The main
  keyboard keys work either way. When JAWS is running with Num Lock off and
  the number pad layout chosen, Talking Scanner says so at start-up, after
  choosing keys, and in the F1 help.
* **Insert + T** (JAWS: say window title) repeats the last announcement.
* `--diagnose` lists which screen readers (JAWS, Narrator, NVDA) are running.
* This has **not been tested with JAWS yet**. Please record the result below.

---

## Scanners

Talking Scanner is not tied to any make or model.

1. When you press scan, it looks for scanners through **WIA** (Windows Image
   Acquisition), then through **TWAIN** if the optional `pytwain` package is installed.
2. **One scanner:** it is used straight away.
3. **Several scanners:** it says "2 scanners found" and reads each one by
   name. Use the arrow keys (or 8 and 2) to move between them, and press
   Enter to choose. The choice is remembered.
4. **Unplugged, switched off, busy, lid open, or driver errors** are spoken
   in plain language. For example: "The scanner is offline. Check the USB cable
   and that it is switched on, then press scan again." The next scan searches again.
5. Scans run through WIA's `Transfer` call, which never opens the
   manufacturer's windows. Settings are 300 dpi grayscale, across the full glass.
6. Network scanners appear if their WIA driver is installed. They are
   announced as "network" when the driver says so.
7. Pages placed upside down or sideways are turned the right way up automatically.

The TWAIN fallback is **experimental and untested**. Some TWAIN drivers
always show their own window, and a blind patron cannot use those without help.

### Adding another scanning method

Scanner code lives in `talking_scanner/scanners/`. To add a backend,
for example the Windows Runtime scanning API or SANE, write a class with
`available()`, `list_devices()` and `scan(device, out_path, dpi)` (see `base.py`).
Then add it to `BACKEND_FACTORIES` in `scanners/__init__.py`. OCR, speech and
keyboard code do not change.

---

## Privacy

* Scans live in a private session folder under `%LOCALAPPDATA%\TalkingScanner\sessions`.
  That location is never synced by OneDrive.
* **When the patron quits**, the program asks:
  "Do you want to save them on this computer to read later? Press Y to save,
  or N to delete them." Pages are only kept if the patron presses **Y**.
* If Windows shuts down, or the window is closed before the patron answers,
  the pages are **deleted**, never saved.
* Session folders left by a crash or power cut are deleted the next time the program starts.
* Saved books go to `%USERPROFILE%\Talking Scanner Books\Book <date time>\`.
  Each one contains `book.txt` (readable in Notepad with Narrator), the page
  images, and the reading position. The program **refuses to save into
  OneDrive, Dropbox, Google Drive or iCloud folders**.
* The program contains no network code. The test suite checks this, and the
  OCR test fails if anything tries to open a network connection.
* Logs (`%LOCALAPPDATA%\TalkingScanner\talking-scanner.log`) contain error
  codes only, never page text.

---

## Testing record

Fill in the "Physical tests" table as you test real hardware.

### Done (automated)

| What | Where | Result |
|---|---|---|
| Key mapping: every key in both layouts, Num Lock on and off, no conflicts | Linux container (logic only) | pass |
| Reading position, word, line and page navigation, end of page | Linux container | pass |
| Pause, resume at the same word, interrupting speech with word/line/page keys | Linux container (simulated speaker) | pass |
| Spoken announcements order: Scanning → Recognizing text → Reading | Linux container | pass |
| Errors spoken: no scanner, unplugged then re-plugged, lid open, unexpected error | Linux container (simulated scanner) | pass |
| Spoken choice between several scanners, remembered next time | Linux container (simulated scanner) | pass |
| Tesseract 5.3.4 OCR on 4 simulated pages (3 text, 1 upside down, 1 blank) | Linux container | exact text, upside-down page corrected, blank page reported |
| Sideways (90° and 270°) page correction | Linux container | pass |
| Save with consent, delete without, refuse OneDrive, crash cleanup, single copy | Linux container | pass |
| No network access during a full scan and read | Linux container | pass |
| Interrupting a real speech engine (espeak-ng) | Linux container, **no sound card** | passes, but weak: espeak exits early without audio |
| Same unit and integration tests, plus Tesseract 5.5.3 OCR on the sample pages | GitHub Actions, Windows Server 2025 (build 26100), Python 3.12, wxPython 4.3.2 | pass |
| **Real Windows key events** (SendInput scan codes) into the real window, every key in both layouts, **Num Lock on and off** | same Windows machine | **38 of 38 as expected**. Number pad 9 with Num Lock off arrives as number-pad Page Up, separate from the Page Up key. Number pad 5 with Num Lock off arrives as Clear. |
| SAPI speech: interrupting, and reading on through scanned pages inside the program | same Windows machine (Microsoft David and Zira voices), speaking into a WAV file | pass |
| SAPI **word position** while speaking | same Windows machine, **no sound card** | **Not reported.** Neither word events nor `SpVoice.Status` gave progress. The program falls back to estimating from time and speech rate. Check on the library PC with `run.bat --speech-test`. |
| WIA automation library and service present | same Windows machine (no scanner attached: 0 devices) | WIA available, starts on demand |
| Executable built with PyInstaller; with system Tesseract hidden, it used its **bundled Tesseract** | same Windows machine | pass |
| Installer: install by pressing Enter only; every page and the program window read through UI Automation; Enter key answered by the installed program; shortcuts and Ctrl+Alt+T hotkey; installed `--self-test` with bundled Tesseract; upgrade; uninstall | GitHub Actions, Windows Server 2025, on every change and before every release | see the latest workflow run |

### Not yet tested: needs the library PC

| What | Status |
|---|---|
| Canon CanoScan LiDE 400 via WIA | **not tested** |
| Any other physical scanner (Epson, Brother, HP, network) | **not tested** |
| TWAIN fallback | **not tested** |
| Use with Narrator running (focus, scan mode, overlapping speech) | **not tested** |
| Use with JAWS running (number pad with Num Lock on and off, overlapping speech) | **not tested** |
| Installing on a real Windows 11 laptop with JAWS or Narrator | **not tested** (installer tested automatically through UI Automation only) |
| Exact word tracking through speakers (`run.bat --speech-test`) | **not tested** |
| Audible speech on any PC with speakers | **not tested** |
| A physical number pad and a laptop keyboard | **not tested** (run `run.bat --key-test`) |

### Physical tests (fill in)

| Date | PC / Windows build | Scanner and driver (`--diagnose`) | Backend | Scan | OCR | Narrator on | Notes |
|---|---|---|---|---|---|---|---|
| | | | | | | | |

**Suggested first session on the library PC:**

1. `run.bat --diagnose`, and keep `%LOCALAPPDATA%\TalkingScanner\diagnostics.txt`.
2. `run.bat --simulate samples`: check speech, pausing and navigation with no scanner.
3. `run.bat --key-test`: try every key, with Num Lock on and off.
   Then run `run.bat --speech-test`, and record whether it reports "word events" or "estimate".
4. Turn on Narrator (Ctrl + Windows + Enter) and repeat steps 2 and 3.
5. Plug in the scanner, run `run.bat`, and scan a few real pages.

---

## Development

```
py -m pip install -r requirements.txt -r requirements-dev.txt
py -m pytest                       # all tests, with or without Windows
py tools\windows_key_test.py       # Windows: real key events into the real window
py tools\make_samples.py           # regenerate the sample page images
```

| File | Purpose |
|---|---|
| `talking_scanner/controller.py` | All behaviour, independent of toolkit and hardware |
| `talking_scanner/keymap.py` | Both keyboard layouts and the Num Lock mapping |
| `talking_scanner/document.py` | Pages, words, lines and the reading position |
| `talking_scanner/scanners/` | WIA, TWAIN and simulated backends |
| `talking_scanner/ocr.py` | Tesseract with automatic page rotation |
| `talking_scanner/speech/` | SAPI 5 (Windows) and development speakers |
| `talking_scanner/storage.py` | Session, consent-based saving, privacy rules |
| `talking_scanner/ui_wx.py` | The window: native controls and keyboard input |
| `talking_scanner/diagnostics.py` | `--diagnose` compatibility report |
| `talking_scanner/screenreaders.py` | Detects JAWS, Narrator and NVDA; the JAWS number pad tip |
| `talking_scanner/selftest.py` | `--self-test` and `--practice` sample pages |
| `installer/` | Inno Setup script, build script, installer test, user guide, release notes |
