# Lenguaje de diseño de Autopilot

Autopilot es **un solo producto** en cuatro sitios: la web (landing), la app de iPhone, la de Android y la de Mac. Todo tiene que parecer hecho por el mismo equipo y el mismo día. Este documento es la referencia: si una pantalla nueva no cumple algo de aquí, se corrige la pantalla, no el documento.

Documentos:

- [README.md](README.md) — principios y reglas (este archivo).
- [tokens.md](tokens.md) — colores, tipografía, radios, espacios y movimiento, con sus clases.
- [componentes.md](componentes.md) — piezas reutilizables y cuándo usar cada una.
- [pantallas.md](pantallas.md) — cómo se compone cada tipo de pantalla (landing, app, acceso, estados vacíos).
- [checklist.md](checklist.md) — revisión obligatoria antes de publicar una versión.

## Principios

1. **El producto es el protagonista.** Fotos reales de ejercicios, el teléfono con la interfaz real, cifras de verdad. Nada de ilustraciones infantiles ni iconos sueltos donde cabe una imagen.
2. **Negro profundo y dorado contenido.** El fondo es negro; el dorado solo marca lo importante (acción principal, cifra protagonista, palabra clave del titular). Si todo es dorado, nada lo es.
3. **Una cifra o una frase grande por bloque.** Titulares redondeados y apretados; números enormes (`font-rounded`, negrita, `tabular-nums`). El texto secundario es gris y legible, nunca diminuto.
4. **Formas redondas.** Tarjetas de 22 px, portadas y hojas de 28 px, botones, campos y filas de selección en píldora, avatares en círculo. Nada de esquinas rectas ni de bordes de 1 px alrededor de las tarjetas.
5. **Sin bordes, con planos.** Las superficies se separan del fondo por color (`bg-card`, `bg-secondary`), no por líneas. Las líneas solo como separadores finos dentro de una lista.
6. **Halo dorado, no brillos.** La profundidad se consigue con un degradado radial dorado muy tenue detrás del elemento principal (≈14 % de opacidad). Prohibidos los brillos, neones y degradados de colores.
7. **Movimiento físico y opcional.** Entradas de 200–700 ms con curva de iOS; nada de esperas artificiales. Con «reducir movimiento» todo se muestra quieto y completo.
8. **Accesible siempre.** Zonas táctiles de 44 pt, contraste AA (el gris sobre negro ya da ≈9:1), texto que crece con el tamaño de letra de iOS y contenido que VoiceOver puede leer sin hacer scroll.
9. **Solo verdades.** Ninguna cifra, testimonio o función inventada. Lo de pago dice en qué plan está; lo oculto en Admin no se anuncia en ningún sitio.

## Lo que siempre se reutiliza

| Necesito… | Uso |
|---|---|
| Un estado vacío o de descanso | `EmptyState` (con `photo` para foto de marca, `rest` para la noche con luna) |
| Una foto de entrenamiento genérica | `BRAND_PHOTOS` de `src/shared/lib/brandPhotos.ts` |
| La foto de un ejercicio concreto | `useExerciseImages(nombres)` |
| Portada de sesión o foto de comida | `useSessionCover` / `useMealPhoto` (IA, con respaldo) |
| Cabecera de página pública | `PageHero` dentro de `PublicLayout` |
| Lista de ajustes | `ListGroup` + `ListRow` |
| Título de sección en la app | `SectionHeader` |
| Pantallas de acceso | piezas de `src/app/components/auth/AuthScreenParts.tsx` |

Si algo de esta tabla no sirve, se amplía el componente común. No se copia y se modifica en una pantalla.

## Firma de marca

Lee `marca.md`. La regla es que **Autopilot se reconozca sin logo**: la «A» con rayo, cifras en Big Shoulders, el dorado único, el loader con la «A» y la háptica 2-1-2.
