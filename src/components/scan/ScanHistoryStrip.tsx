import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { History, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type Row = {
  id: string;
  taken_at: string;
  physique: number | null;
  attractiveness: number | null;
  potential: number | null;
  current_photo_url: string | null;
};

export default function ScanHistoryStrip({ userId }: { userId: string }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data } = await (supabase as any)
        .from("scan_history")
        .select("id, taken_at, physique, attractiveness, potential, current_photo_url")
        .eq("user_id", userId)
        .order("taken_at", { ascending: false })
        .limit(6);
      if (!active) return;
      setRows((data as Row[]) || []);
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [userId]);

  if (loading || rows.length === 0) return null;

  const ordered = [...rows].reverse(); // antiguo → reciente
  const first = Number(ordered[0]?.physique ?? 0);
  const last = Number(ordered[ordered.length - 1]?.physique ?? 0);
  const delta = last - first;
  const TrendIcon = delta > 0.1 ? TrendingUp : delta < -0.1 ? TrendingDown : Minus;
  const trendColor = delta > 0.1 ? "text-success" : delta < -0.1 ? "text-destructive" : "text-muted-foreground";

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-4xl mx-auto mb-8 rounded-2xl border border-border bg-card/60 backdrop-blur p-5"
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <History className="w-4 h-4 text-primary" />
          <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Tu historial de scans
          </span>
        </div>
        {rows.length > 1 && (
          <div className={`flex items-center gap-1.5 text-sm font-medium ${trendColor}`}>
            <TrendIcon className="w-4 h-4" />
            {delta > 0 ? "+" : ""}
            {delta.toFixed(1)} físico
          </div>
        )}
      </div>
      <div className="flex gap-3 overflow-x-auto pb-1">
        {ordered.map((r, idx) => {
          const date = new Date(r.taken_at);
          const label = date.toLocaleDateString("es-ES", { day: "2-digit", month: "short" });
          return (
            <div
              key={r.id}
              className={`flex-shrink-0 w-24 text-center rounded-xl border ${
                idx === ordered.length - 1 ? "border-primary/40 bg-primary/5" : "border-border bg-background/40"
              } p-2`}
            >
              {r.current_photo_url ? (
                <img
                  src={r.current_photo_url}
                  alt={`Scan ${label}`}
                  className="w-full h-20 object-cover rounded-md mb-1.5"
                />
              ) : (
                <div className="w-full h-20 rounded-md mb-1.5 bg-muted/30" />
              )}
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
              <div className="text-base font-bold font-display text-gradient">
                {Number(r.physique ?? 0).toFixed(1)}
              </div>
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}