#!/bin/zsh
# Builds Overdrive (PPSA99058) and publishes it as a GitHub release, which the in-app updater installs.
# Usage: release.sh [--no-bump] [--notes "What changed"] [--candidate | --prerelease | --force-latest] [--no-smoke]
#        release.sh --promote vX.Y.Z [--notes "What changed"]
# --no-smoke skips opening the app in the desktop preview over damaged and earlier versions' saved files.
# --candidate publishes tag v<version>-rc and --prerelease tag v<version>-beta, never marked latest, so
# the in-app updater ignores them. --promote makes a tested pre-release the latest release without
# rebuilding it. Publishing straight to latest takes --force-latest.
set -euo pipefail

HERE=${0:A:h}
REPO=${HERE:h:h:h}
# PS5_REACT_DIR (framework checkout) stays out of git, shared with the deploy skill.
source "$REPO/.claude/skills/overdrive-deploy/config.local"
# The catalog (games, download links, audits) is the private overdrive-catalog repository, checked out beside
# this one unless OVERDRIVE_CATALOG_DIR says otherwise; prepare.mjs reads it from there.
: ${OVERDRIVE_CATALOG_DIR:=${REPO:h}/overdrive-catalog}
export OVERDRIVE_CATALOG_DIR=${OVERDRIVE_CATALOG_DIR:A}
RELEASES=overdriveps5/overdrive-releases
TITLE=PPSA99058
ASSET=Overdrive-$TITLE.zip
IMAGE=Overdrive-$TITLE.exfat
bump=1 notes='' source_asset='' prerelease=0 suffix=beta force_latest=0 promote='' smoke=1
while (( $# )); do
  case $1 in
    --no-bump) bump=0 ;;
    --notes) notes=$2; shift ;;
    --source) source_asset=$2; shift ;;
    --prerelease) prerelease=1 ;;
    --candidate) prerelease=1 suffix=rc ;;
    --force-latest) force_latest=1 ;;
    --promote) promote=$2; shift ;;
    --no-smoke) smoke=0 ;;
    *) echo "unknown option: $1" >&2; exit 2 ;;
  esac
  shift
done

# The last line of every release's notes names the commits it was built from, so what is not released
# yet is `git log <commit>..main` in each repository. Uncommitted changes in a build are marked.
commit_of() {
  local dir=$1; shift
  echo "$(git -C "$dir" rev-parse --short HEAD)$([[ -n $(git -C "$dir" status --porcelain -- . "$@") ]] && echo +uncommitted)"
}
catalog_commit() {
  if [[ $(git -C "$OVERDRIVE_CATALOG_DIR" rev-parse --show-toplevel 2>/dev/null) == "$OVERDRIVE_CATALOG_DIR" ]]; then commit_of "$OVERDRIVE_CATALOG_DIR"; else echo unversioned; fi
}
built_from() {
  gh release view "$1" --repo $RELEASES --json body --jq .body | { grep '^Built from ' || true; } | tail -1
}

digest_of() {
  gh api "repos/$RELEASES/releases/tags/$1" --jq ".assets[] | select(.name == \"$2\") | .digest"
}

