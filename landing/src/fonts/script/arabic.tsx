"use client";

import {Noto_Sans_Arabic} from "next/font/google";

const font = Noto_Sans_Arabic({display: "swap", preload: false});

export default function Font() {
  return <style>{`:root{--font-script:${font.style.fontFamily}}`}</style>;
}
