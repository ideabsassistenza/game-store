// Copyright (C) 2026 half144 and PS5 React contributors
// SPDX-License-Identifier: GPL-3.0-or-later
// Additional attribution term: see LICENSE-ATTRIBUTION.
import {useEffect, useState} from 'react';
import {FileSystem} from '@ps5-react/core';
import {SAVED_FILES, isRecord, isStringList, readJSON} from './read-json.js';

const dir = `${FileSystem.dataDir}/overdrive`;

/**
 * A list (or, for settings, a record) saved in the app's data folder (`name` is its file), or an empty
 * one when it is missing, unreadable or of the wrong shape.
 */
export function loadList(name, what) {
  const valid = SAVED_FILES[name] ?? isStringList;
  return readJSON(FileSystem, `${dir}/${name}`, valid === isRecord ? {} : [], valid,
    message => console.log(`overdrive: ${what}: ${message}`));
}

// Settings and favorites are synced before the rename, so a power cut cannot empty them. Recent
// games and searches are saved on opening a page or a search: a sync there would hold up the screen
// (it runs on the interface's thread and can take seconds on the console) for lists cheap to lose.
const SYNCED = new Set(['settings.json', 'wishlist.json']);

// A failed write keeps the list for this session only, like the web version in private mode.
export function saveList(name, what, list) {
  try {
    FileSystem.mkdir(dir, {recursive: true});
    // Written beside it and renamed over it, so a save cut short never leaves the file half written.
    FileSystem.writeFile(`${dir}/${name}.tmp`, JSON.stringify(list), {sync: SYNCED.has(name)});
    FileSystem.rename(`${dir}/${name}.tmp`, `${dir}/${name}`);
  } catch (error) {
    console.log(`overdrive: ${what} not saved: ${error.message}`);
  }
}

/**
 * A saved list kept outside React: `set` saves it and re-renders every component reading it through
 * `useList`.
 */
export function savedList(name, what) {
  let list = loadList(name, what);
  const listeners = new Set();
  return {
    get: () => list,
    set: next => {
      list = next;
      saveList(name, what, list);
      for (const listener of listeners) listener(list);
    },
    useList: () => {
      const [value, setValue] = useState(list);
      useEffect(() => {
        listeners.add(setValue);
        setValue(list);
        return () => { listeners.delete(setValue); };
      }, []);
      return value;
    },
  };
}
