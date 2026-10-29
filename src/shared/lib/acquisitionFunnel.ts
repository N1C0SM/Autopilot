import { supabase } from "@/shared/integrations/supabase/client";
import { toLocalDateString } from "@/shared/lib/localDates";

/** Redes que mide Admin → Captación, en el orden en que se muestran (igual que en SQL). */
export const ACQUISITION_CHANNELS = ["tiktok", "instagram", "youtube", "threads", "facebook", "otros", "directo"] as const;
export type AcquisitionChannel = (typeof ACQUISITION_CHANNELS)[number];

export const CHANNEL_LABELS: Record<AcquisitionChannel, string> = {
  tiktok: "TikTok",
  instagram: "Instagram",
  youtube: "YouTube",
  threads: "Threads",
  facebook: "Facebook",
  otros: "Otras webs",
  directo: "Directo / sin origen",
};

export interface ChannelFunnel {
  channel: AcquisitionChannel;
  visits: number;
  scans: number;
  signups: number;
  firstWorkout: number;
  week2Eligible: number;
  activeWeek2: number;
  plus: number;
}

export interface AcquisitionFunnel {
  from: string;
  to: string;
  trackingSince: string | null;
  channels: ChannelFunnel[];
  total: Omit<ChannelFunnel, "channel">;
}

export type RangeKey = "7" | "30" | "90" | "all";
export const RANGE_OPTIONS: { key: RangeKey; label: string }[] = [
  { key: "7", label: "7 días" },
  { key: "30", label: "30 días" },
  { key: "90", label: "90 días" },
  { key: "all", label: "Todo" },
];

/** Fechas (locales, inclusivas) de un rango; «Todo» empieza antes del lanzamiento. */
export function rangeDates(key: RangeKey, now = new Date()): { from: string; to: string } {
  const to = toLocalDateString(now);
  if (key === "all") return { from: "2024-01-01", to };
  const start = new Date(now);
  start.setDate(start.getDate() - (Number(key) - 1));
  return { from: toLocalDateString(start), to };
}

const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : Number(v) || 0);

/** Convierte la respuesta de `admin_acquisition_funnel` en datos tipados con totales. */
export function parseAcquisitionFunnel(raw: unknown): AcquisitionFunnel {
  const data = (raw ?? {}) as { from?: string; to?: string; tracking_since?: string | null; channels?: Record<string, unknown>[] };
  const byChannel = new Map((data.channels ?? []).map((c) => [String(c.channel), c]));
  const channels: ChannelFunnel[] = ACQUISITION_CHANNELS.map((channel) => {
    const c = byChannel.get(channel) ?? {};
    return {
      channel,
      visits: num(c.visits),
      scans: num(c.scans),
      signups: num(c.signups),
      firstWorkout: num(c.first_workout),
      week2Eligible: num(c.week2_eligible),
      activeWeek2: num(c.active_week2),
      plus: num(c.plus),
    };
  });
  const total = channels.reduce(
    (acc, c) => ({
      visits: acc.visits + c.visits,
      scans: acc.scans + c.scans,
      signups: acc.signups + c.signups,
      firstWorkout: acc.firstWorkout + c.firstWorkout,
      week2Eligible: acc.week2Eligible + c.week2Eligible,
      activeWeek2: acc.activeWeek2 + c.activeWeek2,
      plus: acc.plus + c.plus,
    }),
    { visits: 0, scans: 0, signups: 0, firstWorkout: 0, week2Eligible: 0, activeWeek2: 0, plus: 0 },
  );
  return { from: data.from ?? "", to: data.to ?? "", trackingSince: data.tracking_since ?? null, channels, total };
}

/** Embudo agregado en la base de datos (solo admins). */
export async function fetchAcquisitionFunnel(range: { from: string; to: string }): Promise<AcquisitionFunnel> {
  // La función aún no está en los tipos generados.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any).rpc("admin_acquisition_funnel", { _from: range.from, _to: range.to });
  if (error) throw error;
  return parseAcquisitionFunnel(data);
}

/** Paso más avanzado que alcanzó una cuenta (mismo orden que `acquisition_stage` en SQL). */
export const ACQUISITION_STAGES = ["cuenta", "scan", "entreno", "activo", "plus"] as const;
export type AcquisitionStage = (typeof ACQUISITION_STAGES)[number];

