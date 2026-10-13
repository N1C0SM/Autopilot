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

// Barra de pestañas flotante de iOS: cápsula de material, la pestaña activa lleva
// el tinte y una cápsula de realce que se desliza entre pestañas.
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
    <ul className="mx-auto flex h-[var(--mobile-nav-height)] max-w-[30rem] items-stretch gap-0.5 rounded-full bg-card/70 p-1 shadow-[0_8px_32px_rgba(0,0,0,0.5)] ring-[0.5px] ring-white/10 backdrop-blur-2xl backdrop-saturate-[1.8]">
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
              className={`relative flex h-full w-full flex-col items-center justify-center gap-0.5 rounded-full px-0.5 transition-transform duration-150 ease-ios-standard active:scale-[0.94] ${
                isActive ? "text-primary" : "text-muted-foreground"
              }`}
            >
              {isActive && (
                <motion.span
                  layoutId={`${layoutId}-active`}
                  className="absolute inset-0 rounded-full bg-white/10"
                  transition={{ type: "spring", stiffness: 380, damping: 36 }}
                />
              )}
              <span className="relative z-10 flex h-7 items-center justify-center">
                <Icon className="h-6 w-6" strokeWidth={isActive ? 2.25 : 2} />
                {locked && (
                  <Lock className="absolute -bottom-0.5 -right-2 h-3 w-3 rounded-full bg-card p-[1px] text-muted-foreground" />
                )}
              </span>
              <span className="relative z-10 max-w-full truncate px-0.5 text-[10px] font-medium leading-none">
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
