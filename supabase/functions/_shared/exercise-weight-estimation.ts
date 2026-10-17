/**
 * Estima pesos iniciales para ejercicios basándose en:
 * 1. PRIORIDAD: Datos del scan (masa magra, composición corporal)
 * 2. FALLBACK: Estimación genérica basada en peso corporal del onboarding
 */

interface ScanData {
  lean_mass_kg?: number | null;
  weight_kg?: number | null;
  body_fat_pct?: number | null;
}

interface UserData {
  weight?: string | null; // del onboarding
  gender?: string | null;
}

/**
 * Coeficientes de carga por ejercicio (% de peso corporal o masa magra)
 * Estos valores son conservadores para principiantes/intermedios
 */
const EXERCISE_COEFFICIENTS: Record<string, {
  /** Coeficiente basado en masa magra (más preciso con scan) */
  leanMass: number;
  /** Coeficiente basado en peso corporal total (fallback) */
  bodyWeight: number;
  /** Si el ejercicio es bilateral o unilateral */
  bilateral: boolean;
}> = {
  // Pecho
  "Press banca": { leanMass: 0.65, bodyWeight: 0.50, bilateral: true },
  "Press banca inclinado": { leanMass: 0.55, bodyWeight: 0.42, bilateral: true },
  "Press con mancuernas": { leanMass: 0.30, bodyWeight: 0.23, bilateral: false },
  "Aperturas con mancuernas": { leanMass: 0.18, bodyWeight: 0.14, bilateral: false },
  "Fondos en paralelas": { leanMass: 0.70, bodyWeight: 0.55, bilateral: true },
  
  // Espalda
  "Peso muerto": { leanMass: 1.00, bodyWeight: 0.75, bilateral: true },
  "Remo con barra": { leanMass: 0.55, bodyWeight: 0.42, bilateral: true },
  "Remo con mancuerna": { leanMass: 0.28, bodyWeight: 0.22, bilateral: false },
  "Dominadas": { leanMass: 0.85, bodyWeight: 0.70, bilateral: true },
  "Jalones al pecho": { leanMass: 0.60, bodyWeight: 0.45, bilateral: true },
  "Pull-over": { leanMass: 0.25, bodyWeight: 0.19, bilateral: false },
  
  // Hombros
  "Press militar": { leanMass: 0.45, bodyWeight: 0.35, bilateral: true },
  "Press con mancuernas": { leanMass: 0.23, bodyWeight: 0.18, bilateral: false },
  "Elevaciones laterales": { leanMass: 0.10, bodyWeight: 0.08, bilateral: false },
  "Elevaciones frontales": { leanMass: 0.10, bodyWeight: 0.08, bilateral: false },
  "Pájaros": { leanMass: 0.08, bodyWeight: 0.06, bilateral: false },
  "Face pulls": { leanMass: 0.18, bodyWeight: 0.14, bilateral: true },
  
  // Piernas
  "Sentadilla": { leanMass: 0.90, bodyWeight: 0.70, bilateral: true },
  "Sentadilla frontal": { leanMass: 0.70, bodyWeight: 0.55, bilateral: true },
  "Prensa": { leanMass: 1.40, bodyWeight: 1.10, bilateral: true },
  "Zancadas": { leanMass: 0.25, bodyWeight: 0.20, bilateral: false },
  "Peso muerto rumano": { leanMass: 0.70, bodyWeight: 0.55, bilateral: true },
  "Curl femoral": { leanMass: 0.35, bodyWeight: 0.27, bilateral: true },
  "Extensión de cuádriceps": { leanMass: 0.40, bodyWeight: 0.31, bilateral: true },
  "Elevación de gemelos": { leanMass: 0.60, bodyWeight: 0.47, bilateral: true },
  
  // Brazos
  "Curl con barra": { leanMass: 0.25, bodyWeight: 0.19, bilateral: true },
  "Curl con mancuernas": { leanMass: 0.13, bodyWeight: 0.10, bilateral: false },
  "Curl martillo": { leanMass: 0.15, bodyWeight: 0.12, bilateral: false },
  "Press francés": { leanMass: 0.20, bodyWeight: 0.15, bilateral: true },
  "Extensiones de tríceps": { leanMass: 0.10, bodyWeight: 0.08, bilateral: false },
  "Fondos para tríceps": { leanMass: 0.70, bodyWeight: 0.55, bilateral: true },
};

/**
 * Encuentra el coeficiente más apropiado para un ejercicio dado su nombre
 */
