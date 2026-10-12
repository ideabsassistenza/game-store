import { ChevronDown } from 'lucide-react'
import { Menu, MenuItem } from '../../components/ui/Menu'
import { SORTS, type SortId } from '../../lib/catalog'

type SortSelectProps = { value: SortId; onChange: (value: SortId) => void }

export function SortSelect({ value, onChange }: SortSelectProps) {
  return (
    <Menu
      label="Sort by"
      navId="sort"
      triggerClassName="group inline-flex h-10 cursor-pointer items-center gap-2 rounded-md px-3 text-sm text-muted transition-colors hover:bg-surface hover:text-fg focus-visible:bg-surface aria-expanded:bg-surface"
      trigger={
        <>
          Sort:
          <span className="font-medium text-fg">{SORTS.find((s) => s.id === value)?.label}</span>
          <ChevronDown className="size-4 transition-transform duration-200 group-aria-expanded:rotate-180" />
        </>
      }
    >
      {SORTS.map((s) => (
        <MenuItem key={s.id} checked={value === s.id} onSelect={() => onChange(s.id)}>
          {s.label}
        </MenuItem>
      ))}
    </Menu>
  )
}
