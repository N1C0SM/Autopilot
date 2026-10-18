// Única fuente de "Hecho verificado". Cada entrada apunta a código y tests reales;
// evidence.test.ts falla si algún archivo desaparece, así el Roadmap no puede mentir.
export interface CodeEvidence { title: string; summary: string; files: string[]; tests: string[] }

export const codeEvidence: CodeEvidence[] = [
  { title: 'Rutinas personalizadas', summary: 'Editor semanal por grupos musculares', files: ['src/components/dashboard/PlanEditor.tsx'], tests: ['src/lib/planShield.test.ts'] },
  { title: 'Seguimiento en sala', summary: 'Registro de series, repeticiones, carga y RPE', files: ['src/components/dashboard/WorkoutTracker.tsx'], tests: ['src/lib/workoutSet.test.ts'] },
  { title: 'Sobrecarga progresiva', summary: 'Propone subir peso, añadir rep, mantener o repetir', files: ['src/lib/workoutProgression.ts', 'src/components/dashboard/WorkoutTracker.tsx'], tests: ['src/lib/workoutProgression.test.ts'] },
  { title: 'Scan Corporal (V1)', summary: 'Foto opcional y estimación orientativa', files: ['supabase/functions/analyze-physique/index.ts'], tests: ['src/lib/scanApply.test.ts'] },
  { title: 'Nutrición básica', summary: 'Calorías de mantenimiento y objetivo, proteína diaria', files: ['src/lib/nutrition.ts', 'supabase/functions/_shared/nutrition.ts'], tests: ['src/lib/nutrition.test.ts'] },
  { title: 'Sustitución inteligente', summary: 'Alternativas por músculo y disciplina', files: ['src/components/dashboard/ExerciseSwap.tsx'], tests: [] },
];

// Tareas que el código no puede demostrar (tiendas, cobros reales, dispositivos).
export const needsRealWorldProof = ['Estabilidad', 'Monetización'];

const key = (t: string) => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
export function evidenceLabel(e: CodeEvidence) {
  return `Verificado en código · ${e.summary} (${[...e.files, ...e.tests].join(', ')})`;
}
export function findEvidence(title: string) { return codeEvidence.find(e => key(e.title) === key(title)); }
export function isCodeVerified(evidence: string) { return evidence.startsWith('Verificado en código'); }

/** Cambios necesarios para que el Roadmap refleje la realidad del código. */
export function reconcile<T extends { id: string; title: string; status: string; evidence: string }>(items: T[]) {
  const patches: { id: string; status: string; evidence: string }[] = [];
  for (const item of items) {
    const ev = findEvidence(item.title);
    if (ev) {
      const label = evidenceLabel(ev);
      if (item.status !== 'done' || item.evidence !== label) patches.push({ id: item.id, status: 'done', evidence: label });
    } else if (item.status === 'done' && isCodeVerified(item.evidence)) {
      // La prueba de código ya no existe: deja de afirmarse como hecho.
      patches.push({ id: item.id, status: 'pending', evidence: '' });
    }
  }
  return patches;
}
