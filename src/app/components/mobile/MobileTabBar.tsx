import { Flame as Apple, TrendingUp, Home, Dumbbell, type LucideIcon } from "lucide-react";
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

// Iconos «fill» para la pestaña activa — misma forma que el outline pero relleno, como SF Symbols .fill
const HomeFill = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z" />
  </svg>
);
const NutritionFill = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M18.06 22.99h1.66c.84 0 1.53-.64 1.63-1.46L23 5.05h-5V1h-1.97v4.05h-4.97l.3 2.34c1.71.47 3.31 1.32 4.27 2.26 1.44 1.42 2.43 2.89 2.43 5.29v8.05zM1 21.99V21h15.03v.99c0 .55-.45 1-1.01 1H2.01c-.56 0-1.01-.45-1.01-1zm15.03-7c0-5.2-6.79-5.2-6.79-5.2H1v2h14.03l.02 3.2H1v2h15.03v-2z" />
  </svg>
);
const ProgressFill = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M3.5 18.49l6-6.01 4 4L22 6.92l-1.41-1.41-7.09 7.97-4-4L2 16.99z" />
  </svg>
);
// Iconos outline finos para estado inactivo — trazo 1.7 consistente con el diseño
const NutritionIcon = ({ className, strokeWidth }: { className?: string; strokeWidth?: number }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth ?? 1.7} strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 8h1a4 4 0 0 1 0 8h-1" />
    <path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z" />
    <line x1="6" y1="1" x2="6" y2="4" />
    <line x1="10" y1="1" x2="10" y2="4" />
    <line x1="14" y1="1" x2="14" y2="4" />
  </svg>
);
const ProgressIcon = ({ className, strokeWidth }: { className?: string; strokeWidth?: number }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth ?? 1.7} strokeLinecap="round" strokeLinejoin="round">
    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
  </svg>
);

/** Navegación móvil web; Entrenar se abre desde Inicio, no como pestaña. */
export const TABS: { key: MobileTab; label: string; icon: LucideIcon | typeof NutritionIcon | typeof ProgressIcon; activeIcon?: typeof HomeFill }[] = [
  { key: "home", label: "Hoy", icon: Home, activeIcon: HomeFill },
  { key: "library", label: "Ejercicios", icon: Dumbbell },
  { key: "nutrition", label: "Nutrición", icon: NutritionIcon, activeIcon: NutritionFill },
  { key: "progress", label: "Progreso", icon: ProgressIcon, activeIcon: ProgressFill },
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