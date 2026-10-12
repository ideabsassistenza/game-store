"use client";

import {useFormatter, useTranslations} from "next-intl";
import Image from "next/image";
import {Fragment, useState} from "react";
import {HEADING} from "./heading";

const STEPS = [
  {key: "step1"},
  {key: "step2", path: "/data/homebrew/PPSA99058"},
  {key: "step3"},
] as const;
// The photo's wall is near black, as the hero's is: its edges dissolve into the page.
const FADE = {
  maskImage: "linear-gradient(to right, transparent, #000 12%, #000 88%, transparent), linear-gradient(to bottom, transparent, #000 18%, #000 70%, transparent)",
  maskComposite: "intersect",
};

function Copy({text}: {text: string}) {
  const t = useTranslations("Install");
  const [copied, setCopied] = useState(false);
  return (
    <button type="button" onClick={() => navigator.clipboard.writeText(text).then(() => setCopied(true))}
      onBlur={() => setCopied(false)} className="h-11 shrink-0 rounded-md px-3 text-[13px] text-muted transition-colors hover:text-fg">
      {copied ? t("copied") : t("copy")}
    </button>
  );
}

/**
 * Back in the hero's room, at the console: the claim over the dark wall, and the steps as one of the
 * app's sheets resting on the cabinet below, in order, the path ready to copy.
 */
export function Install() {
  const t = useTranslations("Install");
  const format = useFormatter();
  return (
    <section id="install" aria-labelledby="install-title" className="relative pb-24">
      <div className="relative mx-auto max-w-[88rem]">
        <div className="overflow-hidden" style={FADE}>
          <Image src="/scene/controller.webp" alt="" aria-hidden width={3072} height={2048} quality={90} sizes="(min-width: 1408px) 88rem, 100vw"
            className="aspect-[4/3] w-full object-cover object-[30%_55%] md:aspect-[2/1] md:object-[50%_25%] rtl:-scale-x-100" />
        </div>
        <div className="mx-auto max-w-6xl px-6 md:absolute md:inset-x-0 md:top-[9%]">
          <h2 id="install-title" className={`max-w-[12ch] ${HEADING}`}>{t("title")}</h2>
          <p className="mt-5 max-w-[22rem] text-lg leading-relaxed text-muted">
            {t("lede")}
          </p>
        </div>
      </div>

      <div className="mx-auto mt-10 max-w-6xl px-6 md:-mt-[17%] lg:-mt-60">
        <ol className="relative divide-y divide-line rounded-2xl bg-surface shadow-[0_32px_64px_-24px_rgb(0_0_0/0.9)] md:ms-auto md:w-[min(36rem,58%)]">
          {STEPS.map((step, index) => (
            <li key={step.key} className="flex gap-4 px-5 py-6 sm:gap-5 sm:px-6">
              <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-surface-3 text-sm font-semibold tabular-nums">
                {format.number(index + 1)}
              </span>
              <div className="min-w-0 flex-1">
                <h3 className="text-[17px] font-semibold tracking-[-0.01em] [text-wrap:pretty]">{t(`${step.key}Title`)}</h3>
                <p className="mt-1 leading-relaxed text-muted">{t(`${step.key}Detail`)}</p>
                {"path" in step && (
                  <div className="mt-3 flex items-center justify-between gap-2 rounded-lg bg-canvas py-1 ps-4 pe-1">
                    <code dir="ltr" className="min-w-0 py-2 font-mono text-[14px] text-fg">
                      {step.path.split(/(?<=\/)/).map(part => <Fragment key={part}>{part}<wbr /></Fragment>)}
                    </code>
                    <Copy text={step.path} />
                  </div>
                )}
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
