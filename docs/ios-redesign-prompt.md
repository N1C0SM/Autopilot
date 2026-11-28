# PROMPT — Rediseño premium de la app iOS de Autopilot (pantalla por pantalla)

> Copia todo este bloque y pégalo en OpenCode como prompt inicial. El agente debe ejecutarlo por fases, pantalla por pantalla, sin saltarse verificaciones.

---

## Rol y contexto

Eres un **diseñador de producto senior + ingeniero iOS/SwiftUI** trabajando en el repo **Autopilot** (fitness: entrenamiento, nutrición, progreso, escáner corporal). El proyecto es un solo producto en cuatro sitios: web (`src/web` + `src/app`), iPhone (SwiftUI, `native/`), Mac (SwiftUI) y Android (Capacitor). La referencia de diseño es la landing web y `.claude/design/` (README, tokens, componentes, pantallas, marca, checklist). Antes de tocar nada, lee `.claude/design/README.md`, `tokens.md`, `componentes.md`, `pantallas.md`, `marca.md` y `checklist.md`, y `AGENTS.md`.

## Objetivo

Que la app de **iPhone** sea la mejor app fitness del mundo: cada pantalla con **jerarquía clara, un solo elemento protagonista y restraint**. Lo guay es que **algo destaque en cada pantalla, no todo**. Evitar el look "IA" (todo dorado, neones, glassmorphism, animaciones innecesarias, iconos sueltos como protagonista).

## Filosofía (restraint) — léela antes de cada pantalla

1. **Un protagonista por bloque**: una cifra grande, una foto real, o un titular redondeado. El resto es gris legible (`text-muted-foreground`).
2. **Dorado solo donde importa**: acción principal, cifra protagonista, estado activo, palabra clave. Si todo es dorado, nada lo es. Una sola acción dorada por pantalla.
3. **Sin neones, sin degradados multicolor, sin glassmorphism excesivo, sin sombras escritas a mano.** Solo tokens de profundidad (`--surface-sheen`, `--gold-sheen`, `--control-*`, `--chrome-*` y sus gemelos en `Theme.swift`).
4. **Tarjetas sin borde** (separación por color + profundidad). Radios del sistema: 14 (chip), 18 (media), 22 (card), 28 (sheet/hero), píldora (botones/campos).
5. **Texto mínimo 13 px** (`type-footnote`). Prohibido `text-[10/11px]`, `text-xs/sm` para interfaz. Números en español (`49,6`, `2.366`), `tabular-nums`.
6. **Estados del entrenamiento** (una sola escala): pendiente `bg-secondary` + muted; activo `bg-card` + borde dorado 30% + número dorado; hecho `bg-primary/15` + check dorado; fallo solo etiqueta "Fallo" en destructive.
7. **Empty states** siempre con `EmptyStateView` (`photo` o `rest`), nunca un icono pequeño suelto. En positivo ("Todo al día", no "Sin…").
8. **Fotos reales o de marca**; ninguna ilustración, emoji ni icono suelto como protagonista. Un solo `BrandMark` por vista.
9. **Movimiento físico y opcional**: 200–700 ms, curvas iOS; con "reducir movimiento" todo quieto y completo. Háptica 2-1-2 solo al cerrar una serie.
10. **Accesible siempre**: toques ≥ 44 pt, etiquetas en botones de solo icono, Dynamic Type al 140%, VoiceOver lee todo.

## Reglas duras (no negociables)

