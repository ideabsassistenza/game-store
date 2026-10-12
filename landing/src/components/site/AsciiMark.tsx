"use client";

import {useEffect, useRef} from "react";
import {NEEDLE, RING} from "./Mark";

const RAMP = " .:-=+*#%@";
const NOISE = "!<>-_\\/[]{}=+*^?#01";
const SUPERSAMPLE = 4;
// The ring opens between -20° and -70° (svg angles, y down) and sweeps 310° clockwise round its centre.
const START = -20;
const SWEEP = 310;
const SETTLE_MS = 1400;
// After it settles the dial keeps running: a brighter band laps the ring every few seconds, the way the
// needle sweeps, and a few cells flicker. Twelve frames a second is enough for characters.
const LAP_MS = 4200;
const FRAME_MS = 1000 / 12;
const FLICKER = 0.004;

type Cell = {char: string; at: number; level: number};

function progress(x: number, y: number) {
  const angle = (Math.atan2(y - 16, x - 16) * 180) / Math.PI;
  return (((angle - START) % 360) + 360) % 360 / SWEEP;
}

/** Where the mark sits in the field, in px: large and off to the right, cropped by the edge on phones. */
function placement(width: number, height: number) {
  if (width < 768) return {size: width * 1.15, x: width * 0.7, y: height * 0.42};
  const size = Math.min(height * 0.92, width * 0.5);
  return {size, x: Math.min(width - size * 0.5, width / 2 + 600 - size * 0.5), y: height * 0.52};
}

/** The mark rasterised into the character grid: red is the ring, green the needle, blue the dial's ticks. */
function rasterise(cols: number, rows: number, cell: {width: number; height: number}, box: ReturnType<typeof placement>) {
  const canvas = document.createElement("canvas");
  canvas.width = cols * SUPERSAMPLE;
  canvas.height = rows * SUPERSAMPLE;
  const ctx = canvas.getContext("2d", {willReadFrequently: true})!;
  const unit = box.size / 32;
  ctx.setTransform(SUPERSAMPLE / cell.width, 0, 0, SUPERSAMPLE / cell.height, 0, 0);
  ctx.translate(box.x - box.size / 2, box.y - box.size / 2);
  ctx.scale(unit, unit);
  ctx.globalCompositeOperation = "lighter";
  ctx.lineWidth = 4.5;
  ctx.strokeStyle = "#f00";
  ctx.stroke(new Path2D(RING));
  ctx.fillStyle = "#0f0";
  ctx.fill(new Path2D(NEEDLE));
  ctx.strokeStyle = "#00f";
  ctx.lineWidth = 0.35;
  for (let step = 0; step <= SWEEP; step += 10) {
    const angle = ((START + step) * Math.PI) / 180;
    const [inner, outer] = step % 50 === 0 ? [14.2, 15.6] : [14.4, 15];
    ctx.beginPath();
    ctx.moveTo(16 + Math.cos(angle) * inner, 16 + Math.sin(angle) * inner);
    ctx.lineTo(16 + Math.cos(angle) * outer, 16 + Math.sin(angle) * outer);
    ctx.stroke();
  }

  const {data} = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const cells: Cell[] = [];
  const area = SUPERSAMPLE * SUPERSAMPLE * 255;
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      let ring = 0, needle = 0, ticks = 0;
      for (let sy = 0; sy < SUPERSAMPLE; sy++) {
        for (let sx = 0; sx < SUPERSAMPLE; sx++) {
          const i = ((row * SUPERSAMPLE + sy) * canvas.width + col * SUPERSAMPLE + sx) * 4;
          ring += data[i];
          needle += data[i + 1];
          ticks += data[i + 2];
        }
      }
      const x = ((col + 0.5) * cell.width - box.x + box.size / 2) / unit;
      const y = ((row + 0.5) * cell.height - box.y + box.size / 2) / unit;
      const t = Math.min(progress(x, y), 1);
      const value = Math.max((ring / area) * (0.3 + 0.7 * t), needle / area, Math.min(ticks / area, 0.35));
      const level = Math.round(value * (RAMP.length - 1));
      cells.push({char: RAMP[level], at: needle > 0 ? 1 : t, level: needle > 0 || ring === 0 ? -1 : level});
    }
  }
  return cells;
}

