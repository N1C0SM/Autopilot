/**
 * Auditoría F7: contraste AA, áreas táctiles de 44 pt y desbordes horizontales.
 *
 * Uso:
 *   node scripts/audit/a11y.mjs                 # páginas públicas
 *   node scripts/audit/a11y.mjs --app           # páginas públicas + app (requiere audit/.auth/admin.json)
 *
 * Imprime una tabla por ruta con los tres recuentos y los peores casos.
 * No escribe capturas: solo mide el DOM, así que se puede correr en CI.
 */
import { chromium } from "../../node_modules/playwright/index.mjs";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "../..");
const BASE = process.env.AUDIT_BASE || "http://localhost:8080";
const AUTH = resolve(ROOT, "audit/.auth/admin.json");
const withApp = process.argv.includes("--app");

const VIEWPORTS = [
  { name: "móvil", width: 390, height: 844 },
  { name: "escritorio", width: 1440, height: 900 },
];

const PUBLIC_ROUTES = ["/", "/planes", "/como-funciona", "/recursos", "/preguntas-frecuentes"];
const APP_ROUTES = ["/dashboard", "/dashboard?tab=train", "/progreso", "/ajustes", "/admin"];

/** Contraste calculado en el navegador con el fondo efectivo (sube por ancestros). */
const CONTRAST_SCRIPT = () => {
  const parse = (value) => {
    const m = value.match(/rgba?\(([^)]+)\)/);
    if (!m) return null;
    const parts = m[1].split(/[,/]/).map((n) => parseFloat(n.trim()));
    return { r: parts[0], g: parts[1], b: parts[2], a: parts.length > 3 ? parts[3] : 1 };
  };
  const over = (fg, bg) => ({
    r: fg.r * fg.a + bg.r * (1 - fg.a),
    g: fg.g * fg.a + bg.g * (1 - fg.a),
    b: fg.b * fg.a + bg.b * (1 - fg.a),
  });
  const lum = (c) => {
    const f = (v) => {
      const s = v / 255;
      return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    };
    return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
  };
  const ratio = (a, b) => {
    const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
    return (hi + 0.05) / (lo + 0.05);
  };
  const effectiveBg = (el) => {
    // Una cápsula de realce (pestaña activa) es un hermano absoluto dentro del mismo
    // control, no un ancestro: si cubre el punto medio del texto, es el fondo real.
    const rect = el.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    let node = el.parentElement;
    for (let depth = 0; node && depth < 3; depth += 1, node = node.parentElement) {
      for (const sibling of node.children) {
        const style = getComputedStyle(sibling);
        if (!style.position.startsWith("absolute") && style.position !== "fixed") continue;
        const bg = parse(style.backgroundColor);
        if (!bg || bg.a < 0.2) continue;
        const sr = sibling.getBoundingClientRect();
        if (cx >= sr.left && cx <= sr.right && cy >= sr.top && cy <= sr.bottom) return bg;
      }
    }
    node = el;
    let acc = null;
    while (node && node.nodeType === 1) {
      const bg = parse(getComputedStyle(node).backgroundColor);
      if (bg && bg.a > 0) {
        acc = acc ? over(acc, bg) : bg;
        if (acc.a === undefined || bg.a >= 0.999) break;
      }
      node = node.parentElement;
    }
    return acc && acc.a >= 0.999 ? acc : { r: 0, g: 0, b: 0, a: 1 };
  };

  const results = { lowContrast: [], smallTargets: [], overflow: [] };
  const visible = (el) => {
    const r = el.getBoundingClientRect();
    const s = getComputedStyle(el);
    return r.width > 0 && r.height > 0 && s.visibility !== "hidden" && s.display !== "none" && parseFloat(s.opacity) > 0.15;
  };

  for (const el of document.querySelectorAll("body *")) {
    if (!visible(el)) continue;
    const text = Array.from(el.childNodes)
      .filter((n) => n.nodeType === 3)
      .map((n) => n.textContent.trim())
      .join(" ")
      .trim();
    if (text) {
      const s = getComputedStyle(el);
      const fg = parse(s.color);
      if (fg) {
        const bg = effectiveBg(el);
        const composed = fg.a < 1 ? over(fg, bg) : fg;
        const r = ratio(composed, bg);
        const size = parseFloat(s.fontSize);
        const bold = parseInt(s.fontWeight, 10) >= 700;
        const large = size >= 24 || (bold && size >= 18.66);
        const min = large ? 3 : 4.5;
        if (r < min) {
          results.lowContrast.push({
            text: text.slice(0, 48),
            ratio: Math.round(r * 100) / 100,
            min,
            size,
            color: s.color,
            cls: (el.className || "").toString().slice(0, 70),
          });
        }
      }
    }
  }

  for (const el of document.querySelectorAll("a[href], button, [role=button], [role=tab], input:not([type=hidden]), select, textarea, [role=switch], [role=checkbox]")) {
    if (!visible(el)) continue;
    if (el.closest("[aria-hidden=true]")) continue;
    // El enlace de «saltar al contenido» solo existe al recibir foco.
    if (el.className.toString().includes("sr-only")) continue;
    const r = el.getBoundingClientRect();
    // Área táctil real: el control puede ampliarla con `::before` (patrón del sistema,
    // p. ej. interruptores de 31 pt con 44 pt de zona).
    const hit = { top: 0, right: 0, bottom: 0, left: 0 };
    for (const pseudo of ["::before", "::after"]) {
      const ps = getComputedStyle(el, pseudo);
      if (!ps.content || ps.content === "none" || ps.content === "normal") continue;
      if (!ps.position.startsWith("absolute") && ps.position !== "fixed") continue;
      const px = (value) => (value.endsWith("px") ? Math.abs(parseFloat(value)) : 0);
      hit.top = Math.max(hit.top, px(ps.top));
      hit.bottom = Math.max(hit.bottom, px(ps.bottom));
      hit.left = Math.max(hit.left, px(ps.left));
      hit.right = Math.max(hit.right, px(ps.right));
    }
    const hitW = r.width + hit.left + hit.right;
    const hitH = r.height + hit.top + hit.bottom;
    const label = (el.getAttribute("aria-label") || el.textContent || "").trim().slice(0, 40);
    const cls = el.className.toString();
    // Excepción de WCAG 2.5.8: un enlace dentro de una frase no necesita objetivo propio.
    if (el.tagName === "A" && getComputedStyle(el).display === "inline") continue;
    // Enlaces de navegación (pie, listas) construidos con `min-h-11`: se les pide 24 × 24.
    const navLink = el.tagName === "A" && /min-h-1[12]/.test(cls);
    const limit = navLink ? 24 : 44;
    if (hitW < limit || hitH < limit) {
      results.smallTargets.push({ label, w: Math.round(hitW), h: Math.round(hitH), tag: el.tagName.toLowerCase(), cls: cls.slice(0, 60) });
    }
  }

  if (document.documentElement.scrollWidth > window.innerWidth + 1) {
    results.overflow.push({ scrollWidth: document.documentElement.scrollWidth, innerWidth: window.innerWidth });
  }
  return results;
};

