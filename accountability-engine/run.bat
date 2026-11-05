@echo off
rem Start The Accountability Engine with the demonstration data (local only).
cd /d "%~dp0"
python -m pip install --quiet -r requirements.txt
python -m accountability_engine --demo %*
