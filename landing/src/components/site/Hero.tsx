import {useLocale, useTranslations} from "next-intl";
import type {CSSProperties} from "react";
import SplitText from "@/components/SplitText";
import {AsciiMark} from "./AsciiMark";
import {Pill} from "./Pill";
import {TvScene} from "./TvScene";

const SPACELESS = new Set(["zh-Hans", "ja"]);
const TITLE = "max-w-[16ch] pb-[0.08em] text-[clamp(2.5rem,5.6vw,4.25rem)] leading-[0.98] font-semibold tracking-[-0.035em]";

/** The claim over the mark drawn in characters, then the app as it looks from the couch. */
export function Hero() {
  const t = useTranslations("Hero");
  const locale = useLocale();
  return (
    <section className="relative overflow-hidden">
      <AsciiMark className="absolute inset-x-0 top-0 h-[34rem] opacity-[0.11] [mask-image:linear-gradient(to_bottom,#000_70%,transparent)] md:h-[36rem]" />
      <div className="relative z-10 mx-auto max-w-6xl px-6 pt-12 sm:pt-16 lg:pt-16">
        {/* Chinese and Japanese have no spaces to split words on: their headline rises in whole. */}
        {SPACELESS.has(locale) ? (
          <h1 style={{"--delay": "0s"} as CSSProperties} className={`hero-rise ${TITLE}`}>{t("title")}</h1>
        ) : (
          <SplitText tag="h1" text={t("title")} splitType="words" textAlign="start"
            delay={70} duration={0.9} ease="power3.out" from={{opacity: 0, y: 28}} to={{opacity: 1, y: 0}} className={TITLE} />
        )}
        <p style={{"--delay": "0.55s"} as CSSProperties} className="hero-rise mt-5 max-w-[34rem] text-lg leading-relaxed text-muted">
          {t("lede")}
        </p>
        <div style={{"--delay": "0.7s"} as CSSProperties} className="hero-rise mt-7 flex flex-wrap gap-3">
          <Pill light href="#install" className="max-sm:px-5">{t("install")}</Pill>
          <Pill href="#library" className="max-sm:px-5">{t("library")}</Pill>
        </div>
      </div>
      <div className="relative -mt-2 sm:-mt-12 lg:-mt-28">
        <TvScene shot="/shots/home.png" priority
          alt={t("shotAlt")} />
      </div>
    </section>
  );
}
