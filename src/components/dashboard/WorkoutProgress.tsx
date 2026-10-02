import { allowedMetrics, seriesPoints } from "@/lib/tracking/metrics";
import { es } from "date-fns/locale";
import { useEffect, useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Calendar } from "@/components/ui/calendar";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { parseLocalDate, toLocalDateString } from "@/lib/localDates";
import {
  modes,
  comparisonKey,
  defaultRules,
  recommendation,
  resultLabel,
  stats,
  validResult,
  weeklyMuscles,
  type Session,
} from "@/lib/tracking/model";
import { loadSessions, saveSession, trackingDb } from "@/lib/tracking/store";
import { SessionEditor } from "@/components/tracking/SessionEditor";
export default function WorkoutProgress({
  userId,
  trainer = false,
}: {
  userId: string;
  trainer?: boolean;
}) {
  return <History key={userId} userId={userId} trainer={trainer} />;
}
function History({ userId, trainer }: { userId: string; trainer: boolean }) {
  const [sessions, setSessions] = useState<Session[]>([]),
    [selected, setSelected] = useState<Session | null>(null),
    [editing, setEditing] = useState(false),
    [reason, setReason] = useState(""),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true),
    [reload, setReload] = useState(0),
    [saving, setSaving] = useState(false);
  const [period, setPeriod] = useState(30),
    [date, setDate] = useState<Date>(),
    [exerciseKey, setExerciseKey] = useState(""),
    [metric, setMetric] = useState("reps"),
    [fixed, setFixed] = useState(""),
    [rules, setRules] = useState(defaultRules),
    [audit, setAudit] = useState<
      Array<{
        id: string;
        actor_id: string;
        reason: string;
        created_at: string;
      }>
    >([]);
  useEffect(() => {
    let active = true;
    setLoading(true);
    loadSessions(userId)
      .then((rows) => {
        if (active) {
          setSessions(rows);
          setError("");
        }
      })
      .catch(() => {
        if (active) setError("No se pudo cargar el historial.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [userId, reload]);
  const selectedId = selected?.id;
  const selectedRevision = selected?.revision;
  const correction = useRef<import("@/lib/tracking/store").Pending | null>(
    null,
  );
  useEffect(() => {
    if (!selectedId) {
      setAudit([]);
      return;
    }
    let active = true;
    trackingDb
      .from("session_adjustments")
      .select("*")
      .eq("session_id", selectedId)
      .order("created_at", { ascending: false })
      .then(({ data, error }) => {
        if (active) {
          setAudit(data || []);
          if (error) setError("No se pudo cargar la auditoría.");
        }
      });
    return () => {
      active = false;
    };
  }, [selectedId, selectedRevision]);
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - period + 1);
  const filtered = sessions.filter(
    (s) => period === 0 || s.local_date >= toLocalDateString(cutoff),
  );
  const performed = filtered.filter((s) => stats(s).performed);
  const groups = new Map(
    performed.flatMap((s) =>
      s.payload.exercises
        .filter((e) => e.kind !== "legacy")
        .map((e) => [comparisonKey(e), e] as const),
    ),
  );
  const key = groups.has(exerciseKey)
    ? exerciseKey
    : groups.keys().next().value || "";
  const exercise = groups.get(key);
  const allowed = allowedMetrics(exercise);
  const effectiveMetric = allowed.includes(metric) ? metric : allowed[0];
  const points = seriesPoints(performed, key, effectiveMetric, fixed);
  const metricLabels: Record<string, string> = {
    reps: "Repeticiones a la misma carga",
    kg: "Carga para las mismas repeticiones",
    seconds: "Segundos en la misma variante",
    e1rm: "1RM estimado (pesas, 1–12 reps)",
    volume: "Volumen externo (kg × reps)",
    rpe: "Esfuerzo medio (RPE)",
  };
  const open = (s: Session) => {
    correction.current = null;
    setSelected(structuredClone(s));
    setEditing(false);
    setReason("");
  };
  const save = async () => {
    if (!selected || !reason.trim()) return;
    setSaving(true);
    try {
      correction.current ||= {
        session: structuredClone(selected),
        mutation: crypto.randomUUID(),
        reason,
      };
      const saved = await saveSession(correction.current);
      correction.current = null;
      setSessions((rows) => rows.map((s) => (s.id === saved.id ? saved : s)));
      setSelected(saved);
      setEditing(false);
      setError("");
    } catch (e) {
      setError(
        `No se guardó la corrección: ${(e as { message?: string }).message || "reintenta"}`,
      );
    } finally {
      setSaving(false);
    }
  };
  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-display font-bold">Historial y progreso</h2>
        <select
          aria-label="Periodo del historial"
          className="h-11 rounded-md border bg-background px-3"
          value={period}
          onChange={(e) => setPeriod(Number(e.target.value))}
        >
          <option value="7">Semana</option>
          <option value="30">Mes</option>
          <option value="90">Tres meses</option>
          <option value="0">Todo el historial</option>
        </select>
      </div>
      {loading && <p role="status">Cargando historial…</p>}
      {error && (
        <div role="alert">
          {error}
          <Button variant="outline" onClick={() => setReload((n) => n + 1)}>
            Reintentar
          </Button>
        </div>
      )}
      {!loading && !error && !sessions.length && (
        <p className="rounded-xl border border-dashed p-5">
          Aún no hay sesiones. Tu primera sesión será el punto de partida.
        </p>
      )}
      <div className="grid grid-cols-3 gap-2">
        {[
          [performed.length, "sesiones realizadas"],
          [
            performed.reduce((n, s) => n + stats(s).done, 0),
            "series completadas",
          ],
          [
            performed.reduce((n, s) => n + stats(s).extra, 0),
            "series adicionales",
          ],
        ].map(([n, l]) => (
          <div key={l} className="rounded-xl bg-card border p-3">
            <strong className="block text-xl">{n}</strong>
            <span className="text-xs">{l}</span>
          </div>
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border bg-card p-3">
          <Calendar
            locale={es}
            weekStartsOn={1}
            mode="single"
            selected={date}
            onSelect={setDate}
            modifiers={{
              trained: sessions
                .filter((s) => stats(s).performed)
                .map((s) => parseLocalDate(s.local_date)),
            }}
            modifiersClassNames={{ trained: "bg-primary/20 font-bold" }}
          />
          <Button variant="ghost" onClick={() => setDate(undefined)}>
            Ver todas las fechas
          </Button>
        </div>
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {filtered
            .filter((s) => !date || s.local_date === toLocalDateString(date))
            .map((s) => (
              <button
                key={s.id}
                className="w-full rounded-xl border bg-card p-4 text-left"
                onClick={() => open(s)}
              >
                <strong>
                  {s.local_date} · {s.payload.title}
                </strong>
                <p className="text-sm">
                  {s.status === "completed" ? "Finalizada" : "En curso"} ·{" "}
                  {stats(s).done} series · {stats(s).compliance ?? "—"} % del
                  plan
                </p>
              </button>
            ))}
        </div>
      </div>
      {exercise && (
        <div className="rounded-2xl border bg-card p-4 space-y-3">
          <h3 className="font-bold">Evolución comparable</h3>
          <select
            aria-label="Ejercicio y variante"
            value={key}
            onChange={(e) => {
              setExerciseKey(e.target.value);
              setFixed("");
            }}
            className="h-12 w-full rounded-md border bg-background px-2"
          >
            {[...groups].map(([k, e]) => (
              <option key={k} value={k}>
                {e.name} · {e.variant || "sin variante"} · {modes[e.mode]}{" "}
                {e.assistance}
              </option>
            ))}
          </select>
          <select
            aria-label="Métrica"
            value={effectiveMetric}
            onChange={(e) => {
              setMetric(e.target.value);
              setFixed("");
            }}
            className="h-11 w-full rounded-md border bg-background px-2"
          >
            {allowed.map((m) => (
              <option value={m} key={m}>
                {metricLabels[m]}
              </option>
            ))}
          </select>
          {(effectiveMetric === "kg" ||
            effectiveMetric === "reps" ||
            effectiveMetric === "seconds") &&
            exercise.mode !== "bodyweight" && (
              <label className="block text-sm">
                {effectiveMetric === "kg"
                  ? "Repeticiones fijas"
                  : "Carga fija (kg)"}
                <Input
                  type="number"
                  min="0"
                  value={fixed}
                  onChange={(e) => setFixed(e.target.value)}
                />
              </label>
            )}
          {points.length ? (
            <>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={points}>
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Line
                    dataKey="value"
                    stroke="hsl(var(--primary))"
                    dot={{ r: 5 }}
                  />
                </LineChart>
              </ResponsiveContainer>
              <p className="text-sm">
                {points.length === 1
                  ? "Punto de partida; aún no hay tendencia."
                  : `Mejor valor comparable: ${effectiveMetric === "rpe" ? "el esfuerzo no es un récord" : Math.max(...points.map((p) => p.value))}`}
              </p>
              <div className="flex flex-wrap gap-2">
                {points.map((p) => (
                  <Button
                    key={p.id}
                    className="h-auto min-h-11 whitespace-normal text-left"
                    variant="outline"
                    onClick={() => open(sessions.find((s) => s.id === p.id)!)}
                  >
                    {p.date}: {p.value} · {p.sets} series
                    {p.best ? ` · Mejor serie: ${p.best}` : ""}
                  </Button>
                ))}
              </div>
            </>
          ) : (
            <p>Sin registros compatibles con este filtro.</p>
          )}
          <p className="text-xs text-muted-foreground">
            Más volumen puede proceder de añadir series; no implica
            automáticamente más fuerza. Solo se incluyen series completadas. La
            carga, la asistencia y las variantes se comparan por separado.
          </p>
          <details>
            <summary className="py-2 cursor-pointer">
              Reglas de las propuestas
            </summary>
            <div className="grid grid-cols-3 gap-2">
              {Object.entries(rules).map(([k, v]) => (
                <label className="text-xs" key={k}>
                  {
                    {
                      minimumSessions: "Sesiones mínimas",
                      maxRpe: "RPE máximo",
                      incrementKg: "Incremento kg",
                    }[k]
                  }
                  <Input
                    type="number"
                    min="1"
                    max={k === "maxRpe" ? 10 : undefined}
                    value={v}
                    onChange={(e) => {
                      const n = Number(e.target.value);
                      if (n >= 1 && (k !== "maxRpe" || n <= 10))
                        setRules((r) => ({
                          ...r,
                          [k]: k === "minimumSessions" ? Math.floor(n) : n,
                        }));
                    }}
                  />
                </label>
              ))}
            </div>
          </details>
          {(() => {
            const proposal = recommendation(
              performed[0],
              exercise,
              sessions,
              rules,
            );
            return (
              <div className="rounded-xl bg-secondary/40 p-3 text-sm">
                <strong>
                  {proposal.label}
                  {proposal.kg !== null ? ` a ${proposal.kg} kg` : ""}
                </strong>
                <p>{proposal.reason}</p>
                {trainer && proposal.kg !== null && (
                  <>
                    <label className="block mt-2">
                      Motivo del ajuste para la próxima sesión
                      <Input
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                      />
                    </label>
                    <Button
                      disabled={!reason.trim() || saving}
                      onClick={async () => {
                        setSaving(true);
                        const result = await trackingDb.rpc(
                          "approve_training_target",
                          {
                            p_id: crypto.randomUUID(),
                            p_session: proposal.evidence[0],
                            p_exercise_key: key,
                            p_kg: proposal.kg!,
                            p_reason: `${reason}. ${proposal.conditions} ${proposal.reason}`,
                          },
                        );
                        setSaving(false);
                        setError(
                          result.error ? "No se pudo aprobar el ajuste." : "",
                        );
                        if (!result.error)
                          setReason(
                            "Ajuste aprobado para las próximas sesiones nuevas.",
                          );
                      }}
                    >
                      Aprobar objetivo para próximas sesiones
                    </Button>
                  </>
                )}

                <p>{proposal.conditions}</p>
                <p>
                  Propuesta orientativa: revisa técnica y recuperación con tu
                  entrenador.
                </p>
                {proposal.evidence.map((id) => (
                  <Button
                    key={id}
                    variant="link"
                    onClick={() => open(sessions.find((s) => s.id === id)!)}
                  >
                    Ver registro {sessions.find((s) => s.id === id)?.local_date}
                  </Button>
                ))}
              </div>
            );
          })()}
        </div>
      )}
      <details className="rounded-xl border p-4">
        <summary className="cursor-pointer">
          Series por músculo y semana
        </summary>
        {Object.entries(weeklyMuscles(filtered)).map(([key, n]) => (
          <p key={key}>
            {key}: {n}
          </p>
        ))}
        <p className="text-xs text-muted-foreground">
          Una serie válida cuenta una vez para el músculo principal registrado.
          No se asignan fracciones a músculos secundarios. Cardio y músculos
          desconocidos se excluyen.
        </p>
      </details>
      {selected && (
        <div className="rounded-2xl border border-primary/40 p-3 space-y-3">
          <Button
            variant="outline"
            disabled={saving}
            onClick={() => setSelected(null)}
          >
            Cerrar detalle
          </Button>
          <SessionEditor
            session={selected}
            history={sessions}
            onChange={setSelected}
            readOnly={!editing || saving || !!correction.current}
          />
          <p className="text-xs">Zona horaria guardada: {selected.timezone}</p>
          {!editing ? (
            <Button onClick={() => setEditing(true)}>
              {trainer ? "Revisar y corregir con motivo" : "Corregir registro"}
            </Button>
          ) : (
            <>
              <label className="block">
                Motivo de la corrección
                <Input
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
              </label>
              <Button
                disabled={saving || !reason.trim()}
                onClick={() => void save()}
              >
                {saving ? "Guardando…" : "Guardar corrección y recalcular"}
              </Button>
            </>
          )}
          <details>
            <summary>Historial de ajustes ({audit.length})</summary>
            {audit.map((a) => (
              <p key={a.id} className="text-xs py-2">
                {a.created_at} · Autor: {a.actor_id} · {a.reason}
              </p>
            ))}
          </details>
        </div>
      )}
    </section>
  );
}
