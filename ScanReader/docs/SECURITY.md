# Security

The goal is to keep the risk low for a computer that will never be online,
in a house that also has Windows XP computers. No process removes all risk,
and that includes antivirus scanning. This document explains what reduces
the risk and what risk remains.

## What the program does and does not do

| | |
|---|---|
| Network | **None.** The source has no networking code. An automated test (`Source audit`) fails if networking, process-launching, registry, or extra native APIs are added. |
| Telemetry, updates | None. The program never checks for updates. |
| Administrator rights | Never. The manifest says `asInvoker`, and it installs per user. |
| Registry | Not written by the program or the installer. |
| Services / background tasks | None. When the window closes, the program is gone. The optional auto-start is an ordinary shortcut in the user's Startup folder. |
| Security settings | Nothing is disabled or changed. |
| Code loaded at run time | None. No plug-ins, no scripts, no downloads. |
| Files written | Only `Documents\Scanned Pages\…`, `%LOCALAPPDATA%\ScanReader\…`, and `Documents\Scan Reader check.txt` when `--check` is run. |
| Global keyboard hook | It registers only **F5**, through the standard `RegisterHotKey` call, so F5 can bring the window back. It does not log keystrokes. It releases F5 on exit. You can turn this off with `"F5WorksFromAnyWindow": false` in settings.json. |

Windows APIs the program calls directly (`DllImport`): only `user32.dll`'s
`RegisterHotKey`, `UnregisterHotKey` and `SetForegroundWindow`.

## Dependencies and where they come from

| Dependency | Used for | Origin | In the .exe? |
|---|---|---|---|
| .NET 10 runtime + Windows Desktop runtime | Runs the program and the window | Microsoft, NuGet runtime packs downloaded by the SDK on the build PC | Yes (self-contained) |
| `Microsoft.Windows.SDK.NET` (CsWinRT projection) + `WinRT.Runtime` | Calling `Windows.Media.Ocr` | Microsoft, NuGet package `Microsoft.Windows.SDK.NET.Ref` | Yes |
| `System.Speech` 10.0.0 | Using the SAPI voices | Microsoft, NuGet; source in the dotnet/runtime repository | Yes |
| WIA Automation (`wiaaut.dll`) and the WIA service | Scanning | Part of Windows | No, it is already on the PC |
| OCR engine and language data | Text recognition | Part of Windows | No |
| SAPI 5 voices (David, Zira…) | Speech | Part of Windows | No |
| Canon LiDE 300 WIA driver | Scanner | Canon, already installed | No |

There are no third-party packages. The test project uses no packages.
The prototype and the install scripts use only what ships with Windows.

## Build-computer hygiene

1. Use a Windows 10/11 PC that is up to date, with Microsoft Defender on.
2. Get the .NET SDK only from Microsoft, and check its signature. See [BUILD.md](BUILD.md).
3. Optional: read the source in `src/`. It is short.
4. Build with `Build-ScanReader.ps1`. It refuses to package the program if any test fails.

## Scanning with Microsoft Defender before transfer

Do this on the **build computer**. Use an elevated PowerShell if your
organisation requires it.

```powershell
# 1. Get the newest Defender definitions
Update-MpSignature

# 2. Scan the transfer folder
Start-MpScan -ScanType CustomScan -ScanPath "C:\path\to\ScanReader\transfer"

# 3. Look at the results (empty output = nothing found)
Get-MpThreatDetection | Sort-Object InitialDetectionTime -Descending | Select-Object -First 5
```

The same steps from Command Prompt:

```
"%ProgramFiles%\Windows Defender\MpCmdRun.exe" -SignatureUpdate
"%ProgramFiles%\Windows Defender\MpCmdRun.exe" -Scan -ScanType 3 -File "C:\path\to\ScanReader\transfer"
```

You can also use the mouse: right-click the folder → **Scan with Microsoft Defender**.

## Preparing the USB drive

1. Use a USB drive that **has never been plugged into the Windows XP computers**.
   Don't plug it into them later either.
2. On the build computer, **format** it. In File Explorer, right-click the
   drive → Format → NTFS or exFAT, Quick Format off if time allows. This
   removes anything already on it.
3. Copy only the `transfer` folder onto it.
4. Scan the **whole USB drive** with Defender:
   ```powershell
   Start-MpScan -ScanType CustomScan -ScanPath "E:\"   # use your USB drive letter
   Get-MpThreatDetection
   ```
5. If the drive has a write-protect switch, turn it on before you remove the drive.
6. Eject the drive safely.

Windows 10/11 does not AutoRun programs from USB drives. Nothing runs when
the drive is plugged in.

## On the reader's computer (only when you are ready to install)

1. Plug in the USB drive. Don't open any file you don't recognise.
2. Before running anything, check the checksum:
   ```powershell
   Get-FileHash E:\transfer\ScanReader\ScanReader.exe -Algorithm SHA256
   ```
   It must match the value you wrote down on the build computer. The installer
   also compares it with `SHA256SUMS.txt`. Your written or photographed copy
   matters because it doesn't travel on the same USB drive.
3. Optional: right-click the USB drive → **Scan with Microsoft Defender**.
   Defender on an offline PC has **old definitions**. To update them offline,
   download Microsoft's definition package `mpam-fe.exe` (from Microsoft's
   Defender updates page) on the build PC, check its signature with
   `Get-AuthenticodeSignature`, and run it on the target.
4. Install with `Install-ScanReader.ps1`. See [INSTALL.md](INSTALL.md).

## Things to check on the target before installing

These are read-only. Look at them in Settings without running anything.
- **Windows S mode** (Settings → System → Activation): S mode cannot run any
  program that does not come from the Store, including this one. Leaving S
  mode is a one-way change. That decision belongs to the computer's owner.
- **Smart App Control** (Windows Security → App & browser control): if it is
  **On**, it may block unsigned programs, including this one. Turning it off
  can't be reversed without reinstalling Windows, so don't turn it off
  casually. If it is On, consider code-signing the program. This document
  does not recommend weakening the protection.
- **Controlled folder access** (Windows Security → Virus & threat protection
  → Ransomware protection): if it is on, Windows may block saving to
  Documents. You would need to allow ScanReader.exe as a trusted app, or set
  `DocumentsFolder` in settings.json to a folder it may write to.

## Remaining risks (honest list)

- **Unsigned program.** The .exe is not code-signed. The checksum shows the
  file is the one you built. It does not prove who wrote the code. That is
  why you build it yourself from source you can read.
- **Build-computer compromise.** If the build PC is infected, the program
  built on it could be too. Antivirus lowers this risk but does not remove it.
- **Supply chain.** The Microsoft packages come from nuget.org over HTTPS and
  are Microsoft-signed. You are still trusting Microsoft and nuget.org.
- **No security updates.** An offline PC, and the .NET runtime inside the
  .exe, never get security fixes. This program doesn't open files from
  outside, network data, or documents from others. It only reads images it
  has just scanned. That keeps exposure low.
- **The USB drive itself** is the main way malware could reach the offline PC.
  Format it, scan it, and use it only for this transfer.
- **The XP computers** are unsupported and vulnerable. Keep them off any
  network and away from the USB drive.
