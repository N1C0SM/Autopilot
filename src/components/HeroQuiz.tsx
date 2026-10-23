import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { track } from "@/lib/analytics";
import { hapticTap } from "@/lib/native";

// Solo visual: no escribe nada que lea el onboarding.
const GOALS = [
  { value: "lose_weight", label: "Perder grasa" },
  { value: "gain_muscle", label: "Ganar músculo" },
  { value: "recomp", label: "Las dos cosas" },
  { value: "general_health", label: "Estar en forma" },
] as const;

const PLACES = [
  { value: "gimnasio", label: "Gimnasio" },
  { value: "calistenia", label: "En casa / calistenia" },
  { value: "mixto", label: "Un poco de todo" },
] as const;

// Vista previa orientativa; la rutina real la genera el onboarding con todos los datos.
const PREVIEW: Record<string, string[]> = {
  gimnasio: ["Empuje · press banca", "Pierna · sentadilla", "Tirón · remo y dominadas"],
  calistenia: ["Empuje · fondos y flexiones", "Pierna · zancadas y sentadilla", "Tirón · dominadas asistidas"],
  mixto: ["Torso · press y remo", "Pierna · sentadilla y peso muerto", "Full body · circuito"],
};

type Goal = (typeof GOALS)[number]["value"];
type Place = (typeof PLACES)[number]["value"];

export default function HeroQuiz() {
  const navigate = useNavigate();
  const [goal, setGoal] = useState<Goal | null>(null);
  const [place, setPlace] = useState<Place | null>(null);
  const step = !goal ? 0 : !place ? 1 : 2;

  const pick = (fn: () => void, answer: Record<string, string>) => {
    void hapticTap();
    track("hero_quiz_answer", answer);
    fn();
  };

  const start = () => {
    void hapticTap();
    track("cta_click", { cta: "free_signup", source: "hero_quiz" });
    navigate("/onboarding");
  };

  const chip = "flex min-h-12 items-center gap-2 rounded-2xl bg-card px-4 text-left type-body transition-opacity active:opacity-60";

  return <div className="mx-auto mt-8 max-w-md rounded-3xl bg-secondary/60 p-4 text-left sm:p-5" aria-live="polite">
    <div className="mb-3 flex items-center justify-between">
      <p className="type-headline">{step === 0 ? "¿Qué quieres conseguir?" : step === 1 ? "¿Dónde entrenas?" : "Tu semana tipo"}</p>
      <div className="flex gap-1" aria-label={`Paso ${step + 1} de 3`}>
        {[0, 1, 2].map((i) => <span key={i} className={`h-1.5 rounded-full transition-all duration-500 ${i === step ? "w-8" : "w-5"} ${i <= step ? "bg-primary" : "bg-muted-foreground/20"}`} />)}
      </div>
    </div>
    {step === 0 && <div key="s0" className="animate-in fade-in duration-300 grid grid-cols-2 gap-2">
      {GOALS.map((g) => <button key={g.value} type="button" className={chip} onClick={() => pick(() => setGoal(g.value), { goal: g.value })}>{g.label}</button>)}
    </div>}
    {step === 1 && <div key="s1" className="animate-in fade-in duration-300 grid gap-2">
      {PLACES.map((p) => <button key={p.value} type="button" className={chip} onClick={() => pick(() => setPlace(p.value), { place: p.value })}>{p.label}</button>)}
      <button type="button" className="min-h-11 type-footnote text-muted-foreground" onClick={() => setGoal(null)}>Volver</button>
    </div>}
    {step === 2 && place && <div key="s2" className="animate-in fade-in duration-300">
      <ol className="grid gap-2">
        {PREVIEW[place].map((d, i) => <li key={d} style={{ animationDelay: `${i * 120}ms` }} className="animate-in fade-in fill-mode-both duration-500 flex items-center gap-3 rounded-2xl bg-card px-4 py-3">
          <span className="font-rounded type-headline tabular-nums text-primary">D{i + 1}</span>
          <span className="type-subhead">{d}</span>
        </li>)}
      </ol>
      <p className="mt-2 type-footnote text-muted-foreground">Ejemplo orientativo. La tuya se ajusta a tus días, nivel y lesiones.</p>
      <Button variant="hero" size="lg" className="mt-4 w-full" onClick={start}>Crear esta rutina gratis</Button>
      <button type="button" className="mt-1 min-h-11 w-full type-footnote text-muted-foreground" onClick={() => setPlace(null)}>Cambiar respuestas</button>
    </div>}
  </div>;
}
