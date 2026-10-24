#!/bin/bash
# Double-click this file to start SimpleGit on a Mac.
cd "$(dirname "$0")"
if ! command -v node >/dev/null 2>&1; then
  echo ""
  echo "SimpleGit needs a free program called Node.js."
  echo "Your web browser will now open the Node.js download page."
  echo "Install it, then double-click \"Start SimpleGit\" again."
  open "https://nodejs.org/en/download"
  read -r -p "Press Enter to close this window."
  exit 1
fi
if [ ! -d node_modules ]; then
  echo "Getting SimpleGit ready. This only happens the first time and takes about a minute..."
  npm install --omit=dev --no-fund --no-audit
fi
OPEN_BROWSER=1 node server/index.js
