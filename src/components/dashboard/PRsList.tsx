import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Trophy, TrendingUp } from "lucide-react";
import { motion } from "framer-motion";

interface PR {
  id: string;
  exercise_name: string;
  weight: number;
  reps: number;
  estimated_1rm: number | null;
  achieved_at: string;
}

interface Props {
  userId: string;
}

const PRsList = ({ userId }: Props) => {
  const [prs, setPrs] = useState<PR[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from("personal_records")
        .select("*")
        .eq("user_id", userId)
        .order("estimated_1rm", { ascending: false, nullsFirst: false })
        .limit(50);

      if (data) {
        // Group by exercise, keep best 1RM
        const best: Record<string, PR> = {};
        for (const pr of data as PR[]) {
          const key = pr.exercise_name;
          if (!best[key] || (pr.estimated_1rm ?? 0) > (best[key].estimated_1rm ?? 0)) {
            best[key] = pr;
          }
        }
        setPrs(Object.values(best).sort((a, b) => (b.estimated_1rm ?? 0) - (a.estimated_1rm ?? 0)));
      }
      setLoading(false);
    };
    load();
  }, [userId]);

  if (loading) {
    return (
      <div className="bg-card rounded-2xl p-6 border border-border">
        <div className="h-4 w-32 bg-secondary rounded animate-pulse" />
      </div>
    );
  }

  if (prs.length === 0) {
    return (
      <div className="flex min-h-[55dvh] flex-col items-center justify-center rounded-[1.75rem] border border-border bg-card p-10 text-center">
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
          <Trophy className="h-7 w-7 text-primary" />
        </div>
        <h3 className="font-display font-bold text-lg mb-1">Sin récords aún</h3>
        <p className="text-sm text-muted-foreground">
          Registra tus entrenos con peso y rompe tu primer récord personal.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-card rounded-2xl p-6 border border-border">
      <div className="flex items-center gap-2 mb-4">
        <Trophy className="w-5 h-5 text-primary" />
        <h3 className="font-display font-bold text-base">Tus récords personales</h3>
      </div>
      <div className="space-y-2">
        {prs.slice(0, 10).map((pr, i) => (
          <motion.div
            key={pr.id}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.04 }}
            className="flex items-center justify-between p-3 rounded-lg bg-secondary/30 hover:bg-secondary/50 transition-colors"
          >
            <div className="min-w-0 flex-1">
              <div className="font-medium text-sm truncate">{pr.exercise_name}</div>
              <div className="text-[11px] text-muted-foreground">
                {new Date(pr.achieved_at).toLocaleDateString("es-ES", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}
              </div>
            </div>
            <div className="text-right shrink-0 ml-3">
              <div className="font-bold font-display text-primary">
                {pr.weight}kg × {pr.reps}
              </div>
              {pr.estimated_1rm != null && (
                <div className="text-[11px] text-muted-foreground flex items-center gap-1 justify-end">
                  <TrendingUp className="w-3 h-3" />
                  1RM ~{pr.estimated_1rm}kg
                </div>
              )}
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
};

export default PRsList;
