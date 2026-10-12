# Translating Overdrive

The PS5 app's text lives in `locales/<code>.json`, one flat JSON object per
language. `en.json` is the source and is complete; the other files start as
`{}`. Any key missing from a language falls back to English, so a file can be
filled a little at a time.

| Code | Language | Direction |
|---|---|---|
| `en` | English (source) | LTR |
| `zh-Hans` | Chinese (Simplified) | LTR |
| `hi` | Hindi | LTR |
| `es` | Spanish | LTR |
| `ar` | Arabic | RTL |
| `fr` | French | LTR |
| `bn` | Bengali | LTR |
| `pt-BR` | Portuguese (Brazil) | LTR |
| `ru` | Russian | LTR |
| `id` | Indonesian | LTR |
| `ur` | Urdu | RTL |
| `de` | German | LTR |
| `ja` | Japanese | LTR |

## Keys

Keys are namespaced by where the text appears: `header.*`, `nav.*`, `hints.*`
(the controller legend at the bottom), `browse.*`, `catalog.*`, `filters.*`,
`sort.*`, `search.*`, `keyboard.*`, `game.*`, `download.*` (the game page's
download area), `sources.*`, `versions.*`, `install.*`, `downloads.*` (the
Downloads screen), `downloadState.*`, `errors.*`, `drives.*`, `units.*`,
`time.*`, `toast.*`, `urlDialog.*`, `language.*`.

Copy a key exactly as it is in `en.json`, translate only the value, and do not
add keys `en.json` does not have (the tests reject them). Keys stay in English
order; the files are sorted alphabetically.

## Message syntax

Values are ICU MessageFormat, the subset below.

- **Placeholders**: `{name}` is replaced by a value. Keep every placeholder of
  the English text, spelled the same; move it wherever the sentence needs it.
  `"download.saveTo": "Save to {drive}"` → `"Guardar en {drive}"`.
- **Plurals**: `{count, plural, one {# game} other {# games}}`. `#` is the
  number, already formatted for the language. Use only the categories your
  language has (table below); `other` is required. Exact matches like `=0 {No
  games}` work in any language.
- **Select**: `{parts, select, all {All parts} other {Archive}}` picks a branch
  by a fixed value. Translate the branch texts, never the values (`all`).
- **Numbers**: `{n, number}`, `{n, number, integer}`, `{n, number, percent}`.
- **Quotes**: an apostrophe is text (`can't`, `l'archive`). To write a literal
  `{` or `}`, quote it: `'{'`. Two apostrophes `''` are one apostrophe.

Placeholders carry text that is already formatted: `{size}` is "42.1 GB",
`{time}` is "3 min", `{drive}` is a drive's name, `{title}` a game title,
`{query}` what was typed, `{source}`/`{failed}`/`{next}` a host's name. Sizes,
speeds and durations come from the `units.*` and `time.*` keys, so translate
those once ("Go"/"Mo" in French, "ГБ" in Russian) and every size follows.

### Plural categories (CLDR cardinal)

| Locale | Categories |
|---|---|
| en, de, ur | `one` (1), `other` |
| hi, bn | `one` (0 and 1), `other` |
| es | `one` (1), `many` (whole millions), `other` |
| fr, pt-BR | `one` (0 and 1), `many` (whole millions), `other` |
| ru | `one` (1, 21, 31…), `few` (2–4, 22–24…), `many` (0, 5–20, 25…), `other` (fractions) |
| ar | `zero`, `one`, `two`, `few` (3–10), `many` (11–99), `other` (100, 101…) |
| zh-Hans, ja, id | `other` only |

## Length

The app runs on a TV at a fixed 1280 × 720 layout; nothing scrolls sideways and
long text is cut with "…". Keep translations about as long as the English:

- Header items (`nav.*`), buttons (`download.button.*`, `downloads.action.*`)
  and legend hints (`hints.*`) are one or two short words. The header has no
  room to spare: "Top rated" as "Mais bem avaliados" pushes its last icons off
  the screen.
