import { motion } from "framer-motion";
import type { Profile } from "@/pages/Admin";

interface Props {
  users: Profile[];
}

const COACH_TIERS = ["full", "transform", "personal", "coach"];

const AdminStats = ({ users }: Props) => {
  const paid = users.filter((u) => u.payment_status === "paid");
  const plus = paid.filter((u) => u.subscription_tier === "training").length;
  const coach = paid.filter((u) => COACH_TIERS.includes(u.subscription_tier || "")).length;
  const mrr = plus * 29 + coach * 49;

  const stats = [
    { label: "Ingresos / mes", value: mrr.toLocaleString("es-ES") + " €" },
    { label: "Usuarios", value: users.length },
    { label: "Plus", value: plus },
    { label: "Coach", value: coach },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
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
  );
};

export default AdminStats;
