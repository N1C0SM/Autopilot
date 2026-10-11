import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { motion, AnimatePresence } from "framer-motion";
import { Flame, Trophy, Target, Zap, Award, Star } from "lucide-react";

interface Achievement {
  id: string;
  icon: React.ElementType;
  title: string;
  description: string;
  unlocked: boolean;
  progress?: number;
  target?: number;
}

interface Props {
  userId: string;
}

const Achievements = ({ userId }: Props) => {
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [showUnlock, setShowUnlock] = useState<string | null>(null);

  useEffect(() => {
    const fetchStats = async () => {
      const [{ count: totalCompletions }, { count: weightLogs }, { data: completions }] = await Promise.all([
        supabase.from("day_completions").select("*", { count: "exact", head: true }).eq("user_id", userId),
        supabase.from("weight_logs").select("*", { count: "exact", head: true }).eq("user_id", userId),
        supabase.from("day_completions").select("completed_at").eq("user_id", userId).order("completed_at", { ascending: false }).limit(60),
      ]);

      const total = totalCompletions || 0;
      const logs = weightLogs || 0;

      // Calculate max streak
      let maxStreak = 0;
      if (completions && completions.length > 0) {
        const uniqueDates = [...new Set(completions.map((c) => c.completed_at))].sort().reverse();
        let currentStreak = 1;
        for (let i = 1; i < uniqueDates.length; i++) {
          const prev = new Date(uniqueDates[i - 1]);
          const curr = new Date(uniqueDates[i]);
          const diffDays = (prev.getTime() - curr.getTime()) / (1000 * 60 * 60 * 24);
          if (diffDays <= 1.5) {
            currentStreak++;
            maxStreak = Math.max(maxStreak, currentStreak);
          } else {
            currentStreak = 1;
          }
        }
        maxStreak = Math.max(maxStreak, currentStreak);
      }

      const list: Achievement[] = [
        {
          id: "first_day",
          icon: Zap,
          title: "Primer Paso",
          description: "Completa tu primer día",
          unlocked: total >= 1,
          progress: Math.min(total, 1),
          target: 1,
        },
        {
          id: "week_warrior",
          icon: Target,
          title: "Guerrero Semanal",
          description: "Completa 7 días de entrenamiento",
          unlocked: total >= 7,
          progress: Math.min(total, 7),
          target: 7,
        },
        {
          id: "month_master",
          icon: Trophy,
          title: "Maestro del Mes",
          description: "Completa 30 días de entrenamiento",
          unlocked: total >= 30,
          progress: Math.min(total, 30),
          target: 30,
        },
        {
          id: "streak_5",
          icon: Flame,
          title: "En Racha",
          description: "Alcanza una racha de 5 días",
          unlocked: maxStreak >= 5,
          progress: Math.min(maxStreak, 5),
          target: 5,
        },
        {
          id: "streak_14",
          icon: Star,
          title: "Imparable",
          description: "Alcanza una racha de 14 días",
          unlocked: maxStreak >= 14,
          progress: Math.min(maxStreak, 14),
          target: 14,
        },
        {
          id: "tracker",
          icon: Award,
          title: "Control Total",
          description: "Registra tu peso 10 veces",
          unlocked: logs >= 10,
          progress: Math.min(logs, 10),
          target: 10,
        },
      ];

      setAchievements(list);
    };

    fetchStats();
  }, [userId]);

  if (achievements.length === 0) return null;

  const unlocked = achievements.filter((a) => a.unlocked).length;

  return (
    <div className="bg-card rounded-2xl p-6 border border-border card-shadow">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <Award className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-bold font-display">Logros</h2>
        </div>
        <span className="text-sm text-muted-foreground">
          {unlocked}/{achievements.length} desbloqueados
        </span>
      </div>

      <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
        {achievements.map((a) => (
          <motion.div
            key={a.id}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className={`relative flex flex-col items-center gap-1.5 p-3 rounded-xl border transition-all duration-300 ${
              a.unlocked
                ? "border-primary/40 bg-primary/5"
                : "border-border bg-secondary/20 opacity-50"
            }`}
          >
            <div
              className={`w-10 h-10 rounded-full flex items-center justify-center ${
                a.unlocked ? "bg-primary/20" : "bg-secondary"
              }`}
            >
              <a.icon
                className={`w-5 h-5 ${a.unlocked ? "text-primary" : "text-muted-foreground"}`}
              />
            </div>
            <span className="text-[10px] font-semibold text-center leading-tight">
              {a.title}
            </span>
            {!a.unlocked && a.progress !== undefined && a.target !== undefined && (
              <div className="w-full h-1 bg-secondary rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary/50 rounded-full transition-all"
                  style={{ width: `${(a.progress / a.target) * 100}%` }}
                />
              </div>
            )}
          </motion.div>
        ))}
      </div>
    </div>
  );
};

export default Achievements;
