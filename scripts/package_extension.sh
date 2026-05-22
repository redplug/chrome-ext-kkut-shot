#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BUILD_DIR="$ROOT_DIR/build/extension"
ZIP_PATH="$ROOT_DIR/build/kkut-shot-extension.zip"
RELEASE_DIR="$ROOT_DIR/release"
RELEASE_ZIP="$RELEASE_DIR/kkut-shot-extension.zip"

rm -rf "$BUILD_DIR"
mkdir -p "$BUILD_DIR"

cp "$ROOT_DIR/manifest.json" "$BUILD_DIR/"
cp -R "$ROOT_DIR/src" "$BUILD_DIR/"
cp -R "$ROOT_DIR/data" "$BUILD_DIR/"

if [ -d "$ROOT_DIR/assets" ]; then
  cp -R "$ROOT_DIR/assets" "$BUILD_DIR/"
fi

rm -f "$ZIP_PATH"
(cd "$BUILD_DIR" && zip -qr "$ZIP_PATH" .)
mkdir -p "$RELEASE_DIR"
cp "$ZIP_PATH" "$RELEASE_ZIP"

echo "Created: $ZIP_PATH"
echo "Created: $RELEASE_ZIP"
