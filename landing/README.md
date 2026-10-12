# Overdrive landing

An optional Next.js showcase page for Overdrive. It is not deployed and nothing in the app or the release flow depends on it.

Its game list and spotlight come from the private catalog, so they are not committed. Generate them first, from the repository root:

```bash
node native/scripts/prepare.mjs        # needs the overdrive-catalog checkout (OVERDRIVE_CATALOG_DIR)
node landing/scripts/build-games.mjs   # writes public/games.json and src/lib/spotlight.json
```

Then, in `landing/`:

```bash
npm install
SITE_URL=https://your.domain npm run build   # SITE_URL defaults to http://localhost:3000
npm run dev
```

The Inter font in `src/fonts/` is under the SIL Open Font License (`src/fonts/OFL.txt`).
