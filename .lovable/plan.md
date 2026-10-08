# Uso de los 50 créditos disponibles

## Situación
- Créditos diarios: agotados hoy (se recargan a las 02:00 hora de Madrid).
- Créditos mensuales: agotados.
- Créditos comprados (top-up): **50,00 disponibles** (no caducan hasta oct. 2027).
- La generación de fotos/vídeos sigue bloqueada por falta de saldo en OpenAI (dinero externo, no créditos Lovable).

## Plan de trabajo (por prioridad acordada)

### 1. Workout Tracker — verificación visual y pulido final
Probar el tracker en pantalla con Playwright sobre la vista real: tarjeta mínima, tabla Serie · Previa · KG · Repeticiones · ✓, sugerencias en gris, Play centrado, miniaturas limpias y auto-avance al completar la última serie. Corregir lo que falle en ese pase.

### 2. Onboarding de mínimo esfuerzo (1 toque por decisión)
Mantener todos los datos que pide el sistema, pero convertirlos en decisiones de 1 toque:
- Pantalla 1: Individual/Pareja + Solo/Con entrenador (píldoras de estilo de coach y día de revisión si elige entrenador).
- Pantalla 2: enfoque, objetivo y estructura («Que elija mi entrenador» por defecto).
- Pantalla 3: días como botones circulares, duración de sesión y deportes secundarios con horarios por defecto.
- Pantalla 4: comidas al día, relación con la cocina y alergias como chips («Ninguna» preseleccionado).
- Pantalla 5: lesiones como chips y nivel como selector guiado.
Cero teclado salvo email de pareja y datos físicos opcionales.

### 3. Consola de IA modular + avisos cápsula Dynamic Island
En Admin → Contenido y Claves de IA: bloques independientes para Motor de Texto (orden con flechas y switches), Motor de Imágenes (OpenAI vs Lovable) y Motor de Vídeos (selector exclusivo + interruptor de pausa). Avisos del sistema como píldora superior tipo Dynamic Island (cristal, acento ámbar para éxito, rojo sobrio para error).

### 4. Fotos y vídeos de ejercicios (bloqueado externamente)
Solo falta que haya saldo: recargar OpenAI (~10-15 € para ~271 fotos) o créditos de IA, y lanzar `node scripts/generate-exercise-media.mjs --images-only`.

## Detalles técnicos
- Archivos clave: `src/components/dashboard/WorkoutTracker.tsx`, `src/pages/Onboarding.tsx`, `src/components/OnboardingEditor.tsx` (solo como referencia de datos), `src/components/admin/SiteContentEditor.tsx`, `supabase/functions/_shared/ai-provider.ts`.
- No se toca la base de datos ni cambian los datos que se guardan: solo la experiencia de entrada.
- Verificación: typecheck limpio tras cada bloque + prueba Playwright del tracker y del onboarding.
