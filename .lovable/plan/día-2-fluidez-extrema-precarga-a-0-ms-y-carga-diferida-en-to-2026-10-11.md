# Día 2 — Fluidez extrema: precarga a 0 ms y carga diferida en toda la app

Objetivo: que la web y la app móvil carguen medios de forma instantánea, sin autoplay y sin gastar datos ni batería en segundo plano.

## 1. Vídeo del Hero en la landing (`src/pages/Index.tsx`)
- Quitar `autoPlay`, `muted` y `loop`: el vídeo ya no se reproduce solo.
- `preload="metadata"` con su imagen de portada limpia: no descarga el vídeo hasta que el usuario pulsa play.
- Mismo comportamiento que los vídeos de técnica: portada visible, reproducción voluntaria con controles.

## 2. Carga diferida (lazy loading) global
- Todas las imágenes fuera de la primera pantalla con `loading="lazy"` y `decoding="async"` (landing, biblioteca, progreso, chat).
- La imagen principal de la landing (LCP) se mantiene con carga prioritaria (`fetchpriority="high"`).

## 3. Precarga inteligente en el Workout Tracker (`src/components/dashboard/WorkoutTracker.tsx`)
- Mientras el usuario hace el ejercicio actual, se precarga en memoria (`new Image().src`) la foto del ejercicio siguiente y del anterior.
- Al deslizar o pulsar «siguiente», la imagen ya está en caché: transición a 0 ms, sin parpadeos.
- Solo se precarga el adyacente (N+1 / N-1), no toda la rutina, para no saturar la memoria del móvil.

## 4. Verificación
- Typecheck y build limpios.
- Comprobación en navegador (Playwright, viewport móvil): el hero no se reproduce solo, las imágenes cargan diferidas y el cambio de ejercicio en el tracker es instantáneo.

## Nota técnica
- Sin cambios de base de datos ni de backend en este bloque.
- La conversión masiva de las 271 fotos a WebP ya quedó preparada en la función `exercise-video` (acción `webp`); se ejecutará cuando haya saldo de generación, no gasta créditos de cambios de app.
