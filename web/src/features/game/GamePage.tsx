import { motion } from 'motion/react'
import { useParams } from 'react-router-dom'
import { GameCard } from '../../components/GameCard'
import { NotFound } from '../../components/layout/NotFound'
import { SectionHeader } from '../../components/SectionHeader'
import { FEATURES, genresOf, getGame, relatedGames } from '../../lib/catalog'
import { About } from './About'
import { GameHero } from './GameHero'
import { MediaGallery } from './MediaGallery'
import { GameFacts } from './GameFacts'

export function GamePage() {
  const { slug = '' } = useParams()
  const game = getGame(slug)
  if (!game) return <NotFound />

  const features = FEATURES.filter((f) => f.tags.some((t) => game.features.includes(t)))
  const related = relatedGames(game, 8)

  return (
    <article key={game.id}>
      <GameHero game={game} />

      {/* O conteúdo abaixo sobe depois do hero, para a capa e o título serem o primeiro ponto de atenção */}
      <motion.div
        initial={{ opacity: 0, y: '1.5rem' }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, delay: 0.45, ease: [0.16, 1, 0.3, 1] }}
        className="mx-auto max-w-[100rem] px-8 pt-10"
      >
        <div className="grid grid-cols-[1fr_18rem] gap-14">
          <div className="min-w-0 space-y-14">
            {game.screenshots.length > 0 && <MediaGallery screenshots={game.screenshots} title={game.title} />}
            {game.about && <About text={game.about} />}

            {features.length > 0 && (
              <section aria-labelledby="features-title">
                <h2 id="features-title" className="text-xl font-semibold tracking-tight">
                  Features
                </h2>
                <ul className="mt-4 flex flex-wrap gap-2">
                  {features.map((f) => (
                    <li key={f.id} className="rounded-sm bg-surface-2 px-2.5 py-1 text-sm text-fg/90">
                      {f.label}
                    </li>
                  ))}
                </ul>
              </section>
            )}

          </div>

          <aside>
            <div className="sticky top-24">
              <GameFacts game={game} />
            </div>
          </aside>
        </div>

        {related.length > 0 && (
          <section aria-labelledby="related-title" className="mt-20">
            <SectionHeader
              id="related-title"
              title="More like this"
              to={{ pathname: '/', search: `genre=${encodeURIComponent(genresOf(game)[0])}`, hash: 'catalog' }}
            />
            {/* 6 jogos em 1080p; telas mais largas revelam os outros 2 */}
            <div className="@container">
              <div className="grid grid-cols-6 gap-x-4 @[86rem]:grid-cols-8">
                {related.map((g, i) => (
                  <div key={g.id} className={i >= 6 ? 'hidden @[86rem]:block' : undefined}>
                    <GameCard game={g} />
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}
      </motion.div>
    </article>
  )
}
