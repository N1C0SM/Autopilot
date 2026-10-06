import * as React from "react";
import { cn } from "@/lib/utils";

export type StatusTone = "neutral" | "accent" | "danger" | "success";

const TONE: Record<StatusTone, string> = {
  neutral: "bg-secondary text-muted-foreground",
  accent: "bg-primary/15 text-primary",
  danger: "bg-destructive/15 text-destructive",
  success: "bg-primary/15 text-primary",
};

export interface StatusBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone?: StatusTone;
}

/** Único badge de estado de la app. Sin emoji, sin colores fuera de token. */
const StatusBadge = ({ tone = "neutral", className, ...props }: StatusBadgeProps) => (
  <span
    className={cn(
      "inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-xs font-semibold",
      TONE[tone],
      className,
    )}
    {...props}
  />
);

const planTone = (planStatus: string, traveling: boolean): { label: string; tone: StatusTone } => {
  if (traveling) return { label: "En viaje", tone: "accent" };
  if (planStatus === "plan_ready") return { label: "Plan listo", tone: "success" };
  if (planStatus === "plan_pending") return { label: "Pendiente", tone: "accent" };
  return { label: "Onboarding", tone: "neutral" };
};

interface PlanStatusBadgeProps extends Omit<StatusBadgeProps, "children" | "tone"> {
  planStatus: string;
  traveling?: boolean;
}

/**
 * Lectura única del estado de plan: el badge significa lo mismo
 * en el panel de admin, en el listado y en la vista del entrenador.
 */
const PlanStatusBadge = ({ planStatus, traveling = false, ...props }: PlanStatusBadgeProps) => {
  const { label, tone } = planTone(planStatus, traveling);
  return (
    <StatusBadge tone={tone} {...props}>
      {label}
    </StatusBadge>
  );
};

interface PaymentDotProps extends React.HTMLAttributes<HTMLSpanElement> {
  status: string;
}

/** Punto de estado de pago: único indicador de cobro en las listas. */
const PaymentDot = ({ status, className, ...props }: PaymentDotProps) => {
  const unpaid = status === "unpaid";
  const label = unpaid ? "Sin pagar" : "Pagado";
  return (
    <span
      role="img"
      aria-label={label}
      title={label}
      className={cn(
        "h-2 w-2 shrink-0 rounded-full",
        unpaid ? "bg-destructive" : "bg-primary/40",
        className,
      )}
      {...props}
    />
  );
};

export { StatusBadge, PlanStatusBadge, PaymentDot };
