import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/shared/integrations/supabase/client";
import { Button } from "@/shared/components/ui/button";
import { Progress } from "@/shared/components/ui/progress";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/shared/components/ui/alert-dialog";
import { errorMessage, functionErrorMessage } from "@/shared/lib/runtimeValues";
import { hapticNotify, hapticTap } from "@/shared/lib/native";
import {
  PLAN_VIDEOS_COPY,
  PLAN_VIDEO_DEADLINE_MS,
  PLAN_VIDEO_POLL_MS,
  formatCredits,
  isCreditsError,
  planExerciseKeys,
  planVideoConfirmAction,
  planVideoConfirmBody,
  planVideoConfirmTitle,
  planVideoCredits,
  planVideoDone,
  planVideoEstimate,
  planVideoNeedPhoto,
  planVideoProgress,
  planVideoQueue,
  planVideoSummary,
  type PlanVideoExercise,
  type PlanVideoQueue,
} from "@/shared/lib/planVideos";

/** Supabase devuelve como mucho 1.000 filas por consulta: se lee por páginas. */
const PAGE = 1000;

type Failure = { name: string; message: string };
type Run = { current: number; total: number; name: string; created: number; failures: Failure[]; stopping: boolean };
type Outcome = { text: string; failures: Failure[] };
type VideoResponse = { paused?: boolean; status?: string; video_url?: string; error?: string; progress?: number | null };

/** Todos los `workouts_json` (el admin los lee con sus permisos, como la ficha de cada usuario). */
const readPlans = async (): Promise<unknown[]> => {
  const plans: unknown[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase.from("training_plan").select("workouts_json").range(from, from + PAGE - 1);
    if (error) throw error;
    const rows = (data ?? []) as { workouts_json: unknown }[];
    plans.push(...rows.map((row) => row.workouts_json));
    if (rows.length < PAGE) return plans;
  }
};

/** La biblioteca entera, solo lo que hace falta para contar y generar. */
const readLibrary = async (): Promise<PlanVideoExercise[]> => {
  const rows: PlanVideoExercise[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase.from("exercises").select("id, name, image_url, video_url").order("name").range(from, from + PAGE - 1);
    if (error) throw error;
    const page = (data ?? []) as PlanVideoExercise[];
    rows.push(...page);
    if (page.length < PAGE) return rows;
  }
};

/** ¿Vídeos en pausa? (`app_secrets.AI_VIDEO_ENABLED = "0"`, el interruptor de Claves de IA). Solo se lee. */
const readPaused = async (): Promise<boolean> => {
  const { data } = await supabase.from("app_secrets").select("value").eq("key", "AI_VIDEO_ENABLED").maybeSingle();
  return (data as { value?: string } | null)?.value === "0";
};

const callVideo = async (exerciseId: string, action: "create" | "check"): Promise<VideoResponse> => {
  const { data, error } = await supabase.functions.invoke<VideoResponse>("exercise-video", { body: { exercise_id: exerciseId, action } });
  if (error) throw new Error(await functionErrorMessage(error, "No se pudo crear el vídeo"));
  if (data?.error) throw new Error(data.error);
  return data ?? {};
};

const wait = (ms: number) => new Promise<void>((resolve) => { window.setTimeout(resolve, ms); });

/**
 * Admin → Biblioteca: «Generar vídeos de los ejercicios de los planes». Cuenta los ejercicios que
 * usan los planes y aún no tienen vídeo, enseña el coste (≈1,6 créditos de Lovable por clip de
 * 4 s), pide confirmación y los crea uno a uno con `exercise-video` (create → check), saltando los
 * que ya tienen vídeo, con «Parar» al terminar el actual. Si los vídeos están en pausa en Claves de
 * IA lo dice y no lanza nada. Es `AdminPlanVideosCard` en la app.
 */