- **Solo UI.** No toques lógica, modelos, Supabase, edge functions, servicios ni flujos de datos. Si un cambio requiere lógica, detente y pregúntame.
- **Reutiliza.** Antes de crear una pieza nueva, busca en `componentes.md` y `Theme.swift`/`Components.swift`. Si no encaja, amplía el componente común y documéntalo. No copies y modifiques.
- **Paridad.** Web y nativo son un producto. Si cambias un patrón visual, aplícalo también en la web cuando exista equivalente; si no, al menos no rompas paridad. `src/shared/test/platformParity.test.ts` debe seguir en verde.
- **Verdad.** Ninguna cifra, testimonio ni función inventada. Lo de pago dice su plan y respeta planes ocultos en Admin (`usePlanAvailability`).
- **Correos y emails**: solo ajustar estilos a la firma de marca (fondo negro, dorado `#D6B45B`); no cambiar contenido ni plantillas de negocio.
- **Admin**: priorizar consistencia sobre belleza; no rediseñar denso, solo alinear tokens/radios/estados.
- **Live Activity / Dynamic Island**: mantener legibilidad en tamaños pequeños; un solo acento dorado; AP compartido desde `Shared/BrandShape.swift`.
- **Commits pequeños**: uno por pantalla o grupo de pantallas, mensaje `redesign(ios): <pantalla>`.
- **No añadas features nuevas.** Solo rediseño.

## Referencia de identidad (marca)

- Monograma AP dorado (una sola por vista), icono de app en cuadro dorado, cifras en Big Shoulders (`Font.figure`), háptica 2-1-2, loader con AP latiendo (`BrandLoader`), fotos con gradación ámbar y fundido a negro.
- Test sin logo: si tapo el logo, ¿se sigue sabiendo que es Autopilot?

## Inventario de pantallas a rediseñar

Trabaja en este orden. Para cada pantalla: lee su archivo, identifica el protagonista, ajusta jerarquía/espaciado/radios/colores/tipografía, mantén la lógica intacta, verifica.

### Fase 0 — Auditoría visual
- [ ] Recorre todas las pantallas del inventario y anota (en un archivo `docs/ios-redesign-audit.md`) el estado actual: protagonista actual, problemas, qué destaca de más.
- [ ] Capturas del simulador (375–393 px) de cada pantalla antes.

### Fase 1 — Arranque y acceso
Archivos: `RootView.swift`, `Auth/OnboardingView.swift`, `Auth/LoginView.swift`, `Auth/WhoIsTrainingView.swift`, `Other/OtherViews.swift` (si aplica).
- `RootView` splash: `AppIconMark` 110, fondo negro.
- `SignedOutView`, `WelcomeView`: icono de app 64 + AUTOPILOT, titular redondeado, campos píldora, botón dorado. Un solo protagonista (titular o icono).
- `LoginView` + `ForgotPasswordSheet`: `AuthFieldGroup`/`AuthFieldRow` equivalentes nativos (`PillField`), ojo en contraseña, anillo dorado al enfocar.
- `CreateAccountView`: mismo patrón.
- `OnboardingQuizView` + `PlanPreviewView`: títulos Title 3, fichas en dorado tenue, una acción dorada.
- `WhoIsTrainingView` + `AvatarView` + `AccountUnlockSheet`: filas píldora (avatar, nombre, correo), "Añadir cuenta". Sin saturación.
- `LockScreenView` (si existe): AP + cifra en dorado.
- `SessionIdentitySheet`: mismo patrón de acceso.

Destacado: titular redondeado o icono de app, no todo.

### Fase 2 — Shell
Archivos: `Shell/RootView.swift` (MainShell), `Shell/NotificationsBell.swift`, `Design/Components.swift` (FloatingTabBar, HeaderButtons, HomeQuickMenu).
- `MainShell`: cabecera con campana y avatar en círculos, "Hoy" centrado; barra flotante en píldora abajo con `nav-chrome`. Reserva espacio para que el contenido no quede bajo la barra.
- `FloatingTabBar`: 44 px de toque, icono 22 + etiqueta 12; activo en dorado. Solo un acento.
- `NotificationsBell` + `NoticesSheet`: lista tipo `ListGroup`, sin bordes.
- Admin drawer (iPhone): cajón 310 px, cierre al elegir. Consistencia de tokens.

Destacado: la pestaña activa y el avatar; el resto secundario.

