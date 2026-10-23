# Componentes

Antes de escribir una pieza nueva, busca aquí. Si no encaja, amplía el componente común y documéntalo en este archivo.

## Base (`src/components/ui`)

- **`Button`** — `variant="hero"` / por defecto = acción principal dorada; `tinted` = secundaria dorada suave; `secondary` = gris; `plain` = solo texto dorado. `size="lg"` y `md` son píldora. Una sola acción dorada por pantalla.
- **`Surface`** — tarjeta plana `rounded-2xl bg-card`.
- **`ListGroup` / `ListRow`** — listas tipo Ajustes de iOS: `header`, `footer`, `leading` (miniatura o avatar), `trailing`, `chevron`, `destructive`.
- **`SectionHeader`** — título de sección (`type-title2/3` en negrita) con acción opcional.
- **`EmptyState`** — estados vacíos:
  - normal: icono en ficha tintada + título + línea;
  - `photo={BRAND_PHOTOS.x}`: tarjeta alta con foto real y texto abajo;
  - `rest`: noche con luna dorada y estrellas (descanso). Nunca una foto de ejercicio para descansar.
- **`IconTile`** — icono dentro de un cuadrado tintado; solo para listas y avisos, no como protagonista.
- **Hojas (`Sheet`, `Dialog` en móvil)** — se abren desde abajo con `rounded-t-[28px]`.

## Marca y contenido

- **`BRAND_PHOTOS`** (`src/lib/brandPhotos.ts`) — fotos reales compartidas por landing y app (gimnasio, mancuernas, casa, barra).
- **`useExerciseImages(nombres)`** — foto de cada ejercicio por nombre (Progreso, Récords).
- **`useSessionCover(ids, respaldo)` / `useMealPhoto(plato)`** — imágenes generadas con IA (edge function `session-cover`), guardadas una vez por combinación de músculos o plato. Siempre con respaldo: si la IA falla, foto del primer ejercicio o hueco gris, nunca una pantalla rota.
- **`PhoneFrame`, `PhoneHome`, `PublicPhone`** — el teléfono de la landing pinta la interfaz real; si cambia la app, cambia el teléfono.

## Landing (`src/components`)

- **`PublicLayout`** — cabecera, pie con columnas y enlaces legales. Toda página pública lo usa (también el blog y descargar la app).
- **`PageHero`** — antetítulo dorado, titular `type-display` con palabra en dorado (`accent`) y entradilla, con halo.
- Secciones narrativas: `PhoneStory` (teléfono fijo), `Benefits`, `BookShowcase` (abanico de guías), `FeatureGallery` (galería horizontal), `StickySteps`, `FreePlanSection`. Todas con versión estática para movimiento reducido y lista accesible para VoiceOver.

## App

- **`OverviewRow`** — tarjeta de resumen con `value` (cifra grande) + título + línea.
- **`TrainingOverviewCard`** — cifra protagonista con halo + datos secundarios + gráfica en la misma tarjeta.
- **`RecordCelebration`** — celebración de récord a pantalla completa (destello dorado, cifra, háptica).
- **`AccountSwitcher`** (Ajustes) y **`WhoIsTraining`** («¿Quién entrena?») — cuentas del dispositivo en filas píldora con avatar circular; solo apps nativas (`supportsMultipleAccounts()`).

## Acceso (`src/components/auth/AuthScreenParts.tsx`)

`AuthHero` (marca «Autopilot» + halo + icono circular dorado + titular redondeado), `AuthFieldGroup` / `AuthFieldRow` (cada campo es una píldora con anillo dorado al enfocar), `AuthFieldNote`, `AuthSymbol`, `AuthNotice`. Login, registro, recuperar y nueva contraseña los comparten: se cambian aquí, no en cada página.
