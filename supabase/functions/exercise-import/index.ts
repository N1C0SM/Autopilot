import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.95.0/cors";
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.95.0";
import { aiFetch } from "../_shared/ai-provider.ts";
import {
  DATASET, DATASET_URL, catalogNameKey, draftCredits, planImport, type CatalogDraft, type DatasetRow,
} from "../_shared/exercise-catalog.ts";

/**
 * Catálogo base de la biblioteca (solo admin):
 * - preview: qué entraría, sin escribir nada.
 * - import: crea los ejercicios nuevos como borrador (solo los ve el admin; el planificador no los usa).
 * - draft: la IA reescribe N borradores con la voz de Autopilot (nombre en español, pasos, errores, consejos,
 *   seguridad) y los deja pendientes de revisión. Si el nombre ya existe, no duplica: añade el nombre
 *   original como alternativo del existente y archiva el borrador para que no vuelva a importarse.
 * - publish: publica los pendientes revisados.
 */
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const MUSCLES = [
  "pectoral", "serrato", "dorsal", "trapecio", "romboides", "erectores", "deltoides-anterior", "deltoides-lateral",
  "deltoides-posterior", "manguito-rotador", "biceps", "braquial", "triceps", "antebrazo", "recto-abdominal", "oblicuos",
  "flexores-cadera", "cuadriceps", "aductores", "isquiotibiales", "gluteo-mayor", "gluteo-medio", "gemelos", "soleo", "cuello",
];
const PATTERNS = ["Empuje", "Tirón", "Sentadilla", "Bisagra", "Core"];
const MAX_DRAFT = 25;

type Svc = SupabaseClient;
type Catalogs = { muscles: Map<string, string>; equipment: Map<string, string>; categories: Map<string, string> };

async function pagedNames(svc: Svc) {
  const out: { id: string; name: string; alt_names: string[] | null; source: string | null; source_ref: string | null }[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await svc.from("exercises").select("id, name, alt_names, source, source_ref").range(from, from + 999);
    if (error) throw error;
    out.push(...(data ?? []));
    if ((data ?? []).length < 1000) return out;
  }
}

async function catalogs(svc: Svc): Promise<Catalogs> {
  const [m, e, c] = await Promise.all([
    svc.from("muscles").select("id, slug"),
    svc.from("equipment").select("id, name"),
    svc.from("exercise_categories_catalog").select("id, name"),
  ]);
  if (m.error || e.error || c.error) throw m.error ?? e.error ?? c.error;
  return {
    muscles: new Map((m.data ?? []).map((r) => [r.slug, r.id])),
    equipment: new Map((e.data ?? []).map((r) => [r.name, r.id])),
    categories: new Map((c.data ?? []).map((r) => [r.name, r.id])),
  };
}

async function loadPlan(svc: Svc) {
  const res = await fetch(DATASET_URL);
  if (!res.ok) throw new Error(`No se pudo leer el catálogo (${res.status})`);
  const rows = (await res.json()) as DatasetRow[];
  const existing = await pagedNames(svc);
  return planImport(rows, {
    refs: existing.filter((e) => e.source === DATASET.source && e.source_ref).map((e) => e.source_ref!),
    names: existing.flatMap((e) => [e.name, ...(e.alt_names ?? [])]),
  });
}

async function counts(svc: Svc) {
  const count = async (status: string) => {
    const { count: n } = await svc.from("exercises").select("id", { count: "exact", head: true })
      .eq("source", DATASET.source).eq("status", status);
    return n ?? 0;
  };
  const [draft, pending, published] = await Promise.all([count("draft"), count("pending"), count("published")]);
  return { draft, pending, published, draftCredits: draftCredits(draft) };
}

async function importDrafts(svc: Svc, drafts: CatalogDraft[]) {
  const cat = await catalogs(svc);
  let inserted = 0;
  for (let i = 0; i < drafts.length; i += 100) {
    const chunk = drafts.slice(i, i + 100);
    const { data, error } = await svc.from("exercises").insert(chunk.map((d) => ({
      name: d.name,
      alt_names: d.alt_names,
      instructions: d.instructions,
      muscle_group: d.muscle_group,
      exercise_type: d.exercise_type,
      status: "draft",
      source: DATASET.source,
      source_ref: d.source_ref,
      source_url: DATASET.repo,
      license: DATASET.license,
      license_author: DATASET.author,
      // Fuera del planificador hasta que un admin lo revise.
      is_stable: false,
      is_progressable: false,
      high_tension: false,
    }))).select("id, source_ref");
    if (error) throw error;
    const ids = new Map((data ?? []).map((r) => [r.source_ref, r.id]));
    const muscles: { exercise_id: string; muscle_id: string; role: string }[] = [];
    const equipment: { exercise_id: string; equipment_id: string }[] = [];
    const categories: { exercise_id: string; category_id: string }[] = [];
    for (const d of chunk) {
      const id = ids.get(d.source_ref);
      if (!id) continue;
      for (const s of d.primary) { const m = cat.muscles.get(s); if (m) muscles.push({ exercise_id: id, muscle_id: m, role: "primary" }); }
      for (const s of d.secondary) { const m = cat.muscles.get(s); if (m) muscles.push({ exercise_id: id, muscle_id: m, role: "secondary" }); }
      for (const n of d.equipment) { const e = cat.equipment.get(n); if (e) equipment.push({ exercise_id: id, equipment_id: e }); }
      for (const n of d.modalities) { const c = cat.categories.get(n); if (c) categories.push({ exercise_id: id, category_id: c }); }
    }
    const results = await Promise.all([
      muscles.length ? svc.from("exercise_muscles").insert(muscles) : null,
      equipment.length ? svc.from("exercise_equipment").insert(equipment) : null,
      categories.length ? svc.from("exercise_categories").insert(categories) : null,
    ]);
    const failed = results.find((r) => r?.error);
    if (failed?.error) throw failed.error;
    inserted += data?.length ?? 0;
  }
  return inserted;
}

