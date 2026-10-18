import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { resolveNutritionPreview, type NutritionPreview } from "@/lib/nutrition";
import { Spinner } from "@/components/ui/spinner";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { Apple } from "lucide-react";
import { ProgressRing } from "@/components/ui/progress-ring";
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
    <div className="flex items-center gap-6">
      <ProgressRing value={100} size={144} stroke={14} label={`Objetivo: ${targets.calories} kcal al día`}>
        <span className="flex flex-col items-center">
          <span className="font-rounded text-[36px] font-bold leading-none tabular-nums text-foreground">{targets.calories?.toLocaleString("es-ES")}</span>
          <span className="mt-1 type-footnote text-muted-foreground">kcal / día</span>
        </span>
      </ProgressRing>
      <div className="flex items-center gap-3">
        <ProgressRing value={100} size={64} stroke={7} label={`Proteína: ${targets.protein} g al día`}>
          <span className="font-rounded text-[17px] font-bold tabular-nums text-foreground">{targets.protein}</span>
        </ProgressRing>
        <div><p className="type-headline tabular-nums">{targets.protein} g</p><p className="type-subhead text-muted-foreground">proteína / día</p></div>
      </div>
    </div>
    <p className="type-footnote text-muted-foreground">Estimación inicial según tus datos y objetivo. No sustituye una valoración nutricional individual.</p>
    <Button variant="plain" onClick={onEdit}>Actualizar mis datos</Button>
  </section>;
}
