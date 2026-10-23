# Testing

## A. Tests actually performed (by Claude Code, on Linux, 2026-10-23)

| Test | Result |
|---|---|
| `ScanReader.Core` builds with warnings treated as errors (.NET SDK 10.0.113) | ✅ Passed |
| `ScanReader.App` **compiles** against the real Windows Desktop and Windows SDK reference assemblies (`Microsoft.Windows.SDK.NET.Ref` 10.0.19041.57), with warnings as errors | ✅ Passed |
| Self-contained single-file `dotnet publish -r win-x64` produces `ScanReader.exe` | ✅ Passed (not run, because Windows was not available) |
| OCR API requirements read from SDK metadata: `OcrEngine` requires Windows 10.0.10240 and UniversalApiContract v1; `RecognizeAsync(SoftwareBitmap)`, `MaxImageDimension`, `TryCreateFromUserProfileLanguages`, `AvailableRecognizerLanguages` exist | ✅ Verified |
| **56 automated tests** (`dotnet run --project tests/ScanReader.Tests`) | ✅ 56 passed, 0 failed |

The automated tests use stand-ins for the scanner, OCR and voice. They check:
- **Scanner disconnection:** unplugged at start, not found on F5, lost during
  the scan, timeout, busy, unexpected driver errors. Each one has its own
  spoken message, and the reader keeps working afterwards.
- **Blank pages:** a blank-image detector, plus the "page looks blank" message
  when nothing is added.
- **Unreadable text:** a text-quality scorer, a "picture/face up" message, and
  a "poor quality" warning before reading partial text.
- **Missing OCR components:** the message at start-up and on scan.
- **Missing voices:** the reader still runs, and messages are logged and shown on screen.
- **Restarting the application:** the position is resumed after a clean
  close and after a power cut. A deleted document folder and an out-of-range
  saved position are both handled.
- **All keys:** play/pause keeps the word, word/line/page moves and their
  limits, speed limits, Ctrl+N confirmation, help, and the "please wait"
  answer while busy.
- **Saving:** the per-page files and `All pages.txt`. A failed save still reads the page.
- **Source audit:** no networking, process launching, registry, or extra
  native calls. The only NuGet package is System.Speech.

Two real bugs were found by these tests and fixed: short pages were flagged
"poor quality", and a moved position could be lost in a power cut.

## B. Tests that STILL NEED TO BE RUN (on a Windows test computer)

**None of the following has been done yet.** Nothing has run on Windows. No
scanner was used, and no audio was heard.
Run the automated tests on Windows too: `dotnet run --project tests\ScanReader.Tests`.

Use a test computer, **not** the reader's. Ideally that's Windows 11 with
the LiDE 300 plugged in. If the scanner can't be moved there, steps B1–B3
and B6–B9 can be done in simulation mode.

### B0. Prototype (optional, no compiling)
`powershell -NoProfile -ExecutionPolicy Bypass -File prototype\Scan-Ocr-Speak.ps1`
- [ ] The scan happens with **no dialog**, and the whole page is captured, not just a corner.
- [ ] You hear "Scanning", "Recognizing text", "Reading", then the text.
- [ ] Without a scanner: `-ImagePath "test-images\01 clear letter.png"` reads the letter.

### B1. Start-up check
`publish\win-x64\ScanReader.exe --check`
- [ ] It lists the LiDE 300 as a scanner (type 1). With no scanner, it says so.
- [ ] It lists an OCR language (e.g. en-US).
- [ ] It lists at least one enabled voice (e.g. Microsoft Zira Desktop).

### B2. Simulation run (no scanner needed)
`ScanReader.exe --simulate-scanner "<full path>\test-images"`
- [ ] At start it says "Scanner reader is ready… press F5", with no mouse or screen reader needed.
- [ ] F5 → "Scanning." → "Recognizing text." → "Page 1. Reading." → the letter is read correctly.
- [ ] F5 again → the upside-down page is read **the right way up**.
- [ ] F5 → blank page → "The page looks blank…", and no page is added.
- [ ] F5 → picture → "I could not find any text…"
- [ ] F5 → faint small text → it is read, possibly with the partial-read warning.
- [ ] F5 → sideways page → read correctly.
- [ ] F5 ×4 → the not-found, lost-contact, not-responding and busy messages are all spoken.

