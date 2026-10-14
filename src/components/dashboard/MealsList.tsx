import { useEffect, useState } from "react";
import { Check, Clock, TriangleAlert, UserRound, Utensils } from "lucide-react";
import { hapticTap } from "@/lib/native";
import { Button } from "@/components/ui/button";
import { Surface } from "@/components/ui/surface";
import { EmptyState } from "@/components/ui/empty-state";
import { ListGroup } from "@/components/ui/list";
import type { MacroTargets } from "@/lib/nutrition";
import { nutritionMacroError } from "@/lib/nutritionValidation";

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
    }
    void hapticTap();
    setDone(next);
    try { localStorage.setItem(todayKey(), JSON.stringify(Array.from(next))); } catch { /* ignore */ }
  };

  const ratio = meals.length ? meals.filter((m) => done.has(m.name)).length / meals.length : 0;
  const p = Number(macros?.protein) || 0;
  const c = Number(macros?.carbs) || 0;
  const f = Number(macros?.fats) || 0;
  const kcal = Number(macros?.calories) || Math.round(p * 4 + c * 4 + f * 9);
  const fmt = (n: number) => Math.round(n).toLocaleString("es-ES");
  const targetError = macros ? nutritionMacroError(macros) : null;
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

  const macroSummary = [
    { label: "Proteína", value: p },
    { label: "Carbos", value: c },
    { label: "Grasas", value: f },
  ];
  const doneCount = meals.filter((meal) => done.has(meal.name)).length;

  return (
    <div className="space-y-6">
      {targetError && (
        <Surface role="alert" className="flex items-start gap-3">
          <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0 text-destructive" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <p className="type-subhead font-semibold">Objetivos pendientes de revisión</p>
            <p className="mt-0.5 type-footnote text-muted-foreground">{targetError} Las comidas guardadas siguen disponibles.</p>
          </div>
        </Surface>
      )}
      {meals.length > 0 && !macros && (
        <Surface className="flex items-start gap-3">
          <UserRound className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <p className="type-subhead font-semibold">Tus macros aún no están personalizados</p>
            <p className="mt-0.5 type-footnote text-muted-foreground">
              Añade tu peso actual para calcularlos. Mientras tanto, las comidas de abajo son orientativas.
            </p>
            {onOpenProfile && (
              <Button
                variant="tinted"
                size="sm"
                className="mt-3"
                onClick={() => {
                  void hapticTap();
                  onOpenProfile();
                }}
              >
                Añadir peso
              </Button>
            )}
          </div>
        </Surface>
      )}

      {macros && kcal > 0 && !targetError && (
        <Surface>
          <div className="flex items-center gap-4">
            {/* La rueda: de un vistazo, cuánto llevas del día */}
            <div className="relative h-[88px] w-[88px] shrink-0">
              <svg
                viewBox="0 0 100 100"
                className="h-full w-full -rotate-90"
                role="img"
                aria-label={`${Math.round(ratio * 100)} % de tus comidas de hoy`}
              >
                <circle cx="50" cy="50" r={R} fill="none" strokeWidth="11" className="stroke-primary/20" />
                <circle
                  cx="50" cy="50" r={R} fill="none" strokeWidth="11" strokeLinecap="round"
                  className="stroke-primary transition-[stroke-dashoffset] duration-500 ease-ios"
                  strokeDasharray={C}
                  strokeDashoffset={C * (1 - ratio)}
                />
              </svg>
              <Utensils className="absolute inset-0 m-auto h-6 w-6 text-primary" aria-hidden="true" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-rounded text-[34px] font-bold leading-none tabular-nums">{fmt(kcal)}</p>
              <p className="mt-1.5 type-footnote text-muted-foreground">kcal de objetivo diario</p>
            </div>
          </div>
          <p className="mt-3 type-footnote text-muted-foreground">
            {doneCount} de {meals.length} comidas marcadas. Marcar comidas no mide las calorías consumidas.
          </p>
          <div className="mt-3 grid grid-cols-3 gap-3 pt-3 sep-t">
            {macroSummary.map((m) => (
              <div key={m.label} role="group" aria-label={`${m.label}: objetivo diario de ${fmt(m.value)} gramos`}>
                <p className="type-footnote text-muted-foreground">{m.label}</p>
                <p className="mt-0.5 font-rounded text-[22px] font-bold leading-7 tabular-nums">
                  {fmt(m.value)}
                  <span className="ml-0.5 type-subhead font-semibold text-muted-foreground">g</span>
                </p>
              </div>
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
        <ListGroup header="Comidas de hoy">
          {meals.map((meal, i) => {
            const isDone = done.has(meal.name);
            return (
              <button
                key={i}
                type="button"
                onClick={() => toggle(meal.name)}
                aria-pressed={isDone}
                className="group/row flex min-h-[44px] w-full items-center gap-3 px-4 text-left transition-colors duration-100 active:bg-accent focus-visible:bg-accent focus-visible:outline-none"
              >
                <span
                  aria-hidden="true"
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full transition-colors duration-150 ${isDone ? "bg-primary" : "border-[1.5px] border-muted-foreground/50"}`}
                >
                  {isDone && <Check className="h-3.5 w-3.5 text-primary-foreground" strokeWidth={3} />}
                </span>
                {/* El separador nace donde empieza el texto, como en ListRow. */}
                <span className="block min-w-0 flex-1 py-3 group-[:not(:last-child)]/row:sep-b">
                  <span className={`block type-body transition-colors ${isDone ? "text-muted-foreground line-through decoration-muted-foreground/50" : "text-foreground"}`}>
                    {meal.name}
                  </span>
                  <span className="mt-0.5 line-clamp-2 block type-footnote text-muted-foreground">
                    {meal.description}
                  </span>
                </span>
              </button>
            );
          })}
        </ListGroup>
      )}
    </div>
  );
};

export default MealsList;
