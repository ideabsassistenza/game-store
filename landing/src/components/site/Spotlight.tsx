"use client";

import {useTranslations} from "next-intl";
import Image from "next/image";
import {useEffect, useState} from "react";
import {ShineBorder} from "@/components/ui/shine-border";
import {useGenre} from "@/lib/genres";
import spotlight from "@/lib/spotlight.json";
import type {Platform} from "./PlatformTag";

type Featured = {t: string; g: string[]; s: string; h: string; l: string; d: boolean; a: number | null; c: string; p: Platform[]};
const FEATURED = spotlight as Featured[];
// native/browse/useSlides.js: each slide holds 7 s; pointing at or focusing the list pauses it.
const SLIDE_MS = 7000;
// The logo box of native/browse/Spotlight.jsx (320 × 112, 48 × 256 px² of area), in logical px.
const LOGO = {width: 320, height: 112, area: 48 * 256};

function logoBox(aspect: number | null) {
  if (!aspect) return {width: LOGO.width, height: LOGO.height};
  let height = Math.min(LOGO.height, Math.sqrt(LOGO.area / aspect));
  let width = height * aspect;
  if (width > LOGO.width) { width = LOGO.width; height = width / aspect; }
  return {width, height};
}

function Heart() {
  return (
    <svg viewBox="0 0 24 24" className="size-4 fill-none stroke-current" strokeWidth="2" strokeLinejoin="round" aria-hidden="true">
      <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
    </svg>
  );
}

/**
 * The app's home spotlight, rebuilt for the web from native/browse/Spotlight.jsx and SpotlightList.jsx:
 * the featured game's art under the same two shade layers, its logo, genres and blurb, the two
 * actions, and the five-game list whose bar runs out before the next slide.
 */
export function Spotlight() {
  const t = useTranslations("Spotlight");
  const genreLabel = useGenre();
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const game = FEATURED[active];
  const logo = logoBox(game.a);

  useEffect(() => {
    if (paused) return undefined;
    const id = setTimeout(() => setActive(index => (index + 1) % FEATURED.length), SLIDE_MS);
    return () => clearTimeout(id);
  }, [active, paused]);

  return (
    <div className="flex flex-col gap-4 md:flex-row">
      <div className="relative aspect-[3/4] min-w-0 flex-1 overflow-hidden rounded-xl bg-surface-2 sm:aspect-[16/10] md:aspect-[940/440]">
        {FEATURED.map((entry, index) => (
          <Image key={entry.h} src={entry.h} alt="" aria-hidden width={1920} height={620} unoptimized priority={index === 0}
            className={`absolute inset-0 h-full w-full object-cover max-md:object-[70%_center] max-md:[mask-image:linear-gradient(to_bottom,#000_45%,transparent_85%)] ${index === active ? "opacity-100" : "opacity-0"}`} />
        ))}
        {/* Strong enough for light art: the text stays readable over any hero. On a phone the art is tall
            and narrow, so it fades out downwards into the card instead of from the left. */}
        <div className="absolute inset-0 bg-gradient-to-r rtl:bg-gradient-to-l from-canvas via-canvas/75 via-35% to-transparent to-75% max-md:hidden" />
        <div className="absolute inset-0 bg-gradient-to-t from-canvas/70 to-transparent to-50% max-md:from-canvas max-md:via-canvas/60 max-md:via-30% max-md:to-60%" />
        <div className="absolute inset-y-0 start-0 flex w-[min(30rem,100%)] flex-col justify-end p-[clamp(1.25rem,3.5vw,2.5rem)] max-sm:p-5 max-sm:pb-6">
          <div key={game.t} className="spotlight-blurb flex flex-col gap-5">
            <Image src={game.l} alt={game.t} width={Math.round(logo.width * 2)} height={Math.round(logo.height * 2)} unoptimized
              style={{width: `min(${logo.width}px, 70%)`, height: "auto"}}
              className={`max-h-[112px] object-contain object-left rtl:object-right ${game.d ? "brightness-0 invert" : ""}`} />
            <p className="-mb-2 text-sm text-muted">{game.g.map(genreLabel).join(" · ")}</p>
            <p className="line-clamp-3 max-w-[23rem] text-[15px] leading-relaxed text-fg/85 max-sm:line-clamp-2 max-sm:text-sm">{game.s}</p>
          </div>
          <div className="mt-5 flex gap-2">
            <a href="#library" className="inline-flex h-12 items-center justify-center rounded-md bg-fg px-5 max-sm:flex-1 text-[15px] text-canvas transition-colors hover:bg-white">
              {t("view")}
            </a>
            <button type="button" aria-label={t("favorite")} className="inline-flex h-12 items-center justify-center gap-2 rounded-md border max-sm:w-12 max-sm:px-0 border-white/20 bg-canvas/60 px-5 text-[15px] text-fg transition-colors hover:bg-surface">
              <Heart /><span className="max-sm:hidden">{t("favorite")}</span>
            </button>
          </div>
        </div>
      </div>

      <ul className="grid grid-cols-5 gap-2 md:flex md:w-[260px] md:flex-col md:gap-1" aria-label={t("featured")}
        onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}
        onFocus={() => setPaused(true)} onBlur={() => setPaused(false)}>
        {FEATURED.map((entry, index) => (
          <li key={entry.t} className="md:flex-1">
            <button type="button" onClick={() => setActive(index)} onFocus={() => setActive(index)} aria-pressed={index === active}
              className={`relative flex h-full w-full items-center gap-3.5 rounded-xl p-1.5 text-start transition-colors md:p-2.5 ${
                index === active ? "bg-surface" : "hover:bg-surface/60"}`}>
              <Image src={entry.c} alt="" width={96} height={128} unoptimized
                className="aspect-[3/4] w-full rounded-md object-cover md:h-full md:w-auto md:max-h-[68px]" />
              <span className={`line-clamp-2 text-sm max-md:hidden ${index === active ? "text-fg" : "text-muted"}`}>{entry.t}</span>
              {index === active && <ShineBorder borderWidth={1.5} duration={6} shineColor={["#ffffff"]} />}
              {index === active && (
                <span className="absolute inset-x-2.5 bottom-1.5 h-0.5 overflow-hidden rounded-full bg-white/10">
                  <span key={`${active}-${paused}`} className="spotlight-progress block h-full bg-fg"
                    style={{animationDuration: `${SLIDE_MS}ms`, animationPlayState: paused ? "paused" : "running"}} />
                </span>
              )}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
