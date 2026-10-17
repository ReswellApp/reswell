#!/bin/bash
# Build a macOS disk image containing Fresh Desktop.app.
set -euo pipefail

ROOT=$(cd "$(dirname "$0")" && pwd)
HFSPLUS="${HFSPLUS:-hfsplus}"
DMGTOOL="${DMGTOOL:-dmg}"
STAGE=$(mktemp -d)
APP="$STAGE/Fresh Desktop.app"
DIST="$ROOT/dist"
IMG="$DIST/fresh-desktop.hfs"
DMG="$DIST/Fresh Desktop.dmg"

cleanup() {
  rm -rf "$STAGE"
  rm -f "$IMG"
}
trap cleanup EXIT

mkdir -p "$APP/Contents/MacOS" "$APP/Contents/Resources" "$DIST"
cp "$ROOT/fresh-desktop" "$APP/Contents/MacOS/fresh-desktop"
chmod 755 "$APP/Contents/MacOS/fresh-desktop"
cp "$ROOT/Info.plist" "$APP/Contents/Info.plist"
printf 'APPL????' >"$APP/Contents/PkgInfo"
cp "$ROOT/How to Use.txt" "$APP/Contents/Resources/How to Use.txt"
cp "$ROOT/How to Use.txt" "$STAGE/How to Use.txt"

rm -f "$IMG" "$DMG"
dd if=/dev/zero of="$IMG" bs=1M count=32 status=none
mkfs.hfsplus -v "Fresh Desktop" "$IMG" >/dev/null
"$HFSPLUS" --symlinks clone_link "$IMG" addall "$STAGE" /
"$HFSPLUS" "$IMG" symlink "/Applications" "/Applications"
"$HFSPLUS" "$IMG" chmod 755 "/Fresh Desktop.app/Contents/MacOS/fresh-desktop"
"$DMGTOOL" build "$IMG" "$DMG"
trap - EXIT
cleanup
printf 'Wrote %s\n' "$DMG"
