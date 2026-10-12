import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// The store data lives in the private catalog, as for native/scripts/catalog-dir.mjs.
const catalog = resolve(process.env.OVERDRIVE_CATALOG_DIR || fileURLToPath(new URL('../../overdrive-catalog', import.meta.url)))

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { alias: { '@catalog': catalog } },
})
