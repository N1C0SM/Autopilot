import sharp from "sharp";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const icon = path.join(root, "resources/icon.png");
const dashboard = path.join(root, "src/assets/dashboard-preview.png");
const background = path.join(root, "store-assets/source/feature-background.png");

const esc = (value) => value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
const svg = (width, height, content) => Buffer.from(`<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">${content}</svg>`);

async function featureGraphic() {
  const width = 1024;
  const height = 500;
  const bg = await sharp(background).resize(width, height, { fit: "cover" }).png().toBuffer();
  const logo = await sharp(icon).resize(150, 150).png().toBuffer();
  const words = svg(width, height, `
    <style>
      .brand { font: 800 68px -apple-system, BlinkMacSystemFont, Arial, sans-serif; fill: #ffffff; }
      .tag { font: 500 28px -apple-system, BlinkMacSystemFont, Arial, sans-serif; fill: #f5c542; }
    </style>
    <text x="205" y="220" class="brand">Autopilot</text>
    <text x="205" y="270" class="tag">Tu plan. Tu progreso.</text>
  `);
  await sharp(bg)
    .composite([{ input: logo, left: 42, top: 160 }, { input: words, left: 0, top: 0 }])
    .png()
    .toFile(path.join(root, "store-assets/google-play/feature-graphic-1024x500.png"));
}

const slides = [
  { title: "Tu semana, siempre clara", subtitle: "Entrenamiento organizado día a día", position: "left" },
  { title: "Un plan hecho para ti", subtitle: "Rutinas adaptadas a tus objetivos", position: "centre" },
  { title: "Tu plan de un vistazo", subtitle: "Consulta cada sesión cuando la necesites", position: "right" },
];

async function screenshot(width, height, slide, output) {
  const top = Math.round(height * 0.08);
  const titleSize = Math.round(width * 0.070);
  const subSize = Math.round(width * 0.033);
  const cardWidth = Math.round(width * 0.88);
  const cardHeight = Math.round(height * 0.58);
  const cardTop = Math.round(height * 0.30);
  const ui = await sharp(dashboard)
    .resize(cardWidth, cardHeight, { fit: "cover", position: slide.position })
    .png()
    .toBuffer();
  const logo = await sharp(icon).resize(Math.round(width * 0.13), Math.round(width * 0.13)).png().toBuffer();
  const base = svg(width, height, `
    <defs>
      <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#050505"/>
        <stop offset="0.62" stop-color="#11100b"/>
        <stop offset="1" stop-color="#2a1c02"/>
      </linearGradient>
      <filter id="shadow"><feDropShadow dx="0" dy="24" stdDeviation="28" flood-color="#000" flood-opacity="0.65"/></filter>
    </defs>
    <rect width="100%" height="100%" fill="url(#g)"/>
    <circle cx="${Math.round(width * 0.90)}" cy="${Math.round(height * 0.12)}" r="${Math.round(width * 0.38)}" fill="#f5c542" opacity="0.06"/>
    <text x="${Math.round(width * 0.06)}" y="${top + titleSize}" font-family="-apple-system, BlinkMacSystemFont, Arial, sans-serif" font-weight="800" font-size="${titleSize}" fill="#fff">${esc(slide.title)}</text>
    <text x="${Math.round(width * 0.06)}" y="${top + titleSize + subSize * 1.65}" font-family="-apple-system, BlinkMacSystemFont, Arial, sans-serif" font-weight="500" font-size="${subSize}" fill="#f5c542">${esc(slide.subtitle)}</text>
    <rect x="${Math.round(width * 0.06)}" y="${cardTop}" width="${cardWidth}" height="${cardHeight}" rx="${Math.round(width * 0.035)}" fill="#111" stroke="#f5c542" stroke-opacity="0.35" stroke-width="3" filter="url(#shadow)"/>
    <text x="${Math.round(width * 0.50)}" y="${Math.round(height * 0.952)}" text-anchor="middle" font-family="-apple-system, BlinkMacSystemFont, Arial, sans-serif" font-weight="700" font-size="${Math.round(width * 0.030)}" fill="#fff">AUTOPILOT</text>
  `);
  const roundedMask = svg(cardWidth, cardHeight, `<rect width="100%" height="100%" rx="${Math.round(width * 0.035)}" fill="#fff"/>`);
  const roundedUi = await sharp(ui).composite([{ input: roundedMask, blend: "dest-in" }]).png().toBuffer();
  await sharp(base)
    .composite([
      { input: roundedUi, left: Math.round(width * 0.06), top: cardTop },
      { input: logo, left: Math.round(width * 0.81), top: Math.round(height * 0.02) },
    ])
    .png()
    .toFile(output);
}

await featureGraphic();
await sharp(icon).resize(512, 512).png().toFile(path.join(root, "store-assets/google-play/icon-512.png"));

for (let index = 0; index < slides.length; index += 1) {
  const number = String(index + 1).padStart(2, "0");
  await screenshot(1290, 2796, slides[index], path.join(root, `store-assets/app-store/iphone-6.7/${number}.png`));
  await screenshot(1080, 1920, slides[index], path.join(root, `store-assets/google-play/phone-${number}.png`));
  await screenshot(2048, 2732, slides[index], path.join(root, `store-assets/app-store/ipad-12.9/${number}.png`));
}

console.log("Store assets generated.");
