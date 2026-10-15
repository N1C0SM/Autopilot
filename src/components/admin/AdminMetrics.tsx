import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { RefreshCw, Trash2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { hapticTap, hapticNotify } from "@/lib/native";
import { toast } from "sonner";
import { AreaChart, Area, XAxis, Tooltip, ResponsiveContainer } from "recharts";
import type { Profile } from "@/pages/Admin";
import type { ConsumerPlan } from "@/lib/entitlements";
import { clientActivity, countCompletedWorkSets, MONTHLY_ESTIMATE_NOTE, summarizeClientPlans } from "@/lib/adminMetrics";
import { PLAN_PRICE } from "@/config/tiers";
import { toLocalDateString } from "@/lib/localDates";

interface MetricsData extends ReturnType<typeof summarizeClientPlans> {
  active7: number;
  active30: number;
  workoutsToday: number;
  workouts7: number;
  sets7: number;
  prs7: number;
  onboarded: number;
  newUsers7: number;
  daily: { d: string; entrenos: number; registros: number }[];
  emailsFailed: number;
}

const fmtEur = (n: number) => n.toLocaleString("es-ES") + " €";
const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 100) : 0);

const AdminMetrics = ({ users, onRefresh }: { users: Profile[]; onRefresh: () => Promise<Profile[]> }) => {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<MetricsData | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [resetting, setResetting] = useState(false);

  const load = useCallback(async (profiles = users) => {
    setLoading(true);
    try {
      const daysAgo = (days: number) => { const date = new Date(); date.setDate(date.getDate() - days); return date; };
      const today = toLocalDateString();
      const d7 = toLocalDateString(daysAgo(6));
      const d30 = toLocalDateString(daysAgo(29));
      const results = await Promise.all([
        supabase.from("day_completions").select("user_id, completed_at").gte("completed_at", d30),
        supabase.from("workout_logs").select("user_id, sets_completed, logged_at").gte("logged_at", d7),
        supabase.from("personal_records").select("user_id, id").gte("achieved_at", d7),
        supabase.from("email_send_log").select("status, message_id, created_at").gte("created_at", daysAgo(30).toISOString()),
      ]);
      for (const result of results) { if (result.error) throw result.error; }
      const [completionResult, logResult, prResult, emailResult] = results;
      const comps = clientActivity(completionResult.data || [], profiles);
      const logs = clientActivity(logResult.data || [], profiles);
      const prs = clientActivity(prResult.data || [], profiles);
      const summary = summarizeClientPlans(profiles);
      const active7 = new Set(comps.filter((c) => c.completed_at >= d7).map((c) => c.user_id)).size;
      const active30 = new Set(comps.map((c) => c.user_id)).size;
      const workoutsToday = comps.filter((c) => c.completed_at === today).length;
      const workouts7 = comps.filter((c) => c.completed_at >= d7).length;
      const sets7 = logs.reduce((sum, log) => sum + countCompletedWorkSets(log.sets_completed), 0);
      const daily: MetricsData["daily"] = [];
      for (let i = 29; i >= 0; i--) {
        const k = toLocalDateString(daysAgo(i));
        daily.push({
          d: k.slice(8),
          entrenos: comps.filter((c) => c.completed_at === k).length,
          registros: profiles.filter((p) => toLocalDateString(new Date(p.created_at)) === k).length,
        });
      }
      const emailMap = new Map<string, NonNullable<typeof emailResult.data>[number]>();
      (emailResult.data || []).forEach((e) => {
        if (!e.message_id) return;
        const prev = emailMap.get(e.message_id);
        if (!prev || e.created_at > prev.created_at) emailMap.set(e.message_id, e);
      });
      const emailsFailed = [...emailMap.values()].filter((e) => e.status === "dlq" || e.status === "failed").length;
      setData({
        ...summary, active7, active30, workoutsToday, workouts7, sets7,
        prs7: prs.length,
        onboarded: profiles.filter((p) => p.plan_status === "plan_ready").length,
        newUsers7: profiles.filter((p) => toLocalDateString(new Date(p.created_at)) >= d7).length,
        daily, emailsFailed,
      });
      setLoadError(false);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, [users]);

  useEffect(() => { void load(); }, [load]);

  const refresh = async () => {
    setLoading(true);
    try { await load(await onRefresh()); } catch {
      toast.error("No se pudieron actualizar las métricas");
      setLoadError(true);
      setLoading(false);
    }
  };

  const resetMetrics = async () => {
    if (!confirm("¿Resetear TODAS las métricas a 0? Se borran scans, leads, logs de emails, entrenos, pesos, PRs, fotos, chat, notificaciones y recordatorios. Las cuentas NO se borran. Irreversible.")) return;
    setResetting(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-reset-metrics");
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success("Métricas reseteadas");
      await load();
    } catch (error) {
      toast.error("Error al resetear: " + (error instanceof Error ? error.message : String(error)));
    } finally {
      setResetting(false);
    }
  };

  if (!loading && !data && loadError) {
    return <div className="space-y-3 py-12 text-center"><p className="type-body">No se pudieron cargar las métricas.</p><Button variant="tinted" onClick={refresh}>Reintentar</Button></div>;
  }
  if (loading || !data) {
    return <div className="flex items-center justify-center py-20"><Spinner size="lg" /></div>;
  }

  const kpis = [
    { label: "Estimación mensual", value: fmtEur(data.estimatedMonthly), hint: `${fmtEur(data.estimatedPerPlan)} por plan activo` },
    { label: "Plus y Coach activos", value: data.activePlans, hint: `${pct(data.activePlans, data.total)}% del total` },
    { label: "Clientes", value: data.total, hint: `+${data.newUsers7} esta semana` },
    { label: "Activos 7 días", value: `${pct(data.active7, data.total)}%`, hint: `${data.active7} entrenando` },
  ];

  const plans: { key: ConsumerPlan; name: string; price: string; tone: string }[] = [
    { key: "free", name: "Free", price: "0 €", tone: "bg-muted-foreground/40" },
    { key: "plus", name: "Plus", price: fmtEur(PLAN_PRICE.plus), tone: "bg-primary/60" },
    { key: "coach", name: "Coach", price: fmtEur(PLAN_PRICE.coach), tone: "bg-primary" },
  ];

  const activity = [
    { label: "Entrenos hoy", value: data.workoutsToday },
    { label: "Entrenos 7 días", value: data.workouts7 },
    { label: "Series 7 días", value: data.sets7 },
    { label: "Récords 7 días", value: data.prs7 },
  ];

  const funnel = [
    { label: "Registrados", value: data.total },
    { label: "Plan listo", value: data.onboarded },
    { label: "Activos 30 días", value: data.active30 },
    { label: "Plus y Coach", value: data.activePlans },
  ];

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex items-center justify-between gap-3">
        <h2 className="type-title2">Métricas</h2>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" onClick={() => { void hapticTap(); void refresh(); }} aria-label="Actualizar">
            <RefreshCw className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => { void hapticNotify("warning"); void resetMetrics(); }} disabled={resetting} aria-label="Resetear métricas" className="text-muted-foreground hover:text-destructive">
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {loadError && <p role="alert" className="type-footnote text-destructive">No se pudieron actualizar los datos. Se muestra la última carga correcta.</p>}
      <p className="type-footnote text-muted-foreground">{MONTHLY_ESTIMATE_NOTE}</p>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {kpis.map((k) => (
          <Tile key={k.label}>
            <Label>{k.label}</Label>
            <div className="mt-2 font-rounded text-3xl font-bold tabular-nums">{k.value}</div>
            <div className="mt-1 type-footnote text-muted-foreground">{k.hint}</div>
          </Tile>
        ))}
      </div>

      <div className="grid gap-3 sm:gap-4 lg:grid-cols-2">
        <Tile>
          <Label>Clientes por plan</Label>
          <div className="mt-4 space-y-4">
            {plans.map((p) => {
              const c = data.counts[p.key];
              const w = pct(c, data.total);
              return (
                <div key={p.key}>
                  <div className="flex items-baseline justify-between type-subhead">
                    <span className="font-medium">{p.name} <span className="type-footnote text-muted-foreground">· {p.price}</span></span>
                    <span className="tabular-nums"><b>{c}</b> <span className="type-footnote text-muted-foreground">{w}%</span></span>
                  </div>
                  <div className="mt-1.5 h-1.5 rounded-full bg-secondary overflow-hidden">
                    <div className={`h-full rounded-full ${p.tone} transition-[width] duration-700`} style={{ width: `${w}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </Tile>

        <Tile>
          <Label>Actividad</Label>
          <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-5">
            {activity.map((a) => (
              <div key={a.label}>
                <div className="font-rounded text-2xl font-bold tabular-nums">{a.value}</div>
                <div className="type-footnote text-muted-foreground">{a.label}</div>
              </div>
            ))}
          </div>
        </Tile>

        <Tile>
          <Label>Embudo</Label>
          <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-4">
            {funnel.map((f) => (
              <div key={f.label}>
                <div className="font-rounded text-xl font-bold tabular-nums">{f.value}</div>
                <div className="type-footnote text-muted-foreground">{f.label}</div>
                <div className="mt-2 h-1 rounded-full bg-secondary overflow-hidden">
                  <div className="h-full bg-primary rounded-full" style={{ width: `${pct(f.value, data.total)}%` }} />
                </div>
              </div>
            ))}
          </div>
        </Tile>

        <Tile>
          <Label>Últimos 30 días · entrenos</Label>
          <div className="mt-3 h-32">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.daily} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
                <XAxis dataKey="d" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} interval={6} />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", borderRadius: 12, fontSize: 12 }} />
                <Area type="monotone" dataKey="entrenos" name="Entrenos" stroke="hsl(var(--primary))" strokeWidth={2} fill="hsl(var(--primary))" fillOpacity={0.15} />
                <Area type="monotone" dataKey="registros" name="Registros" stroke="hsl(var(--muted-foreground))" strokeWidth={1.5} fill="transparent" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Tile>
      </div>

      {data.emailsFailed > 0 && (
        <div className="rounded-2xl bg-destructive/10 p-4 flex items-center gap-3 type-subhead">
          <AlertCircle className="w-4 h-4 text-destructive shrink-0" />
          {data.emailsFailed} emails fallidos en 30 días.
        </div>
      )}
    </div>
  );
};

function Tile({ children }: { children: React.ReactNode }) {
  return <div className="rounded-2xl bg-card p-4 sm:p-5">{children}</div>;
}

function Label({ children }: { children: React.ReactNode }) {
  return <div className="type-footnote text-muted-foreground">{children}</div>;
}

export default AdminMetrics;
