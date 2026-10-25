## Download

**[Download Talking Scanner for Windows 11 (TalkingScannerSetup.exe)](https://github.com/patricktimony/Braille-and-Audio-Design/releases/latest/download/TalkingScannerSetup.exe)**

Version {VERSION}. One file, nothing else to install: Python, the text
recognition program and the Windows voices are all included or built in.

## Install

1. Open the downloaded file.
2. If Windows says "Windows protected your PC", press Tab to "More info" and press Enter,
   then press Tab to "Run anyway" and press Enter. This appears because the installer is new.
3. Press Enter to install, then press Enter to finish. Talking Scanner starts by itself.
   The installer speaks each step, so no screen reader is needed. If JAWS, NVDA or Narrator
   is running, the installer stays quiet and your screen reader reads it.

Start it again at any time with **Control + Alt + T**, or press the Windows key,
type *Talking Scanner* and press Enter. No administrator password is needed.

## Keys

Scan and read: Enter (or number pad Enter). Play or pause: Space (or 5).
Words: Left and Right arrows (or 4 and 6). Lines: Up and Down arrows (or 8 and 2).
Pages: Page Up and Page Down (or 7 and 9). Help: F1. Quit: Escape.

JAWS users: if you use the number pad keys, turn Num Lock on.

## Tested before this release

Automatically, on Windows Server 2025 (the same Windows code as Windows 11 24H2):
the installer was installed by pressing Enter only, its pages and the program
window were checked through UI Automation (what JAWS and Narrator read), every
key was tested with Num Lock on and off, text recognition was checked on the
sample pages, and the program was uninstalled cleanly.

**Not yet tested:** any physical scanner, use with JAWS or Narrator by a person,
and speech through real speakers. Please report how it works for you.
