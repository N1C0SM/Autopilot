import { claimMealsAutoGenerate, mealsDoneKey, readMealsDone } from "@/shared/lib/mealsDone";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { supabase } from "@/shared/integrations/supabase/client";
import { Check, Clock, MoreHorizontal, RefreshCw, TriangleAlert, UserRound } from "lucide-react";
import { hapticTap } from "@/shared/lib/native";
import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/shared/components/ui/alert-dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/shared/components/ui/dropdown-menu";
import { EmptyState } from "@/shared/components/ui/empty-state";
import { ProgressRing } from "@/shared/components/ui/progress-ring";
import { Spinner } from "@/shared/components/ui/spinner";
import type { MacroTargets } from "@/shared/lib/nutrition";
import { nutritionMacroError } from "@/shared/lib/nutritionValidation";
import { useMealPhoto } from "@/shared/hooks/useSessionCover";
import { fastImage, THUMB_SIDE } from "@/shared/lib/fastImage";
import { BRAND_PHOTOS } from "@/shared/lib/brandPhotos";
import { groupedInt } from "@/shared/lib/workoutSummaryFormat";
import { mealMacroDetail, mealMacroLabel, mealMacros, sumMacros, type PlanMeal } from "@/shared/lib/mealMacros";
import NutritionHero, { NutritionEstimateNote } from "@/app/components/dashboard/NutritionHero";
import NutritionPlusSection from "@/app/components/dashboard/NutritionPlusSection";
import NutritionSetup from "@/app/components/dashboard/NutritionSetup";
import { MacrosWeightCard } from "@/app/components/dashboard/BasicNutrition";

/** Textos de Nutrición con Plus que la app repite tal cual (NutritionView). */
export const MEALS_COPY = {
  preparingTitle: "Preparando tus comidas…",
  preparingDetail: "Con tus macros, tus gustos y lo que no comes.",
  readyTitle: "Tus comidas de hoy",
  readyDetail: "Te las preparamos con tus macros y lo que te gusta.",
  readyAction: "Preparar mis comidas",
  regenerateFailed: "Tus comidas siguen aquí. Prueba a regenerarlas en unos minutos.",
  weightTitle: "Añade tu peso",
  weightDetail: "Con tu peso calculamos tus macros. Hasta entonces, las comidas son orientativas.",
} as const;

/**
 * Foto propia del plato, generada con IA, en una miniatura de 48 con radio 14. Sin foto propia no
 * se pinta ninguna: nunca la misma foto de respaldo repetida en todas las comidas.
 */
