import { forwardRef, useRef, useState } from "react";
import { listAccounts, openAccountPicker } from "@/lib/accounts";
import { supportsMultipleAccounts } from "@/lib/platform";
import { BookOpen } from "lucide-react";
import NotificationsBell from "@/components/NotificationsBell";
import NavBar from "@/components/native/NavBar";
import { hapticImpact, hapticTap } from "@/lib/native";

interface Props {
  title: string;
  profileName?: string;
  profileAvatar?: string;
  userId?: string;
  onSettings?: () => void;
  /** Entrada a Recursos. Solo se pinta si el Dashboard pasa el handler. */
  onResources?: () => void;
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
  ({ title, profileName, profileAvatar, userId, onSettings, onResources, titleVisible = true, solid = true, titleAsHeading = true }, ref) => {
    // Mantener pulsado el avatar abre «¿Quién entrena?» (solo apps nativas con varias cuentas).
    const longPressed = useRef(false);
    const timer = useRef<number>();
    const cancel = () => window.clearTimeout(timer.current);
    const accountLongPress = supportsMultipleAccounts() ? {
      onPointerDown: () => {
        longPressed.current = false;
        timer.current = window.setTimeout(() => {
          if (listAccounts().length < 1) return;
          longPressed.current = true;
          void hapticImpact("medium");
          openAccountPicker();
        }, 450);
      },
      onPointerUp: cancel,
      onPointerLeave: cancel,
      onContextMenu: (e: React.MouseEvent) => { e.preventDefault(); },
    } : {};
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
            {onResources && (
              <button
                type="button"
                onClick={() => {
                  void hapticTap();
                  onResources();
                }}
                aria-label="Recursos"
                className="flex h-11 w-11 shrink-0 items-center justify-center text-foreground transition-opacity active:opacity-60"
              >
                <span className="flex h-[30px] w-[30px] items-center justify-center rounded-full bg-secondary">
                  <BookOpen className="h-[17px] w-[17px]" strokeWidth={2.25} />
                </span>
              </button>
            )}
            {userId && <NotificationsBell userId={userId} />}
            <button
              type="button"
              onClick={() => {
                if (longPressed.current) { longPressed.current = false; return; }
                void hapticTap();
                onSettings?.();
              }}
              {...accountLongPress}
              aria-label={supportsMultipleAccounts() ? "Perfil y ajustes. Mantén pulsado para cambiar de cuenta" : "Perfil y ajustes"}
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
