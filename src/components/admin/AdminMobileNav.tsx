import { LayoutDashboard, BarChart3, Dumbbell, SlidersHorizontal, Target } from "lucide-react";
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
    className="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-card/95 backdrop-blur-xl border-t border-border"
    style={{
      paddingBottom: "var(--safe-bottom, 0px)",
      paddingLeft: "var(--safe-left, 0px)",
      paddingRight: "var(--safe-right, 0px)",
    }}
  >
    <ul className="flex items-stretch justify-around h-16">
      {TABS.map((t) => {
        const isActive = section === t.section;
        return (
          <li key={t.section} className="flex-1 min-w-0">
            <button
              type="button"
              onClick={() => onNavigate(t.section)}
              aria-current={isActive ? "page" : undefined}
              className="relative w-full h-full flex flex-col items-center justify-center gap-0.5 px-0.5 active:scale-95 transition-transform"
            >
              {isActive && <span className="absolute top-0 w-10 h-0.5 bg-primary rounded-full" />}
              <t.icon className={`w-[21px] h-[21px] ${isActive ? "text-primary" : "text-muted-foreground"}`} />
              <span
                className={`text-[10px] font-medium leading-tight truncate max-w-full ${
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

export default AdminMobileNav;
