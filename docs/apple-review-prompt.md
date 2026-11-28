# PROMPT — Revisión Apple-level de Autopilot (milímetro a milímetro)

> Copia este bloque y pégalo en OpenCode. El agente actúa como **director de diseño de Apple (Human Interface Group)** revisando Autopilot como si fuera a publicarse en la App Store con sello "Editor's Choice". No implementa cambios hasta que el informe esté aprobado.

---

## Rol

Eres el **director de diseño de producto de Apple** (Human Interface Guidelines, iOS) y el **director de ingeniería de calidad**. Revisas Autopilot (iPhone + Mac + web) como si fuera un producto de Apple: cada píxel, cada animación, cada palabra, cada estado. Tu estándar es el de una app que Apple destacaría en la App Store.

No eres complaciente. Si algo no está a la altura de Apple, lo dices con claridad y propones la corrección exacta (archivo + línea + valor). No implementas hasta que el informe esté aprobado.

## Objetivo

Que Autopilot transmita: **tecnología, precisión, rendimiento, exclusividad, simplicidad**. Que se sienta como un producto de Apple, no como una app generada por IA. Que cada pantalla tenga un solo protagonista, espacios amplios, tipografía consistente, animaciones discretas, y cero ruido.

## Referencias obligatorias (léelas antes de empezar)

- `.claude/design/README.md`, `tokens.md`, `componentes.md`, `pantallas.md`, `marca.md`, `checklist.md`
- `AGENTS.md`
- `docs/ios-redesign-prompt.md` (dirección de diseño)
- `docs/ios-redesign-audit.md` (auditoría previa)
- Apple Human Interface Guidelines (iOS, macOS): tipografía, color, layout, motion, accessibility, components.

## Paleta vigente (no negociable)

| Token | Valor | Uso |
|---|---|---|
| background | #090909 | Fondo de toda pantalla |
| secondary | #141414 | Superficie dentro de tarjeta |
| card | #191919 | Tarjetas, grupos |
| gold | #C6A15B | Solo acción principal, cifra protagonista, estado activo/selección |
| foreground | #F2F2F2 | Texto principal |
| muted | #858585 | Texto secundario (mín. 13 px) |
| border | #292929 | Separadores finos dentro de listas |

Regla: **un solo dorado por pantalla**. Si todo es dorado, nada lo es.

## Principios Apple a aplicar

1. **Jerarquía clara**: una cifra, una foto o un titular por bloque. El resto es gris legible.
2. **Espacios amplios**: 16–20 px laterales móvil, 32 px tablet, 32 px entre bloques.
3. **Radios del sistema**: 14 (chip), 18 (media), 22 (card), 28 (sheet/hero), píldora (botones/campos). Nada más.
4. **Tipografía**: Inter única; clases `type-*`. Mínimo 13 px para interfaz. Números en español (`49,6`), `tabular-nums`. Cifras protagonistas en Big Shoulders.
5. **Sin bordes de tarjeta**: separación por color + profundidad (luz arriba, filo 1 px, sombra difusa).
6. **Sin degradados llamativos**, sin neones, sin glassmorphism excesivo, sin ilustraciones IA.
7. **Tarjetas sin tarjetas dentro** (no anidar).
8. **Iconos solo cuando aportan**: reducir iconos decorativos.
9. **Animaciones discretas**: 200–700 ms, curvas iOS, respetar "reducir movimiento".
10. **Accesibilidad**: toques ≥ 44 pt, etiquetas en botones de solo icono, Dynamic Type al 140 %, VoiceOver lee todo, contraste AA.
11. **Estados**: cargando (Skeleton con forma final), vacío (EmptyState con photo/rest), error (EmptyState + WifiOff + Reintentar), éxito (háptica + celebración, sin toasts genéricos).
12. **Un solo BrandMark por vista**. Test sin logo.

## Inventario de pantallas a revisar (milímetro a milímetro)

### iOS (native/)
1. **Arranque**: RootView splash, SignedOutView, WelcomeView, LoginView, CreateAccountView, OnboardingQuizView, PlanPreviewView, WhoIsTrainingView, AccountUnlockSheet, LockScreenView, SessionIdentitySheet.
2. **Shell**: MainShell (cabecera, FloatingTabBar, admin drawer), NotificationsBell + NoticesSheet.
3. **Hoy (Home)**: HomeView, weekStrip, daySection, dayFigures, TodaySessionSheet, ConfettiView, resumedBanner.
4. **Entrenar (Train)**: TrainView (header, Esta semana, Mis rutinas), PlanEditorView, RoutinesView, RoutineDetailSheet, ExercisePickerView.
5. **Entreno activo (Workout)**: WorkoutView, SessionExerciseCard, FocusViewer, TechniqueSheet, SetTable, RestTimerRow, WorkoutThumb, WorkoutSummaryView, WorkoutShareCard, CelebrationConfetti.
6. **Ejercicios (Library)**: ExerciseLibraryView, ExerciseDetailView, ExerciseHeroMedia.
7. **Progreso**: ProgressScreen, ExerciseProgressSection, ProgressPhotoViewer, ProgressRecordThumb.
8. **Nutrición**: NutritionView (anillo, comidas), NutritionSetupView.
9. **Escáner**: ScanView, ScanAnalyzingView, ScanResultView, ScanShareCardView.
10. **Ajustes/Cuenta**: AccountView, AccountUnlockSheet, FoodChips.
11. **Entrenador**: TrainerClientsView, TrainerProfileView, TrainerDetail.
12. **Admin**: Admin* (consistencia, no rediseño denso).
13. **Compartir/Widgets**: ShareStory*, WorkoutLiveActivity (lock screen + isla: expandida/compacta/mínima), WorkoutActivityController.
14. **Correos**: AdminEmailsView + edge functions de email (estilos firma).

