import type {ComponentProps} from "react";

/** The app's pill: white for the one action that matters, dark for the rest. */
export function Pill({light = false, className = "", ...props}: ComponentProps<"a"> & {light?: boolean}) {
  return (
    <a
      {...props}
      className={`inline-flex h-12 items-center rounded-full px-7 text-[15px] font-medium tracking-[-0.01em] transition-colors ${
        light ? "bg-fg text-canvas hover:bg-white" : "bg-surface text-fg hover:bg-surface-2"
      } ${className}`}
    />
  );
}
