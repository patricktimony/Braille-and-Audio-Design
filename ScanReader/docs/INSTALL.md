# Installing Scan Reader on the reader's computer

> **Not yet.** Only do this after every test in [TESTING.md](TESTING.md)
> part B has passed on a separate test computer, and after the USB drive has
> been prepared as described in [SECURITY.md](SECURITY.md).

No administrator rights are needed. Nothing is downloaded. No settings,
registry entries or security protections are changed.

## Before you start

- [ ] You have the SHA-256 checksum of `ScanReader.exe`, written down or
      photographed on the build computer.
- [ ] The scanner is plugged in and has already worked with Windows. It did
      during your earlier PowerShell test.
- [ ] Settings → System → About: the processor type matches the build (x64 or ARM64).
- [ ] Windows is not in S mode, and you have checked Smart App Control. See SECURITY.md.

## Steps

1. Sign in as **her** user account. The program installs for one user only.
2. Plug in the USB drive. Open it in File Explorer.
3. Check the checksum. Open PowerShell from the Start menu and type the
   following, with your USB drive letter:
   ```powershell
   Get-FileHash E:\transfer\ScanReader\ScanReader.exe -Algorithm SHA256
   ```
   Compare it **character by character** with your written copy. If it
   differs, stop and do not install.
4. Install, with automatic start after sign-in:
   ```powershell
   powershell -NoProfile -ExecutionPolicy Bypass -File E:\transfer\Install-ScanReader.ps1 -StartWithWindows
   ```
   This copies the program to `%LOCALAPPDATA%\Programs\ScanReader` and creates
   a **Scan Reader** shortcut on the Desktop and in the Start menu. The shortcut
   key is **Ctrl+Alt+S**. With `-StartWithWindows`, the reader also opens by
   itself after she signs in.

   **Manual alternative (no script):**
   - Create the folder `%LOCALAPPDATA%\Programs\ScanReader` and copy `ScanReader.exe` into it.
   - Right-click `ScanReader.exe` → Show more options → Send to → Desktop (create shortcut).
   - Rename the shortcut "Scan Reader". In Properties → Shortcut key, press Ctrl+Alt+S.
     Set Run: Maximized.
   - To start it automatically, press Win+R, type `shell:startup`, and copy the shortcut there.
5. Run the read-only check: open the Scan Reader folder and run
   `ScanReader.exe --check`. Confirm that it finds the scanner, an OCR
   language and a voice.
6. Start Scan Reader. Do one full test with a real letter, including Space,
   the arrow keys and Page Up/Down.
7. Eject the USB drive. **Do not plug it into the XP computers.**

## Make the laptop easier for her

All of these are optional ordinary user settings. They are not security changes.
- **Fn lock:** if F5 needs the Fn key, turn on Fn lock. It is often Fn+Esc;
  see the laptop manual. Alternatively, teach her **Enter**, which also scans.
- **Narrator off:** Settings → Accessibility → Narrator. Scan Reader speaks for
  itself. Narrator would talk over it and may take the arrow keys.
- **Volume:** set it high. Consider external speakers.
- **Sleep:** Settings → System → Power: a longer screen or sleep timeout, so
  the laptop doesn't sleep while she places the next page.
- **Tactile markers:** stick small bump dots on F5 (or Enter), Space and Escape.
- **Voice speed:** she can use Minus and Plus herself. A helper can set the
  starting speed in `%LOCALAPPDATA%\ScanReader\settings.json` (`SpeechRate`,
  -10 to 10).

## settings.json reference

Open `%LOCALAPPDATA%\ScanReader\settings.json` with Notepad. Close Scan Reader first.

| Setting | Default | Meaning |
|---|---|---|
| `ScanDpi` | 300 | Resolution. Use 400 for very small print. Higher is slower. |
| `ScanInColor` | false | Grayscale is faster and usually better for text. |
| `VoiceName` | "" | e.g. `"Microsoft Zira Desktop"`. Empty = automatic. |
| `OcrLanguage` | "" | e.g. `"en-US"` or `"en-GB"`. Empty = the Windows language. |
| `SpeechRate` | -1 | Starting speed, -10 to 10. Later changes with Minus/Plus are remembered separately. |
| `ScanTimeoutSeconds` | 120 | How long to wait for the scanner before saying it is not responding. |
| `StillWorkingSeconds` | 20 | How often to say "Still working" during a scan. |
| `DocumentsFolder` | "" | Empty = Documents\Scanned Pages. |
| `KeepImages` | true | Keep the PNG of each page next to its text. |
| `F5WorksFromAnyWindow` | true | F5 brings the reader to the front from any window. |
| `AlwaysOnTop` | false | Keep the reader window above all others. |

## Uninstalling

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File E:\transfer\Uninstall-ScanReader.ps1
```
This removes the program and its shortcuts. Scanned documents are kept.