const browser = await chromium.launch();
const extraRoutes = (process.env.AUDIT_ROUTES || "").split(",").map((r) => r.trim()).filter(Boolean);
const routes = extraRoutes.length
  ? extraRoutes
  : withApp && existsSync(AUTH) ? [...PUBLIC_ROUTES, ...APP_ROUTES] : PUBLIC_ROUTES;
const summary = [];

for (const viewport of VIEWPORTS) {
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    storageState: withApp && existsSync(AUTH) ? AUTH : undefined,
  });
  for (const route of routes) {
    const page = await context.newPage();
    try {
      await page.goto(BASE + route, { waitUntil: "networkidle", timeout: 45000 });
      await page.waitForTimeout(1200);
      const result = await page.evaluate(CONTRAST_SCRIPT);
      summary.push({ viewport: viewport.name, route, ...result });
      const worst = result.lowContrast.sort((a, b) => b.ratio - a.ratio).slice(0, 6);
      console.log(`\n${viewport.name} ${route} · contraste ${result.lowContrast.length} · táctil ${result.smallTargets.length} · desborde ${result.overflow.length}`);
      if (worst.length) console.table(worst);
      if (result.smallTargets.length) console.table(result.smallTargets.slice(0, 8));
    } catch (error) {
      console.log(`\n${viewport.name} ${route} · ERROR ${error.message.slice(0, 120)}`);
    } finally {
      await page.close();
    }
  }
  await context.close();
}

await browser.close();

const totals = summary.reduce(
  (acc, s) => ({
    contrast: acc.contrast + s.lowContrast.length,
    targets: acc.targets + s.smallTargets.length,
    overflow: acc.overflow + s.overflow.length,
  }),
  { contrast: 0, targets: 0, overflow: 0 },
);
console.log("\nTOTAL", totals);
