# Overdrive design guidelines

Overdrive is a game store for the PS5. People use it from the couch, about three metres away, with a controller. Every rule below follows from that: big type, one clear focus, few choices per screen, and no pointer.

The code is the source of truth for values. This file explains why the values are what they are, so new screens keep the same feel. When you change a token, update it here too.

## Platform

- **Layout grid:** design in **1280 × 720 logical px**. The engine scales by 1.5 to render at 1920 × 1080. Write `className` values in logical px. Runtime numbers go through `px()` in `ui/scale.js`.
- **Fixed chrome:**
  - The header is `h-16` (64 px) at the top. Its background is the page's own black.
  - The legend (button hints) is `h-10` (40 px) at the bottom.
  - Screens live between the two.
- **Side gutter:** `px-8` (32 px) on every screen.
- **Renderer limits:**
  - Scale and rotate only work on boxes up to 341 logical px (512 physical). Bigger elements slide or fade instead.
  - `items-baseline` and `uppercase` are not supported.
  - A `className` must be known at build time: a literal, a template literal, or a ternary of literals. A constant imported from another module doesn't count.
- **Cost:** a full-screen change costs a frame or more, so animate small elements. Keep the number of animated elements bounded: the engine has 1024 motion values.
- **Timers:** the engine has 64 `setTimeout`/`setInterval` slots for the whole app. Never start one per card or per cover: share one interval, or a full pool silently stops every other timer (a grid stopped filling at three cards).

## Color

The palette is monochrome. Color comes from the game art and from the controller light bar, never from the UI chrome.

| Token | Value | Role |
|---|---|---|
| `canvas` | `#000000` | The page. Pure black, so art and focus glow carry the screen |
| `surface` | `#17171a` | Cards, sheets, keys, panels |
| `surface-2` | `#212125` | A focused row or a raised control |
| `surface-3` | `#2b2b30` | Focus on top of `surface-2`, chips |
| `line` | `#2a2a2f` | 1 px borders and dividers |
| `fg` | `#f2f2f3` | Primary text and icons |
| `muted` | `#a3a3ab` | Secondary text, unfocused icons |
| `subtle` | `#8a8a94` | Captions, section labels, disabled text |
| `accent` | `#f2f2f3` | The one primary action per screen: a white fill with `accent-fg` text |
| `accent-fg` | `#0d0d0f` | Text and icons on `accent` |

- Only one white-filled button per view. It is the main action.
- Errors are not red. An error is a `fg` title next to the `alert` icon, with `muted` helper text (see Errors).
- `ui/colors.js` mirrors the theme for props that take a color string. Keep the two in sync.

## Type

**Inter Regular only**, the app's own bundled font. Weight comes from `font-semibold` and `font-bold`.

| Use | Class |
|---|---|
| Page title | `text-xl font-semibold tracking-tight` (Downloads, Results for…) |
| Sheet or dialog title | `text-xl`/`text-2xl font-semibold tracking-tight` |
| Row name, card title | `text-[15px] font-semibold` |
| Body, button label | `text-sm` (most of the UI) or `text-[15px]` on large buttons |
| Detail line, caption | `text-[13px]` |
| Section label | `text-[13px] font-semibold text-subtle` with the count after a `·` |

- Text next to an icon sits optically high. Use `leading-6` on `text-lg` labels inside fixed-height rows (see the search keyboard).
- Truncate with `truncate` or `line-clamp-N` and a fixed width. Never let text push its layout.
- Tracking stays at `tracking-tight` or the default.

## Shape and spacing

- **Radius:**
  - `rounded-md` for buttons, keys and rows.
  - `rounded-lg` for list rows in sheets.
  - `rounded-xl` for dialogs and panels.
  - `rounded-full` for pills and the header nav.
- **Media radius** follows the art's size, so every image of a kind matches:
  - `rounded-xl` for large media: heroes, screenshots, feature art.
  - `rounded-lg` for covers and posters, game cards included.
  - `rounded-md` for thumbnails under 80 px tall.
  - The engine clips children square: an `Image` inside a rounded box carries the radius itself.
- **Elevation:** one 1 px `line` border, or a surface step. No drop shadows.
- **Spacing:**
  - Use the 4 px scale.
  - Inside a control: `gap-2` / `gap-1.5`.
  - Between rows: `gap-1`.
  - Between groups: `gap-6`/`gap-7`.
  - Tight inside a group, generous between groups.
- **Focus inset:** a scroll view that holds focusable cards needs an inner `px-2 pt-3`. The focused card lifts 6 px and draws its ring 6 px outside; without the inset, the ring is clipped at the edges.

