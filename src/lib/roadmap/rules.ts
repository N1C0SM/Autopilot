export type RoadmapStatus = 'idea' | 'pending' | 'in_progress' | 'done';
export const statusLabels: Record<RoadmapStatus, string> = { idea: 'Idea', pending: 'Pendiente', in_progress: 'En curso', done: 'Hecho' };
export function needsFocusWarning(version: string | null, current: string, status: string) {
  return status === 'in_progress' && version !== current;
}
export function verifiedCompletion(evidenceId: string | null, catalog: Record<string, string>) {
  return evidenceId && Object.prototype.hasOwnProperty.call(catalog, evidenceId) ? catalog[evidenceId] : '';
}