@echo off
rem Builds dist\TalkingScanner\TalkingScanner.exe with PyInstaller.
rem If Tesseract is installed, a copy is placed next to the exe so the
rem folder can be copied to another PC that has no Python or Tesseract.
setlocal
cd /d "%~dp0"
if not exist ".venv\Scripts\python.exe" (
  echo Run install.bat first.
  exit /b 1
)
".venv\Scripts\python.exe" -m pip install -r requirements-dev.txt || exit /b 1
".venv\Scripts\python.exe" -m PyInstaller --noconfirm --clean --windowed --name TalkingScanner ^
  --hidden-import win32timezone launcher.py || exit /b 1
if exist "%ProgramFiles%\Tesseract-OCR\tesseract.exe" (
  robocopy "%ProgramFiles%\Tesseract-OCR" "dist\TalkingScanner\tesseract" /E /NFL /NDL /NJH /NJS >nul
)
copy /y README.md dist\TalkingScanner\ >nul
echo Built dist\TalkingScanner\TalkingScanner.exe
