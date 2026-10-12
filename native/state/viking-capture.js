// Copyright (C) 2026 half144 and PS5 React contributors
// SPDX-License-Identifier: GPL-3.0-or-later
// Additional attribution term: see LICENSE-ATTRIBUTION.
import {sourceKind, webURL} from './download-sources.js';
export const VIKING_PREFIX = 'https://vikingfile.com/d/';
// Vikingfile moved its pages to vik1ngfile.site; the capture payload accepts its download links too.
const VIKING_PREFIXES = [VIKING_PREFIX, 'https://vik1ngfile.site/d/'];
const vikingPath = url => {
  const prefix = VIKING_PREFIXES.find(item => url.startsWith(item));
  return prefix ? url.slice(prefix.length) : '';
};
function entity(text) {
  return text.replace(/&(?:amp|quot|apos|lt|gt|#39|#(\d+)|#x([a-f0-9]+));/gi, (all, decimal, hex) => {
    if (decimal || hex) {
      const code = parseInt(decimal || hex, decimal ? 10 : 16);
      return code <= 0x10ffff ? String.fromCodePoint(code) : all;
    }
    return {'&amp;': '&', '&quot;': '"', '&apos;': "'", '&#39;': "'", '&lt;': '<', '&gt;': '>'}[all.toLowerCase()] ?? all;
  });
}
function element(html, id) {
  const pattern = new RegExp(`<([a-z][a-z0-9]*)\\b[^>]*\\bid=["']${id}["'][^>]*>([\\s\\S]*?)<\\/\\1\\s*>`, 'i');
  return entity(pattern.exec(html)?.[2].replace(/<[^>]*>/g, '').trim() || '');
}
// Same native budget as Orbit: 160 UTF-8 bytes, enough for 480 percent-encoded bytes.
const usableFilename = filename => Boolean(filename) && encodeURIComponent(filename).replace(/%[a-f0-9]{2}|./gi, 'x').length <= 160 &&
  !/[\/\\\x00-\x1f\x7f]/.test(filename) && !filename.includes('..');
