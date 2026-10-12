# Downloads and format handling

The native app downloads all five formats found in the supplied catalogs:
`ffpkg`, `exfat`, `ffpfs`, `ffpfsc`, and `fpkg`. It also accepts direct PKG,
archive and general binary releases. Download support and installation support
are distinct capabilities.

## Destinations

| Artifact | Selected root + destination | Completion state |
| --- | --- | --- |
| FFPKG / exFAT / FFPFS / FFPFSC images | `homebrew/<filename>` | Ready to install; ShadowMount installs it once no game is open |
| PKG / FPKG packages | `downloads/packages/<filename>` | PKG installer required |
| ZIP / RAR / 7z / TAR archives | `downloads/archives/<filename>` then `downloads/extracted/<set>` | Extracted automatically |
| Other binary files | `downloads/files/<filename>` | Routed by their bytes (below), else Downloaded |

About 12,300 catalog releases have no extension in their URL or label, so the
importer types them `binary`. After such a download, `Archives.inspect` reads its
leading bytes: a RAR/7z/ZIP/TAR (or gzip/bzip2/xz/zstd) archive is extracted where
it lies, and a PKG (`\x7FCNT`) or an exFAT/UFS2/PFS image moves with its receipt
to `downloads/packages/` or `homebrew/`, exactly as a correctly typed download. A
file with unrecognized bytes stays in `downloads/files/`. The move is recorded
before it happens and completes on the next run if the app closes midway.

Native archive extraction is included. No PKG installer, game launcher or folder-tree
download protocol is included. An already extracted app/game folder can follow
the existing `homebrew/<TITLE_ID>/` workflow. `.fpkg` is not `.ffpkg`: renaming
one does not convert it into the other. Typed releases route by filename; only
`binary` ones are routed by magic bytes, and neither guarantees game compatibility.

## Catalog imports

