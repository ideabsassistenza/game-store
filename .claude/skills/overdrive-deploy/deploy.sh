#!/bin/zsh
# Builds Overdrive (PPSA99058) and installs it on the PS5 through PS5Upload's local API.
# Usage: deploy.sh [--no-bump] [--no-launch]
set -euo pipefail

HERE=${0:A:h}
REPO=${HERE:h:h:h}
# PS5_ADDR (console IP), PS5_REACT_DIR (framework checkout) and OVERDRIVE_CATALOG_DIR stay out of git.
source "$HERE/config.local"
# The private overdrive-catalog checkout, beside this repository unless config.local says otherwise.
: ${OVERDRIVE_CATALOG_DIR:=${REPO:h}/overdrive-catalog}
export OVERDRIVE_CATALOG_DIR=${OVERDRIVE_CATALOG_DIR:A}
API=http://127.0.0.1:19113
TITLE=PPSA99058
JSON='content-type: application/json'
bump=1 launch=1
for arg in "$@"; do
  case $arg in
    --no-bump) bump=0 ;;
    --no-launch) launch=0 ;;
    *) echo "unknown option: $arg" >&2; exit 2 ;;
  esac
done

api() { /usr/bin/curl -s -m 30 -H "$JSON" "$@"; }

nc -z -G 3 "$PS5_ADDR" 9113 || { echo "PS5 $PS5_ADDR:9113 unreachable: same Wi-Fi? PS5Upload running?" >&2; exit 1; }

version_file="$REPO/native/version.js"
if (( bump )); then
  current=$(sed -n "s/.*VERSION = '\(.*\)'.*/\1/p" "$version_file")
  next="${current%.*}.$(( ${current##*.} + 1 ))"
  sed -i '' "s/VERSION = '$current'/VERSION = '$next'/" "$version_file"
fi
version=$(sed -n "s/.*VERSION = '\(.*\)'.*/\1/p" "$version_file")
echo "== v$version"

# Game pages read their about text and screenshots from data/pages, which prepare.mjs writes.
echo "== catalog"
node "$REPO/native/scripts/prepare.mjs" > /dev/null

echo "== tests"
for test in $(find "$REPO/native" -name '*.test.mjs' -not -path '*/node_modules/*'); do
  node --test "$test" > /dev/null 2>&1 || { echo "failed: $test" >&2; node --test "$test" 2>&1 | grep -E 'not ok|Error' | head -5; exit 1; }
done

echo "== build"
(cd "$PS5_REACT_DIR" && npm run build -- --app-dir "$REPO/native" 2>&1 | tail -2)

# Replacing a running title's files is unsafe; kill it first. Its app id changes per launch.
app_id=$(api "$API/api/ps5/klog?addr=$PS5_ADDR" | grep -o 'appid=0x[0-9a-f]*' | tail -1 | cut -d= -f2 || true)
for id in $app_id 0x2018 0x4018 0x6018 0x8018 0xa018 0xc018 0xe018; do
  api -d "{\"addr\":\"$PS5_ADDR:9113\",\"action\":\"kill\",\"app_id\":$((id))}" "$API/api/ps5/app/lifecycle" | grep -q '"ok":true' && { echo "== killed $id"; break; }
done

echo "== install"
job=$(api -X POST -d "{\"addr\":\"$PS5_ADDR:9113\",\"src_dir\":\"$PS5_REACT_DIR/dist/$TITLE\",\"dest_root\":\"/data/homebrew/$TITLE\"}" \
  "$API/api/transfer/dir" | sed 's/.*"job_id":"\([^"]*\)".*/\1/')
for _ in {1..80}; do
  state=$(api "$API/api/jobs/$job")
  echo "$state" | grep -qE '"status":"(done|failed|error)"' && break
  sleep 3
done
echo "$state" | grep -q '"status":"done"' || { echo "install failed: ${state:0:300}" >&2; exit 1; }

if (( launch )); then
  sleep 2
  api -d "{\"addr\":\"$PS5_ADDR:9113\",\"title_id\":\"$TITLE\"}" "$API/api/ps5/app/launch" > /dev/null
  echo "== launched"
fi
echo "Installed v$version. Commit native/version.js with the change."
