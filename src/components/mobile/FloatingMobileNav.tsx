import { createPortal } from "react-dom";
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

const FloatingMobileNav = ({ active, items, label, layoutId, onChange, className }: Props) => createPortal(
  <nav
    className={`${className} fixed z-50 md:hidden`}
    style={{
      position: "fixed",
      left: "max(0.75rem, env(safe-area-inset-left, 0px))",
      right: "max(0.75rem, env(safe-area-inset-right, 0px))",
      bottom: "calc(0.75rem + env(safe-area-inset-bottom, 0px))",
      // Capa GPU propia: iOS la mantiene clavada durante el scroll inercial
      transform: "translate3d(0,0,0)",
      WebkitTransform: "translate3d(0,0,0)",
      willChange: "transform",
      backfaceVisibility: "hidden",
      touchAction: "manipulation",
    }}
    aria-label={label}
  >
    <ul className="mx-auto flex h-[var(--mobile-nav-height)] max-w-[30rem] items-center gap-1 rounded-[1.75rem] border border-border/70 bg-background/80 p-1.5 shadow-[0_10px_32px_-18px_hsl(var(--foreground)/0.35)] backdrop-blur-2xl supports-[backdrop-filter]:bg-background/72">
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
              <span className="relative z-10 flex h-11 w-12 items-center justify-center">
                {isActive && (
                  <motion.span
                    layoutId={`${layoutId}-active`}
                    className="absolute inset-0 rounded-[1.1rem] border border-primary/25 bg-primary/10"
                    transition={{ type: "spring", stiffness: 360, damping: 32 }}
                  />
                )}
                <Icon
                  className={`relative z-10 h-[21px] w-[21px] transition-transform duration-200 ${
                    isActive ? "scale-105 text-primary" : "text-current"
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
  </nav>,
  document.body,
);

export default FloatingMobileNav;
