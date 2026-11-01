import { useCallback, useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/shared/integrations/supabase/client";
import { RefreshCw, Trash2, AlertCircle, BarChart3 } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { Spinner } from "@/shared/components/ui/spinner";
import { EmptyState } from "@/shared/components/ui/empty-state";
import { SectionHeader } from "@/shared/components/ui/section-header";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/shared/components/ui/alert-dialog";
import { hapticTap, hapticNotify } from "@/shared/lib/native";
import { toast } from "sonner";
import { cn } from "@/shared/lib/utils";
import { AreaChart, Area, XAxis, Tooltip, ResponsiveContainer } from "recharts";
import type { Profile } from "@/app/pages/Admin";
import type { ConsumerPlan } from "@/shared/lib/entitlements";
import { clientActivity, countCompletedWorkSets, MONTHLY_ESTIMATE_NOTE, summarizeClientPlans } from "@/shared/lib/adminMetrics";
import { PLAN_PRICE } from "@/shared/config/tiers";
import { toLocalDateString } from "@/shared/lib/localDates";

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
  const [confirmingReset, setConfirmingReset] = useState(false);

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
    return (
      <EmptyState
        icon={AlertCircle}
        title="Métricas no disponibles"
        description="No se pudieron cargar las métricas."
        action={<Button size="lg" onClick={() => { void hapticTap(); void refresh(); }}>Reintentar</Button>}
      />
    );
  }
  if (loading || !data) {
    return <div className="flex items-center justify-center py-20"><Spinner size="lg" /></div>;
  }

  const plans: { key: ConsumerPlan; name: string; price: string; tone: string }[] = [
    { key: "free", name: "Free", price: "0 €", tone: "bg-muted-foreground" },
    { key: "plus", name: "Plus", price: fmtEur(PLAN_PRICE.plus), tone: "bg-foreground" },
    { key: "coach", name: "Coach", price: fmtEur(PLAN_PRICE.coach), tone: "bg-primary" },
  ];

  const activity = [
    { label: "Entrenos hoy", value: data.workoutsToday },
    { label: "Entrenos 7 días", value: data.workouts7 },
    { label: "Series 7 días", value: data.sets7 },
    { label: "Récords 7 días", value: data.prs7 },
  ];

  const hasDailyActivity = data.daily.some((day) => day.entrenos > 0 || day.registros > 0);

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <p className="type-subhead text-muted-foreground">
            Cómo va el negocio: planes, ingresos y actividad.
          </p>
          <div className="-mr-3 flex shrink-0 items-center">
            <Button variant="ghost" size="icon" onClick={() => { void hapticTap(); void refresh(); }} aria-label="Actualizar" className="text-primary [&_svg]:size-5">
              <RefreshCw />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => { void hapticNotify("warning"); setConfirmingReset(true); }}
              disabled={resetting}
              aria-label="Resetear métricas"
              className="text-destructive [&_svg]:size-5"
            >
              <Trash2 />
            </Button>
          </div>
        </div>
        {loadError && <p role="alert" className="type-footnote text-destructive">No se pudieron actualizar los datos. Se muestra la última carga correcta.</p>}
      </div>

      <section aria-label="Resumen" className="space-y-3">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
          <Kpi label="Estimación mensual" value={fmtEur(data.estimatedMonthly)} hint={`${fmtEur(data.estimatedPerPlan)} por plan`} accent />
          <Kpi label="Plus y Coach" value={data.activePlans} hint={`${pct(data.activePlans, data.total)}% del total`} />
          <Kpi label="Clientes" value={data.total} hint={`+${data.newUsers7} esta semana`} />
          <Kpi label="Activos 7 días" value={`${pct(data.active7, data.total)}%`} hint={`${data.active7} entrenando`} />
        </div>
        <p className="px-1 type-footnote text-muted-foreground">{MONTHLY_ESTIMATE_NOTE}</p>
      </section>

      {data.emailsFailed > 0 && (
        <Card className="flex items-start gap-4">
          <AlertCircle className="mt-0.5 h-7 w-7 shrink-0 text-destructive" strokeWidth={1.75} aria-hidden="true" />
          <div className="min-w-0">
            <p className="type-headline">{data.emailsFailed} emails fallidos</p>
            <p className="mt-1 type-subhead text-muted-foreground">En los últimos 30 días.</p>
          </div>
        </Card>
      )}

      <div className="grid gap-3 lg:grid-cols-2 lg:gap-4">
        <Card>
          <SectionHeader title="Clientes por plan" size="sm" className="mb-4" />
          <BarList
            rows={plans.map((p) => ({
              label: p.name,
              detail: p.price,
              value: data.counts[p.key],
              percent: pct(data.counts[p.key], data.total),
              tone: p.tone,
            }))}
          />
        </Card>

        <Card>
          <SectionHeader title="Actividad" size="sm" className="mb-4" />
          <dl className="grid grid-cols-2 gap-x-4 gap-y-5">
            {activity.map((a) => (
              <div key={a.label} className="min-w-0">
                <dt className="truncate type-footnote text-muted-foreground">{a.label}</dt>
                <dd className="mt-0.5 font-rounded text-[28px] font-bold leading-[34px] tabular-nums">{a.value}</dd>
              </div>
            ))}
          </dl>
        </Card>

        <Card>
          <SectionHeader
            title="Últimos 30 días"
            size="sm"
            hint={
              <span className="inline-flex gap-4">
                <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-primary" aria-hidden="true" />Entrenos</span>
                <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-muted-foreground" aria-hidden="true" />Registros</span>
              </span>
            }
            className="mb-3"
          />
          {hasDailyActivity ? (
            <div className="h-40">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data.daily} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
                  <XAxis dataKey="d" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} interval={6} />
                  <Tooltip
                    cursor={{ stroke: "hsl(var(--border))" }}
                    contentStyle={{ background: "hsl(var(--popover))", border: "none", borderRadius: 12, fontSize: 13 }}
                    labelStyle={{ color: "hsl(var(--muted-foreground))" }}
                  />
                  <Area type="monotone" dataKey="entrenos" name="Entrenos" stroke="hsl(var(--primary))" strokeWidth={2} fill="hsl(var(--primary))" fillOpacity={0.15} />
                  <Area type="monotone" dataKey="registros" name="Registros" stroke="hsl(var(--muted-foreground))" strokeWidth={1.5} fill="transparent" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <EmptyState
              icon={BarChart3}
              title="Sin actividad"
              description="No hay entrenos ni registros en los últimos 30 días."
              className="py-8"
            />
          )}
        </Card>
      </div>

      <AlertDialog open={confirmingReset} onOpenChange={setConfirmingReset}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Resetear todas las métricas?</AlertDialogTitle>
            <AlertDialogDescription>
              Se borran scans, leads, logs de emails, entrenos, pesos, PRs, fotos, chat, notificaciones y recordatorios. Las cuentas no se borran. No se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction destructive onClick={() => { void resetMetrics(); }}>
              Resetear
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

