<#
.SYNOPSIS
    Installs Scan Reader for the current Windows user. No administrator rights.

.DESCRIPTION
    What it does (and nothing else):
      * checks ScanReader.exe against SHA256SUMS.txt (stops if it does not match)
      * copies ScanReader.exe to %LOCALAPPDATA%\Programs\ScanReader
      * creates a "Scan Reader" shortcut on the Desktop and in the Start menu,
        with the keyboard shortcut Ctrl+Alt+S
      * with -StartWithWindows: also a shortcut in the user's Startup folder,
        so the reader opens by itself after signing in
    It does not change the registry, services, firewall, security settings or
    the PowerShell execution policy, and it downloads nothing.

    Run from the USB/transfer folder:
        powershell -NoProfile -ExecutionPolicy Bypass -File .\Install-ScanReader.ps1 -StartWithWindows
#>
[CmdletBinding()]
param([switch]$StartWithWindows)

$ErrorActionPreference = 'Stop'
$source = Join-Path $PSScriptRoot 'ScanReader\ScanReader.exe'
if (-not (Test-Path $source)) { throw "Cannot find $source" }

# 1. Integrity check
$sumsFile = Join-Path $PSScriptRoot 'SHA256SUMS.txt'
if (-not (Test-Path $sumsFile)) { throw 'SHA256SUMS.txt is missing; refusing to install an unverified file.' }
$expected = (Get-Content $sumsFile | Where-Object { $_ -match 'ScanReader\\ScanReader\.exe$' }) -split '\s+' | Select-Object -First 1
$actual = (Get-FileHash $source -Algorithm SHA256).Hash
if ($expected -ne $actual) { throw "Checksum mismatch!`n expected $expected`n actual   $actual`nDo not install." }
Write-Host "Checksum OK: $actual" -ForegroundColor Green

# 2. Copy
$target = Join-Path $env:LOCALAPPDATA 'Programs\ScanReader'
New-Item -ItemType Directory -Path $target -Force | Out-Null
Copy-Item $source $target -Force
$exe = Join-Path $target 'ScanReader.exe'
Write-Host "Copied to $exe"

# 3. Shortcuts (WScript.Shell is built into Windows)
$shell = New-Object -ComObject WScript.Shell
function New-Shortcut([string]$Path, [string]$Hotkey) {
    $s = $shell.CreateShortcut($Path)
    $s.TargetPath = $exe
    $s.WorkingDirectory = $target
    $s.Description = 'Scan a page and hear it read aloud. Press F5 to scan.'
    $s.WindowStyle = 3   # maximised
    if ($Hotkey) { $s.Hotkey = $Hotkey }
    $s.Save()
    Write-Host "Shortcut: $Path"
}
New-Shortcut (Join-Path ([Environment]::GetFolderPath('Desktop')) 'Scan Reader.lnk') 'CTRL+ALT+S'
New-Shortcut (Join-Path ([Environment]::GetFolderPath('Programs')) 'Scan Reader.lnk') ''
if ($StartWithWindows) {
    New-Shortcut (Join-Path ([Environment]::GetFolderPath('Startup')) 'Scan Reader.lnk') ''
}

Write-Host "`nInstalled. Start it with the desktop icon or Ctrl+Alt+S." -ForegroundColor Green
