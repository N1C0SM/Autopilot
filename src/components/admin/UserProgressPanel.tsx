import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Trophy, Activity, ClipboardCheck, Plane, Dumbbell, ChevronDown, ChevronUp } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";

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

const TEST_LABELS: Record<keyof InitialTests, { label: string; emoji: string; unit: string }> = {
  pullups: { label: "Dominadas máx.", emoji: "💪", unit: "reps" },
  pushups: { label: "Flexiones máx.", emoji: "🔥", unit: "reps" },
  squats: { label: "Sentadillas máx.", emoji: "🦵", unit: "reps" },
  plank_seconds: { label: "Plancha", emoji: "🧘", unit: "seg" },
};

const UserProgressPanel = ({ userId, travelModeUntil, travelEquipment }: Props) => {
  const [loading, setLoading] = useState(true);
  const [tests, setTests] = useState<InitialTests | null>(null);
  const [prs, setPRs] = useState<PR[]>([]);
  const [rpeData, setRpeData] = useState<RPEPoint[]>([]);
  const [workoutLogs, setWorkoutLogs] = useState<WorkoutLog[]>([]);
  const [expandedSession, setExpandedSession] = useState<string | null>(null);

  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true);
      const [{ data: onb }, { data: prData }, { data: dayData }, { data: logData }] = await Promise.all([
        supabase.from("onboarding").select("initial_tests").eq("user_id", userId).maybeSingle(),
        supabase.from("personal_records").select("*").eq("user_id", userId).order("estimated_1rm", { ascending: false }).limit(20),
        supabase
          .from("day_completions")
          .select("completed_at, rpe, day_label")
          .eq("user_id", userId)
          .not("rpe", "is", null)
          .order("completed_at", { ascending: true })
          .limit(60),
        supabase
          .from("workout_logs")
          .select("id, day_label, exercise_name, logged_at, rpe, sets_completed")
          .eq("user_id", userId)
          .order("logged_at", { ascending: false })
          .limit(100),
      ]);

      if (onb?.initial_tests) setTests(onb.initial_tests as InitialTests);
      if (prData) setPRs(prData as PR[]);
      if (dayData) {
        setRpeData(
          (dayData as any[]).map((d) => ({
            date: new Date(d.completed_at).toLocaleDateString("es-ES", { day: "2-digit", month: "short" }),
            rpe: d.rpe,
            label: d.day_label,
          })),
        );
      }
      if (logData) setWorkoutLogs(logData as unknown as WorkoutLog[]);
      setLoading(false);
    };
    fetchAll();
  }, [userId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-5 h-5 text-primary animate-spin" />
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

  return (
    <div className="space-y-6">
      {/* Travel mode banner */}
      {isTraveling && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 flex items-center gap-3">
          <Plane className="w-5 h-5 text-amber-400 shrink-0" />
          <div className="flex-1">
            <div className="text-sm font-medium text-amber-400">Modo viaje activo</div>
            <div className="text-xs text-muted-foreground">
              Hasta {new Date(travelModeUntil!).toLocaleDateString("es-ES", { day: "numeric", month: "long" })} · Equipamiento: {travelEquipment || "Sin equipamiento"}
            </div>
          </div>
        </div>
      )}

      {/* Initial tests */}
      <div className="bg-card rounded-xl p-6 border border-border">
        <h2 className="font-bold font-display mb-4 text-sm uppercase tracking-wider text-muted-foreground flex items-center gap-2">
          <ClipboardCheck className="w-4 h-4 text-primary" />
          Tests de nivel iniciales
        </h2>
        {tests && Object.values(tests).some((v) => v != null && v !== 0) ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {(Object.keys(TEST_LABELS) as (keyof InitialTests)[]).map((k) => (
              <div key={k} className="bg-secondary/30 rounded-lg p-3 text-center">
                <div className="text-2xl mb-1">{TEST_LABELS[k].emoji}</div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{TEST_LABELS[k].label}</div>
                <div className="text-lg font-bold font-display mt-1">
                  {tests[k] ?? "—"} <span className="text-xs text-muted-foreground font-normal">{tests[k] != null ? TEST_LABELS[k].unit : ""}</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">El usuario no completó los tests iniciales.</p>
        )}
      </div>

      {/* RPE evolution */}
      <div className="bg-card rounded-xl p-6 border border-border">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold font-display text-sm uppercase tracking-wider text-muted-foreground flex items-center gap-2">
            <Activity className="w-4 h-4 text-primary" />
            Evolución de RPE
          </h2>
          <div className="text-xs text-muted-foreground">
            Promedio: <span className="font-bold text-foreground">{avgRPE}</span> · {rpeData.length} sesiones
          </div>
        </div>
        {rpeData.length > 0 ? (
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={rpeData} margin={{ top: 10, right: 10, bottom: 0, left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={10} tick={{ fill: "hsl(var(--muted-foreground))" }} />
                <YAxis domain={[0, 10]} stroke="hsl(var(--muted-foreground))" fontSize={10} tick={{ fill: "hsl(var(--muted-foreground))" }} />
                <Tooltip
                  contentStyle={{
                    background: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "0.5rem",
                    fontSize: "12px",
                  }}
                  labelStyle={{ color: "hsl(var(--foreground))" }}
                />
                <Line type="monotone" dataKey="rpe" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ fill: "hsl(var(--primary))", r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Sin registros de RPE todavía.</p>
        )}
      </div>

      {/* Sesiones ejecutadas: lo que el cliente hizo realmente, serie a serie */}
      <div className="bg-card rounded-xl p-4 sm:p-6 border border-border">
        <h2 className="font-bold font-display mb-4 text-sm uppercase tracking-wider text-muted-foreground flex items-center gap-2">
          <Dumbbell className="w-4 h-4 text-primary" />
          Últimas sesiones ({sessions.length})
        </h2>
        {sessions.length > 0 ? (
          <div className="space-y-2">
            {sessions.slice(0, 12).map(([key, logs]) => {
              const [date, dayLabel] = key.split("|");
              const open = expandedSession === key;
              const done = logs.reduce((sum, log) => sum + log.sets_completed.filter((set) => set.done).length, 0);
              const total = logs.reduce((sum, log) => sum + log.sets_completed.length, 0);
              const rpe = logs.find((log) => log.rpe != null)?.rpe;
              return (
                <div key={key} className="border border-border rounded-lg overflow-hidden">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setExpandedSession(open ? null : key)}
                    className="w-full h-auto px-3 py-3 justify-between rounded-none"
                  >
                    <span className="text-left min-w-0">
                      <span className="block text-sm font-semibold">{dayLabel} · {new Date(`${date}T12:00:00`).toLocaleDateString("es-ES", { day: "numeric", month: "short" })}</span>
                      <span className="block text-xs text-muted-foreground">{done}/{total} series{rpe ? ` · RPE ${rpe}` : " · Sin cerrar"}</span>
                    </span>
                    {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </Button>
                  {open && (
                    <div className="border-t border-border px-3 py-2 space-y-2">
                      {logs.map((log) => (
                        <div key={log.id} className="flex items-start justify-between gap-3 text-xs">
                          <span className="font-medium min-w-0">{log.exercise_name}</span>
                          <span className="text-muted-foreground text-right shrink-0">
                            {log.sets_completed.filter((set) => set.done).map((set) => `${set.weight || "—"} kg × ${set.reps}`).join(" · ") || "Sin series completadas"}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Todavía no ha registrado ninguna sesión.</p>
        )}
      </div>

      {/* Personal Records */}
      <div className="bg-card rounded-xl p-6 border border-border">
        <h2 className="font-bold font-display mb-4 text-sm uppercase tracking-wider text-muted-foreground flex items-center gap-2">
          <Trophy className="w-4 h-4 text-primary" />
          Récords personales ({prs.length})
        </h2>
        {prs.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Ejercicio</TableHead>
                <TableHead className="text-xs text-right">Peso</TableHead>
                <TableHead className="text-xs text-right">Reps</TableHead>
                <TableHead className="text-xs text-right">1RM est.</TableHead>
                <TableHead className="text-xs text-right">Fecha</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {prs.map((pr) => (
                <TableRow key={pr.id}>
                  <TableCell className="font-medium text-sm">{pr.exercise_name}</TableCell>
                  <TableCell className="text-right text-sm">{pr.weight} kg</TableCell>
                  <TableCell className="text-right text-sm">{pr.reps}</TableCell>
                  <TableCell className="text-right text-sm font-bold text-primary">
                    {pr.estimated_1rm ? `${Number(pr.estimated_1rm).toFixed(1)} kg` : "—"}
                  </TableCell>
                  <TableCell className="text-right text-xs text-muted-foreground">
                    {new Date(pr.achieved_at).toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "2-digit" })}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <p className="text-sm text-muted-foreground">Aún no ha registrado récords personales.</p>
        )}
      </div>
    </div>
  );
};

export default UserProgressPanel;
