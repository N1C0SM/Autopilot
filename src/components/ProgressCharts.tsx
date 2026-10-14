import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { ProgressInlineState } from "@/components/progress/ProgressInlineState";
import { toast } from "sonner";
import { hapticTap } from "@/lib/native";
import { Flag, Scale, TrendingDown, TrendingUp, Minus, WifiOff } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { parseLocalDate, toLocalDateString } from "@/lib/localDates";
import { parsePositiveWeight } from "@/lib/weight";

interface Props {
  userId: string;
  compact?: boolean;
}

const AXIS_TICK = { fontSize: 12, fill: "hsl(var(--muted-foreground))" };
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

  const ready = !loading && !loadError;

  if (compact) {
    return (
      <div>
        <div className="flex items-center gap-4">
          <div className="min-w-0">
            <p className="font-rounded text-[34px] font-bold leading-none tabular-nums">
              {latestWeight ? <>{formatKg(latestWeight.weight)}<span className="ml-1 type-headline text-muted-foreground">kg</span></> : "—"}
            </p>
            <p className="mt-1.5 flex items-center gap-1 type-footnote text-muted-foreground tabular-nums">
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
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      {loading && (
        <div role="status" aria-label="Cargando historial de peso">
          <Skeleton className="h-14 w-40" />
          <Skeleton className="mt-3 h-5 w-56" />
          <Skeleton className="mt-6 h-[200px] rounded-xl" />
        </div>
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
                variant="plain"
                onClick={() => {
                  void hapticTap();
                  setReload((value) => value + 1);
                }}
              >
                Reintentar
              </Button>
            }
          />
        </div>
      )}

      {ready && latestWeight && (
        <section aria-label="Evolución de peso">
          <p className="font-rounded text-[56px] font-bold leading-none tabular-nums">
            {formatKg(latestWeight.weight)}
            <span className="ml-1.5 type-title3 text-muted-foreground">kg</span>
          </p>
          <p className="mt-2 flex flex-wrap items-center gap-x-1.5 type-subhead text-muted-foreground tabular-nums">
            {weightDiff !== null && firstWeight ? (
              <>
                <span className="inline-flex items-center gap-1 font-semibold text-foreground">
                  <TrendIcon className="h-4 w-4" aria-hidden="true" />
                  {formatKgDelta(weightDiff)} kg
                </span>
                <span>desde el {formatWeightDate(firstWeight.logged_at)}</span>
              </>
            ) : (
              <span>Registrado el {formatWeightDate(latestWeight.logged_at)}</span>
            )}
          </p>

          {weightLogs.length >= 2 ? (
            <div className="mt-6 h-[200px]" role="img" aria-label="Gráfica de evolución de peso">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 8, right: 0, left: 0, bottom: 0 }}>
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
                    activeDot={{ r: 5, fill: "hsl(var(--primary))", stroke: "hsl(var(--background))", strokeWidth: 2 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <ProgressInlineState
              icon={Flag}
              title="Punto de partida"
              description="Registra tu peso otro día y aquí verás tu línea de evolución."
              className="mt-6 h-[200px]"
            />
          )}
        </section>
      )}

      {ready && weightLogs.length === 0 && (
        <EmptyState
          icon={Scale}
          title="Sin registros todavía"
          description="Registra tu peso para empezar a ver tu evolución."
          className="py-8"
        />
      )}

      <section aria-labelledby="weight-log-title">
        <h3 id="weight-log-title" className="type-headline">Registra tu peso</h3>
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
      </section>
    </div>
  );
};

export default ProgressCharts;
