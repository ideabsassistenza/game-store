// Copyright (C) 2026 half144 and PS5 React contributors
// SPDX-License-Identifier: GPL-3.0-or-later
// Additional attribution term: see LICENSE-ATTRIBUTION.

// A Text node holds at most 255 bytes of UTF-8 (ER_TEXT_MAX) and each segment of a nested Text 63
// (ER_SPAN_TEXT_MAX): about 85 and 21 CJK, Devanagari or Bengali characters. The engine drops the
// rest without an ellipsis, and a segment can lose half a character, so text that may run long is
// fitted here first.
export const TEXT_MAX = 255;
export const SPAN_MAX = 63;

const ELLIPSIS = '…';
const ELLIPSIS_BYTES = 3;

const utf8Length = codePoint => (codePoint < 0x80 ? 1 : codePoint < 0x800 ? 2 : codePoint < 0x10000 ? 3 : 4);

/** `text` when it fits in `max` UTF-8 bytes, else cut at a character and ended with "…" within them. */
export function fitBytes(text, max = TEXT_MAX) {
  // A UTF-16 unit is at most 3 bytes of UTF-8 (a surrogate pair is 4 for two units).
  if (text.length * 3 <= max) return text;
  let bytes = 0;
  let at = 0;
  let cut = 0;
  for (const char of text) {
    bytes += utf8Length(char.codePointAt(0));
    if (bytes > max) return `${text.slice(0, cut).trimEnd()}${ELLIPSIS}`;
    at += char.length;
    if (bytes <= max - ELLIPSIS_BYTES) cut = at;
  }
  return text;
}
