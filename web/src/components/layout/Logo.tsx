// Anel de mostrador aberto no limite, com o ponteiro atravessando a abertura: o "overdrive"
export function LogoMark({ className = 'size-7' }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden>
      <path d="M26.34 12.24A11 11 0 1 1 19.76 5.66" fill="none" stroke="currentColor" strokeWidth="4.5" />
      <path d="M28.4 3.6 17.6 18.1a2.9 2.9 0 1 1-3.7-3.7Z" fill="currentColor" />
    </svg>
  )
}

export function Logo() {
  return (
    <span className="flex items-center gap-2">
      <LogoMark />
      <span className="text-[1.1875rem] font-semibold tracking-[-0.03em]">overdrive</span>
    </span>
  )
}
