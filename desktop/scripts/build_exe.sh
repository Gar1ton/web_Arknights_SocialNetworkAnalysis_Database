#!/usr/bin/env bash
# Cross-builds the offline edition after `npm run build:offline`, from desktop/dist into desktop/release:
# ArknightsRelationAtlas/{arknights-relation-atlas.exe,WebView2Loader.dll} and a zip of that folder named by version.
set -euo pipefail
scripts="$(cd "$(dirname "$0")" && pwd)"
desktop="$(dirname "$scripts")"
. "$scripts/env.sh"
target=x86_64-pc-windows-gnu
version="$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["version"])' "$desktop/../package.json")"
export CARGO_TARGET_X86_64_PC_WINDOWS_GNU_LINKER=x86_64-w64-mingw32-gcc
# The toolchain and the sources both live under the repository, so this keeps every machine path out of the binary.
export RUSTFLAGS="--remap-path-prefix=$(dirname "$desktop")=."

cd "$desktop"
cargo build --release --locked --target "$target" --jobs "${JOBS:-6}"

folder=release/ArknightsRelationAtlas
rm -rf release && mkdir -p "$folder"
cp "target/$target/release/arknights-relation-atlas.exe" "$folder/"
cp "$(find "target/$target/release/build" -path '*webview2-com-sys*/out/x64/WebView2Loader.dll' | head -1)" "$folder/"
python3 "$scripts/audit_release.py" dist --exe "$folder/arknights-relation-atlas.exe"
(cd release && python3 -m zipfile -c "ArknightsRelationAtlas-$version-win64.zip" ArknightsRelationAtlas/)
ls -l "$folder" release/*.zip
