import { formatDate, formatSize, storageGb, type Game } from '../../lib/catalog'

// Details; estúdio e ações já estão no topo da página
export function GameFacts({ game }: { game: Game }) {
  const size = storageGb(game)
  const rows = [
    ['Publisher', game.publisher],
    ['Release date', formatDate(game.releaseDate)],
    ['Install size', size ? formatSize(size) : '—'],
  ]

  return (
    <section aria-labelledby="facts-title">
      <h2 id="facts-title" className="text-xs font-medium tracking-[0.08em] text-muted uppercase">
        Details
      </h2>
      <dl className="mt-3 divide-y divide-line border-y border-line text-sm">
        {rows.map(([label, value]) => (
          <div key={label} className="flex justify-between gap-4 py-3">
            <dt className="text-subtle">{label}</dt>
            <dd className="text-right">{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}
