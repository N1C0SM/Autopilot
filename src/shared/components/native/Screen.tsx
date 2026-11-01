import { useRef, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft } from "lucide-react";
import { cn } from "@/shared/lib/utils";
import { hapticTap } from "@/shared/lib/native";
import { useNavBarState, useStatusTapScrollTop } from "@/shared/hooks/useNavBarState";
import NavBar from "@/shared/components/native/NavBar";

/**
 * Pantalla a sangre fuera de las pestañas (login, ajustes, legal, estados…):
 * barra de navegación, contenido con scroll propio y pie fijo opcional.
 *
 *   <Screen title="Ajustes" largeTitle footer={<Button size="lg" className="w-full">Guardar</Button>}>
 *     …
 *   </Screen>
 *
 * `centered` centra el contenido en vertical (bienvenida, login, estados).
 * Sin `title`, sin `trailing` y con `hideBack` no hay barra, solo zona segura.
 */
interface ScreenProps {
  title?: string;
  largeTitle?: boolean;
  onBack?: () => void;
  backLabel?: string;
  hideBack?: boolean;
  trailing?: ReactNode;
  footer?: ReactNode;
  centered?: boolean;
  /** `reading` = columna de lectura (~70 caracteres): documento legal o artículo. */
  maxWidth?: "sm" | "md" | "lg" | "reading" | "full";
  className?: string;
  contentClassName?: string;
  children: ReactNode;
}

const WIDTH: Record<NonNullable<ScreenProps["maxWidth"]>, string> = {
  sm: "max-w-md",
  md: "max-w-xl md:max-w-2xl",
  lg: "max-w-3xl md:max-w-4xl",
  // 512 px ≈ 70 caracteres con el cuerpo legal de 16 px (`62ch` sobre un contenedor de 17 px daría ~85).
  reading: "max-w-[36rem]",
  full: "max-w-none",
};

const Screen = ({
  title,
  largeTitle = false,
  onBack,
  backLabel = "Atrás",
  hideBack = false,
  trailing,
  footer,
  centered = false,
  maxWidth = "md",
  className,
  contentClassName,
  children,
}: ScreenProps) => {
  const navigate = useNavigate();
  const scrollRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const barRef = useRef<HTMLElement>(null);
  const showLargeTitle = largeTitle && Boolean(title);
  const { scrolled, collapsed } = useNavBarState(scrollRef, showLargeTitle ? titleRef : undefined, barRef);
  useStatusTapScrollTop(scrollRef);

  const hasBar = Boolean(title) || Boolean(trailing) || !hideBack;
  const goBack = () => {
    void hapticTap();
    if (onBack) return onBack();
    if (window.history.length > 1) navigate(-1);
    else navigate("/");
  };

  return (
    <div className={cn("relative flex h-dvh flex-col bg-background text-foreground", className)}>
      {hasBar ? (
        <NavBar
          ref={barRef}
          className="absolute inset-x-0 top-0"
          title={title}
          titleVisible={showLargeTitle ? collapsed : true}
          titleAsHeading={!showLargeTitle}
          solid={showLargeTitle ? collapsed : scrolled}
          leading={
            hideBack ? null : (
              <button
                type="button"
                onClick={goBack}
                className="inline-flex h-11 items-center gap-0.5 pl-0.5 pr-2 text-primary transition-opacity active:opacity-60"
              >
                <ChevronLeft className="h-[22px] w-[22px]" strokeWidth={2.5} aria-hidden="true" />
                <span className="type-body">{backLabel}</span>
              </button>
            )
          }
          trailing={trailing}
        />
      ) : null}

      <div
        ref={scrollRef}
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain"
        style={{
          paddingTop: hasBar ? "calc(var(--nav-bar-height) + var(--safe-top, 0px))" : "var(--safe-top, 0px)",
          paddingLeft: "max(1rem, var(--safe-left, 0px))",
          paddingRight: "max(1rem, var(--safe-right, 0px))",
          paddingBottom: footer ? 0 : "max(1.5rem, var(--safe-bottom, 0px))",
        }}
      >
        <div
          className={cn(
            "mx-auto w-full",
            WIDTH[maxWidth],
            centered && "flex min-h-full flex-col justify-center",
            contentClassName,
          )}
        >
          {showLargeTitle ? (
            <h1 ref={titleRef} className="type-large-title pb-2 pt-1">
              {title}
            </h1>
          ) : null}
          {children}

          {/* El pie vive dentro del contenido, pegado con `sticky`: cuando la pantalla
              sobra queda a 12 px del último campo (antes se iba al fondo y dejaba un
              hueco de 200 px en escritorio), y cuando el contenido es largo se queda
              abajo, a mano del pulgar y por encima del teclado. */}
          {footer ? (
            <div
              className="sticky bottom-0 z-10 mt-3 bg-background/92 pt-2 backdrop-blur-sm"
              style={{ paddingBottom: "max(1rem, var(--safe-bottom, 0px))" }}
            >
              {footer}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};

export default Screen;
