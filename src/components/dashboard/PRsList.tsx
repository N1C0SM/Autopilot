import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Trophy, TrendingUp } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { ListGroup, ListRow } from "@/components/ui/list";
import { Skeleton } from "@/components/ui/skeleton";
import { Surface } from "@/components/ui/surface";

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
      <Surface role="status" className="space-y-3" aria-label="Cargando récords personales">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-4 w-56" />
        <Skeleton className="h-4 w-32" />
      </Surface>
    );
  }

  if (prs.length === 0) {
    return (
      <EmptyState
        icon={Trophy}
        title="Sin récords aún"
        description="Registra tus entrenos con peso y rompe tu primer récord personal."
        className="min-h-[55dvh]"
      />
    );
  }

  return (
    <ListGroup header="Tus récords personales">
      {prs.slice(0, 10).map((pr) => (
        <ListRow
          key={pr.id}
          title={pr.exercise_name}
          subtitle={new Date(pr.achieved_at).toLocaleDateString("es-ES", {
            day: "numeric",
            month: "short",
            year: "numeric",
          })}
          trailing={
            <span className="block text-right">
              <span className="block type-body font-rounded font-bold tabular-nums text-primary">
                {pr.weight} kg × {pr.reps}
              </span>
              {pr.estimated_1rm != null && (
                <span className="flex items-center justify-end gap-1 type-footnote tabular-nums text-muted-foreground">
                  <TrendingUp className="h-3.5 w-3.5" aria-hidden="true" />
                  1RM ~{pr.estimated_1rm} kg
                </span>
              )}
            </span>
          }
        />
      ))}
    </ListGroup>
  );
};

export default PRsList;
