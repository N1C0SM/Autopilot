import { useEffect, useState } from "react";
import { Check, Clock, UserRound } from "lucide-react";
import { hapticTap } from "@/lib/native";
import { Button } from "@/components/ui/button";
import { Surface } from "@/components/ui/surface";
import { EmptyState } from "@/components/ui/empty-state";
import type { MacroTargets } from "@/lib/nutrition";

interface Meal {
  name: string;
  description: string;
}

interface Props {
  meals: Meal[];
  macros?: MacroTargets | null;
  onOpenProfile?: () => void;
}

const todayKey = () => {
  const d = new Date();
  return `meals_done_${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
};

const MealsList = ({ meals, macros, onOpenProfile }: Props) => {
  const [done, setDone] = useState<Set<string>>(new Set());

  useEffect(() => {
    try {
      const raw = localStorage.getItem(todayKey());
      if (raw) setDone(new Set(JSON.parse(raw)));
    } catch { /* ignore */ }
  }, []);

  const toggle = (name: string) => {
    const next = new Set(done);
    if (next.has(name)) {
      next.delete(name);
    } else {
      next.add(name);
      void hapticTap();
    }
    setDone(next);
    try { localStorage.setItem(todayKey(), JSON.stringify(Array.from(next))); } catch { /* ignore */ }
  };

  const ratio = meals.length ? meals.filter((m) => done.has(m.name)).length / meals.length : 0;
  const p = Number(macros?.protein) || 0;
  const c = Number(macros?.carbs) || 0;
  const f = Number(macros?.fats) || 0;
  const kcal = Number(macros?.calories) || Math.round(p * 4 + c * 4 + f * 9);
  const fmt = (n: number) => Math.round(n).toLocaleString("es-ES");
  // Rueda de progreso del día
  const R = 42;
  const C = 2 * Math.PI * R;

  // Sin comidas ni objetivos: avisamos con calma en vez de mostrar una pantalla vacía.
  if (!meals.length && kcal <= 0) {
    return (
      <EmptyState
        icon={Clock}
        title="Tu plan está en preparación"
        description="En cuanto tu entrenador lo cierre verás aquí tus calorías, macros y comidas del día."
      />
    );
  }

  const chips = [
    { l: "Proteína", short: "Prot.", v: p },
    { l: "Carbos", short: "Carb.", v: c },
    { l: "Grasas", short: "Gras.", v: f },
  ];

  return (
    <div className="space-y-2">
      {meals.length > 0 && !macros && (
        <Surface padding="sm" className="flex flex-wrap items-start gap-2">
          <UserRound className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">Aún no hay objetivos de macros personalizados</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Actualiza tu peso en Perfil y coméntaselo a tu entrenador. Las comidas de abajo son orientativas.
            </p>
          </div>
          {onOpenProfile && (
            <Button variant="outline" size="sm" className="ml-auto shrink-0" onClick={onOpenProfile}>
              Actualizar peso en Perfil
            </Button>
          )}
        </Surface>
      )}

      {macros && kcal > 0 && (
        <Surface padding="sm">
          <div className="flex items-center gap-4">
            {/* La rueda: de un vistazo, cuánto llevas del día */}
            <svg
              viewBox="0 0 100 100"
              className="h-20 w-20 shrink-0 -rotate-90"
              role="img"
              aria-label={`${Math.round(ratio * 100)} % de tus comidas de hoy`}
            >
              <circle cx="50" cy="50" r={R} fill="none" strokeWidth="9" className="stroke-muted" />
              <circle
                cx="50" cy="50" r={R} fill="none" strokeWidth="9" strokeLinecap="round"
                className="stroke-primary transition-all duration-700"
                strokeDasharray={C}
                strokeDashoffset={C * (1 - ratio)}
              />
            </svg>
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline gap-1.5">
                <span className="font-display text-2xl font-bold tabular-nums">{fmt(kcal * ratio)}</span>
                <span className="text-xs text-muted-foreground">de {fmt(kcal)} kcal</span>
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Según las comidas que marques hoy
              </p>
            </div>
          </div>
          <div className="mt-2 grid grid-cols-3 gap-1.5">
            {chips.map((m) => (
              <span
                key={m.l}
                aria-label={`${m.l}: ${fmt(m.v * ratio)} de ${fmt(m.v)} gramos`}
                className="flex items-baseline justify-center gap-1 rounded-full bg-secondary/60 px-1.5 py-1 text-xs"
              >
                <span className="text-muted-foreground">{m.short}</span>
                <span className="font-semibold tabular-nums">{fmt(m.v * ratio)}</span>
                <span className="text-muted-foreground">/{fmt(m.v)}g</span>
              </span>
            ))}
          </div>
        </Surface>
      )}

      {meals.length === 0 ? (
        <EmptyState
          icon={Clock}
          title="Sin comidas todavía"
          description="Tu entrenador las añadirá en cuanto cierre el plan."
        />
      ) : (
        <Surface padding="none" className="divide-y divide-border overflow-hidden">
          {meals.map((meal, i) => {
            const isDone = done.has(meal.name);
            return (
              <button
                key={i}
                type="button"
                onClick={() => toggle(meal.name)}
                aria-pressed={isDone}
                className="flex min-h-14 w-full items-center gap-3 px-3 py-2 text-left transition-colors hover:bg-muted/40"
              >
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold">{meal.name}</span>
                  <span className="mt-0.5 line-clamp-2 block text-xs leading-relaxed text-muted-foreground">
                    {meal.description}
                  </span>
                </span>
                <span
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border transition-colors ${isDone ? "border-primary bg-primary" : "border-border"}`}
                >
                  {isDone && <Check className="h-4 w-4 text-primary-foreground" />}
                </span>
              </button>
            );
          })}
        </Surface>
      )}
    </div>
  );
};

export default MealsList;
