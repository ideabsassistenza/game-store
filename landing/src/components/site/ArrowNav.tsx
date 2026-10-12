"use client";

import {useEffect} from "react";

const FOCUSABLE = "a[href], button:not([disabled]), input, [tabindex=\"0\"]";
const DIRECTIONS: Record<string, [number, number]> = {ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0]};

// The nearest focusable element whose centre lies in the pressed direction, weighting distance across
// the direction three times, as the console's focus engine does, so a row is preferred to a diagonal.
function nearest(from: Element, [dx, dy]: [number, number]) {
  const a = from.getBoundingClientRect();
  const ax = a.left + a.width / 2, ay = a.top + a.height / 2;
  let best: HTMLElement | null = null, score = Infinity;
  for (const node of document.querySelectorAll<HTMLElement>(FOCUSABLE)) {
    if (node === from || !node.offsetParent) continue;
    const b = node.getBoundingClientRect();
    const along = (b.left + b.width / 2 - ax) * dx + (b.top + b.height / 2 - ay) * dy;
    if (along <= 1) continue;
    const across = Math.abs((b.left + b.width / 2 - ax) * dy) + Math.abs((b.top + b.height / 2 - ay) * dx);
    if (along + across * 3 < score) { score = along + across * 3; best = node; }
  }
  return best;
}

/**
 * Arrow keys move focus like a D-pad and Enter presses, so the page can be walked the way the app is.
 * A search field keeps Left and Right for its caret. The stage under the hero carries the legend.
 */
export function ArrowNav() {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const direction = DIRECTIONS[event.key];
      if (!direction || event.altKey || event.metaKey || event.ctrlKey) return;
      const current = document.activeElement;
      if (current instanceof HTMLInputElement && direction[0] !== 0) return;
      const next = current && current !== document.body ? nearest(current, direction) : document.querySelector<HTMLElement>(FOCUSABLE);
      if (!next) return;
      event.preventDefault();
      next.focus({preventScroll: true});
      next.scrollIntoView({block: "nearest", behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth"});
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return null;
}
