# Firma de marca: «Ritmo»

Objetivo: Autopilot se reconoce **sin logo**. Si tapas la marca en una pantalla, tarjeta, vídeo, email, notificación o post, se tiene que seguir sabiendo que es Autopilot.

## Las piezas

| Pieza | Regla | Dónde vive |
|---|---|---|
| **Motivo** | Tres barras con proporción 2-1-2 (excéntrica, pausa, concéntrica) y radio completo, en dorado. Es el logo sin texto, la marca de agua y el loader. **Una sola por vista.** | `BrandMark` (`src/shared/components/ui/brand-mark.tsx`, `native/Autopilot/Design/Components.swift`) |
| **Carga** | Siempre las barras latiendo, nunca las aspas de iOS ni `ProgressView`. | `Spinner` (web), `BrandLoader` (nativo) |
| **Cifras** | Las cifras protagonistas (kg, %, récords, kcal) van en Big Shoulders 800 y `tabular-nums`. El resto del texto sigue en Inter. | `.type-figure`, `font-figure` / `Font.figure(size:)` |
| **Movimiento** | `cubic-bezier(.34,1.56,.64,1)` durante 360 ms (`--ease-brand`, `--dur-brand`), con un ligero rebote de muelle. | `src/index.css` |
| **Háptica** | Fuerte, suave, fuerte (2-1-2) **solo** al cerrar una serie. | `hapticSignature()`, `Haptics.signature()` |
| **Foto y vídeo** | Gradación ámbar cálida, negros profundos, saturación ≈85 %, grano fino y fundido a negro en el tercio inferior. | Prompt de `supabase/functions/exercise-video` |
| **Emails** | Fondo negro y el mismo dorado que la app (`#D6B45B`). | `supabase/functions/_shared/email-styles.ts` |
| **Cards para compartir** | Foto con el tratamiento anterior, cifra en `.type-figure` y barras pequeñas abajo a la izquierda, sin el nombre de la marca. | (pendiente: `WorkoutStoryShare`, `ScanShareCard`) |

Prohibido: el motivo como relleno o patrón, más de un juego de barras por vista, otras fuentes de cifras y otros dorados.

## Pendiente
- Splash: sustituir `LaunchLogo` por las barras sobre negro (web, Capacitor y nativo).
- Icono de la app: las tres barras sobre negro.
- Plantillas de las cards para compartir (entreno, scan y récord) y de las guías PDF.
- Intro y outro de 1 s en los vídeos de técnica (las barras laten una vez).
