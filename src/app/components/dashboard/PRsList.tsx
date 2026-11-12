import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/shared/integrations/supabase/client";
import { CalendarDays, Sparkles, Trophy, WifiOff } from "lucide-react";
import { EmptyState } from "@/shared/components/ui/empty-state";
import { Button } from "@/shared/components/ui/button";
import { ListGroup, ListRow } from "@/shared/components/ui/list";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { hapticTap } from "@/shared/lib/native";
import { BRAND_PHOTOS, useBrandPhotos } from "@/shared/lib/brandPhotos";
import { ProgressHero } from "@/app/components/progress/ProgressHero";
import { useExerciseImages } from "@/shared/hooks/useExerciseImages";

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
  /** «Ir a entrenar» desde la portada sin récords (como `onNavigate(.train)` en la app). */
  onGoTrain?: () => void;
}

/** Lo que guarda Récords: la mejor marca de cada ejercicio, los nuevos del mes y su fecha. */
const RECORD_PERKS = [
  { icon: Trophy, text: "Tu mejor marca de cada ejercicio" },
  { icon: Sparkles, text: "Los récords nuevos de cada mes" },
  { icon: CalendarDays, text: "El día en que rompiste cada uno" },
];

/** «2026-11» de una fecha ISO o «YYYY-MM-DD», en hora local. */
const toMonthKey = (date: string) => {
  const d = new Date(date);
  return Number.isNaN(d.getTime()) ? "" : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};

const PRsList = ({ userId, onGoTrain }: Props) => {
  useBrandPhotos(); // repinta las fotos de marca cuando llega su URL actual
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
          <Skeleton className="h-7 w-7 rounded-chip" />
          <Skeleton className="mt-4 h-14 w-36" />
          <Skeleton className="mt-3 h-5 w-52" />
        </div>
        <div className="overflow-hidden rounded-media bg-card">
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
      // Sin récords: misma portada que Físico, con foto real, lo que guarda Récords y el camino a Entrenar.
      <ProgressHero
        photo={BRAND_PHOTOS.dumbbells}
        photoPosition="50% 40%"
        eyebrow="Tus récords"
        title="Tu primer récord está a un entreno"
        message="Cada vez que registras una serie con peso, guardamos tu mejor marca de ese ejercicio."
        perks={RECORD_PERKS}
        action={onGoTrain ? { label: "Ir a entrenar", onClick: onGoTrain } : undefined}
      />
    );
  }

  // Decimales en español (49,6), como en el resto de la app.
  const kg = (n: number) => n.toLocaleString("es-ES", { maximumFractionDigits: 1 });
  const top = prs[0];
  const topHasEstimate = top.estimated_1rm != null;
  // Cifras de cabecera, todas de los propios récords: cuántos, cuántos de este mes y el último.
  const monthKey = toMonthKey(new Date().toISOString());
  const isThisMonth = (pr: PR) => toMonthKey(pr.achieved_at) === monthKey;
  const thisMonth = prs.filter(isThisMonth).length;
  const latest = prs.reduce((a, b) => (a.achieved_at > b.achieved_at ? a : b));
  const shortDate = (date: string) => new Date(date).toLocaleDateString("es-ES", { day: "numeric", month: "short" });

  return (
    <div className="space-y-8 lg:grid lg:grid-cols-[280px_1fr] lg:gap-12 lg:space-y-0 lg:items-start">
      <section aria-label="Tu mejor marca" className="relative overflow-hidden rounded-[28px] bg-card ring-1 ring-primary/20 lg:sticky lg:top-4">
        {/* Portada del récord con la foto real del ejercicio, como las sesiones y la landing. */}
        {images[top.exercise_name] && <>
          <img src={images[top.exercise_name]} alt="" decoding="async" className="absolute inset-0 h-full w-full object-cover object-[50%_30%] animate-in fade-in duration-500" />
          <span aria-hidden="true" className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/45 to-black/10" />
        </>}
        <div className={`relative flex flex-col justify-end p-5 ${images[top.exercise_name] ? "min-h-[16rem]" : ""}`}>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Tu mejor marca</p>
          <p className="mt-2 text-[64px] font-semibold leading-none tracking-tight tabular-nums text-white">
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

      <div className="space-y-8">
      <div className="grid grid-cols-3 gap-2" aria-label="Resumen de tus récords">
        {[
          { value: String(prs.length), label: "Ejercicios con récord", accent: false },
          { value: String(thisMonth), label: "Nuevos este mes", accent: thisMonth > 0 },
          { value: shortDate(latest.achieved_at), label: "Último récord", accent: false },
        ].map((stat) => (
          <div key={stat.label} className="flex min-w-0 flex-col gap-1 rounded-[22px] bg-card px-3 py-4 text-center">
            <p className={`truncate font-rounded text-[26px] font-bold leading-none tabular-nums ${stat.accent ? "text-primary" : ""}`}>{stat.value}</p>
            <p className="type-caption1 text-muted-foreground">{stat.label}</p>
          </div>
        ))}
      </div>
      <ListGroup header="Tus récords personales">
        {prs.slice(0, 20).map((pr) => (
          <ListRow
            key={pr.id}
            leading={<span aria-hidden="true" className="block h-11 w-11 overflow-hidden rounded-media bg-secondary">{images[pr.exercise_name] && <img src={images[pr.exercise_name]} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover object-[50%_30%]" />}</span>}
            title={pr.exercise_name}
            subtitle={isThisMonth(pr)
              ? <span className="inline-flex items-center gap-1.5">{formatDate(pr.achieved_at)}<span className="rounded-full bg-primary/15 px-1.5 py-px type-caption2 font-semibold text-primary">Nuevo</span></span>
              : formatDate(pr.achieved_at)}
            trailing={
              <span className="block text-right">
                <span className="block type-body font-semibold tabular-nums">
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
    </div>
  );
};

export default PRsList;
