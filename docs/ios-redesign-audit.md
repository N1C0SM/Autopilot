# Auditoría de diseño — App iOS de Autopilot (Fase 0)

> Generada automáticamente como punto de partida. Cada pantalla se refinará al tocarla.
> Métricas: `gold` = usos de `Palette.gold`; `legacyR` = radios no del sistema (12/10/16/9/8/4/2/1); `stroke` = `strokeBorder`/`.border`; `shadow` = `.shadow`.

## Resumen global

- Paleta y tokens bien centralizados en `Theme.swift` (`Palette`, `GoldFill`, `RaisedFill`, `SurfaceBackground`, `Radius`).
- `Radius` solo define `card (22)` y `hero (28)`. Faltan `chip (14)` y `media (18)` como constantes; se usan literales en varios sitios → inconsistencia.
- Muchos radios legacy (12/10/16/9/8/4/2/1) en `cornerRadius:` → rompen la escala de radios del sistema.
- Varios archivos con alto conteo de `Palette.gold` (WorkoutView 42, ScanView 26, ProgressScreen 25, OnboardingView 23) → riesgo de "todo dorado".
- `strokeBorder`/`.border` aparecen en varios archivos → posible violación de "sin bordes de tarjeta".
- Web es la referencia; la app iOS ya sigue bastante el sistema pero con detalles legacy.

## Por pantalla

### Fase 1 — Arranque y acceso
| Pantalla | Archivo | gold | legacyR | stroke | shadow | Protagonista actual | Problemas / qué destaca de más |
|---|---|---|---|---|---|---|---|
| Splash | RootView | 4 | 1 | 0 | 0 | AppIconMark 110 | OK; revisar que no haya frame gris. |
| SignedOut/Welcome | OnboardingView | 23 | 2 | 2 | 0 | icono + titular | Alto gold → revisar que solo titular/botón sean dorados. Radios legacy 2. |
| Login | LoginView | 5 | 0 | 0 | 0 | titular | OK; verificar PillField y anillo dorado al enfocar. |
| ForgotPassword | LoginView (sheet) | — | — | — | — | — | Alinear con Login. |
| CreateAccount | OnboardingView | — | — | — | — | — | Alinear con Login. |
| OnboardingQuiz + PlanPreview | OnboardingView | 23 | 2 | 2 | 0 | fichas doradas | Revisar que fichas sean dorado tenue, no dorado macizo. |
| WhoIsTraining + Avatar + Unlock | WhoIsTrainingView | 3 | 0 | 0 | 0 | avatar | OK; filas píldora. |
| SessionIdentity | TrainView | — | — | — | — | — | Alinear con acceso. |

### Fase 2 — Shell
| Pantalla | Archivo | gold | legacyR | stroke | shadow | Protagonista actual | Problemas |
|---|---|---|---|---|---|---|---|
| MainShell | RootView | 4 | 1 | 0 | 0 | pestaña activa + avatar | Revisar reserva de espacio bajo FloatingTabBar. |
| FloatingTabBar | Components | 14 | 0 | 0 | 2 | pestaña activa | 2 shadows → verificar que vengan de tokens (chrome). |
| NotificationsBell + Notices | NotificationsBell | 2 | 0 | 0 | 0 | — | OK. |
| Admin drawer | AdminSidebarView | 8 | 3 | 1 | 0 | sección activa | Radios legacy 3; alinear con shell. |

### Fase 3 — Hoy (Home)
| Pantalla | Archivo | gold | legacyR | stroke | shadow | Protagonista actual | Problemas |
|---|---|---|---|---|---|---|---|
| HomeView | HomeView | 9 | 6 | 0 | 0 | sesión del día | Radios legacy 6 (skeleton 4/8). 3 cifras en dayFigures compiten → considerar jerarquía (una protagonista). |
| TodaySessionSheet | HomeView | — | — | — | — | portada sesión | Verificar portada foto + degradado. |
| ConfettiView | HomeView | — | — | — | — | celebración | Solo en récord real. |

### Fase 4 — Entrenar (Train)
| Pantalla | Archivo | gold | legacyR | stroke | shadow | Protagonista actual | Problemas |
|---|---|---|---|---|---|---|---|
| TrainView | TrainView | 16 | 4 | 1 | 0 | sesión elegida | Alto gold; radios legacy 4. |
| PlanEditorView | PlanEditorView | 12 | 0 | 2 | 0 | — | 2 strokes → revisar bordes de tarjeta. |
| RoutinesView | RoutinesView | 8 | 1 | 0 | 0 | rutina | OK-ish. |
| RoutineDetailSheet | RoutineDetailSheet | 4 | 0 | 0 | 0 | — | OK. |
| ExercisePickerView | PlanEditorView | — | — | — | — | — | Alinear con biblioteca. |

### Fase 5 — Entreno activo (Workout)
| Pantalla | Archivo | gold | legacyR | stroke | shadow | Protagonista actual | Problemas |
|---|---|---|---|---|---|---|---|
| WorkoutView | WorkoutView | 42 | 3 | 7 | 0 | ejercicio actual + serie | Muy alto gold (42) y 7 strokes → principal candidato a "todo dorado". Revisar que solo la serie actual/finalizar sean dorados. |
| WorkoutSummaryView | WorkoutView | — | — | — | — | volumen/tiempo | Verificar cifra protagonista única. |
| WorkoutShareCard | WorkoutView | — | — | — | — | cifra Big Shoulders | Revisar rejilla STORY. |
| LiveActivity | WorkoutLiveActivity | 1 | 0 | 0 | 0 | cuenta atrás dorada | OK; verificar AP compartido. |

