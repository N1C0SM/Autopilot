// Iconos de Autopilot desde la geometría única de la marca (`BRAND_A` y `BRAND_BOLT` de
// src/shared/components/ui/brand-mark.tsx): la «A» dorada con el rayo, plana, sobre el
// mismo negro y el mismo dorado que la app (.claude/design/marca.md). Sin brillos ni degradados.
//
//   node scripts/gen-icon.mjs
//
// Escribe el icono del iPhone y del Mac (native/…/AppIcon.appiconset), los de la web y la
// PWA (public/) y las fuentes de Capacitor para Android (resources/). Rasteriza con el
// Chromium de Playwright (devDependency), así el SVG se pinta igual que en la web.
import { chromium } from "@playwright/test";
import { readFileSync, writeFileSync } from "node:fs";
import { deflateSync } from "node:zlib";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const mark = readFileSync(resolve(ROOT, "src/shared/components/ui/brand-mark.tsx"), "utf8");
const path = (name) => mark.match(new RegExp(`${name} = "([^"]+)"`))[1];
const A = path("BRAND_A");
const BOLT = path("BRAND_BOLT");

// `Palette.background` / `--background` y `Palette.gold` / `--primary`.
const BLACK = "#0B0A0A";
const GOLD = "#D8B25E";

/** La «A» con su caja (x 12–88, y 10–86) centrada en (cx, cy) y `width` de ancho. */
const glyph = (cx, cy, width) => {
  const k = width / 76;
  return `<g transform="translate(${cx - 50 * k} ${cy - 48 * k}) scale(${k})" fill="${GOLD}"><path d="${A}"/><path d="${BOLT}"/></g>`;
};

/** Cuadrado a sangre (iPhone, web, PWA): el sistema pone la máscara. */
const square = (size, ratio = 0.58, background = BLACK) => `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
  <rect width="${size}" height="${size}" fill="${BLACK}"/>
  ${glyph(size / 2, size * 0.495, size * ratio)}
</svg>`;

/** Mac: el squircle va dibujado en el icono (plantilla de Apple: 824 de 1024, radio 185,4) con su sombra. */
const mac = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024">
  <defs><filter id="s" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="10" stdDeviation="10" flood-color="#000" flood-opacity="0.35"/></filter></defs>
  <rect x="100" y="100" width="824" height="824" rx="185.4" fill="${BLACK}" filter="url(#s)"/>
  ${glyph(512, 508, 824 * 0.58)}
