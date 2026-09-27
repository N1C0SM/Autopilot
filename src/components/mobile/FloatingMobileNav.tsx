import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import { Lock } from "lucide-react";
import { hapticTap } from "@/lib/native";

export interface FloatingMobileNavItem {
  key: string;
  label: string;
  icon: LucideIcon;
  locked?: boolean;
}

interface Props {
  active: string;
  items: FloatingMobileNavItem[];
  label: string;
  layoutId: string;
  onChange: (key: string) => void;
  className: string;
}

const FloatingMobileNav = ({ active, items, label, layoutId, onChange, className }: Props) => (
  <nav
    className={`${className} fixed z-50 md:hidden`}
    style={{
      left: "max(0.75rem, var(--safe-left, 0px))",
      right: "max(0.75rem, var(--safe-right, 0px))",
      bottom: "calc(0.75rem + var(--safe-bottom, 0px))",
    }}
    aria-label={label}
  >
    <ul className="mx-auto flex h-[4.25rem] max-w-[30rem] items-center gap-1 rounded-full border border-border/80 bg-background/90 p-1.5 shadow-[0_12px_40px_-12px_hsl(var(--foreground)/0.3)] backdrop-blur-2xl supports-[backdrop-filter]:bg-background/80">
      {items.map(({ key, label: itemLabel, icon: Icon, locked }) => {
        const isActive = active === key;
        return (
          <li key={key} className="min-w-0 flex-1">
            <button
              type="button"
              onClick={() => {
                hapticTap();
                onChange(key);
              }}
              aria-current={isActive ? "page" : undefined}
              aria-label={itemLabel}
              className={`relative flex h-full w-full flex-col items-center justify-center gap-1 rounded-full px-0.5 transition-transform duration-150 active:scale-95 ${
                isActive ? "text-primary" : "text-muted-foreground"
              }`}
            >
              {isActive && (
                <motion.span
                  layoutId={`${layoutId}-active`}
                  className="absolute inset-0 rounded-full border border-primary/60 bg-primary/20 shadow-[inset_0_1px_0_hsl(var(--primary)/.25),0_4px_18px_-8px_hsl(var(--primary)/.9)]"
                  transition={{ type: "spring", stiffness: 420, damping: 34 }}
                />
              )}
              <span className="relative z-10">
                <Icon
                  className={`h-[21px] w-[21px] transition-transform duration-200 ${
                    isActive ? "scale-110 text-primary drop-shadow-[0_0_7px_hsl(var(--primary)/.45)]" : "text-current"
                  }`}
                  strokeWidth={isActive ? 2.35 : 1.9}
                />
                {locked && (
                  <Lock className="absolute -bottom-1 -right-1 h-3 w-3 rounded-full bg-background p-[1px] text-muted-foreground" />
                )}
              </span>
              <span
                className={`relative z-10 max-w-full truncate px-0.5 text-[9px] leading-none min-[380px]:text-[10px] ${
                  isActive ? "font-semibold text-primary" : "font-medium text-current"
                }`}
              >
                {itemLabel}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  </nav>
);

export default FloatingMobileNav;
