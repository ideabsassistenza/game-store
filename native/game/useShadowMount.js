// Copyright (C) 2026 half144 and PS5 React contributors
// SPDX-License-Identifier: GPL-3.0-or-later
// Additional attribution term: see LICENSE-ATTRIBUTION.
import {useEffect, useState} from 'react';
import {shadowMountUp} from '../state/downloads.js';

/** Whether ShadowMountPlus answered, asked once per screen entry when the release installs through it. */
export function useShadowMount(needed) {
  const [up, setUp] = useState(true);
  useEffect(() => {
    if (!needed) return undefined;
    let live = true;
    void shadowMountUp().then(value => { if (live) setUp(value); });
    return () => { live = false; };
  }, [needed]);
  return up;
}
