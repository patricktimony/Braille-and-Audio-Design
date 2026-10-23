# Scan Reader (simple version)

Put a page face down on the scanner and press **F5**. The computer reads it aloud.

There is nothing to build or install. The folder holds just two files:

- `ScanReader.ps1`: the program, as plain text you can open in Notepad.
- `Start Scan Reader.cmd`: double-click this to start it.

It uses only what comes with Windows: the scanner system, the Windows text
recognition, and the Windows voices. It never goes on the internet.

---

## Step 1: Try it on another Windows computer first

Use your own Windows computer, **not hers**.

1. Copy this folder to the computer, for example to `C:\ScanReader`.
2. If you downloaded it from the internet, Windows may block it. Right-click
   each of the two files → **Properties** → tick **Unblock** → OK.
3. Double-click **Start Scan Reader.cmd**. You should hear
   "Scan reader is ready."
4. If a scanner is attached, put a letter on it and press **F5**.
   If there's no scanner, you can test with pictures instead. Open PowerShell and type:
   ```
   powershell -STA -ExecutionPolicy Bypass -File C:\ScanReader\ScanReader.ps1 -TestImagesFolder C:\ScanReader\test-pictures
   ```
   Put a photo or scan of a printed letter in that `test-pictures` folder first.
5. Try the keys: Space, the arrows, Page Up/Down, and Escape. Close the
   window, start it again, and check that it remembers where you were.

If anything goes wrong, look in `%LOCALAPPDATA%\ScanReader\log.txt`.

## Step 2: Copy it to her laptop

1. On your computer, right-click the USB stick → **Format**. Then copy only
   this folder onto it.
2. Right-click the USB stick → **Scan with Microsoft Defender**.
   This lowers the risk, but no virus scan can promise a file is safe.
3. **Never plug this USB stick into the old XP computers.**
4. On her laptop, copy the folder to `C:\ScanReader`.
5. Make it start by itself: press **Windows key + R**, type `shell:startup`,
   press Enter. Right-click **Start Scan Reader.cmd** → **Create shortcut**,
   and move that shortcut into the folder that opened.
6. Double-click **Start Scan Reader.cmd** once, and try a real letter with her.

Tips:
- Turn **Narrator off**. Scan Reader talks by itself.
- If F5 needs the **Fn** key on her laptop, she can press **Enter** instead.
- Put a small bump sticker on F5 or Enter, on Space, and on Escape.

## The keys (to read to her)

| Key | What it does |
|---|---|
| **F5** or **Enter** | Scan the page and read it |
| **Space** | Pause. Press again to carry on from the same word |
| **Left / Right arrow** | Word before / after |
| **Up / Down arrow** | Line before / after |
| **Page Up / Page Down** | Page before / after |
| **Escape** | Stop talking |
| **Minus / Plus** | Slower / faster voice |
| **Control + N**, twice | Start a new document. The old pages are kept |
| **F1** | Hear the list of keys |

Every page is saved automatically in **Documents → Scanned Pages**.

## Honest status

- **Checked:** the script's syntax, and its reading logic (moving by word,
  line and page; spotting nonsense text). All of these checks passed.
- **Not yet checked:** it hasn't been run on Windows, with the scanner, or
  with sound. Step 1 is that check. Please do it before giving it to her.
