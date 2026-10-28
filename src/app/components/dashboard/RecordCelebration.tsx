import { useEffect } from "react";
import { Trophy } from "lucide-react";

export type RecordMoment = { exercise: string; diff: string; key: number };

/**
 * Celebración de récord en directo: destello dorado, cifra grande y nombre del ejercicio.
 * Se cierra sola o con un toque; con «reducir movimiento» aparece sin escalar.
 * VoiceOver la anuncia por la región en directo.
 */
export default function RecordCelebration({ moment, onDone }: { moment: RecordMoment | null; onDone: () => void }) {
  useEffect(() => {
    if (!moment) return;
    const t = window.setTimeout(onDone, 2200);
    return () => window.clearTimeout(t);
  }, [moment, onDone]);

  return <div aria-live="assertive" className="contents">
    {moment && <button
      key={moment.key}
      type="button"
      onClick={onDone}
      aria-label={`Nuevo récord personal en ${moment.exercise}, ${moment.diff}. Toca para cerrar.`}
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 px-8 backdrop-blur-sm animate-in fade-in duration-200"
    >
      <span aria-hidden="true" className="pointer-events-none absolute h-[36rem] w-[36rem] rounded-full bg-[radial-gradient(closest-side,hsl(var(--primary)/0.45),transparent)] animate-in zoom-in-50 duration-700 motion-reduce:animate-none" />
      <span className="relative flex flex-col items-center text-center animate-in zoom-in-90 fade-in duration-300 motion-reduce:animate-none">
        <span className="flex h-16 w-16 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-[0_0_60px_hsl(var(--primary)/0.6)]">
          <Trophy className="h-8 w-8" strokeWidth={2.25} aria-hidden="true" />
        </span>
        <span className="mt-6 type-subhead font-semibold uppercase tracking-[0.12em] text-primary">Nuevo récord personal</span>
        <span className="mt-2 font-rounded text-[72px] font-bold leading-none tracking-tight tabular-nums text-foreground">{moment.diff}</span>
        <span className="mt-3 max-w-xs type-title3 text-muted-foreground">{moment.exercise}</span>
      </span>
    </button>}
  </div>;
}
