import { Settings as SettingsIcon } from "lucide-react";
import NotificationsBell from "@/components/NotificationsBell";

interface Props {
  title: string;
  profileName?: string;
  profileAvatar?: string;
  userId?: string;
  onSettings?: () => void;
}

const MobileHeader = ({ title, profileName, profileAvatar, userId, onSettings }: Props) => {
  return (
    <header
      className="fixed top-0 left-0 right-0 z-40 md:hidden bg-card/95 backdrop-blur-xl border-b border-border"
      style={{ paddingTop: "var(--safe-top, 0px)" }}
    >
      <div className="h-14 px-3 flex items-center gap-3">
        <button
          type="button"
          onClick={onSettings}
          className="flex items-center gap-2 min-w-0 active:opacity-70"
          aria-label="Ajustes"
        >
          <div className="w-9 h-9 rounded-full bg-secondary flex items-center justify-center overflow-hidden shrink-0 ring-1 ring-border">
            {profileAvatar ? (
              <img src={profileAvatar} alt="" className="w-full h-full object-cover" />
            ) : (
              <span className="text-xs font-bold text-foreground">
                {(profileName || "?").charAt(0).toUpperCase()}
              </span>
            )}
          </div>
        </button>
        <h1 className="flex-1 text-center font-display font-bold text-base truncate">
          {title}
        </h1>
        <div className="flex items-center gap-1 shrink-0">
          {userId && <NotificationsBell userId={userId} />}
          <button
            type="button"
            onClick={onSettings}
            className="w-9 h-9 rounded-full flex items-center justify-center text-muted-foreground active:bg-secondary"
            aria-label="Ajustes"
          >
            <SettingsIcon className="w-5 h-5" />
          </button>
        </div>
      </div>
    </header>
  );
};

export default MobileHeader;