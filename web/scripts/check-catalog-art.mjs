import { readFile, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { catalogPath, requireCatalog } from '../../native/scripts/catalog-dir.mjs'

requireCatalog()
const file = catalogPath('store/games.json')
const games = JSON.parse(await readFile(file, 'utf8'))
const source = JSON.parse(await readFile(catalogPath('store/spectrum.json'), 'utf8')).packages
// Steam can return HTTP 200 for a plain gray placeholder. Reject its actual bytes.
const PLACEHOLDERS = new Set(['574128283765e00dd4eef95efaa40f54aa60fda25ad01a56b265a8b1d0c655cd'])
const checks = new Map()
const accessible = (url) => {
  if (!url) return Promise.resolve(false)
  if (!checks.has(url)) checks.set(url, (async () => {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(15000) })
      if (!response.ok || !response.headers.get('content-type')?.startsWith('image/')) return false
      const bytes = Buffer.from(await response.arrayBuffer())
      return bytes.length > 0 && !PLACEHOLDERS.has(createHash('sha256').update(bytes).digest('hex'))
    } catch { return false }
  })())
  return checks.get(url)
}
const firstAccessible = async (urls) => {
  for (const url of [...new Set(urls.filter(Boolean))]) if (await accessible(url)) return url
  return null
}
let cursor = 0
let replaced = 0
const missing = []
async function worker() {
  while (cursor < games.length) {
    const game = games[cursor++]
    const entry = source.find(p => p.category === 'game' && p.titleId === game.id)
    const cover = await firstAccessible([
      game.images.cover,
      game.images.cover.replace('_2x', ''),
      entry.posterUrl,
      game.images.header,
      ...game.screenshots.slice(0, 1),
    ])
    if (cover) {
      if (cover !== game.images.cover) { replaced++; console.log('Fixed cover:', game.title) }
      game.images.cover = cover
    } else missing.push({ id: game.id, title: game.title, url: game.images.cover })
    game.images.hero = await firstAccessible([game.images.hero, game.screenshots[0], game.images.header, entry.backUrl, cover]) || game.images.cover
    if (game.images.logo && !await accessible(game.images.logo)) game.images.logo = ''
  }
}
await Promise.all(Array.from({ length: 6 }, worker))
await writeFile(file, JSON.stringify(games, null, 2) + '\n')
await writeFile(catalogPath('store/missing-art.json'), JSON.stringify(missing, null, 2) + '\n')
console.log(`Validated ${games.length} covers and backgrounds; ${replaced} covers fixed; ${missing.length} covers still missing.`)
