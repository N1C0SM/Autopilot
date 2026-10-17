import { describe, expect, it } from 'vitest';
import master from './master.json';
import { needsFocusWarning, verifiedCompletion, findExistingIdea, filterRoadmapIdeas } from './rules';
describe('Roadmap y foco', () => {
  it('detecta ideas existentes aunque cambien acentos o puntuación sin confundir ideas distintas', () => {
    const items = [{ title: 'Nutrición básica', description: '', version_id: '1.0' }];
    expect(findExistingIdea(' NUTRICION básica! ', items)).toEqual(items[0]);
    expect(findExistingIdea('Nutrición avanzada', items)).toBeUndefined();
  });
  it('consulta todas las versiones o una concreta incluyendo ideas en hielo', () => {
    const items = [{ title: 'Rutinas', description: '', version_id: '1.0' }, { title: 'Widgets', description: '', version_id: '2.0' }, { title: 'Idea nueva', description: '', version_id: null }];
    expect(filterRoadmapIdeas(items, 'all', '')).toHaveLength(3);
    expect(filterRoadmapIdeas(items, '2.0', '')).toEqual([items[1]]);
    expect(filterRoadmapIdeas(items, 'ice', '')).toEqual([items[2]]);
    expect(filterRoadmapIdeas(items, 'all', 'rutinas')).toEqual([items[0]]);
  });
  it('mantiene las 40 versiones de 1.0 a 4.9', () => {
    expect(master.versions.map(v => v.id)).toEqual(Array.from({ length: 40 }, (_, i) => `${Math.floor(i / 10) + 1}.${i % 10}`));
  });
  it('avisa al comenzar trabajo fuera de la versión actual', () => {
    expect(needsFocusWarning('2.0', '1.0', 'in_progress')).toBe(true);
    expect(needsFocusWarning('1.0', '1.0', 'in_progress')).toBe(false);
    expect(needsFocusWarning('2.0', '1.0', 'pending')).toBe(false);
  });
  it('no tacha sin evidencia conocida', () => {
    expect(verifiedCompletion(null, { editor: 'PlanEditor' })).toBe('');
    expect(verifiedCompletion('inventado', { editor: 'PlanEditor' })).toBe('');
    expect(verifiedCompletion('editor', { editor: 'PlanEditor' })).toBe('PlanEditor');
  });
});