export const STAGE_LABELS: Record<AcquisitionStage, string> = {
  cuenta: "Solo creó la cuenta",
  scan: "Hizo el scan",
  entreno: "Entrenó al menos una vez",
  activo: "Activo la 2ª semana",
  plus: "Plus",
};

export interface AcquisitionUser {
  userId: string;
  name: string | null;
  email: string | null;
  signupAt: string;
  channel: AcquisitionChannel;
  source: string | null;
  medium: string | null;
  campaign: string | null;
  landingPath: string | null;
  stage: AcquisitionStage;
  firstWorkout: string | null;
  lastWorkout: string | null;
}

export interface AcquisitionUsersPage {
  total: number;
  users: AcquisitionUser[];
}

const str = (v: unknown) => (typeof v === "string" && v ? v : null);
const asChannel = (v: unknown): AcquisitionChannel =>
  (ACQUISITION_CHANNELS as readonly string[]).includes(String(v)) ? (v as AcquisitionChannel) : "directo";
const asStage = (v: unknown): AcquisitionStage =>
  (ACQUISITION_STAGES as readonly string[]).includes(String(v)) ? (v as AcquisitionStage) : "cuenta";

/** Convierte la respuesta de `admin_acquisition_users`. */
export function parseAcquisitionUsers(raw: unknown): AcquisitionUsersPage {
  const data = (raw ?? {}) as { total?: unknown; users?: Record<string, unknown>[] };
  return {
    total: num(data.total),
    users: (data.users ?? []).map((u) => ({
      userId: String(u.user_id ?? ""),
      name: str(u.name),
      email: str(u.email),
      signupAt: String(u.signup_at ?? ""),
      channel: asChannel(u.channel),
      source: str(u.source),
      medium: str(u.medium),
      campaign: str(u.campaign),
      landingPath: str(u.landing_path),
      stage: asStage(u.stage),
      firstWorkout: str(u.first_workout),
      lastWorkout: str(u.last_workout),
    })),
  };
}

export const USERS_PAGE_SIZE = 50;

/** Cuentas del rango con su origen y el paso en el que se quedaron (solo admins). */
export async function fetchAcquisitionUsers(
  range: { from: string; to: string },
  filters: { channel?: AcquisitionChannel | null; stage?: AcquisitionStage | null; offset?: number } = {},
): Promise<AcquisitionUsersPage> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any).rpc("admin_acquisition_users", {
    _from: range.from,
    _to: range.to,
    _channel: filters.channel ?? null,
    _stage: filters.stage ?? null,
    _limit: USERS_PAGE_SIZE,
    _offset: filters.offset ?? 0,
  });
  if (error) throw error;
  return parseAcquisitionUsers(data);
}

/** Nombre legible de cada pieza publicada (utm_campaign); lo desconocido se muestra tal cual. */
export const CAMPAIGN_LABELS: Record<string, string> = {
  como_funciona: "Reel «Cómo funciona»",
  reel_scan: "Reel del scan",
  reel_pov: "Reel POV",
  carrusel_senales: "Carrusel «3 señales»",
  carrusel_scan: "Carrusel del scan",
  carrusel_plan: "Carrusel del plan",
  destacadas: "Historias / destacadas",
};

export const MEDIUM_LABELS: Record<string, string> = { bio: "Bio", post: "Publicación", story: "Historia", dm: "Mensaje", referral: "Enlace" };

export interface CampaignFunnel {
  channel: AcquisitionChannel;
  medium: string | null;
  campaign: string | null;
  visits: number;
  scans: number;
  signups: number;
  firstWorkout: number;
  activeWeek2: number;
  plus: number;
}

/** Convierte la respuesta de `admin_acquisition_campaigns`. */
export function parseAcquisitionCampaigns(raw: unknown): CampaignFunnel[] {
  return (Array.isArray(raw) ? raw : []).map((r: Record<string, unknown>) => ({
    channel: asChannel(r.channel),
    medium: str(r.medium),
    campaign: str(r.campaign),
    visits: num(r.visits),
    scans: num(r.scans),
    signups: num(r.signups),
    firstWorkout: num(r.first_workout),
    activeWeek2: num(r.active_week2),
    plus: num(r.plus),
  }));
}

/** Visitas, scans y embudo por publicación concreta (solo admins). */
export async function fetchAcquisitionCampaigns(range: { from: string; to: string }): Promise<CampaignFunnel[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any).rpc("admin_acquisition_campaigns", { _from: range.from, _to: range.to });
  if (error) throw error;
  return parseAcquisitionCampaigns(data);
}
