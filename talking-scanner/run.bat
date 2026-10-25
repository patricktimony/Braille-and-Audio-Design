@echo off
rem One-command launch.  With no arguments the program opens without a console window.
rem   run.bat                 start Talking Scanner
rem   run.bat --diagnose      report scanners, drivers, voices, Tesseract, Narrator
rem   run.bat --key-test      hear what each key does
rem   run.bat --simulate samples   practise without a scanner
rem   run.bat --reset         choose keys and scanner again
cd /d "%~dp0"
if not exist ".venv\Scripts\python.exe" (
  echo Talking Scanner is not installed yet. Run install.bat first.
  exit /b 1
)
if "%~1"=="" (
  start "" ".venv\Scripts\pythonw.exe" -m talking_scanner
) else (
  ".venv\Scripts\python.exe" -m talking_scanner %*
)
