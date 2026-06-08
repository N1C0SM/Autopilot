import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { ArrowRight, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      // Penúltimo scan: el actual aún puede no estar guardado, así que cogemos el más reciente existente.
      const { data } = await (supabase as any)
        .from("scan_history")
        .select("id, taken_at, current_photo_url, physique, attractiveness, potential")
        .eq("user_id", userId)
        .order("taken_at", { ascending: false })
        .limit(1);
      if (!active) return;
      const row = (data && data[0]) || null;
      setPrev(row);
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [userId]);

  if (loading || !prev || !prev.current_photo_url) return null;

  const pPhys = Number(prev.physique ?? 0);
  const delta = currentScores.physique - pPhys;
  const TrendIcon = delta > 0.1 ? TrendingUp : delta < -0.1 ? TrendingDown : Minus;
  const trendColor = delta > 0.1 ? "text-success" : delta < -0.1 ? "text-destructive" : "text-muted-foreground";
  const dateLabel = new Date(prev.taken_at).toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" });

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-4xl mx-auto mb-8 rounded-2xl border border-primary/30 bg-card/60 backdrop-blur p-5"
    >
      <div className="flex items-center justify-between mb-4">
        <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Antes vs. ahora
        </span>
        <div className={`flex items-center gap-1.5 text-sm font-medium ${trendColor}`}>
          <TrendIcon className="w-4 h-4" />
          {delta > 0 ? "+" : ""}
          {delta.toFixed(1)} físico
        </div>
      </div>
      <div className="grid grid-cols-[1fr,auto,1fr] gap-4 items-center">
        <div className="text-center">
          <img
            src={prev.current_photo_url}
            alt="Scan anterior"
            className="w-full aspect-[3/4] object-cover rounded-xl border border-border mb-2"
          />
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Antes · {dateLabel}</div>
          <div className="text-2xl font-bold font-display text-gradient">{pPhys.toFixed(1)}</div>
        </div>
        <ArrowRight className="w-6 h-6 text-primary" />
        <div className="text-center">
          {currentPhoto ? (
            <img
              src={currentPhoto}
              alt="Scan actual"
              className="w-full aspect-[3/4] object-cover rounded-xl border border-primary/40 mb-2 glow-shadow"
            />
          ) : (
            <div className="w-full aspect-[3/4] rounded-xl border border-primary/40 bg-muted/30 mb-2" />
          )}
          <div className="text-[10px] uppercase tracking-wider text-primary">Ahora</div>
          <div className="text-2xl font-bold font-display text-gradient">{currentScores.physique.toFixed(1)}</div>
        </div>
      </div>
    </motion.div>
  );
}