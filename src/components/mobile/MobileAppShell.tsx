import { ReactNode, useEffect, useLayoutEffect, useRef, useState } from "react";
import { ArrowDown, Loader2 } from "lucide-react";
import MobileHeader from "./MobileHeader";
import MobileTabBar, { MobileTab } from "./MobileTabBar";
import OfflineBanner from "./OfflineBanner";
import { useNavBarState, useStatusTapScrollTop } from "@/hooks/useNavBarState";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";
import { hapticTap, registerBackButton } from "@/lib/native";

const NO_PUSHED_TABS: MobileTab[] = [];


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
  /** Atajo fijo a «Hoy» para empezar a entrenar desde cualquier pestaña secundaria. */
  onQuickTrain?: () => void;
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
  /**
   * Pantallas que se abren «empujando» desde una pestaña (Ajustes, Recursos):
   * entran desde la derecha y se pueden cerrar con el gesto de borde izquierdo.
   */
  pushedTabs?: MobileTab[];
  /** Refresco al tirar hacia abajo (UIRefreshControl). */
  onRefresh?: () => Promise<unknown> | unknown;
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
  onQuickTrain,
  largeTitle = false,
  titleInContent = false,
  pushedTabs = NO_PUSHED_TABS,
  onRefresh,
  children,
}: Props) => {
  const scrollRef = useRef<HTMLElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const contentTitleRef = useRef<HTMLElement | null>(null);
  const barRef = useRef<HTMLElement>(null);
  const tabContentRef = useRef<HTMLDivElement>(null);
  const firstTabRef = useRef(true);
  // Fundido corto al cambiar de pestaña sin desmontar su contenido (no se pierde estado).
  useEffect(() => {
    if (firstTabRef.current) { firstTabRef.current = false; return; }
    const el = tabContentRef.current;
    if (!el || typeof el.animate !== "function") return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    el.animate(
      [{ opacity: 0, transform: "translateY(6px)" }, { opacity: 1, transform: "none" }],
      { duration: 220, easing: "cubic-bezier(0.25, 0.1, 0.25, 1)" },
    );
  }, [active]);
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

  // Pull-to-refresh sobre el mismo contenedor que hace scroll: el contenido se
  // mueve con el dedo y vuelve con la curva de iOS.
  const pull = usePullToRefresh(scrollRef, {
    onRefresh: onRefresh ?? (() => undefined),
    enabled: Boolean(onRefresh) && !workoutMode,
  });

  // Al recuperar la conexión se vuelve a pedir todo una sola vez, sin que el
  // usuario tenga que tirar de la pantalla.
  const online = useOnlineStatus();
  const wasOnline = useRef(online);
  useEffect(() => {
    if (online && !wasOnline.current) void onRefresh?.();
    wasOnline.current = online;
  }, [online, onRefresh]);

  // Push/pop de las pantallas secundarias. Las pestañas normales cambian sin
  // animación, como un UITabBarController; Ajustes y Recursos entran desde la
  // derecha y vuelven desde la izquierda.
  const [screenTransition, setScreenTransition] = useState<"push" | "pop" | null>(null);
  const previousScreen = useRef(active);
  useLayoutEffect(() => {
    const previous = previousScreen.current;
    if (previous === active) return;
    previousScreen.current = active;
    const isPushed = pushedTabs.includes(active);
    const wasPushed = pushedTabs.includes(previous);
    if (!isPushed && !wasPushed) {
      setScreenTransition(null);
      return;
    }
    setScreenTransition(isPushed ? "push" : "pop");
    const timer = window.setTimeout(() => setScreenTransition(null), 360);
    return () => window.clearTimeout(timer);
  }, [active, pushedTabs]);

  // Cada pestaña recuerda su posición de scroll, como un UITabBarController: al
  // volver a una pestaña sigues donde lo dejaste, no al principio de la página.
  // La posición se guarda al tocar la barra (antes del cambio) y se restaura
  // después del commit, cuando el contenido ya tiene su altura.
  const scrollMemory = useRef<Record<string, number>>({});
  const switchingTab = useRef(false);

  const handleTabChange = (tab: MobileTab) => {
    if (tab === active) {
      // Tocar la pestaña ya activa vuelve al principio de la pantalla
      // (comportamiento estándar de iOS).
      scrollRef.current?.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    const element = scrollRef.current;
    if (element) scrollMemory.current[active] = element.scrollTop;
    switchingTab.current = true;
    onChange(tab);
  };

  useEffect(() => {
    const element = scrollRef.current;
    if (!element || !switchingTab.current) return;
    const target = scrollMemory.current[active] ?? 0;
    requestAnimationFrame(() => {
      if (scrollRef.current) scrollRef.current.scrollTop = target;
      switchingTab.current = false;
    });
  }, [active]);

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

  // Gesto de borde izquierdo: cierra Ajustes/Recursos como un NavigationStack.
  // No captura el gesto: si no se completa, el scroll sigue como siempre.
  const lastPrimary = useRef<MobileTab>(pushedTabs.includes(active) ? "home" : active);
  useEffect(() => {
    if (!pushedTabs.includes(active)) lastPrimary.current = active;
  }, [active, pushedTabs]);

  useEffect(() => {
    if (workoutMode) return;
    const element = scrollRef.current;
    if (!element) return;

    let startX = 0;
    let startY = 0;
    let tracking = false;

    const onStart = (event: TouchEvent) => {
      if (event.touches.length !== 1) return;
      const touch = event.touches[0];
      // Solo desde el borde: 24 pt, como el gesto del sistema.
      if (touch.clientX > 24) return;
      startX = touch.clientX;
      startY = touch.clientY;
      tracking = true;
    };

    const onEnd = (event: TouchEvent) => {
      if (!tracking) return;
      tracking = false;
      const touch = event.changedTouches?.[0];
      if (!touch) return;
      const dx = touch.clientX - startX;
      const dy = touch.clientY - startY;
      if (!pushedTabs.includes(activeRef.current)) return;
      if (dx < 80 || Math.abs(dy) > dx * 0.6) return;
      void hapticTap();
      onChangeRef.current(lastPrimary.current);
    };

    const onCancel = () => { tracking = false; };

    element.addEventListener("touchstart", onStart, { passive: true });
    element.addEventListener("touchend", onEnd);
    element.addEventListener("touchcancel", onCancel);
    return () => {
      element.removeEventListener("touchstart", onStart);
      element.removeEventListener("touchend", onEnd);
      element.removeEventListener("touchcancel", onCancel);
    };
  }, [workoutMode, pushedTabs]);

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

      {!workoutMode && onRefresh && (
        <>
          <div
            aria-hidden="true"
            className="pointer-events-none fixed inset-x-0 z-40 flex justify-center"
            style={{
              top: "calc(var(--safe-top, 0px) + var(--nav-bar-height) + 10px)",
              opacity: pull.refreshing ? 1 : pull.progress,
              transition: pull.dragging ? "none" : "opacity 180ms ease-out",
            }}
          >
            {pull.refreshing ? (
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            ) : (
              <ArrowDown
                className="h-4 w-4 text-muted-foreground"
                style={{
                  transform: `rotate(${pull.progress >= 1 ? 180 : 0}deg)`,
                  transition: "transform 150ms ease-out",
                }}
              />
            )}
          </div>
          <span className="sr-only" role="status" aria-live="polite">
            {pull.refreshing ? "Actualizando" : ""}
          </span>
        </>
      )}

      <main
        ref={scrollRef}
        className={`${workoutMode ? "mobile-dashboard-content h-dvh overflow-y-auto" : "mobile-dashboard-content box-border flex h-dvh flex-col overflow-y-auto overscroll-contain"}${screenTransition === "push" ? " mobile-screen-push" : ""}${screenTransition === "pop" ? " mobile-screen-pop" : ""}`}
        style={workoutMode ? undefined : {
          ...pull.style,
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
        {/* Cambio de pestaña con fundido corto, como UITabBarController; se respeta «reducir movimiento». */}
        <div ref={tabContentRef} className="flex flex-1 flex-col">
          {children}
        </div>
      </main>

      {/* Sin botón flotante «Ir a entrenar»: Entrenar ya es la segunda pestaña. */}
      {!workoutMode && !online && (
        <OfflineBanner onRetry={onRefresh ? () => onRefresh() : undefined} />
      )}
      {!workoutMode && <MobileTabBar active={active} onChange={handleTabChange} lockedTabs={lockedTabs} hiddenTabs={hiddenTabs} />}
    </div>
  );
};

export default MobileAppShell;
