# Tarjetas planas: fuera tarjeta dentro de tarjeta

## Problema
Las fichas de fin de entreno tienen superficies anidadas: una tarjeta grande con borde y fondo, y dentro más cajas con fondo y borde (mapas musculares en cajas grises, comparaciones en cajas, próximo paso en otra caja). Eso da sensación "bootstrap", no premium.

## Solución: una sola superficie, contenido plano

### WorkoutStudyCards.tsx
- Cada ficha es UNA tarjeta (borde + fondo + radio). Dentro, cero cajas.
- **Ficha Músculos**: los mapas front/back van directos sobre la tarjeta, sin caja gris `bg-secondary/30` alrededor; las siluetas ya tienen su propia figura.
- **Ficha Comparación**: los ejercicios pasan de cajas `rounded-xl bg-secondary/35` a filas planas separadas por una línea fina (`divide-y divide-border/50`), nombre en semibold y observación debajo.
- **Ficha Próximo paso**: fuera la caja `border-primary/20 bg-primary/5`; el texto va plano con un acento de línea dorada a la izquierda (como la comparación de volumen de la primera ficha).
- Estados vacíos: texto centrado plano, sin caja.

### WorkoutTracker.tsx (pantalla final)
- La primera ficha (intro) mantiene su estilo pero sin doble superficie: el bloque de métricas ya es plano con divisores, se mantiene; se elimina cualquier fondo extra del contenedor de compartir.

### Resultado
Una tarjeta = una superficie. Todo lo interno es tipografía, divisores finos y aire. Estilo editorial premium, coherente con la tarjeta de Stories.

## Verificación
- Typecheck limpio.
- Revisión visual con Playwright a 390×844 de la pantalla de fin de entreno: sin cajas anidadas, sin scroll.
