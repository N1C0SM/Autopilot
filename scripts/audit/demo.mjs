/**
 * Captura la sección «demo» de la landing.
 *
 * Hallazgo H15 de `audit/INFORME.md`: la demo NO es interactiva. Renderiza una
 * captura estática (`/app-shots/*.jpg`) dentro de un teléfono, así que no hay
 * pestañas que pulsar. Este script deja constancia visual de eso y sirve para
 * comparar cuando la demo pase a usar componentes reales.
 */
import { chromium } from "@playwright/test";
import fs from "node:fs/promises";
import path from "node:path";

const BASE = process.env.BASE_URL || "http://localhost:8080";
const OUT = path.resolve(process.argv[2] || "audit/antes/demo");
const VIEWPORTS = [
  { name: "desktop", width: 1440, height: 900, isMobile: false },
  { name: "mobile", width: 390, height: 844, isMobile: true },
];

const browser = await chromium.launch();
for (const viewport of VIEWPORTS) {
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    isMobile: viewport.isMobile,
    hasTouch: viewport.isMobile,
    locale: "es-ES",
    colorScheme: "dark",
    reducedMotion: "reduce",
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();
  await page.goto(`${BASE}/#demo`, { waitUntil: "domcontentloaded" });
  const demo = page.locator("#demo");
  await demo.scrollIntoViewIfNeeded();
  await page.waitForTimeout(1200);
  await page.evaluate(() => document.fonts?.ready);

  const file = path.join(OUT, `${viewport.name}.jpg`);
  await fs.mkdir(path.dirname(file), { recursive: true });
  await demo.screenshot({ path: file, type: "jpeg", quality: 82 });

  const images = await demo.locator("img").evaluateAll((els) => els.map((e) => e.getAttribute("src")));
  const tabs = await page.getByRole("tab").count();
  console.log(`✓ ${viewport.name} · ${images.length} imagen(es): ${images.join(", ") || "—"} · pestañas interactivas: ${tabs}`);
  await context.close();
}
await browser.close();
