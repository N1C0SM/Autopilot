import { useEffect, useState } from "react";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { supabase } from "@/shared/integrations/supabase/client";
import { signedUrlFor } from "@/shared/lib/storageSign";
import { ScanImage } from "@/app/components/scan/ScanResultParts";

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
    <section aria-labelledby="scan-before-after" className="w-full text-left">
      <div className="mb-4 flex items-end justify-between gap-3">
        <h2 id="scan-before-after" className="type-title2">Antes vs. ahora</h2>
        <p className={`flex items-center gap-1 type-subhead font-semibold tabular-nums ${trendColor}`}>
          <TrendIcon className="h-5 w-5" aria-hidden="true" />
          {delta > 0 ? "+" : ""}
          {delta.toFixed(1)} físico
        </p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <figure className="min-w-0">
          <ScanImage src={photoUrl} alt="Scan anterior" className="aspect-[3/4] w-full rounded-2xl" />
          <figcaption className="mt-2">
            <span className="block type-subhead text-muted-foreground">Antes · {dateLabel}</span>
            <span className="mt-0.5 block font-rounded text-[34px] font-bold leading-none tabular-nums">{pPhys.toFixed(1)}</span>
          </figcaption>
        </figure>
        <figure className="min-w-0">
          <ScanImage src={currentPhoto} alt="Scan actual" className="aspect-[3/4] w-full rounded-2xl" />
          <figcaption className="mt-2">
            <span className="block type-subhead font-semibold text-primary">Ahora</span>
            <span className="mt-0.5 block font-rounded text-[34px] font-bold leading-none tabular-nums">{currentScores.physique.toFixed(1)}</span>
          </figcaption>
        </figure>
      </div>
    </section>
  );
}
