/**
 * Celebración de récords personales con confeti dorado.
 * Usa canvas-confetti para una animación ligera y performante.
 */

let confetti: typeof import('canvas-confetti').default | null = null;

// Carga dinámica para no bloquear el bundle principal
const loadConfetti = async () => {
  if (confetti) return confetti;
  const module = await import('canvas-confetti');
  confetti = module.default;
  return confetti;
};

/**
 * Lanza confeti dorado desde abajo cuando se rompe un récord personal.
 * Respeta prefers-reduced-motion: si está activo, no lanza confeti.
 */
export const celebratePersonalRecord = async () => {
  // Respetar preferencia de movimiento reducido
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    return;
  }

  try {
    const fire = await loadConfetti();
    
    // Primer burst: confeti desde el centro-inferior
    fire({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.8 },
      colors: ['#FFD700', '#FFA500', '#FF8C00', '#F59E0B'],
      ticks: 200,
      gravity: 1.2,
      scalar: 1.2,
    });
    
    // Segundo burst: desde los laterales (más dramático)
    setTimeout(() => {
      fire({
        particleCount: 50,
        angle: 60,
        spread: 55,
        origin: { x: 0, y: 0.8 },
        colors: ['#FFD700', '#FFA500', '#F59E0B'],
        ticks: 150,
      });
      fire({
        particleCount: 50,
        angle: 120,
        spread: 55,
        origin: { x: 1, y: 0.8 },
        colors: ['#FFD700', '#FFA500', '#F59E0B'],
        ticks: 150,
      });
    }, 250);
  } catch (error) {
    // Fallo silencioso: la animación es opcional
    console.warn('No se pudo cargar canvas-confetti:', error);
  }
};
