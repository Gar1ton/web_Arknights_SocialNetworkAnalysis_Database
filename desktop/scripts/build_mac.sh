#!/usr/bin/env bash
# Run on a Mac, after `npm run build:offline`. Writes desktop/release/ArknightsRelationAtlas.app (Apple silicon and
# Intel in one file) and a zip of it. Linking needs Apple's SDK, so this cannot run from WSL.
set -euo pipefail
scripts="$(cd "$(dirname "$0")" && pwd)"
desktop="$(dirname "$scripts")"
. "$scripts/env.sh"
[ "$(uname)" = Darwin ] || { echo "build_mac.sh runs on macOS only" >&2; exit 1; }
version="$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["version"])' "$desktop/../package.json")"
binary=arknights-relation-atlas
export MACOSX_DEPLOYMENT_TARGET=11.3 # WebKit downloads, which the SVG export uses, start here
export RUSTFLAGS="--remap-path-prefix=$(dirname "$desktop")=. --remap-path-prefix=$HOME=~"

cd "$desktop"
for target in aarch64-apple-darwin x86_64-apple-darwin; do
  cargo build --release --locked --target "$target"
done

app=release/ArknightsRelationAtlas.app
rm -rf release && mkdir -p "$app/Contents/MacOS" "$app/Contents/Resources"
lipo -create -output "$app/Contents/MacOS/$binary" \
  "target/aarch64-apple-darwin/release/$binary" "target/x86_64-apple-darwin/release/$binary"
cp icons/icon.icns "$app/Contents/Resources/icon.icns"
cat > "$app/Contents/Info.plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleName</key><string>方舟关系图谱</string>
  <key>CFBundleDisplayName</key><string>方舟关系图谱</string>
  <key>CFBundleIdentifier</key><string>io.github.gar1ton.arknights-relation-atlas</string>
  <key>CFBundleExecutable</key><string>$binary</string>
  <key>CFBundleIconFile</key><string>icon</string>
  <key>CFBundlePackageType</key><string>APPL</string>
  <key>CFBundleShortVersionString</key><string>$version</string>
  <key>CFBundleVersion</key><string>$version</string>
  <key>NSHumanReadableCopyright</key><string>Copyright © 2026 Gar1ton &amp; MKiyoaki</string>
  <key>LSMinimumSystemVersion</key><string>$MACOSX_DEPLOYMENT_TARGET</string>
  <key>NSHighResolutionCapable</key><true/>
</dict>
</plist>
PLIST
# Ad-hoc: Apple silicon refuses unsigned code. It is not a Developer ID, so Gatekeeper still warns on first open.
codesign --force --deep --sign - "$app"
python3 "$scripts/audit_release.py" dist --exe "$app/Contents/MacOS/$binary"
ditto -c -k --keepParent "$app" "release/ArknightsRelationAtlas-$version-macos.zip"
ls -l release
