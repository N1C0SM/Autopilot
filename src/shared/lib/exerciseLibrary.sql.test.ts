// @vitest-environment node
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";

const MIGRATION = resolve(__dirname, "../../../supabase/migrations/20261031160000_exercise_library.sql");

const ADMIN = "00000000-0000-0000-0000-00000000000a";
const ANA = "00000000-0000-0000-0000-000000000001";
const BEA = "00000000-0000-0000-0000-000000000002";
const PRESS = "10000000-0000-0000-0000-000000000001";
const PRESS_DUP = "10000000-0000-0000-0000-000000000002";
const SQUAT = "10000000-0000-0000-0000-000000000003";

let db: PGlite;

const as = async (userId: string | null) => {
  await db.exec("RESET ROLE");
  await db.query("SELECT set_config('request.jwt.claim.sub', $1, false)", [userId ?? ""]);
  await db.exec(userId ? "SET ROLE authenticated" : "SET ROLE anon");
};
const asOwner = () => db.exec("RESET ROLE");
const names = async () =>
  (await db.query<{ name: string }>("SELECT name FROM public.exercises ORDER BY name")).rows.map((r) => r.name);

beforeAll(async () => {
  db = new PGlite();
  // Estado actual de producción: la tabla tal y como la dejaron las migraciones anteriores.
  await db.exec(`
    CREATE ROLE anon; CREATE ROLE authenticated;
    CREATE SCHEMA auth;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    CREATE TABLE auth.users (id uuid PRIMARY KEY);
    CREATE TYPE public.app_role AS ENUM ('admin', 'user', 'trainer');
    CREATE TABLE public.user_roles (user_id uuid, role public.app_role);
    CREATE FUNCTION public.has_role(_user_id uuid, _role public.app_role) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
      AS $$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role) $$;
    CREATE TABLE public.exercises (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      name text NOT NULL,
      muscle_group text,
      created_at timestamptz NOT NULL DEFAULT now(),
      image_url text, video_url text,
      is_stable boolean NOT NULL DEFAULT true,
      is_progressable boolean NOT NULL DEFAULT true,
      high_tension boolean NOT NULL DEFAULT true
    );
    ALTER TABLE public.exercises ENABLE ROW LEVEL SECURITY;
    CREATE POLICY "Admins can manage exercises" ON public.exercises FOR ALL TO authenticated
      USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
    CREATE POLICY "Authenticated can view exercises" ON public.exercises FOR SELECT TO authenticated USING (true);
    GRANT USAGE ON SCHEMA public, auth TO anon, authenticated;
    GRANT SELECT ON public.exercises TO anon;
    GRANT SELECT, INSERT, UPDATE, DELETE ON public.exercises TO authenticated;

    INSERT INTO auth.users VALUES ('${ADMIN}'), ('${ANA}'), ('${BEA}');
    INSERT INTO public.user_roles VALUES ('${ADMIN}', 'admin');
    -- Dos filas con el mismo nombre normalizado ya existen: la migración no debe fallar por ellas.
    INSERT INTO public.exercises (id, name, muscle_group, created_at) VALUES
      ('${PRESS}', 'Press banca', 'Pecho', '2026-01-01'),
      ('${PRESS_DUP}', 'Press  Banca', 'Pecho', '2026-02-01'),
      ('${SQUAT}', 'Sentadilla búlgara', 'Piernas', '2026-01-01');
  `);
  await db.exec(readFileSync(MIGRATION, "utf8"));
});

afterAll(async () => {
  await db?.close();
});

