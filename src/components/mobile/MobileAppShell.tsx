import { ReactNode } from "react";
import MobileHeader from "./MobileHeader";
import MobileTabBar, { MobileTab } from "./MobileTabBar";

interface Props {
  title: string;
  active: MobileTab;
  onChange: (tab: MobileTab) => void;
  profileName?: string;
  profileAvatar?: string;
  userId?: string;
  lockedTabs?: MobileTab[];
  onSettings?: () => void;
  workoutMode?: boolean;
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
  onSettings,
  workoutMode = false,
  children,
}: Props) => {
  return (
    <div className={`mobile-dashboard-shell bg-background ${workoutMode ? "h-dvh overflow-hidden" : "min-h-dvh"}`}>
      {!workoutMode && (
        <MobileHeader
          title={title}
          profileName={profileName}
          profileAvatar={profileAvatar}
          userId={userId}
          onSettings={onSettings}
        />
      )}

      <main
        className={workoutMode ? "mobile-dashboard-content h-dvh overflow-y-auto" : "mobile-dashboard-content box-border flex h-dvh flex-col overflow-y-auto overscroll-contain"}
        style={workoutMode ? undefined : {
          paddingTop: "calc(56px + var(--safe-top, 0px) + 12px)",
          paddingBottom: "var(--mobile-nav-content-padding)",
          paddingLeft: "max(1rem, var(--safe-left, 0px))",
          paddingRight: "max(1rem, var(--safe-right, 0px))",
        }}
      >
        {children}
      </main>

      {!workoutMode && <MobileTabBar active={active} onChange={onChange} lockedTabs={lockedTabs} />}
    </div>
  );
};

export default MobileAppShell;