// @vitest-environment node
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { ADMIN_NAV_GROUPS } from "@/app/components/admin/adminNav";

/**
 * Web y apps nativas son un solo producto: web grande = Mac, web pequeña = iPhone.
 * Este test falla si los menús se separan (una sección añadida o quitada solo en un lado).
 * El chat de cliente no cuenta: está detrás del corte de lanzamiento (`releaseScope.ts`).
 */
const root = resolve(__dirname, "../../..");
const read = (p: string) => readFileSync(resolve(root, p), "utf8");
const swift = read("native/Autopilot/Features/Shell/RootView.swift");

/** `case .x: "Título"` de un `switch` concreto de RootView.swift. */
const swiftTitles = (prop: "title" | "tabTitle") => {
  const body = swift.slice(swift.indexOf(`var ${prop}: String {`));
  const block = body.slice(0, body.indexOf("\n    }\n"));
  return Object.fromEntries([...block.matchAll(/case \.(\w+): "([^"]+)"/g)].map((m) => [m[1], m[2]]));
};
const swiftList = (name: string) => {
  const m = swift.match(new RegExp(`static let ${name}: \\[AppSection\\] = \\[([^\\]]*)\\]`));
  return (m?.[1] ?? "").split(",").map((s) => s.trim().replace(/^\./, "")).filter(Boolean);
};
const titles = swiftTitles("title");
const tabTitles = { ...titles, ...swiftTitles("tabTitle") };

/** Títulos visibles de una lista de la web (`{ title: "…", section: "…" }` o `{ key: "…", label: "…" }`). */
const webItems = (file: string, list: string, label: "title" | "label", key: "section" | "key") => {
  const src = read(file);
  const block = src.slice(src.indexOf(`const ${list}`)).split("];")[0];
  return [...block.matchAll(new RegExp(`${label}: "([^"]+)",\\s*${key}: "(\\w+)"|${key}: "(\\w+)",\\s*${label}: "([^"]+)"`, "g"))]
    .map((m) => ({ title: m[1] ?? m[4], section: m[2] ?? m[3] }))
    .filter((i) => i.section !== "chat")
    .map((i) => i.title);
};

describe("paridad web ↔ apps nativas", () => {
  it("web grande = Mac: mismo menú lateral, en el mismo orden", () => {
    const mac = swiftList("userSections").map((s) => titles[s]);
    expect(mac).toHaveLength(5);
    expect(webItems("src/app/components/UserSidebar.tsx", "NAV_ITEMS", "title", "section")).toEqual(mac);
  });

  it("web pequeña = iPhone: mismas pestañas, en el mismo orden", () => {
    const iphone = swiftList("userTabs").map((s) => tabTitles[s]);
    expect(iphone).toHaveLength(4);
    expect(webItems("src/app/components/mobile/MobileTabBar.tsx", "TABS", "label", "key")).toEqual(iphone);
  });

  it("Admin: mismos grupos y secciones en la web y en la app", () => {
    const groups = [...swift.matchAll(/\("([^"]+)", \[([^\]]*)\]\)/g)].map((m) => ({
      label: m[1],
      items: m[2].split(",").map((s) => titles[s.trim().replace(/^\./, "")]).filter(Boolean),
    }));
    expect(groups.length).toBeGreaterThan(4);
    expect(ADMIN_NAV_GROUPS.map((g) => ({ label: g.label, items: g.items.map((i) => i.title) }))).toEqual(groups);
  });

  it("Nutrición: sin portada y cada comida con su foto propia o ninguna, en la web y en la app", () => {
    const web = read("src/app/components/dashboard/MealsList.tsx");
    const app = read("native/Autopilot/Features/Other/OtherViews.swift");
    expect(web).not.toMatch(/coverPhoto/);
    expect(app).not.toMatch(/coverCard/);
    // La foto de respaldo solo vale para las tarjetas vacías, nunca repetida en las filas.
    expect(web).toMatch(/const src = useMealPhoto\(dish\);\s*if \(!src\) return null;/);
    expect(app).toMatch(/if let url = photos\[Self\.dish\(meal\)\]/);
    expect(app).toMatch(/group\.addTask \{ \(dish, await AiCover\.ownMeal\(dish\)\) \}/);
  });

  it("Nutrición: cada comida con sus macros, que suman el objetivo y se suman al marcarlas, en la web y en la app", () => {
    const web = read("src/app/components/dashboard/MealsList.tsx");
    const app = read("native/Autopilot/Features/Other/OtherViews.swift");
    const note = "Al marcar una comida se suman sus macros del plan. Es una estimación: no se pesa lo que comes.";
    expect(web).toContain(note);
    expect(app).toContain(note);
    expect(web).toMatch(/kcal · P \{own\.protein\} g · C \{own\.carbs\} g · G \{own\.fats\} g/);
    expect(app).toMatch(/kcal · P \\\(own\.protein\) g · C \\\(own\.carbs\) g · G \\\(own\.fats\) g/);
    // El reparto exacto vive en mealMacros.ts y la app lo replica.
    expect(web).toMatch(/mealMacros\(meals, \{ kcal, protein: p, carbs: c, fats: f \}\)/);
    expect(app).toMatch(/static func splitExact\(_ total: Double, _ weights: \[Double\]\) -> \[Int\]/);
  });
});
