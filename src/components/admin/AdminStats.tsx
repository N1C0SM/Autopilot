import { motion } from "framer-motion";
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
      {stats.map((s, i) => (
        <motion.div
          key={s.label}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.03 }}
          className="rounded-2xl bg-card border border-border/60 p-4 sm:p-5"
        >
          <div className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">{s.label}</div>
          <div className="mt-2 font-display text-2xl font-bold tabular-nums sm:text-3xl">{s.value}</div>
        </motion.div>
      ))}
    </div>
    <p className="text-xs leading-relaxed text-muted-foreground">{MONTHLY_ESTIMATE_NOTE}</p>
    </div>
  );
};

export default AdminStats;
