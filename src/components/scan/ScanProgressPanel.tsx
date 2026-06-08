import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { History, TrendingUp, TrendingDown, Minus, Trophy, CalendarDays, Flame } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { supabase } from "@/integrations/supabase/client";

type Row = {
  id: string;
  taken_at: string;
  physique: number | null;
  attractiveness: number | null;
  potential: number | null;
  current_photo_url: string | null;
};

export default function ScanProgressPanel({ userId, compact = false }: { userId: string; compact?: boolean }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data } = await (supabase as any)
        .from("scan_history")
        .select("id, taken_at, physique, attractiveness, potential, current_photo_url")
        .eq("user_id", userId)
        .order("taken_at", { ascending: true });
      if (!active) return;
      setRows((data as Row[]) || []);
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [userId]);

  if (loading || rows.length === 0) return null;

  if (rows.length === 1) {
    return (
      <motion.div
        initial={{ opacity: 0, y: -6 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-4xl mx-auto mb-8 rounded-2xl border border-border bg-card/50 backdrop-blur p-5 text-center"
      >
        <History className="w-5 h-5 text-primary mx-auto mb-2" />
        <div className="text-sm font-medium">Tu primer scan está guardado</div>
        <div className="text-xs text-muted-foreground mt-1">
          Repite el análisis cada 2–4 semanas para ver tu evolución aquí.
        </div>
      </motion.div>
    );
  }

  const first = Number(rows[0].physique ?? 0);
  const last = Number(rows[rows.length - 1].physique ?? 0);
  const delta = last - first;
  const TrendIcon = delta > 0.1 ? TrendingUp : delta < -0.1 ? TrendingDown : Minus;
  const trendColor = delta > 0.1 ? "text-success" : delta < -0.1 ? "text-destructive" : "text-muted-foreground";

  const chartData = rows.map((r) => ({
    date: new Date(r.taken_at).toLocaleDateString("es-ES", { day: "2-digit", month: "short" }),
    Físico: Number(r.physique ?? 0),
    Atractivo: Number(r.attractiveness ?? 0),
    Potencial: Number(r.potential ?? 0),
  }));

  const bestPhysique = Math.max(...rows.map((r) => Number(r.physique ?? 0)));
  const daysSinceFirst = Math.max(
    1,
    Math.round((Date.now() - new Date(rows[0].taken_at).getTime()) / 86400000),
  );
  let streak = 1;
  let maxStreak = 1;
  for (let i = 1; i < rows.length; i++) {
    if (Number(rows[i].physique ?? 0) >= Number(rows[i - 1].physique ?? 0)) {
      streak++;
      maxStreak = Math.max(maxStreak, streak);
    } else streak = 1;
  }

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
            Tu progreso · {rows.length} scans
          </span>
        </div>
        <div className={`flex items-center gap-1.5 text-sm font-medium ${trendColor}`}>
          <TrendIcon className="w-4 h-4" />
          {delta > 0 ? "+" : ""}
          {delta.toFixed(1)} físico
        </div>
      </div>

      {!compact && (
        <>
          <div className="h-48 mb-5">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 5, right: 8, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <YAxis domain={[0, 10]} stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <Tooltip
                  contentStyle={{
                    background: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
                <Line type="monotone" dataKey="Físico" stroke="hsl(var(--primary))" strokeWidth={2.5} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="Atractivo" stroke="hsl(var(--success))" strokeWidth={2} dot={{ r: 2 }} />
                <Line type="monotone" dataKey="Potencial" stroke="hsl(var(--muted-foreground))" strokeWidth={2} dot={{ r: 2 }} strokeDasharray="4 4" />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="grid grid-cols-3 gap-3 mb-5">
            <div className="rounded-xl border border-border bg-background/40 p-3 text-center">
              <Trophy className="w-4 h-4 text-primary mx-auto mb-1" />
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Mejor físico</div>
              <div className="text-lg font-bold font-display text-gradient">{bestPhysique.toFixed(1)}</div>
            </div>
            <div className="rounded-xl border border-border bg-background/40 p-3 text-center">
              <CalendarDays className="w-4 h-4 text-primary mx-auto mb-1" />
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Desde el inicio</div>
              <div className="text-lg font-bold font-display text-gradient">{daysSinceFirst}d</div>
            </div>
            <div className="rounded-xl border border-border bg-background/40 p-3 text-center">
              <Flame className="w-4 h-4 text-primary mx-auto mb-1" />
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Racha al alza</div>
              <div className="text-lg font-bold font-display text-gradient">{maxStreak}</div>
            </div>
          </div>
        </>
      )}

      <div className="flex gap-3 overflow-x-auto pb-1">
        {rows.slice(-8).map((r, idx, arr) => {
          const date = new Date(r.taken_at);
          const label = date.toLocaleDateString("es-ES", { day: "2-digit", month: "short" });
          return (
            <div
              key={r.id}
              className={`flex-shrink-0 w-24 text-center rounded-xl border ${
                idx === arr.length - 1 ? "border-primary/40 bg-primary/5" : "border-border bg-background/40"
              } p-2`}
            >
              {r.current_photo_url ? (
                <img src={r.current_photo_url} alt={`Scan ${label}`} className="w-full h-20 object-cover rounded-md mb-1.5" />
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