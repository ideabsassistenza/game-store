"use client";

import {Noto_Sans_Devanagari} from "next/font/google";

const font = Noto_Sans_Devanagari({display: "swap", preload: false});

export default function Font() {
  return <style>{`:root{--font-script:${font.style.fontFamily}}`}</style>;
}
