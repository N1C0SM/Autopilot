import { supabase } from "@/integrations/supabase/client";
import { LEGAL_VERSION } from "@/content/legal";

export type ConsentType =
  | "terms"
  | "privacy"
  | "health_data"
  | "cookies_analytics"
  | "marketing";

/**
 * Registra un consentimiento en la tabla user_consents.
 * Llamar SIEMPRE que el usuario acepte o retire un consentimiento.
 */
export async function logConsent(
  type: ConsentType,
  granted: boolean,
  extra?: Record<string, unknown>
) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from("user_consents").insert({
      user_id: user.id,
      consent_type: type,
      granted,
      document_version: LEGAL_VERSION,
      user_agent: typeof navigator !== "undefined" ? navigator.userAgent : null,
      metadata: extra ?? null,
    });
  } catch (e) {
    // No bloqueamos la UX si falla el log.
    console.warn("[consents] no se pudo registrar consentimiento", e);
  }
}