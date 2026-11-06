import NutritionPlusSection from "@/app/components/dashboard/NutritionPlusSection";
import { useEffect, useState } from "react";
import { supabase } from "@/shared/integrations/supabase/client";
import { estimateCarbsFats, parseMacroTargets, resolveNutritionPreview, type NutritionPreview } from "@/shared/lib/nutrition";
import { Spinner } from "@/shared/components/ui/spinner";
import { EmptyState } from "@/shared/components/ui/empty-state";
import { Button } from "@/shared/components/ui/button";
import { Apple, Flame } from "lucide-react";
import { Input } from "@/shared/components/ui/input";
import { hapticNotify, hapticTap } from "@/shared/lib/native";

export default function BasicNutrition({ userId, onEdit, onUpgrade }: { userId: string; onEdit: () => void; onUpgrade?: () => void }) {
  const [targets, setTargets] = useState<NutritionPreview | null>(null);
  /** Carbohidratos y grasas de la tarjeta: los del plan o, sin él (sin Plus), estimados como en el iPhone. */
  const [split, setSplit] = useState<{ carbs: number; fats: number } | null>(null);
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
        const saved = parseMacroTargets(plan.data?.macros_json);
        setSplit(saved ? { carbs: Math.round(saved.carbs), fats: Math.round(saved.fats) }
          : preview.calories && preview.protein ? estimateCarbsFats(preview.calories, preview.protein) : null);
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
      <section className="w-full space-y-8 py-4">
        <p className="-mb-4 -mt-3 type-subhead text-muted-foreground md:hidden">Plan de alimentación básico.</p>
        <MacrosWeightCard userId={userId} />
        <NutritionPlusSection onUpgrade={onUpgrade} />
      </section>
    );
  }

  return (
    <section className="w-full space-y-8 py-4">
      <p className="-mb-4 -mt-3 type-subhead text-muted-foreground md:hidden">Plan de alimentación básico.</p>
      {/* Calorías del día y macros a la derecha (maqueta de ChatGPT); solo cifras reales del plan o del cálculo inicial. */}
      <div className="rounded-[22px] border border-border bg-card p-5">
        <div className="flex items-center gap-4">
          <div role="group" aria-label={`Calorías diarias: ${targets.calories?.toLocaleString("es-ES")} kcal`} className="flex min-w-0 flex-1 items-center gap-3">
            <span className="min-w-0">
              {/* Llama pequeña junto a la etiqueta: con la grande al lado, «Calorías» se partía en dos líneas en el móvil. */}
              <span className="flex items-center gap-1.5 whitespace-nowrap type-footnote text-muted-foreground">
                <Flame aria-hidden className="h-4 w-4 shrink-0 fill-primary text-primary" strokeWidth={1.75} />Calorías diarias
              </span>
              <span className="block whitespace-nowrap text-[28px] font-bold leading-tight tracking-tight tabular-nums">
                {targets.calories?.toLocaleString("es-ES")}<span className="ml-1 text-[17px] font-semibold">kcal</span>
              </span>
            </span>
          </div>
          <ul aria-label="Macros del día" className="shrink-0 space-y-1.5 border-l border-border pl-4">
            {[
              { label: "Proteína", value: targets.protein, dot: "bg-primary" },
              { label: "Carbohidratos", value: split?.carbs ?? null, dot: "bg-primary/60" },
              { label: "Grasas", value: split?.fats ?? null, dot: "bg-primary/30" },
            ].filter((m) => m.value !== null).map((m) => (
              <li key={m.label} className="flex items-center gap-2 type-footnote">
                <span aria-hidden className={`h-2 w-2 shrink-0 rounded-full ${m.dot}`} />
                <span className="text-muted-foreground">{m.label}</span>
                <span className="ml-auto pl-3 font-semibold tabular-nums">{m.value} g</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="mt-4 flex items-end justify-between gap-4 border-t border-border pt-3">
          <p className="type-caption1 text-muted-foreground">Estimación inicial según tus datos y objetivo. No sustituye una valoración nutricional individual.</p>
          <Button variant="outline" size="sm" className="shrink-0" onClick={onEdit}>Actualizar datos</Button>
        </div>
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
