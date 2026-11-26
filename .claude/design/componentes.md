# Componentes

Antes de escribir una pieza nueva, busca aquí. Si no encaja, amplía el componente común y documéntalo en este archivo.

## Base (`src/shared/components/ui`)

- **`Button`** — `variant="hero"` / por defecto = acción principal dorada; `tinted` = secundaria dorada suave; `secondary` = gris; `plain` = solo texto dorado. `size="lg"` y `md` son píldora. Una sola acción dorada por pantalla.
- **`Surface`** — tarjeta plana `rounded-2xl bg-card`.
- **`ListGroup` / `ListRow`** — listas tipo Ajustes de iOS: `header`, `footer`, `leading` (miniatura o avatar), `trailing`, `chevron`, `destructive`.
- **`SectionHeader`** — título de sección (`type-title2/3` en negrita) con acción opcional.
- **`PageTitle`** — cabecera de pantalla: `eyebrow` opcional en dorado, título `type-large-title`, subtítulo de una línea y acción a la derecha. Toda pantalla de primer nivel la usa; no escribas el `h1` a mano.
- **`Field`** — campo de formulario: etiqueta visible arriba, control debajo (píldora) y `hint`/`error` debajo en `type-footnote`. Inyecta `id`, `aria-describedby` y `aria-invalid` en el hijo, así que no se repiten en cada formulario:

  ```tsx
  <Field label="Email" hint="El de tu cuenta" error={errors.email}>
    <Input type="email" placeholder="tu@correo.com" />
  </Field>
  ```
- **`EmptyState`** — estados vacíos:
  - normal: icono en ficha tintada + título + línea;
  - `photo={BRAND_PHOTOS.x}`: tarjeta alta con foto real y texto abajo;
  - `rest`: noche con luna dorada y estrellas (descanso). Nunca una foto de ejercicio para descansar.
- **`IconTile`** — icono dentro de un cuadrado tintado; solo para listas y avisos, no como protagonista.
- **`PlusBadge`** (`plus-badge.tsx` / `PlusBadge` en nativo) — píldora dorada tenue con candado de 12 px y «Plus» en 11 px: marca una función bloqueada del plan gratis, a la derecha de su fila.
- **Hojas (`Sheet`, `Dialog` en móvil)** — se abren desde abajo con `rounded-t-[28px]`.

## Marca y contenido

- **`BRAND_PHOTOS`** (`src/shared/lib/brandPhotos.ts`) — fotos reales compartidas por landing y app (gimnasio, mancuernas, casa, barra).
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
- **Entreno activo** (`WorkoutTracker` en la web, `WorkoutView` en la app) — un foco por pantalla. Arriba «‹ Salir · sesión · ···» (añadir ejercicio, vista, «Más opciones por serie», descartar). Ejercicio a ejercicio: los ejercicios numerados en círculos de 44 (aro dorado el que ves, check sobre tinte dorado los hechos), el ejercicio en una portada de 28 con su clip o su foto (sin foto, su músculo en la silueta) y la ficha en (i), el nombre en Title 1 con su «···» (ver técnica, cambiar, superserie) y solo su tabla **Serie · Anterior · kg · Reps · ✓** (celdas de 44 con radio 14; hecha = fila dorada al 15 % sin cajas; la actual con filo dorado; calentamiento «C»). Pie fijo: el descanso en una barra tranquila con −15 s, +15 s y «Saltar», y Pausar · tiempo («3 de 12 series») · Finalizar, la única acción dorada. `ExerciseSwap` admite `open`/`trigger={false}` para abrirse desde un «···».

- **Entrenar** (`TrainingPlanView` + `MyRoutines` en la web, `RoutineListView` + `MyRoutinesSection` en la app) — una jerarquía: el modo del plan en una frase (`planModeLine` / `CustomRoutines.modeLine`), «Entreno vacío» y «Ejercicios» en píldoras tranquilas (secundarias con relieve, a su medida); «Esta semana» (Title 3) con «Editar» y lo hecho en tramos («1 de 4»); las sesiones en **una sola tarjeta** (miniatura de 56 con radio 14, nombre, músculos y «6 ejercicios · ≈ 45 min» de `sessionSummary.ts` / `DayPlan.summaryLine`, y su estado: «Hoy» en píldora dorada tenue, «Hecha» con check dorado o «Siguiente» en gris). La elegida se abre dentro de la misma tarjeta: la única acción dorada («Empezar sesión»), sus ejercicios (miniatura de 40, «Músculo · Descanso 90 s», «3 × 10») y «Nombre e icono» tranquilo al final. «Mis rutinas»: «Nueva rutina» como píldora pequeña junto al título y cada rutina en una tarjeta compacta (nombre, recuento con músculos, tres miniaturas con «+N» —con letra grande, la que no cabe entera se oculta, nunca se ve cortada— y «Empezar» secundaria; Editar, Duplicar y Borrar en «···»). «Completar con el autopiloto» en una tarjeta compacta debajo.
- **Ficha de ejercicio** (biblioteca, `ExerciseDetail` / `ExerciseDetailView`) — héroe 16:9 (clip, foto o la silueta con su músculo), nombre en Title 1 con sus datos clave, secciones en Title 3 (12 hasta su contenido, 32 entre secciones: «Cómo se hace» numerado, «Músculos» en filas de dato, errores, consejos, seguridad, variantes, alternativas) y, al final, «Añadir a favoritos» como píldora secundaria y la autoría. En el iPhone la barra no repite el nombre.

## Acceso (`src/app/components/auth/AuthScreenParts.tsx`)

`AuthHero` (con `AuthAppMark`: el icono de la app de 64 px y AUTOPILOT debajo; `kicker={false}` para no repetir la marca), `AuthFieldGroup` / `AuthFieldRow` (cada campo es una píldora de 56 px con icono gris opcional a la izquierda, ojo en la contraseña y anillo dorado al enfocar; en nativo, `PillField(icon:)`), `AuthFieldNote`, `AuthSymbol`, `AuthNotice`. Login, registro, recuperar y nueva contraseña los comparten: se cambian aquí, no en cada página.

## Rediseño (ChatGPT, nov. 2026)

- Semana de Hoy: un círculo de 32 px por día (dorado con check si está hecho, anillo dorado hoy, anillo gris si toca sesión, relleno tenue en descanso).
- Cabecera de Nutrición (`NutritionHero` en la web, `nutritionHero` en la app): tarjeta de 28 con un anillo de 136 (trazo 12) y, a su lado, Proteína, Hidratos y Grasas con su barra. Sin comidas, el anillo reparte la energía (oro, oro 60 %, oro 32 %) y las kcal del día van dentro; con comidas, el anillo y las barras suman lo marcado.
- Selector de días del Plan: el día elegido en dorado macizo y hoy con anillo dorado.
- Control segmentado de Progreso: 44 px, fondo de tarjeta y la sección activa en dorado (`SegmentedPill(gold: true)` en nativo). El resto de controles segmentados siguen en gris.
