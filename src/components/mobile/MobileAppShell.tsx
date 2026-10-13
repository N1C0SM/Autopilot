import { ReactNode, useRef } from "react";
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
  children,
}: Props) => {
  const scrollRef = useRef<HTMLElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const barRef = useRef<HTMLElement>(null);
  const showLargeTitle = largeTitle && !workoutMode;
  const { scrolled, collapsed } = useNavBarState(scrollRef, showLargeTitle ? titleRef : undefined, barRef);
  useStatusTapScrollTop(scrollRef);

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
          titleVisible={showLargeTitle ? collapsed : true}
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
