// Generates the PWA icons in public/icons. Run: node scripts/make-icons.mjs
// Motif: six flatmates as dots, five home (solid) and one away (outlined).
import fs from "node:fs";
import path from "node:path";
import React from "react";
import { ImageResponse } from "next/og.js";

const h = React.createElement;
const out = path.resolve(import.meta.dirname, "../public/icons");

function icon(size, { padded = false } = {}) {
  const inner = padded ? size * 0.6 : size * 0.72;
  const dot = inner / 3.6;
  const gap = (inner - dot * 3) / 2;
  const dots = Array.from({ length: 6 }, (_, i) =>
    h("div", {
      key: i,
      style: {
        width: dot,
        height: dot,
        borderRadius: dot,
        background: i === 5 ? "transparent" : "#FFFFFF",
        border: i === 5 ? `${Math.max(2, dot * 0.12)}px dashed #DCEDEA` : "none",
      },
    }),
  );
  return new ImageResponse(
    h(
      "div",
      {
        style: {
          width: size,
          height: size,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0F6E64",
        },
      },
      h(
        "div",
        { style: { width: inner, display: "flex", flexWrap: "wrap", gap, justifyContent: "center", rowGap: gap * 2 } },
        ...dots,
      ),
    ),
    { width: size, height: size },
  );
}

const files = [
  ["icon-192.png", icon(192)],
  ["icon-512.png", icon(512)],
  ["maskable-512.png", icon(512, { padded: true })],
  ["apple-touch-icon.png", icon(180)],
];
fs.mkdirSync(out, { recursive: true });
for (const [name, res] of files) {
  fs.writeFileSync(path.join(out, name), Buffer.from(await res.arrayBuffer()));
  console.log("wrote", name);
}
