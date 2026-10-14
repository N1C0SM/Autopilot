import { Lock } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";

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
  <div className={`mx-auto w-full max-w-md ${className}`.trim()} data-ios-feature-locked>
    <EmptyState
      icon={Lock}
      title={`${feature} está disponible en los planes de pago.`}
      description={
        <>
          Visita <span className="font-medium text-foreground">autopilotplan.com</span>
          {" "}desde tu navegador para conocer las opciones.
        </>
      }
    />
  </div>
);

export default IosFeatureLocked;
