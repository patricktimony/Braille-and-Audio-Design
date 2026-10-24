@echo off
rem Starts Scan Reader and waits until it closes.
rem "-ExecutionPolicy Bypass" applies only to this one program; it changes no Windows setting.
powershell.exe -NoProfile -STA -ExecutionPolicy Bypass -WindowStyle Hidden -File "%~dp0ScanReader.ps1"
rem Safety net: make sure JAWS can talk again, even if Scan Reader stopped unexpectedly.
powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -Command "try { $null = (New-Object -ComObject FreedomSci.JawsApi).RunFunction('SpeechOn') } catch { }"
