#!/usr/bin/env bash
#
# Loads Thundy AV into Thunderbird for the manual live test.
#
# Usage:
#   ./examples/run-in-thunderbird.sh /path/to/thunderbird
#
# The add-on is started with a dedicated profile directory, so your normal
# Thunderbird profile and its mail accounts stay untouched. Afterwards set up a
# local test account and import the test messages as described in
# docs/testdata.md, then work through docs/live_test_protocol.md.
set -euo pipefail

THUNDERBIRD_BINARY="${1:-}"
PROFILE_DIR="${THUNDY_PROFILE_DIR:-$PWD/.thundy-test-profile}"

if [[ -z "$THUNDERBIRD_BINARY" ]]; then
  cat >&2 <<'USAGE'
No Thunderbird binary given.

Usage: ./examples/run-in-thunderbird.sh /path/to/thunderbird

Examples for the binary path:
  macOS        /Applications/Thunderbird.app/Contents/MacOS/thunderbird
  Linux        /usr/lib/thunderbird/thunderbird
  Windows      "C:\\Program Files\\Mozilla Thunderbird\\thunderbird.exe"
USAGE
  exit 2
fi

if [[ ! -x "$THUNDERBIRD_BINARY" ]]; then
  echo "Not executable: $THUNDERBIRD_BINARY" >&2
  exit 2
fi

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
mkdir -p "$PROFILE_DIR"

echo "Add-on source : $REPO_ROOT"
echo "Test profile  : $PROFILE_DIR"
echo "Thunderbird   : $THUNDERBIRD_BINARY"
echo
echo "Next steps:"
echo "  1. create a local test account and import testdata/*.eml   (docs/testdata.md)"
echo "  2. work through the checklist                              (docs/live_test_protocol.md)"
echo "  3. run the submission gate afterwards                      (npm run gate)"
echo

cd "$REPO_ROOT"
exec npx web-ext run \
  --source-dir . \
  --firefox "$THUNDERBIRD_BINARY" \
  --firefox-profile "$PROFILE_DIR" \
  --keep-profile-changes
