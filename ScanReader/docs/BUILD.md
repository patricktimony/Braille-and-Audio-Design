# Building Scan Reader

Build on a **separate, internet-connected Windows 10 or 11 computer**: the
*build computer*. You can't build or test the program on an iPhone. Don't
build on the reader's computer.

## 1. Install the .NET 10 SDK (build computer only)

1. Download the **.NET 10 SDK** installer (x64) from Microsoft:
   <https://dotnet.microsoft.com/download/dotnet/10.0>.
   Alternatively, in a terminal, run: `winget install Microsoft.DotNet.SDK.10`
2. Before running the installer, check that Microsoft signed it. In PowerShell:
   ```powershell
   Get-AuthenticodeSignature .\dotnet-sdk-10.*-win-x64.exe | Format-List Status, SignerCertificate
   ```
   `Status` must be `Valid` and the signer must be `Microsoft Corporation`.
3. Install it, then open a new PowerShell window and run `dotnet --version`.
   It should start with `10.`.
4. Optional: turn off the SDK's usage telemetry for your account:
   `setx DOTNET_CLI_TELEMETRY_OPTOUT 1`. The build script also turns it off
   for its own run. This only affects the build computer. The finished
   program contains no telemetry.

No Visual Studio is needed.

## 2. Get the source

Download this repository as a ZIP from GitHub (Code → Download ZIP) and
unzip it. You can also use `git clone`. Open PowerShell in the `ScanReader` folder.

Optional: read the source first. Everything that runs is in `src/`. It is
about 2,200 lines of C#, including comments.

## 3. Find out which processor the reader's laptop has

On the reader's laptop: **Settings → System → About → System type**.
- "x64-based processor" → use `-Runtime win-x64` (most laptops)
- "ARM-based processor" → use `-Runtime win-arm64`

You can read this setting without running anything.

## 4. Build, test and package

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\build\Build-ScanReader.ps1 -Runtime win-x64 -DefenderScan
```

The script:
1. Runs the 56 automated tests. It stops if any fail.
2. Publishes a self-contained `ScanReader.exe`, about 130 MB. It includes the
   .NET runtime, so the target computer needs nothing installed and downloads
   nothing.
3. Creates a `transfer\` folder containing:
   ```
   ScanReader\ScanReader.exe
   Install-ScanReader.ps1, Uninstall-ScanReader.ps1
   INSTALL.md, QUICK-CARD.md
   test-images\
   SHA256SUMS.txt
   ```
4. With `-DefenderScan`, updates Defender and scans the transfer folder. See
   [SECURITY.md](SECURITY.md).

It prints the **SHA-256 checksum of ScanReader.exe**. Write it down or
photograph it. You'll compare it on the target computer.

`-ExecutionPolicy Bypass` affects only that one PowerShell process. It does
not change any computer setting.

### Packages downloaded during the build

These come from nuget.org, and all are published and signed by Microsoft:
- `Microsoft.NETCore.App.Runtime.win-x64` and `Microsoft.WindowsDesktop.App.Runtime.win-x64`: the .NET runtime bundled into the .exe
- `Microsoft.Windows.SDK.NET.Ref`: the C# view of Windows APIs, used to reach the OCR engine
- `System.Speech`: the .NET wrapper around Windows' SAPI voices

To confirm the signatures:
```powershell
dotnet nuget verify --all "$env:USERPROFILE\.nuget\packages\system.speech\10.0.0\*.nupkg"
```

### Doing it by hand

```powershell
$env:DOTNET_CLI_TELEMETRY_OPTOUT = 1
dotnet run --project tests\ScanReader.Tests -c Release
dotnet publish src\ScanReader.App -c Release -r win-x64 --self-contained true -p:PublishSingleFile=true -p:DebugType=none -o publish\win-x64
```

## 5. Test on the build computer (or another test computer)

Follow [TESTING.md](TESTING.md) before transferring anything.

## Troubleshooting the build

- *"NETSDK1045: The current .NET SDK does not support targeting .NET 10"*: install the .NET 10 SDK.
- To use .NET 8 instead, change `net10.0` to `net8.0` in the three
  `.csproj` files and change `System.Speech` to version `8.0.0`.
  Note that .NET 8 support ends in November 2026.
