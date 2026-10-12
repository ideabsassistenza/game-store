import { ChevronDown, Heart, Search, Volume2, VolumeX, X } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { GENRES } from '../../lib/catalog'
import { cn } from '../../lib/cn'
import { toggleSound, useSoundEnabled } from '../../lib/sound'
import { useWishlist } from '../../lib/wishlist'
import { Menu, MenuItem } from '../ui/Menu'
import { Logo } from './Logo'

type Section = 'discover' | 'catalog' | 'top' | 'new' | 'favorites'

const ICON_BUTTON =
  'relative flex size-10 cursor-pointer items-center justify-center rounded-full text-fg/80 transition-colors hover:bg-white/10 hover:text-fg focus-visible:text-fg'

const NAV_ITEM = 'relative flex h-10 cursor-pointer items-center gap-1.5 rounded-full px-4 text-[0.9375rem] transition-colors hover:text-fg focus-visible:text-fg'

// Pílula atrás da seção atual, como as abas do tvOS e do PS5; desliza entre as seções
function Indicator() {
  return (
    <motion.span
      layoutId="nav-indicator"
      transition={{ type: 'spring', stiffness: 520, damping: 42 }}
      className="absolute inset-0 -z-10 rounded-full bg-white/12"
    />
  )
}

// Hora sempre à vista, como na barra do console: num app em tela cheia na TV não há outro relógio
function Clock() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 15_000)
    return () => clearInterval(timer)
  }, [])
  return (
    <time dateTime={now.toISOString()} className="ml-3 text-[0.9375rem] text-fg/80 tabular-nums">
      {now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
    </time>
  )
}

function useSection(): Section | null {
  const { pathname, hash } = useLocation()
  const [params] = useSearchParams()
  if (pathname !== '/') return null
  if (params.has('favorites')) return 'favorites'
  if (params.get('sort') === 'rating') return 'top'
  if (params.get('sort') === 'newest') return 'new'
  if (hash === '#catalog' || params.size > 0) return 'catalog'
  return 'discover'
}

function HeaderSearch() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState(params.get('q') ?? '')
  const button = useRef<HTMLButtonElement>(null)

  const close = () => {
    setOpen(false)
    requestAnimationFrame(() => button.current?.focus({ preventScroll: true }))
  }

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const next = new URLSearchParams(params)
    if (query.trim()) next.set('q', query.trim())
    else next.delete('q')
    setOpen(false)
    navigate({ pathname: '/', search: next.toString(), hash: 'catalog' })
  }

  return (
    <AnimatePresence mode="popLayout" initial={false}>
      {open ? (
        // data-nav-scope: enquanto digita, setas e Esc ficam com o campo
        <motion.form
          key="field"
          role="search"
          data-nav-scope
          onSubmit={submit}
          initial={{ width: '2.5rem', opacity: 0 }}
          animate={{ width: '18rem', opacity: 1 }}
          exit={{ width: '2.5rem', opacity: 0 }}
          transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
          className="relative"
        >
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-subtle" />
          <input
            autoFocus
            data-nav
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Escape' && close()}
            onBlur={() => !query && setOpen(false)}
            placeholder="Search library"
            aria-label="Search games"
            className="h-9 w-full rounded-full border border-white/20 bg-white/5 pr-9 pl-9 text-sm placeholder:text-subtle focus-visible:outline-none"
          />
          <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={close} aria-label="Close search" className="absolute top-1/2 right-2.5 -translate-y-1/2 cursor-pointer text-subtle hover:text-fg">
            <X className="size-4" />
          </button>
        </motion.form>
      ) : (
        <motion.button
          key="icon"
          ref={button}
          type="button"
          data-nav
          onClick={() => setOpen(true)}
          aria-label="Search games"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className={cn(NAV_ITEM, '-ml-4 text-fg/65')}
        >
          <Search className="size-[1.125rem]" />
          Search
        </motion.button>
      )}
    </AnimatePresence>
  )
}

export function Header() {
  const navigate = useNavigate()
  const wishlist = useWishlist()
  const soundOn = useSoundEnabled()
  const section = useSection()
  const [params] = useSearchParams()
  const activeGenre = params.get('genre')

  const navLink = (id: Section, label: ReactNode, to: { pathname: string; search?: string; hash?: string }, ariaLabel?: string) => (
    <Link
      to={to}
      data-nav
      aria-label={ariaLabel}
      aria-current={section === id ? 'page' : undefined}
      className={cn(NAV_ITEM, 'isolate', section === id ? 'text-fg' : 'text-fg/65')}
    >
      {label}
      {section === id && <Indicator />}
    </Link>
  )

  const browse = (
    <div className="relative isolate flex">
      <Menu
        label="Browse by genre"
        align="left"
        triggerClassName={cn('group', NAV_ITEM, section === 'catalog' ? 'text-fg' : 'text-fg/65')}
        trigger={
          <>
            Browse
            <ChevronDown className="size-3.5 transition-transform duration-200 group-aria-expanded:rotate-180" />
          </>
        }
      >
        <MenuItem checked={section === 'catalog' && !activeGenre} onSelect={() => navigate({ pathname: '/', hash: 'catalog' })}>
          All games
        </MenuItem>
        <li className="my-1 h-px bg-line" aria-hidden />
        {GENRES.map((genre) => (
          <MenuItem
            key={genre}
            checked={activeGenre === genre}
            onSelect={() => navigate({ pathname: '/', search: `genre=${encodeURIComponent(genre)}`, hash: 'catalog' })}
          >
            {genre}
          </MenuItem>
        ))}
      </Menu>
      {section === 'catalog' && <Indicator />}
    </div>
  )

  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-black/90 backdrop-blur-xl">
      {/* Logo no centro exato e as seções divididas em volta dele, duas de cada lado; as utilidades ficam nas bordas.
          Com tudo de um lado só, o logo centralizado parecia deslocado */}
      <nav aria-label="Sections" className="mx-auto grid h-16 max-w-[140rem] grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center px-8">
        <div className="flex items-center justify-between gap-4">
          <HeaderSearch />
          <div className="flex items-center gap-1">
            {navLink('discover', 'Discover', { pathname: '/' })}
            {browse}
          </div>
        </div>

        <Link to="/" data-nav aria-label="Overdrive, home" className="mx-10 flex items-center rounded px-2">
          <Logo />
        </Link>

        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-1">
            {navLink('top', 'Top rated', { pathname: '/', search: 'sort=rating', hash: 'catalog' })}
            {navLink('new', 'New releases', { pathname: '/', search: 'sort=newest', hash: 'catalog' })}
          </div>
          <div className="flex items-center gap-1">
            {navLink(
              'favorites',
              <>
                <Heart className="size-[1.125rem]" />
                {wishlist.length > 0 && <span className="tabular-nums">{wishlist.length}</span>}
              </>,
              { pathname: '/', search: 'favorites=1', hash: 'catalog' },
              `Favorites, ${wishlist.length} ${wishlist.length === 1 ? 'game' : 'games'}`,
            )}
            <button
              type="button"
              data-nav
              onClick={toggleSound}
              aria-pressed={soundOn}
              aria-label={soundOn ? 'Turn interface sounds off' : 'Turn interface sounds on'}
              className={ICON_BUTTON}
            >
              {soundOn ? <Volume2 className="size-5" /> : <VolumeX className="size-5" />}
            </button>
            <Clock />
          </div>
        </div>
      </nav>
    </header>
  )
}
