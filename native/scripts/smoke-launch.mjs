// Copyright (C) 2026 half144 and PS5 React contributors
// SPDX-License-Identifier: GPL-3.0-or-later
// Additional attribution term: see LICENSE-ATTRIBUTION.
// Launches the app in the framework's desktop preview over data folders it must open over, and fails if
// the app does not reach its first frame and stay open: one whose saved files are damaged (empty, cut
// short, the wrong shape), as a forced close or a power cut can leave them on the console, then the data
// each shipped version leaves behind (native/state/fixtures/upgrade), as an update finds it.
//   node native/scripts/smoke-launch.mjs <ps5-react checkout>
import {spawnSync} from 'node:child_process';
import {cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {dirname, join} from 'node:path';
import {upgradeFixtures} from '../state/fixtures/upgrade/fixtures.mjs';

const framework = process.argv[2] ?? process.env.PS5_REACT_DIR;
if (!framework) throw new Error('usage: smoke-launch.mjs <ps5-react checkout>');
const drive = join(framework, 'tools/ps5_drive.py');
// Without it every delete fails, and the updater's cleanup only logs that: the launch alone would not show it.
if (!readFileSync(join(framework, 'runtime/js/native.js'), 'utf8').includes('removeAsync:'))
  throw new Error(`PS5 React at ${framework} has no FileSystem.removeAsync; update the engine`);
const work = mkdtempSync(join(tmpdir(), 'overdrive-smoke-'));
// Its own app name gives the preview its own data folder, so the developer's is left alone.
const app = join(work, 'overdrive-smoke');
cpSync(new URL('..', import.meta.url).pathname, app, {recursive: true, filter: path => !/\/node_modules(\/|$)/.test(path)});
const sandbox = join(framework, '.build/overdrive-smoke/sandbox/download0');
const DAMAGED = {'downloads.json': '', 'downloads.json.tmp': '{"version":1,"jobs":[{"id":', 'settings.json': 'null',
  'wishlist.json': '{"a":1}', 'recent.json': '7', 'searches.json': '\u0000garbage', 'pending-image.json': '['};
// The preview keeps the queue in the data folder, where the console's queue folder files go too.
const scenarios = [
  {name: `${Object.keys(DAMAGED).length} damaged files`, files: Object.fromEntries(Object.entries(DAMAGED).map(([name, text]) => [`overdrive/${name}`, text]))},
  ...upgradeFixtures().map(({version, files}) => ({name: `${version}'s data`, files: Object.fromEntries(Object.entries(files)
    .map(([path, text]) => [path.replace(/^data-dir\//, '').replace(/^queue-dir\//, 'overdrive/'), text]))})),
];

function launch({name, files}, index) {
  rmSync(sandbox, {recursive: true, force: true});
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(dirname(join(sandbox, path)), {recursive: true});
    writeFileSync(join(sandbox, path), text);
  }
  const env = {...process.env, PS5_DRIVE_SOCKET: join(work, `drive-${index}.sock`)};
  const run = (...args) => spawnSync('python3', [drive, ...args], {env, encoding: 'utf8'});
  try {
    const started = run('start', '--app-dir', app);
    if (started.status !== 0) throw new Error(`the preview did not start:\n${started.stdout}${started.stderr}`);
    run('wait', '6000');
    const output = readFileSync(`${env.PS5_DRIVE_SOCKET}.log`, 'utf8');
    const snapshot = run('snapshot', '--json');
    const failures = output.split('\n').filter(line => /exception|SyntaxError|TypeError|ReferenceError/i.test(line));
    if (snapshot.status !== 0 || !JSON.parse(snapshot.stdout || '[]').length || failures.length)
      throw new Error(`the app did not open over ${name}:\n${failures.join('\n') || snapshot.stderr || output.slice(-2000)}`);
    console.log(`smoke: opened over ${name}`);
  } finally {
    run('stop');
  }
}

try {
  scenarios.forEach(launch);
} finally {
  rmSync(work, {recursive: true, force: true});
}
