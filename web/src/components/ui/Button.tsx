import type { ButtonHTMLAttributes } from 'react'
import { cn } from '../../lib/cn'

const VARIANTS = {
  primary: 'shine bg-accent text-accent-fg hover:bg-accent-hover focus-visible:bg-accent-hover',
  secondary: 'bg-surface-2 text-fg hover:bg-[#2b2b30]',
  outline: 'border border-line text-fg hover:border-subtle hover:bg-surface focus-visible:bg-surface',
  ghost: 'text-muted hover:bg-surface hover:text-fg focus-visible:text-fg',
}

const SIZES = {
  sm: 'h-8 px-3 text-sm',
  md: 'h-10 px-4 text-sm',
  lg: 'h-12 px-5 text-[0.9375rem]',
  icon: 'size-10',
  'icon-lg': 'size-12',
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: keyof typeof VARIANTS
  size?: keyof typeof SIZES
}

export function Button({ variant = 'secondary', size = 'md', className, ...props }: ButtonProps) {
  return (
    <button
      data-nav
      className={cn(
        'inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 rounded-md font-medium transition-colors disabled:pointer-events-none disabled:opacity-50 [&_svg]:shrink-0',
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...props}
    />
  )
}