const MealPhoto = ({ dish, dim }: { dish: string; dim: boolean }) => {
  const src = useMealPhoto(dish);
  if (!src) return null;
  return <span aria-hidden="true" className={cn("relative block h-12 w-12 shrink-0 overflow-hidden rounded-[14px] bg-secondary transition-opacity", dim && "opacity-50")}>
    {/* Miniatura de 48 px: 192 px, no la foto de 1000 de la tarjeta grande. */}
    <img src={fastImage(src, THUMB_SIDE)} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover animate-in fade-in duration-500" />
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

/** Enteros con punto de miles siempre («1.234 kcal»), como `NumberText.grouped` en la app. */
const fmt = groupedInt;

/** Aviso tranquilo en una tarjeta: icono gris en su losa, título, una línea y la acción si la hay. */
const QuietNotice = ({ icon: Icon, title, role, action, children }: {
  icon: typeof Clock;
  title: string;
  role?: string;
  action?: ReactNode;
  children: ReactNode;
}) => (
  <div role={role} className="flex items-start gap-3.5 rounded-[22px] bg-card p-4">
    <span aria-hidden="true" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[9px] bg-secondary">
      <Icon className="h-[18px] w-[18px] text-muted-foreground" strokeWidth={1.75} />
    </span>
    <div className="min-w-0 flex-1">
      <p className="type-headline">{title}</p>
      <p className="mt-0.5 type-footnote text-muted-foreground">{children}</p>
      {action}
    </div>
  </div>
);

// Plato de referencia para las tarjetas sin comidas: una sola foto compartida por todos.
const DEFAULT_DISH = "Pollo a la plancha con arroz integral y verduras asadas";

/**
 * Nutrición con Plus, minimalista: el anillo de calorías con las barras de macros como única
 * protagonista y «Comidas de hoy» como una lista limpia (foto, nombre, plato y kcal con macros en
 * una línea tranquila, y el check). «Regenerar comidas» y «Actualizar mis datos» van en «···».
 * Igual que `NutritionView` en la app nativa.
 */
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
  const [confirmingNew, setConfirmingNew] = useState(false);
  const asked = useRef(false);
  /** Una sola petición a la vez (la automática y el botón no se pisan). */
  const inflight = useRef(false);
  const generate = async () => {
    if (inflight.current) return;
    inflight.current = true;
    asked.current = true;
    setGenerating(true);
    setGenerateFailed(false);
    const { data, error } = await supabase.functions.invoke("sync-nutrition-macros", { body: { regenerate_meals: true } });
    inflight.current = false;
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
    // Una vez al día como mucho: si ya se intentó hoy, queda «Preparar mis comidas».
    const auto = () => {
      if (claimMealsAutoGenerate(userId)) void generate();
      else { asked.current = true; setGenerateFailed(true); }
    };
    if (!userId) { auto(); return; }
    let alive = true;
    void supabase.from("onboarding").select("nutrition_preferences").eq("user_id", userId).maybeSingle().then(({ data }) => {
      if (!alive) return;
      const missing = !data?.nutrition_preferences?.trim();
      setNeedsSetup(missing);
      if (!missing) auto();
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

  // Sin comidas ni objetivos: sin peso no hay macros, así que se piden aquí mismo (como la app).
  if (!meals.length && kcal <= 0) {
    return (
      <div className="mx-auto w-full max-w-[680px] space-y-8">
        {userId ? (
          // Al guardar el peso, Nutrición vuelve a leer el plan con sus macros nuevos (Dashboard).
          <MacrosWeightCard userId={userId} onSaved={() => window.dispatchEvent(new Event("autopilot:nutrition-plan-updated"))} />
        ) : (
          <EmptyState
            photo={emptyMealPhoto ?? undefined}
            card
            className="rounded-[28px] border-0"
            icon={Clock}
            title="Tu plan de comidas, en camino"
            description="En cuanto tengamos tus macros, verás aquí tus calorías y tus comidas del día."
          />
        )}
      </div>
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
  // Sin comidas que marcar, los objetivos son una estimación: el aviso va bajo el anillo.
  const estimate = showTargets && !hasMeals;

  return (
    <div className="mx-auto w-full max-w-[680px] space-y-8">
      {showTargets ? (
        <div className="space-y-3">
          {/* Anillo de calorías y barras de macros: con comidas suman lo marcado. */}
          <NutritionHero target={{ kcal, protein: p, carbs: c, fats: f }} eaten={tracking ? eaten : null} />
          {estimate && <NutritionEstimateNote onEdit={onOpenProfile} />}
        </div>
      ) : hasMeals && (
        <section aria-label="Resumen de hoy" className="flex flex-wrap items-center gap-5 rounded-[28px] bg-card p-5">
          <ProgressRing value={ratio * 100} size={136} stroke={12} label={`${doneCount} de ${meals.length} comidas hechas hoy`}>
            <span className="flex flex-col items-center">
              <span className="type-figure text-[40px] font-bold leading-none tabular-nums text-foreground">{doneCount}</span>
              <span className="mt-1 whitespace-nowrap type-footnote tabular-nums text-muted-foreground">de {meals.length} {meals.length === 1 ? "comida" : "comidas"}</span>
            </span>
          </ProgressRing>
          <p className="min-w-[140px] flex-1 type-headline">
            {remaining === 0
              ? "Día completo"
              : `Te ${remaining === 1 ? "queda" : "quedan"} ${remaining} ${remaining === 1 ? "comida" : "comidas"}`}
          </p>
        </section>
      )}

      {targetError && (
        <QuietNotice role="alert" icon={TriangleAlert} title="Objetivos pendientes de revisión">
          {targetError} Las comidas guardadas siguen disponibles.
        </QuietNotice>
      )}

      {hasMeals && !macros && (
        <QuietNotice
          icon={UserRound}
          title={MEALS_COPY.weightTitle}
          action={onOpenProfile ? (
            <Button variant="secondary" className="mt-3" onClick={() => { void hapticTap(); onOpenProfile(); }}>
              Añadir peso
            </Button>
          ) : undefined}
        >
          {MEALS_COPY.weightDetail}
        </QuietNotice>
      )}

      {!hasMeals && noAccess ? (
        <NutritionPlusSection />
      ) : !hasMeals ? (
        // Plus sin comidas todavía: mientras se preparan, el AP; si no salió, la acción para prepararlas.
        generating || (onMealsGenerated && !generateFailed) ? (
          <EmptyState
            photo={emptyMealPhoto ?? undefined}
            card
            className="rounded-[28px] border-0"
            title={MEALS_COPY.preparingTitle}
            description={MEALS_COPY.preparingDetail}
            action={<Spinner size="lg" label={MEALS_COPY.preparingTitle} />}
          />
        ) : (
          <EmptyState
            photo={emptyMealPhoto ?? undefined}
            card
            className="rounded-[28px] border-0"
            title={MEALS_COPY.readyTitle}
            description={MEALS_COPY.readyDetail}
            action={<Button variant="secondary" size="lg" onClick={() => { void hapticTap(); void generate(); }}>{MEALS_COPY.readyAction}</Button>}
          />
        )
      ) : (
        // «Comidas de hoy»: título en Title 3, «···» con lo secundario y las filas en un grupo sin borde.
        <section aria-labelledby="meals-today-title" className="space-y-3">
          <div className="flex min-h-11 items-center justify-between gap-3">
            <h2 id="meals-today-title" className="type-title3">Comidas de hoy</h2>
            {generating ? (
              <span role="status" className="flex items-center gap-2 type-footnote text-muted-foreground">
                <Spinner size="sm" label="Regenerando…" />
                Regenerando…
              </span>
            ) : (
              <DropdownMenu modal={false}>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    aria-label="Más opciones de las comidas"
                    onClick={() => void hapticTap()}
                    className="-mr-2 grid h-11 w-11 shrink-0 place-items-center rounded-full text-muted-foreground transition-colors active:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <MoreHorizontal className="h-5 w-5" aria-hidden="true" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onSelect={() => setConfirmingNew(true)}>
                    <RefreshCw className="h-4 w-4" aria-hidden="true" /> Regenerar comidas
                  </DropdownMenuItem>
                  {onOpenProfile && (
                    <DropdownMenuItem onSelect={() => onOpenProfile()}>
                      <UserRound className="h-4 w-4" aria-hidden="true" /> Actualizar mis datos
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
          <ul className="overflow-hidden rounded-[22px] bg-card">
            {meals.map((meal, i) => {
              const isDone = done.has(meal.name);
              const own = perMeal[i];
              return (
                // Key por comida, no por índice: al regenerar el plan la fila se remonta
                // y su foto no hereda la del plato anterior.
                <li key={`${meal.name}·${meal.description}`} className="group/row">
                  <button
                    type="button"
                    onClick={() => toggle(meal.name)}
                    aria-pressed={isDone}
                    className="flex min-h-[72px] w-full items-center gap-3 pl-4 text-left transition-colors duration-150 active:bg-accent focus-visible:bg-accent focus-visible:outline-none"
                  >
                    <MealPhoto dish={meal.description || meal.name} dim={isDone} />
                    {/* El separador nace donde empieza el texto, como en ListRow. */}
                    <span className="flex min-w-0 flex-1 items-center gap-3 self-stretch py-3 pr-4 group-[:not(:last-child)]/row:sep-b">
                      <span className={cn("min-w-0 flex-1 transition-colors duration-150", isDone && "text-muted-foreground")}>
                        <span className="block break-words type-headline">{meal.name}</span>
                        {meal.description && (
                          <span className="mt-0.5 line-clamp-2 block type-footnote text-muted-foreground">{meal.description}</span>
                        )}
                        {own && (
                          <span className="mt-1 block type-footnote tabular-nums text-muted-foreground">
                            <span aria-hidden="true">
                              <span className={cn("font-semibold", isDone ? "text-muted-foreground" : "text-foreground")}>{fmt(own.kcal)} kcal</span>
                              {" · "}{mealMacroDetail(own)}
                            </span>
                            <span className="sr-only">{mealMacroLabel(own)}</span>
                          </span>
                        )}
                      </span>
                      <span
                        aria-hidden="true"
                        className={cn(
                          "flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full transition-[background-color,transform] duration-150 ease-out group-active/row:scale-90",
                          isDone ? "bg-primary" : "border-[1.5px] border-muted-foreground/50",
                        )}
                      >
                        {isDone && <Check className="h-3.5 w-3.5 text-primary-foreground" strokeWidth={3} />}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          {generateFailed && !generating && (
            <p role="status" className="px-1 type-footnote text-muted-foreground">{MEALS_COPY.regenerateFailed}</p>
          )}
        </section>
      )}
      <AlertDialog open={confirmingNew} onOpenChange={setConfirmingNew}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Regenerar tus comidas?</AlertDialogTitle>
            <AlertDialogDescription>
              Recalcularemos el plan de comidas con tus datos actuales y sustituirá a las comidas guardadas cuando termine. El plan de entrenamiento no cambia.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter stacked>
            <AlertDialogCancel>Ahora no</AlertDialogCancel>
            <AlertDialogAction onClick={() => void generate()}>Regenerar comidas</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default MealsList;