/** Cambia los músculos de un ejercicio por los que propone la IA. */
async function relinkMuscles(svc: Svc, cat: Catalogs, id: string, primary: string[], secondary: string[]) {
  const rows = [
    ...primary.map((s) => ({ exercise_id: id, muscle_id: cat.muscles.get(s), role: "primary" })),
    ...secondary.filter((s) => !primary.includes(s)).map((s) => ({ exercise_id: id, muscle_id: cat.muscles.get(s), role: "secondary" })),
  ].filter((r) => r.muscle_id);
  if (!rows.some((r) => r.role === "primary")) return;
  await svc.from("exercise_muscles").delete().eq("exercise_id", id);
  await svc.from("exercise_muscles").insert(rows);
}

const SYSTEM = [
  "Eres el editor de la biblioteca de ejercicios de Autopilot, una app de entrenamiento en español de España.",
  "Escribes fichas propias con la voz de Autopilot: tuteo, frases cortas y claras, tono directo y cercano, sin emojis, sin marcas ni menciones a otras apps.",
  "Partes del nombre en inglés y de unos pasos orientativos, pero redactas todo con tus palabras.",
  "El nombre es el que se usa en un gimnasio español (mantén anglicismos habituales como «Hip thrust» o «Face pull»); en alt_names pon el nombre original en inglés y otros nombres comunes.",
  "Responde siempre llamando a write_exercise.",
].join(" ");

const TOOL = {
  type: "function",
  function: {
    name: "write_exercise",
    description: "Ficha del ejercicio",
    parameters: {
      type: "object",
      properties: {
        name: { type: "string", description: "Nombre en español, máximo 60 caracteres, sin la palabra «ejercicio»" },
        alt_names: { type: "array", items: { type: "string" }, maxItems: 4 },
        description: { type: "string", description: "Una o dos frases: qué es y para qué sirve" },
        instructions: { type: "array", items: { type: "string" }, minItems: 3, maxItems: 7, description: "Pasos en orden, uno por frase" },
        common_mistakes: { type: "array", items: { type: "string" }, minItems: 2, maxItems: 4 },
        tips: { type: "array", items: { type: "string" }, minItems: 2, maxItems: 3 },
        safety_notes: { type: "array", items: { type: "string" }, minItems: 1, maxItems: 2 },
        mechanic: { type: "string", enum: ["compound", "isolation"] },
        level: { type: "integer", description: "1 básico, 2 intermedio, 3 avanzado" },
        movement_pattern: { type: "string", enum: [...PATTERNS, ""], description: "Vacío si no encaja" },
        primary_muscles: { type: "array", items: { type: "string", enum: MUSCLES }, maxItems: 3 },
        secondary_muscles: { type: "array", items: { type: "string", enum: MUSCLES }, maxItems: 5 },
      },
      required: ["name", "alt_names", "description", "instructions", "common_mistakes", "tips", "safety_notes", "mechanic", "level", "primary_muscles", "secondary_muscles"],
    },
  },
};

const strings = (v: unknown, max: number) =>
  (Array.isArray(v) ? v : []).filter((s): s is string => typeof s === "string" && s.trim() !== "").map((s) => s.trim()).slice(0, max);

