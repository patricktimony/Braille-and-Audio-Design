#!/bin/sh
# Wraps app.html (the page body, also published as a claude.ai artifact) into a standalone index.html.
cd "$(dirname "$0")" || exit 1
{
  printf '<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">\n</head>\n<body style="margin:0">\n<!-- Generated from app.html. Edit app.html, then run ./build.sh -->\n'
  cat app.html
  printf '\n</body>\n</html>\n'
} > index.html
