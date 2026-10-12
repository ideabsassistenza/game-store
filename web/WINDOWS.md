# Overdrive Windows 0.1.0 preview

A standalone Windows x64 adaptation of Overdrive's React storefront. It reuses the upstream visual design, artwork views, search, genre filters, favorites and keyboard navigation. A new Electron host performs real file downloads. OmniPC is not required.

## Start

Extract the complete `Overdrive-Windows-0.1.0-x64.zip` into a folder, then run `Overdrive Windows.exe`. Keep the DLLs and resources beside the executable. This preview is unsigned.

The storefront starts empty because the original Overdrive catalog is private and excluded from the public source. No subscription, account or PS5 is needed for this app. It does not emulate or launch games.

Choose **Import catalog** and select a JSON file. The catalog is copied into your local app data and loaded on subsequent launches. Choose **Download folder** to set where files go. Open a game and press **Download file**. Download history provides cancellation, retry and **Show file**.

Keyboard: arrows move focus, Enter activates, Escape/Backspace goes back. Standard gamepads support D-pad/left stick, A to activate and B to go back; controller hardware remains unverified.

## Catalog format

Accepts a JSON array or an object with a `games` array. Minimum fields are `id` and `title`. IDs must be unique and contain only letters, digits, underscores or hyphens. Details and artwork are optional. Sources are direct HTTPS file URLs, without embedded credentials.

```json
{
  "games": [
    {
      "id": "my-game",
      "title": "My game",
      "platform": "Windows",
      "shortDescription": "A game in my own catalog.",
      "about": "Description shown on the detail page.",
      "developer": "Developer",
      "publisher": "Publisher",
      "releaseDate": "2026-10-12",
      "genres": ["Adventure"],
      "features": ["Single-player"],
      "images": {
        "cover": "https://example.com/cover.jpg",
        "hero": "https://example.com/hero.jpg"
      },
      "downloadUrl": "https://example.com/my-game.zip",
      "fileName": "my-game.zip"
    }
  ]
}
```

The URLs above are examples, not working games. Optional `sha256` must be a 64-character hexadecimal SHA-256. Optional `sizeGb`, `metacritic`, `recommendations`, `ageRating` and `screenshots` retain the upstream metadata model. Upstream `store/games.json` metadata can be imported directly, but that file does not necessarily contain download sources. Invalid catalogs are rejected without replacing the current catalog. Maximum import size is 32 MB and 50,000 entries.

## Download behavior and limits

- Real bytes stream to disk, with byte counts and progress when a server supplies a length.
- Each transfer gets its own folder. Existing files are never replaced.
- A `.part` file is accepted only after the stream finishes, its size matches the server when known, and its optional hash matches. Computed hashes are saved in history.
- Server errors, HTML landing pages, invalid redirects and hash mismatches are shown as failures. A direct source is required; host-browser capture is not implemented.
- Quit interrupts transfers. On restart these are marked **interrupted**. Retry starts from the beginning. Partial files are retained in their task folder and overwritten on retry.
- The app does not extract archives, install packages, execute downloaded files or determine emulator compatibility. Downloading a PS5 title does not make it playable on Windows.
- This release does not bundle the private upstream catalog or scrape the PS5 release binaries to recover it.
- Local settings, catalog and transfer history live in Electron's `Overdrive Windows` user-data folder. Favorites use renderer local storage. Download files stay in the selected download folder.

## Development

```powershell
cd web
npm ci
npm run test:desktop
npm run build
npm start
npm run dist:windows
```

Node.js 22 or newer is recommended. `dist:windows` creates a Windows installer and ZIP; the GitHub Windows build workflow tests and uploads both without publishing a release. For a Linux build machine, `npx electron-builder --win zip --x64 --publish never` can produce the ZIP.

## Validation

Automated tests cover schema validation, real transfer bytes and redirects, hash rejection, HTML/server failure, cancel and retry, interrupted history recovery, damaged JSON preservation and destination isolation. Production renderer typecheck and build pass. Native Windows execution, dialogs, gamepad hardware and installer behavior still need a real Windows test. A native Electron smoke harness is included, but it could not run here because this host blocks Chromium operating-system sockets. No successful desktop launch is claimed.

## License and attribution

GPL-3.0-or-later with upstream attribution requirements. Overdrive was created by half144 and contributors and derives from Orbit Store. Original: https://github.com/overdriveps5/game-store. Windows source: https://github.com/onlykappa/game-store/tree/windows-port. Preserve LICENSE, LICENSE-ATTRIBUTION and NOTICE when redistributing. Geist font license is included as `dist/Geist-OFL.txt`.
