import { Lock } from "lucide-react";
import { EmptyState } from "@/shared/components/ui/empty-state";

export interface IosFeatureLockedProps {
  /** Nombre o descripción corta de la función. Encabeza el mensaje. */
  feature?: string;
  /** Clase extra para el contenedor (por si se incrusta en un layout específico). */
  className?: string;
}

/**
 * Mensaje para funciones que en iOS no están disponibles.
 *
 * App Store §3.1.1 prohíbe dirigir al usuario a comprar fuera de la app, y
 * §3.1.3(a) no cubre fitness. Por eso el texto es puramente informativo:
 * explica que la función forma parte de un plan de pago, sin nombrar dominios,
 * sin verbos de acción y sin ningún enlace. No es una "reader app": es una
 * función no incluida en la versión gratuita.
 */
export const IosFeatureLocked = ({
  feature = "Esta función",
  className = "",
}: IosFeatureLockedProps) => (
  <div className={`mx-auto w-full max-w-md ${className}`.trim()} data-ios-feature-locked>
    <EmptyState
      icon={Lock}
      title={`${feature} forma parte de los planes de pago.`}
      description="Sigue disponible tu plan gratuito, tu registro de entrenamiento y tu progreso."
    />
  </div>
);

export default IosFeatureLocked;