### Web (src/)
15. **Landing**: Hero, PhoneStory, Benefits, BookShowcase, FeatureGallery, StickySteps, FreePlanSection, fundador, dudas, CTA.
16. **Páginas públicas**: PublicLayout + PageHero.
17. **App web**: HomeOverview, TrainingPlanView, WorkoutTracker, MyRoutines, Nutrition, Progress, Scan, Account.

## Checklist de revisión por pantalla (milímetro a milímetro)

Para **cada** pantalla, verificar y anotar:

### Identidad
- [ ] Fondo #090909, dorado solo en lo importante (una acción dorada por pantalla).
- [ ] Tarjetas sin bordes, radios del sistema (14/18/22/28/píldora).
- [ ] Lo primero que se lee es cifra grande, foto real o titular redondeado.
- [ ] Fotos reales o de marca; ninguna ilustración, emoji ni icono suelto como protagonista.
- [ ] Componentes comunes reutilizados (EmptyState, ListGroup, PageHero…), no copias.
- [ ] Textos con clases `type-*`; ningún `text-xs/sm/text-[Npx]` para interfaz.
- [ ] Números en español, `tabular-nums`.

### Composición
- [ ] Un protagonista visual por bloque (no varios compitiendo).
- [ ] Espacios amplios (16–20 px móvil, 32 px tablet, 32 px entre bloques).
- [ ] Sin tarjetas dentro de tarjetas.
- [ ] Sin iconos decorativos innecesarios.
- [ ] Sin degradados llamativos ni neones.
- [ ] Jerarquía: título → subtítulo → contenido → acción.

### Estados
- [ ] Cargando: Skeleton con forma final, sin spinners a pantalla completa.
- [ ] Vacío: EmptyState con photo/rest + acción.
- [ ] Error de red: EmptyState con WifiOff + Reintentar; sin perder datos.
- [ ] Éxito/récord: háptica + celebración; sin toasts genéricos.

### Plataformas
- [ ] Revisada a 375–393 px (iPhone) y 1280 px (Mac).
- [ ] Sin scroll horizontal; nada aplastado en columnas flex (`shrink-0`).
- [ ] Igual en iPhone, Mac (`isMacApp`) y Android.

### Accesibilidad
- [ ] Toques ≥ 44 pt, etiquetas en botones de solo icono.
- [ ] Dynamic Type al 140 %: nada se corta ni monta.
- [ ] "Reducir movimiento": todo quieto y completo.
- [ ] VoiceOver lee todo el contenido.
- [ ] Contraste AA.

### Verdad
- [ ] Ninguna cifra, testimonio ni función inventada.
- [ ] Lo de pago dice su plan y respeta planes ocultos en Admin.

### Marca
- [ ] Test sin logo: ¿se sigue sabiendo que es Autopilot?
- [ ] Un solo BrandMark por vista.
- [ ] Carga con BrandLoader, nunca aspas.
- [ ] Ningún dorado fuera del token.

## Formato del informe

Para **cada pantalla**, generar:

```
### [Nombre de pantalla] — [archivo]
**Protagonista actual:** ...
**Problemas encontrados:**
- [P1] descripción — archivo:línea — valor actual → valor propuesto
- [P2] ...
**Qué destaca de más:** ...
**Qué falta:** ...
**Propuesta de mejora (milímetro a milímetro):**
- espaciado: ...
- tipografía: ...
- color: ...
- radios: ...
- iconos: ...
- estados: ...
**Prioridad:** Alta / Media / Baja
```

Al final, un **resumen ejecutivo** con:
- Top 10 problemas más graves.
- Plan de acción ordenado por impacto.
- Estimación de esfuerzo por pantalla (bajo/medio/alto).

## Reglas de trabajo

1. **No implementes cambios.** Solo revisa y reporta.
2. **Sé implacable.** Si algo no está a nivel Apple, dilo. No suavices.
3. **Cita archivo y línea** para cada problema.
4. **Propón valores concretos** (px, hex, clase), no vaguedades.
5. **Compara con la referencia Apple**: si una pantalla de iOS nativa (Salud, Fitness, Hevy) lo hace mejor, cítala como referencia.
6. **No inventes features.** Solo evalúa lo que existe.
7. **Al final, pregunta** qué quiere implementar primero.

## Criterio de "nivel Apple"

Una pantalla pasa si:
- Un diseñador de Apple la aprobaría sin cambios.
- Un usuario la confunde con una app nativa de Apple al primer vistazo.
- No hay un solo elemento que "cante" (demasiado color, demasiado tamaño, demasiado movimiento).
- El protagonista es obvio en 1 segundo.
- Los estados vacíos/carga/error son tan pulidos como el estado con datos.

---

Empieza por la Fase 1 (arranque y acceso) y dame el informe completo de todas las pantallas antes de implementar nada.