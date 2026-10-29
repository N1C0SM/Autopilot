import { mealsDoneKey, readMealsDone } from "@/shared/lib/mealsDone";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { supabase } from "@/shared/integrations/supabase/client";
import { Check, Clock, TriangleAlert, UserRound, type LucideIcon } from "lucide-react";
import { hapticTap } from "@/shared/lib/native";
import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/components/ui/button";
import { EmptyState } from "@/shared/components/ui/empty-state";
import { ListGroup } from "@/shared/components/ui/list";
import { ProgressRing } from "@/shared/components/ui/progress-ring";
import type { MacroTargets } from "@/shared/lib/nutrition";
import { nutritionMacroError } from "@/shared/lib/nutritionValidation";
import { useMealPhoto } from "@/shared/hooks/useSessionCover";
import { BRAND_PHOTOS } from "@/shared/lib/brandPhotos";
import { mealIngredients, mealMacros, sumMacros, type PlanMeal } from "@/shared/lib/mealMacros";
import MealsPlusCard from "@/app/components/dashboard/MealsPlusCard";
import NutritionSetup from "@/app/components/dashboard/NutritionSetup";

/**
 * Foto propia del plato, generada con IA. Sin foto propia no se pinta ninguna:
 * nunca la misma foto de respaldo repetida en todas las comidas.
 */
const MealPhoto = ({ dish, dim }: { dish: string; dim: boolean }) => {
  const src = useMealPhoto(dish);
  if (!src) return null;
  return <span aria-hidden="true" className="shrink-0 py-2">
    <span className={cn("relative block h-14 w-14 overflow-hidden rounded-xl bg-secondary transition-opacity", dim && "opacity-50")}>
      <img src={src} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover animate-in fade-in duration-500" />
    </span>
  </span>;
};

