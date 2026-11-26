import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/shared/integrations/supabase/client";
import { CalendarDays, Dumbbell, Sparkles, Trophy, WifiOff } from "lucide-react";
import { EmptyState } from "@/shared/components/ui/empty-state";
import { Button } from "@/shared/components/ui/button";
import { ListGroup, ListRow } from "@/shared/components/ui/list";
import { Spinner } from "@/shared/components/ui/spinner";
import { hapticTap } from "@/shared/lib/native";
import { kgText } from "@/shared/lib/workoutSummaryFormat";
import { BRAND_PHOTOS, useBrandPhotos } from "@/shared/lib/brandPhotos";
import { ProgressHero } from "@/app/components/progress/ProgressHero";
import { useExerciseImages } from "@/shared/hooks/useExerciseImages";
import { fastImage, THUMB_SIDE } from "@/shared/lib/fastImage";

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
    // Carga con la firma de marca (el AP latiendo), nunca bloques grises.
    return (
      <div className="flex justify-center py-16">
        <Spinner size="lg" label="Cargando tus récords" />
      </div>
    );
  }

  if (loadError) {
    return (
      <div role="alert">
        <EmptyState
          icon={WifiOff}
          title="No hemos podido cargar tus récords"
          description="Revisa tu conexión y vuelve a intentarlo. Tus marcas siguen guardadas."
          action={
            <Button type="button" variant="secondary" size="lg" onClick={retry}>
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
  const kg = kgText;
  const top = prs[0];
  const topHasEstimate = top.estimated_1rm != null;
  // Cifras de cabecera, todas de los propios récords: cuántos, cuántos de este mes y el último.
  const monthKey = toMonthKey(new Date().toISOString());
  const isThisMonth = (pr: PR) => toMonthKey(pr.achieved_at) === monthKey;
  const thisMonth = prs.filter(isThisMonth).length;
  const latest = prs.reduce((a, b) => (a.achieved_at > b.achieved_at ? a : b));
  const shortDate = (date: string) => new Date(date).toLocaleDateString("es-ES", { day: "numeric", month: "short" });

  const topImage = images[top.exercise_name];

  return (
    // Una columna (también en la web ancha y el Mac, dentro de la columna de 680), como la app.
    <div className="space-y-6">
      <section aria-label="Tu mejor marca" className="relative overflow-hidden rounded-[28px] bg-card">
        {/* Portada del récord con la foto real del ejercicio; sin foto, la tarjeta compacta con la cifra. */}
        {topImage && <>
          <img src={topImage} alt="" decoding="async" className="absolute inset-0 h-full w-full object-cover object-[50%_30%] animate-in fade-in duration-500" />
          <span aria-hidden="true" className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/45 to-black/10" />
        </>}
        <div className={`relative flex flex-col justify-end p-5 ${topImage ? "min-h-[16rem]" : ""}`}>
          <p className="flex items-center gap-1.5 type-subhead font-semibold text-primary">
            <Trophy className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden="true" />Tu mejor marca
          </p>
          <p className={`mt-2 whitespace-nowrap ${topImage ? "text-white" : "text-foreground"}`}>
            <span className="type-figure text-[64px] leading-none">{kg(topHasEstimate ? top.estimated_1rm! : top.weight)}</span>
            <span className={`ml-1.5 type-title3 ${topImage ? "text-white/70" : "text-muted-foreground"}`}>kg</span>
          </p>
          <p className={`mt-2 line-clamp-2 type-subhead ${topImage ? "text-white/75" : "text-muted-foreground"}`}>
            {topHasEstimate
              ? `1RM estimado en ${top.exercise_name}`
              : `Tu mejor serie en ${top.exercise_name}, ${top.reps} ${top.reps === 1 ? "rep" : "reps"}`}
          </p>
        </div>
      </section>

      <div className="space-y-6">
      <div className="grid grid-cols-3 gap-2" role="group" aria-label="Resumen de tus récords">
        {[
          { value: String(prs.length), label: "Ejercicios con récord", accent: false },
          { value: String(thisMonth), label: "Nuevos este mes", accent: thisMonth > 0 },
          { value: shortDate(latest.achieved_at), label: "Último récord", accent: false },
        ].map((stat) => (
          <div key={stat.label} className="flex min-w-0 flex-col items-center gap-1.5 rounded-[22px] bg-card px-2 py-4 text-center">
            <p className={`max-w-full truncate type-figure text-[28px] leading-none ${stat.accent ? "text-primary" : ""}`}>{stat.value}</p>
            <p className="type-footnote text-muted-foreground">{stat.label}</p>
          </div>
        ))}
      </div>
      <section aria-labelledby="records-list-title">
      <h3 id="records-list-title" className="mb-2.5 type-title3">Tus récords personales</h3>
      <ListGroup>
        {prs.slice(0, 20).map((pr) => (
          <ListRow
            key={pr.id}
            leading={<span aria-hidden="true" className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-media bg-secondary">{images[pr.exercise_name] ? <img src={fastImage(images[pr.exercise_name], THUMB_SIDE)} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover object-[50%_30%]" /> : <Dumbbell className="h-[18px] w-[18px] text-muted-foreground" strokeWidth={1.75} />}</span>}
            title={pr.exercise_name}
            subtitle={isThisMonth(pr)
              ? <span className="inline-flex items-center gap-1.5">{formatDate(pr.achieved_at)}<span className="rounded-full bg-primary/15 px-2 py-px type-footnote font-semibold text-primary">Nuevo</span></span>
              : formatDate(pr.achieved_at)}
            trailing={
              // Las cifras nunca se parten: «80 kg × 5» y «1RM ~93 kg» van enteras en su línea.
              <span className="block text-right">
                <span className="block whitespace-nowrap type-body font-semibold tabular-nums">
                  {kg(pr.weight)} kg × {pr.reps}
                </span>
                {pr.estimated_1rm != null && (
                  <span className="mt-0.5 block whitespace-nowrap type-footnote tabular-nums text-muted-foreground">
                    1RM ~{kg(pr.estimated_1rm)} kg
                  </span>
                )}
              </span>
            }
          />
        ))}
      </ListGroup>
      </section>
      </div>
    </div>
  );
};

export default PRsList;
