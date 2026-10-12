import type {MetadataRoute} from "next";
import {localePath, routing} from "@/i18n/routing";
import {SITE} from "@/lib/site";

const url = (locale: string) => new URL(localePath(locale), SITE).href;

export default function sitemap(): MetadataRoute.Sitemap {
  const languages = Object.fromEntries(routing.locales.map(locale => [locale, url(locale)]));
  return routing.locales.map(locale => ({url: url(locale), changeFrequency: "weekly", priority: 1, alternates: {languages}}));
}
