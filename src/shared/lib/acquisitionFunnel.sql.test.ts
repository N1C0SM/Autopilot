// @vitest-environment node
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";

const MIGRATION = resolve(__dirname, "../../../supabase/migrations/20261029180000_captacion_atribucion.sql");

const ADMIN = "00000000-0000-0000-0000-00000000000a";
const TESTER = "00000000-0000-0000-0000-00000000000b";
const TIKTOK_ACTIVE = "00000000-0000-0000-0000-000000000001";
const TIKTOK_IDLE = "00000000-0000-0000-0000-000000000002";
const INSTAGRAM_PLUS = "00000000-0000-0000-0000-000000000003";
const DIRECT_RECENT = "00000000-0000-0000-0000-000000000004";
const OLD_USER = "00000000-0000-0000-0000-000000000005";

let db: PGlite;

const as = async (userId: string | null) => {
  await db.exec("RESET ROLE");
  await db.query("SELECT set_config('request.jwt.claim.sub', $1, false)", [userId ?? ""]);
  await db.exec(userId ? "SET ROLE authenticated" : "SET ROLE anon");
};

type Funnel = { tracking_since: string | null; channels: { channel: string; visits: number; scans: number; signups: number; week2_eligible: number; active_week2: number; plus: number }[] };
const funnel = async (from: string, to: string) => {
  const { rows } = await db.query<{ f: Funnel }>("SELECT public.admin_acquisition_funnel($1::date, $2::date) AS f", [from, to]);
  return Object.fromEntries(rows[0].f.channels.map((c) => [c.channel, c]));
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
    CREATE TABLE public.profiles (user_id uuid PRIMARY KEY, created_at timestamptz NOT NULL DEFAULT now(), payment_status text DEFAULT 'unpaid',
      subscription_tier text, subscription_status text, subscription_end timestamptz, stripe_payment_id text);
    CREATE TABLE public.metrics_excluded_users (user_id uuid PRIMARY KEY);
    CREATE TABLE public.day_completions (user_id uuid, completed_at date);
    GRANT USAGE ON SCHEMA public, auth TO anon, authenticated;
  `);
  await db.exec(readFileSync(MIGRATION, "utf8"));

  // Altas: tres con metadatos (trigger), una sin origen, una de prueba y un admin.
  await db.exec(`
    INSERT INTO auth.users (id, raw_user_meta_data) VALUES
      ('${TIKTOK_ACTIVE}', '{"acq_source":"TikTok","acq_medium":"bio","acq_landing":"/"}'),
      ('${TIKTOK_IDLE}', '{"acq_source":"tiktok","acq_landing":"/scan"}'),
      ('${INSTAGRAM_PLUS}', '{"acq_source":"l.instagram.com","acq_medium":"referral","acq_landing":"/"}'),
      ('${DIRECT_RECENT}', '{"display_name":"x"}'),
      ('${OLD_USER}', '{}'),
      ('${TESTER}', '{"acq_source":"tiktok","acq_landing":"/"}'),
      ('${ADMIN}', '{}');
    INSERT INTO public.user_roles VALUES ('${ADMIN}', 'admin');
    INSERT INTO public.metrics_excluded_users VALUES ('${TESTER}');
    INSERT INTO public.profiles (user_id, created_at, payment_status, subscription_tier, subscription_status) VALUES
      ('${TIKTOK_ACTIVE}', '2026-09-01 10:00+02', 'unpaid', 'free', NULL),
      ('${TIKTOK_IDLE}', '2026-09-02 10:00+02', 'unpaid', 'free', NULL),
      ('${INSTAGRAM_PLUS}', '2026-09-03 10:00+02', 'paid', 'training', 'active'),
      ('${DIRECT_RECENT}', now(), 'unpaid', 'free', NULL),
      ('${OLD_USER}', '2026-01-01 10:00+01', 'unpaid', 'free', NULL),
      ('${TESTER}', '2026-09-01 10:00+02', 'paid', 'training', 'active'),
      ('${ADMIN}', '2026-09-01 10:00+02', 'unpaid', 'free', NULL);
    -- Día 1 = alta. Activo: entreno el día 10. Inactivo: solo el día 3 y el 15.
    INSERT INTO public.day_completions VALUES
      ('${TIKTOK_ACTIVE}', '2026-09-10'),
      ('${TIKTOK_IDLE}', '2026-09-04'), ('${TIKTOK_IDLE}', '2026-09-17'),
      ('${TESTER}', '2026-09-10');
  `);
});

afterAll(async () => { await db.close(); });

describe("captación: guardado de la atribución", () => {
  it("guarda el origen del alta desde los metadatos, limpio y en minúsculas", async () => {
    await db.exec("RESET ROLE");
    const { rows } = await db.query<{ user_id: string; source: string; medium: string | null; landing_path: string }>(
      "SELECT user_id, source, medium, landing_path FROM public.user_acquisition ORDER BY user_id");
    expect(rows.find((r) => r.user_id === TIKTOK_ACTIVE)).toMatchObject({ source: "tiktok", medium: "bio", landing_path: "/" });
    expect(rows.some((r) => r.user_id === DIRECT_RECENT)).toBe(false);
  });

  it("el usuario solo reclama su propia fila, una vez y solo si la cuenta es reciente", async () => {
    await as(DIRECT_RECENT);
    await db.query("SELECT public.claim_acquisition('instagram', 'bio', NULL, '/scan')");
    await db.query("SELECT public.claim_acquisition('tiktok', 'bio', NULL, '/')");
    await as(OLD_USER);
    await db.query("SELECT public.claim_acquisition('tiktok', 'bio', NULL, '/')");
    await as(TIKTOK_ACTIVE);
    await db.query("SELECT public.claim_acquisition('youtube', 'bio', NULL, '/')");
    await db.exec("RESET ROLE");
    const { rows } = await db.query<{ user_id: string; source: string }>("SELECT user_id, source FROM public.user_acquisition");
    const by = Object.fromEntries(rows.map((r) => [r.user_id, r.source]));
    expect(by[DIRECT_RECENT]).toBe("instagram");
    expect(by[OLD_USER]).toBeUndefined();
    expect(by[TIKTOK_ACTIVE]).toBe("tiktok");
  });

  it("nadie que no sea admin escribe ni lee las tablas directamente", async () => {
    await as(TIKTOK_ACTIVE);
    await expect(db.query(`INSERT INTO public.user_acquisition (user_id, source) VALUES ('${TIKTOK_ACTIVE}', 'x')`)).rejects.toThrow();
    const { rows } = await db.query("SELECT * FROM public.user_acquisition");
    expect(rows).toHaveLength(0);
    await as(null);
    await expect(db.query("SELECT * FROM public.acquisition_events")).rejects.toThrow();
  });

  it("los visitantes sin cuenta registran visitas y scans sin user_id", async () => {
    await as(null);
    await db.query("SELECT public.record_acquisition_event('visit', 'tiktok', 'bio', NULL)");
    await db.query("SELECT public.record_acquisition_event('visit', 'TikTok', NULL, NULL)");
    await db.query("SELECT public.record_acquisition_event('scan', 'tiktok', 'bio', NULL)");
    await db.query("SELECT public.record_acquisition_event('visit', NULL, NULL, NULL)");
    await expect(db.query("SELECT public.record_acquisition_event('signup', 'tiktok', NULL, NULL)")).rejects.toThrow();
    // Un scan con sesión toma la red del alta, no la de este navegador.
    await as(INSTAGRAM_PLUS);
    await db.query("SELECT public.record_acquisition_event('scan', NULL, NULL, NULL)");
    // Los scans de cuentas de prueba no cuentan.
    await as(TESTER);
    await db.query("SELECT public.record_acquisition_event('scan', 'tiktok', NULL, NULL)");
    await db.exec("RESET ROLE");
    const { rows } = await db.query<{ n: number }>("SELECT count(*)::int AS n FROM public.acquisition_events WHERE user_id IS NULL");
    expect(rows[0].n).toBe(4);
  });
});

describe("captación: admin_acquisition_funnel", () => {
  it("solo lo puede llamar un admin", async () => {
    await as(TIKTOK_ACTIVE);
    await expect(funnel("2026-09-01", "2026-09-30")).rejects.toThrow(/admin only/);
  });

  it("agrega altas, 2ª semana y Plus por red, sin cuentas de prueba ni staff", async () => {
    await as(ADMIN);
    const sept = await funnel("2026-09-01", "2026-09-30");
    expect(sept.tiktok).toMatchObject({ signups: 2, week2_eligible: 2, active_week2: 1, plus: 0 });
    expect(sept.instagram).toMatchObject({ signups: 1, plus: 1, active_week2: 0 });
    expect(sept.directo.signups).toBe(0);
    expect(Object.keys(sept)).toEqual(["tiktok", "instagram", "youtube", "threads", "facebook", "otros", "directo"]);
  });

  it("cuenta visitas y scans del rango y no da por cumplida la 2ª semana de altas recientes", async () => {
    await as(ADMIN);
    const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Madrid" }).format(new Date());
    const now = await funnel(today, today);
    expect(now.tiktok).toMatchObject({ visits: 2, scans: 1 });
    expect(now.directo.visits).toBe(1);
    expect(now.instagram).toMatchObject({ scans: 1, signups: 1, week2_eligible: 0 });
  });
});
