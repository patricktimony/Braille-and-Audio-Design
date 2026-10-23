<#
.SYNOPSIS
    Builds, tests and packages Scan Reader on an internet-connected Windows BUILD computer.

.DESCRIPTION
    1. Runs the automated tests.
    2. Publishes a self-contained ScanReader.exe (includes the .NET runtime, so the
       target computer needs nothing installed and nothing downloaded).
    3. Assembles a "transfer" folder for the USB drive, with SHA-256 checksums.
    4. Optionally scans the transfer folder with Microsoft Defender.

    Run from the ScanReader folder:
        powershell -NoProfile -ExecutionPolicy Bypass -File .\build\Build-ScanReader.ps1 -Runtime win-x64 -DefenderScan

    -ExecutionPolicy Bypass affects only this one PowerShell process.

.PARAMETER Runtime
    win-x64 for ordinary Intel/AMD laptops, win-arm64 for ARM (e.g. Snapdragon) laptops.
    Check on the target: Settings > System > About > "System type".
#>
[CmdletBinding()]
param(
    [ValidateSet('win-x64', 'win-arm64')]
    [string]$Runtime = 'win-x64',
    [string]$OutputFolder = (Join-Path $PSScriptRoot '..\transfer'),
    [switch]$DefenderScan
)

$ErrorActionPreference = 'Stop'
$root = Resolve-Path (Join-Path $PSScriptRoot '..')

# The .NET command-line tools send usage telemetry unless told not to.
$env:DOTNET_CLI_TELEMETRY_OPTOUT = '1'
$env:DOTNET_NOLOGO = '1'

$sdk = (& dotnet --version) 2>$null
if (-not $sdk -or -not $sdk.StartsWith('10.')) {
    throw "The .NET 10 SDK is required (found: '$sdk'). See docs\BUILD.md."
}
Write-Host "Using .NET SDK $sdk" -ForegroundColor Cyan

Write-Host "`n== 1. Automated tests ==" -ForegroundColor Cyan
& dotnet run --project "$root\tests\ScanReader.Tests" -c Release
if ($LASTEXITCODE -ne 0) { throw 'Tests failed. Do not transfer this build.' }

Write-Host "`n== 2. Publish ($Runtime, self-contained) ==" -ForegroundColor Cyan
$publish = Join-Path $root "publish\$Runtime"
if (Test-Path $publish) { Remove-Item $publish -Recurse -Force }
& dotnet publish "$root\src\ScanReader.App" -c Release -r $Runtime --self-contained true `
    -p:PublishSingleFile=true -p:DebugType=none -o $publish
if ($LASTEXITCODE -ne 0) { throw 'Publish failed.' }

Write-Host "`n== 3. Transfer folder ==" -ForegroundColor Cyan
if (Test-Path $OutputFolder) { Remove-Item $OutputFolder -Recurse -Force }
$app = New-Item -ItemType Directory -Path (Join-Path $OutputFolder 'ScanReader')
Copy-Item (Join-Path $publish 'ScanReader.exe') $app
Copy-Item "$root\install\Install-ScanReader.ps1", "$root\install\Uninstall-ScanReader.ps1" $OutputFolder
Copy-Item "$root\docs\INSTALL.md", "$root\docs\QUICK-CARD.md" $OutputFolder
Copy-Item "$root\test-images" (Join-Path $OutputFolder 'test-images') -Recurse

$sums = Get-ChildItem $OutputFolder -Recurse -File |
    Sort-Object FullName |
    ForEach-Object {
        $rel = $_.FullName.Substring((Resolve-Path $OutputFolder).Path.Length + 1)
        "{0}  {1}" -f (Get-FileHash $_.FullName -Algorithm SHA256).Hash, $rel
    }
$sums | Set-Content (Join-Path $OutputFolder 'SHA256SUMS.txt') -Encoding UTF8
Write-Host ($sums -join "`n")

$exeHash = (Get-FileHash (Join-Path $app 'ScanReader.exe') -Algorithm SHA256).Hash
Write-Host "`nScanReader.exe SHA-256: $exeHash" -ForegroundColor Yellow
Write-Host 'Write this down or photograph it. Compare it on the target computer before running anything.'

if ($DefenderScan) {
    Write-Host "`n== 4. Microsoft Defender scan ==" -ForegroundColor Cyan
    Update-MpSignature -ErrorAction Continue
    $before = Get-Date
    Start-MpScan -ScanType CustomScan -ScanPath (Resolve-Path $OutputFolder).Path
    $found = Get-MpThreatDetection | Where-Object { $_.InitialDetectionTime -ge $before }
    if ($found) { $found | Format-List; throw 'Defender reported a detection. Do not transfer.' }
    Write-Host 'Defender found nothing. (This lowers risk; it does not prove the files are safe.)' -ForegroundColor Green
}

Write-Host "`nDone. Transfer folder: $((Resolve-Path $OutputFolder).Path)" -ForegroundColor Green
