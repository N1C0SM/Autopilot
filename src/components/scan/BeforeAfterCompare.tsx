import { useEffect, useState } from "react";
import { ChevronRight, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { Surface } from "@/components/ui/surface";
import { supabase } from "@/integrations/supabase/client";
import { signedUrlFor } from "@/lib/storageSign";

type Prev = {
  id: string;
  taken_at: string;
  current_photo_url: string | null;
  physique: number | null;
  attractiveness: number | null;
  potential: number | null;
};

export default function BeforeAfterCompare({
  userId,
  currentPhoto,
  currentScores,
}: {
  userId: string;
  currentPhoto: string | null;
  currentScores: { physique: number; attractiveness: number; potential: number };
}) {
  const [prev, setPrev] = useState<Prev | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      // Penúltimo scan: el actual aún puede no estar guardado, así que cogemos el más reciente existente.
      const { data } = await supabase
        .from("scan_history")
        .select("id, taken_at, current_photo_url, physique, attractiveness, potential")
        .eq("user_id", userId)
        .order("taken_at", { ascending: false })
        .limit(2);
      if (!active) return;
      const list = (data as Prev[]) || [];
      // Si el más reciente es de hace <2 min, asumimos que es el scan actual que se acaba de guardar.
      const recentIsCurrent =
        list.length > 0 &&
        Date.now() - new Date(list[0].taken_at).getTime() < 120_000;
      const row = recentIsCurrent ? list[1] ?? null : list[0] ?? null;
      if (!active) return;
      // progress-photos es privado: firmamos la ruta antes de pintarla.
      const raw = row?.current_photo_url ?? null;
      const signed = raw ? await signedUrlFor("progress-photos", raw) : null;
      if (!active) return;
      setPrev(row);
      setPhotoUrl(signed ?? raw);
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [userId]);

  if (loading || !prev || !photoUrl) return null;

  const pPhys = Number(prev.physique ?? 0);
  const delta = currentScores.physique - pPhys;
  const TrendIcon = delta > 0.1 ? TrendingUp : delta < -0.1 ? TrendingDown : Minus;
  const trendColor = delta > 0.1 ? "text-success" : delta < -0.1 ? "text-destructive" : "text-muted-foreground";
  const dateLabel = new Date(prev.taken_at).toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" });

  return (
    <Surface className="mx-auto mb-8 max-w-4xl">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="type-headline">Antes vs. ahora</h3>
        <div className={`flex items-center gap-1.5 type-subhead font-semibold tabular-nums ${trendColor}`}>
          <TrendIcon className="h-4 w-4" aria-hidden="true" />
          {delta > 0 ? "+" : ""}
          {delta.toFixed(1)} físico
        </div>
      </div>
      <div className="grid grid-cols-[1fr,auto,1fr] items-center gap-3">
        <div className="text-center">
          <img loading="lazy" decoding="async"
            src={photoUrl}
            alt="Scan anterior"
            className="mb-2 aspect-[3/4] w-full rounded-xl object-cover"
          />
          <p className="type-footnote text-muted-foreground">Antes · {dateLabel}</p>
          <p className="mt-0.5 font-rounded text-[28px] font-bold leading-8 tabular-nums">{pPhys.toFixed(1)}</p>
        </div>
        <ChevronRight className="h-5 w-5 text-muted-foreground/60" strokeWidth={2.5} aria-hidden="true" />
        <div className="text-center">
          {currentPhoto ? (
            <img loading="lazy" decoding="async"
              src={currentPhoto}
              alt="Scan actual"
              className="mb-2 aspect-[3/4] w-full rounded-xl object-cover"
            />
          ) : (
            <div className="mb-2 aspect-[3/4] w-full rounded-xl bg-secondary" />
          )}
          <p className="type-footnote font-semibold text-primary">Ahora</p>
          <p className="mt-0.5 font-rounded text-[28px] font-bold leading-8 tabular-nums">{currentScores.physique.toFixed(1)}</p>
        </div>
      </div>
    </Surface>
  );
}
