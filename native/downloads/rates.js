// Copyright (C) 2026 half144 and PS5 React contributors
// SPDX-License-Identifier: GPL-3.0-or-later
// Additional attribution term: see LICENSE-ATTRIBUTION.

// A job's bytesPerSecond is what the native task wrote in its last 250 ms. Writes land in batches of up
// to 2 MiB, and none land while the disk syncs or a cut range restarts, so a healthy download reads 0
// for a tick now and then: neither "idle" nor a once-a-second sample may rest on a single tick.

// Peak and low come from one-second averages, skipping the first seconds while connections open:
// raw 250 ms readings swing far wider than the download actually does.
const WINDOW_MS = 1000;
const WARMUP_MS = 3000;

/**
 * Turns queue snapshots into the combined speed, bytes left and connections of the downloads in flight,
 * with the highest, lowest and mean speed since downloading last started.
 */
export function createActivity() {
  let started = 0, recent = [], peak = 0, low = 0, total = 0, count = 0;
  return (jobs, now) => {
    // A paused or failed job keeps its last speed; only jobs still downloading count. A set connects
    // again for each volume, which is no pause in its download.
    const moving = jobs.filter(job => job.state === 'downloading' || job.state === 'connecting');
    const sum = pick => moving.reduce((sum, job) => sum + pick(job), 0);
    let speed = 0;
    if (!moving.length) { started = 0; recent = []; peak = 0; low = 0; total = 0; count = 0; }
    else {
      started ||= now;
      recent = [...recent.filter(sample => now - sample.at < WINDOW_MS), {at: now, speed: sum(job => job.bytesPerSecond || 0)}];
      speed = recent.reduce((sum, sample) => sum + sample.speed, 0) / recent.length;
      if (now - started >= WARMUP_MS && speed) {
        peak = Math.max(peak, speed);
        low = low ? Math.min(low, speed) : speed;
        total += speed; count += 1;
      }
    }
    return {active: moving.length, speed, connections: sum(job => job.connections || 0),
      left: sum(job => Math.max(0, (job.total || 0) - job.written)), peak, low, mean: count ? total / count : 0};
  };
}

/**
 * Turns one job's snapshots into a sample a second of its network and disk speed (bytes/s), or null
 * between samples and when the counts start afresh.
 */
export function createThroughput() {
  let last = null;
  return (job, now) => {
    if (last && now - last.at < 1000) return null;
    // A job without a network count arrives as it writes. A set's received bytes count only the
    // volume in flight while its written bytes count every volume, so a 0 there is a volume starting.
    const received = job.received ?? job.written ?? 0, written = job.written || 0;
    // A task starts its count at 0 and its first report jumps to every byte a resumed download
    // already had: that jump, or a count going back for a new task or a cut range, is a new baseline.
    const baseline = !last || !last.received || received < last.received || written < last.written;
    const previous = last;
    last = {at: now, received, written};
    if (baseline) return null;
    const elapsed = now - previous.at;
    return {network: (received - previous.received) * 1000 / elapsed, disk: (written - previous.written) * 1000 / elapsed};
  };
}
