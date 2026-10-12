"use client";

import dynamic from "next/dynamic";
import type {ComponentType} from "react";

// Inter has Latin and Cyrillic only; the other scripts fall through to a Noto face as --font-script. Each
// loads on the client as its own chunk, so a page carries only its own @font-face rules (the CJK ones run
// to a hundred unicode-range slices) and the browser then fetches just the slices its text uses.
const arabic = dynamic(() => import("./script/arabic"), {ssr: false});
const FONTS: Record<string, ComponentType> = {
  "zh-Hans": dynamic(() => import("./script/sc"), {ssr: false}),
  ja: dynamic(() => import("./script/jp"), {ssr: false}),
  hi: dynamic(() => import("./script/devanagari"), {ssr: false}),
  bn: dynamic(() => import("./script/bengali"), {ssr: false}),
  ar: arabic,
  ur: arabic,
};

export function ScriptFont({locale}: {locale: string}) {
  const Font = FONTS[locale];
  return Font ? <Font /> : null;
}
