import { useEffect, useState } from "react";
import { Check, UserRound } from "lucide-react";
import { hapticTap } from "@/lib/native";
import { Button } from "@/components/ui/button";
import type { MacroTargets } from "@/lib/nutrition";

interface Meal {
  name: string;
  description: string;
}

interface Props {
  userId?: string;
  meals: Meal[];
  macros?: MacroTargets | null;
  onOpenProfile?: () => void;
}

const todayKey = (userId: string) => {
  const d = new Date();
  return `meals_done_${userId}_${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
};

const MealsList = ({ userId = "guest", meals, macros, onOpenProfile }: Props) => {
  const [done, setDone] = useState<Set<string>>(new Set());

  useEffect(() => {
    try {
      const raw = localStorage.getItem(todayKey(userId));
      setDone(raw ? new Set(JSON.parse(raw)) : new Set());
    } catch { /* ignore */ }
  }, [userId]);

  const toggle = (name: string) => {
    const next = new Set(done);
    if (next.has(name)) {
      next.delete(name);
    } else {
      next.add(name);
      void hapticTap();
    }
    setDone(next);
    try { localStorage.setItem(todayKey(userId), JSON.stringify(Array.from(next))); } catch { /* ignore */ }
  };

  const ratio = meals.length ? meals.filter((m) => done.has(m.name)).length / meals.length : 0;
  const p = Number(macros?.protein) || 0;
  const c = Number(macros?.carbs) || 0;
  const f = Number(macros?.fats) || 0;
  const kcal = Number(macros?.calories) || Math.round(p * 4 + c * 4 + f * 9);
  const R = 42;
  const C = 2 * Math.PI * R;
  const fmt = (n: number) => Math.round(n).toLocaleString("es-ES");

  // Sin comidas ni objetivos: avisamos con calma en vez de mostrar una pantalla vacía.
  if (!meals.length && kcal <= 0) {
    return (
      <div className="rounded-3xl bg-card border border-border p-4 sm:p-6 text-center">
        <div className="font-semibold mb-1">Tu plan de nutrición está en preparación</div>
        <p className="text-sm text-muted-foreground">
          En cuanto tu entrenador lo cierre lo verás aquí con tus calorías, macros y comidas del día.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {meals.length > 0 && !macros && (
        <div className="rounded-2xl border border-border bg-card p-4">
          <div className="flex items-start gap-3">
            <UserRound className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-sm">Aún no hay objetivos de macros personalizados</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Actualiza tu peso en Perfil y coméntaselo a tu entrenador para revisar tus objetivos. Las comidas de abajo son orientativas.
              </p>
              {onOpenProfile && (
                <Button variant="outline" size="sm" className="mt-3" onClick={onOpenProfile}>
                  Actualizar peso en Perfil
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
      {macros && kcal > 0 && (
        <>
          <div className="rounded-3xl bg-card border border-border p-4 sm:p-5 flex items-center gap-4 sm:gap-5">
            <svg viewBox="0 0 100 100" className="w-24 h-24 -rotate-90 shrink-0">
              <circle cx="50" cy="50" r={R} fill="none" strokeWidth="9" className="stroke-muted" />
              <circle
                cx="50" cy="50" r={R} fill="none" strokeWidth="9" strokeLinecap="round"
                className="stroke-primary transition-all duration-700"
                strokeDasharray={C} strokeDashoffset={C * (1 - ratio)}
              />
            </svg>
            <div>
              <div className="text-3xl font-bold font-display">{fmt(kcal)}</div>
              <div className="text-sm text-muted-foreground">kcal previstas</div>
              <div className="text-[11px] text-muted-foreground mt-1">Objetivo del menú; no es consumo registrado</div>
            </div>
          </div>
          <div className="grid grid-cols-1 min-[380px]:grid-cols-3 gap-2 sm:gap-3">
            {[{ l: "Proteína", v: p }, { l: "Carbos", v: c }, { l: "Grasas", v: f }].map((m) => (
              <div key={m.l} className="rounded-2xl bg-card border border-border p-3.5 sm:p-3">
                <div className="text-sm sm:text-xs text-muted-foreground">{m.l}</div>
                <div className="font-bold font-display">
                  {fmt(m.v)}<span className="text-xs font-normal text-muted-foreground"> g previstas</span>
                </div>
                <div className="h-1.5 rounded-full bg-muted mt-2 overflow-hidden">
                  <div className="h-full bg-primary rounded-full transition-all duration-700" style={{ width: `${ratio * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <p className="text-xs text-muted-foreground">Marcas rápidas del menú en este dispositivo: no registran cantidades ni calorías consumidas. Para compartir el consumo con tu entrenador, usa Alimentación registrada.</p>
      <div className="rounded-3xl bg-card border border-border divide-y divide-border overflow-hidden">
        {meals.map((meal, i) => {
          const isDone = done.has(meal.name);
          return (
            <button
              key={i}
              type="button"
              onClick={() => toggle(meal.name)}
              aria-pressed={isDone}
              className="w-full text-left flex items-center gap-3 p-4 sm:p-5 hover:bg-muted/40 transition-colors"
            >
              <div className="flex-1 min-w-0">
                <div className="font-semibold">{meal.name}</div>
                <div className="text-sm leading-relaxed text-muted-foreground">{meal.description}</div>
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
