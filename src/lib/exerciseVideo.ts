export function exerciseVideoSearchUrl(name: string, muscleGroup?: string | null): string {
  const query = [name, muscleGroup, "técnica correcta ejercicio"].filter(Boolean).join(" ");
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
}
