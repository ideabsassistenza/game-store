import { Download, Pause, Play } from 'lucide-react'
import { motion } from 'motion/react'
import { useEffect, useState } from 'react'
import { formatSize } from '../../lib/catalog'
import { cn } from '../../lib/cn'

type Status = 'idle' | 'downloading' | 'paused' | 'installed'

// Simula ~8s de download independentemente do tamanho, só para dar retorno visual
const DURATION_MS = 8000
const TICK_MS = 40

function useSimulatedDownload() {
  const [status, setStatus] = useState<Status>('idle')
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    if (status !== 'downloading') return
    const timer = setInterval(() => {
      setProgress((p) => {
        const next = Math.min(1, p + TICK_MS / DURATION_MS)
        if (next === 1) setStatus('installed')
        return next
      })
    }, TICK_MS)
    return () => clearInterval(timer)
  }, [status])

  return { status, progress, setStatus }
}


const NEXT: Record<Status, Status> = { idle: 'downloading', downloading: 'paused', paused: 'downloading', installed: 'installed' }

type DownloadButtonProps = { sizeGb: number | null; label: string; onInstalled: () => void }

export function DownloadButton({ sizeGb, label, onInstalled }: DownloadButtonProps) {
  const { status, progress, setStatus } = useSimulatedDownload()

  useEffect(() => {
    if (status === 'installed') onInstalled()
  }, [status, onInstalled])
  const percent = Math.round(progress * 100)
  const inProgress = status === 'downloading' || status === 'paused'

  const content = {
    idle: { icon: <Download className="size-4" />, text: label },
    downloading: { icon: <Pause className="size-4" />, text: 'Pause' },
    paused: { icon: <Play className="size-4" />, text: 'Resume' },
    installed: { icon: <Play className="size-4 fill-current" />, text: 'Play now' },
  }[status]

  const caption = {
    idle: ['Simulated download', sizeGb && formatSize(sizeGb)],
    downloading: ['Downloading…', sizeGb && `${formatSize(sizeGb * progress)} of ${formatSize(sizeGb)}`],
    paused: ['Paused', sizeGb && `${formatSize(sizeGb * progress)} of ${formatSize(sizeGb)}`],
    installed: ['Installed and ready to play', sizeGb && formatSize(sizeGb)],
  }[status]

  const labelRow = (
    <span className={cn('flex w-full items-center gap-2', inProgress ? 'justify-between' : 'justify-center')}>
      <span className="flex items-center gap-2">
        {content.icon}
        {content.text}
      </span>
      {inProgress && <span className="tabular-nums">{percent}%</span>}
    </span>
  )

  // Um único <button> em todos os estados para o foco do controle não se perder na troca
  return (
    <div className="space-y-2">
      <motion.button
        type="button"
        data-nav
        data-autofocus
        onClick={() => setStatus(NEXT[status])}
        animate={status === 'installed' ? { scale: [1, 1.035, 1] } : { scale: 1 }}
        transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
        className={cn(
          'shine flex h-12 w-full cursor-pointer items-center rounded-md px-5 text-[0.9375rem] font-medium transition-colors duration-300',
          inProgress ? 'bg-surface-2 text-fg' : 'bg-accent text-accent-fg hover:bg-accent-hover focus-visible:bg-accent-hover',
        )}
      >
        {inProgress && (
          <span className="absolute inset-0 origin-left bg-accent" style={{ transform: `scaleX(${progress})` }} />
        )}
        <span className="relative w-full">{labelRow}</span>
        {inProgress && (
          // Rótulo invertido por cima da barra, recortado até onde ela chegou
          <span
            aria-hidden
            className="absolute inset-0 flex items-center px-5 text-accent-fg"
            style={{ clipPath: `inset(0 ${100 - progress * 100}% 0 0)` }}
          >
            {labelRow}
          </span>
        )}
      </motion.button>
      <div className="flex justify-between text-xs text-subtle tabular-nums" aria-live="polite">
        <span>{caption[0]}</span>
        {caption[1] && <span>{caption[1]}</span>}
      </div>
    </div>
  )
}
