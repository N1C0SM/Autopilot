/**
 * Capturas de auditoría con Playwright.
 *
 * Uso:
 *   node scripts/audit/capture.mjs --group public --out audit/antes
 *   node scripts/audit/capture.mjs --group app --state audit/.auth/user.json --out audit/antes
 *   node scripts/audit/capture.mjs --group admin --state audit/.auth/admin.json --out audit/antes
 *
 * Agrupa las capturas por viewport (`desktop`, `tablet`, `mobile`) y por sección,
 * y deja un informe con errores de consola y peticiones fallidas de cada pantalla.
 */
import { chromium } from "@playwright/test";
import fs from "node:fs/promises";
import path from "node:path";
import {
  ADMIN_SCREENS,
  APP_SCREENS,
  EXTRA_APP_SCREENS,
  PUBLIC_SCREENS,
  TRAINER_SCREENS,
  VIEWPORTS,
} from "./manifest.mjs";

const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, arg, i, all) => {
    if (arg.startsWith("--")) acc.push([arg.slice(2), all[i + 1]?.startsWith("--") ? "true" : all[i + 1]]);
    return acc;
  }, []),
);

const BASE = args.base || "http://localhost:8080";
const OUT = path.resolve(args.out || "audit/antes");
const GROUP = (args.group || "public").split(",");
const ONLY = args.only ? args.only.split(",") : null;
const STATE = args.state ? path.resolve(args.state) : null;
const VIEWPORT_KEYS = (args.viewports || Object.keys(VIEWPORTS).join(",")).split(",");
const WAIT = Number(args.wait || 500);

const screensFor = (group) => {
  const list =
    group === "public" ? PUBLIC_SCREENS
    : group === "app" ? [...APP_SCREENS, ...EXTRA_APP_SCREENS]
    : group === "admin" ? ADMIN_SCREENS
    : group === "trainer" ? TRAINER_SCREENS
    : [];
  return ONLY ? list.filter((s) => ONLY.some((o) => s.id.includes(o))) : list;
};

const slugify = (text) => text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

/** Deja cargadas las imágenes perezosas: recorre la página y vuelve arriba. */
async function settle(page) {
  await page.evaluate(async () => {
    const step = Math.max(320, window.innerHeight * 0.8);
    const max = Math.min(document.body.scrollHeight, 24000);
    for (let y = 0; y < max; y += step) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 45));
    }
    window.scrollTo(0, 0);
    await new Promise((r) => setTimeout(r, 120));
  });
  await page.waitForTimeout(WAIT);
}

const report = [];
let failures = 0;

async function capture(page, screen, viewport, file) {
  const errors = [];
  const failed = [];
  const onConsole = (msg) => {
    if (msg.type() === "error") errors.push(msg.text().slice(0, 400));
  };
  const onError = (err) => errors.push(String(err.message).slice(0, 400));
  const onResponse = (res) => {
    const status = res.status();
    if (status >= 500) failed.push(`${status} ${res.url().slice(0, 160)}`);
  };
  page.on("console", onConsole);
  page.on("pageerror", onError);
  page.on("response", onResponse);

  const started = Date.now();
  let status = "ok";
  try {
    await page.goto(`${BASE}${screen.path}`, { waitUntil: "domcontentloaded", timeout: 45000 });
    await page.waitForTimeout(600);
    await page.evaluate(() => document.fonts?.ready);
    await settle(page);
    await fs.mkdir(path.dirname(file), { recursive: true });
    await page.screenshot({ path: file, fullPage: true, type: "jpeg", quality: 80, animations: "disabled" });
  } catch (error) {
    status = "error";
    failures += 1;
    errors.push(String(error.message).slice(0, 400));
  } finally {
    page.off("console", onConsole);
    page.off("pageerror", onError);
    page.off("response", onResponse);
  }

  report.push({
    id: screen.id,
    name: screen.name,
    viewport: viewport.name,
    path: screen.path,
    finalUrl: page.url().replace(BASE, ""),
    title: await page.title().catch(() => ""),
    status,
    ms: Date.now() - started,
    errors: [...new Set(errors)].slice(0, 8),
    failed: [...new Set(failed)].slice(0, 8),
    file: path.relative(OUT, file),
  });
  process.stdout.write(`${status === "ok" ? "✓" : "✗"} ${viewport.name.padEnd(7)} ${screen.name}\n`);
}

/** Con sesión: resuelve el usuario real desde el redirect y luego entra a cada pestaña. */
async function resolveUserId(page) {
  await page.goto(`${BASE}/dashboard`, { waitUntil: "domcontentloaded" });
  await page.waitForURL(/\/dashboard\/user\/[0-9a-f-]{36}/, { timeout: 30000 });
  return page.url().match(/\/dashboard\/user\/([0-9a-f-]{36})/)[1];
}

async function captureApp(page, screens, viewport, userPath) {
  for (const screen of screens) {
    const file = path.join(OUT, viewport.name, screen.section, `${slugify(screen.name)}.jpg`);
    const target = screen.path
      ? { ...screen }
      : { ...screen, path: `${userPath}?section=${screen.tab}` };
    await capture(page, target, viewport, file);
  }
}

async function captureAdmin(page, screens, viewport) {
  for (const screen of screens) {
    const file = path.join(OUT, viewport.name, screen.section, `${slugify(screen.name)}.jpg`);
    await capture(page, screen, viewport, file);
  }
}

const run = async () => {
  await fs.mkdir(OUT, { recursive: true });
  const browser = await chromium.launch();

  for (const key of VIEWPORT_KEYS) {
    const viewport = VIEWPORTS[key];
    if (!viewport) throw new Error(`Viewport desconocido: ${key}`);
    const context = await browser.newContext({
      viewport: { width: viewport.width, height: viewport.height },
      deviceScaleFactor: viewport.deviceScaleFactor,
      isMobile: viewport.isMobile,
      hasTouch: viewport.hasTouch,
      locale: "es-ES",
      timezoneId: "Europe/Madrid",
      colorScheme: "dark",
      reducedMotion: "reduce",
      storageState: STATE || undefined,
      extraHTTPHeaders: { "Cache-Control": "no-cache" },
    });
    const page = await context.newPage();
    await page.emulateMedia({ reducedMotion: "reduce" });

    for (const group of GROUP) {
      const screens = screensFor(group);
      if (group === "app") {
        if (!STATE) throw new Error("El grupo app necesita --state con una sesión guardada");
        const userId = await resolveUserId(page);
        await captureApp(page, screens, viewport, `/dashboard/user/${userId}`);
      } else if (group === "admin") {
        if (!STATE) throw new Error("El grupo admin necesita --state con una sesión guardada");
        await captureAdmin(page, screens, viewport);
      } else {
        for (const screen of screens) {
          const file = path.join(OUT, viewport.name, screen.section, `${slugify(screen.name)}.jpg`);
          await capture(page, screen, viewport, file);
        }
      }
    }
    await context.close();
  }

  await browser.close();
  const file = path.join(OUT, `report-${GROUP.join("-")}.json`);
  await fs.writeFile(file, JSON.stringify(report, null, 2));
  console.log(`\n${report.length} capturas · ${failures} errores · informe: ${path.relative(process.cwd(), file)}`);
  if (failures) process.exitCode = 1;
};

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
