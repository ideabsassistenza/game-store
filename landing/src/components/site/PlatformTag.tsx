import {CAP, WORDS} from "@/lib/ps-logotype";

export type Platform = keyof typeof WORDS;

function Word({platform}: {platform: Platform}) {
  const {left, right, d} = WORDS[platform];
  return (
    <span className={`inline-flex h-[18px] items-center px-1.5 ${platform === "ps5" ? "bg-fg text-canvas" : "bg-canvas/70 text-fg"}`}>
      <svg viewBox={`${left} 0 ${right - left} ${CAP}`} className="h-[7px] w-auto fill-current" role="img" aria-label={platform.toUpperCase()}>
        <path d={d} />
      </svg>
    </span>
  );
}

/**
 * The PS Store's platform tag, as the app draws it: PS5 white with dark type, PS4 dark with a white
 * outline, both editions joined in one tag.
 */
export function PlatformTag({platforms, className = ""}: {platforms: Platform[]; className?: string}) {
  return (
    <span className={`inline-flex overflow-hidden rounded-[3px] ring-1 ring-fg/80 ring-inset ${className}`}>
      {platforms.map(platform => <Word key={platform} platform={platform} />)}
    </span>
  );
}
