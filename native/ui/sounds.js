// Copyright (C) 2026 half144 and PS5 React contributors
// SPDX-License-Identifier: GPL-3.0-or-later
// Additional attribution term: see LICENSE-ATTRIBUTION.
// Console-style interface sounds. The WAVs are ps5-react's set, derived from Google's Material Design
// sound resources (CC BY 4.0; see assets/sounds/NOTICE.txt).
import {Sound, useNavigationEvents} from '@ps5-react/core';
import focus from '../assets/sounds/focus.wav';
import confirm from '../assets/sounds/confirm.wav';
import back from '../assets/sounds/back.wav';
import error from '../assets/sounds/error.wav';
import page from '../assets/sounds/page.wav';
import notify from '../assets/sounds/notify.wav';

// The page tap leans toward the shoulder that was pressed.
const PAGE_PAN = {l1: -0.4, l2: -0.4, r1: 0.4, r2: 0.4};

/** Call once at the root: every focus move, edge, press, back and page switch sounds. */
export function useInterfaceSounds() {
  useNavigationEvents(event => {
    if (event.type === 'move') Sound.play(focus);
    else if (event.type === 'blocked') Sound.play(error);
    else if (event.type === 'press') Sound.play(event.handled ? confirm : error);
    else if (event.handled && event.type === 'back') Sound.play(back);
    else if (event.handled && event.action in PAGE_PAN) Sound.play(page, {pan: PAGE_PAN[event.action]});
    else if (event.handled) Sound.play(confirm);
  });
}

/** For toasts and notifications. */
export const playNotify = () => Sound.play(notify);
