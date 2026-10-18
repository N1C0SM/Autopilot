import { WorkoutReview } from "@/components/dashboard/WorkoutReview";
import { useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Plane, ChevronDown, AlertTriangle, TrendingUp } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { EmptyState } from "@/components/ui/empty-state";
import { ListGroup, ListRow } from "@/components/ui/list";
import { SectionHeader } from "@/components/ui/section-header";
import { hapticSelection, hapticTap } from "@/lib/native";
import { cn } from "@/lib/utils";
import { skipAutoFocusOnTouch } from "@/components/admin-user-detail/skipAutoFocusOnTouch";

interface Props {
  userId: string;
  travelModeUntil?: string | null;
  travelEquipment?: string | null;
}

interface PR {
  id: string;
  exercise_name: string;
  weight: number;
  reps: number;
  estimated_1rm: number | null;
  achieved_at: string;
}

interface RPEPoint {
  date: string;
  rpe: number;
  label: string;
}

interface WorkoutLog {
  id: string;
  day_label: string;
  exercise_name: string;
  logged_at: string;
  rpe: number | null;
  sets_completed: Array<{ reps: number; weight: string; done: boolean }>;
}

interface InitialTests {
  pullups?: number;
  pushups?: number;
  squats?: number;
  plank_seconds?: number;
}

const TEST_LABELS: Record<keyof InitialTests, { label: string; unit: string }> = {
  pullups: { label: "Dominadas máx.", unit: "reps" },
  pushups: { label: "Flexiones máx.", unit: "reps" },
  squats: { label: "Sentadillas máx.", unit: "reps" },
  plank_seconds: { label: "Plancha", unit: "s" },
};

