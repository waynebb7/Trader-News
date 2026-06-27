#!/bin/bash
# Trader News Cockpit — macOS launcher (Intel + Apple Silicon)
cd "$(dirname "$0")"
export NODE_OPTIONS=--use-system-ca

echo ""
echo "  ========================================"
echo "   TRADER NEWS COCKPIT - Starting..."
echo "  ========================================"
echo ""

if ! command -v node >/dev/null 2>&1; then
  echo "  ERROR: Node.js is not installed."
  echo ""
  MACHINE="$(uname -m)"
  if [ "$MACHINE" = "arm64" ]; then
    echo "  Install Apple Silicon Node.js from https://nodejs.org"
  else
    echo "  Install Intel (x64) Node.js from https://nodejs.org"
  fi
  echo ""
  read -r -p "Press Enter to close..."
  exit 1
fi

# Warn if Apple Silicon Mac is running Intel Node under Rosetta
if [ "$(uname -m)" = "arm64" ]; then
  NODE_ARCH="$(node -p 'process.arch')"
  if [ "$NODE_ARCH" = "x64" ]; then
    echo "  Note: Intel Node detected on Apple Silicon Mac."
    echo "  For best performance install ARM64 Node from https://nodejs.org"
    echo ""
  fi
fi

# Xcode tools needed to build native modules on first install
if ! xcode-select -p >/dev/null 2>&1; then
  echo "  Note: Xcode Command Line Tools may be required (one-time)."
  echo "  If install fails, run: xcode-select --install"
  echo ""
fi

node scripts/launch.js
EXIT=$?

echo ""
if [ $EXIT -ne 0 ]; then
  echo "  Startup failed. See messages above."
fi
read -r -p "Press Enter to close..."
exit $EXIT