### Fase 3 — Hoy (Home)
Archivos: `Features/Home/HomeView.swift` (HomeView, ResultMetrics, RecordsCard, TodaySessionSheet, ConfettiView), `Features/Home/RoutineDetailSheet.swift`.
- Semana: círculo 32 por día (dorado con check si hecho, anillo dorado hoy, anillo gris si toca, relleno tenue en descanso).
- Protagonista: una cifra grande (kcal del día o kg levantados) o portada de sesión. No varias cifras grandes.
- `ResultMetrics`, `RecordsCard`: cifra protagonista con halo + datos secundarios.
- `TodaySessionSheet`: portada foto real a sangre con degradado negro y titular encima, radio 28.
- `ConfettiView`/celebración: solo en récord real, háptica + `RecordCelebration` equivalente. Sin toasts genéricos.
- Empty/rest: `EmptyStateView` con `rest` para descanso.

Destacado: la cifra del día o la portada de sesión.

### Fase 4 — Entrenar (Train)
Archivos: `Features/Train/TrainView.swift`, `PlanEditorView.swift`, `RoutinesView.swift`, `Features/Home/RoutineDetailSheet.swift`.
- Modo del plan en una frase (`planModeLine`).
- "Entreno vacío" y "Ejercicios" en píldoras tranquilas (secundarias con relieve).
- "Esta semana": Title 3, "Editar", progreso en tramos ("1 de 4").
- Sesiones en **una sola tarjeta**: miniatura 56 (radio 14), nombre, músculos, "6 ejercicios · ≈ 45 min" (`DayPlan.summaryLine`), estado ("Hoy" píldora dorada tenue, "Hecha" check dorado, "Siguiente" gris). La elegida se abre dentro de la misma tarjeta: única acción dorada "Empezar sesión", ejercicios (miniatura 40, "Músculo · Descanso 90 s", "3 × 10"), "Nombre e icono" tranquilo al final.
- "Mis rutinas": "Nueva rutina" píldora pequeña junto al título; cada rutina en tarjeta compacta (nombre, recuento con músculos, tres miniaturas con "+N", "Empezar" secundaria; Editar/Duplicar/Borrar en "···").
- "Completar con el autopiloto" en tarjeta compacta debajo.
- `PlanEditorView`: jerarquía clara, una acción dorada.
- `ExercisePickerView`: lista con miniaturas reales.

Destacado: la sesión elegida o la próxima sesión.

### Fase 5 — Entreno activo (Workout)
Archivos: `Features/Train/WorkoutView.swift`, `WorkoutActivityController.swift` (widget), `WorkoutSummaryView` (en WorkoutView.swift), `WorkoutShareCard` (en WorkoutView.swift).
- Un foco por pantalla. Arriba "‹ Salir · sesión · ···" (añadir ejercicio, vista, "Más opciones por serie", descartar).
- Ejercicios numerados en círculos de 44 (aro dorado el que ves, check sobre tinte dorado los hechos).
- Ejercicio en portada 28 con clip/foto (sin foto, músculo en silueta) y ficha (i).
- Nombre Title 1 con "···" (ver técnica, cambiar, superserie).
- Solo tabla **Serie · Anterior · kg · Reps · ✓** (celdas 44, radio 14; hecha = fila dorada al 15% sin cajas; actual con filo dorado; calentamiento "C").
- Pie fijo: descanso en barra tranquila (−15 s, +15 s, "Saltar") y Pausar · tiempo ("3 de 12 series") · Finalizar (única acción dorada).
- `ExerciseSwap` admite `open`/`trigger={false}` para abrirse desde "···".
- `WorkoutSummaryView`: cifra protagonista (volumen/tiempo), háptica + celebración si récord; sin toasts.
- `WorkoutShareCard` (historia): rejilla `STORY` + `ShareStory.swift` (360×640 ×3), foto real del primer ejercicio hecho fundida a negro o mapa muscular en dorado, fecha, sesión y músculos, una cifra Big Shoulders, logro en cápsula dorada si sube, 2–3 cifras de apoyo, firma AP + autopilotplan.com.

Destacado: el ejercicio actual y la serie en curso.

