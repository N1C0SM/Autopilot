import { motion } from "framer-motion";
import { Home, Dumbbell, Apple, MessageCircle, Sparkles, Lock } from "lucide-react";
import { hapticTap } from "@/lib/native";
import type { UserSection } from "@/components/UserSidebar";

export type MobileTab = UserSection | "progress";

interface Props {
  active: MobileTab;
  onChange: (tab: MobileTab) => void;
  lockedTabs?: MobileTab[];
}

const TABS: { key: MobileTab; label: string; icon: typeof Home }[] = [
  { key: "home", label: "Hoy", icon: Home },
  { key: "training", label: "Plan", icon: Dumbbell },
  { key: "nutrition", label: "Nutrición", icon: Apple },
  { key: "chat", label: "Chat", icon: MessageCircle },
  { key: "progress", label: "Progreso", icon: Sparkles },
];

const MobileTabBar = ({ active, onChange, lockedTabs = [] }: Props) => {
  return (
    <nav
      className="mobile-tabbar fixed z-50 md:hidden"
      style={{
        left: "max(0.75rem, var(--safe-left, 0px))",
        right: "max(0.75rem, var(--safe-right, 0px))",
        bottom: "calc(0.75rem + var(--safe-bottom, 0px))",
      }}
      aria-label="Navegación principal"
    >
      <ul className="mx-auto flex h-[4.25rem] max-w-[30rem] items-center gap-1 rounded-full border border-border/80 bg-background/85 p-1.5 shadow-[0_12px_40px_-12px_hsl(var(--foreground)/0.3)] backdrop-blur-2xl supports-[backdrop-filter]:bg-background/75">
        {TABS.map((t) => {
          const isActive = active === t.key;
          const isLocked = lockedTabs.includes(t.key);
          return (
            <li key={t.key} className="min-w-0 flex-1">
              <button
                type="button"
                onClick={() => {
                  hapticTap();
                  onChange(t.key);
                }}
                className={`relative flex h-full w-full flex-col items-center justify-center gap-1 rounded-full transition-transform active:scale-95 ${
                  isActive ? "text-primary" : "text-muted-foreground"
                }`}
                aria-current={isActive ? "page" : undefined}
                aria-label={t.label}
              >
                {isActive && (
                  <motion.span
                    layoutId="mobile-tab-indicator"
                    className="absolute inset-0 rounded-full border border-primary/30 bg-primary/[0.12] shadow-[0_0_22px_-8px_hsl(var(--primary)/0.65)]"
                    transition={{ type: "spring", stiffness: 420, damping: 34 }}
                  />
                )}
                <span className="relative z-10">
                  <t.icon
                    className={`h-[21px] w-[21px] transition-transform duration-200 ${
                      isActive ? "scale-110 text-primary" : "text-current"
                    }`}
                  />
                  {isLocked && (
                    <Lock className="absolute -bottom-1 -right-1 w-3 h-3 text-muted-foreground bg-card rounded-full p-[1px]" />
                  )}
                </span>
                <span
                  className={`relative z-10 truncate px-0.5 text-[10px] leading-none transition-colors ${
                    isActive ? "font-semibold text-primary" : "font-medium text-current"
                  }`}
                >
                  {t.label}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
};

export default MobileTabBar;