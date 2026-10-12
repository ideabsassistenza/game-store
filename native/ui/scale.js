// Copyright (C) 2026 half144 and PS5 React contributors
// SPDX-License-Identifier: GPL-3.0-or-later
// Additional attribution term: see LICENSE-ATTRIBUTION.

// className lengths are scaled at build time; sizes computed at runtime need the same factor.
const SCALE = screen.width / 1280;
// The engine's transform buffer (ERUI_SCRATCH_W/H): larger boxes do not render scaled.
const TRANSFORM_PX = 512;

/** Logical px (1280-wide layout) → render px, for style values computed at runtime. */
export const px = n => Math.round(n * SCALE);

/** Render px → logical px, for layout events (render px) that feed motion targets (logical). */
export const logical = n => n / SCALE;

/** Whether a box of this logical size can scale or rotate. */
export const canScale = (width, height) => px(width) <= TRANSFORM_PX && px(height) <= TRANSFORM_PX;