const UserProgressPanel = ({ userId, travelModeUntil, travelEquipment }: Props) => {
  const [loading, setLoading] = useState(true);
  const [tests, setTests] = useState<InitialTests | null>(null);
  const [prs, setPRs] = useState<PR[]>([]);
  const [rpeData, setRpeData] = useState<RPEPoint[]>([]);
  const [completedSessionKeys, setCompletedSessionKeys] = useState<string[]>([]);
  const [workoutLogs, setWorkoutLogs] = useState<WorkoutLog[]>([]);
  const [expandedSession, setExpandedSession] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [realtimeConnected, setRealtimeConnected] = useState(false);
  const [realtimeError, setRealtimeError] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);

  useEffect(() => {
    let active = true;
    let requestId = 0;
    let refreshTimer: ReturnType<typeof setTimeout> | undefined;

    const fetchAll = async (initialLoad = false) => {
      const currentRequest = ++requestId;
      if (initialLoad) setLoading(true);
      const [onboardingResult, prsResult, completionsResult, logsResult] = await Promise.all([
        supabase.from("onboarding").select("initial_tests").eq("user_id", userId).maybeSingle(),
        supabase.from("personal_records").select("*").eq("user_id", userId).order("estimated_1rm", { ascending: false }).limit(20),
        supabase
          .from("day_completions")
          .select("completed_at, rpe, day_label")
          .eq("user_id", userId)
          .order("completed_at", { ascending: false })
          .limit(60),
        supabase
          .from("workout_logs")
          .select("id, day_label, exercise_name, logged_at, rpe, sets_completed")
          .eq("user_id", userId)
          .order("logged_at", { ascending: false })
          .limit(100),
      ]);
      if (!active || currentRequest !== requestId) return;
      const { data: onb } = onboardingResult;
      const { data: prData, error: prsError } = prsResult;
      const { data: dayData, error: completionsError } = completionsResult;
      const { data: logData, error: logsError } = logsResult;

      const firstError = prsError || completionsError || logsError;
      setLoadError(firstError ? "No se ha podido cargar todo el historial de entrenamiento." : null);

      if (onb?.initial_tests) setTests(onb.initial_tests as InitialTests);
      if (prData) setPRs(prData as PR[]);
      if (dayData) {
        setCompletedSessionKeys(dayData.map(d => `${d.completed_at}|${d.day_label}`));
        setRpeData(
          dayData.filter(d => d.rpe != null).reverse().map((d) => ({
            date: new Date(d.completed_at).toLocaleDateString("es-ES", { day: "2-digit", month: "short" }),
            rpe: d.rpe,
            label: d.day_label,
          })),
        );
      }
      if (logData) setWorkoutLogs(logData as unknown as WorkoutLog[]);
      setLoading(false);
    };

    const scheduleRefresh = () => {
      if (refreshTimer) clearTimeout(refreshTimer);
      refreshTimer = setTimeout(() => { void fetchAll(); }, 200);
    };

    void fetchAll(true);
    const channel = supabase.channel(`trainer-progress-${userId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "workout_logs", filter: `user_id=eq.${userId}` }, scheduleRefresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "day_completions", filter: `user_id=eq.${userId}` }, scheduleRefresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "personal_records", filter: `user_id=eq.${userId}` }, scheduleRefresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "onboarding", filter: `user_id=eq.${userId}` }, scheduleRefresh)
      .subscribe((status) => {
        setRealtimeConnected(status === "SUBSCRIBED");
        setRealtimeError(status === "CHANNEL_ERROR" || status === "TIMED_OUT");
      });

    return () => {
      active = false;
      if (refreshTimer) clearTimeout(refreshTimer);
      setRealtimeConnected(false);
      void supabase.removeChannel(channel);
    };
  }, [userId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Spinner size="lg" className="text-primary" label="Cargando progreso" />
      </div>
    );
  }

  const avgRPE = rpeData.length ? (rpeData.reduce((s, p) => s + p.rpe, 0) / rpeData.length).toFixed(1) : "—";
  const isTraveling = travelModeUntil && new Date(travelModeUntil) >= new Date();
  const sessions = Object.entries(
    workoutLogs.reduce<Record<string, WorkoutLog[]>>((acc, log) => {
      const key = `${log.logged_at}|${log.day_label}`;
      (acc[key] ||= []).push(log);
      return acc;
    }, {}),
  );
  const completedReviewSession = sessions.find(([key]) => completedSessionKeys.includes(key));
  const reviewPrevious = completedReviewSession ? sessions.find(([key, logs]) => key.split("|")[0] < completedReviewSession[0].split("|")[0] && logs[0]?.day_label === completedReviewSession[1][0]?.day_label) : undefined;
  const latestSession = sessions[0]?.[1] || [];
  const latestSessionDate = sessions[0]?.[0]?.split("|")[0];
  const latestSessionDone = latestSession.reduce((sum, log) => sum + log.sets_completed.filter((set) => set.done).length, 0);
  const latestSessionTotal = latestSession.reduce((sum, log) => sum + log.sets_completed.length, 0);
  const latestSessionVolume = latestSession.reduce(
    (sum, log) =>
      sum +
      log.sets_completed
        .filter((set) => set.done)
        .reduce((setSum, set) => setSum + (Number.parseFloat(set.weight) || 0) * (Number(set.reps) || 0), 0),
    0,
  );

  const latestDate = latestSessionDate ? new Date(`${latestSessionDate}T12:00:00`).toLocaleDateString("es-ES", { day: "numeric", month: "long" }) : "—";
  const hasTests = !!tests && Object.values(tests).some((v) => v != null && v !== 0);
  const nothingYet = !hasTests && rpeData.length === 0 && sessions.length === 0 && prs.length === 0;
  const missing = [
    rpeData.length === 0 && { title: "Evolución del RPE", value: "Sin registros" },
    sessions.length === 0 && { title: "Sesiones", value: "Ninguna registrada" },
    prs.length === 0 && { title: "Récords personales", value: "Ninguno" },
    !hasTests && { title: "Tests de nivel iniciales", value: "No completados" },
  ].filter((item): item is { title: string; value: string } => Boolean(item));
  const setsSummary = (log: WorkoutLog, empty: string) =>
    log.sets_completed.filter((set) => set.done).map((set) => `${set.weight || "—"} kg × ${set.reps}`).join(" · ") || empty;

  return (
    <div className="space-y-10">
      {loadError && (
        <div className="flex items-start gap-4">
          <AlertTriangle className="mt-0.5 h-7 w-7 shrink-0 text-destructive" strokeWidth={1.75} />
          <div className="min-w-0">
            <p className="type-headline text-destructive">{loadError}</p>
            <p className="mt-0.5 type-subhead text-muted-foreground">Comprueba las políticas de acceso del entrenador asignado y vuelve a abrir la ficha.</p>
          </div>
        </div>
      )}
      {realtimeError && (
        <p className="type-footnote text-muted-foreground" role="status">No se pudo conectar con las actualizaciones en directo.</p>
      )}

      {/* Lo primero que mira el entrenador: el último entreno, con el detalle a un toque. */}
      {latestSession.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-end justify-between gap-3">
            <div className="min-w-0">
              <p className="flex items-center gap-1.5 type-footnote text-muted-foreground">
                {realtimeConnected && <span className="h-2 w-2 shrink-0 rounded-full bg-success" aria-hidden="true" />}
                Último entreno{realtimeConnected ? " · en directo" : ""}
              </p>
              <h2 className="mt-0.5 break-words type-title2">{latestSession[0].day_label}</h2>
              <p className="type-subhead text-muted-foreground">{latestDate}</p>
            </div>
            <Button variant="plain" size="sm" className="-mr-3.5 shrink-0" onClick={() => { void hapticTap(); setReviewOpen(true); }}>
              Ver detalle
            </Button>
          </div>
          <div className="grid grid-cols-2">
            <Stat value={`${latestSessionDone}/${latestSessionTotal}`} label="Series hechas" />
            <Stat value={latestSessionVolume.toLocaleString("es-ES")} unit="kg" label="Volumen" className="sep-l pl-4" />
          </div>
          <Dialog open={reviewOpen} onOpenChange={setReviewOpen}>
            <DialogContent className="sm:max-w-2xl" onOpenAutoFocus={skipAutoFocusOnTouch}>
              <DialogHeader>
                <DialogTitle>{latestSession[0].day_label} · {latestDate}</DialogTitle>
                <DialogDescription className="tabular-nums">
                  {latestSessionDone}/{latestSessionTotal} series · {latestSessionVolume.toLocaleString("es-ES")} kg de volumen
                </DialogDescription>
              </DialogHeader>
              {completedReviewSession && (
                <WorkoutReview
                  coach
                  current={completedReviewSession[1].map(log => ({ name: log.exercise_name, sets: log.sets_completed }))}
                  previous={(reviewPrevious?.[1] || []).map(log => ({ name: log.exercise_name, sets: log.sets_completed }))}
                  rpe={completedReviewSession[1].find(log => log.rpe != null)?.rpe}
                />
              )}
              <ListGroup inset>
                {latestSession.map((log) => (
                  <ListRow key={log.id} title={log.exercise_name} subtitle={<span className="tabular-nums">{setsSummary(log, "Sin series")}</span>} />
                ))}
              </ListGroup>
            </DialogContent>
          </Dialog>
        </section>
      )}

      {isTraveling && (
        <div className="flex items-start gap-4">
          <Plane className="mt-0.5 h-7 w-7 shrink-0 text-primary" strokeWidth={1.75} />
          <div className="min-w-0">
            <p className="type-headline">Modo viaje activo</p>
            <p className="mt-0.5 type-subhead text-muted-foreground">
              Hasta el {new Date(travelModeUntil!).toLocaleDateString("es-ES", { day: "numeric", month: "long" })} · Equipamiento: {travelEquipment || "Sin equipamiento"}
            </p>
          </div>
        </div>
      )}

      {nothingYet ? (
        <EmptyState
          icon={TrendingUp}
          title="Sin actividad todavía"
          description="Cuando registre entrenos verás aquí sus series, su esfuerzo y sus récords."
        />
      ) : (
        <>
          {/* RPE: cifra media protagonista y la tendencia directamente sobre negro */}
          {rpeData.length > 0 && (
            <section className="space-y-3">
              <div className="flex items-end justify-between gap-3">
                <SectionHeader title="Evolución del RPE" hint={`${rpeData.length} ${rpeData.length === 1 ? "sesión" : "sesiones"}`} className="min-w-0" />
                <div className="shrink-0 text-right">
                  <div className="font-rounded text-[28px] font-bold leading-[34px] tabular-nums">{avgRPE}</div>
                  <div className="type-caption1 text-muted-foreground">Media</div>
                </div>
              </div>
              {rpeData.length >= 2 ? (
                <div className="h-44">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={rpeData} margin={{ top: 8, right: 8, bottom: 0, left: -24 }}>
                      <CartesianGrid vertical={false} stroke="hsl(var(--border))" />
                      <XAxis dataKey="date" axisLine={false} tickLine={false} fontSize={12} tick={{ fill: "hsl(var(--muted-foreground))" }} />
                      <YAxis domain={[0, 10]} axisLine={false} tickLine={false} fontSize={12} tick={{ fill: "hsl(var(--muted-foreground))" }} />
                      <Tooltip
                        cursor={{ stroke: "hsl(var(--border))" }}
                        contentStyle={{
                          background: "hsl(var(--secondary))",
                          border: "none",
                          borderRadius: 12,
                          fontSize: 13,
                        }}
                        labelStyle={{ color: "hsl(var(--muted-foreground))" }}
                        itemStyle={{ color: "hsl(var(--foreground))" }}
                      />
                      <Line type="monotone" dataKey="rpe" name="RPE" stroke="hsl(var(--primary))" strokeWidth={2.5} dot={{ fill: "hsl(var(--primary))", r: 3, strokeWidth: 0 }} activeDot={{ r: 5, strokeWidth: 0 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <p className="type-footnote text-muted-foreground">Con una sola sesión aún no hay evolución que mostrar.</p>
              )}
            </section>
          )}

          {/* Sesiones ejecutadas: lo que el cliente hizo realmente, serie a serie */}
          {sessions.length > 0 && (
            <section className="space-y-3">
              <SectionHeader title="Últimas sesiones" hint={`${sessions.length} registradas`} />
              <div className="overflow-hidden rounded-2xl bg-card">
                {sessions.slice(0, 12).map(([key, logs], index) => {
                  const [date, dayLabel] = key.split("|");
                  const open = expandedSession === key;
                  const done = logs.reduce((sum, log) => sum + log.sets_completed.filter((set) => set.done).length, 0);
                  const total = logs.reduce((sum, log) => sum + log.sets_completed.length, 0);
                  const rpe = logs.find((log) => log.rpe != null)?.rpe;
                  return (
                    <div key={key} className={cn(index > 0 && "sep-t")}>
                      <button
                        type="button"
                        aria-expanded={open}
                        onClick={() => { void hapticSelection(); setExpandedSession(open ? null : key); }}
                        className="flex min-h-[56px] w-full items-center gap-3 px-4 py-2.5 text-left transition-colors duration-150 active:bg-accent focus-visible:bg-accent focus-visible:outline-none"
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block truncate type-body">{dayLabel} · {new Date(`${date}T12:00:00`).toLocaleDateString("es-ES", { day: "numeric", month: "short" })}</span>
                          <span className="block type-footnote text-muted-foreground tabular-nums">{done}/{total} series{rpe ? ` · RPE ${rpe}` : " · Sin cerrar"}</span>
                        </span>
                        <ChevronDown className={cn("h-4 w-4 shrink-0 text-muted-foreground/60 transition-transform duration-200 ease-ios", open && "rotate-180")} strokeWidth={2.5} aria-hidden="true" />
                      </button>
                      {open && (
                        <ul className="space-y-2.5 px-4 pb-4 pt-1">
                          {logs.map((log) => (
                            <li key={log.id} className="min-w-0">
                              <p className="break-words type-subhead">{log.exercise_name}</p>
                              <p className="break-words type-footnote text-muted-foreground tabular-nums">{setsSummary(log, "Sin series completadas")}</p>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {prs.length > 0 && (
            <section className="space-y-3">
              <SectionHeader title="Récords personales" hint={`${prs.length} registrados`} />
              <ListGroup>
                {prs.map((pr) => (
                  <ListRow
                    key={pr.id}
                    title={pr.exercise_name}
                    subtitle={
                      <span className="tabular-nums">
                        {pr.weight} kg × {pr.reps} · {new Date(pr.achieved_at).toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "2-digit" })}
                      </span>
                    }
                    trailing={
                      <span className="text-right">
                        <span className="block font-rounded type-headline tabular-nums">
                          {pr.estimated_1rm ? `${Number(pr.estimated_1rm).toFixed(1)} kg` : "—"}
                        </span>
                        <span className="block type-caption2 text-muted-foreground">1RM est.</span>
                      </span>
                    }
                  />
                ))}
              </ListGroup>
            </section>
          )}

          {hasTests && tests && (
            <section className="space-y-3">
              <SectionHeader title="Tests de nivel iniciales" />
              <div className="grid grid-cols-2 gap-y-5 sm:grid-cols-4">
                {(Object.keys(TEST_LABELS) as (keyof InitialTests)[]).map((k, index) => (
                  <Stat
                    key={k}
                    value={tests[k] ?? "—"}
                    unit={tests[k] != null ? TEST_LABELS[k].unit : undefined}
                    label={TEST_LABELS[k].label}
                    className={cn(index % 2 === 1 && "sep-l pl-4", index === 2 && "sm:sep-l sm:pl-4")}
                  />
                ))}
              </div>
            </section>
          )}

          {/* Lo que aún no tiene datos se dice en una sola lista, no con avisos sueltos por sección. */}
          {missing.length > 0 && (
            <ListGroup header="Sin datos todavía">
              {missing.map((item) => (
                <ListRow key={item.title} title={item.title} value={item.value} />
              ))}
            </ListGroup>
          )}
        </>
      )}
    </div>
  );
};

/** Cifra al estilo de Salud: número grande redondeado y su etiqueta debajo. */
const Stat = ({ value, unit, label, className }: { value: ReactNode; unit?: string; label: string; className?: string }) => (
  <div className={cn("min-w-0", className)}>
    <div className="truncate font-rounded text-[28px] font-bold leading-[34px] tabular-nums">
      {value}
      {unit ? <span className="ml-1 type-subhead font-semibold text-muted-foreground">{unit}</span> : null}
    </div>
    <div className="truncate type-footnote text-muted-foreground">{label}</div>
  </div>
);

export default UserProgressPanel;
