---
name: overdrive-release
description: Publish an Overdrive build as a GitHub release so consoles update themselves through the in-app updater. Use when the user asks to release, publish, ship an update or "lançar uma versão" of Overdrive.
---

# Release Overdrive to the in-app updater

A release marked latest reaches every console at its next launch, so it goes out in stages:

```sh
# 1. A release candidate, tag vX.Y.Z-rc: a pre-release the in-app updater never offers.
.claude/skills/overdrive-release/release.sh --candidate --notes "What changed, one or two lines"
# 2. Two or three testers install it by hand over their current install and confirm it opens.
# 3. The same files become the latest release, tag vX.Y.Z, without a rebuild.
.claude/skills/overdrive-release/release.sh --promote vX.Y.Z
```

Plain `release.sh` refuses to publish straight to latest and prints this flow; `--force-latest` does it anyway. `--prerelease` publishes a beta (`vX.Y.Z-beta`, usually a four-part version such as 0.0.109.1, not committed), which `--promote` also accepts by its full tag.

A build does, in order:

1. Bumps the patch in `native/version.js` (`--no-bump` releases the current one). Stops if that tag, or the version's plain tag, is already released.
2. Regenerates the catalog from the private `overdrive-catalog` checkout (see Setup; it stops before the bump when there is none), runs every `native/**/*.test.mjs` (among them `native/state/upgrade.test.mjs`, which loads the data each shipped version left behind, `native/state/fixtures/upgrade/<version>/`), opens the app in the framework's desktop preview over damaged saved files and over each of those fixture sets (`native/scripts/smoke-launch.mjs`; `--no-smoke` skips it), builds `dist/PPSA99058` with the framework.
3. Zips the folder itself as `Overdrive-PPSA99058.zip` (folder installs, mode 0777 stored).
4. Packs the folder into `Overdrive-PPSA99058.exfat` with `make-exfat.sh` (the image ShadowMountPlus mounts: content at the root, 64 KiB clusters, 512-byte sectors; checked against the folder with `diff -r`) and zips it as `Overdrive-PPSA99058.exfat.zip` (the recommended install).
5. Publishes both as release `vX.Y.Z` (`-rc` or `-beta` for a pre-release) on [overdriveps5/overdrive-releases](https://github.com/overdriveps5/overdrive-releases), a public repository that holds only builds.
6. Checks that GitHub attached a SHA-256 digest to each asset: the updater refuses one without it.

The notes end with `Built from game-store@<commit> · ps5-react@<commit> · overdrive-catalog@<commit>` (`+uncommitted` when the build had changes not committed; the version bump does not count; `unversioned` for a catalog folder that is not a git checkout), and `--promote` keeps that line even with new `--notes`. What is not released yet is `git log <commit>..main` in each repository.

Use `--source /path/to/Overdrive-vX.Y.Z-source.tar.gz` to attach corresponding
source alongside the binary in the same release. Preserve framework and
third-party notices and include the modified engine, build scripts and linked
GPL dependency sources when distributing compiled builds.

Then commit `native/version.js` (for a candidate too: its promoted release is the same build).

## Promoting

`release.sh --promote vX.Y.Z` finds the pre-release `vX.Y.Z` or `vX.Y.Z-rc` (or takes a full `-beta` tag), checks both assets carry a SHA-256 digest and that the version is above the current latest. The updater reads a tag part by part and a suffix as no number, so `v0.0.110-rc` would be offered to no console: a suffixed pre-release is republished as a new release under its plain tag with the same files (and its notes, unless `--notes`), and a plain one is flipped to a release with `gh release edit --prerelease=false --latest`. It then checks the new release's digests match the pre-release's and that `releases/latest` names it. A tester running the candidate already runs that version, so the promoted release is not offered to them again.

## Upgrade fixtures

When a release changes what the app saves (the queue's jobs, the saved lists, the update marker), add a folder under `native/state/fixtures/upgrade/` named after it, holding what it writes: `data-dir/` for the app's data folder (`/download0`), `queue-dir/` for `/data/ps5-react/PPSA99058/queue`. The test and the smoke pick every folder up.

## How consoles pick it up

`native/state/update.js` reads `releases/latest` from that repository a few seconds after launch. A higher tag opens the update dialog. ShadowMount's `games/info` says how the app is installed: a folder install downloads `Overdrive-PPSA99058.zip` and swaps its entries into the folder; an image install downloads `Overdrive-PPSA99058.exfat.zip`, extracts it next to the image on the same drive (`<root>/overdrive-update`) and renames the new image over the old one, which ShadowMount mounts at the next launch. Either way the download is verified against its SHA-256. A folder install reopens through the payload loader (`relauncher.elf` on 9021); without the loader it only closes and the user reopens it. An image install always closes and asks the user to reopen it, 11 s after the rename: ShadowMountPlus 1.7 keeps the old image attached until a moment after the app exits (an immediate relaunch would run the old one again) and refuses to mount a file changed in the last 10 s (`stability_wait_seconds`).

## Testing without publishing

`native/scripts/mock-update.mjs` serves a fake release (`--zip` for a folder install's asset, `--image` for an image install's); write its URL into `overdrive/update-feed` in the app's data folder (on the console, `/data/ps5-react/PPSA99058/overdrive/update-feed`, writable through PS5Upload). Delete the file afterwards.

## Setup (once per machine)

`gh auth login` with access to overdriveps5/overdrive-releases, and the deploy skill's `config.local` (`PS5_REACT_DIR`).

The catalog (games, download links, archive passwords, link audits) is the private `overdrive-catalog` repository; the build reads it and this repository holds none of it. Before a release, check it out and bring it up to date:

```sh
git clone <overdrive-catalog URL> ../overdrive-catalog   # once, beside this repository
git -C ../overdrive-catalog pull
```

Elsewhere (a worktree, another folder), set `OVERDRIVE_CATALOG_DIR` in `config.local` or the environment. `prepare.mjs`, `validate.mjs`, `audit-parts.mjs`, `import-downloads.mjs` and `merge-catalog.mjs` read it the same way (`native/scripts/catalog-dir.mjs`). `native/data/sample` is a small fictional catalog for development and tests, never for a release.
