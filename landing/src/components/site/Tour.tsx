import Image from "next/image";
import {useTranslations} from "next-intl";
import type {ReactNode} from "react";
import {HEADING} from "./heading";
import {Spotlight} from "./Spotlight";
import {TvScene} from "./TvScene";

// The app draws on the page's own black, so the grid's sides and foot dissolve into it.
const MELT = {
  maskImage: "linear-gradient(to right, transparent, #000 8%, #000 92%, transparent), linear-gradient(to bottom, #000 70%, transparent)",
  maskComposite: "intersect",
};

/** A screenshot as a lit panel: the TV's faint sheen from the hero and a hairline edge instead of a bezel. */
function Screen({children}: {children: ReactNode}) {
  return (
    <div className="relative overflow-hidden rounded-xl bg-canvas ring-1 ring-white/10">
      {children}
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-[linear-gradient(115deg,rgb(255_255_255/0.05),transparent_38%)]" />
    </div>
  );
}

/**
 * The home spotlight to play with, then three screens at three scales rather than one template
 * repeated: the grid as wide as the window, the filters as a tall panel beside their claim, a
 * game's gallery set off to one side.
 */
export function Tour() {
  const t = useTranslations("Tour");
  return (
    <section id="tour" aria-label={t("label")} className="pt-16 pb-24 sm:pt-24 md:pb-32">
      <article className="mx-auto max-w-6xl px-6">
        <h2 className={`max-w-2xl ${HEADING}`}>{t("homeTitle")}</h2>
        <p className="mt-5 max-w-xl text-lg leading-relaxed text-muted">
          {t("homeBody")}
        </p>
        <div className="mt-12">
          <Spotlight />
        </div>
      </article>

      <article className="mt-24 md:mt-36">
        <div className="mx-auto max-w-6xl px-6">
          <h2 className={`max-w-2xl ${HEADING}`}>{t("gridTitle")}</h2>
          <p className="mt-5 max-w-xl text-lg leading-relaxed text-muted">
            {t("gridBody")}
          </p>
        </div>
        <div dir="ltr" className="mx-auto mt-10 max-w-[88rem] overflow-hidden" style={MELT}>
          <Image src="/shots/library.png" alt={t("gridAlt")}
            width={1920} height={1080} quality={90} sizes="(min-width: 1408px) 88rem, 100vw"
            className="screen-on h-auto w-full max-md:-ml-[30%] max-md:w-[160%] max-md:max-w-none" />
        </div>
      </article>

      <article className="mx-auto mt-24 grid max-w-6xl items-center gap-12 px-6 md:grid-cols-[minmax(0,6fr)_minmax(0,5fr)] md:gap-16">
        <div>
          <h2 className={HEADING}>{t("filtersTitle")}</h2>
          <p className="mt-5 max-w-md text-lg leading-relaxed text-muted">
            {t("filtersBody")}
          </p>
        </div>
        <Screen>
          <Image src="/shots/filters-panel.png" alt={t("filtersAlt")}
            width={760} height={900} quality={90} sizes="(min-width: 768px) 30rem, 100vw" className="h-auto w-full" />
        </Screen>
      </article>

      <article className="mx-auto mt-20 grid max-w-[110rem] items-center gap-8 md:grid-cols-[minmax(0,1fr)_minmax(16rem,24rem)] md:gap-10">
        <TvScene shot="/shots/game-cyberpunk.png" sizes="(min-width: 768px) 70vw, 100vw" fadeRight="94%"
          crop={{left: 16, top: 9, width: 70, height: 66}}
          alt={t("pageAlt")} />
        <div className="px-6 md:ps-0 md:pe-8 lg:pe-16">
          <h2 className={HEADING}>{t("pageTitle")}</h2>
          <p className="mt-5 max-w-sm text-lg leading-relaxed text-muted">
            {t("pageBody")}
          </p>
        </div>
      </article>
    </section>
  );
}
