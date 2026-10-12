// Copyright (C) 2026 half144 and PS5 React contributors
// SPDX-License-Identifier: GPL-3.0-or-later
// Additional attribution term: see LICENSE-ATTRIBUTION.
import {readdirSync, readFileSync} from 'node:fs';
import {join, relative} from 'node:path';

const here = new URL('.', import.meta.url).pathname;

function files(directory) {
  return readdirSync(directory, {withFileTypes: true}).flatMap(entry => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? files(path) : [path];
  });
}

/**
 * The data each shipped version leaves on a console, one set per version folder: `files` maps a path
 * under `data-dir/` (the app's data folder, /download0 on the console) or `queue-dir/` (the queue's
 * folder, /data/ps5-react/PPSA99058/queue) to the text saved there.
 */
export const upgradeFixtures = () => readdirSync(here, {withFileTypes: true}).filter(entry => entry.isDirectory())
  .map(({name}) => ({version: name, files: Object.fromEntries(files(join(here, name))
    .map(path => [relative(join(here, name), path), readFileSync(path, 'utf8')]))}));
