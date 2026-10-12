# Upgrade fixtures

What each shipped version leaves on a console, in the shapes its writers saved (`download-queue.js`, `saved.js`, `i18n/index.js`, `updater.js` at that version). `data-dir/` is the app's data folder (`/download0`), `queue-dir/` the queue's folder (`/data/ps5-react/PPSA99058/queue`). `native/state/upgrade.test.mjs` loads every set through this build's readers, and `native/scripts/smoke-launch.mjs` opens the app over each one.

Every queue holds jobs in each state it can save: queued (with a fallback source), downloading, paused, pausing, failed, downloaded, file-downloaded, extracting, installing, installer-required and a split set mid-download (one volume complete, one partial, one not started), on `/data` and `/mnt/usb0`.

| Version | Also covers |
| --- | --- |
| 0.0.89 | First GitHub release: the queue only in the data folder, no browser captures, adopted partials or install marks; settings without a language. |
| 0.0.103 | Queue moved to the queue folder, the old file left as `downloads.json.moved`; an adopted partial, a Vikingfile job awaiting the browser mid-capture, an installed job with its title id. |
| 0.0.106 | A console left in ShadowMount's sandbox: the queue stayed in the data folder and `/data` jobs carry the sandbox's device number; an image update's `pending-image.json`. |
| 0.0.108 | An update marker counted on two launches (the old image still mounted). |
| 0.0.109 | A `downloads.json.tmp` whose rename never ran, and files kept aside as `.unreadable-<time>` by a damaged launch. |
| 0.0.108.4-beta | A RAR set extracting while it downloaded, every volume complete. |
| 0.0.109.1-beta | Also a set that was running at each of the last two launches, which stays paused. |
| 0.1.4 | The release in production. Also an extracted game folder moved to `homebrew/` (artifact, output and publishTo all naming it), ready and installed, a dump whose game and backport PKGs wait for the installer with an install cut short, a binary download caught moving to the kind its bytes revealed (`routing`), and a Vikingfile capture that failed. Also AkiraBox and Rootz downloads (one queued, two paused) from before those hosts left the catalog. Same saved lists as 0.0.109.1-beta. |