interface Props {
  meals: PlanMeal[];
  macros?: MacroTargets | null;
  onOpenProfile?: () => void;
  userId?: string;
  /** Con Plus y sin comidas, se generan solas con el onboarding y se avisa al padre. */
  onMealsGenerated?: () => void;
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

// Plato de referencia para las tarjetas sin comidas: una sola foto compartida por todos.
const DEFAULT_DISH = "Pollo a la plancha con arroz integral y verduras asadas";

const MealsList = ({ meals, macros, onOpenProfile, userId, onMealsGenerated }: Props) => {
  const emptyMealPhoto = useMealPhoto(DEFAULT_DISH) || BRAND_PHOTOS.meal;
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

  // Plus sin comidas: se preparan una vez, en el servidor, con las preferencias del onboarding
  // (sync-nutrition-macros comprueba el acceso a nutrición antes de generar nada).
  const [generating, setGenerating] = useState(false);
  const [generateFailed, setGenerateFailed] = useState(false);
  const [noAccess, setNoAccess] = useState(false);
  const asked = useRef(false);
  const generate = async () => {
    asked.current = true;
    setGenerating(true);
    setGenerateFailed(false);
    const { data, error } = await supabase.functions.invoke("sync-nutrition-macros", { body: { regenerate_meals: true } });
    setGenerating(false);
    if (data?.reason === "no_access") { setNoAccess(true); return; }
    if (error || !data?.meals_updated) { setGenerateFailed(true); return; }
    window.dispatchEvent(new Event("autopilot:nutrition-plan-updated"));
    onMealsGenerated?.();
  };
  // Las comidas son de Plus: si nunca dijo qué le gusta comer, se le pregunta antes de prepararlas.
  const [needsSetup, setNeedsSetup] = useState<boolean | null>(null);
  useEffect(() => {
    if (meals.length || !onMealsGenerated || asked.current) return;
    if (!userId) { void generate(); return; }
    let alive = true;
    void supabase.from("onboarding").select("nutrition_preferences").eq("user_id", userId).maybeSingle().then(({ data }) => {
      if (!alive) return;
      const missing = !data?.nutrition_preferences?.trim();
      setNeedsSetup(missing);
      if (!missing) void generate();
    });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meals.length]);

  const ratio = meals.length ? meals.filter((m) => done.has(m.name)).length / meals.length : 0;
  const p = Number(macros?.protein) || 0;
  const c = Number(macros?.carbs) || 0;
  const f = Number(macros?.fats) || 0;
  const kcal = Number(macros?.calories) || Math.round(p * 4 + c * 4 + f * 9);
  const targetError = macros ? nutritionMacroError(macros) : null;

  if (!meals.length && needsSetup && userId && !generating) {
    return <NutritionSetup userId={userId} onDone={() => { setNeedsSetup(false); void generate(); }} />;
  }

  // Sin comidas ni objetivos: avisamos con calma en vez de mostrar una pantalla vacía.
  if (!meals.length && kcal <= 0) {
    return (
      <EmptyState
        photo={emptyMealPhoto ?? undefined}
        nutrition
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
  // Con comidas, cada una lleva sus macros y todas suman el objetivo exacto: al marcarlas
  // se suman al resumen (estimado según el plan; no se pesa lo que se come).
  const tracking = hasMeals && showTargets;
  const perMeal = tracking ? mealMacros(meals, { kcal, protein: p, carbs: c, fats: f }) : [];
  const eaten = sumMacros(perMeal.filter((_, i) => done.has(meals[i].name)));

  // Sin comidas, las barras muestran qué parte de la energía del día aporta cada macro.
  const macroEnergy = p * 4 + c * 4 + f * 9;
  const macroSummary = [
    { label: "Proteína", value: p, eaten: eaten.protein, energy: p * 4 },
    { label: "Carbos", value: c, eaten: eaten.carbs, energy: c * 4 },
    { label: "Grasas", value: f, eaten: eaten.fats, energy: f * 9 },
  ].map((m) => ({ ...m, share: macroEnergy > 0 ? Math.round((m.energy / macroEnergy) * 100) : 0 }))
    .map((m) => ({ ...m, bar: tracking ? (m.value > 0 ? Math.min(100, (m.eaten / Math.max(1, Math.round(m.value))) * 100) : 0) : m.share }));

  return (
    <div className="space-y-8">
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
                  <span className="type-figure text-[44px] font-bold leading-none tabular-nums text-foreground">
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
                      "type-figure font-bold leading-none tabular-nums",
                      hasMeals ? "text-[34px]" : "text-[48px]",
                    )}
                  >
                    {fmt(tracking ? eaten.kcal : kcal)}
                  </p>
                  <p className="mt-1.5 type-subhead text-muted-foreground">
                    {tracking ? `de ${fmt(kcal)} kcal` : "kcal de objetivo diario"}
                  </p>
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
                    aria-label={tracking
                      ? `${m.label}: ${fmt(m.eaten)} de ${fmt(m.value)} gramos`
                      : `${m.label}: objetivo diario de ${fmt(m.value)} gramos, ${m.share} % de las calorías`}
                  >
                    {/* Con letra grande el porcentaje baja de línea en vez de cortar la etiqueta. */}
                    <div className="flex flex-wrap items-baseline justify-between gap-x-1">
                      <p className="type-footnote text-muted-foreground">{m.label}</p>
                      {!tracking && <p className="type-footnote tabular-nums text-muted-foreground">{m.share} %</p>}
                    </div>
                    <p className="mt-0.5 font-rounded text-[22px] font-bold leading-7 tabular-nums">
                      {fmt(tracking ? m.eaten : m.value)}
                      <span className="ml-0.5 type-subhead font-semibold text-muted-foreground">
                        {tracking ? `/${fmt(m.value)} g` : "g"}
                      </span>
                    </p>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-primary/20" aria-hidden="true">
                      <div className="h-full rounded-full bg-primary transition-[width] duration-500 ease-out" style={{ width: `${m.bar}%` }} />
                    </div>
                  </div>
                ))}
              </div>
              <p className="mt-4 type-footnote text-muted-foreground">
                {tracking
                  ? "Al marcar una comida se suman sus macros del plan. Es una estimación: no se pesa lo que comes."
                  : "Objetivos de tu plan para hoy."}
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

      {!hasMeals && noAccess ? (
        <MealsPlusCard />
      ) : !hasMeals ? (
        <EmptyState
          photo={emptyMealPhoto ?? undefined}
          nutrition
          card
          icon={Clock}
          title={generating ? "Preparando tus comidas…" : "Sin comidas todavía"}
          description={generating
            ? "Autopilot está creando tus comidas con tus gustos y alergias del onboarding."
            : "No hemos podido prepararlas. Revisa tus datos en Ajustes o vuelve a intentarlo."}
          action={!generating && generateFailed ? <Button variant="secondary" size="lg" onClick={() => void generate()}>Volver a intentarlo</Button> : undefined}
        />
      ) : (
        <ListGroup header="Comidas de hoy">
          {meals.map((meal, i) => {
            const isDone = done.has(meal.name);
            const own = perMeal[i];
            const ingredients = mealIngredients(meal);
            return (
              <button
                // Key por comida, no por índice: al regenerar el plan la fila se remonta
                // y su foto no hereda la del plato anterior.
                key={`${meal.name}·${meal.description}`}
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
                  {ingredients.length > 0 && (
                    // Peso de cada ingrediente para pesarlo en báscula.
                    <span className={cn("mt-1.5 block type-footnote transition-colors duration-150", isDone ? "text-muted-foreground/60" : "text-foreground/80")}>
                      {ingredients.map((item, n) => (
                        <span key={n} className="flex justify-between gap-3 py-px">
                          <span className="min-w-0">{item.food}</span>
                          <span className="shrink-0 tabular-nums">{item.amount}</span>
                        </span>
                      ))}
                    </span>
                  )}
                  {own && (
                    <span
                      className={cn(
                        "mt-1 block type-footnote tabular-nums transition-colors duration-150",
                        isDone ? "text-muted-foreground/60" : "text-muted-foreground",
                      )}
                    >
                      {fmt(own.kcal)} kcal · P {own.protein} g · C {own.carbs} g · G {own.fats} g
                    </span>
                  )}
                </span>
                <MealPhoto dish={meal.description || meal.name} dim={isDone} />
              </button>
            );
          })}
        </ListGroup>
      )}
    </div>
  );
};

export default MealsList;
