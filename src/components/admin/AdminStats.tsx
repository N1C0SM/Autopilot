import type { Profile } from "@/pages/Admin";
import { MONTHLY_ESTIMATE_NOTE, summarizeClientPlans } from "@/lib/adminMetrics";

interface Props {
  users: Profile[];
}

const AdminStats = ({ users }: Props) => {
  const { total, counts, estimatedMonthly } = summarizeClientPlans(users);

  const stats = [
    { label: "Estimación mensual", value: estimatedMonthly.toLocaleString("es-ES") + " €" },
    { label: "Clientes", value: total },
    { label: "Plus", value: counts.plus },
    { label: "Coach", value: counts.coach },
  ];

  return (
    <div className="space-y-3 mb-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {stats.map((s) => (
          <div key={s.label} className="rounded-2xl bg-card p-4 sm:p-5">
            <div className="type-footnote text-muted-foreground">{s.label}</div>
            <div className="mt-2 font-rounded text-3xl font-bold tabular-nums">{s.value}</div>
          </div>
        ))}
      </div>
      <p className="type-footnote text-muted-foreground">{MONTHLY_ESTIMATE_NOTE}</p>
    </div>
  );
};

export default AdminStats;
