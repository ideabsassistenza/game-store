import { motion } from 'motion/react'
import { useState } from 'react'

// Lojistas da Steam marcam subtítulos como linhas curtas em caixa alta
const isHeading = (line: string) => line.length < 70 && line === line.toUpperCase() && /\p{L}/u.test(line)

export function About({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false)
  const paragraphs = text.split(/\n+/).filter((p) => p.trim())

  return (
    <section aria-labelledby="about-title">
      <h2 id="about-title" className="text-xl font-semibold tracking-tight">
        About this game
      </h2>
      <motion.div
        initial={false}
        animate={{ height: expanded ? 'auto' : '12rem' }}
        transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
        className="relative mt-4 overflow-hidden"
      >
        <div className="max-w-[65ch] space-y-3 text-[0.9375rem] leading-relaxed text-muted">
          {paragraphs.map((p, i) =>
            isHeading(p) ? (
              <h3 key={i} className="pt-3 text-xs font-medium tracking-[0.08em] text-fg uppercase">
                {p}
              </h3>
            ) : (
              <p key={i} className="text-pretty">
                {p}
              </p>
            ),
          )}
        </div>
        <motion.div
          initial={false}
          animate={{ opacity: expanded ? 0 : 1 }}
          className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-canvas"
        />
      </motion.div>
      <button
        type="button"
        data-nav
        onClick={() => setExpanded((e) => !e)}
        className="mt-3 cursor-pointer rounded text-sm font-medium underline-offset-4 hover:underline focus-visible:underline"
      >
        {expanded ? 'Show less' : 'Show more'}
      </button>
    </section>
  )
}
