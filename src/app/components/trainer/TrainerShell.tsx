import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { ChevronLeft } from "lucide-react";
import NavBar from "@/shared/components/native/NavBar";
import { SidebarTrigger } from "@/shared/components/ui/sidebar";
import { useNavBarState, useStatusTapScrollTop } from "@/shared/hooks/useNavBarState";
import { hapticTap } from "@/shared/lib/native";
import { cn } from "@/shared/lib/utils";

interface TrainerShellDetail {
  /** Título de barra de la ficha: el nombre del cliente. */
  title: string;
  backLabel: string;
  backAriaLabel?: string;
  onBack: () => void;
}

interface TrainerShellProps {
  /** Título de la pestaña: título grande en el móvil, cabecera en escritorio. */
  title: string;
  /** Pantalla empujada sobre la pestaña (ficha de un cliente). */
  detail?: TrainerShellDetail | null;
  /** Identifica la pantalla visible: al cambiar, el scroll vuelve arriba o a donde estaba la lista. */
  screenKey: string;
  children: ReactNode;
}

/**
 * Chrome del panel de entrenador, el mismo que la app de usuario (MobileAppShell):
 * en el móvil, barra de iOS con título grande que se pliega al hacer scroll y
 * «‹ Clientes» en las fichas; desde `md`, cabecera compacta junto a la barra lateral.
 */
const TrainerShell = ({ title, detail, screenKey, children }: TrainerShellProps) => {
  const scrollRef = useRef<HTMLElement>(null);
  const barRef = useRef<HTMLElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const contentTitleRef = useRef<HTMLElement | null>(null);
  const [contentTitleMissing, setContentTitleMissing] = useState(true);
  const isDetail = Boolean(detail);

  // En una ficha, el título de barra sigue al titular del contenido (`data-nav-title`) si lo hay.
  // La ficha carga sus datos por su cuenta, así que el titular puede aparecer más tarde.
  useLayoutEffect(() => {
    const scroller = scrollRef.current;
    if (!isDetail || !scroller) {
      contentTitleRef.current = null;
      return;
    }
    const findTitle = () => {
      const heading =
        Array.from(scroller.querySelectorAll<HTMLElement>("[data-nav-title]")).find(
          (element) => element.getClientRects().length > 0,
        ) ?? null;
      contentTitleRef.current = heading;
      setContentTitleMissing(!heading);
    };
    findTitle();
    const observer = new MutationObserver(findTitle);
    observer.observe(scroller, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [isDetail, screenKey]);

  const { scrolled, collapsed } = useNavBarState(scrollRef, isDetail ? contentTitleRef : titleRef, barRef);
  useStatusTapScrollTop(scrollRef);

  // Cada lista recuerda su scroll: al volver de una ficha se sigue donde se estaba.
  const scrollMemory = useRef(new Map<string, number>());
  const shownKey = useRef(screenKey);
  useEffect(() => {
    const scroller = scrollRef.current;
    if (!scroller) return;
    const remember = () => {
      scrollMemory.current.set(shownKey.current, scroller.scrollTop);
    };
    scroller.addEventListener("scroll", remember, { passive: true });
    return () => scroller.removeEventListener("scroll", remember);
  }, []);
  useLayoutEffect(() => {
    if (shownKey.current === screenKey) return;
    shownKey.current = screenKey;
    const scroller = scrollRef.current;
    if (!scroller) return;
    scroller.scrollTop = isDetail ? 0 : scrollMemory.current.get(screenKey) ?? 0;
  }, [screenKey, isDetail]);

  const titleVisible = isDetail && contentTitleMissing ? true : collapsed;
  const solid = isDetail ? scrolled : collapsed;

  return (
    <>
      <NavBar
        ref={barRef}
        className="fixed inset-x-0 top-0 md:hidden"
        title={detail ? detail.title : title}
        titleVisible={titleVisible}
        titleAsHeading={false}
        solid={solid}
        leading={
          detail ? (
            <button
              type="button"
              onClick={() => {
                void hapticTap();
                detail.onBack();
              }}
              aria-label={detail.backAriaLabel}
              className="inline-flex h-11 items-center gap-0.5 pl-0.5 pr-2 text-primary transition-opacity active:opacity-60"
            >
              <ChevronLeft className="h-[22px] w-[22px]" strokeWidth={2.5} aria-hidden="true" />
              <span className="type-body">{detail.backLabel}</span>
            </button>
          ) : null
        }
      />

      <header
        className="app-chrome sticky top-0 z-40 hidden border-b-[0.5px] md:block"
        style={{ paddingTop: "var(--safe-top, 0px)" }}
      >
        <div className="flex h-14 items-center gap-3 px-4">
          <SidebarTrigger />
          <h1 className="min-w-0 flex-1 truncate type-headline">{detail ? detail.title : title}</h1>
        </div>
      </header>

      <main
        ref={scrollRef}
        className={cn(
          "box-border flex h-dvh w-full min-w-0 flex-col overflow-y-auto overscroll-contain",
          "pb-[var(--mobile-nav-content-padding)] pl-[max(1rem,var(--safe-left,0px))] pr-[max(1rem,var(--safe-right,0px))]",
          isDetail
            ? "pt-[calc(var(--nav-bar-height)+var(--safe-top,0px)+8px)]"
            : "pt-[calc(var(--nav-bar-height)+var(--safe-top,0px))]",
          "md:block md:h-auto md:w-full md:flex-1 md:overflow-visible md:overscroll-auto md:p-6 md:pb-8 lg:p-8",
        )}
      >
        {!detail && (
          <h1 ref={titleRef} data-nav-title className="type-large-title shrink-0 pb-2 pt-1 md:hidden">
            {title}
          </h1>
        )}
        {children}
      </main>
    </>
  );
};

export default TrainerShell;