### Fase 6 — Ejercicios (Library)
| Pantalla | Archivo | gold | legacyR | stroke | shadow | Protagonista actual | Problemas |
|---|---|---|---|---|---|---|---|
| ExerciseLibraryView | ExerciseLibraryView | 10 | 2 | 2 | 0 | lista + búsqueda | 2 strokes → revisar bordes. |
| ExerciseDetailView | ExerciseLibraryView | — | — | — | — | héroe 16:9 | Verificar secciones Title 3 y espaciado (12/32). |

### Fase 7 — Progreso
| Pantalla | Archivo | gold | legacyR | stroke | shadow | Protagonista actual | Problemas |
|---|---|---|---|---|---|---|---|
| ProgressScreen | ProgressScreen | 25 | 4 | 0 | 0 | métrica/gráfico | Alto gold (25) → revisar que solo sección activa del segmentado sea dorada. Radios legacy 4. |

### Fase 8 — Nutrición
| Pantalla | Archivo | gold | legacyR | stroke | shadow | Protagonista actual | Problemas |
|---|---|---|---|---|---|---|---|
| NutritionView | OtherViews | 10 (total archivo) | 2 | 0 | 0 | anillo macros | Revisar que anillo sea único protagonista; comidas secundarias. |
| NutritionSetupView | NutritionSetupView | 6 | 0 | 0 | 0 | fichas doradas tenues | OK. |

### Fase 9 — Escáner
| Pantalla | Archivo | gold | legacyR | stroke | shadow | Protagonista actual | Problemas |
|---|---|---|---|---|---|---|---|
| ScanView | ScanView | 26 | 0 | 3 | 1 | resultado/nota | Alto gold (26) + 3 strokes + 1 shadow → candidato a simplificar. |
| ScanShareCardView | ScanShareCardView | — | — | — | — | nota en anillo dorado | Revisar. |

### Fase 10 — Ajustes / Cuenta
| Pantalla | Archivo | gold | legacyR | stroke | shadow | Protagonista actual | Problemas |
|---|---|---|---|---|---|---|---|
| AccountView | AccountView | 15 | 1 | 0 | 0 | avatar/plan | OK-ish; revisar una sola acción dorada por sección. |

### Fase 11 — Entrenador
| Pantalla | Archivo | gold | legacyR | stroke | shadow | Protagonista actual | Problemas |
|---|---|---|---|---|---|---|---|
| TrainerClientsView / TrainerProfileView | OtherViews | — | — | — | — | cliente/perfil | Alinear tokens. |

### Fase 12 — Admin
| Pantalla | Archivo | gold | legacyR | stroke | shadow | Protagonista actual | Problemas |
|---|---|---|---|---|---|---|---|
| Admin* | Admin/* | varios | varios | varios | varios | densidad funcional | Solo alinear tokens/radios/estados; no rediseño denso. |

### Fase 13 — Compartir / Live Activity / Widgets
| Pantalla | Archivo | gold | legacyR | stroke | shadow | Protagonista actual | Problemas |
|---|---|---|---|---|---|---|---|
| ShareStory* | ShareStory | 3 | 0 | 0 | 0 | cifra Big Shoulders | OK. |
| WorkoutLiveActivity | WorkoutLiveActivity | 1 | 0 | 0 | 0 | cuenta atrás dorada | OK. |

### Fase 14 — Correos
| Pantalla | Archivo | gold | legacyR | stroke | shadow | Protagonista actual | Problemas |
|---|---|---|---|---|---|---|---|
| Emails | AdminEmailsView + edge | — | — | — | — | — | Solo estilos (fondo negro, dorado #D6B45B, AP). |

## Cambios realizados (pass 1)

- `Theme.swift`: añadidas constantes `Radius.chip (14)` y `Radius.media (18)`.
- Radios legacy (12/10/9/16/4/8) normalizados a `Radius.chip/media` en: HomeView, TrainView, ProgressScreen, OtherViews, AccountView, ExerciseLibraryView, RoutinesView, WorkoutView, RootView, OnboardingView, y Admin/*.
- `WelcomeView`: "Ya tengo cuenta" dejó de ser dorado (solo "Crear mi rutina gratis" es la acción dorada); radio del icono de feature 8→14.
- `HomeView`: cifras de `dayFigures` reducidas (44/34 → 34/28) para que la sesión del día sea la protagonista.
- `ScanView`: eliminado el glow dorado de la línea de escaneo (neón).
- `ProgressScreen`: "Tu último scan" pasó de dorado a muted (menos acento decorativo).
- `OnboardingView`: tarjetas de opciones 16→14.

## Acciones recomendadas (orden de ataque) (pendientes)

1. **Añadir constantes** `Radius.chip = 14`, `Radius.media = 18` en `Theme.swift` (y documentar) para eliminar literales.
2. **WorkoutView**: reducir gold de 42 a los imprescindibles (serie actual, Finalizar, estado hecho). Quitar 7 strokes.
3. **ScanView**: reducir gold de 26; eliminar 3 strokes y 1 shadow custom.
4. **ProgressScreen**: reducir gold de 25; solo segmentado activo dorado.
5. **OnboardingView**: revisar 23 gold; fichas dorado tenue.
6. **HomeView**: arreglar 6 radios legacy (skeleton); decidir jerarquía de las 3 cifras.
7. **Radios legacy** en todos los archivos (12/10/16/9/8/4/2/1) → mapear a 14/18/22/28/píldora.
8. **strokeBorder/.border** → eliminar en tarjetas; dejar solo separadores finos dentro de listas.

## Notas

- Esta auditoría es de código, no visual (sin capturas del simulador). Capturas reales se tomarán al compilar/ejecutar.
- No se ha tocado código aún (Fase 0). Siguiente: Fase 1 (arranque y acceso) tras tu aprobación.