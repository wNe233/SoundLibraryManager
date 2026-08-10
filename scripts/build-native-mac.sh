#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
SRC="$ROOT_DIR/native/macos/NativeFileDrag.swift"
OUT_DIR="$ROOT_DIR/native/macos/bin"
OUT="$OUT_DIR/NativeFileDrag"

mkdir -p "$OUT_DIR"
swiftc "$SRC" -framework AppKit -o "$OUT"
chmod +x "$OUT"
echo "$OUT"
