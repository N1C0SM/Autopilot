const SHORT_MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sept", "oct", "nov", "dic"];

/**
 * Hace cuánto llegó un aviso, corto y legible (también para VoiceOver): «Ahora», «5 min», «3 h»,
 * «2 d» y, pasada una semana, la fecha («12 nov», con el año si no es este). Nunca «0m».
 * Es `NoticesRepo.ago` en la app nativa.
 */
export function noticeAgo(iso: string, now: Date = new Date()): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const mins = Math.max(0, Math.floor((now.getTime() - date.getTime()) / 60000));
  if (mins < 1) return "Ahora";
  if (mins < 60) return `${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} d`;
  const day = `${date.getDate()} ${SHORT_MONTHS[date.getMonth()]}`;
  return date.getFullYear() === now.getFullYear() ? day : `${day} ${date.getFullYear()}`;
}
