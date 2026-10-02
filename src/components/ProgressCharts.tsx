import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Scale, TrendingDown, TrendingUp, Minus } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { parseLocalDate, toLocalDateString } from "@/lib/localDates";

interface Props {
  userId: string;
}

const ProgressCharts = ({ userId }: Props) => {
  const [weightLogs, setWeightLogs] = useState<{ logged_at: string; weight: number }[]>([]);
  const [newWeight, setNewWeight] = useState("");
  const [saving, setSaving] = useState(false);
  const [weeklyStats, setWeeklyStats] = useState<{ completed: number; total: number }[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      const [{ data: weights }, { data: completions }] = await Promise.all([
        supabase
          .from("weight_logs")
          .select("logged_at, weight")
          .eq("user_id", userId)
          .order("logged_at", { ascending: false })
          .limit(90),
        supabase
          .from("day_completions")
          .select("completed_at")
          .eq("user_id", userId)
          .order("completed_at", { ascending: true })
          .limit(200),
      ]);

      if (weights) {
        setWeightLogs(
          weights
            .map((weight) => ({ ...weight, weight: Number(weight.weight) }))
            .sort((a, b) => a.logged_at.localeCompare(b.logged_at)),
        );
      }

      // Group completions by week
      if (completions && completions.length > 0) {
        const weeks: Record<string, number> = {};
        completions.forEach((c: any) => {
          const d = parseLocalDate(c.completed_at);
          const weekStart = new Date(d);
          weekStart.setDate(d.getDate() - ((d.getDay() + 6) % 7));
          const key = toLocalDateString(weekStart);
          weeks[key] = (weeks[key] || 0) + 1;
        });
        setWeeklyStats(
          Object.entries(weeks)
            .slice(-8)
            .map(([week, completed]) => ({ completed, total: 7 }))
        );
      }
    };
    fetchData();
  }, [userId]);

  const logWeight = async () => {
    const w = parseFloat(newWeight);
    if (!w || w < 20 || w > 300) {
      toast.error("Introduce un peso válido");
      return;
    }
    setSaving(true);
    const today = toLocalDateString();
    const { error } = await supabase.from("weight_logs").upsert({
      user_id: userId,
      weight: w,
      logged_at: today,
    });

    if (!error) {
      toast.success("Peso registrado ✅");
      setWeightLogs((prev) => {
        const filtered = prev.filter((l) => l.logged_at !== today);
        return [...filtered, { logged_at: today, weight: w }].sort((a, b) => a.logged_at.localeCompare(b.logged_at));
      });
      setNewWeight("");
    } else {
      toast.error("Error al guardar");
    }
    setSaving(false);
  };

  const weightDiff = weightLogs.length >= 2
    ? weightLogs[weightLogs.length - 1].weight - weightLogs[0].weight
    : null;

  const chartData = weightLogs.map((w) => ({
    date: parseLocalDate(w.logged_at).toLocaleDateString("es-ES", { day: "2-digit", month: "short" }),
    peso: w.weight,
  }));

  return (
    <div className="space-y-6">
      {/* Weight log input */}
      <div className="bg-card rounded-2xl p-4 sm:p-6 border border-border card-shadow">
        <div className="flex items-center gap-2 mb-4">
          <Scale className="w-5 h-5 text-primary" />
          <h3 className="font-bold font-display">Registra tu peso</h3>
        </div>
        <div className="flex gap-3">
          <div className="flex-1">
            <Input
              type="number"
              step="0.1"
              value={newWeight}
              onChange={(e) => setNewWeight(e.target.value)}
              placeholder="Ej: 72.5"
              onKeyDown={(e) => e.key === "Enter" && logWeight()}
            />
          </div>
          <Button onClick={logWeight} disabled={saving}>
            {saving ? "Guardando..." : "Registrar"}
          </Button>
        </div>
      </div>

      {/* Weight chart */}
      {weightLogs.length >= 2 && (
        <div className="bg-card rounded-2xl p-4 sm:p-6 border border-border card-shadow">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold font-display">Evolución de peso</h3>
            {weightDiff !== null && (
              <div className={`flex items-center gap-1 text-sm font-medium ${
                weightDiff < 0 ? "text-primary" : weightDiff > 0 ? "text-destructive" : "text-muted-foreground"
              }`}>
                {weightDiff < 0 ? <TrendingDown className="w-4 h-4" /> : weightDiff > 0 ? <TrendingUp className="w-4 h-4" /> : <Minus className="w-4 h-4" />}
                {weightDiff > 0 ? "+" : ""}{weightDiff.toFixed(1)}kg
              </div>
            )}
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
              <YAxis domain={["dataMin - 1", "dataMax + 1"]} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
              <Tooltip
                contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }}
                labelStyle={{ color: "hsl(var(--foreground))" }}
              />
              <Line type="monotone" dataKey="peso" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ fill: "hsl(var(--primary))", r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Weight log placeholder */}
      {weightLogs.length < 2 && weightLogs.length > 0 && (
        <div className="bg-card rounded-xl p-5 border border-border text-center text-sm text-muted-foreground">
          Registra tu peso al menos 2 días para ver el gráfico de evolución 📈
        </div>
      )}
    </div>
  );
};

export default ProgressCharts;