- Error titles (`errors.*`) are one short line; actions (`errors.action.*`)
  one sentence.
- Section labels written in capitals in English (`downloads.section.*`,
  `downloads.panel.activity`) are capitals on purpose: the renderer cannot
  uppercase text. Use capitals where your script has them.

## What is not translated

Game data comes from the catalog and stays as the store lists it: titles,
descriptions, publishers, developers, host names, regions and title IDs. The
exceptions are the genre and feature names shown in filters and on cards
(`genre.*`, `feature.*`); a genre without a key shows its catalog name. The
"overdrive" wordmark, PS4/PS5 and Metacritic are names and stay as they are.

## Formatting

The engine's QuickJS has no `Intl` (no `PluralRules`, `NumberFormat`,
`DateTimeFormat`; `toLocaleString` is `toString`), so `format.js`, `plural.js`
and `locales.js` implement what the app needs from CLDR:

- Digits are Western (0–9) in every language, Arabic and Bengali included, so
  numbers read the same as the catalog's.
- Separators: `1,234.5` in en, zh-Hans, ja, ar, ur; `1.234,5` in de, es, pt-BR,
  id; `1 234,5` in fr (narrow no-break space) and ru (no-break space); hi, bn
  and ur group the Indian way (`12,34,567`). Spanish leaves four digits whole
  (`1234`). Sizes are not grouped (`3725.3 GB`).
- Dates use each language's short month names and order (`Oct 14, 2021`,
  `14. Okt. 2021`, `2021年10月14日`).

## How the app uses it

```js
import {useT, formatNumber} from '../i18n/index.js';

function Count({count}) {
  const t = useT(); // re-renders when the language changes
  return <Text>{t('catalog.gameCount', {count})}</Text>;
}
```

- `t(key, params)`; `useT()` in components, `t` from `i18n/core.js` in plain
  modules (only inside functions, never at module load).
- `useLocale()` → `{locale, rtl}`; `formatNumber`, `formatPercent`,
  `formatDate`, `formatList`; `formatSize`/`formatBytes` in `state/size.js`.
- Language: the PS5's system language (`DeviceInfo.get().language`; on the Mac
  preview `PS5_REACT_LANGUAGE` or `LANG`), unless the person picks one under the
  header's globe. The pick is saved in `/download0/overdrive/settings.json`.
  A language the app does not have falls back to English.
- Locale files ship as app resources (`app.json`) and are read when needed:
  only English and the active language are ever in the JS heap, each message
  compiled once. English is also in the bundle, so a locale file the console
  cannot read falls back to it instead of showing message keys.

## Scripts and right-to-left

Inter is baked with the `european` glyph set (Latin, Cyrillic, Greek); Chinese,
Japanese, Devanagari, Bengali and Arabic come from the runtime fonts app.json
lists in `textFonts` (ps5-react `docs/TEXT.md`). The app tells the shaper its
language with `Fonts.setLanguage`, so Han characters take Japanese forms only in
Japanese.

Arabic and Urdu set `direction: 'rtl'` on the app root: rows, sheets, toasts,
menus, progress fills and directional icons mirror, and text aligns to the
right. Exceptions:

- Horizontal rails (`GameRail`, `GenreRail`) and the search keyboard stay left
  to right: a row ScrollView only scrolls toward the right.
- English catalog text keeps its own direction: descriptions use
  `LATIN_IN_RTL`, names `latin(rtl, text)` (a trailing left-to-right mark).
- Focus overrides go through `focusEnd`/`focusStart`; margins and padding are
  physical, so asymmetric ones pick their side with `rtl`.

A Text node holds 255 bytes and a nested Text segment 63: `t()` fits every
message with `fitBytes`, nested segments are fitted to `SPAN_MAX`, and the test
keeps every message short enough for its arguments.

## Checking a translation

```sh
node --test native/i18n/i18n.test.mjs
```

It compiles every message of every file and rejects keys `en.json` lacks.
