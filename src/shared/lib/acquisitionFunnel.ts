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
      week2Eligible: acc.week2Eligible + c.week2Eligible,
      activeWeek2: acc.activeWeek2 + c.activeWeek2,
      plus: acc.plus + c.plus,
    }),
    { visits: 0, scans: 0, signups: 0, week2Eligible: 0, activeWeek2: 0, plus: 0 },
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
