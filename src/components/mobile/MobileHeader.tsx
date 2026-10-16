import { forwardRef, useState } from "react";
import NotificationsBell from "@/components/NotificationsBell";
import NavBar from "@/components/native/NavBar";
import { hapticTap } from "@/lib/native";

interface Props {
  title: string;
  profileName?: string;
  profileAvatar?: string;
  userId?: string;
  onSettings?: () => void;
  /** El título pequeño se oculta mientras el título grande está a la vista. */
  titleVisible?: boolean;
  /** Material y línea inferior: solo con contenido bajo la barra. */
  solid?: boolean;
  /** Falso cuando la pantalla ya muestra un título grande como encabezado. */
  titleAsHeading?: boolean;
}

const HeaderAvatar = ({ name, src }: { name?: string; src?: string }) => {
  const [failed, setFailed] = useState(false);
  return (
    <span className="flex h-[30px] w-[30px] items-center justify-center overflow-hidden rounded-full bg-secondary">
      {src && !failed ? (
        <img loading="lazy" decoding="async" src={src} alt="" className="h-full w-full object-cover" onError={() => setFailed(true)} />
      ) : (
        <span aria-hidden="true" className="type-footnote font-semibold text-foreground">
          {(name || "?").charAt(0).toUpperCase()}
        </span>
      )}
    </span>
  );
};

const MobileHeader = forwardRef<HTMLElement, Props>(
  ({ title, profileName, profileAvatar, userId, onSettings, titleVisible = true, solid = true, titleAsHeading = true }, ref) => {
    return (
      <NavBar
        ref={ref}
        className="fixed left-0 right-0 top-0 md:hidden"
        title={title}
        titleVisible={titleVisible}
        titleAsHeading={titleAsHeading}
        solid={solid}
        trailing={
          <>
            {userId && <NotificationsBell userId={userId} />}
            <button
              type="button"
              onClick={() => {
                void hapticTap();
                onSettings?.();
              }}
              aria-label="Perfil y ajustes"
              className="flex h-11 w-11 shrink-0 items-center justify-center transition-opacity active:opacity-60"
            >
              <HeaderAvatar key={profileAvatar} name={profileName} src={profileAvatar} />
            </button>
          </>
        }
      />
    );
  },
);
MobileHeader.displayName = "MobileHeader";

export default MobileHeader;
