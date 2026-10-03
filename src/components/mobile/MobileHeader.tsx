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
      className="app-chrome fixed top-0 left-0 right-0 z-40 border-b md:hidden"
      style={{
        paddingTop: "var(--safe-top, 0px)",
        paddingLeft: "var(--safe-left, 0px)",
        paddingRight: "var(--safe-right, 0px)",
      }}
    >
      <div className="h-14 px-3 flex items-center gap-3">
        <button
          type="button"
          onClick={onSettings}
          aria-label="Perfil y ajustes"
          className="w-9 h-9 rounded-full bg-secondary flex items-center justify-center overflow-hidden shrink-0 ring-1 ring-border active:scale-95 active:opacity-80 transition-transform"
        >
          {profileAvatar ? (
            <img src={profileAvatar} alt="" className="w-full h-full object-cover" />
          ) : (
            <span aria-hidden="true" className="text-xs font-bold text-foreground">
              {(profileName || "?").charAt(0).toUpperCase()}
            </span>
          )}
        </button>
        <h1 className="flex-1 text-center font-display font-bold text-base truncate">
          {title}
        </h1>
        <div className="w-9 flex items-center justify-end shrink-0">
          {userId && <NotificationsBell userId={userId} />}
        </div>
      </div>
    </header>
  );
};

export default MobileHeader;