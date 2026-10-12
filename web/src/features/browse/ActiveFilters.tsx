import { X } from 'lucide-react'
import type { MouseEvent } from 'react'
import { FEATURES } from '../../lib/catalog'
import { focusElement } from '../../lib/spatialNav'
import type { GameFilters } from './useGameFilters'

export function ActiveFilters({ filters, toggle, set }: GameFilters) {
  const chips = [
    filters.q && { label: `“${filters.q}”`, remove: () => set('q', null) },
    filters.wishlist && { label: 'Favorites', remove: () => set('favorites', null) },
    ...filters.genre.map((g) => ({ label: g, remove: () => toggle('genre', g) })),
    ...filters.feature.map((id) => ({ label: FEATURES.find((f) => f.id === id)?.label, remove: () => toggle('feature', id) })),
  ].filter((c) => !!c)

  if (!chips.length) return null

  // O chip removido some do DOM: o foco vai antes para o vizinho, ou para a ordenação se era o último
  const remove = (e: MouseEvent<HTMLButtonElement>, action: () => void) => {
    const li = e.currentTarget.closest('li')
    const neighbor = (li?.nextElementSibling ?? li?.previousElementSibling)?.querySelector('button')
    action()
    requestAnimationFrame(() => focusElement(neighbor ?? document.querySelector('[aria-label="Sort by"]')))
  }

  return (
    <ul className="flex flex-wrap gap-2">
      {chips.map((chip) => (
        <li key={chip.label}>
          <button
            type="button"
            data-nav
            onClick={(e) => remove(e, chip.remove)}
            aria-label={`Remove filter ${chip.label}`}
            className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-full bg-surface-2 pr-2.5 pl-3.5 text-sm transition-colors hover:bg-[#2b2b30] focus-visible:bg-[#2b2b30]"
          >
            {chip.label}
            <X className="size-3.5 text-muted" />
          </button>
        </li>
      ))}
    </ul>
  )
}
