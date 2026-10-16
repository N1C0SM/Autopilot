import { useEffect, useState } from "react";
import { History, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { signedUrlsFor } from "@/lib/storageSign";
import { FindingRow, ScanImage, StatRow } from "@/components/scan/ScanResultParts";

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
      const { data } = await supabase
        .from("scan_history")
        .select("id, taken_at, physique, attractiveness, potential, current_photo_url")
        .eq("user_id", userId)
        .order("taken_at", { ascending: true });
      if (!active) return;
      const list = (data as Row[]) || [];
      // progress-photos es privado: firmamos las rutas (y las URLs antiguas de ese bucket).
      const needsSign = (v: string | null) => !!v && (!/^https?:/i.test(v) || v.includes("/progress-photos/"));
      const values = list.map((r) => r.current_photo_url).filter((v): v is string => needsSign(v));
      const map = values.length ? await signedUrlsFor("progress-photos", values) : new Map<string, string>();
      if (!active) return;
      setRows(list.map((r) => (needsSign(r.current_photo_url) ? { ...r, current_photo_url: map.get(r.current_photo_url as string) ?? null } : r)));
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [userId]);

  if (loading || rows.length === 0) return null;

  if (rows.length === 1) {
    return (
      <FindingRow
        icon={History}
        title="Tu primer scan está guardado"
        description="Repite el análisis cada 2–4 semanas para ver tu evolución aquí."
      />
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
    <section>
      <div className="flex items-end justify-between gap-3">
        <div>
          <h2 className="type-title2">Tu progreso</h2>
          <p className="type-subhead text-muted-foreground tabular-nums">{rows.length} scans</p>
        </div>
        <div className={`flex items-center gap-1.5 font-rounded font-bold tabular-nums type-title3 ${trendColor}`}>
          <TrendIcon className="w-5 h-5" aria-hidden="true" />
          {delta > 0 ? "+" : ""}
          {delta.toFixed(1)} <span className="type-subhead font-normal text-muted-foreground">físico</span>
        </div>
      </div>

      {!compact && (
        <>
          <div className="h-48 mt-5 mb-6">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 5, right: 8, left: -20, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeWidth={0.5} />
                <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis domain={[0, 10]} stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{
                    background: "hsl(var(--card))",
                    border: "none",
                    borderRadius: 12,
                    fontSize: 13,
                  }}
                />
                <Line type="monotone" dataKey="Físico" stroke="hsl(var(--primary))" strokeWidth={2.5} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="Atractivo" stroke="hsl(var(--success))" strokeWidth={2} dot={{ r: 2 }} />
                <Line type="monotone" dataKey="Potencial" stroke="hsl(var(--muted-foreground))" strokeWidth={2} dot={{ r: 2 }} strokeDasharray="4 4" />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <StatRow
            className="mb-6"
            stats={[
              { label: "Mejor físico", value: bestPhysique.toFixed(1) },
              { label: "Desde el inicio", value: daysSinceFirst, unit: "d" },
              { label: "Racha al alza", value: maxStreak },
            ]}
          />
        </>
      )}

      <div className="flex gap-3 overflow-x-auto p-0.5 -mx-0.5 mt-5">
        {rows.slice(-8).map((r, idx, arr) => {
          const date = new Date(r.taken_at);
          const label = date.toLocaleDateString("es-ES", { day: "2-digit", month: "short" });
          const isLast = idx === arr.length - 1;
          return (
            <div key={r.id} className="flex-shrink-0 w-24 text-center">
              <ScanImage
                src={r.current_photo_url}
                alt={`Scan ${label}`}
                className={`w-full h-28 rounded-xl mb-2 ${isLast ? "ring-2 ring-primary" : ""}`}
              />
              <div className="type-footnote text-muted-foreground">{label}</div>
              <div className="font-rounded font-bold tabular-nums type-headline">
                {Number(r.physique ?? 0).toFixed(1)}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
