import {defineRouting} from "next-intl/routing";

/** The 13 most spoken languages, English the source, each named in itself for the switcher. */
export const LANGUAGES = {
  en: {name: "English", og: "en_US"},
  "zh-Hans": {name: "简体中文", og: "zh_CN"},
  hi: {name: "हिन्दी", og: "hi_IN"},
  es: {name: "Español", og: "es_ES"},
  ar: {name: "العربية", og: "ar_AR"},
  fr: {name: "Français", og: "fr_FR"},
  bn: {name: "বাংলা", og: "bn_BD"},
  "pt-BR": {name: "Português (Brasil)", og: "pt_BR"},
  ru: {name: "Русский", og: "ru_RU"},
  id: {name: "Bahasa Indonesia", og: "id_ID"},
  ur: {name: "اردو", og: "ur_PK"},
  de: {name: "Deutsch", og: "de_DE"},
  ja: {name: "日本語", og: "ja_JP"},
} as const;

export type Locale = keyof typeof LANGUAGES;

export const routing = defineRouting({
  locales: Object.keys(LANGUAGES) as Locale[],
  defaultLocale: "en",
  localePrefix: "as-needed",
});

export const isRtl = (locale: string) => locale === "ar" || locale === "ur";
/** The page's path in `locale`: English at the root, the rest under their prefix. */
export const localePath = (locale: string) => locale === routing.defaultLocale ? "/" : `/${locale}`;
