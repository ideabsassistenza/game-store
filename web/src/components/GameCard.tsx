import { Link, useNavigate } from 'react-router-dom'
import { genresOf, type Game } from '../lib/catalog'
import { heroCover, morphCover } from '../lib/coverMorph'
import { FadeImage } from './FadeImage'

// Biblioteca sem preço: a capa carrega o card, título e gênero só identificam o jogo
export function GameCard({ game, eager }: { game: Game; eager?: boolean }) {
  const navigate = useNavigate()
  const to = `/game/${game.slug}`

  return (
    <Link
      to={to}
      onClick={(e) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return
        e.preventDefault()
        morphCover(e.currentTarget.querySelector('[data-cover]'), () => navigate(to), () => !!heroCover(game.slug), () => heroCover(game.slug))
      }}
      data-nav
      data-slug={game.slug}
      data-nav-id={`card-${game.slug}`}
      className="group relative block rounded-lg transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] focus-visible:z-10 focus-visible:scale-[1.04] focus-visible:outline-none"
    >
      <div data-cover className="focus-frame shine aspect-[3/4] rounded-lg bg-surface group-hover:brightness-110">
        <FadeImage src={game.images.cover} loading={eager ? 'eager' : 'lazy'} className="size-full object-cover" />
      </div>
      <h3 className="mt-3 line-clamp-1 text-[0.9375rem] font-medium text-fg/85 transition-colors group-focus-visible:text-fg">{game.title}</h3>
      <p className="mt-0.5 truncate text-[0.8125rem] text-subtle">{genresOf(game).slice(0, 2).join(' · ')}</p>
    </Link>
  )
}
