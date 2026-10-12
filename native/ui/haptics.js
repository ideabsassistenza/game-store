// Copyright (C) 2026 half144 and PS5 React contributors
// SPDX-License-Identifier: GPL-3.0-or-later
// Additional attribution term: see LICENSE-ATTRIBUTION.
// Console-style haptics, on the same navigation events as the interface sounds. Strengths stay below
// 0.6, where only the controller's fine actuator runs: a crisp tick, never a rumble.
import {Controller, useNavigationEvents} from '@ps5-react/core';

// A one-frame tick could end before the controller rendered it, so moves sometimes felt nothing.
const TICK = [0.09, 35];
const PRESS = [0.15, 30];
const BACK = [0.11, 20];
const PAGE = [0.18, 35];
const EDGE = [0.18, 25];
const NOTICE = [0.25, 140];
const PAGE_ACTIONS = new Set(['l1', 'r1', 'l2', 'r2']);
// Two short bumps read as "nothing further that way"; one would feel like a press.
const EDGE_GAP_MS = 70;

const pulse = ([strength, ms]) => Controller.vibrate(strength, ms);

/** Call once at the root: focus moves tick, presses and page switches tap, an edge bumps twice. */
export function useInterfaceHaptics() {
  useNavigationEvents(event => {
    if (event.type === 'move') pulse(TICK);
    else if (event.type === 'blocked') {
      pulse(EDGE);
      setTimeout(() => pulse(EDGE), EDGE_GAP_MS);
    } else if (event.type === 'press') pulse(event.handled ? PRESS : EDGE);
    else if (event.handled && event.type === 'back') pulse(BACK);
    else if (event.handled && PAGE_ACTIONS.has(event.action)) pulse(PAGE);
    else if (event.handled) pulse(PRESS);
  });
}

/** A download finished or failed, wherever the user is. */
export const pulseNotice = () => pulse(NOTICE);
