# Overdrive native app

Overdrive runs on PS5 React with QuickJS and the Embedded React software
renderer. The title ID is `PPSA99058`, with a 1920×1080 render and surface.

## Prepare and run

The catalog (store data, download links, overrides and link audits) is kept in
the private `overdrive-catalog` repository and only enters the build. Clone it
beside this repository (`../overdrive-catalog`) or point `OVERDRIVE_CATALOG_DIR`
at its checkout, then generate app resources with `node native/scripts/prepare.mjs`;
without it, prepare stops and says where it looked. `native/data/sample` is a small
fictional catalog in the same layout (`scripts/catalog-dir.mjs`) for development
and tests: `OVERDRIVE_CATALOG_DIR=native/data/sample node native/scripts/prepare.mjs`.
The 2026-10-08 snapshot holds 2,134 game entries and 36,928 release options, not
all verified; the app shows 1,856 game cards from it.

The direct-source expansion adds 40 game images and 4 compressed game archives
across 43 title IDs. Bloody Roar 2 is a PS5 conversion of the classic; MultiVersus
gains the PPSA03189 variant. HTTP range reads and file sizes were verified, but
console execution was not. Provenance and import details are retained in the
catalog's `audits/ps5-direct-discovery/`.

### Catalog pipeline

`prepare.mjs` reads, from the catalog unless noted:

| Input | Role |
|---|---|
| `store/games.json` | The original store's games and their store data |
| `downloads/download-catalog.js` | Download sources per title ID (from `import-downloads.mjs`) |
| `overrides/metadata-overrides.json` | Descriptions, dates, genres and art from store pages |
| `overrides/artwork-overrides.json` | Compatible covers |
| `audits/direct-link-audit/results.json` | The last link audit: dead links and server errors |
| `audits/part-audit/results.json` | The last part audit (`scripts/audit-parts.mjs`): multipart sets the feed cut short |
| `.art/logos.json` (untracked cache) | Logo measurements from `scripts/logos.py` |
| `.art/tints.json` (untracked cache) | Cover placeholder colours from `scripts/tints.py` |

It then:

- Leaves out sources on `DISABLED_HOSTS` in `scripts/sources.mjs` (Spectrum is
  offline; Rootz and AkiraBox are out of the store) and links the audit found gone (404/410, 401/403, a web page instead
  of a file), and every volume of a set the part audit found cut short. A game
  left with no source is dropped everywhere, the landing
  included. Add a host to that list to switch it off.
- Names each source by a hash of its link, label and platform, so a re-import
  keeps saved downloads matched; jobs saved under the older feed-position ids
  match by link.
- Groups entries into works by a normalized title (`scripts/works.mjs`): PS4 and
  PS5 editions share a card's version sheet, and each platform keeps one card;
  its other entries (mostly regions) open from that sheet.
- Drops release dates after the build day, rewrites archive.org storage-node
  covers to `/download/` and fills missing sizes from the default download.
- Writes what it dropped or flagged to `data/prepare-report.json`, then runs
  `scripts/validate.mjs` and fails on an error: a future date, a shipped dead or
  disabled source, a game without a usable source, two cards for one work and
  platform, or a cover on a storage node. Run it alone with
  `node native/scripts/validate.mjs`.

After a catalog change, rebuild the landing's library with
`node landing/scripts/build-games.mjs`.

The reviewed expansion adds 864 PS4 entries, 8 PS5 entries and 6 native PS5
homebrew games. Hitman GO and Just Deal With It! are excluded because Sony lists
them as PS4-only. Unverified live-page leads and coming-soon releases are excluded.
The selection and provenance are retained in the catalog's `downloads/catalog-additions.json`.
To apply that selection to an older snapshot without replacing existing sources:

```sh
node native/scripts/merge-catalog.mjs --input "${OVERDRIVE_CATALOG_DIR:-../overdrive-catalog}/downloads/catalog-additions.json"
node native/scripts/prepare.mjs
```

Reapplying the selection does not add duplicates. Title-ID collisions fail before
writing the catalog. PS4 and PS5 editions retain separate IDs and platform metadata.
PS4 PKG downloads finish in the existing `installer-required` state: automatic
PKG installation is not implemented. Native homebrew ZIPs extract to a folder;
copy the app folder to `/data/homebrew` and register it with a compatible loader.
Quake, Quake II and OpenRCT2 require separately supplied game data; DOOM includes
the shareware episode. These new entries have not been hardware-tested, and
backward compatibility does not establish compatibility of an individual package.

