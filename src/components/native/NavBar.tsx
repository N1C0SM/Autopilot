import { forwardRef, type ReactNode } from "react";
import { cn } from "@/lib/utils";

interface NavBarProps {
  title?: ReactNode;
  /** Segunda línea bajo el título (12 pt, gris): "3 de 18 series". */
  subtitle?: ReactNode;
  /** El título pequeño solo se ve cuando no hay título grande a la vista. */
  titleVisible?: boolean;
  /** Con contenido debajo: material translúcido y línea inferior. */
  solid?: boolean;
  /** El título pequeño es el encabezado de la pantalla (no hay título grande). */
  titleAsHeading?: boolean;
  leading?: ReactNode;
  trailing?: ReactNode;
  className?: string;
}

/**
 * Barra de navegación de iOS: 44 pt bajo la barra de estado, título centrado de
 * 17 pt, transparente arriba del todo y con material cuando el contenido pasa por debajo.
 */
const NavBar = forwardRef<HTMLElement, NavBarProps>(
  ({ title, subtitle, titleVisible = true, solid = true, titleAsHeading = true, leading, trailing, className }, ref) => {
    const Title = titleAsHeading ? "h1" : "div";
    return (
      <header
        ref={ref}
        className={cn(
          "z-40 border-b-[0.5px] transition-[background-color,border-color] duration-200",
          solid ? "app-chrome" : "border-transparent bg-transparent",
          className,
        )}
        style={{
          paddingTop: "var(--safe-top, 0px)",
          paddingLeft: "var(--safe-left, 0px)",
          paddingRight: "var(--safe-right, 0px)",
        }}
      >
        <div className="relative flex h-11 items-center justify-between px-2">
          <div className="relative z-10 flex min-w-0 items-center">{leading}</div>
          {title ? (
            <Title
              aria-hidden={titleVisible ? undefined : true}
              className={cn(
                "pointer-events-none absolute inset-x-0 mx-auto max-w-[60%] truncate text-center type-headline transition-opacity duration-200",
                titleVisible ? "opacity-100" : "opacity-0",
              )}
            >
              {subtitle ? (
                <>
                  <span className="block truncate">{title}</span>
                  <span className="block truncate type-caption1 font-normal text-muted-foreground">{subtitle}</span>
                </>
              ) : (
                title
              )}
            </Title>
          ) : null}
          <div className="relative z-10 flex min-w-0 items-center gap-0.5">{trailing}</div>
        </div>
      </header>
    );
  },
);
NavBar.displayName = "NavBar";

export default NavBar;
