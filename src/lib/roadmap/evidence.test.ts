import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { codeEvidence, reconcile, evidenceLabel } from './evidence';
import { capabilities } from '../../../supabase/functions/roadmap-ai/capabilities';

describe('Evidencia del Roadmap', () => {
  it.each(codeEvidence.flatMap(e => [...e.files, ...e.tests].map(f => [e.title, f])))('%s: existe %s', (_t, file) => {
    expect(existsSync(file)).toBe(true);
  });
  it('la IA usa exactamente el mismo catálogo', () => {
    expect(capabilities.map(c => c.title)).toEqual(codeEvidence.map(e => e.title));
  });
  it('marca Hecho lo verificado y revierte un Hecho de código sin prueba', () => {
    const ev = codeEvidence.find(e => e.title === 'Nutrición básica')!;
    expect(reconcile([
      { id: '1', title: 'Nutrición básica', status: 'idea', evidence: '' },
      { id: '2', title: 'Visión por IA', status: 'done', evidence: 'Verificado en código · antiguo' },
      { id: '3', title: 'Estabilidad', status: 'idea', evidence: '' },
    ])).toEqual([{ id: '1', status: 'done', evidence: evidenceLabel(ev) }, { id: '2', status: 'pending', evidence: '' }]);
  });
});
