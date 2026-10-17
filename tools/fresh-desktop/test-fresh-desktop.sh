#!/bin/bash
set -euo pipefail

ROOT=$(cd "$(dirname "$0")" && pwd)
BIN="$ROOT/fresh-desktop"
# shellcheck disable=SC1090
source "$BIN"

fail() {
  printf 'FAIL: %s\n' "$*" >&2
  exit 1
}

ok() {
  printf 'ok %s\n' "$*"
}

fresh_desktop_pattern_ok "Screenshot *.png" || fail "dated screenshot pattern"
fresh_desktop_pattern_ok "Screen Shot *.jpg" || fail "legacy screenshot pattern"
fresh_desktop_pattern_ok "Screenshot.png" || fail "exact screenshot name"
fresh_desktop_pattern_ok "Screen Recording *.mov" || fail "recording pattern"
if fresh_desktop_pattern_ok "*"; then fail "bare star was accepted"; fi
if fresh_desktop_pattern_ok "*.png"; then fail "extension-only pattern was accepted"; fi
if fresh_desktop_pattern_ok "img *.png"; then fail "short prefix was accepted"; fi
if fresh_desktop_pattern_ok "../Screenshot *.png"; then fail "parent pattern was accepted"; fi
if fresh_desktop_pattern_ok "Desktop/Screenshot *.png"; then fail "slash pattern was accepted"; fi
[[ "$(fresh_desktop_xml_escape 'a&b<c>')" == "a&amp;b&lt;c&gt;" ]] || fail "xml escape"
clock=$(fresh_desktop_normalize_clock 08 05)
[[ "$clock" == "8 5" ]] || fail "clock normalize: $clock"
if fresh_desktop_normalize_clock 24 00 >/dev/null; then fail "hour 24 was accepted"; fi
ok "pattern and clock checks"

new_home() {
  WORK=$(mktemp -d)
  export HOME="$WORK/home"
  export FRESH_DESKTOP_TRASH_DIR="$WORK/trash"
  export FRESH_DESKTOP_LOG="$WORK/cleanup.log"
  export FRESH_DESKTOP_ASSUME_YES=1
  mkdir -p "$HOME/Desktop" "$FRESH_DESKTOP_TRASH_DIR"
  unset FRESH_DESKTOP_SUPPORT_DIR || true
  unset FRESH_DESKTOP_MAX || true
}

assert_file() {
  [[ -f "$1" ]] || fail "missing file $1"
}

assert_gone() {
  [[ ! -e "$1" ]] || fail "file still present $1"
}

new_home
desk="$HOME/Desktop"
printf 'keep\n' >"$desk/notes.txt"
printf 'shot\n' >"$desk/Screen Shot 2026-10-17 at 1.02.03 PM.png"
printf 'new\n' >"$desk/Screenshot 2026-10-17 at 9.41.03 PM.jpg"
printf 'plain\n' >"$desk/Screenshot.png"
mkdir -p "$desk/projects"
printf 'nested\n' >"$desk/projects/Screenshot nested.png"
printf 'outside\n' >"$HOME/Screenshot.png"
ln -s "$HOME/Screenshot.png" "$desk/Screenshot link.png"
mkdir -p "$desk/Screenshot folder.png"
secret="$WORK/secret"
mkdir -p "$secret"
printf 'secret\n' >"$secret/Screenshot.png"
ln -s "$secret" "$HOME/linked-secret"
support="$HOME/Library/Application Support/Fresh Desktop"
mkdir -p "$support"
printf '%s\n%s\n%s\n' "$HOME/Desktop" "$HOME" "$HOME/linked-secret" >"$support/roots"

listed=$(bash "$BIN" --dry-run | LC_ALL=C sort)
expected=$(printf '%s\n%s\n%s\n' \
  "$desk/Screen Shot 2026-10-17 at 1.02.03 PM.png" \
  "$desk/Screenshot 2026-10-17 at 9.41.03 PM.jpg" \
  "$desk/Screenshot.png" | LC_ALL=C sort)
[[ "$listed" == "$expected" ]] || fail "dry-run list:
$listed"
assert_file "$desk/Screen Shot 2026-10-17 at 1.02.03 PM.png"
ok "dry-run lists only loose desktop screenshots"