### B3. Keys (in either mode)
- [ ] Space pauses ("Paused."). Space again resumes at the **same word**.
- [ ] Left/Right speak single words. Up/Down speak whole lines. Limits are announced.
- [ ] Page Up/Down announce "Page X of Y" and read it.
- [ ] Escape goes silent at once.
- [ ] Minus/Plus change the speed audibly, and the speed is remembered after a restart.
- [ ] Ctrl+N once asks for confirmation. Twice starts a new document.
- [ ] F1 speaks the help.
- [ ] Holding F5 down does not start several scans.
- [ ] Click another window, then press F5 → the reader comes back to the front and says it is ready.
- [ ] Starting the program a second time doesn't open a second copy; the first copy speaks.
- [ ] Text in `Documents\Scanned Pages\<date>\` matches what was read.

### B4. Real scanner (Canon LiDE 300)
- [ ] F5 scans with **no dialog**, the scanner light moves, and the page is read.
- [ ] Scan time at 300 dpi is acceptable (expected 10–20 s). Write it down: ____ s
- [ ] The saved PNG shows the **whole** page, not a cropped part.
- [ ] Multiple pages in a row: page numbers count up, and reading continues across pages.
- [ ] A book page pressed flat: the text near the spine is acceptable.
- [ ] A page placed face up gives a sensible spoken message.

### B5. Scanner disconnection (real hardware)
- [ ] Unplug the scanner, then start the program → "I cannot find the scanner at the moment…"
- [ ] Unplug, then press F5 → spoken "cannot find the scanner" message, and no crash.
- [ ] Pull the cable **during** a scan → a spoken lost-contact or not-responding message,
      within the timeout (120 s by default). Then plug it back in → F5 works again,
      or does after a restart of the program. Note which: ______
- [ ] Turn off the Windows Image Acquisition service (on the TEST PC only, then
      turn it back on) → spoken "scanning service is not working" message.

### B6. Blank / unreadable pages (real scanner)
- [ ] Empty glass, lid closed → blank-page message.
- [ ] Empty glass, lid open → a sensible message (blank or no text).
- [ ] A handwritten note → no-text or partial-read message.
- [ ] A photograph → no-text message.
- [ ] A coloured or glossy leaflet → read acceptably.

### B7. Missing OCR components
- [ ] On a test PC where you can safely remove it (Settings → Time & language →
      Language → English → Language options → Optical character recognition
      → Remove): start-up says text recognition is not installed, F5 says the
      same, and the screen shows a red warning. Reinstall it afterwards.
- [ ] Or set `"OcrLanguage": "xx-XX"` in settings.json. The program should fall back to an installed language.

### B8. Missing voices
- [ ] Hard to remove the built-in voices safely. Instead, confirm that the red
      "NO VOICE" banner logic works by reading the log, or test on a PC or VM
      with no SAPI voices. If no voice is available, the program plays the
      Windows "exclamation" sound for each message.
- [ ] No sound device / muted: note what happens. Expected: silence, no crash.

### B9. Restarting
- [ ] Read to the middle of page 2, then press Alt+F4 → "Goodbye". Restart →
      "You have 2 pages… page 2", and Space resumes mid-page.
- [ ] Use End task in Task Manager while it is reading (this simulates a power
      cut). Restart → it resumes within a few words.
- [ ] Restart the computer → with `-StartWithWindows`, the reader starts and speaks after sign-in.
- [ ] Delete the document folder, then restart → it starts fresh without errors.

### B10. Long use
- [ ] 30 pages in a row: no slowdown, memory stays reasonable in Task Manager (< 500 MB).
- [ ] Leave it open overnight, then scan → it still works.

### B11. With the reader herself (only after B0–B10 pass, on her computer)
- [ ] She can start it, scan, pause, resume and move by line **without help**.
- [ ] The voice speed and wording are comfortable. Adjust settings or `Messages.cs` if needed.
- [ ] Narrator is **off**. If Narrator is on, it also speaks and may take the arrow keys.

Record results and the contents of `%LOCALAPPDATA%\ScanReader\log.txt` for any failure.
