// Copyright (C) 2026 half144 and PS5 React contributors
// SPDX-License-Identifier: GPL-3.0-or-later
// Additional attribution term: see LICENSE-ATTRIBUTION.
import {useRef, useState} from 'react';
import {motion} from '@ps5-react/core';
import {logical} from './scale.js';

// The source's `layoutId` spring for the section pill.
const slide = {x: {type: 'spring', stiffness: 520, damping: 42, mass: 1}, opacity: {type: 'tween', duration: 0.15}};

/** Collects the screen rectangles (layout events are in screen px) of the header and its items. */
export function useNavLayouts() {
  const [layouts, setLayouts] = useState({});
  // One handler per name for the app's lifetime, so memoized items keep equal props.
  const handlers = useRef({}).current;
  const track = name => (handlers[name] ??= event => {
    const {x, width} = event.layout;
    setLayouts(current => (current[name]?.x === x && current[name]?.width === width ? current
      : {...current, [name]: {x, width}}));
  });
  return [layouts, track];
}

/**
 * One pill behind the current section that slides between items of different widths: it takes the
 * new width at once and only its position springs (translation is cheap; width cannot animate).
 */
export function NavPill({section, layouts}) {
  const last = useRef(null);
  const item = layouts[section];
  if (item && layouts.header) last.current = {x: logical(item.x - layouts.header.x), width: item.width};
  if (!last.current) return null;
  return (
    <motion.View className="absolute left-0 top-3 h-10 rounded-full bg-white/[0.12]"
      style={{width: last.current.width}} initial={false}
      animate={{x: last.current.x, opacity: item ? 1 : 0}} transition={slide} />
  );
}
