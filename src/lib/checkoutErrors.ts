/**
 * Traduce los fallos de `supabase.functions.invoke("create-checkout")` a un
 * mensaje en español accionable para la persona que intenta pagar.
 *
 * `invoke` devuelve `{ data }` en respuestas 2xx y lanza un `FunctionsHttpError`
 * en el resto: el `code` que envía la edge function (no_price, free_campaign,
 * unknown_plan…) viaja en el cuerpo del error, no en `data`. Por eso la función
 * es asíncrona y lee también `error.context`, sin depender de que exista `data`.
 */
import { errorMessage, errorStatus, jsonObject } from "@/lib/runtimeValues";

export type CheckoutErrorCode =
  | "no_price"
  | "free_campaign"
  | "unknown_plan"
  | "rate_limited"
  | "session"
  | "network"
  | "unavailable"
  | "unknown";

export interface CheckoutIssue {
  code: CheckoutErrorCode;
  /** Mensaje listo para mostrar en un toast o banner. */
  message: string;
  /** true si reintentar la compra tal cual puede funcionar (red, límite temporal, caída). */
  retryable: boolean;
}

const ISSUES: Record<CheckoutErrorCode, Omit<CheckoutIssue, "code">> = {
  no_price: {
    message: "El pago de este plan aún no está configurado. Escríbenos por el chat y lo activamos.",
    retryable: false,
  },
  free_campaign: {
    message: "Las compras están desactivadas durante la campaña gratuita. Mientras dure, tienes acceso gratis: recarga la página si no lo ves.",
    retryable: false,
  },
  unknown_plan: {
    message: "Ese plan ya no está disponible. Vuelve a la pantalla de planes, elige otro y prueba de nuevo.",
    retryable: false,
  },
  rate_limited: {
    message: "Has hecho demasiados intentos seguidos. Espera un minuto y vuelve a intentarlo.",
    retryable: true,
  },
  session: {
    message: "Tu sesión ha caducado. Vuelve a iniciar sesión y prueba de nuevo.",
    retryable: false,
  },
  network: {
    message: "No hemos podido conectar con el servicio de pago. Revisa tu conexión y vuelve a intentarlo.",
    retryable: true,
  },
  unavailable: {
    message: "El servicio de pago no está disponible ahora mismo. Inténtalo de nuevo en unos minutos.",
    retryable: true,
  },
  unknown: {
    message: "No se pudo iniciar el pago. Inténtalo de nuevo y, si sigue fallando, escríbenos por el chat.",
    retryable: false,
  },
};

const KNOWN_CODES: readonly CheckoutErrorCode[] = [
  "no_price",
  "free_campaign",
  "unknown_plan",
  "rate_limited",
  "session",
  "network",
  "unavailable",
];

const asKnownCode = (value: unknown): CheckoutErrorCode | null => {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase().replace(/[\s-]+/g, "_");
  return (KNOWN_CODES as readonly string[]).includes(normalized)
    ? (normalized as CheckoutErrorCode)
    : null;
};

/** `code` es el campo canónico; `error` se acepta por si la función responde con el código ahí. */
const codeFromBody = (body: unknown): CheckoutErrorCode | null => {
  const record = jsonObject(body);
  return asKnownCode(record.code) ?? asKnownCode(record.error);
};

/** Cuerpo JSON del error HTTP de `functions.invoke` (los fallos no traen `data`). */
const readFailureBody = async (error: unknown): Promise<Record<string, unknown>> => {
  if (typeof Response === "undefined" || error === null || typeof error !== "object" || !("context" in error)) return {};
  const context = (error as { context?: unknown }).context;
  if (!(context instanceof Response)) return {};
  try {
    // clone(): el cuerpo real sigue disponible por si otro código quiere leerlo.
    return jsonObject(await context.clone().json());
  } catch {
    return {};
  }
};

const looksLikeNetworkFailure = (error: unknown): boolean => {
  const name = error !== null && typeof error === "object" && "name" in error ? String(error.name) : "";
  const text = `${name} ${errorMessage(error)}`;
  return /fetch|network|load failed|timeout|timed out|abort/i.test(text);
};

/**
 * Describe el fallo de create-checkout. `data` es opcional porque en un error
 * HTTP `invoke` devuelve `data: null`; se acepta por si el llamador ya obtuvo
 * un 2xx con un `code` inesperado.
 */
export async function describeCheckoutError(error: unknown, data?: unknown): Promise<CheckoutIssue> {
  const body = error ? await readFailureBody(error) : {};
  const status = errorStatus(error);

  const code =
    codeFromBody(data) ??
    codeFromBody(body) ??
    asKnownCode(error instanceof Error ? error.message : undefined) ??
    (status === 429 ? "rate_limited" : null) ??
    (status === 401 ? "session" : null) ??
    (typeof status === "number" && status >= 500 ? "unavailable" : null) ??
    (looksLikeNetworkFailure(error) ? "network" : null) ??
    "unknown";

  return { code, ...ISSUES[code] };
}

/** Atajo para el caso habitual en la interfaz: `toast.error(await checkoutErrorMessage(error, data))`. */
export async function checkoutErrorMessage(error: unknown, data?: unknown): Promise<string> {
  return (await describeCheckoutError(error, data)).message;
}
