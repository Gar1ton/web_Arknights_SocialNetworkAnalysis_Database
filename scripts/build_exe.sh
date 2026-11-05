#!/usr/bin/env bash
# Cross-builds the offline edition from WSL with the MinGW toolchain, after `npm run build:offline`:
# release/ArknightsRelationAtlas/{arknights-relation-atlas.exe,WebView2Loader.dll} and a zip of that folder.
# WIN_CROSS holds env.sh, which puts the Rust, MinGW and host linker tools on PATH.
set -euo pipefail
cd "$(dirname "$0")/.."
. "${WIN_CROSS:-$HOME/.local/share/win-cross}/env.sh"

target=x86_64-pc-windows-gnu
root=$PWD
export CARGO_TARGET_X86_64_PC_WINDOWS_GNU_LINKER=x86_64-w64-mingw32-gcc
# Keep this machine's paths out of the binary.
export RUSTFLAGS="--remap-path-prefix=$HOME=~ --remap-path-prefix=$root=."
(cd src-tauri && cargo build --release --target "$target" --jobs "${JOBS:-6}")

out=release/ArknightsRelationAtlas
rm -rf release && mkdir -p "$out"
cp "src-tauri/target/$target/release/arknights-relation-atlas.exe" "$out/"
cp "$(find "src-tauri/target/$target/release/build" -path '*webview2-com-sys*/out/x64/WebView2Loader.dll' | head -1)" "$out/"
python3 scripts/audit_release.py dist-offline --exe "$out/arknights-relation-atlas.exe"
(cd release && python3 -m zipfile -c ArknightsRelationAtlas-win64.zip ArknightsRelationAtlas/)
ls -l "$out" release/*.zip
