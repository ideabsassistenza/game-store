// Copyright (C) 2026 half144 and PS5 React contributors
// SPDX-License-Identifier: GPL-3.0-or-later
// Additional attribution term: see LICENSE-ATTRIBUTION.
import {formatNumber, t} from '../i18n/core.js';

const plain = {maximumFractionDigits: 1, useGrouping: false};

// Decimal units, as the console's storage settings count them: a GB is 10^9 bytes. Picks the unit after
// rounding, so 999.6 MB reads "1 GB", not "1000 MB". Sizes are not grouped: a 4 TB drive reads "4000 GB".
export function formatSize(gb) {
  const mb = Math.round(gb * 1000);
  return mb < 1000 ? t('units.megabytes', {n: formatNumber(mb, plain)}) : t('units.gigabytes', {n: formatNumber(gb, plain)});
}

export const formatBytes = bytes => formatSize(bytes / 1e9);
