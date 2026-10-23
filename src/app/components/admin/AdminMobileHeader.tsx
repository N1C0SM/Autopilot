import { useLayoutEffect, useRef, useState, type RefObject } from "react";
import {
  Users,
  Mail,
  Globe,
  FileText,
  MailOpen,
  CreditCard,
  UserCog,
  Settings as SettingsIcon,
  LogOut,
  Layers,
  FolderOpen,
  ChevronLeft,
  Route,
} from "lucide-react";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/shared/components/ui/sheet";
import NavBar from "@/shared/components/native/NavBar";
import { hapticTap } from "@/shared/lib/native";
import { useAccountLongPress } from "@/shared/hooks/useAccountLongPress";
import { openAccountPicker } from "@/shared/lib/accounts";
import { supportsMultipleAccounts } from "@/shared/lib/platform";
import { ArrowLeftRight } from "lucide-react";
import { cn } from "@/shared/lib/utils";
import autopilotLogo from "@/shared/assets/autopilot-logo.png";
import type { AdminSection } from "@/app/pages/Admin";

interface Props {
  title: string;
  section: AdminSection;
  onNavigate: (s: AdminSection) => void;
  onSignOut: () => void;
  /** Contenido desplazable: su primer titular (`data-nav-title` o `h1`) decide cuándo se ve el título de la barra. */
  contentRef: RefObject<HTMLElement>;
  /** Cambia al cambiar de pantalla, para volver a medir. */
  layoutKey: string;
  onBack?: () => void;
  backLabel?: string;
}

const MENU: { label: string; section: AdminSection; icon: typeof Users }[] = [
  { label: "Roadmap", section: "roadmap", icon: Route },
  { label: "Usuarios", section: "users", icon: Users },
  { label: "Entrenadores", section: "trainers", icon: UserCog },
  { label: "Planes y productos", section: "products", icon: Layers },
  { label: "Pagos", section: "payments", icon: CreditCard },
  { label: "Drive · Libros", section: "drive", icon: FolderOpen },
  { label: "Recordatorios", section: "reminders", icon: Mail },
  { label: "Landing", section: "landing", icon: Globe },
  { label: "Blog", section: "blog", icon: FileText },
  { label: "Emails", section: "emails", icon: MailOpen },
];

/**
 * Como `titleInContent` de MobileAppShell, pero con el scroll del documento:
 * el título pequeño solo aparece cuando el titular del contenido pasa bajo la barra.
 */
function useContentTitleState(contentRef: RefObject<HTMLElement>, barRef: RefObject<HTMLElement>, layoutKey: string) {
  const [state, setState] = useState({ scrolled: false, collapsed: false, hasHeading: true });

  useLayoutEffect(() => {
    let frame = 0;
    const measure = () => {
      frame = 0;
      const content = contentRef.current;
      const bar = barRef.current;
      if (!content || !bar || bar.getClientRects().length === 0) return;
      const barBottom = bar.getBoundingClientRect().bottom;
      const heading =
        Array.from(content.querySelectorAll<HTMLElement>("[data-nav-title], h1")).find(
          (element) => element.getClientRects().length > 0,
        ) ?? null;
      const scrolled = content.getBoundingClientRect().top < barBottom - 2;
      const collapsed = heading ? heading.getBoundingClientRect().bottom <= barBottom + 4 : true;
      const hasHeading = heading !== null;
      setState((prev) =>
        prev.scrolled === scrolled && prev.collapsed === collapsed && prev.hasHeading === hasHeading
          ? prev
          : { scrolled, collapsed, hasHeading },
      );
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(measure);
    };
    measure();
    window.addEventListener("scroll", schedule, { passive: true, capture: true });
    window.addEventListener("resize", schedule);
    // Las secciones se cargan bajo demanda: el titular puede aparecer después.
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(schedule);
    if (contentRef.current) observer?.observe(contentRef.current);
    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule, { capture: true });
      window.removeEventListener("resize", schedule);
      observer?.disconnect();
    };
  }, [contentRef, barRef, layoutKey]);

  return state;
}

const menuRow =
  "flex min-h-[44px] w-full items-center gap-3 rounded-xl px-3 text-left type-body transition-colors duration-150 active:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring";

