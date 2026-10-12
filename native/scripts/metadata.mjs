// Copyright (C) 2026 half144 and PS5 React contributors
// SPDX-License-Identifier: GPL-3.0-or-later
// Additional attribution term: see LICENSE-ATTRIBUTION.
const supportedImage = url => /^https:\/\//.test(url || '') && /\.(?:png|jpe?g)(?:[?#]|$)/i.test(url);
const releaseNotes = text => /(?:^|\n)\s*(?:Region|Release note|Contributor|Password):/i.test(text || '');

/** Supplemental metadata cannot change title identity, downloads, platform, size, or covers. */
export function enrichGame(game, metadata = {}) {
  const shortDescription = metadata.shortDescription || (releaseNotes(game.shortDescription) ? '' : game.shortDescription) || '';
  const about = metadata.about || (releaseNotes(game.about) ? '' : game.about) || shortDescription;
  const images = {...game.images};
  if (!supportedImage(images.hero)) images.hero = supportedImage(metadata.images?.hero) ? metadata.images.hero : null;
  const screenshots = [...new Set([...(game.screenshots || []), ...(metadata.screenshots || [])].filter(supportedImage))].slice(0, 6);
  return {
    ...game, shortDescription, about, images, screenshots,
    developer: game.developer || metadata.developer || '',
    publisher: game.publisher || metadata.publisher || '',
    releaseDate: game.releaseDate || metadata.releaseDate || '',
    genres: metadata.genres?.length ? metadata.genres : game.genres || [],
  };
}
