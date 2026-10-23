import type { ComponentType } from "react";
import { Barbell, ChartLineUp, ChatCircle, ForkKnife, House, type Icon as PhosphorIcon } from "@phosphor-icons/react";
import type { UserSection } from "@/components/UserSidebar";
import FloatingMobileNav from "@/components/mobile/FloatingMobileNav";

export type MobileTab = UserSection | "progress";

interface Props {
  active: MobileTab;
  onChange: (tab: MobileTab) => void;
  lockedTabs?: MobileTab[];
  /** Tabs not offered at all (e.g. chat while Coach is hidden in Admin). */
  hiddenTabs?: MobileTab[];
}

// Iconos como los de iOS: en línea para las pestañas inactivas y rellenos para la activa.
const glyph = (Icon: PhosphorIcon, weight: "regular" | "fill"): ComponentType<{ className?: string }> =>
  function TabGlyph({ className }: { className?: string }) {
    return <Icon className={className} weight={weight} aria-hidden="true" />;
  };

const TABS: { key: MobileTab; label: string; icon: PhosphorIcon }[] = [
  // Hoy primero y Entrenar segundo: la acción principal queda bajo el pulgar.
  { key: "home", label: "Hoy", icon: House },
  { key: "training", label: "Entrenar", icon: Barbell },
  { key: "nutrition", label: "Nutrición", icon: ForkKnife },
  { key: "progress", label: "Progreso", icon: ChartLineUp },
  { key: "chat", label: "Chat", icon: ChatCircle },
];

const ITEMS = TABS.map((tab) => ({ ...tab, icon: glyph(tab.icon, "regular"), activeIcon: glyph(tab.icon, "fill") }));

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