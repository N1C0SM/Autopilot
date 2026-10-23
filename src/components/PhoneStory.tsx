import { Pause } from "lucide-react";
import { PhoneAppBar, PhoneFrame, PhoneHome } from "@/components/PublicPhone";
import { useScrollProgress } from "@/hooks/useScrollProgress";
import { usePlanAvailability } from "@/lib/planCatalog";

// Mismos datos de ejemplo que la demo interactiva (ProductPreview): nada que la app no haga.
const SETS = [
  { kg: "20", reps: "9", done: true },
  { kg: "20", reps: "9", done: true },
  { kg: "20", reps: "", done: false },
];
const HISTORY = [{ d: "4 sep", kg: 18 }, { d: "11 sep", kg: 18 }, { d: "18 sep", kg: 20 }, { d: "25 sep", kg: 20 }];

function WorkoutScreen() {
  return <div className="flex h-full flex-col px-4 pt-3">
    <p className="type-subhead font-semibold text-muted-foreground">Ejercicio 1 de 3</p>
    <p className="mt-0.5 type-title1">Sentadilla goblet</p>
    <p className="mt-1 type-subhead text-muted-foreground">Última vez: 18 kg × 10</p>
    <div className="mt-6 grid grid-cols-[2rem_1fr_1fr_2rem] gap-2 px-1 type-footnote text-muted-foreground"><span className="text-center">#</span><span className="text-center">kg</span><span className="text-center">Reps</span><span /></div>
    {SETS.map((s, i) => <div key={i} className="mt-2 grid grid-cols-[2rem_1fr_1fr_2rem] items-center gap-2">
      <span className="text-center type-headline tabular-nums">{i + 1}</span>
      <span className={`rounded-lg py-2 text-center type-body tabular-nums ${s.done ? "bg-primary/15 text-foreground" : "bg-secondary text-muted-foreground"}`}>{s.kg}</span>
      <span className={`rounded-lg py-2 text-center type-body tabular-nums ${s.done ? "bg-primary/15 text-foreground" : "bg-secondary text-muted-foreground"}`}>{s.reps || "—"}</span>
      <span className={`mx-auto h-5 w-5 rounded-full ${s.done ? "bg-primary" : "border-2 border-muted-foreground/40"}`} aria-hidden="true" />
    </div>)}
    <div className="material mx-2 mt-auto mb-24 flex items-center justify-between rounded-full px-5 py-3 shadow-[0_8px_32px_rgba(0,0,0,0.5)]">
      <span className="type-subhead text-muted-foreground">Descanso</span>
      <span className="font-rounded type-title2 tabular-nums">1:24</span>
      <Pause className="h-5 w-5 text-primary" aria-hidden="true" />
    </div>
  </div>;
}

function ProgressScreen({ suggest }: { suggest: boolean }) {
  const max = 22, min = 14;
  return <div className="flex h-full flex-col px-4 pt-3">
    <p className="type-subhead font-semibold text-muted-foreground">Progreso</p>
    <p className="mt-0.5 type-title1">Sentadilla goblet</p>
    <div className="mt-6 flex h-40 items-end gap-3 rounded-2xl bg-card p-4">
      {HISTORY.map((h, i) => <div key={h.d} className="flex flex-1 flex-col items-center gap-2">
        <span className="type-caption1 tabular-nums text-muted-foreground">{h.kg}</span>
        <div className={`w-full rounded-md ${i === HISTORY.length - 1 ? "bg-primary" : "bg-primary/35"}`} style={{ height: `${((h.kg - min) / (max - min)) * 90}px` }} />
        <span className="type-caption2 text-muted-foreground">{h.d}</span>
      </div>)}
    </div>
    <div className="mt-4 grid grid-cols-2 gap-3">
      {[["Volumen", "540 kg"], ["Récord", "20 kg × 10"]].map(([k, v]) => <div key={k} className="rounded-2xl bg-card p-3"><p className="type-caption1 text-muted-foreground">{k}</p><p className="type-headline tabular-nums">{v}</p></div>)}
    </div>
    {suggest && <div className="mt-4 rounded-2xl bg-primary/15 p-3"><p className="type-caption1 text-primary">Próxima sesión</p><p className="type-subhead">La carga se calcula con tus registros.</p></div>}
  </div>;
}

/**
 * Demostración tipo página de producto: el teléfono queda fijo y su pantalla cambia
 * con el scroll, sincronizada con el texto. Sin movimiento, las tres escenas en lista.
 */
export default function PhoneStory() {
  const plans = usePlanAvailability();
  // La recomendación de carga solo se anuncia donde el producto la calcula (Plus o campaña abierta).
  const suggest = plans.campaign || plans.plus;
  const scenes = [
    { eyebrow: "Tu día está preparado", title: "Abres la app. Sabes qué toca.", text: "La rutina del día ya está organizada: no tienes que decidir qué ejercicio hacer.", screen: <div className="px-4 pt-3"><PhoneHome plans={plans} /></div> },
    { eyebrow: "Cada serie cuenta", title: "Entrena. Registra. Sigue.", text: "Apunta peso y repeticiones de cada serie; el historial de tus sesiones queda guardado.", screen: <WorkoutScreen /> },
    { eyebrow: "Visualiza tu progreso", title: "Mira cómo progresas.", text: suggest ? "Consulta tus registros y tu evolución. La siguiente carga se calcula con ellos." : "Consulta tus registros y entiende tu evolución.", screen: <ProgressScreen suggest={suggest} /> },
  ];
  // Una pantalla y media por escena en escritorio: tiempo para leer y mirar; en móvil, una.
  const SCREENS = typeof window !== "undefined" && window.innerWidth >= 768 ? 4.5 : 3.5;
  const [ref, p, pin] = useScrollProgress<HTMLElement>(-1);
  const still = p < 0;
  const t = still ? 0 : pin * scenes.length;
  const current = Math.min(scenes.length - 1, Math.floor(t));

  const phone = (i: number, style?: React.CSSProperties) => <div key={i} className="absolute inset-0" style={style} aria-hidden={i !== current}>
    <PhoneFrame screenClassName="h-[37rem]"><PhoneAppBar avatar="N" /><div className="flex-1 overflow-hidden">{scenes[i].screen}</div></PhoneFrame>
  </div>;

  if (still) return <section ref={ref} aria-label="Así funciona la app" className="space-y-16 px-5 py-20 sm:px-8">
    {scenes.map((s, i) => <div key={s.title} className="mx-auto max-w-sm text-center"><p className="type-subhead text-primary">{s.eyebrow}</p><h3 className="mt-2 type-title1">{s.title}</h3><p className="mt-2 type-body text-muted-foreground">{s.text}</p><div className="relative mt-6 h-[37rem]">{phone(i)}</div></div>)}
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
        <div className="relative mx-auto h-[min(37rem,62vh)] w-full max-w-[19rem] md:max-w-[22rem]" style={{ transform: `scale(${0.97 + Math.sin((t % 1) * Math.PI) * 0.03})` }}>
          <div className="absolute inset-0 origin-top scale-[0.85] md:scale-100">
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
