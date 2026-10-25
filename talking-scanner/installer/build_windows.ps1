# Builds the Windows program and its installer:
#   dist\TalkingScanner\TalkingScanner.exe   the program, with Tesseract OCR bundled
#   dist\TalkingScannerSetup.exe             the single-file installer
#
# Needs Python with requirements.txt and requirements-dev.txt installed,
# Tesseract OCR (UB Mannheim build) and Inno Setup 6.  Run from anywhere:
#   powershell -ExecutionPolicy Bypass -File installer\build_windows.ps1
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

$python = if ($env:PYTHON) { $env:PYTHON } elseif (Test-Path ".venv\Scripts\python.exe") { ".venv\Scripts\python.exe" } else { "python" }
$version = (& $python -c "import talking_scanner; print(talking_scanner.__version__)").Trim()
Write-Host "Building Talking Scanner $version"

& $python -m PyInstaller --noconfirm --clean --windowed --name TalkingScanner `
    --hidden-import win32timezone launcher.py
if ($LASTEXITCODE -ne 0) { throw "PyInstaller failed" }
$dist = "dist\TalkingScanner"

$tesseract = @($env:TESSERACT_DIR, "$env:ProgramFiles\Tesseract-OCR", "$env:LOCALAPPDATA\Programs\Tesseract-OCR") |
    Where-Object { $_ -and (Test-Path (Join-Path $_ "tesseract.exe")) } | Select-Object -First 1
if (-not $tesseract) { throw "Tesseract OCR not found; install it first (winget install UB-Mannheim.TesseractOCR)" }
robocopy $tesseract "$dist\tesseract" /E /XF "tesseract-uninstall.exe" /NFL /NDL /NJH /NJS | Out-Null
if ($LASTEXITCODE -gt 7) { throw "copying Tesseract failed" }
$global:LASTEXITCODE = 0

New-Item -ItemType Directory -Force "$dist\samples" | Out-Null
Copy-Item samples\*.png "$dist\samples\"
Copy-Item installer\USER-GUIDE.txt, README.md "$dist\"

$iscc = @($env:ISCC, "${env:ProgramFiles(x86)}\Inno Setup 6\ISCC.exe", "$env:ProgramFiles\Inno Setup 6\ISCC.exe",
          "$env:LOCALAPPDATA\Programs\Inno Setup 6\ISCC.exe") |
    Where-Object { $_ -and (Test-Path $_) } | Select-Object -First 1
if (-not $iscc) { throw "Inno Setup 6 not found; install it first (winget install JRSoftware.InnoSetup)" }
& $iscc /Qp "/DAppVersion=$version" "/DSourceDir=$root\$dist" installer\TalkingScanner.iss
if ($LASTEXITCODE -ne 0) { throw "Inno Setup failed" }
Write-Host "Built $root\dist\TalkingScannerSetup.exe"
