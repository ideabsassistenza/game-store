import assert from 'node:assert/strict';
import test from 'node:test';
import {createServer} from 'node:http';
import {capturedVikingFile, linkPageMetadata, matchingVikingURL, vikingLinkPage, vikingMetadata, validateVikingCapture} from './viking-capture.js';
const html = '<h2 id="filename">Game &amp; DLC.pkg</h2><p id="size">1.00 GB</p>';
const url = 'https://vikingfile.com/d/Ab01234567/Game%20%26%20DLC.pkg';
test('metadata uses the public filename, decodes entities and rejects path/control injection', () => {
  assert.equal(vikingMetadata(html).filename, 'Game & DLC.pkg');
  for (const name of ['../game.pkg', 'file&#10;.pkg', 'a'.repeat(161)])
    assert.throws(() => vikingMetadata(html.replace('Game &amp; DLC.pkg', name)), /filename/);
  assert.throws(() => vikingMetadata('<h2 id="filename">file.pkg</h2>'), /size/);
});
test('captured routes require the exact host, ten-character id and decoded filename', () => {
  assert.ok(matchingVikingURL(url, 'Game & DLC.pkg'));
  assert.ok(matchingVikingURL('https://vik1ngfile.site/d/Ab01234567/Game%20%26%20DLC.pkg', 'Game & DLC.pkg'));
  assert.equal(matchingVikingURL('https://vik1ngfile.site.evil.test/d/Ab01234567/Game%20%26%20DLC.pkg', 'Game & DLC.pkg'), false);
  for (const bad of [url.replace('vikingfile.com', 'vikingfile.com.evil.test'), url + '?x=1',
    url.replace('Ab01234567', 'short'), url.replace('DLC', 'Other'), url.replace('%20', '%ZZ'), url + '/extra'])
    assert.equal(matchingVikingURL(bad, 'Game & DLC.pkg'), false, bad);
});
test('one-byte GET binds total size and rejects pages, unsupported ranges and expiry', async () => {
  let response = {ok: true, status: 206, url, text: async () => 'R', headers: {'content-length': '1',
    'content-range': 'bytes 0-0/1073741824', etag: '"file-v1"', 'content-type': 'application/octet-stream'}};
  const http = {request: async (_, options) => { assert.equal(options.method, 'GET');
    assert.deepEqual(options.headers, {Range: 'bytes=0-0'}); assert.equal(options.followRedirects, false); return response; }};
  assert.equal((await validateVikingCapture(http, url, vikingMetadata(html))).expectedBytes, 1073741824);
  assert.equal((await validateVikingCapture(http, url, vikingMetadata(html, 3 * 2 ** 30))).expectedBytes, 1073741824);
  await assert.rejects(validateVikingCapture(http, url, vikingMetadata(html.replace('1.00 GB', '2.00 GB'))), /validation/);
  for (const change of [{status: 404, ok: false}, {status: 200},
    {headers: {...response.headers, 'content-type': 'text/html'}},
    {headers: {...response.headers, 'content-range': 'bytes 1-1/1073741824'}},
    {text: async () => ''}, {text: async () => 'RR'},
    {headers: {...response.headers, 'content-length': '0'}},
    {headers: {...response.headers, 'content-disposition': 'attachment; filename="other.pkg"'}}]) {
    const original = response; response = {...response, ...change};
    await assert.rejects(validateVikingCapture(http, url, vikingMetadata(html)), /validation|different/);
    response = original;
  }
});
test('Vikingfile redirects to its storage hosts, with a bounded chain and stable file identity', async () => {
  const final = {ok: true, status: 206, text: async () => 'R', headers: {'content-length': '1',
    'content-range': 'bytes 0-0/1073741824', 'last-modified': 'Wed, 07 Oct 2026 10:00:00 GMT'}};
  let location = 'https://bucket.s3.bhs.io.cloud.ovh.net/file?signature=public';
  const calls = [];
  const http = {request: async (target, options) => {
    calls.push({target, options});
    return target === url ? {status: 302, headers: {location}} : final;
  }};
  assert.equal((await validateVikingCapture(http, url, vikingMetadata(html))).expectedBytes, 1073741824);
  assert.equal(calls[1].target, location);
  for (const bad of ['https://evil.test/file', 'http://vikingfile.com/file', '//evil.test/file',
    'https://vikingfile.com:444/file', 'https://vikingfile.com.evil.test/file']) {
    location = bad;
    await assert.rejects(validateVikingCapture(http, url, vikingMetadata(html)), /host|Invalid HTTP URL/);
  }
  await assert.rejects(validateVikingCapture({request: async () => ({status: 302, headers: {location: url}})}, url, vikingMetadata(html)), /limit/);
  await assert.rejects(validateVikingCapture({request: async () => ({...final, headers: {...final.headers,
    'last-modified': '', etag: 'W/"weak"'}})}, url, vikingMetadata(html)), /stable identity/);
});
test('PC HTTP reproduction: HEAD fails, ranged GET follows storage redirect and reads one byte', async t => {
  const storage = 'https://bucket.s3.bhs.io.cloud.ovh.net/file?signature=public';
  const requests = [];
  const server = createServer((req, res) => {
    requests.push({method: req.method, range: req.headers.range, path: req.url});
    if (req.method === 'HEAD') { res.writeHead(405); res.end(); return; }
    if (req.url === '/landing') { res.writeHead(302, {Location: storage}); res.end(); return; }
    if (req.headers.range !== 'bytes=0-0') { res.writeHead(400); res.end(); return; }
    res.writeHead(206, {'Content-Length': '1', 'Content-Range': 'bytes 0-0/1073741824',
      'Content-Type': 'application/octet-stream', ETag: '"owned-fixture"'});
    res.end('R');
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const origin = `http://127.0.0.1:${server.address().port}`;
  assert.equal((await fetch(`${origin}/landing`, {method: 'HEAD'})).status, 405);
  const http = {request: async (target, options) => {
    // Preserve production URL policy; only the test adapter maps allowed URLs to our owned server.
    assert.ok(target === url || target === storage);
    const response = await fetch(origin + (target === url ? '/landing' : '/file'), {
      method: options.method, headers: options.headers, redirect: 'manual'});
    const body = await response.text();
    assert.ok(Buffer.byteLength(body) <= options.maxBytes);
    return {ok: response.ok, status: response.status, headers: Object.fromEntries(response.headers), text: async () => body};
  }};
  assert.equal((await validateVikingCapture(http, url, vikingMetadata(html))).expectedBytes, 1073741824);
  assert.deepEqual(requests.map(r => r.method), ['HEAD', 'GET', 'GET']);
  assert.equal(requests[2].range, 'bytes=0-0');
});
test('link pages that name VikingFile are recognised by label or fragment, and their part is required', () => {
  const page = {url: 'https://links.example.com/c/Fx01Ab23#VikingFile', requiresBrowser: true, label: 'Dump'};
  assert.ok(vikingLinkPage(page));
  assert.ok(vikingLinkPage({...page, url: 'https://filecrypt.cc/Container/AB12.html', label: 'Fpkg - Viki'}));
  assert.equal(vikingLinkPage({...page, url: 'https://links.example.com/c/Fx01Ab23#AkiraBox'}), false);
  assert.equal(vikingLinkPage({url: 'https://vikingfile.com/f/Ab01234567', requiresBrowser: true}), false);
  const metadata = linkPageMetadata({...page, label: 'Dump - VikingFile part 3', sizeBytes: 9663676416});
  assert.equal(capturedVikingFile('https://vikingfile.com/d/Ab01234567/Game.part03.rar', metadata).filename, 'Game.part03.rar');
  for (const name of ['Game.part3.rar', 'Game part 3.rar', 'Game.part003.rar'])
    assert.ok(capturedVikingFile(`https://vikingfile.com/d/Ab01234567/${encodeURIComponent(name)}`, metadata));
  for (const name of ['Game.part30.rar', 'Game.part13.rar', 'Game.part1.rar', 'Game.rar'])
    assert.throws(() => capturedVikingFile(`https://vikingfile.com/d/Ab01234567/${name}`, metadata), /part 3/, name);
  for (const bad of ['https://vikingfile.com/d/Ab01234567/..%2Fx', 'https://vikingfile.com/d/short/x.rar', 'https://evil.test/d/Ab01234567/x'])
    assert.throws(() => capturedVikingFile(bad, linkPageMetadata(page)), /usable/, bad);
});
test('the page size wins over a rounded catalog size', () => {
  const metadata = vikingMetadata('<div id="filename">G.exfat</div><div id="size">10.80 GB</div>', 11596411699);
  assert.equal(metadata.expectedBytes, null);
  assert.equal(vikingMetadata('<div id="filename">G.exfat</div>', 11596411699).expectedBytes, 11596411699);
});