function findExerciseCoefficient(exerciseName: string): typeof EXERCISE_COEFFICIENTS[string] | null {
  const normalized = exerciseName.toLowerCase();
  
  // Búsqueda exacta primero
  for (const [key, value] of Object.entries(EXERCISE_COEFFICIENTS)) {
    if (key.toLowerCase() === normalized) {
      return value;
    }
  }
  
  // Búsqueda por coincidencia parcial
  for (const [key, value] of Object.entries(EXERCISE_COEFFICIENTS)) {
    const keyLower = key.toLowerCase();
    if (normalized.includes(keyLower) || keyLower.includes(normalized)) {
      return value;
    }
  }
  
  // Si no encontramos nada específico, devolver null
  return null;
}

/**
 * Redondea el peso al incremento más cercano disponible en el gimnasio
 * (discos típicos: 1.25kg, 2.5kg, 5kg, 10kg, 15kg, 20kg)
 */
function roundToGymWeight(weight: number): number {
  if (weight < 2.5) return 0; // Muy ligero = sin carga externa
  if (weight < 10) return Math.round(weight * 2) / 2; // Redondear a 0.5kg
  if (weight < 20) return Math.round(weight / 2.5) * 2.5; // Redondear a 2.5kg
  if (weight < 50) return Math.round(weight / 5) * 5; // Redondear a 5kg
  return Math.round(weight / 10) * 10; // Redondear a 10kg
}

/**
 * Estima el peso inicial para un ejercicio
 * PRIORIZA datos del scan si están disponibles
 */
export function estimateExerciseWeight(
  exerciseName: string,
  scanData: ScanData | null | undefined,
  userData: UserData | null | undefined,
): string {
  const coefficient = findExerciseCoefficient(exerciseName);
  
  // Si no tenemos coeficiente para este ejercicio, devolver vacío
  if (!coefficient) {
    return "";
  }
  
  // PRIORIDAD 1: Usar masa magra del scan si está disponible
  if (scanData?.lean_mass_kg && scanData.lean_mass_kg > 0) {
    const estimatedWeight = scanData.lean_mass_kg * coefficient.leanMass;
    const rounded = roundToGymWeight(estimatedWeight);
    console.log(`[WEIGHT-EST] ${exerciseName}: ${rounded}kg (from scan lean mass ${scanData.lean_mass_kg}kg)`);
    return rounded > 0 ? String(rounded) : "";
  }
  
  // PRIORIDAD 2: Usar peso corporal del scan si está disponible
  if (scanData?.weight_kg && scanData.weight_kg > 0) {
    const estimatedWeight = scanData.weight_kg * coefficient.bodyWeight;
    const rounded = roundToGymWeight(estimatedWeight);
    console.log(`[WEIGHT-EST] ${exerciseName}: ${rounded}kg (from scan weight ${scanData.weight_kg}kg)`);
    return rounded > 0 ? String(rounded) : "";
  }
  
  // FALLBACK: Usar peso corporal del onboarding
  if (userData?.weight) {
    // El peso llega como número desde la base de datos o como texto ("84 kg").
    const weightMatch = String(userData.weight).match(/(\d+(?:[.,]\d+)?)/);
    if (weightMatch) {
      const bodyWeight = parseFloat(weightMatch[1].replace(",", "."));
      if (bodyWeight > 0) {
        const estimatedWeight = bodyWeight * coefficient.bodyWeight;
        const rounded = roundToGymWeight(estimatedWeight);
        console.log(`[WEIGHT-EST] ${exerciseName}: ${rounded}kg (from onboarding weight ${bodyWeight}kg)`);
        return rounded > 0 ? String(rounded) : "";
      }
    }
  }
  
  // Si no hay datos suficientes, devolver vacío
  console.log(`[WEIGHT-EST] ${exerciseName}: no weight data available`);
  return "";
}

/**
 * Aplica la estimación de pesos a una lista de ejercicios
 * Respeta pesos existentes (establecidos por el usuario)
 */
export function applyWeightEstimation<T extends { name: string; weight?: string }>(
  exercises: T[],
  scanData: ScanData | null | undefined,
  userData: UserData | null | undefined,
): T[] {
  return exercises.map((ex) => {
    // PRIORITY 1: If already has weight assigned, respect it (user preference)
    if (ex.weight && ex.weight.trim() !== "") {
      return ex;
    }
    
    // PRIORITY 2: Estimate weight based on scan (priority) or user data (fallback)
    const estimatedWeight = estimateExerciseWeight(ex.name, scanData, userData);
    
    return {
      ...ex,
      weight: estimatedWeight,
    };
  });
}
