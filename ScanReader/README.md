# Scan Reader

An offline, one-key scan-and-read program for Windows 11, built for a blind
reader using a Canon CanoScan LiDE 300.

**Put a page face down on the scanner glass, close the lid, and press F5.**
The program says "Scanning", "Recognizing text", "Page 1. Reading", then reads
the page aloud. Every page is saved as a text file automatically.

> **Status:** source is complete. The logic is covered by automated tests, and
> the Windows program compiles against the real Windows SDK. **It has not yet
> been run on Windows, with a scanner, or with real speech.** Do that on a
> separate test computer first ([docs/TESTING.md](docs/TESTING.md)). Do not
> install it on the reader's computer until those tests pass.

## Keys

| Key | What it does |
|---|---|
| **F5** (or **Enter**) | Scan a page, recognize it, and start reading it |
| **Space** | Play / pause (remembers the exact word) |
| **Left / Right arrow** | Previous / next word (speaks the word) |
| **Up / Down arrow** | Previous / next line (speaks the line) |
| **Page Up / Page Down** | Previous / next page (announces it and reads it) |
| **Escape** | Stop speaking (position is kept) |
| **Minus / Plus** | Slower / faster voice (remembered) |
| **Ctrl+N**, twice | Start a new document (old pages stay saved) |
| **F1** | Spoken help, including the current page |

Other details:
- When a page ends, reading continues onto the next page. After the last page
  it says so and tells her to press F5 for another page.
- Navigation keys stop reading and speak just that word or line; Space then
  continues from there.
- While a scan is in progress, other keys answer "Please wait". Every 20
  seconds it says "Still working".
- Letter keys answer "That key does nothing. Press F1 for help."
- If another window takes the keyboard, pressing F5 brings the reader back
  to the front. You can turn this off in settings.json.
- **Laptop F-keys:** many laptops need **Fn** for F5. **Enter** also scans, or
  turn on Fn-lock (often Fn+Esc).

## How it works

```
 F5 ──► WIA (Windows Image Acquisition) ──► PNG ──► Windows.Media.Ocr ──► text
          scans with no dialog                      offline OCR engine       │
                                                                             ▼
        Documents\Scanned Pages\<date>\Page 001.txt  ◄── saved     SAPI 5 voice (System.Speech)
```

| Part | Technology | Origin |
|---|---|---|
| Scanning | WIA 2.0 Automation (`WIA.DeviceManager`, `Item.Transfer`) via COM | Built into Windows |
| OCR | `Windows.Media.Ocr.OcrEngine` | Built into Windows 10/11 (needs an OCR language pack, normally preinstalled with the display language) |
| Speech | SAPI 5 voices through `System.Speech` | Voices built into Windows; library from Microsoft (NuGet) |
| Window | Windows Forms on .NET 10 | Microsoft, bundled in the .exe |

Why this design:
- **C# / .NET**, not PowerShell, for the full program. It handles keys
  reliably, runs work in the background, and speech can report each word as
  it is spoken. That is how word-by-word position is remembered.
  PowerShell is used only for the [prototype](prototype/Scan-Ocr-Speak.ps1)
  and the install scripts.
- **No scanner dialog:** the first test used `WIA.CommonDialog.ShowAcquireImage`,
  which always shows a dialog. This program connects to the device and calls
  `Item.Transfer` directly. It scans at 300 dpi grayscale over the whole glass.
- **Snipping Tool is not used.** Its OCR cannot be called from other programs.
  `Windows.Media.Ocr` is the documented OCR API built into Windows.
- **Upside-down or sideways pages:** if the result looks like noise, the
  program also tries the page at 180°, 90° and 270° and keeps the best result.

### OCR requirements (verified against the Windows SDK metadata)
`OcrEngine` is marked `SupportedOSPlatform("Windows10.0.10240.0")` and
`UniversalApiContract` v1, so any Windows 10 or 11 version qualifies. It can
be used from a normal desktop program. No Store packaging is needed.
It recognizes only languages whose **Optical character recognition** feature
is installed. To check, run `ScanReader.exe --check` on the test computer.
If the feature is missing, adding it normally needs Windows Update, which an
offline computer cannot reach. Check this before relying on the reader.

## Project layout

```
prototype/Scan-Ocr-Speak.ps1   Stage 1: scan one page, OCR, speak (no compiling needed)
src/ScanReader.Core/           All logic: keys, reading position, pages, saving, messages (testable anywhere)
src/ScanReader.App/            Windows parts: WIA scanner, Windows OCR, SAPI speech, window
tests/ScanReader.Tests/        56 automated tests, no test framework needed
test-images/                   Sample pages for testing without a scanner
build/Build-ScanReader.ps1     Test, publish, checksum and Defender-scan on the build PC
install/                       Per-user install / uninstall scripts (no admin)
docs/                          BUILD, SECURITY, INSTALL, TESTING, QUICK-CARD
```

All spoken sentences are in [`Messages.cs`](src/ScanReader.Core/Messages.cs),
so the wording can be reviewed in one place.

## Files the program uses

| Path | Contents |
|---|---|
| `Documents\Scanned Pages\<date time>\Page 001.txt`, `Page 001.png`, `All pages.txt` | Scanned documents |
| `%LOCALAPPDATA%\ScanReader\settings.json` | Options a helper can edit (dpi, voice, OCR language, speed…) |
| `%LOCALAPPDATA%\ScanReader\state.json` | Current document, page, word, speed. Used to resume after a restart |
| `%LOCALAPPDATA%\ScanReader\log.txt` | Log for troubleshooting (kept under about 1 MB, never sent anywhere) |

## Command-line options (for the helper)

- `ScanReader.exe --check`: read-only report of scanners, OCR languages and voices
- `ScanReader.exe --simulate-scanner "C:\path\test-images"`: each F5 uses the
  next image from that folder instead of the scanner. Files named `fail-<Kind>`
  simulate scanner errors.

## Documents

- [docs/BUILD.md](docs/BUILD.md): building on an internet-connected Windows PC
- [docs/SECURITY.md](docs/SECURITY.md): dependencies, threat model, Defender scanning, USB transfer
- [docs/TESTING.md](docs/TESTING.md): what has been tested and what still must be
- [docs/INSTALL.md](docs/INSTALL.md): safe installation on the reader's computer (later)
- [docs/QUICK-CARD.md](docs/QUICK-CARD.md): instructions to read to her
