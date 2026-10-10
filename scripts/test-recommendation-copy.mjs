import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

const creatine = {
  id: "owner-creatine-id",
  title: "MyProtein Creatina Monohidrato · 500 g",
  description: "La forma más práctica y económica de asegurar tus requerimientos de proteína diarios cuando no llegas solo con comida sólida.",
  url: "https://example.com/creatine", image_url: "image-creatine", badge: "Recomendado", custom: { keep: true },
};
const whey = {
  id: "owner-whey-id", title: "MyProtein Impact Whey · 900 g",
  description: "El suplemento con mayor respaldo científico del mundo para ganar fuerza explosiva y rendimiento en series pesadas.",
  url: "https://example.com/whey", image_url: "image-whey", badge: "Proteína",
};
const other = { title: "Otro recurso", description: "Contenido del propietario", url: "https://example.com/other" };
const fixture = [
  { id: 1, recommendations: [creatine, other, whey] },
  { id: 2, recommendations: [{ ...creatine, description: "Descripción ya corregida por el propietario" }, { ...whey, title: "Otra proteína" }] },
  { id: 3, recommendations: [] },
  { id: 4, recommendations: null },
  { id: 5, recommendations: { nonArray: true } },
  { id: 6, recommendations: [other, whey] },
];
const expected = structuredClone(fixture);
const creatineCopy = "Creatina monohidrato para complementar tu entrenamiento. Consulta la etiqueta para conocer composición y modo de uso.";
const wheyCopy = "Proteína de suero para complementar la ingesta de proteína cuando la alimentación no cubre tus necesidades. Consulta la etiqueta y los alérgenos.";
expected[0].recommendations[0].description = creatineCopy;
expected[0].recommendations[2].description = wheyCopy;
expected[5].recommendations[1].description = wheyCopy;

const db = new PGlite();
try {
  await db.exec("CREATE TABLE public.settings (id integer PRIMARY KEY, recommendations jsonb);");
  for (const row of fixture) {
    await db.query("INSERT INTO public.settings (id, recommendations) VALUES ($1, $2::jsonb)", [row.id, row.recommendations === null ? null : JSON.stringify(row.recommendations)]);
  }
  const migration = await readFile(new URL("../supabase/migrations/20261009122000_recommendation_copy.sql", import.meta.url), "utf8");
  await db.exec(migration);
  assert.deepEqual((await db.query("SELECT id, recommendations FROM public.settings ORDER BY id")).rows, expected);
  await db.exec(migration);
  assert.deepEqual((await db.query("SELECT id, recommendations FROM public.settings ORDER BY id")).rows, expected);
  console.log("PASS: recommendation descriptions corrected; order, custom fields, owner edits and unrelated rows preserved; migration idempotent.");
} finally {
  await db.close();
}
