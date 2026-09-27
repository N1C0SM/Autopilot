import { Home, Dumbbell, Apple, MessageCircle, Sparkles } from "lucide-react";
import type { UserSection } from "@/components/UserSidebar";
import FloatingMobileNav from "@/components/mobile/FloatingMobileNav";

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
    <FloatingMobileNav
      className="mobile-tabbar"
      active={active}
      items={TABS.map((tab) => ({ ...tab, locked: lockedTabs.includes(tab.key) }))}
      label="Navegación principal"
      layoutId="client-mobile-tab"
      onChange={(tab) => onChange(tab as MobileTab)}
    />
  );
};

export default MobileTabBar;