#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DIST_DIR="$ROOT_DIR/dist"

# Find version
VERSION=$(grep -oP '"version_name": "\K[^"]+' "$ROOT_DIR/extension/manifest.json" || true)
if [ -z "$VERSION" ]; then
  VERSION="$(date +%Y%m%d-%H%M%S)"
fi

mkdir -p "$DIST_DIR"
ZIP_NAME="PoB_Injector_Release_v${VERSION}.zip"

echo "Packing $ZIP_NAME..."
(
  cd "$ROOT_DIR"
  zip -r "$DIST_DIR/$ZIP_NAME" . \
    -x "*.git*" \
    -x ".github/*" \
    -x ".vscode/*" \
    -x ".agents/*" \
    -x "tools/*" \
    -x "scratch/*" \
    -x ".gitignore" \
    -x "*.env" \
    -x "dist/*" \
    -x "server/.venv/*" \
    -x "server/__pycache__/*" \
    -x "server/pob_wrapper/__pycache__/*" \
    -x "server/*.log" \
    -x "*.DS_Store" \
    -x "*.bak" >/dev/null
)
echo "Wrote $DIST_DIR/$ZIP_NAME"
