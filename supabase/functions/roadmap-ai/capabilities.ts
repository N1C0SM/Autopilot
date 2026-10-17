// Deliberately narrow: code evidence is not proof of store publication or live payments.
export const capabilities = [
  { title: 'Rutinas personalizadas', evidence: 'src/components/dashboard/PlanEditor.tsx · creación y edición semanal por grupos musculares.' },
  { title: 'Seguimiento en sala', evidence: 'src/components/dashboard/WorkoutTracker.tsx · series, repeticiones, carga y RPE.' },
  { title: 'Scan Corporal (V1)', evidence: 'src/pages/Scan.tsx · fotografía opcional y estimación orientativa.' },
  { title: 'Sustitución inteligente', evidence: 'src/components/dashboard/ExerciseSwap.tsx · sustituciones por músculo y disciplina.' },
];
export function evidenceFor(title: string) {
  return capabilities.find(c => c.title.toLocaleLowerCase('es').trim() === title.toLocaleLowerCase('es').trim())?.evidence ?? '';
}