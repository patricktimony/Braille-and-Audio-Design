@echo off
rem Starts Scan Reader. Double-click this file, or make a shortcut to it.
rem "-ExecutionPolicy Bypass" applies only to this one program; it changes no Windows setting.
start "" powershell.exe -NoProfile -STA -ExecutionPolicy Bypass -WindowStyle Hidden -File "%~dp0ScanReader.ps1"
