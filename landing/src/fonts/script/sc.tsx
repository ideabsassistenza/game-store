"use client";

import {Noto_Sans_SC} from "next/font/google";

const font = Noto_Sans_SC({display: "swap", preload: false});

export default function Font() {
  return <style>{`:root{--font-script:${font.style.fontFamily}}`}</style>;
}
