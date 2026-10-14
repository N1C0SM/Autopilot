import { ReactNode, useEffect, useRef, useState } from "react";
import MobileHeader from "./MobileHeader";
import MobileTabBar, { MobileTab } from "./MobileTabBar";
import { useNavBarState, useStatusTapScrollTop } from "@/hooks/useNavBarState";

interface Props {
  title: string;
  active: MobileTab;
  onChange: (tab: MobileTab) => void;
  profileName?: string;
  profileAvatar?: string;
  userId?: string;
  lockedTabs?: MobileTab[];
  hiddenTabs?: MobileTab[];
  onSettings?: () => void;
  workoutMode?: boolean;
  /**
   * Título grande de iOS: 34 pt al inicio del contenido, que se pliega en la barra
   * al hacer scroll. Sin él, el título vive siempre en la barra.
   */
  largeTitle?: boolean;
  /**
   * La pantalla pinta su propio titular (el saludo de Hoy, marcado con `data-nav-title`):
   * el título de la barra solo aparece cuando ese titular pasa bajo la barra.
   */
  titleInContent?: boolean;
  children: ReactNode;
}

const MobileAppShell = ({
  title,
  active,
  onChange,
  profileName,
  profileAvatar,
  userId,
  lockedTabs,
  hiddenTabs,
  onSettings,
  workoutMode = false,
  largeTitle = false,
  titleInContent = false,
  children,
}: Props) => {
  const scrollRef = useRef<HTMLElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const contentTitleRef = useRef<HTMLElement | null>(null);
  const barRef = useRef<HTMLElement>(null);
  const showLargeTitle = largeTitle && !workoutMode;
  const followContentTitle = titleInContent && !showLargeTitle && !workoutMode;
  // Hasta medir se da por hecho que el titular existe: así el título de la barra no parpadea al entrar.
  const [contentTitleMissing, setContentTitleMissing] = useState(false);

  // Antes que useNavBarState (mismo commit): su primera medida ya ve el titular visible.
  // Depende de `children` porque el titular aparece o cambia con el contenido.
  useEffect(() => {
    const heading = followContentTitle
      ? Array.from(scrollRef.current?.querySelectorAll<HTMLElement>("[data-nav-title]") ?? []).find(
          (element) => element.getClientRects().length > 0,
        ) ?? null
      : null;
    contentTitleRef.current = heading;
    setContentTitleMissing(followContentTitle && !heading);
  }, [followContentTitle, children]);

  const { scrolled, collapsed } = useNavBarState(
    scrollRef,
    showLargeTitle ? titleRef : followContentTitle ? contentTitleRef : undefined,
    barRef,
  );
  useStatusTapScrollTop(scrollRef);
  const titleVisible = showLargeTitle || (followContentTitle && !contentTitleMissing) ? collapsed : true;

  return (
    <div className={`mobile-dashboard-shell bg-background ${workoutMode ? "h-dvh overflow-hidden" : "min-h-dvh"}`}>
      {!workoutMode && (
        <MobileHeader
          ref={barRef}
          title={title}
          profileName={profileName}
          profileAvatar={profileAvatar}
          userId={userId}
          onSettings={onSettings}
          titleVisible={titleVisible}
          titleAsHeading={!showLargeTitle}
          solid={showLargeTitle ? collapsed : scrolled}
        />
      )}

      <main
        ref={scrollRef}
        className={workoutMode ? "mobile-dashboard-content h-dvh overflow-y-auto" : "mobile-dashboard-content box-border flex h-dvh flex-col overflow-y-auto overscroll-contain"}
        style={workoutMode ? undefined : {
          paddingTop: `calc(var(--nav-bar-height) + var(--safe-top, 0px) + ${showLargeTitle ? "0px" : "8px"})`,
          paddingBottom: "var(--mobile-nav-content-padding)",
          paddingLeft: "max(1rem, var(--safe-left, 0px))",
          paddingRight: "max(1rem, var(--safe-right, 0px))",
        }}
      >
        {showLargeTitle && (
          <h1 ref={titleRef} className="type-large-title shrink-0 pb-2 pt-1">
            {title}
          </h1>
        )}
        {children}
      </main>

      {!workoutMode && <MobileTabBar active={active} onChange={onChange} lockedTabs={lockedTabs} hiddenTabs={hiddenTabs} />}
    </div>
  );
};

export default MobileAppShell;
