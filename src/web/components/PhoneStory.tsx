import { Home, Dumbbell, Apple, Sparkles } from "lucide-react";
import { PublicTrainingScreen, PublicProgressScreen } from "@/web/components/PublicAppScreen";
import { PhoneAppBar, PhoneFrame, PhoneHome, PhoneShot, PhoneTabBar } from "@/web/components/PublicPhone";
import { useScrollProgress } from "@/shared/hooks/useScrollProgress";
import { usePlanAvailability } from "@/shared/lib/planCatalog";

/**
 * Demostración tipo página de producto: el teléfono queda fijo y su pantalla cambia
 * con el scroll, sincronizada con el texto. Sin movimiento, las tres escenas en lista.
 */
export default function PhoneStory() {
  const plans = usePlanAvailability();
  // La recomendación de carga solo se anuncia donde el producto la calcula (Plus o campaña abierta).
  const suggest = plans.campaign || plans.plus;
  const scenes = [
    { eyebrow: "Tu día está preparado", title: "Abres la app. Sabes qué toca.", text: "La rutina del día ya está organizada: no tienes que decidir qué ejercicio hacer.", shot: "/app-shots/hoy.jpg", fallback: <div className="px-4 pt-3"><PhoneHome plans={plans} /></div> },
    { eyebrow: "Cada serie cuenta", title: "Entrena. Registra. Sigue.", text: "Apunta peso y repeticiones de cada serie; el historial de tus sesiones queda guardado.", shot: "/app-shots/registro.jpg", fallback: <PublicTrainingScreen active /> },
    { eyebrow: "Visualiza tu progreso", title: "Mira cómo progresas.", text: suggest ? "Consulta tus registros y tu evolución. La siguiente carga se calcula con ellos." : "Consulta tus registros y entiende tu evolución.", shot: "/app-shots/progreso.jpg", fallback: <PublicProgressScreen /> },
  ];
  // Una pantalla y media por escena en escritorio: tiempo para leer y mirar; en móvil, una.
  const SCREENS = typeof window !== "undefined" && window.innerWidth >= 768 ? 3 : 2.5;
  const [ref, p, pin] = useScrollProgress<HTMLElement>(-1);
  const still = p < 0;
  const t = still ? 0 : pin * scenes.length;
  const current = Math.min(scenes.length - 1, Math.floor(t));

  const phone = (i: number, style?: React.CSSProperties) => <div key={i} className="absolute inset-0" style={style} aria-hidden={i !== current}>
    <PhoneShot
      src={scenes[i].shot}
      alt={scenes[i].title}
      fallback={
        <PhoneFrame screenClassName="h-[44rem]"><PhoneAppBar avatar="N" /><div className={`flex-1 overflow-hidden ${i === 1 ? "" : "pb-24"}`}>{scenes[i].fallback}</div>{i !== 1 && <PhoneTabBar tabs={[{ key: "home", label: "Hoy", icon: Home }, { key: "training", label: "Entrenar", icon: Dumbbell }, { key: "nutrition", label: "Nutrición", icon: Apple }, { key: "progress", label: "Progreso", icon: Sparkles }]} active={i === 0 ? "home" : "progress"} onSelect={() => undefined} />}</PhoneFrame>
      }
    />
  </div>;

  if (still) return <section ref={ref} aria-label="Así funciona la app" className="space-y-16 px-5 py-20 sm:px-8">
    {scenes.map((s, i) => <div key={s.title} className="mx-auto max-w-sm text-center"><p className="type-subhead text-primary">{s.eyebrow}</p><h3 className="mt-2 type-title1">{s.title}</h3><p className="mt-2 type-body text-muted-foreground">{s.text}</p><div className="relative mt-6 h-[44rem]">{phone(i)}</div></div>)}
  </section>;

  return <section ref={ref} aria-label="Así funciona la app" data-pinned className="relative" style={{ height: `${SCREENS * 100}vh` }}>
    {/* VoiceOver no hace scroll: lee las tres escenas aquí; la capa animada queda oculta. */}
    <ol className="sr-only">{scenes.map((s) => <li key={s.title}><h3>{s.title}</h3><p>{s.text}</p></li>)}</ol>
    <div aria-hidden="true" className="sticky top-0 flex h-screen items-center justify-center overflow-hidden px-5 sm:px-8">
      <div className="mx-auto grid w-full max-w-5xl items-center gap-6 md:grid-cols-2 md:gap-16">
        {/* Texto: en móvil va encima del teléfono, en escritorio a la izquierda. */}
        <div className="relative h-28 text-center md:h-48 md:text-left">
          {scenes.map((s, i) => {
            const local = t - i;
            const o = i === current ? Math.min(1, local * 5 + (i === 0 ? 1 : 0), (1 - local) * 5 + (i === scenes.length - 1 ? 1 : 0)) : 0;
            return <div key={s.title} className="absolute inset-0" style={{ opacity: o, transform: `translateY(${(1 - o) * 16}px)` }} aria-hidden={i !== current}>
              <p className="type-subhead text-primary">{s.eyebrow}</p>
              <h3 className="mt-2 font-rounded text-[28px] font-bold leading-[1.1] tracking-tight md:text-[48px]">{s.title}</h3>
              <p className="mx-auto mt-3 hidden max-w-sm type-body text-muted-foreground md:mx-0 md:block md:text-[19px] md:leading-[26px]">{s.text}</p>
            </div>;
          })}
        </div>
        <div className="relative mx-auto h-[min(44rem,62vh)] w-full max-w-[19rem] md:max-w-[19rem]" style={{ transform: `scale(${0.97 + Math.sin((t % 1) * Math.PI) * 0.03})` }}>
          <div className="absolute inset-0 origin-top scale-[0.72] md:scale-[0.85]">
            {scenes.map((_, i) => {
              const local = t - i;
              const o = i === current ? Math.min(1, local * 6 + (i === 0 ? 1 : 0), (1 - local) * 6 + (i === scenes.length - 1 ? 1 : 0)) : 0;
              return phone(i, { opacity: o, transform: `scale(${0.98 + o * 0.02})` });
            })}
          </div>
        </div>
      </div>
      <div className="absolute bottom-8 left-1/2 flex -translate-x-1/2 gap-2" aria-hidden="true">
        {scenes.map((s, i) => <span key={s.title} className={`h-1.5 rounded-full transition-all duration-300 ${i === current ? "w-8 bg-primary" : "w-1.5 bg-muted-foreground/30"}`} />)}
      </div>
    </div>
  </section>;
}
