import { type ReactNode } from "react";

import { isIOSNative } from "@/lib/platform";

export interface HideOnIOSProps {
  children: ReactNode;
  /** Contenido alternativo que se renderiza en iOS en lugar de `children`. */
  fallback?: ReactNode;
}

/**
 * Oculta `children` cuando la app corre como build iOS nativa.
 *
 * Pensado para envolver UI de upsell / pricing legacy en modo "reader app"
 * (App Store §3.1.3(a)). Para componentes nuevos preferir un guard interno
 * (`if (isIOSNative()) return null;`) y así evitar olvidos en call-sites.
 */
export const HideOnIOS = ({ children, fallback = null }: HideOnIOSProps) =>
  isIOSNative() ? <>{fallback}</> : <>{children}</>;

export default HideOnIOS;
