# Tokens

Los valores viven en `src/index.css` (variables CSS y clases `type-*`, `btn-*`) y `tailwind.config.ts`. Usa siempre las clases; no escribas colores ni tamaños sueltos.

## Color

Escala de superficies: cuatro pasos sobre negro, ni uno más. Una tarjeta no lleva borde; lo que la separa es el escalón de color.

| Token | Valor | Uso |
|---|---|---|
| `bg-background` | `#000` | Fondo de toda pantalla. |
| `bg-card` | `240 5% 8%` (`#141416`) | Tarjetas, grupos de ajustes, filas. |
| `bg-secondary` | `240 5% 16%` (`#29292C`) | Superficie dentro de tarjeta: campos, chips, botón secundario. |
| `bg-accent` | `240 5% 21%` (`#333338`) | Solo pulsado / fila resaltada. |
| `border` / `bg-border` | `240 4% 15%` (`#262629`) | Separadores (`sep-b`, `sep-t`). **Nunca borde de tarjeta.** |
| `text-foreground` | blanco | Texto principal. |
| `text-muted-foreground` | `240 4% 67%` (`#A8A8AE`) | Texto secundario (AA sobre las tres superficies). Nunca más pequeño que `type-footnote`. |
| `text-primary` / `bg-primary` | dorado `41 61% 61%` (`#D8B25E`) | Acción principal, cifra protagonista, palabra destacada, estado activo. |
| `bg-primary/15` | dorado al 15 % | Etiquetas, fichas activas, fila «hecha». |
| `border-primary/30` | dorado al 30 % | Borde de la fila o campo activo. |
| `text-destructive` | `#FF453A` | Solo borrar, cerrar sesión o error. **Nunca el número de serie ni el fondo de una fila.** |
| `text-success` | verde | Solo confirmación real (pago, guardado). El entrenamiento no usa verde: su estado es dorado. |

Regla de estado del entrenamiento (una sola escala, la misma en web, iPhone y Mac):

| Estado | Cómo se ve |
|---|---|
| Pendiente | `bg-secondary`, número y texto en `text-muted-foreground` |
| Activo | `bg-card` + `border-primary/30`, número en `text-primary` |
| Hecho | `bg-primary/15`, check en `text-primary` |
| Fallo | Solo la etiqueta «Fallo» en `text-destructive` |

Halo de marca (detrás del elemento principal):

```tsx
<span aria-hidden className="pointer-events-none absolute … rounded-full bg-[radial-gradient(closest-side,hsl(var(--primary)/0.14),transparent)]" />
```

Prohibido: hex sueltos, otros acentos (azul, morado, verde decorativo), degradados de varios colores, sombras de color salvo el resplandor dorado del avatar o icono de app.

## Tipografía

Fuente única: **Inter** (`font-sans`, `font-display`, `font-rounded` apuntan a ella). Las clases `type-*` escalan con el tamaño de letra de iOS (`--type-scale`): **no uses `text-xs`, `text-sm`, `text-[11px]`…** para texto de interfaz.

| Clase | Tamaño base | Para |
|---|---|---|
| `type-display` | 40 → 72 px | Titular de sección de la landing |
| `type-large-title` | 34 px | Título de pantalla de la app |
| `font-rounded text-[28–34px] font-bold tracking-tight` | 28–34 px | Titular de tarjeta o de pantalla de acceso |
| `type-title1/2/3` | 28/22/20 px | Títulos de bloque |
| `type-headline` | 17 px semibold | Nombre de fila, botón |
| `type-body` | 17 px | Texto |
| `type-subhead` | 15 px | Descripciones |
| `type-footnote` | 13 px | Notas, fechas |
| `type-caption1` | 12 px | Etiquetas técnicas (contadores, unidades) |
| `type-caption2` | 12 px | Solo la etiqueta de la barra de pestañas |

Cifras protagonistas: `type-figure` o `font-rounded font-bold leading-none tracking-tight tabular-nums`, 56–72 px en la app, hasta `clamp(…, 180px)` en la landing. Unidades al lado en `type-title3 text-muted-foreground`. Decimales en formato español (`toLocaleString("es-ES")` → `49,6`). **Una sola cifra protagonista por bloque**: si hay dos, la segunda baja de tamaño o de color.

Suelo de la interfaz: **13 px** (`type-footnote`). La única excepción es la etiqueta de la barra de pestañas, a 12 px y siempre con su icono de 22 px al lado. Prohibido `text-[10px]`, `text-[11px]`, `text-xs`.

## Radios

Cinco radios y ninguno más. En código nuevo usa las clases semánticas; `rounded-md/lg/xl/3xl` quedan como legado y se sustituyen al tocar cada pantalla.

| Clase | Radio | Para |
|---|---|---|
| `rounded-chip` | 14 px | Chips, celdas de tabla, miniaturas pequeñas, `IconTile` |
| `rounded-media` | 18 px | Foto o miniatura dentro de una tarjeta |
| `rounded-card` | 22 px | Tarjeta, grupo de lista, bloque (`rounded-2xl` es el mismo valor) |
| `rounded-sheet` | 28 px | Portada, tarjeta protagonista, hoja inferior, estado vacío con foto |
| `rounded-full` | píldora | Botones, campos, segmentado, filas de selección |

Avatares e icono de la app: círculo.

## Espacio

- Márgenes laterales: 16–20 px en móvil (`px-4`/`px-5`), 32 px en tablet (`sm:px-8`).
- Entre bloques de la app: 32 px (`mt-8`); entre secciones de la landing: una pantalla o más, según la narrativa.
- Ancho de lectura: párrafos ≤ 60 caracteres (`max-w-md`/`max-w-xl`).

## Movimiento

- Curvas: `ease-ios` (hojas, desplazamientos) y `ease-out` (apariciones).
- Duraciones: 150 ms (toque), 200–300 ms (cambio de estado), 500–700 ms (entrada de bloque).
- Toque: `active:scale-[0.97–0.98]` + háptica (`hapticTap`, `hapticSelection`).
- Scroll narrativo: `useScrollProgress` / `pinnedProgress`; nada salta ni cambia de tamaño bruscamente.
- `prefers-reduced-motion` y «aumentar contraste»: todo estático y completo (ya lo resuelven `useScrollProgress` y `ScrollReveal`).
