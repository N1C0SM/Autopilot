import sharp from "sharp";
import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const ROOT = "/Users/Nicolas/Documents/Autopilot-source";

// Volt mark — path re-centered on (0,0), scales cleanly from viewBox 100 to any size.
// Fill ratio within the icon canvas ~ 56%, matching Apple's SF-Symbol app-icon
// optical sizing for a single-glyph mark.
const svgIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  <rect width="1024" height="1024" fill="#090909"/>
  <g transform="translate(512 512) scale(7.5)">
    <path d="M8 -38 L-25 4 L-4 4 L-10 38 L25 -6 L5 -6 L12 -38 Z" fill="#D4A648"/>
  </g>
</svg>`;

const svgSplash = `<svg xmlns="http://www.w3.org/2000/svg" width="2732" height="2732" viewBox="0 0 2732 2732">
  <rect width="2732" height="2732" fill="#090909"/>
  <g transform="translate(1366 1366) scale(8.5)">
    <path d="M8 -38 L-25 4 L-4 4 L-10 38 L25 -6 L5 -6 L12 -38 Z" fill="#D4A648"/>
  </g>
</svg>`;

async function render(svg, outPath, size) {
  await sharp(Buffer.from(svg)).resize(size, size).png({ compressionLevel: 9 }).toFile(outPath);
  console.log("Wrote", outPath);
}

await render(svgIcon, resolve(ROOT, "resources/icon.png"), 1024);
await render(svgIcon, resolve(ROOT, "resources/icon-foreground.png"), 1024); // Android adaptive foreground
await render(svgIcon, resolve(ROOT, "resources/icon-background.png"), 1024); // dark bg flat
await render(svgSplash, resolve(ROOT, "resources/splash.png"), 2732);
await render(svgSplash, resolve(ROOT, "resources/splash-dark.png"), 2732);
