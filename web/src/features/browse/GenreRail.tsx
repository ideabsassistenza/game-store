import { SectionHeader } from '../../components/SectionHeader'
import { games, genresOf, GENRES } from '../../lib/catalog'
import { Check } from 'lucide-react'
import { cn } from '../../lib/cn'

// Cada gênero ganha capas que ainda não apareceram nos anteriores, para o trilho não repetir o mesmo jogo
const used = new Set<string>()
const rail = GENRES.map((genre) => {
  const matches = games.filter((g) => genresOf(g).includes(genre)).sort((a, b) => b.recommendations - a.recommendations)
  return { genre, matches }
})
  .sort((a, b) => b.matches.length - a.matches.length)
  .map(({ genre, matches }) => {
    const picks = [...matches.filter((g) => !used.has(g.id)), ...matches.filter((g) => used.has(g.id))].slice(0, 3)
    picks.forEach((g) => used.add(g.id))
    return { genre, count: matches.length, covers: picks.map((g) => g.images.cover) }
  })

type GenreRailProps = { selected: string[]; onSelect: (genre: string) => void }

export function GenreRail({ selected, onSelect }: GenreRailProps) {
  return (
    <section aria-labelledby="genres-title">
      <SectionHeader id="genres-title" title="Popular genres" />

      {/* Respiro para o contorno de foco e fade na borda direita: o trilho continua além da tela */}
      <div className="scrollbar-none -mx-1.5 -my-5 flex gap-3 overflow-x-auto px-1.5 py-5 [mask-image:linear-gradient(to_right,black_calc(100%_-_4rem),transparent)]">
        {rail.map(({ genre, count, covers }) => {
          const active = selected.includes(genre)
          return (
            <button
              key={genre}
              type="button"
              data-nav
              data-nav-id={`genre-${genre}`}
              onClick={() => onSelect(genre)}
              aria-pressed={active}
              className={cn(
                'focus-frame shine group w-[12.5rem] shrink-0 scroll-mx-20 cursor-pointer rounded-xl bg-surface p-4 text-left hover:bg-surface-2 focus-visible:z-10 focus-visible:scale-[1.04] focus-visible:bg-surface-2',
                active && 'bg-surface-2',
              )}
            >
              {/* Capas em leque: a do meio fica na frente */}
              <div className="relative mx-auto h-28 w-full">
                {covers.map((src, i) => (
                  <img
                    key={i}
                    src={src}
                    alt=""
                    loading="lazy"
                    className={cn(
                      'absolute top-0 left-1/2 aspect-[3/4] h-full rounded-md object-cover shadow-[0_0.5rem_1.5rem_rgba(0,0,0,0.5)] transition-transform duration-300',
                      i === 0 && 'z-10 -translate-x-1/2',
                      i === 1 && '-translate-x-[110%] scale-90 group-hover:-translate-x-[125%] group-focus-visible:-translate-x-[125%]',
                      i === 2 && 'translate-x-[10%] scale-90 group-hover:translate-x-[25%] group-focus-visible:translate-x-[25%]',
                    )}
                  />
                ))}
              </div>
              {active && (
                <span className="absolute top-3 right-3 z-20 flex size-6 items-center justify-center rounded-full bg-fg text-canvas shadow-[0_0.25rem_0.75rem_rgba(0,0,0,0.5)]">
                  <Check className="size-3.5" strokeWidth={3} aria-label="Active filter" />
                </span>
              )}
              <p className="mt-4 w-fit font-medium">{genre}</p>
              <p className="text-xs text-subtle tabular-nums">
                {count} {count === 1 ? 'game' : 'games'}
              </p>
            </button>
          )
        })}
      </div>
    </section>
  )
}
