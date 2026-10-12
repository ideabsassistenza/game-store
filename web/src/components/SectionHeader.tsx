import { ChevronRight } from 'lucide-react'
import { Link, type To } from 'react-router-dom'

export function SectionHeader({ id, title, to }: { id: string; title: string; to?: To }) {
  return (
    <div className="mb-4 flex items-baseline justify-between">
      <h2 id={id} className="text-xl font-semibold tracking-tight">
        {title}
      </h2>
      {to && (
        <Link
          to={to}
          data-nav
          className="flex items-center gap-0.5 rounded text-sm text-muted transition-colors hover:text-fg focus-visible:text-fg"
        >
          See all
          <ChevronRight className="size-4" />
        </Link>
      )}
    </div>
  )
}