`scripts/import-downloads.mjs` imports Orbit, Spectrum and repeated Pegasus
feeds. Spectrum is offline, so `prepare.mjs` leaves its sources out of the app
(`DISABLED_HOSTS` in `scripts/sources.mjs`), with every link the audit found
gone. Display metadata merges by title ID/category; provider labels, individual
file URLs, checksums and archive-volume labels remain attached to each release.
Numbered volumes from the same record/provider/variant become one queue job; a
provider spelled two ways ("www.rootz.so", "rootz.so") is one provider.
A repeated part-one sequence starts a separate set; distinct links are never
assumed to be interchangeable mirrors. Missing or ambiguous volume numbers block
submission, as does a link that names another volume than its label.
The feed often lists a set without its last volumes, or from its second:
`scripts/audit-parts.mjs` reads each set's volume names and sizes from the host
pages (VikingFile, AkiraBox, Rootz, 1fichier, MediaFire) into
the catalog's `audits/part-audit/results.json`, and `prepare.mjs` leaves out a set whose
last volume is as large as its first (unless the set reaches the game's size),
whose files are other volumes than their labels say, or with a volume its host
answered 404 twice. Raw-byte manifests and archive volumes remain separate protocols.
Volumes download in order, with individual native verification receipts, and
stream into libarchive without making a joined temporary copy. The user does not
choose individual parts. Completed parts survive a pause and an extraction
failure; a resume or retry skips them without reading them again (each was
verified when it finished) and downloads one again only if its file is gone.
Extracted images move as a completed folder under `homebrew/`; package outputs
explicitly require a PKG installer. Their aggregate title size/hash is not used as
a per-volume check.
Extracted game folders containing `eboot.bin` and `sce_sys/param.json` also move
under `homebrew/`. The app follows up to 16 single-child wrapper directories,
including 3D MiniGolf's two wrappers; multiple candidate folders stay extracted
for manual inspection. ShadowMount registration still runs on the console.

While an archive or a set's first volume downloads, its partial file's headers are
read every few seconds. A RAR first file header, or an xz/zstd block, that declares
a decoder window over the 64 MiB budget stops the download within seconds with
"This archive can't be extracted on the console", instead of after every volume.
7z and ZIP keep their directories at the end, so they are refused only by the
full check that precedes extraction. After a verified extraction, the job's state
is saved and then its archive or volumes and their receipts are deleted, so a game
does not keep twice its size on the drive.

Malformed Pegasus entries/URLs are counted in a generated report. Unsupported
Orbit schemas fail before output is written. Preparation saves per-game release
JSON as package resources, loaded on demand into a six-game cache. Upload the
complete application folder. The game-only download snapshot is tracked. Generated display catalogs,
art caches and per-game resource data are not committed.

## Provider flows

| Flow | Native behavior |
| --- | --- |
| Direct public file | Native range/sequential transport, checksum/size checks and owned-file recovery |
| Spectrum raw-byte manifest | Validates contiguous offsets/count/size, downloads pieces and verifies available hashes |
| MediaFire / VikingFile / AkiraBox public page | Reads only the designated download anchor, checks its final URL with HEAD, then downloads natively. Since 2026-10-08 only MediaFire serves the anchor; AkiraBox and VikingFile gate it behind Turnstile, so they rank with browser sources |
| Buzzheavier public page | Uses the page's download action and HX-Redirect, then checks the final URL; no HX headers reach the file host |
| Human verification, unsupported provider or DataNodes page | Persists `awaiting-browser`, opens the source on request and accepts a manually entered final public file URL |
| Missing / removed file | Remains unavailable or reports HTTP 404/410 with an alternate-source action |

These are public-page adapters, not CAPTCHA bypasses. Provider HTML can change;
a missing download anchor or challenge returns to browser verification. No
external resolver, third-party store installation, browser-memory scan or system
UI modification is required. Browser session cookies are not transferred into
this app; cookie-dependent URLs need another source. HEAD-blocking providers may
also need another source. Archives extract automatically; PKG installation remains a separate capability.
Unsupported encryption or compression fails explicitly and preserves its volumes.

Archive releases can carry `archivePassword`, copied from the source's published
password for that record. Case and brackets are significant. The queue passes it
as `Archives.extract({password})` for both single files and ordered multipart
sets. Conflicting volume passwords block a set. Old saved jobs hydrate missing
passwords from the current catalog only when their source URL matches, preserving
their transfer identity and completed volumes.

The updated native runtime decrypts RAR5 AES-256 headers and data in bounded
buffers before libarchive decompresses them. It retains plaintext file checksums,
validates decrypted header CRCs and enforces the 64 MiB decoder budget before
allocating a decoder. Keyed RAR5 checksums, older encrypted RAR formats and
encrypted 7z remain unsupported and fail without deleting their inputs. ZIP
passwords use libarchive's passphrase support. Both the native host and app bundle
must be rebuilt; an older host does not implement the password argument.

The feed's published password extracted the complete 27,738,532-byte `eboot.bin` and empty
`debug.log` from an approximately 9 MB prefix of 3D MiniGolf's actual encrypted
RAR5, with the original file CRC verified. The test archive retained those source
headers/data and appended a valid end header; the entire game was not extracted.
Other published passwords have not been tested against every archive. A password
that unlocks a link page is not an archive password. Console execution remains
unverified.

Every app file task opts into native HTML rejection. HTML content types and
initial HTML signatures (including fragmented responses) fail before a final
file is published. The source URL and user-supplied final URL retain path/query
case. Only HTTP(S) URLs without embedded credentials are accepted.

Waiting for a browser releases the queue and sleep-prevention claim, allowing
other jobs to run. Circle cancels the URL dialog without changing the task;
confirmation validates the URL and queues resolution. Pause cancels HTTP source
resolution too. A partially written job keeps its identity across URLs: native
checkpoints name the file by size and validator, so an expired signed link can be
replaced. When a page host's link answers HTTP
401/403, the queue resolves the page again (twice at most per resume) and the
partial continues; a final file URL entered by hand continues it too, and native
resume refuses it ("Saved progress can't be resumed") if it serves another file.

## Queue and recovery

`state/download-queue.js` owns the queue outside React screens. One release is
active at a time, on up to 64 connections over 16 MiB ranges: native's per-origin
window starts at 8, grows while the server answers and halves on HTTP 5xx/429 or
dropped connections (archive.org storage nodes refuse ranges past a few dozen), from one server: mirrors stay off to keep heap for images. The queue retains up to 32 jobs. Completed history is reclaimed when
that bound is reached; files are never deleted by that reclamation.

Queue state is written to `downloads.json` through a temporary file and rename,
on the PS5 in `/data/ps5-react/PPSA99058/queue`, beside the downloads rather than
in the app's data folder, which a reinstall wipes. A queue still in
`/download0/overdrive` moves there on load and the old file becomes
`downloads.json.moved`; if both exist, the newer one is loaded. Native `.part`/`.resume` checkpoints preserve durable
ranges independently. State transitions are persisted immediately, sampled
progress about every five seconds. When the app opens again, the job that was
running when it closed (or crashed) resumes first and the waiting ones follow; a
job being paused stays paused. A job whose drive is missing or replaced stays
paused with "Stopped when the app closed", and so does one that was running at
the last two launches without five seconds of progress, so an extraction that
crashes the app cannot crash it at every launch. Pause waits for native cancellation to finish
before the job becomes resumable. Leaving a screen only unsubscribes its UI.
Exiting the app stops the native workers; this app is not a resident downloader.
While a task is queued or running, the queue holds `Power.keepAwake(true)` so
the console does not enter rest mode for inactivity, and releases it when none
is; the Downloads screen says so. A completed or failed task raises the app's
own toast and a system notification (the latter is unavailable on some firmware).

Every app download enables native completion receipts. If the final file was
published before queue completion could be saved, **Resume** or **Retry** checks
the `.complete` receipt's request/storage/inode identity and size (and re-reads
the whole file only when the catalog gave a SHA-256 to check), then restores the
appropriate completed state. A download without an expected hash is never read
back in full to hash it. Recovery does not redownload or
require free space for another copy. Unowned or corrupted final files are
preserved and reported as errors.

