import sharp from "sharp";
import { resolve } from "node:path";

const ROOT = "/Users/Nicolas/Documents/Autopilot-source";

// Volta mark — stroked "A" chevron + inner lightning bolt. Composed from two
// paths in a single viewBox 0..100 (A is the silhouette that survives at small
// sizes; the bolt inside carries the "automático / energía" story at ≥ 28 px).
const MARK_A = `<path d="M14 86 L50 14 L86 86" stroke="currentColor" stroke-width="11" stroke-linecap="round" stroke-linejoin="round" fill="none"/>`;
const MARK_BOLT = `<path d="M56 46 L36 66 L48 66 L44 86 L62 60 L50 60 L55 46 Z" fill="currentColor"/>`;

function wrapIcon(size, scale) {
  const half = size / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" fill="#090909"/>
  <g transform="translate(${half - scale * 50} ${half - scale * 50}) scale(${scale})" color="#D4A648">
    ${MARK_A}
    ${MARK_BOLT}
  </g>
</svg>`;
}

const svgIcon = wrapIcon(1024, 6.4);
const svgSplash = wrapIcon(2732, 8.0);

async function render(svg, outPath, size) {
  await sharp(Buffer.from(svg)).resize(size, size).png({ compressionLevel: 9 }).toFile(outPath);
  console.log("Wrote", outPath);
}

await render(svgIcon, resolve(ROOT, "resources/icon.png"), 1024);
await render(svgIcon, resolve(ROOT, "resources/icon-foreground.png"), 1024);
await render(svgIcon, resolve(ROOT, "resources/icon-background.png"), 1024);
await render(svgSplash, resolve(ROOT, "resources/splash.png"), 2732);
await render(svgSplash, resolve(ROOT, "resources/splash-dark.png"), 2732);
