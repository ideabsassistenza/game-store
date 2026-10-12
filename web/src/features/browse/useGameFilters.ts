import { useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useWishlist } from '../../lib/wishlist'
import { FEATURES, games, genresOf, SORTS, type SortId } from '../../lib/catalog'

export type MultiKey = 'genre' | 'feature'

const FILTER_KEYS = ['q', 'genre', 'feature', 'favorites']

const normalize = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')

export function useGameFilters() {
  const [params, setParams] = useSearchParams()
  const wishlist = useWishlist()

  const filters = useMemo(
    () => ({
      q: params.get('q') ?? '',
      genre: params.getAll('genre'),
      feature: params.getAll('feature'),
      wishlist: params.has('favorites'),
      sort: (params.get('sort') ?? 'relevance') as SortId,
    }),
    [params],
  )

  const results = useMemo(() => {
    const query = normalize(filters.q)
    const featureTags = FEATURES.filter((f) => filters.feature.includes(f.id))
    const compare = SORTS.find((s) => s.id === filters.sort)?.compare ?? SORTS[0].compare

    return games
      .filter(
        (g) =>
          (!query || normalize(`${g.title} ${g.developer} ${g.publisher}`).includes(query)) &&
          filters.genre.every((genre) => genresOf(g).includes(genre)) &&
          featureTags.every((f) => f.tags.some((t) => g.features.includes(t))) &&
          (!filters.wishlist || wishlist.includes(g.id)),
      )
      .sort(compare)
  }, [filters, wishlist])

  const update = (mutate: (p: URLSearchParams) => void) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        mutate(next)
        return next
      },
      { replace: true, preventScrollReset: true },
    )

  const toggle = (key: MultiKey, value: string) =>
    update((p) => {
      const values = p.getAll(key)
      p.delete(key)
      const next = values.includes(value) ? values.filter((v) => v !== value) : [...values, value]
      next.forEach((v) => p.append(key, v))
    })

  const set = (key: 'q' | 'genre' | 'sort' | 'favorites', value: string | null) =>
    update((p) => (value === null ? p.delete(key) : p.set(key, value)))

  const clear = () => update((p) => FILTER_KEYS.forEach((k) => p.delete(k)))

  const activeCount = filters.genre.length + filters.feature.length + Number(filters.wishlist)

  return { filters, results, toggle, set, clear, activeCount }
}

export type GameFilters = ReturnType<typeof useGameFilters>