</svg>`;

// CHROMIUM_PATH: otro Chromium si el de Playwright no está instalado.
const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const page = await browser.newPage();

/** SVG → PNG/WebP del tamaño pedido, en un canvas (conserva la transparencia del Mac). */
const raster = (svg, size, type = "image/png") => page.evaluate(async ({ svg, size, type }) => {
  const img = new Image();
  img.src = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
  await img.decode();
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, 0, 0, size, size);
  return canvas.toDataURL(type, 0.92).split(",")[1];
}, { svg, size, type }).then((b64) => Buffer.from(b64, "base64"));

/** PNG sin canal alfa (el App Store rechaza iconos de iPhone con transparencia). */
const flatPng = async (svg, size) => {
  const rgba = Buffer.from(await page.evaluate(async ({ svg, size }) => {
    const img = new Image();
    img.src = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
    await img.decode();
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext("2d");
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img, 0, 0, size, size);
    return Array.from(ctx.getImageData(0, 0, size, size).data);
  }, { svg, size }));
  const rows = Buffer.alloc(size * (size * 3 + 1));
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) rgba.copy(rows, y * (size * 3 + 1) + 1 + x * 3, (y * size + x) * 4, (y * size + x) * 4 + 3);
  }
  const crcTable = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
  const crc = (buf) => { let c = 0xffffffff; for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const chunk = (type, data) => {
    const body = Buffer.concat([Buffer.from(type), data]);
    const out = Buffer.alloc(12 + data.length);
    out.writeUInt32BE(data.length, 0); body.copy(out, 4); out.writeUInt32BE(crc(body), 8 + data.length);
    return out;
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4); ihdr[8] = 8; ihdr[9] = 2; // 8 bits, RGB
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk("IHDR", ihdr), chunk("IDAT", deflateSync(rows, { level: 9 })), chunk("IEND", Buffer.alloc(0))]);
};

const write = async (svg, file, size, format = "png") => {
  const data = format === "flat" ? await flatPng(svg, size) : await raster(svg, size, format === "webp" ? "image/webp" : "image/png");
  writeFileSync(resolve(ROOT, file), data);
  console.log("Escrito", file);
};

const icons = "native/Autopilot/Assets.xcassets/AppIcon.appiconset";
// iPhone: sin transparencia (App Store la rechaza).
await write(square(1024), `${icons}/ios-1024.png`, 1024, "flat");
for (const [name, size] of [
  ["16x16", 16], ["16x16@2x", 32], ["32x32", 32], ["32x32@2x", 64], ["128x128", 128],
  ["128x128@2x", 256], ["256x256", 256], ["256x256@2x", 512], ["512x512", 512], ["512x512@2x", 1024],
]) await write(mac, `${icons}/icon_${name}.png`, size);

// Arranque (LaunchLogo sobre LaunchBackground = Palette.background, sin salto de negro) y el logo de la bienvenida.
for (const [suffix, size] of [["", 240], ["@2x", 480], ["@3x", 720]]) {
  await write(square(size, 0.32, null), `native/Autopilot/Assets.xcassets/LaunchLogo.imageset/launch${suffix}.png`, size);
}
await write(square(1024), "native/Autopilot/Assets.xcassets/Logo.imageset/logo.png", 1024, "flat");
await write(square(1024), "src/shared/assets/autopilot-logo.png", 1024, "flat");

// Web y PWA. En los tamaños pequeños la «A» crece para seguir leyéndose.
await write(square(180), "public/apple-touch-icon.png", 180, "flat");
await write(square(512), "public/favicon.png", 512, "flat");
await write(square(192), "public/pwa-192.png", 192, "flat");
await write(square(512), "public/pwa-512.png", 512, "flat");
// Maskable: la «A» dentro del círculo seguro (80 %).
await write(square(512, 0.42), "public/pwa-maskable-512.png", 512, "flat");
for (const size of [48, 72, 96, 128, 192, 256, 512]) {
  await write(square(size, size <= 72 ? 0.46 : 0.42), `public/icons/icon-${size}.webp`, size, "webp");
}
// favicon.ico con 16, 32, 48 y 64 px (PNG dentro del ICO).
const ico = [];
for (const size of [16, 32, 48, 64]) ico.push(await raster(square(size, size <= 32 ? 0.7 : 0.6), size));
const header = Buffer.alloc(6 + 16 * ico.length);
header.writeUInt16LE(0, 0); header.writeUInt16LE(1, 2); header.writeUInt16LE(ico.length, 4);
let offset = header.length;
ico.forEach((png, i) => {
  const size = [16, 32, 48, 64][i];
  const entry = 6 + 16 * i;
  header.writeUInt8(size, entry); header.writeUInt8(size, entry + 1);
  header.writeUInt16LE(1, entry + 4); header.writeUInt16LE(32, entry + 6);
  header.writeUInt32LE(png.length, entry + 8); header.writeUInt32LE(offset, entry + 12);
  offset += png.length;
});
writeFileSync(resolve(ROOT, "public/favicon.ico"), Buffer.concat([header, ...ico]));
console.log("Escrito public/favicon.ico");

// Capacitor (Android): icono, primer plano adaptativo (zona segura de 66/108) y fondo.
await write(square(1024), "resources/icon.png", 1024, "flat");
await write(square(1024, 0.36, null), "resources/icon-foreground.png", 1024);
await write(`<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024"><rect width="1024" height="1024" fill="${BLACK}"/></svg>`, "resources/icon-background.png", 1024, "flat");
await write(square(2732, 0.16), "resources/splash.png", 2732);
await write(square(2732, 0.16), "resources/splash-dark.png", 2732);

await browser.close();
