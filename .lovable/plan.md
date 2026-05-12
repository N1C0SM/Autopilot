## Objetivo
Rediseñar la tarjeta compartible del AI Scan para que:
1. Incluya la **foto del físico actual** y, si existe, la **foto del físico objetivo**.
2. Use la paleta **negro + amarillo** (en vez del violeta/rosa actual).
3. Se parezca lo más posible a lo que el usuario ve en pantalla en la página de resultados (mismas secciones y jerarquía visual).

Solo se toca el JSX oculto del `shareRef` y `StatBox` en `src/pages/Scan.tsx`. Nada de la página visible cambia.

## Nueva paleta
- Fondo: `#0a0a0a` con un sutil glow amarillo (`radial-gradient` `rgba(250,204,21,0.18)` arriba-izq y `rgba(250,204,21,0.08)` abajo-der).
- Acento: amarillo `#facc15` (gradiente `#fde047 → #facc15` para los números).
- Texto principal: `#ffffff`. Texto secundario: `#a1a1aa`. Bordes: `rgba(250,204,21,0.35)`.

## Estructura de la tarjeta (1080×1350, lo que se ve en pantalla, condensado)

```
┌──────────────────────────────────────────┐
│ Logo Autopilot ⚡   ·   AI PHYSIQUE SCAN │
├──────────────────────────────────────────┤
│  [ FOTO ACTUAL ]   →   [ FOTO OBJETIVO ] │  ← solo "ACTUAL" centrado si no hay objetivo
│   AHORA                  OBJETIVO        │
├──────────────────────────────────────────┤
│ DIAGNÓSTICO                              │
│ "headline_diagnosis…" (truncado ~110ch)  │
├──────────────────────────────────────────┤
│ [Percentil]  [Edad estética]  [A meta]   │ ← StatBox amarillos
├──────────────────────────────────────────┤
│ Haz tu scan gratis · autopilotplan.com/scan │
└──────────────────────────────────────────┘
```

## Cambios concretos en `src/pages/Scan.tsx`

1. **Bloque de fotos** (nuevo, debajo del header):
   - Contenedor `display: flex, gap: 24, alignItems: center, justifyContent: center`.
   - Cada foto: `width: 380, height: 500, borderRadius: 24, objectFit: cover, border: 2px solid #facc15, boxShadow: 0 0 60px rgba(250,204,21,0.25)`.
   - Etiqueta debajo de cada foto en amarillo (`#facc15`, uppercase, tracking 3, fontSize 16): "AHORA" / "OBJETIVO".
   - Flecha "→" entre las dos fotos en círculo amarillo translúcido (60×60, `background: rgba(250,204,21,0.15)`, borde amarillo).
   - Si no hay `objectiveImg`: una sola foto centrada `460×580` con etiqueta "MI FÍSICO".
   - `<img>` usa `currentImg` / `objectiveImg` (data URLs, compatibles con `html-to-image`).

2. **Header**: cambiar el cuadrito violeta del logo a amarillo (`background: rgba(250,204,21,0.18)`, `border: 1px solid rgba(250,204,21,0.5)`). Badge "ANÁLISIS IA" con borde y texto amarillos.

3. **Diagnóstico**: reducir `fontSize` de 56 → 40, `lineHeight: 1.15`, truncar a 110 caracteres con `…`.

4. **`StatBox`**: cambiar el gradiente del valor de `#a78bfa→#ec4899` a `#fde047→#facc15`. Borde sutil amarillo (`rgba(250,204,21,0.2)`).

5. **Footer**: el texto del dominio en amarillo `#facc15`.

6. **Padding/espaciado**: reducir `padding` del card de 72 → 56 y usar `gap` controlado entre secciones para que entren las fotos sin overflow.

## Notas técnicas
- No se cambia `handleShare`, ni `analyze-physique`, ni la UI visible.
- No se añaden dependencias.
- `html-to-image` ya soporta `<img src="data:…">` sin config CORS extra.

## Fuera de alcance
- No se rediseña la página de resultados visible.
- No se toca dashboard ni nada del trabajo previo.
