/**
 * Superseries de la sesión: enlazan un ejercicio con el SIGUIENTE de la lista
 * para hacerlos seguidos sin descansar entre ellos.
 *
 * El enlace vive solo en memoria: no se guarda en `workout_logs` ni en ningún
 * otro sitio. Si se recarga la página, desaparece. Es deliberado.
 */
export type SupersetLinks = Record<string, boolean>;

/** Enlaza el ejercicio con el siguiente o lo desenlaza si ya estaba enlazado. */
export function toggleSupersetLink(links: SupersetLinks, exerciseName: string): SupersetLinks {
  const next = { ...links };
  if (next[exerciseName]) delete next[exerciseName];
  else next[exerciseName] = true;
  return next;
}

/**
 * Cadena completa (índices contiguos) a la que pertenece `index`. Un ejercicio
 * entra en la cadena si el anterior está enlazado con él o él lo está con el
 * siguiente, así que A→B→C devuelve los tres índices desde cualquiera de ellos.
 */
export function getSupersetChain(names: string[], links: SupersetLinks, index: number): number[] {
  if (index < 0 || index >= names.length) return [];

  let start = index;
  while (start > 0 && links[names[start - 1]]) start -= 1;

  let end = index;
  while (end < names.length - 1 && links[names[end]]) end += 1;

  return Array.from({ length: end - start + 1 }, (_, offset) => start + offset);
}

/**
 * Siguiente ejercicio de la cadena con series pendientes, saltando los que ya
 * terminaron (series desiguales). Devuelve null cuando no queda ninguno: en ese
 * momento el descanso arranca como siempre.
 */
export function getNextSupersetWork(
  names: string[],
  links: SupersetLinks,
  index: number,
  hasPendingSets: (index: number) => boolean,
): number | null {
  for (const candidate of getSupersetChain(names, links, index)) {
    if (candidate > index && hasPendingSets(candidate)) return candidate;
  }
  return null;
}
