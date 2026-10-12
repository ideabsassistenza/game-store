"use client";

import {useLocale, useTranslations} from "next-intl";
import {useTransition} from "react";
import {usePathname, useRouter} from "@/i18n/navigation";
import {LANGUAGES, type Locale, routing} from "@/i18n/routing";

function Globe() {
  return (
    <svg viewBox="0 0 24 24" className="size-[18px] shrink-0 fill-none stroke-current" strokeWidth="1.75" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3c2.5 2.7 3.75 5.7 3.75 9S14.5 18.3 12 21c-2.5-2.7-3.75-5.7-3.75-9S9.5 5.7 12 3Z" />
    </svg>
  );
}

/**
 * The language, as a native select under a quiet label: the globe and the language's own name, or only
 * the globe where the header is short of room. Choosing one keeps the reader where they are on the page.
 */
export function LocaleSwitcher({compact = false, className = ""}: {compact?: boolean; className?: string}) {
  const t = useTranslations("Nav");
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();

  const change = (next: Locale) => startTransition(() => {
    router.replace(pathname, {locale: next, scroll: false});
  });

  return (
    <label className={`relative inline-flex h-11 items-center gap-2 rounded-full text-[15px] text-muted transition-colors focus-within:text-fg hover:text-fg has-focus-visible:ring-[1.5px] has-focus-visible:ring-white/80 ${
      compact ? "w-11 justify-center" : "px-1"} ${pending ? "opacity-60" : ""} ${className}`}>
      <Globe />
      {!compact && <span>{LANGUAGES[locale].name}</span>}
      <select value={locale} onChange={event => change(event.target.value as Locale)} aria-label={t("language")}
        className="absolute inset-0 cursor-pointer appearance-none rounded-full opacity-0">
        {routing.locales.map(code => (
          <option key={code} value={code} lang={code}>{LANGUAGES[code].name}</option>
        ))}
      </select>
    </label>
  );
}
