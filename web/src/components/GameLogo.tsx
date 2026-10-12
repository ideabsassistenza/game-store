import { cn } from '../lib/cn'
import { useLogoBox } from '../lib/logoBox'

type GameLogoProps = {
  src: string
  title: string
  // Peso visual em rem²: todo logo ocupa mais ou menos a mesma área, largo ou compacto
  area: number
  maxW: number
  maxH: number
  className?: string
}

// Logo recortado da margem transparente e dimensionado pela área; sem logo, o título em texto ocupa o lugar
export function GameLogo({ src, title, area, maxW, maxH, className }: GameLogoProps) {
  const box = useLogoBox(src)

  if (box === null) {
    return <span className={cn('block text-4xl font-semibold tracking-tight text-balance', className)}>{title}</span>
  }
  if (!box) return <span aria-label={title} className={cn('block', className)} style={{ height: `${maxH * 0.75}rem` }} />

  let height = Math.min(maxH, Math.sqrt(area / box.aspect))
  let width = height * box.aspect
  if (width > maxW) {
    width = maxW
    height = width / box.aspect
  }

  return (
    <span role="img" aria-label={title} className={cn('relative block overflow-hidden', className)} style={{ width: `${width}rem`, height: `${height}rem` }}>
      <img
        src={src}
        crossOrigin="anonymous"
        alt=""
        // Logo escuro some no fundo escuro: vira silhueta branca, como os consoles fazem com artes sem contraste
        className={cn('absolute max-w-none animate-[fade-in_0.4s_ease-out]', box.dark && 'brightness-0 invert')}
        style={{
          width: `${100 / box.w}%`,
          height: `${100 / box.h}%`,
          left: `${(-box.x / box.w) * 100}%`,
          top: `${(-box.y / box.h) * 100}%`,
        }}
      />
    </span>
  )
}
