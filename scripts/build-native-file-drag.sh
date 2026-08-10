#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
MODULE_DIR="$ROOT_DIR/native/file-drag"
ELECTRON_VERSION="$(node -p "require('$ROOT_DIR/node_modules/electron/package.json').version")"
ARCH="$(node -p "process.arch")"
PLATFORM="$(node -p "process.platform")"
PREBUILD_DIR="$MODULE_DIR/prebuilds/$PLATFORM-$ARCH"
DEV_DIR="$ROOT_DIR/.cache/node-gyp"
TMP_DIR="$ROOT_DIR/.cache/tmp"
DIST_URL="${ELECTRON_CUSTOM_DIR:-${ELECTRON_MIRROR:-https://electronjs.org/headers}}"
LOCAL_NODE_DIR="$(node -p "require('path').dirname(require('path').dirname(process.execPath))")"
LOCAL_NODE_INCLUDE="$LOCAL_NODE_DIR/include/node"
if [[ "$DIST_URL" == */ ]]; then
  DIST_URL="${DIST_URL%/}"
fi

cd "$MODULE_DIR"
mkdir -p "$DEV_DIR"
mkdir -p "$TMP_DIR"
export TMPDIR="$TMP_DIR"
if [[ "${BUILD_FOR_ELECTRON_HEADERS:-0}" == "1" ]]; then
  "$ROOT_DIR/node_modules/.bin/node-gyp" rebuild --runtime=electron --target="$ELECTRON_VERSION" --dist-url="$DIST_URL" --devdir="$DEV_DIR"
elif [[ -f "$LOCAL_NODE_INCLUDE/node_api.h" ]]; then
  "$ROOT_DIR/node_modules/.bin/node-gyp" rebuild --nodedir="$LOCAL_NODE_DIR" --devdir="$DEV_DIR"
else
  "$ROOT_DIR/node_modules/.bin/node-gyp" rebuild --devdir="$DEV_DIR"
fi
mkdir -p "$PREBUILD_DIR"
cp "$MODULE_DIR/build/Release/native_file_drag.node" "$PREBUILD_DIR/native_file_drag.node"
echo "$PREBUILD_DIR/native_file_drag.node"
