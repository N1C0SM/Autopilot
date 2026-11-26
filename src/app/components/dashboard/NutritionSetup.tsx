import { useState, type ReactNode } from "react";
import { Check } from "lucide-react";
import { supabase } from "@/shared/integrations/supabase/client";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { ChipGroup } from "@/shared/components/ui/chip-group";
import { Spinner } from "@/shared/components/ui/spinner";
import { COOKING, FOOD_AVOID, FOOD_LIKES, splitList, toggleInList, writeLikes } from "@/shared/lib/foodPrefs";
import { hapticImpact, hapticSelection } from "@/shared/lib/native";
import { cn } from "@/shared/lib/utils";

const MEALS = [2, 3, 4, 5];

/** Bloque del cuestionario: título en Title 3 (solo la primera en mayúscula) y su contenido. */
const Group = ({ title, children }: { title: string; children: ReactNode }) => (
  <section className="space-y-3">
    <h3 className="type-title3">{title}</h3>
    {children}
  </section>
);

/**
 * Onboarding de comidas de Plus. El onboarding general ya no pregunta por comidas (el plan
 * Gratis no las incluye): se piden aquí, la primera vez que alguien con Plus abre Nutrición.
 * Guarda las mismas columnas que antes (`nutrition_preferences`, `allergies`, `availability`).
 * Igual que `NutritionSetupView` en la app: titular, cuatro bloques en Title 3 y una acción dorada.
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
    <section aria-labelledby="nutrition-setup-title" className="mx-auto w-full max-w-[680px] space-y-8">
      <div>
        <h2 id="nutrition-setup-title" className="type-title1">Tus comidas, <span className="text-primary">hechas para ti</span></h2>
        <p className="mt-2 type-subhead text-muted-foreground">Cuatro preguntas y te preparamos las comidas de cada día, ajustadas a tus macros.</p>
      </div>

      <Group title="Comidas al día">
        <div role="radiogroup" aria-label="Comidas al día" className="grid grid-cols-4 gap-2">
          {MEALS.map((n) => (
            <button key={n} type="button" role="radio" aria-checked={meals === n}
              onClick={() => { void hapticSelection(); setMeals(n); }}
              className={cn("h-12 rounded-full type-headline tabular-nums transition-colors active:scale-[0.97]", meals === n ? "bg-primary/15 text-primary" : "bg-card")}>
              {n}
            </button>
          ))}
        </div>
      </Group>

      <Group title="¿Te gusta cocinar?">
        <div role="radiogroup" aria-label="¿Te gusta cocinar?" className="overflow-hidden rounded-[22px] bg-card">
          {COOKING.map((o) => {
            const on = o.v === cooking;
            return (
              <button key={o.v} type="button" role="radio" aria-checked={on}
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
      </Group>

      <Group title="¿Qué te gusta comer?">
        <ChipGroup options={FOOD_LIKES} isOn={(v) => likes.includes(v)} onToggle={(v) => setLikes(toggleInList(likes, v))} />
      </Group>
      <Group title="¿Qué no comes?">
        <ChipGroup options={FOOD_AVOID} isOn={(v) => dislikes.includes(v)} onToggle={(v) => setDislikes(toggleInList(dislikes, v))} />
      </Group>

      <Group title="¿Algo más que evitar?">
        <Input autoComplete="off" enterKeyHint="done" aria-label="Otros alimentos que no quieres ver (opcional)" placeholder="Opcional: avena, champiñones…" value={avoid} onChange={(e) => setAvoid(e.target.value)} />
      </Group>

      {failed && <p role="alert" className="type-footnote text-destructive">No se pudo guardar. Revisa tu conexión e inténtalo otra vez.</p>}
      <Button variant="hero" size="lg" className="w-full" onClick={() => void save()} disabled={saving}>
        {saving && <Spinner size="sm" className="mr-2 text-primary-foreground" label="Guardando" />}
        Preparar mis comidas
      </Button>
    </section>
  );
}
