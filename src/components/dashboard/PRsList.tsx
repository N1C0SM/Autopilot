import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Trophy, WifiOff } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { ListGroup, ListRow } from "@/components/ui/list";
import { Skeleton } from "@/components/ui/skeleton";
import { hapticTap } from "@/lib/native";
import { useExerciseImages } from "@/hooks/useExerciseImages";

interface PR {
  id: string;
  exercise_name: string;
  weight: number;
  reps: number;
  estimated_1rm: number | null;
  achieved_at: string;
}

interface Props {
  userId: string;
}

const PRsList = ({ userId }: Props) => {
  const [prs, setPrs] = useState<PR[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [reload, setReload] = useState(0);
  const images = useExerciseImages(prs.slice(0, 20).map((pr) => pr.exercise_name));

  const retry = useCallback(() => {
    void hapticTap();
    setReload((value) => value + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setLoadError(false);
      const { data, error } = await supabase
        .from("personal_records")
        .select("*")
        .eq("user_id", userId)
        .order("estimated_1rm", { ascending: false, nullsFirst: false })
        .limit(50);

      if (cancelled) return;
      // Un fallo de red no puede parecer «Sin récords aún»: se muestra error y reintento.
      if (error || !data) {
        setLoadError(true);
        setLoading(false);
        return;
      }
      // Group by exercise, keep best 1RM
      const best: Record<string, PR> = {};
      for (const pr of data as PR[]) {
        const key = pr.exercise_name;
        if (!best[key] || (pr.estimated_1rm ?? 0) > (best[key].estimated_1rm ?? 0)) {
          best[key] = pr;
        }
      }
      setPrs(Object.values(best).sort((a, b) => (b.estimated_1rm ?? 0) - (a.estimated_1rm ?? 0)));
      setLoading(false);
    };
    void load();
    return () => { cancelled = true; };
  }, [userId, reload]);

  const formatDate = (date: string) =>
    new Date(date).toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" });

  if (loading) {
    return (
      <div role="status" aria-label="Cargando récords personales" className="space-y-8">
        <div>
          <Skeleton className="h-7 w-7 rounded-lg" />
          <Skeleton className="mt-4 h-14 w-36" />
          <Skeleton className="mt-3 h-5 w-52" />
        </div>
        <div className="overflow-hidden rounded-2xl bg-card">
          {[0, 1, 2].map((row) => (
            <div key={row} className="flex min-h-[60px] items-center justify-between gap-4 px-4 [&:not(:last-child)]:sep-b">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-4 w-16" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div role="alert">
        <EmptyState
          icon={WifiOff}
          title="No se han podido cargar tus récords"
          description="Tus marcas siguen guardadas. Comprueba la conexión y vuelve a intentarlo."
          className="min-h-[55dvh]"
          action={
            <Button type="button" variant="plain" onClick={retry}>
              Reintentar
            </Button>
          }
        />
      </div>
    );
  }

  if (prs.length === 0) {
    return (
      <EmptyState
        icon={Trophy}
        title="Sin récords aún"
        description="Registra tus entrenos con peso y rompe tu primer récord personal."
        className="min-h-[55dvh]"
      />
    );
  }

  // Decimales en español (49,6), como en el resto de la app.
  const kg = (n: number) => n.toLocaleString("es-ES", { maximumFractionDigits: 1 });
  const top = prs[0];
  const topHasEstimate = top.estimated_1rm != null;

  return (
    <div className="space-y-8 lg:grid lg:grid-cols-[280px_1fr] lg:gap-12 lg:space-y-0 lg:items-start">
      <section aria-label="Tu mejor marca" className="relative overflow-hidden rounded-[28px] bg-card lg:sticky lg:top-4">
        {/* Portada del récord con la foto real del ejercicio, como las sesiones y la landing. */}
        {images[top.exercise_name] && <>
          <img src={images[top.exercise_name]} alt="" decoding="async" className="absolute inset-0 h-full w-full object-cover object-[50%_30%] animate-in fade-in duration-500" />
          <span aria-hidden="true" className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/45 to-black/10" />
        </>}
        <span aria-hidden="true" className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full bg-[radial-gradient(closest-side,hsl(var(--primary)/0.2),transparent)]" />
        <div className={`relative flex flex-col justify-end p-5 ${images[top.exercise_name] ? "min-h-[16rem]" : ""}`}>
          <p className="flex items-center gap-1.5 type-subhead font-semibold text-primary"><Trophy className="h-4 w-4" strokeWidth={2.5} aria-hidden="true" />Tu mejor marca</p>
          <p className="mt-2 font-rounded text-[64px] font-bold leading-none tracking-tight tabular-nums text-white">
            {kg(topHasEstimate ? top.estimated_1rm! : top.weight)}
            <span className="ml-1.5 type-title3 text-white/70">kg</span>
          </p>
          <p className="mt-2 type-subhead text-white/75">
            {topHasEstimate
              ? `1RM estimado en ${top.exercise_name}`
              : `Tu mejor serie en ${top.exercise_name}, ${top.reps} reps`}
          </p>
        </div>
      </section>

      <ListGroup header="Tus récords personales">
        {prs.slice(0, 20).map((pr) => (
          <ListRow
            key={pr.id}
            leading={<span aria-hidden="true" className="block h-11 w-11 overflow-hidden rounded-xl bg-secondary">{images[pr.exercise_name] && <img src={images[pr.exercise_name]} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover object-[50%_30%]" />}</span>}
            title={pr.exercise_name}
            subtitle={formatDate(pr.achieved_at)}
            trailing={
              <span className="block text-right">
                <span className="block type-body font-rounded font-semibold tabular-nums">
                  {kg(pr.weight)} kg × {pr.reps}
                </span>
                {pr.estimated_1rm != null && (
                  <span className="mt-0.5 block type-footnote tabular-nums text-muted-foreground">
                    1RM ~{kg(pr.estimated_1rm)} kg
                  </span>
                )}
              </span>
            }
          />
        ))}
      </ListGroup>
    </div>
  );
};

export default PRsList;
