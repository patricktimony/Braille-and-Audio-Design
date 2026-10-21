@echo off
rem Builds dist\TalkingScanner\TalkingScanner.exe and the installer
rem dist\TalkingScannerSetup.exe (Tesseract OCR bundled).
rem Needs install.bat run first, and Inno Setup 6 (winget install JRSoftware.InnoSetup).
setlocal
cd /d "%~dp0"
if not exist ".venv\Scripts\python.exe" (
  echo Run install.bat first.
  exit /b 1
)
".venv\Scripts\python.exe" -m pip install -r requirements-dev.txt || exit /b 1
powershell -NoProfile -ExecutionPolicy Bypass -File installer\build_windows.ps1 || exit /b 1
