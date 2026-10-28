export type PhotoPose = "front" | "back" | "other";

export const photoPose = (note?: string | null): PhotoPose => {
  const n = (note || "").toLowerCase();
  if (/espalda|dorsal|back/.test(n)) return "back";
  if (/frente|pecho|front/.test(n)) return "front";
  return "other";
};

/** "12 semanas de evolución" entre dos fechas `YYYY-MM-DD`. */
export const evolutionLabel = (fromDate: string, toDate: string) => {
  const ms = Math.abs(new Date(toDate).getTime() - new Date(fromDate).getTime());
  const days = Math.round(ms / 86400000);
  if (days < 14) return `${days} ${days === 1 ? "día" : "días"} de evolución`;
  return `${Math.round(days / 7)} semanas de evolución`;
};
