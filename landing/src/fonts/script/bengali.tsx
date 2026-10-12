"use client";

import {Noto_Sans_Bengali} from "next/font/google";

const font = Noto_Sans_Bengali({display: "swap", preload: false});

export default function Font() {
  return <style>{`:root{--font-script:${font.style.fontFamily}}`}</style>;
}
