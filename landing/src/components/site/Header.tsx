"use client";

import {useLocale, useTranslations} from "next-intl";
import {useEffect, useRef, useState} from "react";
import {LocaleSwitcher} from "./LocaleSwitcher";
import {Mark} from "./Mark";

const LINKS = ["tour", "library", "install"] as const;

/**
 * The app's header on the page's own black: the wordmark, and the sections with a pill that slides
 * to the one in view, as the app's tabs do (native/ui/Header.jsx).
 */
export function Header() {
  const t = useTranslations("Nav");
  // Longer labels than English's take a little of the padding on phones.
  const tight = useLocale() !== "en";
  const [current, setCurrent] = useState<string | null>(null);
  const [pill, setPill] = useState<{left: number; width: number} | null>(null);
  const links = useRef<Record<string, HTMLAnchorElement | null>>({});

  useEffect(() => {
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) if (entry.isIntersecting) setCurrent(entry.target.id);
    }, {rootMargin: "-45% 0px -50% 0px"});
    for (const id of LINKS) {
      const section = document.getElementById(id);
      if (section) observer.observe(section);
    }
    const top = () => { if (window.scrollY < 200) setCurrent(null); };
    window.addEventListener("scroll", top, {passive: true});
    return () => { observer.disconnect(); window.removeEventListener("scroll", top); };
  }, []);

  useEffect(() => {
    const place = () => {
      const link = current ? links.current[current] : null;
      setPill(link ? {left: link.offsetLeft, width: link.offsetWidth} : null);
    };
    place();
    window.addEventListener("resize", place);
    return () => window.removeEventListener("resize", place);
  }, [current]);

  return (
    <header className="sticky top-0 z-40 bg-canvas">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-6">
        <a href="#top" className="flex items-center gap-2 rounded-md text-fg" aria-label={t("home")}>
          <Mark className="size-6" />
          <span className="text-[19px] font-semibold tracking-[-0.02em]">overdrive</span>
        </a>
        <div className="flex items-center gap-1">
        <nav aria-label={t("sections")} className="relative flex items-center sm:gap-1">
          <span aria-hidden className="absolute top-0 h-full rounded-full bg-surface-2 transition-[left,width,opacity] duration-300 ease-out motion-reduce:transition-none"
            style={{left: pill?.left ?? 0, width: pill?.width ?? 0, opacity: pill ? 1 : 0}} />
          {LINKS.map(id => (
            <a key={id} href={`#${id}`} ref={node => { links.current[id] = node; }}
              aria-current={current === id ? "true" : undefined}
              className={`relative inline-flex items-center rounded-full px-2.5 whitespace-nowrap py-2 text-[15px] transition-colors max-md:h-11 max-[374px]:px-2 sm:px-4 ${tight ? "max-[420px]:px-2" : ""} ${
                current === id ? "text-fg" : "text-muted hover:text-fg"}`}>
              {t(id)}
            </a>
          ))}
        </nav>
        <LocaleSwitcher compact className="max-sm:hidden" />
        </div>
      </div>
    </header>
  );
}
