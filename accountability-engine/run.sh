#!/usr/bin/env sh
# Start The Accountability Engine with the demonstration data (local only).
cd "$(dirname "$0")" || exit 1
python3 -m pip install --quiet -r requirements.txt && python3 -m accountability_engine --demo "$@"
