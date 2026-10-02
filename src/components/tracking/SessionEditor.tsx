import { getWorkoutRestSeconds } from "@/lib/workoutPreferences";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import VideoEmbed from "@/components/VideoEmbed";
import {
  emptyResult,
  kinds,
  modes,
  previousExercise,
  resultLabel,
  stats,
  validResult,
  type Result,
  type Session,
  type TrackedExercise,
  type TrackingKind,
  type LoadMode,
} from "@/lib/tracking/model";
export function SessionEditor({
  session,
  history,
  onChange,
  readOnly = false,
  catalog = [],
}: {
  session: Session;
  history: Session[];
  onChange: (s: Session) => void;
  readOnly?: boolean;
  catalog?: TrackedExercise[];
}) {
  const [message, setMessage] = useState("");
  const [rest, setRest] = useState(0);
  useEffect(() => {
    if (rest <= 0) return;
    const timer = setTimeout(() => setRest((n) => n - 1), 1000);
    return () => clearTimeout(timer);
  }, [rest]);
  const edit = (index: number, update: Partial<TrackedExercise>) =>
    onChange({
      ...session,
      payload: {
        ...session.payload,
        exercises: session.payload.exercises.map((e, i) =>
          i === index ? { ...e, ...update } : e,
        ),
      },
    });
  const summary = stats(session);
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border bg-card p-4">
        <h2 className="font-display text-xl font-bold">
          {session.payload.title}
        </h2>
        <p>
          {session.local_date} ·{" "}
          {session.status === "completed" ? "Finalizada" : "En curso"}
        </p>
        <p className="text-sm text-muted-foreground">
          {summary.done} series realizadas ·{" "}
          {summary.compliance === null
            ? "Cumplimiento desconocido"
            : `${summary.compliance} % del plan`}{" "}
          · {summary.extra} adicionales
        </p>
      </div>
      {rest > 0 && (
        <div
          role="status"
          className="sticky top-0 z-10 rounded-xl border bg-card p-3 flex items-center justify-between"
        >
          Descanso: {rest} s
          <Button variant="ghost" onClick={() => setRest(0)}>
            Terminar descanso
          </Button>
        </div>
      )}
      {message && (
        <p role="alert" className="text-destructive">
          {message}
        </p>
      )}
      {session.payload.exercises.map((e, ei) => {
        const prev = previousExercise(session, e, history);
        return (
          <section
            key={e.id}
            className="space-y-3 rounded-2xl border border-border bg-card p-4"
          >
            <h3 className="font-bold text-lg">{e.name}</h3>
            <fieldset
              disabled={readOnly}
              className="grid grid-cols-1 gap-3 sm:grid-cols-2"
            >
              <label className="text-sm">
                Tipo de registro
                <select
                  className="mt-1 h-11 w-full rounded-md border bg-background px-2"
                  value={e.kind}
                  onChange={(v) =>
                    edit(ei, {
                      kind: v.target.value as TrackingKind,
                      sets: e.sets.map((s) => ({
                        ...s,
                        done: false,
                        actual: emptyResult(),
                      })),
                    })
                  }
                >
                  {Object.entries(kinds).map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm">
                Variante (p. ej., tuck)
                <Input
                  value={e.variant}
                  onChange={(v) => edit(ei, { variant: v.target.value })}
                />
              </label>
              <label className="text-sm">
                Carga / asistencia
                <select
                  className="mt-1 h-11 w-full rounded-md border bg-background px-2"
                  value={e.mode}
                  onChange={(v) =>
                    edit(ei, { mode: v.target.value as LoadMode })
                  }
                >
                  {Object.entries(modes).map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
                </select>
              </label>
              {e.mode === "assisted" && (
                <label className="text-sm">
                  Asistencia utilizada (banda / máquina)
                  <Input
                    value={e.assistance}
                    onChange={(v) => edit(ei, { assistance: v.target.value })}
                  />
                </label>
              )}
              {catalog.length > 0 && (
                <label className="text-sm">
                  Sustituir ejercicio
                  <select
                    value=""
                    className="mt-1 h-11 w-full rounded-md border bg-background px-2"
                    onChange={(v) => {
                      const replacement = catalog.find(
                        (x) => x.exerciseId === v.target.value,
                      );
                      if (replacement) {
                        if (e.sets.some((s) => s.done)) {
                          setMessage(
                            "Conserva las series realizadas; solo puedes sustituir ejercicios sin series completadas.",
                          );
                          return;
                        }
                        edit(ei, {
                          ...replacement,
                          id: e.id,
                          notes: `Sustituye a ${e.name}`,
                          sets: e.sets.map((s) => ({
                            ...s,
                            done: false,
                            actual: emptyResult(),
                            target: emptyResult(),
                          })),
                        });
                      }
                    }}
                  >
                    <option value="">Seleccionar sustituto</option>
                    {catalog.map((x) => (
                      <option key={x.exerciseId} value={x.exerciseId}>
                        {x.name}
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </fieldset>
            {e.kind === "legacy" && (
              <p className="text-sm text-muted-foreground">
                Datos originales sin tipo conocido. No se calculan récords ni
                recomendaciones.
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              {prev
                ? `Anterior: ${prev.session.local_date}, mismo ejercicio y variante.`
                : "Sin historial comparable."}
            </p>
            {e.sets.map((set, si) => {
              const fields: Array<[keyof Result, string]> =
                e.kind === "isometric" || e.kind === "cardio"
                  ? [["seconds", "Segundos"]]
                  : [["reps", "Repeticiones"]];
              if (e.kind === "cardio")
                fields.push(["distance", "Distancia (km, opcional)"]);
              if (e.mode !== "bodyweight")
                fields.push([
                  "kg",
                  e.mode === "assisted" ? "Asistencia (kg)" : "Carga (kg)",
                ]);
              const before = prev?.exercise.sets[si];
              return (
                <div
                  key={set.id}
                  className="rounded-xl border border-border p-3 space-y-2"
                >
                  <div className="flex justify-between gap-2 text-sm">
                    <strong>
                      Serie {si + 1} {!set.planned && "· adicional"}
                    </strong>
                    <span>{set.done ? "Completada" : "Pendiente"}</span>
                  </div>
                  <p className="text-xs">
                    Anterior:{" "}
                    {before?.done
                      ? resultLabel(e, before.actual)
                      : "Sin registro"}{" "}
                    · Objetivo: {resultLabel(e, set.target)}
                  </p>
                  <fieldset
                    disabled={readOnly}
                    className="grid grid-cols-2 gap-3 sm:grid-cols-4"
                  >
                    {[
                      ...fields,
                      ["rpe", "RPE (1–10, opcional)"] as [keyof Result, string],
                    ].map(([field, label]) => (
                      <label key={field} className="text-xs">
                        Hoy · {label}
                        <Input
                          type="number"
                          min={field === "rpe" ? 1 : 0}
                          max={field === "rpe" ? 10 : undefined}
                          step={field === "reps" ? 1 : 0.1}
                          value={set.actual[field] ?? ""}
                          onChange={(v) =>
                            edit(ei, {
                              sets: e.sets.map((s, i) =>
                                i === si
                                  ? {
                                      ...s,
                                      done: false,
                                      actual: {
                                        ...s.actual,
                                        [field]:
                                          v.target.value === ""
                                            ? null
                                            : Number(v.target.value),
                                      },
                                    }
                                  : s,
                              ),
                            })
                          }
                        />
                      </label>
                    ))}
                  </fieldset>
                  {!readOnly && (
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant={set.done ? "default" : "outline"}
                        className="min-h-11"
                        onClick={() => {
                          if (!set.done && !validResult(e, set.actual)) {
                            setMessage(
                              "Revisa el resultado: repeticiones o segundos positivos, carga válida y RPE entre 1 y 10.",
                            );
                            return;
                          }
                          setMessage("");
                          if (!set.done)
                            setRest(
                              getWorkoutRestSeconds(session.user_id) || 60,
                            );
                          edit(ei, {
                            sets: e.sets.map((s, i) =>
                              i === si ? { ...s, done: !s.done } : s,
                            ),
                          });
                        }}
                      >
                        {set.done ? "Desmarcar" : "Completar serie"}
                      </Button>
                      <Button
                        variant="ghost"
                        onClick={() =>
                          edit(ei, {
                            sets: [
                              ...e.sets,
                              {
                                ...set,
                                id: crypto.randomUUID(),
                                planned: false,
                                done: false,
                                actual: { ...set.actual },
                              },
                            ],
                          })
                        }
                      >
                        Duplicar como adicional
                      </Button>
                    </div>
                  )}
                  {!readOnly && (
                    <details>
                      <summary className="cursor-pointer py-2 text-xs">
                        Editar objetivo de esta serie
                      </summary>
                      <div className="grid grid-cols-2 gap-2">
                        {fields.map(([field, label]) => (
                          <label key={field} className="text-xs">
                            {label}
                            <Input
                              type="number"
                              min="0"
                              value={set.target[field] ?? ""}
                              onChange={(v) =>
                                edit(ei, {
                                  sets: e.sets.map((s, i) =>
                                    i === si
                                      ? {
                                          ...s,
                                          target: {
                                            ...s.target,
                                            [field]:
                                              v.target.value === ""
                                                ? null
                                                : Number(v.target.value),
                                          },
                                        }
                                      : s,
                                  ),
                                })
                              }
                            />
                          </label>
                        ))}
                      </div>
                    </details>
                  )}
                </div>
              );
            })}
            {!readOnly && (
              <Button
                variant="outline"
                onClick={() =>
                  edit(ei, {
                    sets: [
                      ...e.sets,
                      {
                        id: crypto.randomUUID(),
                        planned: false,
                        done: false,
                        target: emptyResult(),
                        actual: emptyResult(),
                      },
                    ],
                  })
                }
              >
                Añadir serie adicional
              </Button>
            )}
            <label className="block text-sm">
              Notas del ejercicio
              <textarea
                disabled={readOnly}
                className="mt-1 w-full rounded-md border bg-background p-2"
                value={e.notes}
                onChange={(v) => edit(ei, { notes: v.target.value })}
              />
            </label>
            {e.video && (
              <details>
                <summary className="cursor-pointer py-2">Ver técnica</summary>
                <VideoEmbed url={e.video} />
              </details>
            )}
          </section>
        );
      })}
      <label className="block text-sm">
        Notas de la sesión
        <textarea
          disabled={readOnly}
          className="mt-1 w-full rounded-md border bg-background p-3"
          value={session.payload.notes}
          onChange={(v) =>
            onChange({
              ...session,
              payload: { ...session.payload, notes: v.target.value },
            })
          }
        />
      </label>
    </div>
  );
}
