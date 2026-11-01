import { useState } from "react";
import { Check, Sparkles } from "lucide-react";
import { supabase } from "@/shared/integrations/supabase/client";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { ChipGroup } from "@/shared/components/ui/chip-group";
import { Spinner } from "@/shared/components/ui/spinner";
import { COOKING, FOOD_AVOID, FOOD_LIKES, splitList, toggleInList, writeLikes } from "@/shared/lib/foodPrefs";
import { hapticImpact, hapticSelection } from "@/shared/lib/native";
import { cn } from "@/shared/lib/utils";

const MEALS = [2, 3, 4, 5];

/**
 * Onboarding de comidas de Plus. El onboarding general ya no pregunta por comidas (el plan
 * Gratis no las incluye): se piden aquí, la primera vez que alguien con Plus abre Nutrición.
 * Guarda las mismas columnas que antes (`nutrition_preferences`, `allergies`, `availability`).
 */
export default function NutritionSetup({ userId, onDone }: { userId: string; onDone: () => void }) {
  const [meals, setMeals] = useState(3);
  const [cooking, setCooking] = useState<string>("normal");
  const [likes, setLikes] = useState<string[]>([]);
  const [dislikes, setDislikes] = useState<string[]>([]);
  const [avoid, setAvoid] = useState("");
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);

  const save = async () => {
    void hapticImpact();
    setSaving(true);
    setFailed(false);
    const cookingLabel = COOKING.find((o) => o.v === cooking)?.l ?? cooking;
    const nutrition = writeLikes([`${meals} comidas al día`, `Cocina: ${cookingLabel}`, avoid && `Evitar: ${avoid}`].filter(Boolean).join(" · "), likes);
    const { data: current } = await supabase.from("onboarding").select("availability").eq("user_id", userId).maybeSingle();
    const availability = { ...((current?.availability as Record<string, unknown> | null) ?? {}), meals_per_day: meals, avoid_foods: avoid, cooking };
    const { error } = await supabase.from("onboarding").update({
      nutrition_preferences: nutrition,
      allergies: [...dislikes, ...splitList(avoid)].join(", "),
      availability,
    }).eq("user_id", userId);
    setSaving(false);
    if (error) { setFailed(true); return; }
    onDone();
  };

  return (
    <section className="space-y-8">
      <div className="text-center">
        <div className="mx-auto mb-4 flex h-[72px] w-[72px] items-center justify-center rounded-[22%] bg-card">
          <Sparkles className="h-8 w-8 text-primary" strokeWidth={1.75} aria-hidden="true" />
        </div>
        <p className="type-subhead text-muted-foreground">Incluido en Plus</p>
        <h2 className="mt-1 type-title1">Tus comidas, <span className="text-primary">hechas para ti</span></h2>
        <p className="mt-2 type-subhead text-muted-foreground">Cuatro preguntas y Autopilot te prepara las comidas de cada día, ajustadas a tus macros.</p>
      </div>

      <section>
        <h3 className="type-group-header px-4 pb-1.5">Comidas al día</h3>
        <div className="grid grid-cols-4 gap-2">
          {MEALS.map((n) => (
            <button key={n} type="button" aria-pressed={meals === n}
              onClick={() => { void hapticSelection(); setMeals(n); }}
              className={cn("h-12 rounded-full type-headline transition-colors", meals === n ? "bg-primary text-primary-foreground" : "bg-card")}>
              {n}
            </button>
          ))}
        </div>
      </section>

      <section>
        <h3 className="type-group-header px-4 pb-1.5">¿Te gusta cocinar?</h3>
        <div className="overflow-hidden rounded-media bg-card">
          {COOKING.map((o) => {
            const on = o.v === cooking;
            return (
              <button key={o.v} type="button" aria-pressed={on}
                onClick={() => { void hapticSelection(); setCooking(o.v); }}
                className="group/row flex min-h-[56px] w-full items-center gap-3 pl-4 text-left transition-colors active:bg-accent">
                <span className="flex min-h-[56px] min-w-0 flex-1 items-center gap-3 py-3 pr-4 group-[:not(:last-child)]/row:sep-b">
                  <span className="min-w-0 flex-1">
                    <span className="block type-headline">{o.l}</span>
                    <span className="mt-0.5 block type-subhead text-muted-foreground">{o.d}</span>
                  </span>
                  <Check aria-hidden="true" strokeWidth={2.75} className={cn("h-5 w-5 shrink-0 text-primary", on ? "opacity-100" : "opacity-0")} />
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <ChipGroup header="¿Qué te gusta comer?" options={FOOD_LIKES} isOn={(v) => likes.includes(v)} onToggle={(v) => setLikes(toggleInList(likes, v))} />
      <ChipGroup header="¿Qué no comes?" options={FOOD_AVOID} isOn={(v) => dislikes.includes(v)} onToggle={(v) => setDislikes(toggleInList(dislikes, v))} />

      <section>
        <h3 className="type-group-header px-4 pb-1.5">¿Algo más que evitar? (opcional)</h3>
        <Input autoComplete="off" enterKeyHint="done" aria-label="Otros alimentos que no quieres ver" placeholder="Ej. avena, champiñones…" value={avoid} onChange={(e) => setAvoid(e.target.value)} />
      </section>

      {failed && <p role="alert" className="type-footnote text-destructive">No se pudo guardar. Revisa tu conexión e inténtalo otra vez.</p>}
      <Button variant="hero" size="lg" className="w-full" onClick={() => void save()} disabled={saving}>
        {saving && <Spinner size="sm" className="mr-2 text-primary-foreground" label="Guardando" />}
        Preparar mis comidas
      </Button>
    </section>
  );
}
