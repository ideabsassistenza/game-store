import {useTranslations} from "next-intl";

/** A genre of the catalog in the page's language: "Music/Rhythm" is the key MusicRhythm, unknown ones stay as they are. */
export function useGenre() {
  const t = useTranslations("Genres");
  return (genre: string) => {
    const key = genre.replace(/\W/g, "");
    return t.has(key as never) ? t(key as never) : genre;
  };
}