describe("biblioteca de ejercicios: modelo de datos", () => {
  it("conserva ids y nombres, y deja los ejercicios actuales publicados con slug único", async () => {
    await asOwner();
    const { rows } = await db.query<{ id: string; name: string; slug: string; status: string; source: string }>(
      "SELECT id, name, slug, status, source FROM public.exercises ORDER BY created_at, id");
    expect(rows.map((r) => [r.id, r.name])).toEqual([
      [PRESS, "Press banca"],
      [SQUAT, "Sentadilla búlgara"],
      [PRESS_DUP, "Press  Banca"],
    ]);
    expect(rows.every((r) => r.status === "published" && r.source === "autopilot")).toBe(true);
    expect(rows.find((r) => r.id === SQUAT)?.slug).toBe("sentadilla-bulgara");
    expect(rows.find((r) => r.id === PRESS)?.slug).toBe("press-banca");
    expect(rows.find((r) => r.id === PRESS_DUP)?.slug).toBe("press-banca-10000000");
  });

  it("normaliza nombres sin acentos, mayúsculas ni signos", async () => {
    const { rows } = await db.query<{ k: string }>("SELECT public.exercise_name_key('  Elevación  LATERAL (polea)!') AS k");
    expect(rows[0].k).toBe("elevacion lateral polea");
  });

  it("un alta sin slug lo recibe solo, y no se puede repetir un nombre", async () => {
    await as(ADMIN);
    await db.exec("INSERT INTO public.exercises (name) VALUES ('Remo con mancuerna')");
    const { rows } = await db.query<{ slug: string; status: string }>(
      "SELECT slug, status FROM public.exercises WHERE name = 'Remo con mancuerna'");
    expect(rows[0]).toEqual({ slug: "remo-con-mancuerna", status: "published" });
    await expect(db.exec("INSERT INTO public.exercises (name) VALUES ('REMO con  mancuérna')")).rejects.toThrow(/Ya existe/);
    await expect(db.exec(`UPDATE public.exercises SET name = 'Sentadilla bulgara' WHERE id = '${PRESS}'`)).rejects.toThrow(/Ya existe/);
    // Los duplicados antiguos se pueden seguir editando mientras no cambie el nombre.
    await db.exec(`UPDATE public.exercises SET image_url = 'https://x/y.webp' WHERE id = '${PRESS_DUP}'`);
    // Cada ejercicio de un catálogo importado entra una sola vez.
    await db.exec("INSERT INTO public.exercises (name, source, source_ref, status) VALUES ('Barbell curl', 'exercises-dataset', '0031', 'draft')");
    await expect(db.exec("INSERT INTO public.exercises (name, source, source_ref) VALUES ('Curl con barra', 'exercises-dataset', '0031')"))
      .rejects.toThrow(/exercises_source_ref_key/);
  });

  it("los usuarios ven publicados y archivados; borradores y pendientes solo el admin", async () => {
    await as(ADMIN);
    await db.exec(`
      INSERT INTO public.exercises (name, status, source) VALUES ('Curl martillo', 'pending', 'wger'), ('Face pull', 'draft', 'wger');
      UPDATE public.exercises SET status = 'archived' WHERE id = '${SQUAT}';
    `);
    expect(await names()).toContain("Curl martillo");
    await as(ANA);
    const visible = await names();
    expect(visible).toContain("Sentadilla búlgara");
    expect(visible).not.toContain("Curl martillo");
    expect(visible).not.toContain("Face pull");
    await expect(db.exec("INSERT INTO public.exercises (name) VALUES ('Truco')")).rejects.toThrow();
    await as(null);
    expect(await names()).toEqual([]);
  });

  it("siembra los catálogos que pide la biblioteca", async () => {
    await as(ANA);
    const count = async (table: string) => (await db.query<{ n: number }>(`SELECT count(*)::int AS n FROM public.${table}`)).rows[0].n;
    expect(await count("muscles")).toBe(25);
    expect(await count("equipment")).toBe(11);
    expect(await count("exercise_categories_catalog")).toBe(5);
    const { rows } = await db.query<{ g: string }>("SELECT DISTINCT filter_group AS g FROM public.muscles WHERE filter_group IS NOT NULL");
    expect(rows.map((r) => r.g).sort()).toEqual([
      "Abdomen", "Antebrazos", "Bíceps", "Cuádriceps", "Espalda", "Gemelos", "Glúteos", "Hombros", "Isquiotibiales", "Pecho", "Tríceps",
    ].sort());
    await expect(db.exec("INSERT INTO public.muscles (slug, name) VALUES ('x', 'X')")).rejects.toThrow();
  });

  it("músculos, equipo, relaciones y medios: el admin los gestiona y el usuario solo ve lo aprobado", async () => {
    await as(ADMIN);
    await db.exec(`
      INSERT INTO public.exercise_muscles (exercise_id, muscle_id, role)
        SELECT '${PRESS}', id, CASE slug WHEN 'pectoral' THEN 'primary' ELSE 'secondary' END FROM public.muscles WHERE slug IN ('pectoral', 'triceps');
      INSERT INTO public.exercise_equipment (exercise_id, equipment_id) SELECT '${PRESS}', id FROM public.equipment WHERE slug = 'barra';
      INSERT INTO public.exercise_relations (exercise_id, related_id, kind) VALUES ('${PRESS}', '${PRESS_DUP}', 'variant');
      INSERT INTO public.exercise_media (exercise_id, kind, url, status) VALUES
        ('${PRESS}', 'loop', 'https://x/press.mp4', 'approved'),
        ('${PRESS}', 'image', 'https://wger.de/press.png', 'pending');
    `);
    await expect(db.exec(`INSERT INTO public.exercise_relations VALUES ('${PRESS}', '${PRESS}', 'alternative')`)).rejects.toThrow();
    await as(ANA);
    const muscles = await db.query<{ slug: string; role: string }>(
      `SELECT m.slug, em.role FROM public.exercise_muscles em JOIN public.muscles m ON m.id = em.muscle_id WHERE em.exercise_id = '${PRESS}' ORDER BY m.slug`);
    expect(muscles.rows).toEqual([{ slug: "pectoral", role: "primary" }, { slug: "triceps", role: "secondary" }]);
    const media = await db.query<{ url: string }>(`SELECT url FROM public.exercise_media WHERE exercise_id = '${PRESS}'`);
    expect(media.rows).toEqual([{ url: "https://x/press.mp4" }]);
    await expect(db.exec(`INSERT INTO public.exercise_media (exercise_id, kind, url) VALUES ('${PRESS}', 'image', 'https://x/z.png')`)).rejects.toThrow();
  });

  it("favoritos y recientes: cada usuario solo ve y escribe los suyos", async () => {
    await as(ANA);
    await db.exec(`INSERT INTO public.exercise_favorites (user_id, exercise_id) VALUES ('${ANA}', '${PRESS}')`);
    await db.exec(`INSERT INTO public.exercise_recent (user_id, exercise_id) VALUES ('${ANA}', '${PRESS}')
                   ON CONFLICT (user_id, exercise_id) DO UPDATE SET viewed_at = now()`);
    await expect(db.exec(`INSERT INTO public.exercise_favorites (user_id, exercise_id) VALUES ('${BEA}', '${PRESS}')`)).rejects.toThrow();
    await as(BEA);
    expect((await db.query("SELECT * FROM public.exercise_favorites")).rows).toEqual([]);
    expect((await db.query("SELECT * FROM public.exercise_recent")).rows).toEqual([]);
    await as(ANA);
    expect((await db.query<{ exercise_id: string }>("SELECT exercise_id FROM public.exercise_favorites")).rows).toEqual([{ exercise_id: PRESS }]);
  });
});
