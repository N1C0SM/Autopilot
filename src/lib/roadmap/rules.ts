export type RoadmapStatus = 'idea' | 'pending' | 'in_progress' | 'done';
export const statusLabels: Record<RoadmapStatus, string> = { idea: 'Idea', pending: 'Pendiente', in_progress: 'En curso', done: 'Hecho' };
export function needsFocusWarning(version: string | null, current: string, status: string) {
  return status === 'in_progress' && version !== current;
}
export function verifiedCompletion(evidenceId: string | null, catalog: Record<string, string>) {
  return evidenceId && Object.prototype.hasOwnProperty.call(catalog, evidenceId) ? catalog[evidenceId] : '';
}
export function normalizeIdea(title: string) {
  return title.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es').replace(/[^a-z0-9]+/g, ' ').trim();
}
export function findExistingIdea<T extends { title: string }>(title: string, items: T[]) {
  const normalized = normalizeIdea(title);
  return normalized ? items.find(item => normalizeIdea(item.title) === normalized) : undefined;
}
export function filterRoadmapIdeas<T extends { title: string; description: string; version_id: string | null }>(items: T[], version: string, query: string) {
  return items.filter(item => (version === 'all' || (version === 'ice' ? item.version_id === null : item.version_id === version)) && normalizeIdea(`${item.title} ${item.description}`).includes(normalizeIdea(query)));
}