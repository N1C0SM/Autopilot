import { motion, AnimatePresence } from "framer-motion";
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
  children,
}: Props) => {
  return (
    <div className="min-h-screen bg-background">
      <MobileHeader
        title={title}
        profileName={profileName}
        profileAvatar={profileAvatar}
        userId={userId}
        onSettings={onSettings}
      />

      <main
        style={{
          paddingTop: "calc(56px + var(--safe-top, 0px) + 12px)",
          paddingBottom: "calc(5.5rem + var(--safe-bottom, 0px))",
          paddingLeft: "max(0.75rem, var(--safe-left, 0px))",
          paddingRight: "max(0.75rem, var(--safe-right, 0px))",
        }}
      >
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={active}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
          >
            {children}
          </motion.div>
        </AnimatePresence>
      </main>

      <MobileTabBar active={active} onChange={onChange} lockedTabs={lockedTabs} />
    </div>
  );
};

export default MobileAppShell;