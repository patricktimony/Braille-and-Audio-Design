@echo off
rem Talking Scanner installer: installs free software only.
rem Python and Tesseract come from winget (built into Windows 11).
rem Does NOT add anything to Windows startup.
setlocal
cd /d "%~dp0"

where py >nul 2>nul
if errorlevel 1 (
  echo Installing Python 3.12...
  winget install -e --id Python.Python.3.12 --scope user --accept-source-agreements --accept-package-agreements
  echo.
  echo Python installed. Close this window and run install.bat again.
  pause
  exit /b 0
)

if not exist "%ProgramFiles%\Tesseract-OCR\tesseract.exe" (
  echo Installing Tesseract OCR...
  winget install -e --id UB-Mannheim.TesseractOCR --accept-source-agreements --accept-package-agreements
)

if not exist ".venv\Scripts\python.exe" py -3 -m venv .venv || goto :error
".venv\Scripts\python.exe" -m pip install --upgrade pip || goto :error
".venv\Scripts\python.exe" -m pip install -r requirements.txt || goto :error

rem Start menu shortcut (not the Startup folder), so the patron can press
rem the Windows key, type "Talking Scanner" and press Enter.
powershell -NoProfile -Command ^
  "$s=(New-Object -ComObject WScript.Shell).CreateShortcut([Environment]::GetFolderPath('Programs')+'\Talking Scanner.lnk');" ^
  "$s.TargetPath='%~dp0.venv\Scripts\pythonw.exe'; $s.Arguments='-m talking_scanner';" ^
  "$s.WorkingDirectory='%~dp0'; $s.Description='Talking Scanner'; $s.Save()"

echo.
echo Installed. Start it with run.bat, or press the Windows key, type Talking Scanner, and press Enter.
echo To check scanners, voices and Tesseract, run:  run.bat --diagnose
pause
exit /b 0

:error
echo Installation failed. See the messages above.
pause
exit /b 1
