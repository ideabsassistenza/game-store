"use client";

import {useFormatter, useTranslations} from "next-intl";
import {useEffect, useMemo, useState} from "react";
import type {Game} from "@/lib/games";
import {TITLES} from "@/lib/library";
import {useGenre} from "@/lib/genres";
import {CoverCard} from "./CoverCard";
import {HEADING} from "./heading";
import {PlatformTag} from "./PlatformTag";
import {ScrollRow} from "./ScrollRow";

// Covers shown at first and added per "Show more": the full library is nearly two thousand.
const PAGE = 48;
const GENRES = 12;
const PLATFORMS = ["", "ps5", "ps4"] as const;

function Chip({active, count, onClick, children}: {active: boolean; count: number; onClick: () => void; children: React.ReactNode}) {
  const format = useFormatter();
  const empty = count === 0 && !active;
  return (
    <button type="button" onClick={onClick} aria-pressed={active} disabled={empty}
      className={`inline-flex h-11 items-center gap-1.5 rounded-full px-3.5 text-[14px] ring-1 ring-inset transition-colors sm:h-9 ${
        active ? "bg-fg font-medium text-canvas ring-fg" : empty ? "text-subtle/40 ring-line/60" : "text-fg/80 ring-line hover:bg-surface hover:text-fg"
      }`}>
      {children}
      <span className={`text-[12px] tabular-nums ${active ? "text-canvas/55" : "text-subtle"}`}>{format.number(count)}</span>
    </button>
  );
}

/**
 * Every title Overdrive lists, as covers with their PS4 and PS5 tags: a showcase of the catalog, not a
 * way to get the games. Filters behave like the app's: platform is one of, genres must all match, and
 * each genre says how many titles it would leave.
 */
