// Copyright (C) 2026 half144 and PS5 React contributors
// SPDX-License-Identifier: GPL-3.0-or-later
// Additional attribution term: see LICENSE-ATTRIBUTION.
import '../i18n/testing.mjs';
import assert from 'node:assert/strict';
import test from 'node:test';
import {explainError} from './errors.js';

test('native and queue errors read as a cause and a next action', () => {
  const title = message => explainError(message).title;
  assert.equal(title('Interrupted. Resume to continue.'), 'Stopped when the app closed');
  assert.equal(title('Not enough space on the selected drive. Free space and retry.'), 'Not enough free space');
  assert.deepEqual(explainError('Not enough space on /data: needs 42.1 GB, 30 GB free'),
    {title: 'Not enough space on /data: needs 42.1 GB, 30 GB free', action: 'Free space, or choose another drive under Save to.'});
  assert.equal(title('storage disconnected or changed; reconnect the original drive before resuming'), 'Drive disconnected');
  assert.equal(title('range probe failed (HTTP 404, HTTP response code said error)'), 'Download link no longer works');
  assert.equal(title('Manifest HTTP 503. Choose another source or retry.'), 'Server is busy');
  assert.equal(title("Couldn't resolve host name"), 'No connection to the server');
  assert.equal(title('Timeout was reached'), 'No connection to the server');
  assert.equal(title('SHA-256 mismatch'), 'The file arrived damaged');
  assert.equal(title('This source requires browser verification'), 'This source needs a web browser');
  assert.equal(title("the server's file changed since this partial download; restart from zero"), 'The file changed on the server');
  assert.equal(title('This archive needs more memory to extract than the console app can use.'), 'This archive can\'t be extracted on the console');
  assert.deepEqual(explainError('Not enough memory to extract.'),
    {title: 'Not enough memory to extract', action: 'Close and reopen Overdrive, then Retry.'});
  assert.deepEqual(explainError('write partial file: No space left on device'),
    {title: 'Not enough free space', action: 'Free space on the drive, then Resume.'});
  assert.deepEqual(explainError('Something new'), {title: 'Something new', action: 'Retry, or pick another source.'});
});

test('a native error is read by its cause, not by the game in its file name', () => {
  assert.deepEqual(explainError("Downloads.enqueue /data/homebrew/PPSA03845 Dead Space.ffpfsc: range probe failed (HTTP 0, Couldn't resolve host name)"),
    {title: 'No connection to the server', action: "Check the console's internet connection, then Retry."});
  assert.equal(explainError('Downloads.enqueue /data/homebrew/PPSA20397 AC Shadows.ffpfsc: Something new').title, 'Something new');
  assert.equal(explainError('fs.mkdir /mnt/usb0/downloads/Driveclub: No space left on device').action, 'Free space on the drive, then Resume.');
});

test('the downloads holding the space are named on the action line, which has room for them', () => {
  assert.deepEqual(explainError('Not enough space on /data: needs 77 GB, 59 GB free after queued downloads: Game 40 (40 GB), Game 20 (20 GB), +1'),
    {title: 'Not enough space on /data: needs 77 GB, 59 GB free after queued downloads',
      action: 'Free space, or choose another drive under Save to. Game 40 (40 GB), Game 20 (20 GB), +1'});
});

test('ShadowMount\'s errors read as they are, without a hint about the download link', () => {
  for (const message of ['ShadowMount HTTP 404: not found.', 'ShadowMount did not uninstall it, so its files were kept: ShadowMount HTTP 409: Device busy.',
    'Deleted from disk, but ShadowMount did not uninstall it: ShadowMount HTTP 500.'])
    assert.deepEqual(explainError(message), {title: message, action: ''});
});

test('archive failures say which part to download again, or what else went wrong', () => {
  const part = explainError('Archives.extract /data/x: Incomplete RAR archive or missing volume. Volume 6 of 12 looks incomplete.');
  assert.deepEqual(part, {title: 'Part 6 looks incomplete', action: 'Retry to download that part again.'});
  assert.equal(explainError('Archives.extract /data/x: Incorrect RAR archive password.').title, "The archive's password doesn't work");
  for (const message of ['Incomplete RAR archive or missing volume.', 'Missing first RAR volume.'])
    assert.deepEqual(explainError(`Archives.extract /data/x: ${message}`, true), {title: 'This source is missing parts', action: 'Cancel it and pick another source.'});
  // A lone archive the worker could not open is downloaded again.
  assert.deepEqual(explainError('Archives.extract /data/x: Incomplete RAR archive or missing volume.'),
    {title: 'The file arrived damaged', action: 'Restart it from zero.'});
  assert.equal(explainError('Archives.extract /data/x: Cannot read the RAR archive; it may be truncated.').title, 'The file arrived damaged');
});
