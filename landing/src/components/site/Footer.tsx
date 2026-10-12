import {useTranslations} from "next-intl";
import {AsciiMark} from "./AsciiMark";
import {LocaleSwitcher} from "./LocaleSwitcher";
import {Mark} from "./Mark";

const LINKS = [
  {href: "#tour", key: "tour"},
  {href: "#library", key: "library"},
  {href: "#install", key: "install"},
  {href: "#top", key: "backToTop"},
] as const;

/** The page closes on the dial it opened with, still lapping, under the wordmark and the fine print. */
export function Footer() {
  const t = useTranslations("Nav");
  const footer = useTranslations("Footer");
  return (
    <footer className="relative overflow-hidden">
      <AsciiMark className="absolute inset-x-0 bottom-0 h-full opacity-[0.09] [mask-image:linear-gradient(to_bottom,transparent,#000_45%)]" />
      <div className="relative mx-auto flex min-h-[22rem] max-w-6xl flex-col justify-between gap-12 px-6 pt-16 pb-[max(2.5rem,env(safe-area-inset-bottom))]">
        <div>
          <a href="#top" className="inline-flex items-center gap-2.5 rounded-md text-fg" aria-label={t("homeFooter")}>
            <Mark className="size-7" />
            <span className="text-[22px] font-semibold tracking-[-0.03em]">overdrive</span>
          </a>
          <nav aria-label={t("footer")} className="mt-3 -ms-1 flex flex-wrap gap-x-4">
            {LINKS.map(link => (
              <a key={link.href} href={link.href} className="inline-flex h-11 items-center rounded-sm px-1 text-[15px] text-muted transition-colors hover:text-fg">{t(link.key)}</a>
            ))}
          </nav>
        </div>
        <div className="flex flex-col items-start gap-4">
          <LocaleSwitcher className="-ms-1" />
          <p className="max-w-xl text-sm leading-relaxed text-subtle">{footer("disclaimer")}</p>
        </div>
      </div>
    </footer>
  );
}
