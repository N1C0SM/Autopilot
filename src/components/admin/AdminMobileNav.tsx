import { LayoutDashboard, BarChart3, Dumbbell, SlidersHorizontal, Target } from "lucide-react";
import { motion } from "framer-motion";
import { hapticTap } from "@/lib/native";
import type { AdminSection } from "@/pages/Admin";

interface Props {
  section: AdminSection;
  onNavigate: (s: AdminSection) => void;
}

const TABS: { label: string; section: AdminSection; icon: typeof LayoutDashboard }[] = [
  { label: "Dashboard", section: "dashboard", icon: LayoutDashboard },
  { label: "Métricas", section: "metrics", icon: BarChart3 },
  { label: "Ejercicios", section: "exercises", icon: Dumbbell },
  { label: "Reglas", section: "rules", icon: SlidersHorizontal },
  { label: "Físicos", section: "physiques", icon: Target },
];

/** Barra de navegación inferior del panel admin (solo pantallas estrechas). */
const AdminMobileNav = ({ section, onNavigate }: Props) => (
  <nav
    className="admin-mobile-nav fixed z-50 md:hidden"
    style={{
      left: "max(0.75rem, var(--safe-left, 0px))",
      right: "max(0.75rem, var(--safe-right, 0px))",
      bottom: "calc(0.75rem + var(--safe-bottom, 0px))",
    }}
    aria-label="Navegación principal de administración"
  >
    <ul className="mx-auto flex h-[4.25rem] max-w-[30rem] items-center gap-1 rounded-full border border-border/80 bg-background/85 p-1.5 shadow-[0_12px_40px_-12px_hsl(var(--foreground)/0.3)] backdrop-blur-2xl supports-[backdrop-filter]:bg-background/75">
      {TABS.map((t) => {
        const isActive = section === t.section;
        return (
          <li key={t.section} className="min-w-0 flex-1">
            <button
              type="button"
              onClick={() => {
                hapticTap();
                onNavigate(t.section);
              }}
              aria-current={isActive ? "page" : undefined}
              aria-label={t.label}
              className={`relative flex h-full w-full flex-col items-center justify-center gap-1 rounded-full px-0.5 transition-transform active:scale-95 ${
                isActive ? "text-primary" : "text-muted-foreground"
              }`}
            >
              {isActive && (
                <motion.span
                  layoutId="admin-mobile-tab-indicator"
                  className="absolute inset-0 rounded-full border border-primary/30 bg-primary/[0.12] shadow-[0_0_22px_-8px_hsl(var(--primary)/0.65)]"
                  transition={{ type: "spring", stiffness: 420, damping: 34 }}
                />
              )}
              <t.icon className={`relative z-10 h-[21px] w-[21px] transition-transform duration-200 ${isActive ? "scale-110 text-primary" : "text-current"}`} />
              <span
                className={`relative z-10 max-w-full truncate text-[10px] leading-none ${
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

export default AdminMobileNav;
