// Copyright (C) 2026 half144 and PS5 React contributors
// SPDX-License-Identifier: GPL-3.0-or-later
// Additional attribution term: see LICENSE-ATTRIBUTION.
export function edit(query, value, maximum = 40) {
  if (value === 'delete') return query.slice(0, -1);
  if (value === 'clear') return '';
  if (query.length >= maximum || (value === ' ' && !query)) return query;
  return (query + value).slice(0, maximum);
}
