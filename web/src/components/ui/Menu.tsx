import { Check } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { cn } from '../../lib/cn'
import { focusElement } from '../../lib/spatialNav'

const CloseContext = createContext<() => void>(() => {})

type MenuProps = {
  trigger: ReactNode
  triggerClassName: string
  label: string
  navId?: string
  align?: 'left' | 'right'
  children: ReactNode
}

// Menu suspenso navegável por controle: com ele aberto, as setas ficam presas às opções e Esc devolve o foco ao gatilho
export function Menu({ trigger, triggerClassName, label, navId, align = 'right', children }: MenuProps) {
  const [open, setOpen] = useState(false)
  const button = useRef<HTMLButtonElement>(null)
  const list = useRef<HTMLUListElement>(null)

  const close = () => {
    setOpen(false)
    requestAnimationFrame(() => button.current?.focus({ preventScroll: true }))
  }

  useEffect(() => {
    if (!open) return
    focusElement(list.current?.querySelector('[aria-checked="true"]') ?? list.current?.querySelector('[data-nav]'), false)

    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' && e.key !== 'Backspace') return
      e.preventDefault()
      close()
    }
    const onPointer = (e: PointerEvent) => {
      const target = e.target as Node
      if (!list.current?.contains(target) && !button.current?.contains(target)) setOpen(false)
    }
    window.addEventListener('keydown', onKey, true)
    document.addEventListener('pointerdown', onPointer)
    return () => {
      window.removeEventListener('keydown', onKey, true)
      document.removeEventListener('pointerdown', onPointer)
    }
  }, [open])

  return (
    <div className="relative flex h-full items-center">
      <button
        ref={button}
        type="button"
        data-nav
        data-nav-id={navId}
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className={triggerClassName}
      >
        {trigger}
      </button>

      <AnimatePresence>
        {open && (
          <motion.ul
            ref={list}
            role="menu"
            data-nav-scope
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, transition: { duration: 0.1 } }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            className={cn(
              'absolute top-full z-50 mt-1.5 min-w-52 rounded-lg border border-line bg-surface p-1 shadow-[0_1rem_3rem_rgba(0,0,0,0.6)]',
              align === 'right' ? 'right-0 origin-top-right' : 'left-0 origin-top-left',
            )}
          >
            <CloseContext.Provider value={close}>{children}</CloseContext.Provider>
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  )
}

type MenuItemProps = { checked?: boolean; onSelect: () => void; children: ReactNode }

export function MenuItem({ checked, onSelect, children }: MenuItemProps) {
  const close = useContext(CloseContext)

  return (
    <li>
      <button
        type="button"
        role={checked === undefined ? 'menuitem' : 'menuitemradio'}
        data-nav
        aria-checked={checked}
        onClick={() => {
          onSelect()
          close()
        }}
        className="flex w-full cursor-pointer items-center justify-between gap-6 rounded-md px-3 py-2 text-left text-sm whitespace-nowrap text-muted transition-colors hover:bg-surface-2 hover:text-fg focus-visible:bg-surface-2 focus-visible:text-fg focus-visible:outline-offset-[calc(var(--ring)*-1)] aria-checked:text-fg"
      >
        {children}
        {checked && <Check className="size-4" />}
      </button>
    </li>
  )
}
