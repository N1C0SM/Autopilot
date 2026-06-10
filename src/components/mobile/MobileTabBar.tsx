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
      className="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-card/95 backdrop-blur-xl border-t border-border"
      style={{ paddingBottom: "var(--safe-bottom, 0px)" }}
    >
      <ul className="flex items-stretch justify-around h-16 px-1">
        {TABS.map((t) => {
          const isActive = active === t.key;
          const isLocked = lockedTabs.includes(t.key);
          return (
            <li key={t.key} className="flex-1">
              <button
                type="button"
                onClick={() => {
                  hapticTap();
                  onChange(t.key);
                }}
                className="relative w-full h-full flex flex-col items-center justify-center gap-0.5 active:scale-95 transition-transform"
                aria-current={isActive ? "page" : undefined}
                aria-label={t.label}
              >
                {isActive && (
                  <motion.span
                    layoutId="mobile-tab-indicator"
                    className="absolute top-0 w-10 h-0.5 bg-primary rounded-full"
                    transition={{ type: "spring", stiffness: 500, damping: 32 }}
                  />
                )}
                <span className="relative">
                  <t.icon
                    className={`w-[22px] h-[22px] transition-colors ${
                      isActive ? "text-primary" : "text-muted-foreground"
                    }`}
                  />
                  {isLocked && (
                    <Lock className="absolute -bottom-1 -right-1 w-3 h-3 text-muted-foreground bg-card rounded-full p-[1px]" />
                  )}
                </span>
                <span
                  className={`text-[10px] font-medium transition-colors ${
                    isActive ? "text-primary" : "text-muted-foreground"
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