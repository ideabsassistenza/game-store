import { Heart } from 'lucide-react'
import { motion } from 'motion/react'
import { cn } from '../../lib/cn'

// Ao entrar na lista o coração pulsa e solta um anel; ao sair, só esvazia
export function WishHeart({ active }: { active: boolean }) {
  return (
    <span className="relative flex size-4 items-center justify-center">
      {active && (
        <motion.span
          key="burst"
          initial={{ scale: 0.4, opacity: 0.7 }}
          animate={{ scale: 2.4, opacity: 0 }}
          transition={{ duration: 0.55, ease: 'easeOut' }}
          className="absolute inset-0 rounded-full border border-current"
        />
      )}
      <motion.span
        key={String(active)}
        initial={false}
        animate={active ? { scale: [1, 1.45, 0.9, 1] } : { scale: 1 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="flex"
      >
        <Heart className={cn('size-4', active && 'fill-current')} />
      </motion.span>
    </span>
  )
}
