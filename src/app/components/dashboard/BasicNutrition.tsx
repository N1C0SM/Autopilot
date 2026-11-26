import NutritionPlusSection from "@/app/components/dashboard/NutritionPlusSection";
import { useEffect, useState } from "react";
import { supabase } from "@/shared/integrations/supabase/client";
import { resolveNutritionPreview, type NutritionPreview } from "@/shared/lib/nutrition";
import { Spinner } from "@/shared/components/ui/spinner";
import { EmptyState } from "@/shared/components/ui/empty-state";
import { Button } from "@/shared/components/ui/button";
import { WifiOff } from "lucide-react";
import NutritionHero, { NutritionEstimateNote, NutritionHeroSkeleton } from "@/app/components/dashboard/NutritionHero";
import { Input } from "@/shared/components/ui/input";
import { hapticNotify, hapticTap } from "@/shared/lib/native";

/** Error de red de Nutrición: el mismo aviso tranquilo en la web y en la app. */
export const NUTRITION_LOAD_ERROR = {
  title: "No hemos podido cargar tu plan",
  description: "Revisa tu conexión y vuelve a intentarlo. Tus datos siguen guardados.",
} as const;

/**
 * Nutrición en Gratis: el anillo de calorías con las barras de macros como única protagonista, el
 * aviso de la estimación con «Actualizar mis datos» y lo de Plus en una sola fila. Sin peso, la
 * tarjeta para calcular los macros. Igual que `NutritionView` en la app.
 */
export default function BasicNutrition({ userId, onEdit, onUpgrade }: { userId: string; onEdit: () => void; onUpgrade?: () => void }) {
  const [targets, setTargets] = useState<NutritionPreview | null>(null);
  const [failed, setFailed] = useState(false);
  const [loading, setLoading] = useState(true);
  /** Sube con «Reintentar»: vuelve a pedir los datos sin recargar la página. */
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;

    const load = async () => {
      setFailed(false);
      try {
        const [ob, log, plan] = await Promise.all([
          supabase.from("onboarding").select("weight, sex, goal").eq("user_id", userId).maybeSingle(),
          supabase.from("weight_logs").select("weight").eq("user_id", userId).order("logged_at", { ascending: false }).limit(1).maybeSingle(),
          supabase.from("nutrition_plan").select("macros_json").eq("user_id", userId).maybeSingle(),
        ]);

        if (!active) return;

        if (ob.error) {
          console.error("Error loading nutrition data:", ob.error);
          setFailed(true);
          return;
        }

        const weight = Number(ob.data?.weight) > 30 ? ob.data?.weight : log.data?.weight;
        setTargets(resolveNutritionPreview({ ...(ob.data ?? {}), weight }, plan.data?.macros_json));
      } catch (error) {
        console.error("Error in BasicNutrition load:", error);
        if (active) setFailed(true);
      } finally {
        if (active) setLoading(false);
      }
    };

    void load();

    // Recargar cuando se actualicen los datos
    window.addEventListener("autopilot:onboarding-updated", load);
    window.addEventListener("autopilot:nutrition-plan-updated", load);

    return () => {
      active = false;
      window.removeEventListener("autopilot:onboarding-updated", load);
      window.removeEventListener("autopilot:nutrition-plan-updated", load);
    };
  }, [userId, attempt]);

  if (loading) {
    return (
      <section className="mx-auto w-full max-w-[680px] pb-4">
        <NutritionHeroSkeleton />
      </section>
    );
  }

  if (failed && !targets) {
    return (
      <EmptyState
        icon={WifiOff}
        title={NUTRITION_LOAD_ERROR.title}
        description={NUTRITION_LOAD_ERROR.description}
        action={
          <Button variant="secondary" size="lg" onClick={() => { void hapticTap(); setLoading(true); setAttempt((n) => n + 1); }}>
            Reintentar
          </Button>
        }
      />
    );
  }

  // Sin peso no hay macros: se piden aquí mismo, como en la app (nunca una pantalla sin salida).
  if (!targets || !targets.hasWeight) {
    return (
      <section className="mx-auto w-full max-w-[680px] space-y-8 pb-4">
        <MacrosWeightCard userId={userId} />
        <NutritionPlusSection onUpgrade={onUpgrade} />
      </section>
    );
  }

  return (
    <section className="mx-auto w-full max-w-[680px] space-y-8 pb-4">
      <div className="space-y-3">
        {/* Solo cifras reales del plan o del cálculo inicial. */}
        <NutritionHero
          target={{ kcal: targets.calories ?? 0, protein: targets.protein ?? 0, carbs: targets.carbs ?? 0, fats: targets.fats ?? 0 }}
        />
        <NutritionEstimateNote onEdit={onEdit} />
      </div>
      <NutritionPlusSection onUpgrade={onUpgrade} />
    </section>
  );
}

/** Calcular los macros: el mismo texto en la app (`MacrosWeightCard`). */
export const MACROS_WEIGHT_COPY = {
  title: "Calcula tus macros",
  description: "Con tu peso calculamos tus calorías y tus macros del día. Gratis.",
} as const;

/**
 * Sin peso no hay macros: se pide aquí mismo (como la app) y los objetivos salen al momento.
 * Tarjeta de 28 sin borde: título, una línea, el campo y la acción dorada.
 */
export function MacrosWeightCard({ userId, onSaved }: {
  userId: string;
  /** Con Plus (MealsList) lee los macros nuevos del plan; sin él, BasicNutrition se recarga sola. */
  onSaved?: () => void;
}) {
  const [weight, setWeight] = useState("");
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  const value = Number(weight.replace(",", "."));
  const valid = value > 30 && value <= 300;

  const save = async () => {
    if (!valid || saving) return;
    void hapticTap();
    setSaving(true);
    setFailed(false);
    const { error } = await supabase.from("onboarding").upsert({ user_id: userId, weight: value }, { onConflict: "user_id" });
    if (error) {
      setSaving(false);
      setFailed(true);
      void hapticNotify("error");
      return;
    }
    // Con Plus el plan recalcula sus macros con el peso nuevo (sin Plus no hace nada).
    await supabase.functions.invoke("sync-nutrition-macros").catch(() => undefined);
    void hapticNotify("success");
    window.dispatchEvent(new Event("autopilot:onboarding-updated"));
    if (onSaved) {
      onSaved();
      // Si el plan aún no trae macros, la tarjeta sigue ahí y se puede volver a intentar.
      setSaving(false);
    }
  };

  return (
    <form aria-labelledby="macros-weight-title" className="space-y-4 rounded-[28px] bg-card p-5" onSubmit={(e) => { e.preventDefault(); void save(); }}>
      <div>
        <h2 id="macros-weight-title" className="type-title2">{MACROS_WEIGHT_COPY.title}</h2>
        <p className="mt-1 type-subhead text-muted-foreground">{MACROS_WEIGHT_COPY.description}</p>
      </div>
      <Input type="text" inputMode="decimal" enterKeyHint="done" autoComplete="off" aria-label="Tu peso en kg" placeholder="Tu peso en kg"
        value={weight} onChange={(e) => setWeight(e.target.value.replace(/[^\d.,]/g, ""))} />
      <Button type="submit" size="lg" className="w-full rounded-full" disabled={!valid || saving}>
        {saving ? <Spinner size="sm" className="text-primary-foreground" label="Calculando" /> : "Calcular mis macros"}
      </Button>
      {failed && <p role="alert" className="type-footnote text-destructive">No se pudo guardar tu peso. Vuelve a intentarlo.</p>}
    </form>
  );
}
