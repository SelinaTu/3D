#!/bin/zsh
#created 11/08/2026
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
REPO="$(cd "$HERE/../.." && pwd)"
cd "$REPO"
SOURCE="$REPO/data/optimization/v3-r2-delivery/current-best.json"
STAGE="$REPO/output/mac-build-assembly"
APP="$STAGE/CargoPlanAssembly.app"

if [[ ! -f "$SOURCE" ]]; then
  echo "找不到装箱结果 $SOURCE" >&2
  exit 1
fi

rm -rf "$STAGE"
mkdir -p "$APP/Contents/MacOS" "$APP/Contents/Resources"
node "$HERE/extract-scene.mjs" "$SOURCE" "$APP/Contents/Resources/scene.json"
node -p "process.execPath" > "$APP/Contents/Resources/node-path.txt"
node "$HERE/bundle.mjs" "$APP/Contents/Resources"
cp -R "$REPO/node_modules/electron/dist/Electron.app" "$APP/Contents/Resources/Runtime.app"
mkdir -p "$APP/Contents/Resources/knowledge"
cp -R "$REPO/globe/data/" "$APP/Contents/Resources/knowledge/"
cp "$HERE/Info.plist" "$APP/Contents/Info.plist"
if [[ -f "$REPO/desktop/icon.icns" ]]; then
  cp "$REPO/desktop/icon.icns" "$APP/Contents/Resources/AppIcon.icns"
fi

swiftc -swift-version 5 -O -parse-as-library \
  -o "$APP/Contents/MacOS/CargoPlanAssembly" \
  "$HERE"/Sources/*.swift \
  -framework AppKit -framework SceneKit -framework RealityKit -framework WebKit

codesign --force --deep --sign - "$APP"
rm -rf "$REPO/output/CargoPlanAssembly.app"
cp -R "$APP" "$REPO/output/CargoPlanAssembly.app"
echo "已生成 $REPO/output/CargoPlanAssembly.app"
