import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Surface } from "@/components/ui/surface";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { hapticTap } from "@/lib/native";
import { Scale, TrendingDown, TrendingUp, Minus, RefreshCw, WifiOff } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { parseLocalDate, toLocalDateString } from "@/lib/localDates";
import { parsePositiveWeight } from "@/lib/weight";

interface Props {
  userId: string;
  compact?: boolean;
}

const AXIS_TICK = { fontSize: 11, fill: "hsl(var(--muted-foreground))" };
const TOOLTIP_STYLE = {
  background: "hsl(var(--accent) / 0.92)",
  backdropFilter: "blur(20px)",
  border: "none",
  borderRadius: 12,
  boxShadow: "0 8px 24px rgba(0,0,0,0.45)",
  padding: "8px 12px",
  fontSize: 13,
};

const ProgressCharts = ({ userId, compact = false }: Props) => {
  const [weightLogs, setWeightLogs] = useState<{ logged_at: string; weight: number }[]>([]);
  const [newWeight, setNewWeight] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let active = true;
    const fetchData = async () => {
      setLoading(true);
      setLoadError(false);
      try {
        const { data: weights, error } = await supabase
          .from("weight_logs")
          .select("logged_at, weight")
          .eq("user_id", userId)
          .order("logged_at", { ascending: false })
          .limit(90);
        if (error) throw error;
        if (!active) return;
        setWeightLogs(
          (weights || [])
            .map((weight) => ({ ...weight, weight: Number(weight.weight) }))
            .sort((a, b) => a.logged_at.localeCompare(b.logged_at)),
        );
      } catch (error) {
        console.error("Failed to load weight history", error);
        if (active) {
          setLoadError(true);
          toast.error("No se pudo cargar tu historial de peso.");
        }
      } finally {
        if (active) setLoading(false);
      }
    };
    void fetchData();
    return () => {
      active = false;
    };
  }, [userId, reload]);

  const logWeight = async () => {
    const w = parsePositiveWeight(newWeight);
    if (w === null || w < 20 || w > 300) {
      toast.error("Introduce un peso válido");
      return;
    }
    setSaving(true);
    try {
      const today = toLocalDateString();
      const { error } = await supabase.from("weight_logs").upsert({
        user_id: userId,
        weight: w,
        logged_at: today,
      });
      if (error) throw error;
      toast.success("Peso registrado");
      setWeightLogs((prev) => {
        const filtered = prev.filter((l) => l.logged_at !== today);
        return [...filtered, { logged_at: today, weight: w }].sort((a, b) => a.logged_at.localeCompare(b.logged_at));
      });
      setNewWeight("");
    } catch (error) {
      console.error("Failed to save weight", error);
      toast.error("Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveClick = () => {
    void hapticTap();
    void logWeight();
  };

  const firstWeight = weightLogs[0];
  const latestWeight = weightLogs[weightLogs.length - 1];
  const weightDiff = weightLogs.length >= 2 ? latestWeight.weight - firstWeight.weight : null;
  const formatWeightDate = (date: string) => parseLocalDate(date).toLocaleDateString("es-ES", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  const formatKg = (kg: number) => kg.toLocaleString("es-ES", { maximumFractionDigits: 1 });
  const formatKgDelta = (kg: number) =>
    `${kg > 0 ? "+" : ""}${kg.toLocaleString("es-ES", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}`;
  const TrendIcon = weightDiff === null || weightDiff === 0 ? Minus : weightDiff < 0 ? TrendingDown : TrendingUp;

  const chartData = weightLogs.map((w) => ({
    date: parseLocalDate(w.logged_at).toLocaleDateString("es-ES", { day: "2-digit", month: "short" }),
    peso: w.weight,
  }));

  if (compact) {
    return (
      <Surface>
        <div className="flex items-center gap-4">
          <div className="min-w-0">
            <p className="font-rounded text-[28px] font-bold leading-8 tabular-nums">
              {latestWeight ? <>{formatKg(latestWeight.weight)}<span className="ml-1 type-callout font-semibold text-muted-foreground">kg</span></> : "—"}
            </p>
            <p className="mt-0.5 flex items-center gap-1 type-footnote text-muted-foreground tabular-nums">
              {weightDiff === null ? "Peso actual" : <><TrendIcon className="h-3.5 w-3.5" aria-hidden="true" />{formatKgDelta(weightDiff)} kg desde el inicio</>}
            </p>
          </div>
          {chartData.length >= 2 && (
            <div className="h-11 min-w-0 flex-1" aria-hidden>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <YAxis hide domain={["dataMin - 0.5", "dataMax + 0.5"]} />
                  <Line type="monotone" dataKey="peso" stroke="hsl(var(--primary))" strokeWidth={2.5} dot={false} isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
        <div className="mt-3 flex gap-2">
          <Input
            aria-label="Peso en kilogramos"
            disabled={saving || loading}
            type="text"
            inputMode="decimal"
            enterKeyHint="done"
            value={newWeight}
            onChange={(e) => setNewWeight(e.target.value)}
            placeholder="kg"
            className="min-w-0 flex-1"
            onKeyDown={(e) => e.key === "Enter" && logWeight()}
          />
          <Button variant="tinted" className="shrink-0" onClick={handleSaveClick} disabled={saving || loading}>
            {saving ? "Guardando…" : "Guardar"}
          </Button>
        </div>
      </Surface>
    );
  }

  return (
    <div className="space-y-6">
      {/* Weight log input */}
      <Surface>
        <h3 className="type-headline">Registra tu peso</h3>
        <div className="mt-3 flex gap-2">
          <Input
            aria-label="Peso en kilogramos"
            disabled={saving || loading}
            type="text"
            inputMode="decimal"
            enterKeyHint="done"
            value={newWeight}
            onChange={(e) => setNewWeight(e.target.value)}
            placeholder="Ej: 72,5"
            className="min-w-0 flex-1"
            onKeyDown={(e) => e.key === "Enter" && logWeight()}
          />
          <Button className="shrink-0" onClick={handleSaveClick} disabled={saving || loading}>
            {saving ? "Guardando…" : "Registrar"}
          </Button>
        </div>
      </Surface>

      {loading && (
        <Skeleton className="h-64 rounded-2xl" role="status" aria-label="Cargando historial de peso" />
      )}

      {loadError && (
        <div role="alert">
          <EmptyState
            icon={WifiOff}
            title="No se ha podido cargar tu historial de peso"
            description="Tus registros no se han modificado."
            className="py-8"
            action={
              <Button
                type="button"
                variant="tinted"
                size="sm"
                onClick={() => {
                  void hapticTap();
                  setReload((value) => value + 1);
                }}
              >
                <RefreshCw aria-hidden="true" /> Reintentar
              </Button>
            }
          />
        </div>
      )}

      {/* Weight chart */}
      {!loading && !loadError && weightLogs.length >= 2 && (
        <Surface>
          <h3 className="type-subhead font-semibold text-primary">Evolución de peso</h3>
          <p className="mt-1 font-rounded text-[34px] font-bold leading-10 tabular-nums">
            {formatKg(latestWeight.weight)}
            <span className="ml-1 type-body font-semibold text-muted-foreground">kg</span>
          </p>
          {weightDiff !== null && firstWeight && (
            <p className="flex flex-wrap items-center gap-x-2 type-footnote text-muted-foreground tabular-nums">
              <span className="inline-flex items-center gap-1">
                <TrendIcon className="h-3.5 w-3.5" aria-hidden="true" />
                {formatKgDelta(weightDiff)} kg
              </span>
              <span>{formatWeightDate(firstWeight.logged_at)} — {formatWeightDate(latestWeight.logged_at)}</span>
            </p>
          )}
          <div className="mt-4">
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={chartData} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeWidth={0.5} />
                <XAxis dataKey="date" axisLine={false} tickLine={false} minTickGap={24} tick={AXIS_TICK} />
                <YAxis
                  orientation="right"
                  width={40}
                  axisLine={false}
                  tickLine={false}
                  tickCount={4}
                  domain={["dataMin - 1", "dataMax + 1"]}
                  tickFormatter={(value: number) => formatKg(value)}
                  tick={AXIS_TICK}
                />
                <Tooltip
                  cursor={{ stroke: "hsl(var(--muted-foreground))", strokeOpacity: 0.4 }}
                  contentStyle={TOOLTIP_STYLE}
                  labelStyle={{ color: "hsl(var(--muted-foreground))", marginBottom: 2 }}
                  itemStyle={{ color: "hsl(var(--foreground))", padding: 0, fontWeight: 600 }}
                  formatter={(value: number) => [`${formatKg(value)} kg`, "Peso"]}
                />
                <Line
                  type="monotone"
                  dataKey="peso"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2.5}
                  dot={false}
                  activeDot={{ r: 5, fill: "hsl(var(--primary))", stroke: "hsl(var(--card))", strokeWidth: 2 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Surface>
      )}

      {/* Weight log placeholder */}
      {!loading && !loadError && weightLogs.length === 1 && (
        <EmptyState
          icon={TrendingUp}
          title="Aún no hay gráfica"
          description="Registra tu peso al menos 2 días para ver el gráfico de evolución."
          className="py-8"
        />
      )}

      {!loading && !loadError && weightLogs.length === 0 && (
        <EmptyState
          icon={Scale}
          title="Sin registros todavía"
          description="Registra tu peso para empezar a ver tu evolución."
          className="py-8"
        />
      )}
    </div>
  );
};

export default ProgressCharts;