/** The ring's cells brightened by a band at `phase` (0–1 along the sweep), a few swapped for noise. */
function lap(cells: Cell[], index: number, phase: number) {
  const c = cells[index];
  if (c.char === " ") return c.char;
  if (Math.random() < FLICKER) return NOISE[(Math.random() * NOISE.length) | 0];
  if (c.level < 0) return c.char;
  const distance = Math.abs(c.at - phase);
  const boost = Math.round(4 * Math.exp(-(Math.min(distance, 1 - distance) ** 2) / 0.004));
  return RAMP[Math.min(c.level + boost, RAMP.length - 1)];
}

/**
 * Overdrive's mark as a field of characters, sampled from the logo's own paths. On load the dial
 * fills the way a needle rises: characters scramble and settle along the ring towards the limit; then
 * a band of light keeps lapping the ring while the hero is on screen.
 */
export function AsciiMark({className = ""}: {className?: string}) {
  const field = useRef<HTMLPreElement>(null);

  useEffect(() => {
    const pre = field.current!;
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let frame = 0;
    let played = false;
    let visible = true;
    let run: () => void = () => {};

    const draw = () => {
      cancelAnimationFrame(frame);
      const {width, height} = pre.getBoundingClientRect();
      const style = getComputedStyle(pre);
      const measure = document.createElement("canvas").getContext("2d")!;
      measure.font = `${style.fontSize} ${style.fontFamily}`;
      const cell = {width: measure.measureText("M").width, height: parseFloat(style.lineHeight)};
      const cols = Math.ceil(width / cell.width);
      const rows = Math.ceil(height / cell.height);
      // Right to left, the copy sits on the right, so the mark moves to the left.
      const box = placement(width, height);
      if (document.documentElement.dir === "rtl") box.x = width - box.x;
      const cells = rasterise(cols, rows, cell, box);
      const text = (pick: (cell: Cell, index: number) => string) =>
        Array.from({length: rows}, (_, row) => cells.slice(row * cols, (row + 1) * cols).map((c, i) => pick(c, row * cols + i)).join("")).join("\n");

      pre.textContent = text(c => c.char);
      if (still) return;
      let last = 0;
      const loop = (now: number) => {
        if (!visible) return;
        if (now - last >= FRAME_MS) {
          last = now;
          const phase = (now % LAP_MS) / LAP_MS;
          pre.textContent = text((_, i) => lap(cells, i, phase));
        }
        frame = requestAnimationFrame(loop);
      };
      run = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(loop); };
      if (played) return run();
      played = true;
      const jitter = cells.map(() => Math.random() * 260);
      const begin = performance.now();
      const tick = (now: number) => {
        const elapsed = now - begin;
        pre.textContent = text((c, i) => {
          if (c.char === " " || elapsed >= c.at * SETTLE_MS + jitter[i]) return c.char;
          return elapsed < c.at * SETTLE_MS * 0.6 ? " " : NOISE[(Math.random() * NOISE.length) | 0];
        });
        frame = requestAnimationFrame(elapsed < SETTLE_MS + 300 ? tick : loop);
      };
      frame = requestAnimationFrame(tick);
    };

    let size = "";
    const observer = new ResizeObserver(([entry]) => {
      const next = `${Math.round(entry.contentRect.width)}x${Math.round(entry.contentRect.height)}`;
      if (next === size) return;
      size = next;
      draw();
    });
    observer.observe(pre);
    const onScreen = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible && played) run();
    });
    onScreen.observe(pre);
    return () => { observer.disconnect(); onScreen.disconnect(); cancelAnimationFrame(frame); };
  }, []);

  return (
    <pre ref={field} aria-hidden dir="ltr"
      className={`pointer-events-none m-0 overflow-hidden font-mono text-[9px] leading-[11px] whitespace-pre text-white select-none md:text-[12px] md:leading-[14px] ${className}`} />
  );
}
