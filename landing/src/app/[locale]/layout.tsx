import type {Metadata, Viewport} from "next";
import {hasLocale, NextIntlClientProvider} from "next-intl";
import {getTranslations, setRequestLocale} from "next-intl/server";
import {notFound} from "next/navigation";
import {inter} from "@/fonts";
import {ScriptFont} from "@/fonts/ScriptFont";
import {isRtl, LANGUAGES, localePath, routing} from "@/i18n/routing";
import {SITE} from "@/lib/site";
import "../globals.css";

export function generateStaticParams() {
  return routing.locales.map(locale => ({locale}));
}

const OG = {url: "/og.png", width: 1200, height: 630};

export async function generateMetadata({params}: LayoutProps<"/[locale]">): Promise<Metadata> {
  const {locale} = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const t = await getTranslations({locale, namespace: "Metadata"});
  const title = t("title");
  const description = t("description");
  const images = [{...OG, alt: t("ogAlt")}];
  const languages = Object.fromEntries([...routing.locales.map(code => [code, localePath(code)]), ["x-default", "/"]]);
  return {
    metadataBase: new URL(SITE),
    title: {default: title, template: "%s · Overdrive"},
    description,
    applicationName: "Overdrive",
    keywords: ["PS5", "PS5 homebrew", "PlayStation 5", "game library", "PS4", "homebrew app", "Overdrive"],
    alternates: {canonical: localePath(locale), languages},
    openGraph: {type: "website", url: localePath(locale), siteName: "Overdrive", title, description, locale: LANGUAGES[locale].og, images},
    twitter: {card: "summary_large_image", title, description, images},
    robots: {index: true, follow: true},
  };
}

export const viewport: Viewport = {themeColor: "#000000", colorScheme: "dark"};

export default async function RootLayout({children, params}: LayoutProps<"/[locale]">) {
  const {locale} = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  return (
    // Browser extensions (translators, password managers) add attributes to <html> before React
    // loads; only this element's attributes are exempt from the hydration check.
    <html lang={locale} dir={isRtl(locale) ? "rtl" : "ltr"}
      className={`${inter.variable} antialiased`} suppressHydrationWarning>
      <body className="min-h-dvh font-sans">
        <ScriptFont locale={locale} />
        <NextIntlClientProvider>{children}</NextIntlClientProvider>
      </body>
    </html>
  );
}
