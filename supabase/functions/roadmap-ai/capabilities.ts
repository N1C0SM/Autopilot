// Debe coincidir con src/lib/roadmap/evidence.ts (lo comprueba evidence.test.ts).
// El código no prueba publicación en tiendas ni cobros reales.
export const capabilities = [
  { title: 'Rutinas personalizadas', evidence: 'Verificado en código · Editor semanal por grupos musculares' },
  { title: 'Seguimiento en sala', evidence: 'Verificado en código · Registro de series, repeticiones, carga y RPE' },
  { title: 'Sobrecarga progresiva', evidence: 'Verificado en código · Propone subir peso, añadir rep, mantener o repetir' },
  { title: 'Scan Corporal (V1)', evidence: 'Verificado en código · Foto opcional y estimación orientativa' },
  { title: 'Nutrición básica', evidence: 'Verificado en código · Calorías de mantenimiento y objetivo, proteína diaria' },
  { title: 'Sustitución inteligente', evidence: 'Verificado en código · Alternativas por músculo y disciplina' },
];
export function evidenceFor(title: string) {
  return capabilities.find(c => c.title.toLocaleLowerCase('es').trim() === title.toLocaleLowerCase('es').trim())?.evidence ?? '';
}
