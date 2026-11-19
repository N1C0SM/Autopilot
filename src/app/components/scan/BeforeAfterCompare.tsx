import { useEffect, useState } from "react";
import { ArrowUp } from "lucide-react";
import { formatDecimal } from "@/shared/lib/numberFormat";
import { supabase } from "@/shared/integrations/supabase/client";
import { signedUrlFor } from "@/shared/lib/storageSign";
import { ScanImage } from "@/app/components/scan/ScanResultParts";

type Prev = {
  id: string;
  taken_at: string;
  current_photo_url: string | null;
  physique: number | null;
};

/**
 * «Antes y ahora»: la foto del scan anterior y la de hoy, lado a lado, con su nota de físico en
 * Big Shoulders. Solo se destaca lo que sube (en dorado); nunca una resta en rojo.
 */
export default function BeforeAfterCompare({
  userId,
  currentPhoto,
  currentPhysique,
}: {
  userId: string;
  currentPhoto: string | null;
  currentPhysique: number;
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
        .select("id, taken_at, current_photo_url, physique")
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

  if (loading || !prev || !photoUrl || prev.physique == null) return null;

  const before = Number(prev.physique);
  const gain = currentPhysique - before;
  // «12 nov 2026», sin el punto de la abreviatura (como el resto del scan).
  const dateLabel = new Date(prev.taken_at).toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" }).replace(/\./g, "");

  return (
    <section aria-labelledby="scan-before-after" className="flex flex-col gap-2.5">
      <div className="flex items-center justify-between gap-3">
        <h2 id="scan-before-after" className="type-title3">Antes y ahora</h2>
        {gain >= 0.1 && (
          <span className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full bg-primary/15 px-2.5 py-1 type-footnote font-semibold tabular-nums text-primary">
            <ArrowUp className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden="true" />+{formatDecimal(gain, 1)} de físico
          </span>
        )}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <figure className="min-w-0">
          <ScanImage src={photoUrl} alt={`Scan del ${dateLabel}`} className="aspect-[3/4] w-full rounded-card" />
          <figcaption className="mt-2">
            <span className="block truncate type-footnote text-muted-foreground">Antes · {dateLabel}</span>
            <span className="mt-1 block type-figure text-[34px] leading-none">{formatDecimal(before, 1)}</span>
          </figcaption>
        </figure>
        <figure className="min-w-0">
          <ScanImage src={currentPhoto} alt="Scan de hoy" className="aspect-[3/4] w-full rounded-card" />
          <figcaption className="mt-2">
            <span className="block type-footnote font-semibold text-primary">Ahora</span>
            <span className="mt-1 block type-figure text-[34px] leading-none">{formatDecimal(currentPhysique, 1)}</span>
          </figcaption>
        </figure>
      </div>
    </section>
  );
}
