import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useState } from 'react'
import { cn } from '../../lib/cn'

const thumb = (src: string) => src.replace('.1920x1080', '.600x338')

// Na TV a miniatura em foco já vira a imagem principal: setas percorrem a galeria sem botões extras
export function MediaGallery({ screenshots, title }: { screenshots: string[]; title: string }) {
  const [index, setIndex] = useState(0)

  // Todas as capturas em cache logo de início: passar pelas miniaturas nunca mostra imagem carregando
  useEffect(() => {
    screenshots.forEach((src) => {
      new Image().src = src
    })
  }, [screenshots])

  return (
    // Largura limitada pela altura da tela: imagem 16:9 inteira e miniaturas cabem juntas abaixo do cabeçalho
    <div data-nav-frame className="w-[min(100%,calc((100dvh-12.5rem)*16/9))] scroll-mt-[4.5rem]">
      <div className="relative aspect-video overflow-hidden rounded-xl bg-surface">
        <AnimatePresence initial={false}>
          <motion.img
            key={index}
            src={screenshots[index]}
            alt={`${title}: screenshot ${index + 1} of ${screenshots.length}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { delay: 0.25, duration: 0.15 } }}
            transition={{ duration: 0.35, ease: 'easeOut' }}
            className="absolute inset-0 size-full object-cover"
          />
        </AnimatePresence>
        <span className="absolute right-4 bottom-4 rounded-full bg-canvas/70 px-2.5 py-1 text-xs tabular-nums backdrop-blur">
          {index + 1} / {screenshots.length}
        </span>
      </div>

      <div className="scrollbar-none mt-3 flex gap-2 overflow-x-auto">
        {screenshots.map((src, i) => (
          <button
            key={src}
            type="button"
            data-nav
            data-nav-id={`shot-${i}`}
            onFocus={() => setIndex(i)}
            onClick={() => setIndex(i)}
            aria-label={`View screenshot ${i + 1}`}
            aria-current={i === index}
            // Contorno por dentro: a faixa rola na horizontal e cortaria um contorno externo
            className={cn(
              'relative aspect-video w-32 shrink-0 cursor-pointer overflow-hidden rounded-md transition-opacity duration-200 focus-visible:outline-offset-[calc(var(--ring)*-1)]',
              i === index ? 'opacity-100' : 'opacity-45 hover:opacity-90',
            )}
          >
            <img src={thumb(src)} alt="" loading="lazy" className="size-full object-cover" />
          </button>
        ))}
      </div>
    </div>
  )
}
