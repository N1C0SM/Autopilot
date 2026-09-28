import { useEffect, useState } from "react";
import { Check } from "lucide-react";

interface Meal {
  name: string;
  description: string;
}

interface Macros {
  protein: number;
  carbs: number;
  fats: number;
  calories?: number;
}

interface Props {
  meals: Meal[];
  macros?: Macros | null;
}

const todayKey = () => {
  const d = new Date();
  return `meals_done_${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
};

const MealsList = ({ meals, macros }: Props) => {
  const [done, setDone] = useState<Set<string>>(new Set());

  useEffect(() => {
    try {
      const raw = localStorage.getItem(todayKey());
      if (raw) setDone(new Set(JSON.parse(raw)));
    } catch { /* ignore */ }
  }, []);

  const toggle = (name: string) => {
    const next = new Set(done);
    if (next.has(name)) next.delete(name);
    else next.add(name);
    setDone(next);
    try { localStorage.setItem(todayKey(), JSON.stringify(Array.from(next))); } catch { /* ignore */ }
  };

  const ratio = meals.length ? meals.filter((m) => done.has(m.name)).length / meals.length : 0;
  const p = Number(macros?.protein) || 0;
  const c = Number(macros?.carbs) || 0;
  const f = Number(macros?.fats) || 0;
  const kcal = Number(macros?.calories) || Math.round(p * 4 + c * 4 + f * 9);
  const R = 42;
  const C = 2 * Math.PI * R;
  const fmt = (n: number) => Math.round(n).toLocaleString("es-ES");

  return (
    <div className="space-y-3">
      {macros && kcal > 0 && (
        <>
          <div className="rounded-3xl bg-card border border-border p-5 flex items-center gap-5">
            <svg viewBox="0 0 100 100" className="w-24 h-24 -rotate-90 shrink-0">
              <circle cx="50" cy="50" r={R} fill="none" strokeWidth="9" className="stroke-muted" />
              <circle
                cx="50" cy="50" r={R} fill="none" strokeWidth="9" strokeLinecap="round"
                className="stroke-primary transition-all duration-700"
                strokeDasharray={C} strokeDashoffset={C * (1 - ratio)}
              />
            </svg>
            <div>
              <div className="text-3xl font-bold font-display">{fmt(kcal * ratio)}</div>
              <div className="text-sm text-muted-foreground">de {fmt(kcal)} kcal</div>
              <div className="text-[11px] text-muted-foreground mt-1">Según las comidas que marques hoy</div>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {[{ l: "Proteína", v: p }, { l: "Carbos", v: c }, { l: "Grasas", v: f }].map((m) => (
              <div key={m.l} className="rounded-2xl bg-card border border-border p-3">
                <div className="text-xs text-muted-foreground">{m.l}</div>
                <div className="font-bold font-display">
                  {fmt(m.v * ratio)}<span className="text-xs font-normal text-muted-foreground">/{fmt(m.v)} g</span>
                </div>
                <div className="h-1.5 rounded-full bg-muted mt-2 overflow-hidden">
                  <div className="h-full bg-primary rounded-full transition-all duration-700" style={{ width: `${ratio * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <div className="rounded-3xl bg-card border border-border divide-y divide-border overflow-hidden">
        {meals.map((meal, i) => {
          const isDone = done.has(meal.name);
          return (
            <button
              key={i}
              type="button"
              onClick={() => toggle(meal.name)}
              className="w-full text-left flex items-center gap-3 p-4 hover:bg-muted/40 transition-colors"
            >
              <div className="flex-1 min-w-0">
                <div className="font-semibold">{meal.name}</div>
                <div className="text-sm text-muted-foreground">{meal.description}</div>
              </div>
              <div className={`w-7 h-7 rounded-full border flex items-center justify-center shrink-0 transition-colors ${isDone ? "bg-primary border-primary" : "border-border"}`}>
                {isDone && <Check className="w-4 h-4 text-primary-foreground" />}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default MealsList;
