export const LINKABLE_PROVIDERS = [
  { id: "google", label: "Google" },
  { id: "apple", label: "Apple" },
] as const;

/** Solo se desvincula si queda otro acceso (p. ej. correo con contraseña): nunca dejar la cuenta sin entrada. */
export function canUnlink(identities: { provider: string }[]): boolean {
  return identities.length > 1;
}