/** Barra de navegación del panel admin en pantallas estrechas, con el menú de secciones. */
const AdminMobileHeader = ({ title, section, onNavigate, onSignOut, contentRef, layoutKey, onBack, backLabel = "Atrás" }: Props) => {
  const longPress = useAccountLongPress();
  const [open, setOpen] = useState(false);
  const barRef = useRef<HTMLElement>(null);
  const { scrolled, collapsed, hasHeading } = useContentTitleState(contentRef, barRef, layoutKey);

  const go = (s: AdminSection) => {
    void hapticTap();
    setOpen(false);
    onNavigate(s);
  };

  return (
    <NavBar
      ref={barRef}
      className="sticky top-0 md:hidden"
      title={
        onBack ? (
          // El título centrado no pisa el "‹ Usuarios" de la izquierda.
          <span className="inline-block max-w-[calc(100vw-14.5rem)] truncate align-bottom">{title}</span>
        ) : (
          title
        )
      }
      titleVisible={hasHeading ? collapsed : true}
      titleAsHeading={false}
      solid={scrolled}
      leading={
        onBack ? (
          <button
            type="button"
            onClick={() => {
              void hapticTap();
              onBack();
            }}
            className="inline-flex h-11 items-center gap-0.5 pl-0.5 pr-2 text-primary transition-opacity active:opacity-60"
          >
            <ChevronLeft className="h-[22px] w-[22px]" strokeWidth={2.5} aria-hidden="true" />
            <span className="type-body">{backLabel}</span>
          </button>
        ) : null
      }
      trailing={
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <button
              type="button"
              aria-label={supportsMultipleAccounts() ? "Menú de administración. Mantén pulsado para cambiar de cuenta" : "Menú de administración"}
              // Tras una pulsación larga no se abre el menú: ya se abrió el selector de cuentas.
              onClick={(e) => { if (longPress.consumed()) { e.preventDefault(); return; } void hapticTap(); }}
              {...longPress.handlers}
              className="inline-flex h-11 w-11 shrink-0 items-center justify-center transition-opacity active:opacity-60"
            >
              <img decoding="async" src={autopilotLogo} alt="" className="h-[30px] w-[30px] rounded-full object-cover" />
            </button>
          </SheetTrigger>

          <SheetContent
            side="right"
            aria-describedby={undefined}
            onOpenAutoFocus={(event) => event.preventDefault()}
            className="flex w-[82vw] max-w-xs flex-col p-0 [&>button:last-child]:top-[calc(var(--safe-top,0px)+1.125rem)]"
            style={{
              paddingTop: "var(--safe-top, 0px)",
              paddingBottom: "var(--safe-bottom, 0px)",
              paddingRight: "var(--safe-right, 0px)",
            }}
          >
            <div className="px-5 pb-3 pt-3">
              <SheetTitle className="type-large-title">Admin</SheetTitle>
            </div>
            <nav aria-label="Secciones de administración" className="flex-1 overflow-y-auto px-2 pb-3">
              {MENU.map((m) => {
                const isActive = section === m.section;
                return (
                  <button
                    key={m.section}
                    type="button"
                    aria-current={isActive ? "page" : undefined}
                    onClick={() => go(m.section)}
                    className={cn(menuRow, isActive && "bg-primary/15 font-semibold text-primary")}
                  >
                    <m.icon className={cn("h-5 w-5 shrink-0", isActive ? "text-primary" : "text-muted-foreground")} aria-hidden="true" />
                    {m.label}
                  </button>
                );
              })}
              <div className="mx-3 my-2 sep-t" />
              <button
                type="button"
                aria-current={section === "account" ? "page" : undefined}
                onClick={() => go("account")}
                className={cn(menuRow, section === "account" && "bg-primary/15 font-semibold text-primary")}
              >
                <SettingsIcon className={cn("h-5 w-5 shrink-0", section === "account" ? "text-primary" : "text-muted-foreground")} aria-hidden="true" />
                Mi cuenta
              </button>
              {supportsMultipleAccounts() && <button
                type="button"
                onClick={() => { void hapticTap(); setOpen(false); openAccountPicker(); }}
                className={menuRow}
              >
                <ArrowLeftRight className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true" />
                Cambiar de cuenta
              </button>}
              <button
                type="button"
                onClick={() => {
                  void hapticTap();
                  setOpen(false);
                  onSignOut();
                }}
                className={cn(menuRow, "text-destructive")}
              >
                <LogOut className="h-5 w-5 shrink-0" aria-hidden="true" />
                Cerrar sesión
              </button>
            </nav>
          </SheetContent>
        </Sheet>
      }
    />
  );
};

export default AdminMobileHeader;
