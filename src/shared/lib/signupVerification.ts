/**
 * Contexto compartido del alta con código de verificación.
 *
 * El usuario ya no tiene que abrir el enlace del correo para activar la cuenta:
 * introduce el código completo en la app. Eso mantiene la pestaña (y con
 * ella el `sessionStorage`: plan elegido, contexto del scan, quiz) y evita el
 * caso en el que el correo se abre en otro navegador/dispositivo.
 *
 * El enlace del correo sigue existiendo como alternativa y lo canjea
 * `/auth/callback` en web o `NativeDeepLinks` en la app nativa.
 */

export const VERIFY_STORAGE_KEY = "autopilot_verify";
export const SIGNUP_EMAIL_STORAGE_KEY = "autopilot_signup_email";
export const VERIFY_TTL_MS = 24 * 60 * 60 * 1000;

export type VerifySource = "signup" | "login";

export interface VerifyContext {
  email: string;
  /** Destino interno tras verificar (ya saneado). */
  next: string;
  fromScan: boolean;
  /** De dónde llega el usuario: el alta o el error de login. */
  source: VerifySource;
  createdAt: number;
}

/** Solo rutas internas: evita redirigir a otro dominio desde el enlace del correo. */
export function safeNextPath(raw: string | null | undefined, fallback: string): string {
  if (!raw) return fallback;
  let value = raw;
  try {
    value = decodeURIComponent(value);
  } catch {
    /* ya venía decodificado */
  }
  if (!value.startsWith("/") || value.startsWith("//")) return fallback;
  return value;
}

/**
 * Destino tras verificar el email. Mantiene la prioridad histórica del alta:
 * `next` explícito → vuelta al scan → elección de onboarding.
 */
export function postVerificationPath(nextParam: string | null, fromScan: boolean): string {
  if (nextParam) return safeNextPath(nextParam, "/onboarding-choice");
  if (fromScan) return "/scan?from=signup";
  return "/onboarding-choice";
}

/**
 * Destino final tras canjear el código. Si la pestaña conserva un borrador del
 * cuestionario, se vuelve al configurador con `guardar=1` para que lo guarde
 * solo y entre directo al plan, sin reenseñar el último paso.
 */
export function postVerifyDestination(next: string, hasQuizDraft: boolean): string {
  return hasQuizDraft ? "/onboarding?guardar=1" : next;
}

function storage(): Storage | null {
  try {
    return sessionStorage;
  } catch {
    return null;
  }
}

export function saveVerifyContext(input: {
  email: string;
  next: string;
  fromScan: boolean;
  source?: VerifySource;
}): void {
  const target = storage();
  if (!target) return;
  try {
    const context: VerifyContext = {
      ...input,
      email: input.email.trim(),
      source: input.source ?? "signup",
      createdAt: Date.now(),
    };
    target.setItem(VERIFY_STORAGE_KEY, JSON.stringify(context));
  } catch {
    /* best-effort: si no hay storage, el enlace del correo sigue funcionando */
  }
}

export function readVerifyContext(now: number = Date.now()): VerifyContext | null {
  const target = storage();
  if (!target) return null;
  try {
    const raw = target.getItem(VERIFY_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<VerifyContext>;
    const valid =
      typeof parsed.email === "string" &&
      parsed.email.length > 0 &&
      typeof parsed.next === "string" &&
      parsed.next.startsWith("/") &&
      !parsed.next.startsWith("//") &&
      typeof parsed.createdAt === "number";
    if (!valid) {
      target.removeItem(VERIFY_STORAGE_KEY);
      return null;
    }
    if (now - (parsed.createdAt as number) > VERIFY_TTL_MS) {
      target.removeItem(VERIFY_STORAGE_KEY);
      return null;
    }
    return {
      email: parsed.email as string,
      next: parsed.next as string,
      fromScan: parsed.fromScan === true,
      source: parsed.source === "login" ? "login" : "signup",
      createdAt: parsed.createdAt as number,
    };
  } catch {
    return null;
  }
}

export function clearVerifyContext(): void {
  try {
    storage()?.removeItem(VERIFY_STORAGE_KEY);
  } catch {
    /* noop */
  }
}

/**
 * Email del último alta enviada, para poder volver a `/signup` con el campo
 * relleno si el usuario pulsa «Corregir mi correo» en la pantalla del código.
 */
export function saveSignupEmail(email: string): void {
  const target = storage();
  if (!target) return;
  try {
    target.setItem(SIGNUP_EMAIL_STORAGE_KEY, email.trim());
  } catch {
    /* noop */
  }
}

export function readSignupEmail(): string | null {
  try {
    const value = storage()?.getItem(SIGNUP_EMAIL_STORAGE_KEY)?.trim();
    return value || null;
  } catch {
    return null;
  }
}

export function clearSignupEmail(): void {
  try {
    storage()?.removeItem(SIGNUP_EMAIL_STORAGE_KEY);
  } catch {
    /* noop */
  }
}