/** Tarjeta del sistema: sin borde, 22 px. */
function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <section className={cn("rounded-media bg-card p-5", className)}>{children}</section>;
}

/** Cifra clave en tarjeta; `accent` la marca en dorado (una por pantalla). */
function Kpi({ label, value, hint, accent }: { label: string; value: ReactNode; hint?: string; accent?: boolean }) {
  return (
    <div className="flex min-w-0 flex-col rounded-media bg-card p-4 lg:p-5">
      <p className="truncate type-footnote text-muted-foreground">{label}</p>
      <p className={cn("mt-1 truncate font-rounded text-[28px] font-bold leading-[34px] tabular-nums lg:text-[34px] lg:leading-[41px]", accent && "text-primary")}>{value}</p>
      {hint ? <p className="mt-0.5 truncate type-footnote text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

interface BarRow {
  label: string;
  detail?: string;
  value: number;
  percent: number;
  tone?: string;
}

/** Filas con cifra, porcentaje y barra fina: sin cajas, directamente sobre el fondo. */
function BarList({ rows }: { rows: BarRow[] }) {
  return (
    <ul className="space-y-4">
      {rows.map((row) => (
        <li key={row.label}>
          <div className="flex items-baseline justify-between gap-3">
            <span className="min-w-0 truncate type-body">
              {row.label}
              {row.detail ? <span className="type-footnote text-muted-foreground"> · {row.detail}</span> : null}
            </span>
            <span className="shrink-0 tabular-nums">
              <span className="type-headline">{row.value}</span>
              <span className="ml-1.5 type-footnote text-muted-foreground">{row.percent}%</span>
            </span>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-secondary">
            <div className={cn("h-full rounded-full", row.tone ?? "bg-primary")} style={{ width: `${row.percent}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

export default AdminMetrics;
