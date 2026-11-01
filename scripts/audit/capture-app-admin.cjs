const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("/Users/Nicolas/Developer/Autopilot-source/node_modules/playwright");

const BASE = "http://localhost:8080";
const OUT = path.resolve("audit/despues");
const VIEWPORTS = {
  desktop: { width: 1440, height: 900, deviceScaleFactor: 1, isMobile: false, hasTouch: false },
  tablet: { width: 834, height: 1112, deviceScaleFactor: 2, isMobile: false, hasTouch: false },
  mobile: { width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
};
const USER_ID = "c16c5813-dd11-45cd-b856-bae905a3087a";
const USER_PATH = `/dashboard/user/${USER_ID}`;

// App screens from manifest
const { APP_SCREENS, EXTRA_APP_SCREENS } = require("./manifest.mjs");
const screens = [...APP_SCREENS, ...EXTRA_APP_SCREENS];

const VIEWPORT_KEYS = process.argv.includes("--viewports")
  ? process.argv[process.argv.indexOf("--viewports") + 1].split(",")
  : ["desktop", "tablet", "mobile"];

(async () => {
  await fs.promises.mkdir(OUT, { recursive: true });
  const browser = await chromium.launch();
  for (const key of VIEWPORT_KEYS) {
    const vp = VIEWPORTS[key];
    const context = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      deviceScaleFactor: vp.deviceScaleFactor,
      isMobile: vp.isMobile,
      hasTouch: vp.hasTouch,
      locale: "es-ES",
      timezoneId: "Europe/Madrid",
      colorScheme: "dark",
      reducedMotion: "reduce",
      storageState: "audit/.auth/admin.json",
      extraHTTPHeaders: { "Cache-Control": "no-cache" },
    });
    const page = await context.newPage();
    await page.emulateMedia({ reducedMotion: "reduce" });

    for (const screen of screens) {
      const target = screen.path
        ? { ...screen }
        : { ...screen, path: `${USER_PATH}?section=${screen.tab}` };
      const file = path.join(OUT, key, screen.section, `${screen.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")}.jpg`);
      await fs.promises.mkdir(path.dirname(file), { recursive: true });
      try {
        await page.goto(`${BASE}${target.path}`, { waitUntil: "domcontentloaded", timeout: 45000 });
        await page.waitForTimeout(800);
        await page.evaluate(() => document.fonts?.ready);
        // settle
        await page.evaluate(async () => {
          const step = Math.max(320, window.innerHeight * 0.8);
          const max = Math.min(document.body.scrollHeight, 24000);
          for (let y = 0; y < max; y += step) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 45)); }
          window.scrollTo(0, 0);
          await new Promise((r) => setTimeout(r, 120));
        });
        await page.waitForTimeout(500);
        await page.screenshot({ path: file, fullPage: true, type: "jpeg", quality: 80, animations: "disabled" });
        console.log("✓", key.padEnd(7), screen.name);
      } catch (e) {
        console.log("✗", key.padEnd(7), screen.name, e.message.slice(0, 120));
      }
    }
    await context.close();
  }
  await browser.close();
  console.log("done");
})();
