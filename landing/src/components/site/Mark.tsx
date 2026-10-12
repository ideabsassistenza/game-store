export const RING = "M26.34 12.24A11 11 0 1 1 19.76 5.66";
export const NEEDLE = "M28.4 3.6 17.6 18.1a2.9 2.9 0 1 1-3.7-3.7Z";

/** Overdrive's mark from native/ui/Logo.jsx: a dial ring open at the limit, the needle crossing the gap. */
export function Mark({className = ""}: {className?: string}) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      <path d={RING} fill="none" stroke="currentColor" strokeWidth="4.5" />
      <path d={NEEDLE} fill="currentColor" />
    </svg>
  );
}
