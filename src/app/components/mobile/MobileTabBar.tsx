import { MessageCircle, Dumbbell, Flame as Apple, TrendingUp, Home, type LucideIcon } from "lucide-react";
import type { UserSection } from "@/app/components/UserSidebar";
import FloatingMobileNav from "@/app/components/mobile/FloatingMobileNav";

export type MobileTab = UserSection | "progress";

interface Props {
  active: MobileTab;
  onChange: (tab: MobileTab) => void;
  lockedTabs?: MobileTab[];
  /** Tabs not offered at all (e.g. chat while Coach is hidden in Admin). */
  hiddenTabs?: MobileTab[];
}

// Una sola familia de iconos en web y app (Lucide): la pestaña activa se distingue por
// la cápsula dorada y el trazo más grueso, no por un glifo relleno de otra librería.
const TABS: { key: MobileTab; label: string; icon: LucideIcon }[] = [
  // Hoy primero y Entrenar segundo: la acción principal queda bajo el pulgar.
  { key: "home", label: "Hoy", icon: Home },
  { key: "training", label: "Entrenar", icon: Dumbbell },
  { key: "nutrition", label: "Nutrición", icon: Apple },
  { key: "progress", label: "Progreso", icon: TrendingUp },
  { key: "chat", label: "Chat", icon: MessageCircle },
];

const ITEMS = TABS.map((tab) => ({ ...tab }));

const MobileTabBar = ({ active, onChange, lockedTabs = [], hiddenTabs = [] }: Props) => {
  return (
    <FloatingMobileNav
      className="mobile-tabbar"
      active={active}
      items={ITEMS.filter((tab) => !hiddenTabs.includes(tab.key)).map((tab) => ({ ...tab, locked: lockedTabs.includes(tab.key) }))}
      label="Navegación principal"
      layoutId="client-mobile-tab"
      onChange={(tab) => onChange(tab as MobileTab)}
    />
  );
};

export default MobileTabBar;