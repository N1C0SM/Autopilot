import { useEffect } from "react";
import { BrandMark } from "@/shared/components/ui/brand-mark";

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
      <span className="relative flex flex-col items-center text-center animate-in fade-in duration-300 motion-reduce:animate-none">
        <BrandMark size={40} />
        {/* Sobre el velo negro el texto va en blanco también en modo claro; la cifra en Big Shoulders y
            sin partirse («+2,5 kg» entero), y el titular en minúsculas, nunca un antetítulo en mayúsculas. */}
        <span className="mt-6 type-headline text-primary">Nuevo récord personal</span>
        <span className="mt-2 whitespace-nowrap type-figure text-[clamp(56px,22vw,88px)] leading-none text-white">{moment.diff}</span>
        <span className="mt-3 max-w-xs type-title3 text-white/75">{moment.exercise}</span>
      </span>
    </button>}
  </div>;
}
