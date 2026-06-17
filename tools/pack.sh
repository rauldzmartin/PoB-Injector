#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RELEASES_DIR="$ROOT_DIR/releases"
EXT_DIR="$ROOT_DIR"

# Try to find manifest.json within repo
if [[ -f "$ROOT_DIR/manifest.json" ]]; then
  EXT_DIR="$ROOT_DIR"
else
  # common subfolders
  for d in extension src app web; do
    if [[ -f "$ROOT_DIR/$d/manifest.json" ]]; then
      EXT_DIR="$ROOT_DIR/$d"
      break
    fi
  done
fi

VERSION=$(grep -oP '"version_name": "\K[^"]+' "$EXT_DIR/manifest.json" || true)
if [ -z "$VERSION" ]; then
  VERSION=$(grep -oP '"version": "\K[^"]+' "$EXT_DIR/manifest.json" || true)
fi
if [ -z "$VERSION" ]; then
  VERSION="$(date +%Y%m%d-%H%M%S)"
fi

mkdir -p "$RELEASES_DIR"
ZIP_NAME="PoB_Injector_Release_v${VERSION}.zip"
(
  cd "$EXT_DIR"
  zip -r "$RELEASES_DIR/$ZIP_NAME" . -x "*.DS_Store" -x "*.bak" -x "node_modules/*" >/dev/null
)
echo "Wrote $RELEASES_DIR/$ZIP_NAME"