bash "$BIN" --clean-now >/dev/null
assert_gone "$desk/Screen Shot 2026-10-17 at 1.02.03 PM.png"
assert_gone "$desk/Screenshot 2026-10-17 at 9.41.03 PM.jpg"
assert_gone "$desk/Screenshot.png"
assert_file "$desk/notes.txt"
assert_file "$desk/projects/Screenshot nested.png"
assert_file "$HOME/Screenshot.png"
assert_file "$secret/Screenshot.png"
assert_file "$desk/Screenshot link.png"
[[ -d "$desk/Screenshot folder.png" ]] || fail "folder was removed"
trash_count=$(find "$FRESH_DESKTOP_TRASH_DIR" -maxdepth 1 -type f | wc -l | tr -d ' ')
[[ "$trash_count" == "3" ]] || fail "trash count $trash_count"
ok "clean-now moves screenshots to the trash"

new_home
desk="$HOME/Desktop"
printf 'shot\n' >"$desk/Screenshot today.png"
bash "$BIN" --run | grep -q "Schedule is off" || fail "scheduled run without consent"
assert_file "$desk/Screenshot today.png"
ok "schedule stays off until setup"

bash "$BIN" --install-schedule 08 05 >/dev/null
plist="$HOME/Library/LaunchAgents/com.freshdesktop.cleanup.plist"
grep -q "<integer>8</integer>" "$plist" || fail "plist hour"
grep -q "<integer>5</integer>" "$plist" || fail "plist minute"
grep -q -- "--run" "$plist" || fail "plist mode"
bash "$BIN" --run | grep -q "Moved 1" || fail "scheduled move"
assert_gone "$desk/Screenshot today.png"
assert_file "$FRESH_DESKTOP_TRASH_DIR/Screenshot today.png"
ok "end-of-day schedule moves files"

bash "$BIN" --uninstall >/dev/null
[[ ! -f "$plist" ]] || fail "plist remained"
printf 'again\n' >"$desk/Screenshot again.png"
bash "$BIN" --run | grep -q "Schedule is off" || fail "run after uninstall"
assert_file "$desk/Screenshot again.png"
ok "uninstall stops the schedule"

new_home
desk="$HOME/Desktop"
printf 'a\n' >"$desk/Screenshot a.png"
printf 'b\n' >"$desk/Screenshot b.png"
printf 'c\n' >"$desk/Screenshot c.png"
export FRESH_DESKTOP_MAX=2
if bash "$BIN" --clean-now >/dev/null; then
  fail "oversized cleanup succeeded"
fi
assert_file "$desk/Screenshot a.png"
assert_file "$desk/Screenshot b.png"
assert_file "$desk/Screenshot c.png"
ok "oversized cleanup is skipped"

new_home
desk="$HOME/Desktop"
printf 'keep\n' >"$desk/notes.txt"
printf 'shot\n' >"$desk/Screenshot keep.png"
support="$HOME/Library/Application Support/Fresh Desktop"
mkdir -p "$support"
printf '%s\n*\n*.png\nScreenshot *.png\n' "$HOME/Desktop" >"$support/roots"
# roots file above is wrong; rewrite both files.
printf '%s\n' "$HOME/Desktop" >"$support/roots"
printf '*\n*.png\nScreenshot *.png\n' >"$support/patterns"
bash "$BIN" --clean-now >/dev/null
assert_file "$desk/notes.txt"
assert_gone "$desk/Screenshot keep.png"
ok "unsafe patterns are ignored"

new_home
desk="$HOME/Desktop"
printf 'shot\n' >"$desk/Screenshot collision.png"
printf 'old\n' >"$FRESH_DESKTOP_TRASH_DIR/Screenshot collision.png"
bash "$BIN" --clean-now >/dev/null
assert_file "$FRESH_DESKTOP_TRASH_DIR/Screenshot collision.png"
found=$(find "$FRESH_DESKTOP_TRASH_DIR" -maxdepth 1 -type f -name '*Screenshot collision.png' | wc -l | tr -d ' ')
[[ "$found" == "2" ]] || fail "collision copies $found"
assert_gone "$desk/Screenshot collision.png"
ok "trash name collisions keep both files"

new_home
desk="$HOME/Desktop"
printf 'shot\n' >"$desk/Screenshot prompt.png"
env -u FRESH_DESKTOP_ASSUME_YES bash "$BIN" --clean-now </dev/null | grep -q "Cancelled" || fail "unconfirmed cleanup"
assert_file "$desk/Screenshot prompt.png"
ok "cleanup asks before moving"

if bash "$BIN" --install-schedule 24 00 >/dev/null; then
  fail "invalid schedule was saved"
fi
ok "invalid clock is refused"

printf 'All Fresh Desktop checks passed.\n'
