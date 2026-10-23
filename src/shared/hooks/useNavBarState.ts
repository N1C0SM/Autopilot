import { useEffect, useState, type RefObject } from "react";

/**
 * Estado de la barra de navegación según el scroll, como en UIKit:
 * - `scrolled`: hay contenido bajo la barra (aparece el material y la línea).
 * - `collapsed`: el título grande ya ha pasado bajo la barra (aparece el título pequeño).
 */
export function useNavBarState(
  scrollRef: RefObject<HTMLElement>,
  largeTitleRef?: RefObject<HTMLElement>,
  barRef?: RefObject<HTMLElement>,
) {
  const [state, setState] = useState({ scrolled: false, collapsed: false });

  useEffect(() => {
    const scroller = scrollRef.current;
    if (!scroller) return;
    const measure = () => {
      const scrolled = scroller.scrollTop > 2;
      const title = largeTitleRef?.current;
      const bar = barRef?.current;
      const barBottom = bar ? bar.getBoundingClientRect().bottom : scroller.getBoundingClientRect().top;
      const collapsed = title ? title.getBoundingClientRect().bottom <= barBottom + 4 : scrolled;
      setState((prev) => (prev.scrolled === scrolled && prev.collapsed === collapsed ? prev : { scrolled, collapsed }));
    };
    measure();
    scroller.addEventListener("scroll", measure, { passive: true });
    window.addEventListener("resize", measure);
    return () => {
      scroller.removeEventListener("scroll", measure);
      window.removeEventListener("resize", measure);
    };
  }, [scrollRef, largeTitleRef, barRef]);

  return state;
}

/** Tocar la barra de estado sube al principio (Capacitor emite `statusTap` en iOS). */
export function useStatusTapScrollTop(scrollRef: RefObject<HTMLElement>) {
  useEffect(() => {
    const toTop = () => scrollRef.current?.scrollTo({ top: 0, behavior: "smooth" });
    window.addEventListener("statusTap", toTop);
    return () => window.removeEventListener("statusTap", toTop);
  }, [scrollRef]);
}
