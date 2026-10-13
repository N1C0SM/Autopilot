import { Lock } from "lucide-react";

export interface IosFeatureLockedProps {
  /** Nombre o descripción corta de la función. Encabeza el mensaje. */
  feature?: string;
  /** Clase extra para el contenedor (por si se incrusta en un layout específico). */
  className?: string;
}

/**
 * Mensaje neutro para funciones de pago en iOS v1 (reader app).
 *
 * App Store Review §3.1.3(a) permite informar al usuario de que existen
 * planes de pago, pero NO permite enlazar directamente a un checkout fuera
 * de la app. Este componente comunica la existencia del plan y menciona
 * `autopilotplan.com` como texto plano, sin link clicable.
 */
export const IosFeatureLocked = ({
  feature = "Esta función",
  className = "",
}: IosFeatureLockedProps) => (
  <div
    className={`mx-auto w-full max-w-md rounded-2xl border border-border bg-card p-6 text-center sm:p-8 ${className}`.trim()}
    data-ios-feature-locked
  >
    <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
      <Lock className="h-7 w-7 text-primary" aria-hidden="true" />
    </div>
    <h2 className="font-display text-xl font-bold">
      {feature} está disponible en los planes de pago.
    </h2>
    <p className="mt-3 text-sm text-muted-foreground">
      Visita <span className="font-medium text-foreground">autopilotplan.com</span>
      {" "}desde tu navegador para conocer las opciones.
    </p>
  </div>
);

export default IosFeatureLocked;
