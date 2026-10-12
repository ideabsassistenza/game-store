# Overdrive

A game store for jailbroken PS5s. The app is `native/` (built with the PS5 React engine in `~/Documents/ps5-react`); builds are published to [overdriveps5/overdrive-releases](https://github.com/overdriveps5/overdrive-releases), whose `releases/latest` the in-app updater installs on every console.

## Release validations

`.claude/skills/overdrive-release/release.sh` runs these in order and stops at the first failure, before anything is published:

1. **Catalog:** regenerates it (`native/scripts/prepare.mjs`) from the private catalog and validates the game data.
2. **Tests:** every `native/**/*.test.mjs` (download queue, VikingFile capture, sources, updater, catalog).
3. **Smoke launch** (`native/scripts/smoke-launch.mjs`): opens the app in the desktop preview and requires a first frame without closing. The first run is over damaged saved files: empty, cut short, the wrong shape. Further runs use the data each shipped version left behind (`native/state/fixtures/upgrade`), as an update finds it.
4. **Build:** the engine's PS5 build checks its runtime and dependency hashes. `tools/verify.py` then checks the title structure and binary integrity. The release ZIP must store mode 777 on every entry, and the exFAT image is made from the same build.
5. **Publish:** GitHub must attach a SHA-256 digest to each asset; the updater refuses an asset without one.

None of these runs on a console. A real PS5 is covered only by testers.

## Catalog

The games, download links, archive passwords, feed snapshots and link audits are not in this repository: they live in the private `overdrive-catalog` repository and only enter the build. Clone it beside this repository (`../overdrive-catalog`) or set `OVERDRIVE_CATALOG_DIR` (in a worktree, in `.claude/skills/overdrive-deploy/config.local`) before a release, a deploy or any catalog script; `prepare.mjs` and `release.sh` stop and say where they looked when it is missing. `native/data/sample` is a small fictional catalog for development and tests (`OVERDRIVE_CATALOG_DIR=native/data/sample`). Never commit catalog data, real links or passwords here; tests and fixtures use example.com links and `fixture-password`.

## Release flow

- Never publish anything unless the owner asks for it. A fix ends at a merged PR.
- Batches of fixes run through `.claude/skills/overdrive-batch` (Paseo agents, review and integration gates). Engine change → minor bump; big batch → beta, testers confirm, rc, promote.
- The owner picks the kind: `--prerelease` gives `vX.Y.Z-beta` for testers, `--candidate` gives `vX.Y.Z-rc`, `--force-latest` publishes the official release straight away. The updater ignores betas and rcs.
- `--promote vX.Y.Z-rc` makes a tested pre-release's files the latest release. Consoles are offered the latest at their next launch.
- Commit `native/version.js` for an rc or an official release; a beta's version is not committed.
- Every release's notes end with `Built from game-store@<commit> · ps5-react@<commit> · overdrive-catalog@<commit>`: what is not released yet is `git log <commit>..main` in each repository. Releases before 0.1.4 lack it, and those before the catalog moved out name no catalog.
