---
name: overdrive-deploy
description: Build Overdrive (PPSA99058) and install it on the PS5. Use whenever a change must reach the console ("instala", "builda", "manda pro PS5", "deploy").
---

# Build and install Overdrive on the PS5

Run:

```sh
.claude/skills/overdrive-deploy/deploy.sh
```

It does, in order:

1. Checks that the console answers on `PS5_ADDR:9113`.
2. Bumps the patch in `native/version.js`, which is shown beside the logo, so the user can see the install landed.
3. Regenerates the catalog with `node native/scripts/prepare.mjs` from the private catalog checkout (`OVERDRIVE_CATALOG_DIR`), including `data/pages`, the game pages' about text and screenshots.
4. Runs every `native/**/*.test.mjs` and stops on a failure.
5. Builds with the framework: `npm run build -- --app-dir <repo>/native` in `PS5_REACT_DIR`, giving `dist/PPSA99058`.
6. Kills the running title, because its files can't be replaced while it runs.
7. Sends `dist/PPSA99058` to `/data/homebrew/PPSA99058` through PS5Upload (`127.0.0.1:19113`) and waits for the job.
8. Launches the title.

Options:
- `--no-bump` reinstalls the same version.
- `--no-launch` leaves the app closed.

## Setup (once per machine)

`config.local` sits next to this file. It is gitignored, so the console address is never committed.

```sh
PS5_ADDR=192.168.x.x
PS5_REACT_DIR=$HOME/Documents/ps5-react
# Only when the private catalog is not checked out beside this repository (a worktree, for one):
OVERDRIVE_CATALOG_DIR=$HOME/Documents/personal/overdrive-catalog
```

The catalog is the private `overdrive-catalog` repository: `git clone <its URL> ../overdrive-catalog` from this repository's root.

PS5Upload must be running on the Mac. The PS5 must be on and on the same network.

## After installing

- Tell the user which version to look for (`vX.Y.Z` beside the logo).
- Commit `native/version.js` together with the change.
- Read the console log with `/usr/bin/curl -s "127.0.0.1:19113/api/ps5/klog?addr=$PS5_ADDR"`. Each read returns only the lines since the previous read. Startup lines carry `at <ms>`.

## When it fails

- **unreachable:** check the Mac's network with `ifconfig | grep "inet "`. It must be on the console's subnet, not a phone hotspot.
- **A home-screen icon or splash that doesn't change:** the system caches them. Remove and register the title again through ShadowMount.
- **Generated catalog missing:** run `node native/scripts/prepare.mjs` first.
- **No catalog at …:** clone `overdrive-catalog` there or set `OVERDRIVE_CATALOG_DIR` in `config.local`.
