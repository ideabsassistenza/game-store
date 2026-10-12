// Copyright (C) 2026 half144 and PS5 React contributors
// SPDX-License-Identifier: GPL-3.0-or-later
// Additional attribution term: see LICENSE-ATTRIBUTION.

/** A set has one password; never choose between conflicting volume passwords. */
export function archivePassword(release) {
  const sources = [release, ...(release.parts || []).flatMap(part => part.sources)];
  const passwords = new Set();
  for (const source of sources) {
    const value = source.archivePassword;
    if (value == null || value === '') continue;
    if (typeof value !== 'string' || value.length > 1024 || value.includes('\0'))
      throw new Error('Invalid archive password metadata.');
    passwords.add(value);
  }
  if (passwords.size > 1) throw new Error('Archive volumes have conflicting passwords. Choose another complete source.');
  return passwords.values().next().value;
}
