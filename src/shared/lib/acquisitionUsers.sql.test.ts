// @vitest-environment node
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";

const MIGRATIONS = [
  "20261029180000_captacion_atribucion.sql",
  "20261029190000_captacion_por_usuario.sql",
  "20261029200000_captacion_reinicio_y_publicaciones.sql",
].map((f) => resolve(__dirname, "../../../supabase/migrations", f));

const ADMIN = "00000000-0000-0000-0000-00000000000a";
const TESTER = "00000000-0000-0000-0000-00000000000b";
const ONLY_ACCOUNT = "00000000-0000-0000-0000-000000000001";
const SCANNED = "00000000-0000-0000-0000-000000000002";
const TRAINED = "00000000-0000-0000-0000-000000000003";
const ACTIVE = "00000000-0000-0000-0000-000000000004";
const PLUS = "00000000-0000-0000-0000-000000000005";

let db: PGlite;

const as = async (userId: string | null) => {
  await db.exec("RESET ROLE");
  await db.query("SELECT set_config('request.jwt.claim.sub', $1, false)", [userId ?? ""]);
  await db.exec(userId ? "SET ROLE authenticated" : "SET ROLE anon");
};

type Row = { user_id: string; email: string; channel: string; source: string | null; landing_path: string | null; stage: string; first_workout: string | null };
const users = async (channel: string | null = null, stage: string | null = null) => {
  const { rows } = await db.query<{ r: { total: number; users: Row[] } }>(
    "SELECT public.admin_acquisition_users('2026-09-01'::date, '2026-09-30'::date, $1, $2) AS r", [channel, stage]);
  return rows[0].r;
};

beforeAll(async () => {
  db = new PGlite();
  await db.exec(`
    CREATE ROLE anon; CREATE ROLE authenticated;
    CREATE SCHEMA auth;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    CREATE TABLE auth.users (id uuid PRIMARY KEY, raw_user_meta_data jsonb);
    CREATE TYPE public.app_role AS ENUM ('admin', 'user', 'trainer');
    CREATE TABLE public.user_roles (user_id uuid, role public.app_role);
    CREATE FUNCTION public.has_role(_user_id uuid, _role public.app_role) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
      AS $$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role) $$;
    CREATE TABLE public.profiles (user_id uuid PRIMARY KEY, name text, email text, created_at timestamptz NOT NULL DEFAULT now(),
      payment_status text DEFAULT 'unpaid', subscription_tier text, subscription_status text, subscription_end timestamptz, stripe_payment_id text);
    CREATE TABLE public.metrics_excluded_users (user_id uuid PRIMARY KEY);
    CREATE TABLE public.day_completions (user_id uuid, completed_at date);
    CREATE TABLE public.scan_history (user_id uuid, created_at timestamptz DEFAULT now());
    GRANT USAGE ON SCHEMA public, auth TO anon, authenticated;
  `);
  for (const m of MIGRATIONS) await db.exec(readFileSync(m, "utf8"));

  await db.exec(`
    INSERT INTO auth.users (id, raw_user_meta_data) VALUES
      ('${ONLY_ACCOUNT}', '{"acq_source":"tiktok","acq_medium":"bio","acq_landing":"/scan"}'),
      ('${SCANNED}', '{"acq_source":"instagram","acq_landing":"/scan"}'),
      ('${TRAINED}', '{"acq_source":"tiktok","acq_landing":"/"}'),
      ('${ACTIVE}', '{"acq_source":"tiktok","acq_landing":"/"}'),
      ('${PLUS}', '{}'),
      ('${TESTER}', '{"acq_source":"tiktok","acq_landing":"/"}'),
      ('${ADMIN}', '{}');
    INSERT INTO public.user_roles VALUES ('${ADMIN}', 'admin');
    INSERT INTO public.metrics_excluded_users VALUES ('${TESTER}');
    INSERT INTO public.profiles (user_id, name, email, created_at, payment_status, subscription_tier, subscription_status) VALUES
      ('${ONLY_ACCOUNT}', 'Ana', 'ana@example.test', '2026-09-01 10:00+02', 'unpaid', 'free', NULL),
      ('${SCANNED}', 'Bea', 'bea@example.test', '2026-09-02 10:00+02', 'unpaid', 'free', NULL),
      ('${TRAINED}', 'Carlos', 'carlos@example.test', '2026-09-03 10:00+02', 'unpaid', 'free', NULL),
      ('${ACTIVE}', 'Dani', 'dani@example.test', '2026-09-04 10:00+02', 'unpaid', 'free', NULL),
      ('${PLUS}', 'Eva', 'eva@example.test', '2026-09-05 10:00+02', 'paid', 'training', 'active'),
      ('${TESTER}', 'Test', 'test@example.test', '2026-09-01 10:00+02', 'unpaid', 'free', NULL),
      ('${ADMIN}', 'Admin', 'admin@example.test', '2026-09-01 10:00+02', 'unpaid', 'free', NULL);
    INSERT INTO public.scan_history (user_id) VALUES ('${SCANNED}'), ('${TESTER}');
    -- Carlos entrena solo el día 2; Dani entrena el día 10 (2ª semana).
    INSERT INTO public.day_completions VALUES ('${TRAINED}', '2026-09-04'), ('${ACTIVE}', '2026-09-13'), ('${TESTER}', '2026-09-10');
  `);
});