### Fase 6 — Ejercicios (Library)
Archivos: `Features/Train/ExerciseLibraryView.swift`, `ExerciseDetailView` (mismo archivo).
- `ExerciseLibraryView`: lista con miniaturas reales a la izquierda, búsqueda píldora. Empty state con `EmptyStateView`.
- `ExerciseDetailView`: héroe 16:9 (clip/foto/silueta con músculo), nombre Title 1 con datos clave, secciones Title 3 (12 hasta contenido, 32 entre secciones: "Cómo se hace" numerado, "Músculos" filas de dato, errores, consejos, seguridad, variantes, alternativas). Al final "Añadir a favoritos" píldora secundaria y autoría. En iPhone la barra no repite el nombre.
- `ExerciseHeroMedia`: clip o foto; si no, silueta con músculo.

Destacado: el héroe del ejercicio.

### Fase 7 — Progreso
Archivos: `Features/Progress/ProgressScreen.swift`.
- `ProgressScreen`: control segmentado 44 px, fondo de tarjeta, sección activa en dorado (`SegmentedPill(gold: true)`). Resto de segmentados en gris.
- Protagonista: una cifra o gráfica principal. Datos secundarios en gris.
- `ExerciseProgressSection`, `ProgressRecordThumb`, `ProgressPhotoViewer`: miniaturas reales, cifras en Big Shoulders.
- Empty state con `EmptyStateView` + acción.

Destacado: la métrica principal o el gráfico.

### Fase 8 — Nutrición
Archivos: `Features/Other/OtherViews.swift` (NutritionView, NutritionSkeleton, MacrosWeightCard, MealsStateCard, MealPhoto, EmptyCardPhoto, TrainerClientsView, TrainerProfileView), `Features/Other/NutritionSetupView.swift`.
- `NutritionView`: cabecera tarjeta 28 con anillo 136 (trazo 12) y Proteína/Hidratos/Grasas con barra. Sin comidas, el anillo reparte energía (oro, oro 60%, oro 32%) y kcal del día dentro; con comidas, anillo y barras suman lo marcado.
- Nutrición minimalista: sin subtítulo ni relleno; anillo único protagonista. Sin comidas, aviso de estimación y "Actualizar mis datos" como acción de texto (`estimateNoteView`) fuera de la tarjeta.
- "Comidas de hoy" (Title 3) con "···" (Regenerar comidas, Actualizar mis datos) y filas en un solo grupo: foto 48 radio 14 (o ninguna), nombre, plato en dos líneas, "640 kcal · P 40 g · H 62 g · G 14 g" en una línea tranquila y check a la derecha.
- Estados: carga con esqueleto del anillo; error con `EmptyStateView` + "Reintentar"; Plus preparando con foto del plato y AP; "Preparar mis comidas" si no salieron.
- En Gratis: una sola fila de Plus (losa 32, "Comidas de cada día", una línea y `PlusBadge`).
- `NutritionSetupView`: títulos Title 3, fichas en dorado tenue.

Destacado: el anillo de macros.

### Fase 9 — Escáner
Archivos: `Features/Scan/ScanView.swift`, `ScanShareCardView.swift`.
- `ScanView`, `ScanAnalyzingView`, `ScanResultView`: una cifra/resultado protagonista, resto secundario. `ScoreTile`, `UnitTile` con radios del sistema.
- `ScanShareCardView`: historia con la nota dentro de su anillo dorado, sin fotos de la persona. Rejilla `STORY` + `ShareStory`.

Destacado: la nota/resultado dentro del anillo.

### Fase 10 — Ajustes / Cuenta
Archivos: `Features/Account/AccountView.swift`.
- `AccountView`: listas `ListGroup`/`ListRow`, sin bordes. Avatar circular. `SubscriptionBadge`, `PlusBadge` donde aplica.
- `AccountUnlockSheet`, `FoodChips`: píldoras.
- Una sola acción dorada por sección.

Destacado: el avatar o el plan actual.

### Fase 11 — Entrenador
Archivos: `Other/OtherViews.swift` (TrainerClientsView, TrainerProfileView), `Admin/AdminTrainers.swift` (TrainerDetail).
- Listas con miniaturas reales, cifras secundarias. Consistencia de tokens. Sin saturación.

