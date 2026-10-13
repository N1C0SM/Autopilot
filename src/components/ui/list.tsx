import * as React from "react";
import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { hapticTap } from "@/lib/native";

/**
 * Lista agrupada (el patrón de Ajustes de iOS).
 *
 *   <ListGroup header="Cuenta" footer="Texto de ayuda.">
 *     <ListRow title="Nombre" value="Nicolás" chevron onClick={...} />
 *     <ListRow icon={<Bell />} title="Avisos" trailing={<Switch ... />} />
 *     <ListRow title="Cerrar sesión" destructive onClick={...} />
 *   </ListGroup>
 *
 * Una fila que navega lleva `chevron`; una que cambia un valor lleva el control
 * en `trailing`. Nunca las dos cosas.
 */
interface ListGroupProps extends Omit<React.HTMLAttributes<HTMLElement>, "title"> {
  header?: React.ReactNode;
  footer?: React.ReactNode;
}

const ListGroup = ({ header, footer, className, children, ...props }: ListGroupProps) => (
  <section className={className} {...props}>
    {header ? <h2 className="type-group-header px-4 pb-1.5">{header}</h2> : null}
    <div className="overflow-hidden rounded-2xl bg-card">{children}</div>
    {footer ? <p className="px-4 pt-1.5 type-footnote text-muted-foreground">{footer}</p> : null}
  </section>
);

interface ListRowProps {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  /** Icono inicial (20 px, en el tinte de la app salvo que traiga su color). */
  icon?: React.ReactNode;
  /** Valor actual, en gris a la derecha. */
  value?: React.ReactNode;
  /** Control a la derecha (Switch, botón pequeño). Sus clics no activan la fila. */
  trailing?: React.ReactNode;
  chevron?: boolean;
  destructive?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  to?: string;
  href?: string;
  className?: string;
  "aria-label"?: string;
}

const ListRow = ({
  title,
  subtitle,
  icon,
  value,
  trailing,
  chevron,
  destructive,
  disabled,
  onClick,
  to,
  href,
  className,
  "aria-label": ariaLabel,
}: ListRowProps) => {
  const interactive = !disabled && Boolean(onClick || to || href);
  const rowClass = cn(
    "group/row relative flex min-h-[44px] w-full items-center gap-3 px-4 text-left",
    interactive && "transition-colors duration-100 active:bg-accent focus-visible:bg-accent focus-visible:outline-none",
    disabled && "opacity-40",
    className,
  );
  const body = (
    <>
      {icon ? (
        <span className="flex w-7 shrink-0 items-center justify-center text-primary [&_svg]:size-5">{icon}</span>
      ) : null}
      {/* El separador nace donde empieza el texto, no en el borde de la tarjeta. */}
      <span className="flex min-h-[44px] min-w-0 flex-1 items-center gap-3 py-[11px] group-[:not(:last-child)]/row:sep-b">
        <span className="min-w-0 flex-1">
          <span className={cn("block type-body", !subtitle && "truncate", destructive && "text-destructive")}>
            {title}
          </span>
          {subtitle ? <span className="mt-0.5 block type-footnote text-muted-foreground">{subtitle}</span> : null}
        </span>
        {value ? <span className="max-w-[55%] shrink-0 truncate type-body text-muted-foreground">{value}</span> : null}
        {trailing ? (
          // Clics y teclas del control no deben llegar a la fila.
          <span
            className="flex shrink-0 items-center"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
          >
            {trailing}
          </span>
        ) : null}
        {chevron ? (
          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/60" strokeWidth={2.5} aria-hidden="true" />
        ) : null}
      </span>
    </>
  );

  if (!interactive) {
    return (
      <div className={rowClass} aria-label={ariaLabel} aria-disabled={disabled || undefined}>
        {body}
      </div>
    );
  }
  const activate = () => {
    void hapticTap();
    onClick?.();
  };
  if (to) {
    return (
      <Link to={to} className={rowClass} aria-label={ariaLabel} onClick={activate}>
        {body}
      </Link>
    );
  }
  if (href) {
    const external = /^https?:/i.test(href);
    return (
      <a
        href={href}
        className={rowClass}
        aria-label={ariaLabel}
        onClick={activate}
        {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
      >
        {body}
      </a>
    );
  }
  // Con un control dentro la fila no puede ser <button> (no admite interactivos anidados).
  if (trailing) {
    return (
      <div
        role="button"
        tabIndex={0}
        className={rowClass}
        aria-label={ariaLabel}
        onClick={activate}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            activate();
          }
        }}
      >
        {body}
      </div>
    );
  }
  return (
    <button type="button" className={rowClass} aria-label={ariaLabel} onClick={activate}>
      {body}
    </button>
  );
};

export { ListGroup, ListRow };
