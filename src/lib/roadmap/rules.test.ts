import { describe, expect, it } from 'vitest';
import master from './master.json';
import { needsFocusWarning, verifiedCompletion } from './rules';
describe('Roadmap y foco', () => {
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