Paused or failed tasks expose **Restart from zero (discard partial)** and
**Remove from queue (keep files)**. Restart resets progress and resolves the
source again; this supports sequential providers and stale checkpoints that
cannot resume. Restart waits until native cancellation finishes, compares the
persisted root device/inode IDs and discards only the task's partial and sidecars.
It refuses replaced drives, non-file sidecars and existing final files. Older
tasks without a persisted root identity require manual partial-file inspection.
Removal frees a queue slot and persists the change without deleting any files;
it also works when storage is disconnected. Completed tasks are removed the
same way, keeping their files: that is all the X on a finished row does.
**Delete from disk** is the game page's explicit option (Files deletes a task's
image through it too). It asks ShadowMount's image list (`POST /api/v1/images`)
which of the task's paths are mounted, by path, whatever title they hold: a
mounted image that is deleted keeps its blocks until the mount is released. It
uninstalls the game ShadowMount has for the task's title, then unmounts each
mounted image under the title ShadowMount knows it by (the task's game when its
path is the image's, else the `titleId` in the image's own `sce_sys/param.json`
at the mount's root or one folder below it), and checks the list again for a few
seconds. A release of another region (a catalog's PPSA21564 dumped as PPSA21567)
is registered under its image's title: the install check and the delete find it
by the image's path in that list, ask `games/info` with the image's title, and
keep it on the task as `consoleTitleId`, so the row turns installed and the
delete uninstalls that title before unmounting it. Only once none is mounted does it remove everything the
task put on its drive: the published file or extracted folder, a first
extraction left under `downloads/extracted`, a remaining archive or set folder,
and their receipts and sidecars. A path ShadowMount gives the title is never
deleted: once the task's file is gone, that is another dump of the game. If
ShadowMount lists the game as installed and refuses the uninstall (it answers
busy while a game is open), or still has an image mounted (also when the image
names no title, since ShadowMount unmounts only by title), or answers with an
error, the files and the task stay, and the message says to delete the game from
ShadowMount's web page, which unmounts it first. A ShadowMount that does not answer at all is
not running, so it mounts nothing: the files are deleted, and the log says so. A
second Delete while one runs does nothing. Each step goes to the app log: the
game's path, runtime path and installed, managed and mounted flags, the mounted
images, the uninstall's and unmounts' results, each path deleted (a file with its
size), the drive's free bytes before and after, and the statfs figures
ShadowMount reads (`POST /api/v1/storage`). It checks the drive's
device/inode identity first and only removes paths below
`homebrew/` or a `downloads/` category of the job's own root, with
`FileSystem.removeAsync`, which never follows symbolic links. A new task refuses a
destination another task owns. A `.part` no task owns (its queue was lost) is
adopted by a new task writing to the same path, and counts toward its free-space
check: the transfer resumes it only if its checkpoint matches the new source. Until
the first progress with bytes proves that, the task is marked `adopted`: Cancel
forgets it without discarding the partial, Restart refuses, and a checkpoint
mismatch fails with a message to resume it from its original source or delete it
in Files, since it may be another source's file with the same name.

The **Downloads** screen (header) lists every task with its progress, speed and
time left. **Cancel** asks for a second press, pauses an active task and waits
for native cancellation, then discards the partial and sidecars under the same
checks as Restart and forgets the task; a set's whole folder under
`downloads/sets/` goes, complete volumes included, with what it extracted while
downloading under `downloads/extracted/` unless that was already published. A task that never reached storage has
no partial to discard. If the checks refuse, the task stays listed with the
error; **Remove from queue** still keeps its files.

Every delete of a partial, an archive, an extracted game or the update's work
folder runs off the render thread (`FileSystem.removeAsync`, PS5 React ABI v8):
a file of several GB once held the screen for seconds. While Cancel, Restart or
Delete from disk deletes, the task reads **Deleting files** (state `removing`),
keeps its place in the list and accepts no other action, and an active task
keeps the queue's slot until the delete ends. A delete that fails puts the task
back as it was, with the reason as its error and in the app log; one the app
closed during comes back as it was, asking to delete it again.

The app checks available space at submission when the catalog knows the size,
before each transfer and set volume, and before extraction. An archive reserves
twice its size (the download plus what it extracts to); queued, running and
paused jobs on the same drive hold back what they still need. Failed jobs and
jobs waiting for a browser hold nothing until retried, and neither does a stopped
job whose partial was deleted outside the app: its row says to restart it. Sets have no catalog size: before each
volume the queue estimates the remaining volumes and the extraction from the
volume sizes seen so far (an unknown volume counts as the largest known one).
Shortfalls fail with "Not enough space…" and keep the partial. The native engine
detects write errors (a full disk reads "Not enough free space"), validates
selected-root device/inode identity during writing, and does not overwrite
existing final files. Reconnect the original disk for resume; a new device/root
identity is rejected. Without a strong ETag, ranges are guarded by Last-Modified,
or by size alone, and a resume first re-reads the last 64 KiB kept and compares
it. Only a server without range support uses the sequential fallback, which
cannot resume.

## ShadowMount handoff

Downloaded images are published under `homebrew/` only after size/hash checks.
`.part` and `.resume` sidecars do not use supported image extensions. ShadowMount
can discover finalized images through its configured scan roots and stability
wait. Press **Scan with ShadowMount** to check the local v1 API's `rescan`
capability and request `POST /api/v1/scan`. The default endpoint is loopback port
10101. A failed or unavailable API leaves the completed file intact; automatic
scanning remains available if configured in ShadowMount.

Successful rescan submission means registration is pending: ShadowMount
registers it once no game is open, so after Overdrive closes. The task becomes
**Installed** only when ShadowMount's info for the job's title
(`POST /api/v1/games/info`) shows its image path, or a source ShadowMount manages
with that title ID, as `installed`. The queue asks one title at a time, only when
the Downloads screen or the game's page opens, never at launch; an image already
installed is not scanned again. It never asks for the full game list
(`POST /api/v1/games`): ShadowMountPlus 1.7beta4 builds it inside SceShellCore
from every installed game and PKG, and 0.0.103, which asked at launch, crashed
consoles.
PKGs remain outside the auto-mounter's image roots. Extracted images are published
only after all extraction checks pass.

References reviewed: [Orbit 0.2.0-beta.3](https://github.com/saawant12/orbit-store-ps5/releases/tag/v0.2.0-beta.3)
for persistent queue/storage identity and finalized filenames;
[ShadowMountPlus source](https://github.com/drakmor/ShadowMountPlus/tree/4cde42a2293756132735d8e4280eb71f089865ee)
for formats and scan behavior;
[its API](https://github.com/drakmor/ShadowMountPlus/blob/4cde42a2293756132735d8e4280eb71f089865ee/docs/api.md)
for capability detection and POST routes. The console's installed version may
have different capabilities.

## Multipart validation and catalog limits

The catalog contained 2,073 games and 22,695 releases when this was last counted
(2026-10-08). Its labels produce 4,568 candidate archive sets; 212 have
missing/ambiguous numbering and are blocked.
Split Fiction includes separate three-part and eight-part AkiraBox sequences
with identical labels. They must not be combined. Labels and aggregate sizes do
not establish that a provider file really is an archive volume or a complete game.
An incorrect archive set fails extraction and retains its inputs for inspection.

Local tests use small generated ZIP/TAR/7z and upstream multivolume RAR fixtures;
no commercial game downloads are required. These checks do not establish live
provider availability or PS5 execution. Live probes resolved MediaFire; the tested
AkiraBox/VikingFile/Buzzheavier pages required verification. AkiraBox returned
HTTP 403 for the examined Split Fiction links, so their actual contents remain
unverified. Do not describe every provider as automatic.

## Interface decisions

The existing Overdrive components are the visual reference: preserve its dark
canvas, Inter type, accent primary button, visible focus ring and translating
progress fill. The download row remains one stable focus target while labels
change. Source/storage selection uses the existing outlined control treatment.
The Refero craft references inform truthful completion/error copy and bounded
lists; pagination keeps the established card layout and avoids loading hundreds
of hidden cards. No new artwork is baked for the complete imported catalog.

## Validation

```sh
node --test native/scripts/*.test.mjs native/state/*.test.mjs native/search/*.test.mjs native/downloads/*.test.mjs
cd ../../ps5-react
npm test
npm run build -- --app-dir ../personal/game-store/native
```

Local tests exercise queue lifetime, serialization, pause/restart, failed sources,
storage checks, format routing, binary routing by magic bytes (and a move cut
short), early archive refusal, re-resolving an expired signed link, a full disk
mid-transfer, set space estimates, a disconnected or replaced drive, recovery of a
process killed mid-transfer (auto-resume and its crash-loop guard), sets skipping
finished volumes, deletion of a job's whole tree, native multipart offset writes,
source range fallbacks, SHA-1/SHA-256 failures, bounded buffers and resumable
cancellation. The native harness (`tools/test_network.py` in PS5 React) covers
resuming from a new signed URL after a 403, Last-Modified and validator-less
resume with its tail check, a full disk and a SIGKILL mid-transfer.
Build verification checks ELF/SELF, metadata and packaging. These do not establish
PS5 network operation, actual throughput, storage-disconnect behavior or successful
ShadowMount registration. Hardware evidence must identify the exact artifact,
firmware and loader. No console upload or launch is part of these commands.

### Native macOS preview evidence

The complete imported catalog opened and navigated with 1,285 entries and
36,134 release variants. Local loopback fixtures exercised direct downloads,
a MediaFire-shaped public page, browser-waiting UI and two-piece manifests.
The three completed 512 KiB files matched the expected SHA-256; the manifest
also checked its piece hashes. The source chooser and final-URL keyboard were
operated with simulated controller keys. A missing-source fixture exposed a
masked HTTP 404, now covered by a native transport regression test.

These were synthetic files, not real games. Real provider sessions, archive
extraction, package installation, ShadowMount registration and the updated
PS5 application have not been validated on hardware. No console was accessed.


## Vikingfile browser capture

The selected `/f/<id>` page supplies the real filename and displayed size;
synthetic catalog `.binary` names are not used for matching. The app requests
`BrowserCapture.capture` from PS5 React, then opens the page. Complete provider
verification and select Download, then return to Overdrive. The modal uses the
existing shimmer loading treatment and closes after successful validation.

Only `https://vikingfile.com/d/<10 alphanumeric characters>/<selected filename>`
is accepted. A bounded GET with `Range: bytes=0-0` must return HTTP 206,
exactly one byte, a nontext file type and a total `Content-Range` size matching the catalog's exact size, or the public page's rounding interval when
no exact size exists. Up to five HTTPS redirects are accepted only to Orbit's
Vikingfile/OVH/R2 storage hosts. A response filename, if supplied, must match.
A strong ETag or valid Last-Modified is required. The native
transfer receives the measured exact size. The selected destination is retained
and binary downloads keep existing byte-based routing.

Link pages (link-vault, filecrypt...) whose label or URL fragment names
VikingFile capture too, with no page to read first: any `/d/<id>/<filename>` is
taken, its filename must carry the release's `part N` when the label has one,
and the size must be within 1 GiB of the catalog's (rounded) size when known.
This needs the PS5 React capture payload to accept an empty filename (`/`).

Capture reserves the queue until validation, so a short-lived URL starts before
other waiting downloads. If another task is active, wait for it before opening
Vikingfile. Capture, metadata and validation failures offer Enter file link;
closing, switching to manual entry, removing or restarting cancels capture.
Late results cannot revive a removed task. Restarts never restore an old capture.
Each archive volume verifies separately. No CAPTCHA bypass or external resolver.

Payload provenance and limits: PS5 React's
`native/ps5/payloads/browser/README.md`. Local tests/build passed; the real
CAPTCHA-to-download flow requires validation on the exact console and loader.
