#!/bin/zsh
#created 11/08/2026
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
REPO="$(cd "$HERE/../.." && pwd)"
ZIP="$REPO/output/knowledge-globe-offline.zip"
STAGE="$REPO/output/mac-build"
APP="$STAGE/KnowledgeGlobe.app"

if [[ ! -f "$ZIP" ]]; then
  echo "找不到 $ZIP" >&2
  exit 1
fi

rm -rf "$STAGE"
mkdir -p "$APP/Contents/MacOS" "$APP/Contents/Resources"

swiftc -swift-version 5 -O -parse-as-library \
  -o "$APP/Contents/MacOS/KnowledgeGlobe" \
  "$HERE/Sources/main.swift" \
  -framework AppKit -framework WebKit -framework Network

cp "$HERE/Info.plist" "$APP/Contents/Info.plist"

TMP="$(mktemp -d)"
unzip -q "$ZIP" -d "$TMP"
mv "$TMP/knowledge-globe" "$APP/Contents/Resources/web"
rm -rf "$TMP"

if [[ -f "$HERE/AppIcon.icns" ]]; then
  cp "$HERE/AppIcon.icns" "$APP/Contents/Resources/AppIcon.icns"
fi

codesign --force --sign - "$APP"
rm -rf "$REPO/output/KnowledgeGlobe.app"
cp -R "$APP" "$REPO/output/KnowledgeGlobe.app"
echo "已生成 $REPO/output/KnowledgeGlobe.app"
