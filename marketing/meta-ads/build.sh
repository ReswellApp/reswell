#!/usr/bin/env bash
# Regenerates the Reswell giveaway Meta ad JPGs in this folder.
#
#   ./marketing/meta-ads/build.sh
#
# Edit the copy or layout in build_ad_svgs.py, then re-run. Tooling (venv, static
# fonts, intermediate SVGs) is kept in a scratch dir outside the repo.

set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO="$(cd "$HERE/../.." && pwd)"
WORK="${TMPDIR:-/tmp}/reswell-meta-ads"

mkdir -p "$WORK"

if [ ! -x "$WORK/venv/bin/python" ]; then
  echo "→ creating build venv"
  python3 -m venv "$WORK/venv"
  "$WORK/venv/bin/pip" install -q --disable-pip-version-check fonttools brotli uharfbuzz
fi

echo "→ converting brand webfonts to static TTFs"
"$WORK/venv/bin/python" "$HERE/build_static_fonts.py" "$REPO/fonts" "$WORK/fonts" >/dev/null

echo "→ building ad SVGs"
"$WORK/venv/bin/python" "$HERE/build_ad_svgs.py" "$WORK/svg" "$WORK/fonts" >/dev/null

echo "→ rendering JPGs"
node "$HERE/svg-to-jpg.mjs" "$WORK/svg" "$HERE"
