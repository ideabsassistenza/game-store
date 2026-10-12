import { readFile, writeFile } from 'node:fs/promises'
import { catalogPath, requireCatalog } from '../../native/scripts/catalog-dir.mjs'

requireCatalog()
const dataFile = (name) => catalogPath(`store/${name}`)
const catalogPath = process.argv[2]
const catalog = JSON.parse(await readFile(catalogPath || dataFile('spectrum.json'), 'utf8'))
if (!Array.isArray(catalog.packages)) throw new Error('Invalid Spectrum catalog')
const titleAliases = JSON.parse(await readFile(dataFile('steam-aliases.json'), 'utf8'))
const cache = JSON.parse(await readFile(dataFile('steam-cache.json'), 'utf8'))
const aliases = new Map([
  ['sea of stars sunset edition', 'sea of stars'],
  ['wrc generations the fia wrc official game', 'wrc generations'],
])
const normalizeTitle = (title) => title.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f®™’']/g, '').replace(/\b(digital deluxe|deluxe|definitive|enhanced|ultimate|complete|standard|premium|gold|game of the year|goty|director[’']?s cut)\s*(edition)?\b/g, '').replace(/[^a-z0-9]+/g, ' ').trim()
const normalize = (title) => {
  const name = normalizeTitle(titleAliases[title] ?? title)
  return aliases.get(name) ?? name
}
const stripHtml = (html = '') => html.replace(/<br\s*\/?>|<\/(p|li|h\d)>/gi, '\n').replace(/<[^>]+>/g, '').replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ').trim()
const unique = new Map()
const seenTitles = new Set()
for (const entry of catalog.packages) {
  if (entry.category !== 'game' || !entry.titleId || !entry.title || !entry.posterUrl) continue
  const titleKey = entry.title.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f®™]/g, '').replace(/[^a-z0-9]+/g, ' ').trim()
  if (unique.has(entry.titleId) || seenTitles.has(titleKey)) continue
  unique.set(entry.titleId, entry)
  seenTitles.add(titleKey)
}
const previousReport = JSON.parse(await readFile(dataFile('steam-matches.json'), 'utf8').catch(() => '[]'))
const entries = [...unique.values()]
const games = new Array(entries.length)
const report = []
const fetchJson = async (url) => {
  for (let attempt = 0; attempt < 3; attempt++) {
    const response = await fetch(url, { signal: AbortSignal.timeout(15000) })
    if (response.status === 429 && attempt < 2) {
      console.warn('Steam rate limit; waiting 45 seconds before retry')
      await new Promise(resolve => setTimeout(resolve, 45000))
      continue
    }
    if (!response.ok) throw new Error(`Steam HTTP ${response.status}`)
    return response.json()
  }
}
const toDate = (value) => {
  const date = new Date(`${value} 12:00 UTC`)
  return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10)
}
for (const [index, entry] of entries.entries()) {
  const name = normalize(entry.title)
  let steam = cache.find((game) => normalize(game.title) === name)
  let status = steam ? 'cached' : 'unmatched'
  try {
    const previous = previousReport.find(result => result.titleId === entry.titleId)
    const alreadyUnmatched = previous?.status === 'unmatched' && !titleAliases[entry.title] && !['Sea of Stars', 'WRC Generations'].includes(entry.title)
    if (!steam && !alreadyUnmatched) {
      const search = await fetchJson(`https://store.steampowered.com/api/storesearch/?term=${encodeURIComponent(name)}&l=english&cc=us`)
      const match = search.items?.find((item) => item.type === 'app' && normalize(item.name) === name)
      if (match) {
        const response = await fetchJson(`https://store.steampowered.com/api/appdetails?appids=${match.id}&l=english&cc=us`)
        const details = response[match.id]?.data
        if (details?.type === 'game') {
          const base = `https://cdn.cloudflare.steamstatic.com/steam/apps/${match.id}/`
          steam = {
            id: String(match.id), title: details.name,
            slug: details.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''),
            shortDescription: stripHtml(details.short_description), about: stripHtml(details.about_the_game).slice(0, 2400),
            developer: details.developers?.[0] ?? '', publisher: details.publishers?.[0] ?? '',
            releaseDate: toDate(details.release_date?.date), genres: (details.genres ?? []).map(g => g.description),
            features: (details.categories ?? []).map(c => c.description), metacritic: details.metacritic?.score ?? null,
            recommendations: details.recommendations?.total ?? 0, ageRating: Number(details.required_age) || null,
            images: { cover: `${base}library_600x900_2x.jpg`, hero: `${base}library_hero.jpg`, logo: `${base}logo.png`, header: details.header_image },
            screenshots: (details.screenshots ?? []).slice(0, 8).map(s => s.path_full), sizeGb: null,
          }
          cache.push(steam)
          status = 'matched'
        }
      }
    }
  } catch (error) {
    status = 'error'
    console.warn(entry.title, error.message)
  }
  games[index] = {
    shortDescription: '', about: '', developer: '', publisher: '', releaseDate: '', genres: [], features: [],
    metacritic: null, recommendations: 0, ageRating: null, screenshots: [],
    images: { cover: entry.posterUrl, hero: entry.backUrl || entry.posterUrl, logo: '', header: entry.posterUrl },
    ...steam,
    id: entry.titleId, slug: entry.titleId.toLowerCase(), title: entry.title,
    sizeGb: entry.sizeBytes ? entry.sizeBytes / 1024 ** 3 : null,
    steamId: steam?.id ?? null,
  }
  report.push({ titleId: entry.titleId, title: entry.title, steamId: steam?.id ?? null, status })
  console.log(`${index + 1}/${entries.length} ${status}: ${entry.title}`)
  if (status === 'matched' || status === 'error') await new Promise(resolve => setTimeout(resolve, 2500))
}
if (catalogPath) await writeFile(dataFile('spectrum.json'), JSON.stringify(catalog, null, 2) + '\n')
await writeFile(dataFile('games.json'), JSON.stringify(games, null, 2) + '\n')
await writeFile(dataFile('steam-cache.json'), JSON.stringify(cache, null, 2) + '\n')
await writeFile(dataFile('steam-matches.json'), JSON.stringify(report, null, 2) + '\n')
console.log(`${games.length} games; ${games.filter(game => game.steamId).length} Steam matches`)

await import('./check-catalog-art.mjs')