export default function PlanVideos({ onChanged }: { onChanged?: () => void }) {
  const [queue, setQueue] = useState<PlanVideoQueue | null>(null);
  const [paused, setPaused] = useState(false);
  const [failed, setFailed] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [run, setRun] = useState<Run | null>(null);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const stopRef = useRef(false);
  const alive = useRef(true);

  const count = useCallback(async () => {
    const [plans, library, isPaused] = await Promise.all([readPlans(), readLibrary(), readPaused()]);
    const next = planVideoQueue(library, planExerciseKeys(plans));
    if (alive.current) { setQueue(next); setPaused(isPaused); setFailed(false); }
    return { next, isPaused };
  }, []);

  const refresh = useCallback(() => {
    setFailed(false);
    count().catch(() => { if (alive.current) setFailed(true); });
  }, [count]);

  useEffect(() => {
    alive.current = true;
    refresh();
    return () => { alive.current = false; stopRef.current = true; };
  }, [refresh]);

  /** Uno detrás de otro: crear, esperar a que esté y pasar al siguiente. */
  const generate = async () => {
    setConfirming(false);
    setOutcome(null);
    stopRef.current = false;
    let fresh: PlanVideoQueue;
    try {
      // Con datos recién leídos: lo que haya conseguido vídeo entretanto se salta.
      const { next, isPaused } = await count();
      if (isPaused) return;
      fresh = next;
    } catch {
      setFailed(true);
      return;
    }
    const list = fresh.ready;
    const failures: Failure[] = [];
    let created = 0;
    let stopped = false;
    let creditsOut = false;
    setRun({ current: 0, total: list.length, name: "", created: 0, failures: [], stopping: false });

    for (let index = 0; index < list.length; index++) {
      if (stopRef.current || !alive.current) { stopped = true; break; }
      const exercise = list[index];
      setRun((r) => r && { ...r, current: index + 1, name: exercise.name });
      try {
        const started = await callVideo(exercise.id, "create");
        if (started.paused) { setPaused(true); stopped = true; break; }
        let url = started.status === "completed" ? started.video_url ?? null : null;
        const deadline = Date.now() + PLAN_VIDEO_DEADLINE_MS;
        while (!url && Date.now() < deadline && alive.current) {
          await wait(PLAN_VIDEO_POLL_MS);
          const status = await callVideo(exercise.id, "check");
          if (status.status === "completed" && status.video_url) url = status.video_url;
          else if (status.status === "failed") throw new Error(status.error || "La generación del vídeo falló");
        }
        if (!url) throw new Error("Sigue generándose: aparecerá en su ficha en unos minutos");
        created++;
        setRun((r) => r && { ...r, created });
      } catch (error) {
        const message = errorMessage(error) || "No se pudo crear el vídeo";
        failures.push({ name: exercise.name, message });
        setRun((r) => r && { ...r, failures: [...failures] });
        // Sin saldo: se para toda la cola en vez de fallar uno a uno.
        if (isCreditsError(message)) { creditsOut = true; break; }
      }
    }

    if (!alive.current) return;
    setRun(null);
    void hapticNotify(failures.length > 0 ? "warning" : "success");
    setOutcome({
      text: creditsOut ? PLAN_VIDEOS_COPY.creditsOut : planVideoDone(created, list.length, stopped),
      failures,
    });
    onChanged?.();
    refresh();
  };

  const stop = () => {
    void hapticTap();
    stopRef.current = true;
    setRun((r) => r && { ...r, stopping: true });
  };

  const missing = queue?.missing.length ?? 0;
  const ready = queue?.ready.length ?? 0;

  return (
    <section aria-labelledby="plan-videos-title" className="space-y-3 rounded-[22px] bg-card p-5">
      <h2 id="plan-videos-title" className="type-headline">{PLAN_VIDEOS_COPY.title}</h2>
      <p className="type-footnote text-muted-foreground">{PLAN_VIDEOS_COPY.body}</p>

      {failed ? (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p role="alert" className="type-footnote text-muted-foreground">{PLAN_VIDEOS_COPY.loadError}</p>
          <Button type="button" size="sm" variant="secondary" onClick={() => { void hapticTap(); refresh(); }}>{PLAN_VIDEOS_COPY.retry}</Button>
        </div>
      ) : !queue ? (
        <p role="status" className="type-footnote text-muted-foreground">{PLAN_VIDEOS_COPY.counting}</p>
      ) : (
        <>
          {queue.inPlans > 0 && (
            // Las dos cifras que deciden: cuántos faltan y cuánto cuestan.
            <div className="grid grid-cols-2 gap-3">
              <p className="min-w-0 rounded-[16px] bg-secondary px-4 py-3">
                <span className="block type-figure text-[34px] tabular-nums">{missing.toLocaleString("es-ES")}</span>
                <span className="mt-1 block type-footnote text-muted-foreground">sin vídeo</span>
              </p>
              <p className="min-w-0 rounded-[16px] bg-secondary px-4 py-3">
                <span className="block whitespace-nowrap type-figure text-[34px] tabular-nums">≈{formatCredits(planVideoCredits(ready))}</span>
                <span className="mt-1 block type-footnote text-muted-foreground">créditos de Lovable</span>
              </p>
            </div>
          )}
          <p role="status" className="type-footnote tabular-nums">
            {queue.inPlans === 0 ? PLAN_VIDEOS_COPY.noPlans : missing === 0 ? PLAN_VIDEOS_COPY.allDone : planVideoSummary(queue)}
          </p>
          {ready > 0 && !run && <p className="type-footnote tabular-nums text-muted-foreground">{planVideoEstimate(ready)}</p>}
          {queue.needPhoto.length > 0 && !run && <p className="type-footnote text-muted-foreground">{planVideoNeedPhoto(queue.needPhoto.length)}</p>}
        </>
      )}

      {run && (
        <div className="space-y-2" aria-live="polite">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p role="status" className="type-subhead font-semibold tabular-nums">{planVideoProgress(Math.max(run.current, 1), run.total)}</p>
              <p className="truncate type-footnote text-muted-foreground">{run.stopping ? PLAN_VIDEOS_COPY.stopping : run.name}</p>
            </div>
            <Button type="button" size="sm" variant="secondary" className="shrink-0" disabled={run.stopping} onClick={stop}>
              {PLAN_VIDEOS_COPY.stop}
            </Button>
          </div>
          <Progress value={(Math.max(run.current - 1, 0) / Math.max(run.total, 1)) * 100} aria-label="Progreso de los vídeos" />
          <p className="type-footnote text-muted-foreground">Mantén esta pantalla abierta: cada vídeo tarda de 1 a 3 minutos.</p>
        </div>
      )}

      {outcome && !run && <p role="status" className="type-footnote">{outcome.text}</p>}

      {(run?.failures.length || (!run && outcome?.failures.length)) ? (
        <div className="space-y-1">
          <p className="type-footnote font-semibold">{PLAN_VIDEOS_COPY.failures} ({(run?.failures ?? outcome?.failures ?? []).length})</p>
          <ul className="space-y-1">
            {(run?.failures ?? outcome?.failures ?? []).map((failure, index) => (
              <li key={`${failure.name}-${index}`} className="type-footnote text-muted-foreground">
                <span className="text-foreground">{failure.name}</span> · {failure.message}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {paused ? (
        <div className="space-y-2">
          <Button type="button" size="sm" variant="secondary" disabled>{PLAN_VIDEOS_COPY.paused}</Button>
          <p role="note" className="type-footnote text-muted-foreground">{PLAN_VIDEOS_COPY.pausedHelp}</p>
        </div>
      ) : !run && (
        <Button
          type="button"
          size="sm"
          variant="secondary"
          className="h-auto min-h-11 whitespace-normal py-2.5"
          disabled={!queue || ready === 0}
          onClick={() => { void hapticTap(); setConfirming(true); }}
        >
          {PLAN_VIDEOS_COPY.button}
        </Button>
      )}

      <AlertDialog open={confirming} onOpenChange={setConfirming}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{planVideoConfirmTitle(ready)}</AlertDialogTitle>
            <AlertDialogDescription>{planVideoConfirmBody(ready)}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{PLAN_VIDEOS_COPY.cancel}</AlertDialogCancel>
            <AlertDialogAction onClick={(event) => { event.preventDefault(); void generate(); }}>
              {planVideoConfirmAction(ready)}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