afterAll(async () => { await db.close(); });

describe("captación por usuario", () => {
  it("solo la puede llamar un admin, y nadie lee el cohorte directamente", async () => {
    await as(ONLY_ACCOUNT);
    await expect(users()).rejects.toThrow(/admin only/);
    await expect(db.query("SELECT * FROM public.acquisition_cohort('2026-09-01', '2026-09-30')")).rejects.toThrow();
  });

  it("da a cada cuenta su red, su página de entrada y el paso en el que se quedó", async () => {
    await as(ADMIN);
    const r = await users();
    expect(r.total).toBe(5);
    const by = Object.fromEntries(r.users.map((u) => [u.email, u]));
    expect(by["ana@example.test"]).toMatchObject({ channel: "tiktok", landing_path: "/scan", stage: "cuenta" });
    expect(by["bea@example.test"]).toMatchObject({ channel: "instagram", stage: "scan" });
    expect(by["carlos@example.test"]).toMatchObject({ stage: "entreno", first_workout: "2026-09-04" });
    expect(by["dani@example.test"].stage).toBe("activo");
    expect(by["eva@example.test"]).toMatchObject({ channel: "directo", stage: "plus" });
    expect(by["test@example.test"]).toBeUndefined();
    expect(by["admin@example.test"]).toBeUndefined();
    // Las más recientes primero.
    expect(r.users[0].email).toBe("eva@example.test");
  });

  it("filtra por red y por paso", async () => {
    await as(ADMIN);
    expect((await users("tiktok")).total).toBe(3);
    expect((await users("tiktok", "cuenta")).users.map((u) => u.email)).toEqual(["ana@example.test"]);
  });

  it("el embudo por red cuenta ahora el primer entreno", async () => {
    await as(ADMIN);
    const { rows } = await db.query<{ f: { channels: { channel: string; signups: number; first_workout: number }[] } }>(
      "SELECT public.admin_acquisition_funnel('2026-09-01'::date, '2026-09-30'::date) AS f");
    const tiktok = rows[0].f.channels.find((c) => c.channel === "tiktok")!;
    expect(tiktok).toMatchObject({ signups: 3, first_workout: 2 });
  });

  it("solo un admin puede borrar las visitas y scans; las cuentas siguen", async () => {
    await as(null);
    await db.query("SELECT public.record_acquisition_event('visit', 'tiktok', 'bio', NULL)");
    await as(ONLY_ACCOUNT);
    await expect(db.query("SELECT public.admin_reset_acquisition_events()")).rejects.toThrow(/admin only/);
    await as(ADMIN);
    const { rows } = await db.query<{ n: number }>("SELECT public.admin_reset_acquisition_events() AS n");
    expect(rows[0].n).toBeGreaterThan(0);
    await db.exec("RESET ROLE");
    const left = await db.query<{ n: number }>("SELECT count(*)::int AS n FROM public.acquisition_events");
    expect(left.rows[0].n).toBe(0);
    await as(ADMIN);
    expect((await users()).total).toBe(5);
  });

  it("agrupa por publicación (red + medio + campaña)", async () => {
    await as(null);
    await db.query("SELECT public.record_acquisition_event('visit', 'tiktok', 'post', 'reel_scan')");
    await db.query("SELECT public.record_acquisition_event('visit', 'tiktok', 'post', 'reel_scan')");
    await db.query("SELECT public.record_acquisition_event('scan', 'tiktok', 'post', 'reel_scan')");
    await db.query("SELECT public.record_acquisition_event('visit', 'facebook', 'post', 'reel_pov')");
    await as(ONLY_ACCOUNT);
    await expect(db.query("SELECT public.admin_acquisition_campaigns(current_date, current_date)")).rejects.toThrow(/admin only/);
    await as(ADMIN);
    const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Madrid" }).format(new Date());
    const { rows } = await db.query<{ r: { channel: string; campaign: string | null; visits: number; scans: number }[] }>(
      "SELECT public.admin_acquisition_campaigns($1::date, $1::date) AS r", [today]);
    const scan = rows[0].r.find((x) => x.channel === "tiktok" && x.campaign === "reel_scan");
    expect(scan).toMatchObject({ visits: 2, scans: 1 });
    expect(rows[0].r.find((x) => x.channel === "facebook")?.campaign).toBe("reel_pov");
  });
});