## Focus

Focus is the cursor. Exactly one element has it, and it must always be visible.

- `FocusRing` draws two soft outer rings that breathe. Every focusable surface gets one, plus a `focused:` fill (`surface-2`/`surface-3`, or `white` on the accent).
- Cards lift `y: -6` on focus instead of scaling.
- Focus order follows the layout. Set `nextFocus*` only where the geometry lies, for example between columns.
- Opening a sheet or menu traps focus (`FocusScope trap`). Circle closes it and focus returns to the trigger.

## Motion

- **Easing:** `EASE_OUT = [0.16, 1, 0.3, 1]` for entrances and slides. Presets live in `transitions`: `focus`, `panel`, `screen`, `exit`, `pop`.
- **Durations:**
  - 0.1–0.2 s for presses.
  - 0.25–0.35 s for sheets and toasts.
  - 0.45 s for screens.
- **Screens:** they swap instantly, and their blocks stagger in. Don't slide the whole screen.
- **Sheets:** they slide in from the right edge (`x: 48 → 0` with an opacity fade).
- **Launch:** the dial splash revs its needle once. That is the brand's one authored moment; don't add others.

## Controller

The buttons follow the console's own conventions.

| Button | Meaning |
|---|---|
| Cross | Select or press |
| Circle | Back, or close the open sheet |
| Square | Delete in text entry; favorite on a game |
| Triangle | Space in text entry |
| L2 | Clear the search |
| R2 | Submit (search, confirm) |
| L1/R1 | Previous/next section |
| Options | Closes the app (system) |

- The legend at the bottom always shows the actions available for the focused element (`useHints`).
- A control with a shortcut shows the button glyph on itself (`ButtonGlyph`), for example the △ on the Space key.

## Feedback

- **Sound:** `ui/sounds.js` plays a soft tick on focus moves and a click on presses.
- **Haptics** (`ui/haptics.js`):
  - Keep the strength below 0.6, so only the fine actuator runs: a tick, never a rumble.
  - A move is 0.09 for 35 ms.
  - A press is 0.15.
  - An edge is two bumps.
  - A finished download is 0.25 for 140 ms.
- **Light bar:** it takes the focused game's cover color (`ui/lightBar.js`). Grey covers light it white.

## Patterns

### One primary action

Each state has one main action in the big button. The button's label is the verb: Download, Pause, Resume, Retry, Restart download, Install.

### Errors

Errors follow `game/DownloadProblem.jsx`:

1. The button changes to the action that fixes the problem.
2. Under it, the `alert` icon, a short `fg` title saying what happened, and one `muted` line saying what to do.
3. Other recovery actions (restart from zero, remove, another source) go behind a quiet **More options** row that opens a `Menu`.

Copy names the problem and the fix in plain words. No codes or library errors, and never more than two lines.

### Choosing from a list

Long choices, like download sources, open a **side sheet** from the right (`game/SourcePicker.jsx`). The page stays visible behind a 70% black overlay.

- Group the rows by what they mean to the person, not by data: "Download in Overdrive" before "Open in a web browser".
- Each section label shows its count.
- A row has a leading icon for its kind, a name, a detail line, a right-aligned size column, and a ✓ on the current choice.
- Mark the default with a small white **Recommended** chip.
- Hide options that can't be picked and summarize them in one line. Don't list dead rows.

The person rarely needs this sheet. A download whose source can't start (it fails, or the host wants a person in a browser) moves on by itself to the next source the app reaches, before any byte is written, and the page says which one it switched to.

Short choices with up to about 8 options use a `Menu` dropdown under the trigger.

### Settings before an action

Source and drive are chosen before a download starts, as quiet `Choice` rows under the button. After the download starts, they move into More options.

### Notices

A toast slides into the corner with the game's cover (`ui/Toast.jsx`). Use one for events that happen away from the current screen, like a download finishing.

## Do / don't

- **Do:**
  - Keep one white button per view.
  - Put the shortcut glyph on the control.
  - Group choices by meaning.
  - Write short copy that names the fix.
  - Put every user-facing string in `i18n/locales/en.json` and show it through `t()` (see `i18n/README.md`); leave room for longer languages.
  - Validate in the Mac preview and on the console.
- **Don't:**
  - Use colored chrome, gradients or glows outside `FocusRing`.
  - Put more than about five items under the main button.
  - Animate full-screen layers.
  - Show raw error strings.
  - Add a second font.
