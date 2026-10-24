@echo off
rem Starts Scan Reader. Double-click this file the first time; it then makes a
rem "Scan Reader" icon on the desktop and starts by itself when the laptop starts.
rem "-ExecutionPolicy Bypass" applies only to this one program; it changes no Windows setting.
start "" powershell.exe -NoProfile -STA -ExecutionPolicy Bypass -WindowStyle Hidden -File "%~dp0ScanReader.ps1"
