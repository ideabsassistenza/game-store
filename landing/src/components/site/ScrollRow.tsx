"use client";

import {type ReactNode, useCallback, useEffect, useRef, useState} from "react";

// Content is gone by the chevron's edge, so a chip never shows through behind it.
const FADE = ["5rem", "2rem"];

function Chevron({side, onClick}: {side: "left" | "right"; onClick: () => void}) {
  return (
    // A pointer affordance only: keys and touch reach every chip by focus and swipe, and ArrowNav must not land here.
    <div onClick={onClick} aria-hidden
      className={`absolute inset-y-0 z-10 hidden w-10 cursor-pointer items-center text-muted transition-colors hover:text-fg pointer-fine:flex ${
        side === "left" ? "left-0 justify-start" : "right-0 justify-end"}`}>
      <span className="grid size-7 place-items-center rounded-full bg-surface-2">
        <svg viewBox="0 0 24 24" className={`size-4 fill-none stroke-current ${side === "left" ? "rotate-180" : ""}`} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="m9 6 6 6-6 6" />
        </svg>
      </span>
    </div>
  );
}

/**
 * A row of chips that scrolls sideways instead of wrapping. Its edges fade only where more chips wait,
 * and a mouse, which cannot swipe, gets a chevron there to page along.
 */
export function ScrollRow({className = "", children, ...props}: {className?: string; children: ReactNode; role?: string; "aria-label"?: string}) {
  const row = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const [more, setMore] = useState({left: false, right: false});

  const measure = useCallback(() => {
    const node = row.current!;
    // Right to left, scrollLeft runs from minus the overflow up to 0: count from the left edge either way.
    const overflow = node.scrollWidth - node.clientWidth;
    const fromLeft = getComputedStyle(node).direction === "rtl" ? overflow + node.scrollLeft : node.scrollLeft;
    const left = fromLeft > 1, right = fromLeft < overflow - 1;
    setMore(current => current.left === left && current.right === right ? current : {left, right});
  }, []);

  useEffect(() => {
    const observer = new ResizeObserver(measure);
    observer.observe(row.current!);
    observer.observe(content.current!);
    return () => observer.disconnect();
  }, [measure]);

  const page = (direction: number) => row.current!.scrollBy({left: direction * row.current!.clientWidth * 0.75, behavior: "smooth"});
  const edge = (side: boolean) => side ? FADE : ["0px", "0px"];
  const [left, right] = [edge(more.left), edge(more.right)];
  const mask = `linear-gradient(to right, transparent ${left[1]}, #000 ${left[0]}, #000 calc(100% - ${right[0]}), transparent calc(100% - ${right[1]}))`;

  return (
    <div className="relative min-w-0">
      <div ref={row} onScroll={measure} {...props} style={{maskImage: mask, WebkitMaskImage: mask}}
        className={`overflow-x-auto overscroll-x-contain [scrollbar-width:none] ${className}`}>
        <div ref={content} className="flex w-max items-center gap-2">{children}</div>
      </div>
      {more.left && <Chevron side="left" onClick={() => page(-1)} />}
      {more.right && <Chevron side="right" onClick={() => page(1)} />}
    </div>
  );
}
