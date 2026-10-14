import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Trophy } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { ListGroup, ListRow } from "@/components/ui/list";
import { Skeleton } from "@/components/ui/skeleton";

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

  const formatDate = (date: string) =>
    new Date(date).toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" });

  if (loading) {
    return (
      <div role="status" aria-label="Cargando récords personales" className="space-y-8">
        <div>
          <Skeleton className="h-7 w-7 rounded-lg" />
          <Skeleton className="mt-4 h-14 w-36" />
          <Skeleton className="mt-3 h-5 w-52" />
        </div>
        <div className="overflow-hidden rounded-2xl bg-card">
          {[0, 1, 2].map((row) => (
            <div key={row} className="flex min-h-[60px] items-center justify-between gap-4 px-4 [&:not(:last-child)]:sep-b">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-4 w-16" />
            </div>
          ))}
        </div>
      </div>
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

  const top = prs[0];
  const topHasEstimate = top.estimated_1rm != null;

  return (
    <div className="space-y-8">
      <section aria-label="Tu mejor marca" className="pt-1">
        <Trophy className="h-7 w-7 text-primary" strokeWidth={1.75} aria-hidden="true" />
        <p className="mt-3 font-rounded text-[56px] font-bold leading-none tabular-nums">
          {topHasEstimate ? top.estimated_1rm : top.weight}
          <span className="ml-1.5 type-title3 text-muted-foreground">kg</span>
        </p>
        <p className="mt-2 type-body text-muted-foreground">
          {topHasEstimate
            ? `1RM estimado en ${top.exercise_name}`
            : `Tu mejor serie en ${top.exercise_name}, ${top.reps} reps`}
        </p>
      </section>

      <ListGroup header="Tus récords personales">
        {prs.slice(0, 10).map((pr) => (
          <ListRow
            key={pr.id}
            title={pr.exercise_name}
            subtitle={formatDate(pr.achieved_at)}
            trailing={
              <span className="block text-right">
                <span className="block type-body font-rounded font-semibold tabular-nums">
                  {pr.weight} kg × {pr.reps}
                </span>
                {pr.estimated_1rm != null && (
                  <span className="mt-0.5 block type-footnote tabular-nums text-muted-foreground">
                    1RM ~{pr.estimated_1rm} kg
                  </span>
                )}
              </span>
            }
          />
        ))}
      </ListGroup>
    </div>
  );
};

export default PRsList;
