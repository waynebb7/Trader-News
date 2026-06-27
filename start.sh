#!/bin/bash
# Trader News Cockpit — macOS / Linux launcher
# Double-click START_TRADER_NEWS.command on Mac, or run: ./start.sh

cd "$(dirname "$0")"
export NODE_OPTIONS=--use-system-ca

echo ""
echo "  ========================================"
echo "   TRADER NEWS COCKPIT - Starting..."
echo "  ========================================"
echo ""

if ! command -v node >/dev/null 2>&1; then
  echo "  ERROR: Node.js is not installed."
  echo "  Install from https://nodejs.org/ (v18 or later)"
  echo ""
  read -r -p "Press Enter to close..."
  exit 1
fi

node scripts/launch.js
EXIT=$?

echo ""
if [ $EXIT -ne 0 ]; then
  echo "  Startup failed. See messages above."
fi
read -r -p "Press Enter to close..."
exit $EXIT
