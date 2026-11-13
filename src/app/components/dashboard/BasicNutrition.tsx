import NutritionPlusSection from "@/app/components/dashboard/NutritionPlusSection";
import { useEffect, useState } from "react";
import { supabase } from "@/shared/integrations/supabase/client";
import { resolveNutritionPreview, type NutritionPreview } from "@/shared/lib/nutrition";
import { Spinner } from "@/shared/components/ui/spinner";
import { EmptyState } from "@/shared/components/ui/empty-state";
import { Button } from "@/shared/components/ui/button";
import { Apple, Flame } from "lucide-react";
import NutritionHero, { NutritionIntro } from "@/app/components/dashboard/NutritionHero";
import { Input } from "@/shared/components/ui/input";
import { hapticNotify, hapticTap } from "@/shared/lib/native";

export default function BasicNutrition({ userId, onEdit, onUpgrade }: { userId: string; onEdit: () => void; onUpgrade?: () => void }) {
  const [targets, setTargets] = useState<NutritionPreview | null>(null);
  const [failed, setFailed] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    
    const load = async () => {
      setLoading(true);
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
          setLoading(false);
          return;
        }

        const weight = Number(ob.data?.weight) > 30 ? ob.data?.weight : log.data?.weight;
        const preview = resolveNutritionPreview({ ...(ob.data ?? {}), weight }, plan.data?.macros_json);
        
        setTargets(preview);
        setFailed(false);
      } catch (error) {
        console.error("Error in BasicNutrition load:", error);
        if (active) {
          setFailed(true);
        }
      } finally {
        if (active) {
          setLoading(false);
        }
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
  }, [userId]);

  if (loading) {
    return (
      <div className="flex min-h-[200px] items-center justify-center">
        <Spinner label="Calculando objetivos" />
      </div>
    );
  }

  if (failed) {
    return (
      <EmptyState
        icon={Apple}
        title="No se pudieron cargar tus objetivos"
        description="Comprueba tu conexión e inténtalo de nuevo"
        action={
          <Button onClick={() => window.location.reload()}>
            Reintentar
          </Button>
        }
      />
    );
  }

  if (!targets) {
    return (
      <EmptyState
        icon={Apple}
        title="No hay datos disponibles"
        action={<Button onClick={onEdit}>Completar mis datos</Button>}
      />
    );
  }

  if (!targets.hasWeight) {
    return (
      <section className="mx-auto w-full max-w-[680px] space-y-8 pb-4">
        <div>
          <NutritionIntro />
          <MacrosWeightCard userId={userId} />
        </div>
        <NutritionPlusSection onUpgrade={onUpgrade} />
      </section>
    );
  }

  return (
    <section className="mx-auto w-full max-w-[680px] space-y-8 pb-4">
      <div>
        <NutritionIntro />
        {/* Anillo de calorías y barras de macros (maqueta de ChatGPT); solo cifras reales del plan o del cálculo inicial. */}
        <NutritionHero
          target={{ kcal: targets.calories ?? 0, protein: targets.protein ?? 0, carbs: targets.carbs ?? 0, fats: targets.fats ?? 0 }}
          footnote="Estimación inicial según tus datos y objetivo. No sustituye una valoración nutricional individual."
        >
          <Button variant="plain" className="-ml-4 mt-1" onClick={() => { void hapticTap(); onEdit(); }}>Actualizar datos</Button>
        </NutritionHero>
      </div>
      <NutritionPlusSection onUpgrade={onUpgrade} />
    </section>
  );
}

/** Sin peso no hay macros: se pide aquí mismo (como la app) y los objetivos salen al momento. */
function MacrosWeightCard({ userId }: { userId: string }) {
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
  };

  return (
    <form className="space-y-4 rounded-[22px] border border-border bg-card p-5" onSubmit={(e) => { e.preventDefault(); void save(); }}>
      <Flame aria-hidden="true" className="h-7 w-7 text-primary" strokeWidth={1.75} />
      <div>
        <h2 className="type-title2">Calcula tus macros</h2>
        <p className="mt-1 type-subhead text-muted-foreground">Dinos tu peso y te damos tus calorías y tu proteína del día. Gratis.</p>
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
