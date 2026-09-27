import { LayoutDashboard, BarChart3, Dumbbell, SlidersHorizontal, Target } from "lucide-react";
import type { AdminSection } from "@/pages/Admin";
import FloatingMobileNav from "@/components/mobile/FloatingMobileNav";

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
  <FloatingMobileNav
    className="admin-mobile-nav"
    active={section}
    items={TABS.map(({ section: key, ...tab }) => ({ ...tab, key }))}
    label="Navegación principal de administración"
    layoutId="admin-mobile-tab"
    onChange={(key) => onNavigate(key as AdminSection)}
  />
);

export default AdminMobileNav;
