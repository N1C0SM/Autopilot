# Progreso: una sola fila de píldoras, instantánea y sin scroll

## Qué cambia
1. **Fuera la segunda fila de píldoras.** Arriba solo queda: Evolución | Fotos | Récords.
2. **Evolución pasa a ser una pantalla única, sin scroll y sin píldoras extra:**
   - Arriba, una franja fina con la **Semana** (los 7 días como puntos con su estado más «X/Y sesiones»). Como ocupa poco, va arriba en vez de tener su propia pestaña.
   - Debajo, la **tarjeta de Peso** en pequeño: peso actual, cambio respecto al inicio y una línea mini. Tampoco necesita pestaña propia.
   - El resto de la pantalla es para **Ejercicios**: un gráfico grande que ocupa todo el hueco que queda. Las 3 píldoras de dentro pasan a ser un selector de ejercicio pequeño (desplegable) en la cabecera del gráfico, y las 4 cifras van en una sola línea compacta.
3. **Cambio de píldora al instante:** cada vista se carga una sola vez y se queda en memoria. Al cambiar solo se oculta o se muestra, sin volver a pedir los datos ni redibujar. El marcador de la píldora activa se desliza suavemente (0,2 s).
4. **Cero scroll:** Evolución se ajusta exactamente al alto de la pantalla, entre la cabecera y la barra inferior, en móvil y en PC.

## Detalles técnicos
- Dashboard.tsx: quitar `evolutionView` y su selector. Montar Evolución, Fotos y Récords una vez y alternar con `hidden`. Píldora activa con un indicador `motion` `layoutId`.
- Evolución: contenedor en columna `h-[calc(100dvh-<header+tabbar>)] overflow-hidden`. WeeklyProgress recibe la variante `compact` (franja), ProgressCharts recibe `compact` (mini tarjeta) y WorkoutProgress ocupa `flex-1 min-h-0` con un Select en lugar de las píldoras y las estadísticas en una sola fila.
- Las props compactas son opcionales, así que los otros sitios donde se usan estos bloques no cambian.
- Al terminar, lo compruebo en un móvil simulado de 390×844.
