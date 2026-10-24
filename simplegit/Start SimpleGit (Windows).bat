@echo off
title SimpleGit
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo SimpleGit needs a free program called Node.js.
  echo Your web browser will now open the Node.js download page.
  echo Install it, then double-click "Start SimpleGit" again.
  echo.
  start "" https://nodejs.org/en/download
  pause
  exit /b
)
if not exist node_modules (
  echo Getting SimpleGit ready. This only happens the first time and takes about a minute...
  call npm install --omit=dev --no-fund --no-audit
)
set OPEN_BROWSER=1
node server\index.js
pause