To replace the snapshot (the catalog's `downloads/download-catalog.js`), import user-supplied catalogs and generate app data:

```sh
node native/scripts/import-downloads.mjs --orbit /path/to/orbit/catalog_json.json --spectrum /path/to/spectrum/catalogo_app.json --pegasus /path/to/pegasus/catalog.json
node native/scripts/prepare.mjs
node --test native/scripts/*.test.mjs native/state/*.test.mjs native/search/*.test.mjs native/downloads/*.test.mjs
cd ../../ps5-react
npm run preview -- --app-dir ../personal/game-store/native
npm run build -- --app-dir ../personal/game-store/native
```

The paired download worktrees retain this relative directory layout. Generated
app resources, artwork, dependency caches and binaries are excluded from version control.
The download catalog snapshot is tracked; the generated display bundle and
per-game release resources are regenerated locally.

Orbit v0.7.0 publishes `catalogue-v2.json` with a `{schemaVersion, revision,
releases}` envelope; pass that file to `--orbit` for its complete Archive.org and
Vikingfile listing. Legacy record arrays are still accepted. Browser-only
Vikingfile options may need **browser verification**. Public provider pages resolve in-app when they expose a usable file link.
Human-verification pages wait in the queue. Vikingfile pages expose the selected
filename and rounded size before verification: the app starts a bounded,
read-only browser URL capture and opens the PS5 browser. Complete verification,
select Download, then return to Overdrive. A matching URL is validated with HEAD
and starts immediately. Failed capture falls back to the controller URL keyboard.
Other browser hosts still use manual file links. Cookies and browser dumps are
not collected; only the matching Vikingfile route is returned. No external resolver/server is required.
The framework build outputs the complete `dist/PPSA99058/` application folder.
It does not upload to or launch anything on a console.

`prepare.mjs` preserves the complete catalog and all release variants. Artwork
stays on the store's CDN: the catalog carries image URLs that the app loads at
runtime (`<Image source={{uri}}>`), so nothing is baked into the build. Only logo
metadata (aspect ratio, dark ink) is measured once by `scripts/logos.py` and
cached in `.art/logos.json`. The native decoder supports PNG/JPEG, not WebP.
Like next/image, each image is asked for at the size it is drawn: Sony covers
at `w=384` and screenshot thumbnails at `w=256`, and archive.org covers go after
any copy on a faster CDN. Each cover's mean colour (`art.tint`, measured once by
`scripts/tints.py` and cached in `.art/tints.json`) fills its box, the hero's
and the spotlight's until the art arrives.
`data/artwork-overrides.json` supplies compatible covers matched by product ID
or normalized title, plus up to three alternate URLs. Sony URLs request bounded
image sizes to avoid the decoder's 5-megapixel source limit. Failed covers try
the next URL; entries with no working art use title tiles.

To refresh the tracked artwork map, download the public metadata sources listed
in its `sources` field, then run:

```bash
node native/scripts/resolve-artwork.mjs --psn /path/to/psn.json \
  --homebrew /path/to/homebrew.json --compatibility /path/to/compat-index.json
node native/scripts/prepare.mjs
```

The resolver selects format-compatible URLs; it does not guarantee that every
remote image remains reachable.
Browse and search scroll the whole catalog: a `VirtualList` keeps only the rows
around the viewport and focus mounted, and browse loads more cards as focus
nears the end. To run without source catalogs,
`node native/scripts/prepare.mjs --placeholder` generates the existing sample
catalog; its entries have no real download source.

## Metadata enrichment

`data/metadata-overrides.json` stores supplemental descriptions, publisher,
developer when available, console release dates, individual genres, backgrounds
and screenshots with per-entry source URLs. It never changes title IDs,
platforms, download releases, sizes or cover selections. Missing data stays
missing; release/password notes are not shown as game descriptions.

Matching uses a PlayStation product ID first, then an exact normalized title.
Edition and console suffixes can be omitted, but sequel numbers and expansion
names remain distinct. PlayStation pages must identify the requested full game
or game bundle; Steam results must be a unique exact match and a full game.
Steam PC release dates and feature tags are not applied to console editions.

To refresh all entries, download the public PSN index linked in the artwork map:

```bash
mkdir -p native/.art
node native/scripts/metadata-input.mjs > native/.art/metadata-input.json
python3 native/scripts/enrich-steam.py --input native/.art/metadata-input.json --psn /path/to/psn.json
python3 native/scripts/enrich-metadata.py --input native/.art/metadata-input.json --psn /path/to/psn.json
node native/scripts/prepare.mjs
```

Both collectors cache progress in `native/.art/`. Failures are recorded there
and supplemental metadata gaps are listed in the tracked snapshot. Add
`--homebrew /path/to/homebrew.json` to enrich native homebrew games from the
homebrew.page snapshot. Use `--offline` on the metadata collector to regenerate
from caches without contacting the stores. Add `--alternates` to try other
matching product pages for entries whose first page is unavailable. Validate
with `python3 native/scripts/test_metadata.py` and
`node --test native/scripts/metadata.test.mjs`. The snapshot is build-time data;
browsing does not make store API requests. If a background fails at runtime,
the detail page tries screenshots of the same game.

## Downloads

See [DOWNLOADS.md](DOWNLOADS.md) for formats, storage, queue lifetime, source
selection and hardware validation. Networking and console filesystem access
are enabled in `app.json`; successful filesystem elevation and a compatible
loader remain required on PS5.

The app shows real native progress. Closing a game screen does not stop a
queued task. Pause preserves eligible checkpoints. Interrupted tasks remain
paused after app restart. Exiting the application stops its workers; background
downloading after app exit requires a separate resident service and is not
implemented here.

Desktop controls: arrows, Enter, Backspace and Escape. PS5 controls: D-pad,
Cross, Circle and Options. Native download and ShadowMount integration still
require validation on the exact console firmware and loader.

## Complete catalogs without a large JavaScript heap

The importer accepts repeated `--pegasus` flags alongside Orbit and Spectrum.
Preparation writes one `data/releases/<id>.json` per title and keeps only display
metadata in the bundle; each game page's description and screenshots load from
`data/pages/<id>.json`. The current game's release list is parsed on demand,
with a six-game cache; app.json packages the directory through `resources`.
Always upload the complete built folder, including `data/releases` and `data/pages`.

Use the source chooser to select a mirror, format or archive volume; ten rows
are mounted per page. Every source retains its original label. Malformed Pegasus
records/URLs are reported in `import-report.json` beside the imported catalog; the report does
not include URLs. Generated display catalogs and resource data are excluded from Git; the
download catalog snapshot is tracked in the catalog repository.

See [provider behavior and limitations](DOWNLOADS.md#provider-flows).
