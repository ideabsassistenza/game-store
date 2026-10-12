// Copyright (C) 2026 half144 and PS5 React contributors
// SPDX-License-Identifier: GPL-3.0-or-later
// Additional attribution term: see LICENSE-ATTRIBUTION.
import assert from 'node:assert/strict';
import test from 'node:test';
import {BrowserRequired, createSourceResolver, sourceKind, webURL} from './download-sources.js';
const reply = (url, html, headers = {'content-type': 'text/html'}) => ({url, status: 200, ok: true, headers, text: async () => html});

test('provider classification does not match lookalike domains or execute non-HTTP URLs', () => {
  assert.equal(sourceKind({url: 'https://mediafire.com/file/id/name'}), 'mediafire');
  assert.equal(sourceKind({url: 'https://download1.mediafire.com/file'}), 'direct');
  assert.equal(sourceKind({url: 'https://vikingfile.com/d/id/file'}), 'direct');
  assert.equal(sourceKind({url: 'https://vikingfile.com.evil.test/f/id'}), 'direct');
  assert.equal(sourceKind({url: 'https://host.example/f/id', source: 'pegasus-0'}), 'browser');
  // AkiraBox left the catalog: a download saved from an earlier version opens in the browser.
  assert.equal(sourceKind({url: 'https://akirabox.to/id/file', requiresBrowser: true, source: 'pegasus-0'}), 'browser');
  for (const url of ['file:///etc/passwd', 'https://user:secret@example.com/a', 'https://example.com/\nfoo', 'https://example.com/\\foo'])
    assert.throws(() => webURL(url));
});

test('MediaFire and Viking parse only their designated download anchor, preserving URL case/query', async () => {
  for (const [url, id] of [['https://mediafire.com/file/x', 'downloadButton'], ['https://vikingfile.com/f/x', 'download-link']]) {
    const calls = [];
    const resolver = createSourceResolver({http: {request: async (url, options) => {
      calls.push({url, options});
      return options.method === 'HEAD' ? reply(url, '', {'content-type': 'application/octet-stream'}) :
        reply(url, `<a data-id="${id}" href="https://ads.example/bad">Download</a><a href="https://files.example/Case?key=A&amp;id=B" id="${id}">Download</a>`);
    }}});
    assert.equal((await resolver.resolve({url})).url, 'https://files.example/Case?key=A&id=B');
    assert.equal(calls[1].options.method, 'HEAD');
  }
});

test('Buzzheavier reads HX-Redirect and never forwards HX headers to the download host', async () => {
  const calls = [];
  const resolver = createSourceResolver({http: {request: async (url, options) => {
    calls.push({url, options});
    if (url.endsWith('/download')) return reply(url, '', {'hx-redirect': 'https://files.example/file'});
    if (options.method === 'HEAD') return reply(url, '', {});
    return reply(url, '<a hx-get="/abc/download">Download</a>');
  }}});
  assert.equal((await resolver.resolve({url: 'https://buzzheavier.com/abc'})).url, 'https://files.example/file');
  assert.equal(calls[1].options.followRedirects, false);
  assert.equal(calls[1].options.headers['HX-Request'], 'true');
  assert.equal(calls[2].options.headers, undefined);
});

test('challenge pages and HTML final URLs require browser verification; dead links stay unavailable', async () => {
  const resolver = createSourceResolver({http: {request: async url => reply(url, '<html>Verify</html>')}});
  await assert.rejects(resolver.resolve({url: 'https://mediafire.com/file/x'}), BrowserRequired);
  await assert.rejects(resolver.resolve({url: 'https://example.com'}, {directURL: 'https://example.com/page'}), BrowserRequired);
  const dead = createSourceResolver({http: {request: async () => ({status: 410, ok: false})}});
  await assert.rejects(dead.resolve({url: 'https://mediafire.com/file/x'}), /unavailable: HTTP 410/);
});

