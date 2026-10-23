# Tokens

Los valores viven en `src/index.css` (variables CSS y clases `type-*`, `btn-*`) y `tailwind.config.ts`. Usa siempre las clases; no escribas colores ni tamaños sueltos.

## Color

| Token | Uso |
|---|---|
| `bg-background` (negro `#000`) | Fondo de toda pantalla. |
| `bg-card` (gris muy oscuro) | Tarjetas, filas, campos. |
| `bg-secondary` | Superficie dentro de una tarjeta, chips, botones secundarios. |
| `text-foreground` (blanco) | Texto principal. |
| `text-muted-foreground` (gris ≈68 %) | Texto secundario. Nunca más claro ni más pequeño que `type-footnote`. |
| `text-primary` / `bg-primary` (dorado `43 61% 60%`) | Acción principal, cifra protagonista, palabra destacada, estado activo. |
| `bg-primary/15` | Etiquetas y fichas activas sobre fondo oscuro. |
| `text-destructive` | Solo para borrar, cerrar sesión o errores. |
| `text-success` | Solo para «hecho» y confirmaciones. |

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
| `type-caption1/2` | 12/11 px | Solo etiquetas pequeñas |

Cifras protagonistas: `font-rounded font-bold leading-none tracking-tight tabular-nums`, 56–72 px en la app, hasta `clamp(…, 180px)` en la landing. Unidades al lado en `type-title3 text-muted-foreground`. Decimales en formato español (`toLocaleString("es-ES")` → `49,6`).

## Radios

| Elemento | Radio |
|---|---|
| Tarjeta normal (`rounded-2xl`) | **22 px** (configurado en Tailwind) |
| Portada, tarjeta protagonista, hoja inferior | `rounded-[28px]` |
| Bloque grande de la landing | `rounded-[28px]`–`rounded-[40px]` |
| Botones (`btn-md`, `btn-lg`), campos de acceso, filas de selección de cuenta | píldora (`rounded-full`) |
| Avatares, icono de la app en acceso | círculo |
| Miniaturas de ejercicio o comida | `rounded-xl` |

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