export function vikingMetadata(html, expectedBytes) {
  const filename = element(html, 'filename');
  if (!usableFilename(filename))
    throw new Error('Vikingfile did not expose a usable filename. Enter the final file link.');
  const size = /^(\d+(?:\.\d+)?)\s*(B|KB|MB|GB|TB|KiB|MiB|GiB|TiB)$/i.exec(element(html, 'size'));
  if (!size && !expectedBytes) throw new Error('Vikingfile did not expose a file size. Enter the final file link.');
  // Catalog sizes are often rounded or the unpacked game's, so the page's own size wins when it shows one.
  return {filename, expectedBytes: size ? null : expectedBytes || null, displaySize: size ? {value: Number(size[1]),
    precision: (size[1].split('.')[1] || '').length, unit: size[2].toUpperCase()} : null};
}
export function matchingVikingURL(url, filename) {
  try {
    webURL(url);
    const path = vikingPath(url);
    return /^[a-z0-9]{10}\/[^/?#]+$/i.test(path) && decodeURIComponent(path.slice(11)) === filename;
  } catch { return false; }
}
// Catalog sizes behind link pages are rounded to whole GiB.
const CATALOG_SLACK = 2 ** 30;
function matchingSize(bytes, metadata) {
  if (metadata.expectedBytes) return bytes === metadata.expectedBytes;
  if (!metadata.displaySize) return !metadata.catalogBytes || Math.abs(bytes - metadata.catalogBytes) <= CATALOG_SLACK;
  const {value, precision, unit} = metadata.displaySize;
  const power = {B: 0, KB: 1, KIB: 1, MB: 2, MIB: 2, GB: 3, GIB: 3, TB: 4, TIB: 4}[unit];
  // Providers label binary and decimal values alike as GB. Preserve the printed rounding interval.
  return (unit.includes('I') ? [1024] : [1000, 1024]).some(base =>
    Math.abs(bytes / base ** power - value) <= 0.5 * 10 ** -precision);
}
function transferURL(url) {
  const parsed = webURL(url);
  if (!url.startsWith('https://') || parsed.origin !== `https://${parsed.host}` || parsed.path.includes('#') ||
      !(['vikingfile.com', 'ar.vikingfile.com', 'vik1ngfile.site'].includes(parsed.host) ||
        parsed.host.endsWith('.s3.bhs.io.cloud.ovh.net') || parsed.host.endsWith('.r2.cloudflarestorage.com')))
    throw new Error('Captured file redirected to an unsupported download host.');
  return url;
}
async function rangeProbe(http, url, signal) {
  for (let redirects = 0; redirects <= 5; redirects++) {
    // Native Http intentionally disables automatic redirects with custom headers. Reapply only
    // this public Range header after checking each destination against Orbit's provider hosts.
    const response = await http.request(transferURL(url), {method: 'GET', headers: {Range: 'bytes=0-0'},
      signal, maxBytes: 8192, followRedirects: false});
    if (![301, 302, 303, 307, 308].includes(response.status)) return response;
    const location = response.headers?.location;
    if (!location || redirects === 5) throw new Error('Captured file exceeded its redirect limit.');
    url = location.startsWith('/') && !location.startsWith('//') ? webURL(url).origin + location : location;
  }
}
export async function validateVikingCapture(http, url, metadata, signal) {
  if (!matchingVikingURL(url, metadata.filename)) throw new Error('Captured link does not match the selected file.');
  const response = await rangeProbe(http, url, signal);
  const range = /^bytes 0-0\/(\d+)$/i.exec(response.headers?.['content-range'] || '');
  const bytes = Number(range?.[1]);
  if (!response.ok || response.status !== 206 || Number(response.headers?.['content-length']) !== 1 ||
      /html|json|xml|text\//i.test(response.headers?.['content-type'] || '') ||
      (await response.text()).length !== 1 || !Number.isSafeInteger(bytes) || bytes <= 0 || !matchingSize(bytes, metadata))
    throw new Error('Captured file failed validation or expired. Reopen the page and retry.');
  const disposition = response.headers?.['content-disposition'];
  if (disposition) {
    const encoded = /filename\*=UTF-8''([^;]+)/i.exec(disposition)?.[1];
    const plain = /filename=(?:"([^"]+)"|([^;]+))/i.exec(disposition);
    const filename = encoded ? decodeURIComponent(encoded) : plain?.[1] || plain?.[2]?.trim();
    if (filename && filename !== metadata.filename) throw new Error('Captured response names a different file.');
  }
  const etag = response.headers?.etag;
  if (!/^"[^"\x00-\x20\x7f]*"$/.test(etag || '') && !Number.isFinite(Date.parse(response.headers?.['last-modified'] || '')))
    throw new Error('Captured file has no stable identity. Reopen the page and retry.');
  return {url, expectedBytes: bytes};
}
export async function describeVikingCapture(http, release, signal) {
  const url = release.browserUrl || release.url;
  const page = webURL(url);
  if (!['vikingfile.com', 'vik1ngfile.site'].includes(page.host) || !/^\/f\/[a-z0-9]{10}$/i.test(page.path))
    throw new Error('Unsupported Vikingfile page. Enter the final file link.');
  const response = await http.request(url, {signal, maxBytes: 1024 * 1024});
  if (!response.ok) throw new Error(`Vikingfile metadata HTTP ${response.status}. Enter the final file link.`);
  return vikingMetadata(await response.text(), release.sizeBytes);
}
/** A link page (link-vault, filecrypt...) whose release says it leads to VikingFile. */
export function vikingLinkPage(release) {
  const url = release.browserUrl || release.url || '';
  return sourceKind(release) === 'browser' && /viki/i.test(`${release.label || ''} ${url.includes('#') ? url.slice(url.indexOf('#')) : ''}`);
}
export function linkPageMetadata(release) {
  return {filename: '', part: Number(/\bpart\s*(\d+)\b/i.exec(release.label || release.volume || '')?.[1]) || null,
    expectedBytes: null, displaySize: null, catalogBytes: release.sizeBytes || null};
}
/** A link page names no file up front, so the captured `/d/<id>/<filename>` does, as long as it is the release's part. */
export function capturedVikingFile(url, metadata) {
  const path = vikingPath(url);
  let filename = '';
  try { if (/^[a-z0-9]{10}\/[^/?#]+$/i.test(path)) filename = decodeURIComponent(path.slice(11)); } catch {}
  if (!usableFilename(filename)) throw new Error('Captured link does not name a usable file.');
  if (metadata.part && !new RegExp(`part[\\s._-]*0*${metadata.part}(?!\\d)`, 'i').test(filename))
    throw new Error(`Captured file is not part ${metadata.part}. Reopen the page and download that part.`);
  return {...metadata, filename};
}