export function Library() {
  const t = useTranslations("Library");
  const genreLabel = useGenre();
  const [games, setGames] = useState<Game[]>([]);
  const [query, setQuery] = useState("");
  const [platform, setPlatform] = useState("");
  const [genres, setGenres] = useState<string[]>([]);
  const [shown, setShown] = useState(PAGE);

  useEffect(() => {
    fetch("/games.json").then(response => response.json()).then(setGames);
  }, []);

  const topGenres = useMemo(() => {
    const counts = new Map<string, number>();
    for (const game of games) for (const genre of game.g) counts.set(genre, (counts.get(genre) ?? 0) + 1);
    return [...counts].sort((a, b) => b[1] - a[1]).slice(0, GENRES).map(([genre]) => genre);
  }, [games]);

  const base = useMemo(() => {
    const q = query.trim().toLowerCase();
    return games.filter(game => (!q || game.t.toLowerCase().includes(q)) && (!platform || game.p.includes(platform as Game["p"][number])));
  }, [games, query, platform]);
  const results = useMemo(() => base.filter(game => genres.every(genre => game.g.includes(genre))), [base, genres]);
  const genreCount = (genre: string) => genres.includes(genre) ? results.length : results.filter(game => game.g.includes(genre)).length;

  // Any filter change starts the grid over from its first covers.
  const refine = <T,>(set: (value: T) => void) => (value: T) => { set(value); setShown(PAGE); };
  const search = refine(setQuery);
  const pick = refine(setPlatform);
  const toggleGenre = refine((genre: string) =>
    setGenres(current => current.includes(genre) ? current.filter(item => item !== genre) : [...current, genre]));
  const filtered = Boolean(query || platform || genres.length);
  const clear = () => { setQuery(""); setPlatform(""); setGenres([]); setShown(PAGE); };

  return (
    <section id="library" aria-labelledby="library-title">
      <div className="mx-auto max-w-6xl px-6 pt-8 pb-24 md:pb-32">
        <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
          <h2 id="library-title" className={HEADING}>
            {t("title")}
          </h2>
          <p className="text-[15px] text-muted tabular-nums" aria-live="polite">
            {filtered ? t("filteredCount", {shown: results.length, total: TITLES}) : t("count", {total: TITLES})}
          </p>
        </div>

        {/* The filters stay in reach under the page's header, and the covers fade out beneath them. Phones get
            two rows: search beside the platforms, then the genres as one swipeable line. */}
        <div className="sticky top-16 z-30 -mx-6 mt-6 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-2 gap-y-3 bg-canvas px-6 py-3 after:pointer-events-none after:absolute after:inset-x-0 after:top-full after:h-8 after:bg-linear-to-b after:from-canvas after:to-transparent sm:flex sm:gap-3">
          <label className="flex h-11 items-center gap-2 rounded-full bg-surface ps-3.5 pe-4 ring-fg/80 focus-within:bg-surface-2 focus-within:ring-[1.5px] sm:h-9 sm:w-60 sm:shrink-0">
            <svg viewBox="0 0 24 24" className="size-4 shrink-0 fill-none stroke-muted" strokeWidth="2.25" strokeLinecap="round" aria-hidden="true">
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-4-4" />
            </svg>
            <input type="search" value={query} onChange={event => search(event.target.value)} placeholder={t("search")}
              aria-label={t("searchLabel")} className="h-full w-full bg-transparent text-[16px] text-fg outline-none placeholder:text-subtle focus-visible:animate-none focus-visible:shadow-none sm:text-[14px]" />
          </label>
          <div role="group" aria-label={t("platform")} className="flex shrink-0 rounded-full bg-surface">
            {PLATFORMS.map(option => {
              const active = platform === option;
              return (
                <button key={option} type="button" onClick={() => pick(option)} aria-pressed={active} aria-label={option ? option.toUpperCase() : t("all")}
                  className={`grid h-11 place-items-center rounded-full px-3 text-[14px] transition ring-inset sm:h-9 sm:px-3.5 ${
                    active ? "bg-surface-3 font-medium text-fg ring-1 ring-fg/90" : "text-muted hover:text-fg [&>*]:opacity-50 hover:[&>*]:opacity-90"}`}>
                  {option ? <PlatformTag platforms={[option]} /> : t("all")}
                </button>
              );
            })}
          </div>
          <div className="col-span-2 -mx-6 flex min-w-0 items-center sm:mx-0 sm:flex-1">
            <ScrollRow role="group" aria-label={t("genre")} className="-my-1.5 px-6 py-1.5 sm:px-1">
              {topGenres.map(genre => (
                <Chip key={genre} active={genres.includes(genre)} count={genreCount(genre)} onClick={() => toggleGenre(genre)}>{genreLabel(genre)}</Chip>
              ))}
            </ScrollRow>
            {filtered && (
              <button type="button" onClick={clear} className="me-4 h-11 shrink-0 rounded-full px-3 text-[14px] text-muted transition-colors hover:text-fg sm:me-0 sm:h-9">
                {t("clear")}
              </button>
            )}
          </div>
        </div>

        {results.length ? (
          <ul className="mt-8 grid grid-cols-2 gap-x-4 gap-y-8 sm:mt-12 sm:gap-x-5 sm:grid-cols-4 lg:grid-cols-6">
            {results.slice(0, shown).map(game => (
              <li key={game.t} className="scroll-mt-28 sm:scroll-mt-16">
                <CoverCard title={game.t} cover={game.c} platforms={game.p} genre={game.g[0] ? genreLabel(game.g[0]) : game.p[0].toUpperCase()} />
              </li>
            ))}
          </ul>
        ) : games.length ? (
          <p className="mt-16 text-center text-lg text-muted">{t("empty")}</p>
        ) : (
          <p className="mt-16 text-center text-lg text-muted">{t("loading")}</p>
        )}

        {shown < results.length && (
          <div className="mt-14 flex justify-center">
            <button type="button" onClick={() => setShown(count => count + PAGE)}
              className="h-12 rounded-full bg-surface px-7 text-[15px] font-medium text-fg transition-colors hover:bg-surface-2">
              {t("more", {count: Math.min(PAGE, results.length - shown)})}
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