async function writeOne(svc: Svc, cat: Catalogs, names: Map<string, string>, ex: {
  id: string; name: string; instructions: string[] | null; muscle_group: string | null;
}) {
  const resp = await aiFetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${Deno.env.get("LOVABLE_API_KEY") ?? ""}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content: `Ejercicio: "${ex.name}". Grupo: ${ex.muscle_group ?? "—"}. Pasos orientativos:\n- ${(ex.instructions ?? []).join("\n- ")}` },
      ],
      tools: [TOOL],
      tool_choice: { type: "function", function: { name: "write_exercise" } },
    }),
  });
  if (resp.status === 402) throw Object.assign(new Error("Sin créditos de IA"), { status: 402 });
  if (resp.status === 429) throw Object.assign(new Error("Límite de IA, prueba en un minuto"), { status: 429 });
  if (!resp.ok) throw new Error(`IA ${resp.status}`);
  const data = await resp.json();
  const args = data.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
  if (!args) throw new Error("La IA no devolvió la ficha");
  const f = JSON.parse(args);
  const name = String(f.name ?? "").trim().slice(0, 60);
  if (!name) throw new Error("Ficha sin nombre");

  const key = catalogNameKey(name);
  const taken = names.get(key);
  if (taken && taken !== ex.id) {
    // Ya existe: el nombre original sirve para encontrarlo, y el borrador queda archivado (no se reimporta).
    const { data: other } = await svc.from("exercises").select("alt_names").eq("id", taken).maybeSingle();
    const alts = [...new Set([...(other?.alt_names ?? []), ex.name])];
    await svc.from("exercises").update({ alt_names: alts }).eq("id", taken);
    await svc.from("exercises").update({ status: "archived" }).eq("id", ex.id);
    return "duplicate";
  }
  names.set(key, ex.id); // antes de esperar a la base: otra ficha en paralelo no puede quedarse el mismo nombre

  const level = [1, 2, 3].includes(Number(f.level)) ? Number(f.level) : 2;
  const { error } = await svc.from("exercises").update({
    name,
    slug: "", // el trigger lo vuelve a crear a partir del nombre en español
    alt_names: [...new Set([ex.name, ...strings(f.alt_names, 4)])].filter((n) => catalogNameKey(n) !== catalogNameKey(name)),
    description: typeof f.description === "string" ? f.description.trim() : null,
    instructions: strings(f.instructions, 7),
    common_mistakes: strings(f.common_mistakes, 4),
    tips: strings(f.tips, 3),
    safety_notes: strings(f.safety_notes, 2),
    mechanic: f.mechanic === "isolation" ? "isolation" : "compound",
    level,
    movement_pattern: PATTERNS.includes(f.movement_pattern) ? f.movement_pattern : null,
    status: "pending",
  }).eq("id", ex.id);
  if (error) { names.delete(key); throw error; }
  const pick = (v: unknown, max: number) => strings(v, max).filter((s) => MUSCLES.includes(s));
  await relinkMuscles(svc, cat, ex.id, pick(f.primary_muscles, 3), pick(f.secondary_muscles, 5));
  return "written";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const token = (req.headers.get("Authorization") || "").replace("Bearer ", "");
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: { user } } = await sb.auth.getUser(token);
    if (!user) return json({ error: "Unauthorized" }, 401);
    const { data: isAdmin } = await sb.rpc("has_role", { _user_id: user.id, _role: "admin" });
    if (!isAdmin) return json({ error: "Forbidden" }, 403);

    const { action, limit } = await req.json().catch(() => ({}));
    const svc = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    if (action === "preview" || action === "import") {
      const plan = await loadPlan(svc);
      const imported = action === "import" ? await importDrafts(svc, plan.drafts) : 0;
      return json({
        total: plan.total,
        variants: plan.variants,
        alreadyImported: plan.alreadyImported,
        nameTaken: plan.nameTaken.length,
        toImport: action === "import" ? 0 : plan.drafts.length,
        imported,
        ...(await counts(svc)),
      });
    }

    if (action === "draft") {
      const n = Math.min(Math.max(Number(limit) || 10, 1), MAX_DRAFT);
      const { data: batch, error } = await svc.from("exercises").select("id, name, instructions, muscle_group")
        .eq("source", DATASET.source).eq("status", "draft").order("name").limit(n);
      if (error) throw error;
      const cat = await catalogs(svc);
      const names = new Map((await pagedNames(svc)).map((e) => [catalogNameKey(e.name), e.id]));
      let written = 0, duplicates = 0, failed = 0;
      let stop: { status: number; message: string } | null = null;
      const queue = [...(batch ?? [])];
      // 5 a la vez: cabe en el tiempo de una llamada y no satura la IA.
      await Promise.all(Array.from({ length: 5 }, async () => {
        for (let ex = queue.shift(); ex && !stop; ex = queue.shift()) {
          try {
            (await writeOne(svc, cat, names, ex)) === "written" ? written++ : duplicates++;
          } catch (e) {
            const status = (e as { status?: number }).status;
            if (status === 402 || status === 429) stop = { status, message: (e as Error).message };
            else { console.error("draft", ex.id, e); failed++; }
          }
        }
      }));
      const result = { written, duplicates, failed, ...(await counts(svc)) };
      return stop ? json({ error: stop.message, ...result }, stop.status) : json(result);
    }

    if (action === "publish") {
      const { data, error } = await svc.from("exercises")
        .update({ status: "published", reviewed_at: new Date().toISOString() })
        .eq("source", DATASET.source).eq("status", "pending").select("id");
      if (error) throw error;
      return json({ published: data?.length ?? 0, ...(await counts(svc)) });
    }

    if (action === "status") return json(await counts(svc));
    return json({ error: "Acción no válida" }, 400);
  } catch (e) {
    console.error(e);
    return json({ error: e instanceof Error ? e.message : "unknown" }, 500);
  }
});
