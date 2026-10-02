import { useCallback, useEffect, useRef, useState } from "react";
import type { DayPlan } from "@/types/training";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import {
  comparisonKey,
  createSession,
  exerciseFromPlan,
  stats,
  type Session,
  type TrackedExercise,
  type TrackingKind,
} from "@/lib/tracking/model";
import {
  trackingDb,
  draftKey,
  loadSessions,
  readDraft,
  saveSession,
  writeDraft,
  type Pending,
} from "@/lib/tracking/store";
import { SessionEditor } from "@/components/tracking/SessionEditor";
interface Props {
  userId: string;
  dayPlans: DayPlan[];
  autoStart?: boolean;
  onAutoStartConsumed?: () => void;
  onExit?: () => void;
  onCancel?: () => void;
  onSessionModeChange?: (active: boolean) => void;
}
export default function WorkoutTracker(props: Props) {
  return <Tracker key={props.userId} {...props} />;
}
function Tracker({
  userId,
  dayPlans,
  onExit,
  onCancel,
  onSessionModeChange,
  onAutoStartConsumed,
}: Props) {
  const [session, setSession] = useState<Session | null>(null),
    [history, setHistory] = useState<Session[]>([]),
    [catalog, setCatalog] = useState<TrackedExercise[]>([]);
  const consumedRef = useRef(onAutoStartConsumed);
  consumedRef.current = onAutoStartConsumed;
  const [targets, setTargets] = useState<
    Array<{ exercise_key: string; target_kg: number }>
  >([]);
  const [status, setStatus] = useState("Cargando sesión…"),
    [ready, setReady] = useState(false),
    [failed, setFailed] = useState(false),
    [reload, setReload] = useState(0);
  const pending = useRef<Pending | null>(null),
    attempt = useRef<Pending | null>(null),
    busy = useRef(false),
    mounted = useRef(true),
    generation = useRef(0);
  const [planIndex, setPlanIndex] = useState(() =>
    Math.max(
      0,
      dayPlans.findIndex(
        (p) =>
          p.day ===
          [
            "Domingo",
            "Lunes",
            "Martes",
            "Miércoles",
            "Jueves",
            "Viernes",
            "Sábado",
          ][new Date().getDay()],
      ),
    ),
  );
  const flush = useCallback(async () => {
    if (busy.current || !pending.current) return;
    busy.current = true;
    setStatus("Guardando…");
    setFailed(false);
    try {
      while (pending.current) {
        const snapshot = attempt.current || pending.current;
        attempt.current = snapshot;
        localStorage.setItem(
          draftKey(userId) + ":attempt",
          JSON.stringify(snapshot),
        );
        const saved = await saveSession(snapshot);
        if (!mounted.current) return;
        if (pending.current?.mutation === snapshot.mutation) {
          pending.current = null;
          localStorage.removeItem(draftKey(userId));
          setSession(saved);
          setHistory((h) => [saved, ...h.filter((s) => s.id !== saved.id)]);
        } else if (pending.current) {
          pending.current = {
            ...pending.current,
            session: { ...pending.current.session, revision: saved.revision },
          };
          writeDraft(pending.current);
          setSession(pending.current.session);
        }
        attempt.current = null;
        localStorage.removeItem(draftKey(userId) + ":attempt");
      }
      setStatus("Guardado en tu cuenta");
    } catch (error) {
      if (mounted.current) {
        setFailed(true);
        setStatus(
          `No se pudo guardar. ${error instanceof Error ? error.message : (error as { message?: string }).message || "Comprueba la conexión."} Tu copia local sigue disponible.`,
        );
      }
    } finally {
      busy.current = false;
    }
  }, [userId]);
  const change = (next: Session) => {
    const p = { session: next, mutation: crypto.randomUUID(), reason: "" };
    pending.current = p;
    setSession(next);
    try {
      writeDraft(p);
      setStatus("Guardado en este dispositivo · pendiente de sincronizar");
    } catch {
      setStatus(
        "No se pudo guardar en este dispositivo. Guarda en tu cuenta antes de cerrar.",
      );
      setFailed(true);
    }
    generation.current++;
  };
  useEffect(() => {
    mounted.current = true;
    let active = true;
    setReady(false);
    setFailed(false);
    setSession(null);
    pending.current = null;
    attempt.current = null;
    (async () => {
      const local = readDraft(userId);
      const rawAttempt = localStorage.getItem(draftKey(userId) + ":attempt");
      attempt.current = rawAttempt ? JSON.parse(rawAttempt) : null;
      if (local) {
        pending.current = local;
        setSession(local.session);
        setStatus("Sesión recuperada de este dispositivo");
      }
      const rows = await loadSessions(userId);
      if (!active) return;
      setHistory(rows);
      if (!local)
        setSession(
          rows.find((s) => s.status === "in_progress" && !s.payload.legacy) ||
            null,
        );
      const { data, error } = await supabase
        .from("exercises")
        .select("*")
        .order("name");
      if (error) throw error;
      if (!active) return;
      setCatalog(
        (data || []).map((e) =>
          exerciseFromPlan({
            ...e,
            exercise_id: e.id,
            series: 1,
            reps: 0,
            weight: "",
            rest: "",
            tracking_kind: (e as typeof e & { tracking_kind?: TrackingKind })
              .tracking_kind,
          }),
        ),
      );
      const adjustments = await trackingDb
        .from("training_target_adjustments")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });
      if (adjustments.error) throw adjustments.error;
      if (!active) return;
      setTargets(adjustments.data || []);
      setReady(true);
      setStatus(
        local
          ? "Copia local recuperada · pulsa Reintentar para sincronizar"
          : "Datos cargados",
      );
      consumedRef.current?.();
    })().catch(() => {
      if (active) {
        if (pending.current) setReady(true);
        setFailed(true);
        setStatus(
          pending.current
            ? "Sesión local recuperada. Sin conexión al historial; puedes seguir registrando y reintentar el guardado."
            : "No se pudo cargar el historial. Reintenta antes de iniciar otra sesión.",
        );
      }
    });
    return () => {
      active = false;
      mounted.current = false;
    };
  }, [userId, reload]);
  useEffect(() => {
    if (!pending.current || !ready || failed) return;
    const timer = setTimeout(() => void flush(), 800);
    return () => clearTimeout(timer);
  }, [session, ready, failed, flush]);
  useEffect(() => {
    onSessionModeChange?.(session?.status === "in_progress");
    return () => onSessionModeChange?.(false);
  }, [session?.status, onSessionModeChange]);
  return (
    <div className="space-y-4">
      <div
        role="status"
        className="rounded-xl border border-border p-3 text-sm"
      >
        {status}
        {failed && (
          <Button
            className="ml-2"
            variant="outline"
            onClick={() =>
              pending.current && ready ? void flush() : setReload((n) => n + 1)
            }
          >
            Reintentar
          </Button>
        )}
      </div>
      {!session && ready && (
        <div className="rounded-2xl border bg-card p-5 space-y-3">
          <h2 className="font-bold text-lg">Tu entrenamiento</h2>
          {dayPlans.length ? (
            <>
              <label className="block">
                Sesión prevista
                <select
                  className="mt-2 h-12 w-full rounded-md border bg-background p-2"
                  value={planIndex}
                  onChange={(e) => setPlanIndex(Number(e.target.value))}
                >
                  {dayPlans.map((p, i) => (
                    <option key={i} value={i}>
                      {p.day} · {p.routine_name || p.sport}
                    </option>
                  ))}
                </select>
              </label>
              <Button
                onClick={() => {
                  const plan = dayPlans[planIndex];
                  if (!plan) return;
                  const enriched = {
                    ...plan,
                    exercises: plan.exercises?.map((e) => {
                      const meta = catalog.find(
                        (c) => c.exerciseId === e.exercise_id,
                      );
                      return {
                        ...e,
                        tracking_kind: e.tracking_kind || meta?.kind,
                        muscle_group: e.muscle_group || meta?.muscle,
                        video_url: e.video_url || meta?.video,
                      };
                    }),
                  };
                  const next = createSession(userId, enriched);
                  next.payload.exercises.forEach((e) => {
                    const target = targets.find(
                      (t) => t.exercise_key === comparisonKey(e),
                    );
                    if (target)
                      e.sets.forEach(
                        (s) => (s.target.kg = Number(target.target_kg)),
                      );
                  });
                  change(next);
                }}
              >
                Empezar entrenamiento
              </Button>
            </>
          ) : (
            <p>
              No tienes una rutina activa. Tu historial sigue disponible en
              Progreso.
            </p>
          )}
        </div>
      )}
      {session && (
        <>
          <SessionEditor
            session={session}
            history={history}
            onChange={change}
            catalog={catalog}
            readOnly={!ready || session.status === "completed"}
          />
          {session.status === "in_progress" ? (
            <div className="flex flex-wrap gap-2">
              <Button
                disabled={!ready || !stats(session).done || busy.current}
                onClick={() => {
                  change({ ...session, status: "completed" });
                  void flush();
                }}
              >
                Finalizar sesión · {stats(session).done} series
              </Button>
              <Button
                variant="outline"
                disabled={!ready}
                onClick={() => void flush()}
              >
                Guardar ahora
              </Button>
              <Button variant="ghost" onClick={onCancel || onExit}>
                Salir y conservar sesión
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              <p>
                Sesión realizada. {stats(session).compliance ?? "—"} % de
                cumplimiento del plan. Las series pendientes no cuentan como
                realizadas.
              </p>
              <Button
                disabled={!!pending.current}
                onClick={() => {
                  setSession(null);
                  onExit?.();
                }}
              >
                Volver
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
