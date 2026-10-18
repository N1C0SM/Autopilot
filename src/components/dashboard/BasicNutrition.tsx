import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { resolveNutritionPreview, type NutritionPreview } from "@/lib/nutrition";
import { Spinner } from "@/components/ui/spinner";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { Apple } from "lucide-react";
export default function BasicNutrition({ userId, onEdit }: { userId: string; onEdit: () => void }) {
  const [targets, setTargets] = useState<NutritionPreview | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let active = true;
    supabase.from("onboarding").select("weight, sex, goal").eq("user_id", userId).maybeSingle().then(({ data, error }) => {
      if (!active) return;
      if (error) setFailed(true); else setTargets(resolveNutritionPreview(data ?? {}));
    });
    return () => { active = false; };
  }, [userId]);
  if (failed) return <EmptyState icon={Apple} title="No se pudieron cargar tus objetivos" action={<Button onClick={onEdit}>Ver mis datos</Button>} />;
  if (!targets) return <Spinner label="Calculando objetivos" />;
  if (!targets.hasWeight) return <EmptyState icon={Apple} title="Completa tu peso para calcular tus objetivos" action={<Button onClick={onEdit}>Completar mis datos</Button>} />;
  return <section className="mx-auto max-w-2xl space-y-8 py-4">
    <h2 className="type-title1">Tus objetivos diarios</h2>
    <dl className="grid grid-cols-2 gap-6">
      <div><dt className="type-subhead text-muted-foreground">Calorías</dt><dd className="mt-2 type-large-title tabular-nums">{targets.calories?.toLocaleString("es-ES")} <span className="type-subhead">kcal</span></dd></div>
      <div><dt className="type-subhead text-muted-foreground">Proteína</dt><dd className="mt-2 type-large-title tabular-nums">{targets.protein} <span className="type-subhead">g</span></dd></div>
    </dl>
    <p className="type-footnote text-muted-foreground">Estimación inicial según tus datos y objetivo. No sustituye una valoración nutricional individual.</p>
    <Button variant="plain" onClick={onEdit}>Actualizar mis datos</Button>
  </section>;
}
