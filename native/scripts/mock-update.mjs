// Copyright (C) 2026 half144 and PS5 React contributors
// SPDX-License-Identifier: GPL-3.0-or-later
// Additional attribution term: see LICENSE-ATTRIBUTION.

// Serves a fake GitHub release to test the updater in the desktop preview. The release is the given
// preview bundle with only its version changed, zipped as Overdrive-desktop.zip, behind the same
// `releases/latest` JSON GitHub answers (tag, assets, SHA-256 digest). It also stands the bundle in as
// the preview's install and points the app's feed here.
//
//   node native/scripts/mock-update.mjs --ps5-react ~/Documents/ps5-react --version 0.0.87
//
// With --zip, it serves that console build (a ZIP of dist/PPSA99058) as Overdrive-PPSA99058.zip instead,
// on --host, the Mac's address on the console's network. With --image, it serves a zipped console image
// (Overdrive-PPSA99058.exfat.zip, made by the release skill) the same way, for an image install.
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {copyFileSync, createReadStream, mkdirSync, mkdtempSync, readFileSync, statSync, writeFileSync} from 'node:fs';
import {createServer} from 'node:http';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {parseArgs} from 'node:util';

const {values} = parseArgs({options: {'ps5-react': {type: 'string'}, version: {type: 'string'}, port: {type: 'string', default: '8787'},
  zip: {type: 'string'}, image: {type: 'string'}, host: {type: 'string', default: '127.0.0.1'}}});
if (!values['ps5-react'] || !values.version) throw new Error('Pass --ps5-react <dir> and --version <x.y.z>');
const build = join(values['ps5-react'], '.build/native');
const bundle = join(build, 'generated/app.bundle.js');
const sandbox = join(build, 'sandbox/download0');
const base = `http://${values.host}:${values.port}`;
const feed = `${base}/repos/overdriveps5/overdrive-releases/releases/latest`;
const asset = values.image ? 'Overdrive-PPSA99058.exfat.zip' : values.zip ? 'Overdrive-PPSA99058.zip' : 'Overdrive-desktop.zip';

let zip = values.image ?? values.zip, current = '(console)';
if (!zip) {
  const install = join(sandbox, 'homebrew/PPSA99058');
  mkdirSync(install, {recursive: true});
  copyFileSync(bundle, join(install, 'app.bundle.js'));
  mkdirSync(join(sandbox, 'overdrive'), {recursive: true});
  writeFileSync(join(sandbox, 'overdrive/update-feed'), feed);

  const stage = mkdtempSync(join(tmpdir(), 'overdrive-release-'));
  const source = readFileSync(bundle, 'utf8');
  current = /var VERSION = "([^"]+)";/.exec(source)?.[1];
  if (!current) throw new Error(`No VERSION in ${bundle}`);
  writeFileSync(join(stage, 'app.bundle.js'), source.replace(`var VERSION = "${current}";`, `var VERSION = "${values.version}";`));
  zip = join(stage, asset);
  execFileSync('zip', ['-q', '-j', zip, join(stage, 'app.bundle.js')]);
}
const size = statSync(zip).size;
const digest = createHash('sha256').update(readFileSync(zip)).digest('hex');

const release = {tag_name: `v${values.version}`, name: `Overdrive ${values.version}`, body: 'Only the version number changes.',
  draft: false, prerelease: false, assets: [{name: asset, size, digest: `sha256:${digest}`,
    browser_download_url: `${base}/assets/${asset}`}]};

createServer((request, response) => {
  console.log(request.method, request.url);
  if (request.url === new URL(feed).pathname) {
    response.writeHead(200, {'Content-Type': 'application/json'});
    response.end(JSON.stringify(release));
  } else if (request.url === `/assets/${asset}`) {
    response.writeHead(200, {'Content-Type': 'application/zip', 'Content-Length': size});
    createReadStream(zip).pipe(response);
  } else {
    response.writeHead(404).end();
  }
}).listen(Number(values.port), values.host, () => {
  console.log(`Installed v${current}; serving v${values.version} (${size} bytes, sha256 ${digest}) at ${feed}`);
  if (!values.zip && !values.image) console.log(`Run: PS5_REACT_SANDBOX=${join(build, 'sandbox')} ${join(build, 'desktop/ps5-react-preview')} ${join(sandbox, 'homebrew/PPSA99058/app.bundle.js')}`);
});
