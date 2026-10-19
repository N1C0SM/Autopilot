import { ReactNode, useEffect, useRef, useState } from "react";
import MobileHeader from "./MobileHeader";
import MobileTabBar, { MobileTab } from "./MobileTabBar";
import { useNavBarState, useStatusTapScrollTop } from "@/hooks/useNavBarState";
import { registerBackButton } from "@/lib/native";

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
  /** Entrada a Recursos (el Dashboard pasa el handler; en web también funciona). */
  onResources?: () => void;
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
  onResources,
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
  // No incluimos `children` en las dependencias para evitar re-renders al cambiar de pestaña.
  useEffect(() => {
    const heading = followContentTitle
      ? Array.from(scrollRef.current?.querySelectorAll<HTMLElement>("[data-nav-title]") ?? []).find(
          (element) => element.getClientRects().length > 0,
        ) ?? null
      : null;
    contentTitleRef.current = heading;
    setContentTitleMissing(followContentTitle && !heading);
  }, [followContentTitle]);

  const { scrolled, collapsed } = useNavBarState(
    scrollRef,
    showLargeTitle ? titleRef : followContentTitle ? contentTitleRef : undefined,
    barRef,
  );
  useStatusTapScrollTop(scrollRef);

  // Botón «atrás» de Android: vuelve a Hoy antes de salir de la app. En web
  // `registerBackButton` es un no-op, así que no cambia el comportamiento del navegador.
  const activeRef = useRef(active);
  const onChangeRef = useRef(onChange);
  useEffect(() => { activeRef.current = active; }, [active]);
  useEffect(() => { onChangeRef.current = onChange; }, [onChange]);
  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    let cancelled = false;
    // Promise.resolve: el wrapper es async hoy, pero el then no debe romper si algún
    // test o plataforma lo sustituye por una función síncrona.
    void Promise.resolve(registerBackButton(() => {
      // false deja que Capacitor cierre la app (comportamiento nativo al estar en Hoy).
      if (activeRef.current === "home") return false;
      onChangeRef.current("home");
      return true;
    })).then((off) => {
      if (cancelled) off();
      else unsubscribe = off;
    });
    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, []);

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
          onResources={onResources}
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
