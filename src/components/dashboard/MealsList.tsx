import { mealsDoneKey, readMealsDone } from "@/lib/mealsDone";
import { useEffect, useState, type ReactNode } from "react";
import { Check, Clock, TriangleAlert, UserRound, type LucideIcon } from "lucide-react";
import { hapticTap } from "@/lib/native";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ListGroup } from "@/components/ui/list";
import { ProgressRing } from "@/components/ui/progress-ring";
import type { MacroTargets } from "@/lib/nutrition";
import { nutritionMacroError } from "@/lib/nutritionValidation";
import { useMealPhoto } from "@/hooks/useSessionCover";

/** Foto del plato generada con IA, con el mismo estilo oscuro y dorado que las sesiones. */
const MealPhoto = ({ dish, dim }: { dish: string; dim: boolean }) => {
  const src = useMealPhoto(dish);
  return <span aria-hidden="true" className={cn("relative h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-secondary transition-opacity", dim && "opacity-50")}>
    {src && <img src={src} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover animate-in fade-in duration-500" />}
  </span>;
};

interface Meal {
  name: string;
  description: string;
}

interface Props {
  meals: Meal[];
  macros?: MacroTargets | null;
  onOpenProfile?: () => void;
  userId?: string;
}

const todayKey = (userId?: string) => mealsDoneKey(userId);

const fmt = (n: number) => Math.round(n).toLocaleString("es-ES");

/** Aviso con la composición de la bienvenida: icono a la izquierda, título, una línea y acción en texto. */
const Notice = ({
  icon: Icon,
  iconClassName = "text-primary",
  title,
  role,
  action,
  children,
}: {
  icon: LucideIcon;
  iconClassName?: string;
  title: string;
  role?: string;
  action?: ReactNode;
  children: ReactNode;
}) => (
  <div role={role} className="flex items-start gap-4">
    <div className="flex w-10 shrink-0 justify-center pt-0.5" aria-hidden="true">
      <Icon className={cn("h-7 w-7", iconClassName)} strokeWidth={1.75} />
    </div>
    <div className="min-w-0 flex-1">
      <p className="type-headline">{title}</p>
      <p className="mt-1 type-subhead text-muted-foreground">{children}</p>
      {action}
    </div>
  </div>
);

// Plato fijo para la portada cuando aún no hay comidas: una sola foto compartida por todos.
const DEFAULT_DISH = "Pollo a la plancha con arroz integral y verduras asadas";

const MealsList = ({ meals, macros, onOpenProfile, userId }: Props) => {
  // Portada de Nutrición, como la de las sesiones: el primer plato del día o uno de referencia.
  const coverPhoto = useMealPhoto(meals[0]?.description || DEFAULT_DISH);
  const emptyMealPhoto = useMealPhoto(DEFAULT_DISH);
  const [done, setDone] = useState<Set<string>>(new Set());

  useEffect(() => {
    setDone(new Set(readMealsDone(userId)));
  }, [userId]);

  const toggle = (name: string) => {
    const next = new Set(done);
    if (next.has(name)) {
      next.delete(name);
    } else {
      next.add(name);
    }
    void hapticTap();
    setDone(next);
    try { localStorage.setItem(todayKey(userId), JSON.stringify(Array.from(next))); } catch { /* ignore */ }
    // Hoy escucha este evento para refrescar su anillo de comidas sin remount.
    window.dispatchEvent(new Event("autopilot:meals-updated"));
  };

  const ratio = meals.length ? meals.filter((m) => done.has(m.name)).length / meals.length : 0;
  const p = Number(macros?.protein) || 0;
  const c = Number(macros?.carbs) || 0;
  const f = Number(macros?.fats) || 0;
  const kcal = Number(macros?.calories) || Math.round(p * 4 + c * 4 + f * 9);
  const targetError = macros ? nutritionMacroError(macros) : null;

  // Sin comidas ni objetivos: avisamos con calma en vez de mostrar una pantalla vacía.
  if (!meals.length && kcal <= 0) {
    return (
      <EmptyState
        card
        icon={Clock}
        title="Aún no hay plan de comidas"
        description="En cuanto tengamos tus macros, verás aquí tus calorías y las comidas del día."
      />
    );
  }

  const hasMeals = meals.length > 0;
  const showTargets = Boolean(macros) && kcal > 0 && !targetError;
  const doneCount = meals.filter((meal) => done.has(meal.name)).length;
  const remaining = meals.length - doneCount;

  // Las barras muestran qué parte de la energía del día aporta cada macro: es un dato del
  // plan, no un consumo (marcar comidas no mide lo que se come).
  const macroEnergy = p * 4 + c * 4 + f * 9;
  const macroSummary = [
    { label: "Proteína", value: p, energy: p * 4 },
    { label: "Carbos", value: c, energy: c * 4 },
    { label: "Grasas", value: f, energy: f * 9 },
  ].map((m) => ({ ...m, share: macroEnergy > 0 ? Math.round((m.energy / macroEnergy) * 100) : 0 }));

  return (
    <div className="space-y-8">
      {coverPhoto && meals.length > 0 && <div aria-hidden="true" className="relative h-44 overflow-hidden rounded-[28px] bg-card">
        <img src={coverPhoto} alt="" decoding="async" className="absolute inset-0 h-full w-full object-cover animate-in fade-in duration-500" />
        <span className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
      </div>}
      {(hasMeals || showTargets) && (
        <section aria-label="Resumen de hoy" className="rounded-2xl bg-card p-4">
          <div className="flex items-center gap-5">
            {hasMeals && (
              <ProgressRing
                value={ratio * 100}
                size={136}
                stroke={14}
                label={`${doneCount} de ${meals.length} comidas hechas hoy`}
              >
                <span className="flex flex-col items-center">
                  <span className="font-rounded text-[44px] font-bold leading-none tabular-nums text-foreground">
                    {doneCount}
                  </span>
                  <span className="mt-1 type-footnote tabular-nums text-muted-foreground">
                    de {meals.length} {meals.length === 1 ? "comida" : "comidas"}
                  </span>
                </span>
              </ProgressRing>
            )}
            <div className="min-w-0 flex-1">
              {showTargets ? (
                <>
                  <p
                    className={cn(
                      "font-rounded font-bold leading-none tabular-nums",
                      hasMeals ? "text-[34px]" : "text-[48px]",
                    )}
                  >
                    {fmt(kcal)}
                  </p>
                  <p className="mt-1.5 type-subhead text-muted-foreground">kcal de objetivo diario</p>
                </>
              ) : (
                <>
                  <p className="type-headline">
                    {remaining === 0
                      ? "Día completo"
                      : `Te ${remaining === 1 ? "queda" : "quedan"} ${remaining} ${remaining === 1 ? "comida" : "comidas"}`}
                  </p>
                  <p className="mt-1 type-subhead text-muted-foreground">
                    {remaining === 0 ? "Has marcado todas las comidas de hoy." : "Márcalas según las vayas haciendo."}
                  </p>
                </>
              )}
            </div>
          </div>

          {showTargets && (
            <>
              <div className="mt-6 grid grid-cols-3 gap-4 md:max-w-lg">
                {macroSummary.map((m) => (
                  <div
                    key={m.label}
                    role="group"
                    aria-label={`${m.label}: objetivo diario de ${fmt(m.value)} gramos, ${m.share} % de las calorías`}
                  >
                    <div className="flex items-baseline justify-between gap-1">
                      <p className="truncate type-footnote text-muted-foreground">{m.label}</p>
                      <p className="shrink-0 type-footnote tabular-nums text-muted-foreground">{m.share} %</p>
                    </div>
                    <p className="mt-0.5 font-rounded text-[22px] font-bold leading-7 tabular-nums">
                      {fmt(m.value)}
                      <span className="ml-0.5 type-subhead font-semibold text-muted-foreground">g</span>
                    </p>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-primary/20" aria-hidden="true">
                      <div className="h-full rounded-full bg-primary" style={{ width: `${m.share}%` }} />
                    </div>
                  </div>
                ))}
              </div>
              <p className="mt-4 type-footnote text-muted-foreground">
                Objetivos de tu plan para hoy. Marcar comidas no mide las calorías consumidas.
              </p>
            </>
          )}
        </section>
      )}

      {targetError && (
        <Notice
          role="alert"
          icon={TriangleAlert}
          iconClassName="text-destructive"
          title="Objetivos pendientes de revisión"
        >
          {targetError} Las comidas guardadas siguen disponibles.
        </Notice>
      )}

      {hasMeals && !macros && (
        <Notice
          icon={UserRound}
          title="Tus macros aún no están personalizados"
          action={
            onOpenProfile ? (
              <Button
                variant="plain"
                className="-ml-4"
                onClick={() => {
                  void hapticTap();
                  onOpenProfile();
                }}
              >
                Añadir peso
              </Button>
            ) : undefined
          }
        >
          Añade tu peso actual para calcularlos. Mientras tanto, las comidas de abajo son orientativas.
        </Notice>
      )}

      {!hasMeals ? (
        <EmptyState
          photo={emptyMealPhoto ?? undefined}
          card
          icon={Clock}
          title="Sin comidas todavía"
          description="Guarda tus datos en Ajustes y podrás generarlas con tus macros."
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
                className="group/row flex min-h-[44px] w-full items-center gap-3 px-4 text-left transition-colors duration-150 active:bg-accent focus-visible:bg-accent focus-visible:outline-none"
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    "flex h-6 w-6 shrink-0 items-center justify-center rounded-full transition-[background-color,transform] duration-150 ease-out group-active/row:scale-90",
                    isDone ? "bg-primary" : "border-[1.5px] border-muted-foreground/50",
                  )}
                >
                  {isDone && <Check className="h-3.5 w-3.5 text-primary-foreground" strokeWidth={3} />}
                </span>
                {/* El separador nace donde empieza el texto, como en ListRow. */}
                <span className="block min-w-0 flex-1 py-3 group-[:not(:last-child)]/row:sep-b">
                  <span
                    className={cn(
                      "block type-headline transition-colors duration-150",
                      isDone ? "text-muted-foreground" : "text-foreground",
                    )}
                  >
                    {meal.name}
                  </span>
                  <span
                    className={cn(
                      "mt-0.5 line-clamp-2 block type-subhead transition-colors duration-150",
                      isDone ? "text-muted-foreground/60" : "text-muted-foreground",
                    )}
                  >
                    {meal.description}
                  </span>
                </span>
                <span className="py-2"><MealPhoto dish={meal.description || meal.name} dim={isDone} /></span>
              </button>
            );
          })}
        </ListGroup>
      )}
    </div>
  );
};

export default MealsList;
