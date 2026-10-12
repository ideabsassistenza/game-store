#!/bin/zsh
# Packs an app folder into the exFAT image ShadowMountPlus mounts: the folder's content at the image
# root, 64 KiB clusters and 512-byte sectors (SMP refuses other geometries).
# Usage: make-exfat.sh <app dir> <image>
set -euo pipefail

src=${1:A} image=${2:A}
[[ -d $src && ! -e $image ]] || { echo "usage: make-exfat.sh <app dir> <new image>" >&2; exit 2; }
CLUSTER=65536

# Each file takes whole clusters, and while copying macOS writes a ._ AppleDouble file per file (one
# more cluster each) even with COPYFILE_DISABLE, deleted afterwards: room for both, plus headroom.
files=$(find "$src" -type f | wc -l | tr -d ' ')
dirs=$(find "$src" -type d | wc -l | tr -d ' ')
data=$(find "$src" -type f -exec stat -f %z {} + | awk -v c=$CLUSTER '{b += int(($1 + c - 1) / c) * c} END {print b + 0}')
mib=$(( (data + (files + dirs) * CLUSTER) * 5 / 4 / 1048576 + 64 ))

dev='' mnt=$(mktemp -d)
finish() {
  local code=$?
  [[ -z $dev ]] || hdiutil detach -force "$dev" > /dev/null 2>&1 || true
  rmdir "$mnt" 2> /dev/null || true
  (( code == 0 )) || rm -f "$image"
}
trap finish EXIT
attach() { dev=$(hdiutil attach -imagekey diskimage-class=CRawDiskImage -nomount "$@" "$image" | awk 'NR==1{print $1}'); }

mkfile -n ${mib}m "$image"
attach
/sbin/newfs_exfat -b $CLUSTER -S 512 -v OVERDRIVE "$dev" > /dev/null
diskutil quiet mount -mountPoint "$mnt" "$dev"
COPYFILE_DISABLE=1 cp -RX "$src/." "$mnt/"
find "$mnt" -name '._*' -delete
rm -rf "$mnt/.fseventsd" "$mnt/.Trashes" "$mnt/.Spotlight-V100"
hdiutil detach "$dev" > /dev/null
dev=''

# Checked as published: read-only, so macOS adds nothing while it is mounted.
attach -readonly
diskutil quiet mount readOnly -mountPoint "$mnt" "$dev"
diff -r "$src" "$mnt" > /dev/null || { echo "the image differs from $src" >&2; diff -rq "$src" "$mnt" | head -5 >&2; exit 1; }
copied=$(find "$mnt" -type f | wc -l | tr -d ' ')
(( copied == files )) || { echo "the image holds $copied files, $src $files" >&2; exit 1; }
hdiutil detach "$dev" > /dev/null
dev=''
echo "$image: $files files, ${mib} MiB"
