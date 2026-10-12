// Copyright (C) 2026 half144 and PS5 React contributors
// SPDX-License-Identifier: GPL-3.0-or-later
// Additional attribution term: see LICENSE-ATTRIBUTION.
// Tests import this first: it reads the locale files from disk, as the app reads its resources.
import {readFileSync} from 'node:fs';
import {configure} from './core.js';

configure(code => JSON.parse(readFileSync(new URL(`./locales/${code}.json`, import.meta.url), 'utf8')));