# The updater offers releases/latest when its tag is above the running version, read part by part:
# a suffix (v0.0.110-rc) reads as no number, so it would be offered to no one. A suffixed pre-release
# is therefore promoted as a new release under its plain tag, with the same files; a candidate's build
# already runs as that version, so its testers are not offered it again.
if [[ -n $promote ]]; then
  from=$promote
  [[ $from == *-* ]] || gh release view "$from" --repo $RELEASES > /dev/null 2>&1 || from=$from-rc
  [[ $(gh api "repos/$RELEASES/releases/tags/$from" --jq .prerelease 2>/dev/null) == true ]] || { echo "$from is not a published pre-release" >&2; exit 1; }
  tag=${from%%-*}
  typeset -A digests
  for name in $ASSET $IMAGE.zip; do
    digests[$name]=$(digest_of "$from" "$name")
    [[ ${digests[$name]} == sha256:* ]] || { echo "$from has no $name with a SHA-256 digest" >&2; exit 1; }
  done
  latest=$(gh api "repos/$RELEASES/releases/latest" --jq .tag_name)
  [[ $(printf '%s\n' "${latest#v}" "${tag#v}" | sort -V | tail -1) == "${tag#v}" && $latest != "$tag" ]] \
    || { echo "$tag is not above the latest release $latest" >&2; exit 1; }
  echo "== promote $from to $tag"
  if [[ $from == "$tag" ]]; then
    edit=(--prerelease=false --latest)
    [[ -z $notes ]] || edit+=(--notes "$notes

$(built_from "$from")")
    gh release edit "$tag" --repo $RELEASES "${edit[@]}"
  else
    gh release view "$tag" --repo $RELEASES > /dev/null 2>&1 && { echo "$tag is already released" >&2; exit 1; }
    stage=$(mktemp -d)
    trap 'rm -rf "$stage"' EXIT
    gh release download "$from" --repo $RELEASES --dir "$stage"
    if [[ -n $notes ]]; then notes="$notes

$(built_from "$from")"
    else notes=$(gh release view "$from" --repo $RELEASES --json body --jq .body); fi
    gh release create "$tag" "$stage"/* --repo $RELEASES --title "Overdrive $tag" --latest --notes "$notes"
  fi
  for name in $ASSET $IMAGE.zip; do
    [[ $(digest_of "$tag" "$name") == "${digests[$name]}" ]] || { echo "$tag's $name does not match $from's" >&2; exit 1; }
    echo "$name ${digests[$name]}"
  done
  [[ $(gh api "repos/$RELEASES/releases/latest" --jq .tag_name) == "$tag" ]] || { echo "releases/latest is not $tag" >&2; exit 1; }
  echo "Promoted $from: consoles are offered $tag."
  exit 0
fi

if (( ! prerelease && ! force_latest )); then
  cat >&2 <<'EOF'
A release published as latest reaches every console at its next launch. Stage it instead:
  1. release.sh --candidate --notes "What changed"   (tag vX.Y.Z-rc, not offered by the updater)
  2. Have 2-3 testers install it by hand over their current install and confirm it opens.
  3. release.sh --promote vX.Y.Z                     (the same files become the latest release)
Pass --force-latest to publish straight to latest anyway.
EOF
  exit 2
fi

[[ -z $source_asset || -f $source_asset ]] || { echo "source archive missing" >&2; exit 1; }
[[ -d $OVERDRIVE_CATALOG_DIR ]] || { echo "No catalog at $OVERDRIVE_CATALOG_DIR: clone the private overdrive-catalog repository there or set OVERDRIVE_CATALOG_DIR to its checkout." >&2; exit 1; }
version_file="$REPO/native/version.js"
if (( bump )); then
  current=$(sed -n "s/.*VERSION = '\(.*\)'.*/\1/p" "$version_file")
  next="${current%.*}.$(( ${current##*.} + 1 ))"
  sed -i '' "s/VERSION = '$current'/VERSION = '$next'/" "$version_file"
fi
version=$(sed -n "s/.*VERSION = '\(.*\)'.*/\1/p" "$version_file")
tag=v$version
(( prerelease )) && tag=$tag-$suffix
for released in $tag v$version; do
  gh release view "$released" --repo $RELEASES > /dev/null 2>&1 && { echo "$released is already released" >&2; exit 1; }
done
echo "== $tag"

echo "== engine"
# Every delete (cancel, restart, Files, the updater's work folder) needs FileSystem.removeAsync.
grep -q 'removeAsync:' "$PS5_REACT_DIR/runtime/js/native.js" \
  || { echo "PS5 React at $PS5_REACT_DIR has no FileSystem.removeAsync; update the engine" >&2; exit 1; }

echo "== catalog ($OVERDRIVE_CATALOG_DIR)"
node "$REPO/native/scripts/prepare.mjs" > /dev/null

echo "== tests"
for test in $(find "$REPO/native" -name '*.test.mjs' -not -path '*/node_modules/*'); do
  node --test "$test" > /dev/null 2>&1 || { echo "failed: $test" >&2; node --test "$test" 2>&1 | grep -E 'not ok|Error' | head -5; exit 1; }
done

if (( smoke )); then
  echo "== smoke"
  node "$REPO/native/scripts/smoke-launch.mjs" "$PS5_REACT_DIR"
fi

# version.js is bumped above and committed after the release, so it does not count as a change.
built="Built from game-store@$(commit_of "$REPO" ':!native/version.js') · ps5-react@$(commit_of "$PS5_REACT_DIR") · overdrive-catalog@$(catalog_commit)"
echo "== build ($built)"
(cd "$PS5_REACT_DIR" && npm run build -- --app-dir "$REPO/native" 2>&1 | tail -2)

# The ZIP holds the app folder itself; the updater looks inside it.
stage=$(mktemp -d)
trap 'rm -rf "$stage"' EXIT
# Store launcher permissions in the ZIP for manual installs, using a copy of the build.
cp -R "$PS5_REACT_DIR/dist/$TITLE" "$stage/$TITLE"
chmod -R 777 "$stage/$TITLE"
(cd "$stage" && zip -q -r "$ASSET" "$TITLE")
python3 - "$stage/$ASSET" <<'PY'
import stat
import sys
import zipfile

with zipfile.ZipFile(sys.argv[1]) as archive:
    invalid = [entry.filename for entry in archive.infolist()
               if stat.S_IMODE(entry.external_attr >> 16) != 0o777]
    if invalid:
        raise SystemExit(f"Release ZIP has entries without mode 0777: {invalid[:5]}")
PY

echo "== image"
"$HERE/make-exfat.sh" "$PS5_REACT_DIR/dist/$TITLE" "$stage/$IMAGE"
# mkfile leaves it 0600; a manual install copies the mode out of the ZIP like the folder's.
chmod 777 "$stage/$IMAGE"
(cd "$stage" && zip -q "$IMAGE.zip" "$IMAGE")

echo "== release"
assets=("$stage/$ASSET" "$stage/$IMAGE.zip")
[[ -z $source_asset ]] || assets+=("$source_asset")
flags=()
(( prerelease )) && flags=(--prerelease --latest=false)
gh release create "$tag" "${assets[@]}" --repo $RELEASES --title "Overdrive $tag" \
  --notes "${notes:-Overdrive $tag}

$built" "${flags[@]}"
# The updater refuses an asset without the SHA-256 GitHub computes for it.
for name in $ASSET $IMAGE.zip; do
  digest=$(digest_of "$tag" "$name")
  [[ $digest == sha256:* ]] || { echo "the release has no SHA-256 digest for $name" >&2; exit 1; }
  echo "$name $digest"
done
case $tag in
  *-rc) echo "Released $tag. Commit native/version.js; once testers confirm it opens: release.sh --promote v$version" ;;
  *-beta) echo "Released $tag. A beta's version is not committed." ;;
  *) echo "Released $tag. Commit native/version.js with the change." ;;
esac
