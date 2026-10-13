// @vitest-environment node
import { describe, expect, it } from "vitest";
import { availabilityFrom, euro, fallbackCatalog, parseCatalog } from "./planCatalogCore";
import { landingFaqs, publicFaqs, publicPageMeta } from "./publicCopy";
import { __test, markdownToHtml, renderRoute } from "../../seo/prerender";

const withoutCoach = availabilityFrom(parseCatalog(fallbackCatalog().filter((p) => p.key !== "full").map((p) => ({ ...p, not_included: p.notIncluded }))));
const withCoach = availabilityFrom(fallbackCatalog());
const text = (v: unknown) => JSON.stringify(v);

describe("copy follows the plans published in Admin", () => {
  it("drops every Coach mention when Coach is hidden", () => {
    expect(withoutCoach.coach).toBe(false);
    expect(text(landingFaqs(withoutCoach))).not.toMatch(/Coach/);
    expect(text(publicFaqs(withoutCoach))).not.toMatch(/Coach/);
    expect(text(publicPageMeta(withoutCoach))).not.toMatch(/Coach/);
  });

  it("brings Coach back, with the admin price, when it is published again", () => {
    expect(text(landingFaqs(withCoach))).toMatch(/Coach \(49 €\/mes\)/);
    expect(text(publicFaqs(withCoach))).toMatch(/¿Qué incluye el plan Coach\?/);
    const renamed = availabilityFrom(parseCatalog([{ key: "free", price: 0 }, { key: "full", name: "Coach Pro", price: 59, features: [] }]));
    expect(text(publicFaqs(renamed))).toMatch(/Coach Pro \(59 €\/mes\)/);
  });

  it("formats prices the Spanish way", () => {
    expect(euro(29)).toBe("29 €");
  });
});

describe("build-time prerender", () => {
  const template = `<!doctype html><html lang="es"><head><title>x</title><meta name="description" content="x" data-prerender /><link rel="canonical" href="https://autopilotplan.com/" data-prerender /><script type="application/ld+json" data-prerender>{}</script></head><body><div id="root"><div>splash</div></div>\n<script type="module" src="/assets/index.js"></script></body></html>`;

  it("writes one page per public route with its own head and real content", () => {
    const routes = __test.buildRoutes(withoutCoach, []);
    const plans = routes.find((r) => r.path === "/planes")!;
    const html = renderRoute(template, plans);
    expect(html).toContain("<title>Planes y precios · Autopilot</title>");
    expect(html.match(/rel="canonical"/g)).toHaveLength(1);
    expect(html).toContain('href="https://autopilotplan.com/planes"');
    expect(html).toContain("<h1>Planes y precios</h1>");
    expect(html).toContain('<script type="module" src="/assets/index.js">');
    expect(new Set(routes.map((r) => r.title)).size).toBe(routes.length);
  });

  it("fills the body of a Vite-built page, where the entry script lives in <head>", () => {
    const built = `<!doctype html><html><head><title>x</title><script type="module" crossorigin src="/assets/index-abc.js"></script></head><body><div id="root"><div role="status">splash</div><!--prerender:content--></div></body></html>`;
    const html = renderRoute(built, __test.buildRoutes(withoutCoach, []).find((r) => r.path === "/planes")!);
    expect(html).toContain("<h1>Planes y precios</h1>");
    expect(html).toContain('<div role="status">splash</div><div data-prerender-content>');
    expect(html).not.toContain("<!--prerender:content-->");
  });

  it("keeps hidden plans out of the HTML, sitemap and llms.txt", () => {
    const routes = __test.buildRoutes(withoutCoach, []);
    const pages = routes.filter((r) => !r.path.startsWith("/legal/")).map((r) => renderRoute(template, r)).join("");
    expect(pages).not.toMatch(/Coach/);
    expect(__test.llms(withoutCoach, routes, true, [])).not.toMatch(/Coach/);
    expect(__test.sitemap(routes)).not.toContain("/login");
  });

  it("turns blog markdown into indexable HTML", () => {
    expect(markdownToHtml("## Técnica\n- **Pies** firmes\n\n[Guía](/recursos)")).toBe('<h2>Técnica</h2>\n<ul>\n<li><strong>Pies</strong> firmes</li>\n</ul>\n<p><a href="/recursos">Guía</a></p>');
  });
});
