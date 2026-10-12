# Native app changelog

## Unreleased

- Take every Rootz and AkiraBox source out of the catalog, however a feed spells
  or wraps the link, so a re-import cannot bring them back. A game left with no
  other source leaves the store. A download of theirs saved by an earlier
  version opens in the browser.
- Delete partials, archives, extracted games and the update's leftovers off the
  render thread, so Cancel, Restart, Delete from disk and Files no longer freeze
  the screen for seconds on a large file. A task reads Deleting files until its
  delete ends; a delete that fails keeps the task with the reason. Needs PS5
  React with `FileSystem.removeAsync`.
- Show English text when a language file cannot be read, as on a console where
  the runtime pointed the app folder at another sandbox: English now ships in
  the bundle, and the screen showed raw message keys.
- Mark a finished image installed once ShadowMount's game list shows it, at
  launch and on the Downloads screen and game page, instead of leaving it Ready
  to install. Its row's X takes it off the list without deleting the game, and
  an installed game's page offers Remove from queue and Delete from disk, which
  uninstalls the title ShadowMount registered and keeps the files of an installed
  game whose uninstall it refuses.
- Treat any HTTP answer from ShadowMount's API as running, and ask again on the
  next screen after a failed probe instead of reusing it for 30 seconds.
- Store mode 0777 for every release ZIP entry for manual installation. In-app
  updates also open the existing install root without traversing retained files.

- Validate captured Vikingfile links using a one-byte GET and checked storage
  redirects instead of HEAD. Report capture phases and memory-read failures.
- Hand validated captures directly to the native downloader without a second
  HEAD request. Preserve visible recovery for storage/queue-save handoff failures.

- Capture a selected Vikingfile file URL after the user's browser verification;
  validate its name, type and size, then start immediately. Show verification
  instructions with shimmer and retain manual link entry on failure.

- Downloads typed `binary` (no extension in the catalog) are routed by their bytes:
  archives are extracted, PKGs and images move to where they belong. An archive
  whose first headers need more than the console's 64 MiB decoder budget stops
  within seconds of starting.
- Expired page-host links are resolved again and the partial continues; a hand-entered
  link continues a partial too. Servers without strong ETags resume.
- Verified extractions delete their archive or volumes; Delete from disk removes a
  job's whole tree. Archives reserve room to extract, sets estimate theirs per volume.
- Resuming a set skips finished volumes, and finished downloads without an expected
  hash are no longer read back to hash them.
- The download that was running when the app closed resumes when it opens again.

- Scroll the whole catalog instead of paging it: browse and search render
  results through `VirtualList`, which keeps only the rows around the viewport
  and focus mounted, and browse loads eight more rows as focus nears the end.

- Load all store artwork by URL at runtime instead of baking it into the
  eboot (46 MB to 32 MB): covers, heroes, logos and screenshots for every
  catalog entry with art, not only a 14-game selection. The spotlight prefetches
  the next slide's art and the gallery its other shots.
- Accept Orbit schema-1 release envelopes and its complete v0.7.0 catalog.
  Preserve existing release IDs for the compatible Archive.org ordering, retain
  genre metadata, and reject browser-only Vikingfile sources from native downloads.

- Recover published files after interrupted queue saves through native completion
  receipts and full SHA-256 verification. Add explicit restart-from-zero and
  removal of paused/failed tasks, preserving final files and releasing queue slots.

- Replace simulated installation with real native downloads, persistent release
  queue, pause/resume, source and storage selection, and actionable failures.
- Import complete Orbit/Spectrum catalogs while retaining format/version variants
  and separate add-on entries. Keep artwork bounded and paginate catalog/search.
- Route image formats to ShadowMount roots and packages/archives to staging
  directories. Expose capability-checked ShadowMount rescan after download.
  Installation and extraction remain external, and completion no longer claims
  the game is installed or ready to launch.
