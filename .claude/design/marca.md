# Firma de marca: la «A» con rayo

Objetivo: Autopilot se reconoce **sin logo**. Si tapas la marca en una pantalla, tarjeta, vídeo, email, notificación o post, se tiene que seguir sabiendo que es Autopilot.

## Las piezas

| Pieza | Regla | Dónde vive |
|---|---|---|
| **Símbolo** | La «A» dorada con un rayo en el hueco, sobre negro. Geometría única: `BRAND_A` y `BRAND_BOLT` (viewBox 0–100). Es la marca de agua, el loader y el logo pequeño (barras laterales, cabecera web); dentro del icono va en relieve. **Una sola por vista.** | `BrandMark` (`src/shared/components/ui/brand-mark.tsx`, `native/Autopilot/Design/Components.swift`) |
| **Icono con relieve** | Desde el 12-11-2026 el icono es el cuadro negro con brillo arriba, canto de luz y sombra, y la «A» dorada en relieve (degradado y bisel). Mismo icono en iPhone, Mac, web, PWA, Android y el splash. En acceso, registro, bienvenida, «¿Quién entrena?» y el arranque se pinta el icono, no la «A» suelta. | `scripts/gen-icon.mjs` (único origen; PNG de la web a 256 colores), `AppIconMark` (`src/shared/components/ui/app-icon-mark.tsx`, `Components.swift`) |
| **Carga** | Siempre la «A» con el rayo latiendo, nunca las aspas de iOS ni `ProgressView`. | `Spinner` (web), `BrandLoader` (nativo) |
| **Cifras** | Las cifras protagonistas (kg, %, récords, kcal) van en Big Shoulders 800 y `tabular-nums`. El resto del texto sigue en Inter. | `.type-figure`, `font-figure` / `Font.figure(size:)` |
| **Movimiento** | `cubic-bezier(.34,1.56,.64,1)` durante 360 ms (`--ease-brand`, `--dur-brand`), con un ligero rebote de muelle. | `src/index.css` |
| **Háptica** | Fuerte, suave, fuerte (2-1-2, la cadencia de una repetición) **solo** al cerrar una serie. | `hapticSignature()`, `Haptics.signature()` |
| **Foto y vídeo** | Gradación ámbar cálida, negros profundos, saturación ≈85 %, grano fino y fundido a negro en el tercio inferior. | Prompt de `supabase/functions/exercise-video` |
| **Emails** | Fondo negro y el mismo dorado que la app (`#D6B45B`). | `supabase/functions/_shared/email-styles.ts` |
| **Cards para compartir** | Foto con el tratamiento anterior, cifra en `.type-figure` y la «A» pequeña al pie, sin el nombre de la marca. | (pendiente: `WorkoutStoryShare`, `ScanShareCard`) |

Prohibido: el motivo como relleno o patrón, más de una «A» por vista, o dibujarla con otra geometría, otras fuentes de cifras y otros dorados.

## Pendiente
- Plantilla de las guías PDF.
- Regenerar los vídeos de técnica ya existentes con el nuevo tratamiento.
- Celebración de récord en la app nativa (hoy solo existe en la web).
