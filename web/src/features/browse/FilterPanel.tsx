import { Check, ChevronDown } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { FEATURES, GENRES } from '../../lib/catalog'
import { cn } from '../../lib/cn'
import { focusElement } from '../../lib/spatialNav'
import type { GameFilters } from './useGameFilters'

export function FilterPanel({ filters, toggle, clear, activeCount }: GameFilters) {
  return (
    <div data-filters>
      <div className="flex h-10 items-center justify-between">
        <h2 className="font-semibold">
          Filters{activeCount > 0 && <span className="ml-1.5 text-subtle tabular-nums">({activeCount})</span>}
        </h2>
        {activeCount > 0 && (
          <button
            type="button"
            data-nav
            onClick={() => {
              clear()
              requestAnimationFrame(() => focusElement(document.querySelector('[data-filters] [aria-expanded]')))
            }}
            className="cursor-pointer rounded text-sm text-muted underline-offset-4 hover:text-fg hover:underline focus-visible:text-fg"
          >
            Clear all
          </button>
        )}
      </div>

      <div className="mt-3 border-t border-line" />
      <Section title="Genre" count={filters.genre.length}>
        {GENRES.map((genre) => (
          <Option key={genre} active={filters.genre.includes(genre)} onClick={() => toggle('genre', genre)}>
            {genre}
          </Option>
        ))}
      </Section>

      <Section title="Features" count={filters.feature.length}>
        {FEATURES.map((f) => (
          <Option key={f.id} active={filters.feature.includes(f.id)} onClick={() => toggle('feature', f.id)}>
            {f.label}
          </Option>
        ))}
      </Section>

    </div>
  )
}

function Section({ title, count, children }: { title: string; count: number; children: ReactNode }) {
  const [open, setOpen] = useState(true)

  return (
    <div className="border-b border-line py-2">
      <button
        type="button"
        data-nav
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full cursor-pointer items-center justify-between rounded-sm py-2 text-xs font-medium tracking-[0.08em] text-muted uppercase hover:text-fg focus-visible:text-fg"
      >
        <span>
          {title}
          {count > 0 && <span className="ml-1.5 text-fg tabular-nums">{count}</span>}
        </span>
        <ChevronDown className={cn('size-4 text-subtle transition-transform', open && 'rotate-180')} />
      </button>
      {open && <ul className="-mx-2 pb-2">{children}</ul>}
    </div>
  )
}

type OptionProps = { active: boolean; onClick: () => void; children: ReactNode; role?: 'radio' | 'checkbox' }

function Option({ active, onClick, children, role = 'checkbox' }: OptionProps) {
  return (
    <li>
      <button
        type="button"
        role={role}
        data-nav
        aria-checked={active}
        onClick={onClick}
        className={cn(
          'flex w-full cursor-pointer items-center justify-between rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-surface focus-visible:bg-surface focus-visible:text-fg focus-visible:outline-offset-0',
          active ? 'text-fg' : 'text-muted hover:text-fg',
        )}
      >
        {children}
        {active && <Check className="size-4" />}
      </button>
    </li>
  )
}