Destacado: el cliente o perfil.

### Fase 12 — Admin (consistencia, no rediseño profundo)
Archivos: `Features/Admin/*`.
- Alinear tokens/radios/estados. Mantener densidad funcional. No inventar adornos. Asegurar que `PlusBadge`, `PaymentDot`, etc. usan tokens.
- `AdminSidebarView` (cajón) consistente con shell.

### Fase 13 — Compartir / Live Activity / Widgets
Archivos: `Design/ShareStory.swift`, `AutopilotWidgets/WorkoutLiveActivity.swift`, `Shared/BrandShape.swift`.
- `ShareStory*`: rejilla `STORY`, márgenes seguros, AP + autopilotplan.com al pie, cifras Big Shoulders, un solo acento dorado.
- `WorkoutLiveActivity`: AP en pantalla de bloqueo e isla (expandida/compacta/mínima), ejercicio, "Serie X de Y", cuenta atrás del descanso en dorado, tiempo de sesión con `Text(timerInterval:)` (quietos en pausa, "En pausa").
- `WorkoutActivityController`: empieza con la sesión, sigue cada cambio, termina al finalizar (15 min con "Entreno completado") o al descartar (al momento).

Destacado: la cifra/cuenta atrás.

### Fase 14 — Correos (emails)
- Revisar plantillas de email (AdminEmailsView + edge functions de email) para que sigan la firma: fondo negro, dorado `#D6B45B`, AP, cifras Big Shoulders si aplica. Solo estilos, no contenido.

### Fase 15 — Verificación final
- [ ] `.claude/design/checklist.md` pasa en cada pantalla.
- [ ] `npx vitest run` verde.
- [ ] `npx tsc --noEmit -p tsconfig.app.json` verde.
- [ ] xcodebuild compila (iPhone + Mac).
- [ ] `src/shared/test/platformParity.test.ts` verde.
- [ ] Reduced motion y VoiceOver verificados.
- [ ] Capturas después (375–393 px y 1280 px).
- [ ] Test sin logo.

## Entregables por pantalla

Para cada pantalla rediseñada:
1. Archivo(s) tocados.
2. Capturas antes/después (simulador) si es posible.
3. Commit `redesign(ios): <pantalla>`.
4. Nota de qué es el protagonista y qué se quitó para reducir ruido.

## Cómo trabajar (instrucciones para el agente)

1. **Una pantalla a la vez.** No reescribas todo de golpe. Antes de tocar, lee el archivo y los componentes que usa.
2. **No cambies lógica.** Si necesitas mover algo para el diseño, hazlo con cuidado y sin alterar comportamiento. Si dudas, pregunta.
3. **Mantén los tokens.** Usa `Palette.*`, `Font.inter`, `Font.figure`, `.surface()`, `PillButtonStyle`, `SegmentedPill`, etc. No inventes colores ni sombras.
4. **Compara con la web.** La landing y la app web son la referencia visual. Si hay equivalente, iguala.
5. **Verifica tras cada pantalla**: compila, tests relevantes, reduced motion.
6. **Si una pantalla tiene sub-vistas, trátalas como una sola experiencia** (mismo protagonista, mismo ritmo).
7. **Documenta** decisiones no obvias en comentarios breves o en `docs/ios-redesign-audit.md`.

## Criterios de aceptación global

- Checklist `.claude/design/checklist.md` pasa en todas las pantallas.
- `npx vitest run` en verde.
- `npx tsc --noEmit -p tsconfig.app.json` en verde.
- xcodebuild compila iPhone y Mac.
- `platformParity.test.ts` en verde.
- Reduced motion y VoiceOver verificados.
- Un protagonista por pantalla; test sin logo pasa.

## Nota final

Si en algún punto el rediseño exige una decisión de producto (p. ej., cambiar el protagonista de una pantalla, o eliminar un elemento), **pregunta antes de actuar**. La prioridad es restraint y jerarquía, no añadir.

---

Empieza por la Fase 0 (auditoría) y dame un resumen antes de tocar código.