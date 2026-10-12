import type {Platform} from "@/components/site/PlatformTag";

/** One title of public/games.json, written by scripts/build-games.mjs with short keys to keep it small. */
export type Game = {t: string; p: Platform[]; c: string; g: string[]; y: number | null};
