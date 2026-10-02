# Registro, historial y seguimiento — revisión de implementación

## Arquitectura y alcance

Base: `origin/main` en `4281a3a`. React/Vite/TypeScript, componentes shadcn, Supabase Auth y PostgreSQL con RLS. Se conservan los roles y `is_trainer_of`, el plan JSON existente y las tablas históricas. No se despliega ni se aplica SQL a servicios remotos.

- Registro con metadatos explícitos: pesas, calistenia dinámica, isométricos y cardio. Variantes, lastre/asistencia, segundos, distancia opcional, notas, duplicados y series adicionales. El editor de la biblioteca y el constructor de rutinas permiten configurar el tipo y los objetivos.
- Cada sesión captura nombre, fecha civil local, zona IANA, ejercicios, identidad de catálogo, variante, objetivos y resultados. No tiene dependencias de borrado sobre rutinas o ejercicios.
- Anterior/Objetivo/Hoy separados. La referencia anterior viene de la última sesión finalizada con el mismo ejercicio, tipo, variante, modo de carga y asistencia descrita, aunque fuera otro día de la semana.
- Finalización parcial con al menos una serie válida. La casilla de completada es explícita: introducir un número no convierte por sí solo una serie en trabajo realizado. Modificar un resultado desmarca esa serie para su validación.
- Copia local síncrona por usuario y cola de sincronización. Cada intento mantiene UUID y revisión. También se conserva el intento de resultado incierto, para poder reproducirlo antes de sincronizar cambios posteriores. Las revisiones incompatibles se rechazan: no se sobreescribe silenciosamente otro dispositivo.
- Calendario, detalle, correcciones con motivo y auditoría. Las métricas se calculan desde los resultados actuales, no desde récords acumulados que quedarían obsoletos tras corregirlos. Se retiran de las pantallas activas las listas antiguas de PR que no distinguían tipos.
- Filtros de 7/30/90 días o todo; mejor serie y referencia a su sesión; misma carga/mismas repeticiones; segundos; RPE; series semanales por músculo; media semanal de peso.
- Propuestas con reglas editables en la vista, motivos y registros de evidencia. La aprobación de un nuevo objetivo de carga corresponde al entrenador asignado o administrador. El objetivo aprobado se aplica a sesiones futuras creadas con la misma identidad y variante; no altera sesiones ya iniciadas ni resultados anteriores.
- Alimentación registrada por fecha: alimentos, gramos, sustituciones, comidas adicionales y correcciones. Valores por 100 g con fuente indicada; los desconocidos permanecen desconocidos. Cada alimento se añade como un registro, pudiendo compartir nombre de comida. Se mantiene el menú previsto y sus marcas rápidas locales, identificadas como seguimiento sencillo sin cálculo de consumo.
- Entrenador: cola de sesiones finalizadas sin revisión del equipo, acceso a datos fuente, cumplimiento, gráficas, consumo y ajustes explicados. La cola muestra las 500 sesiones más recientes y permite actualizarla.

## Fórmulas y comparabilidad

| Dato | Criterio |
| --- | --- |
| Sesión realizada | Estado finalizado y al menos una serie completada con resultado válido. |
| Cumplimiento | `redondear(100 × series previstas completadas / series previstas)`. 10/12 = 83 %. Las adicionales no inflan el cumplimiento. Sin objetivos históricos fiables se muestra desconocido. |
| Serie válida | Repeticiones enteras positivas, o segundos positivos en isométricos/cardio; carga no negativa cuando corresponde; RPE opcional de 1 a 10. |
| Volumen externo | Suma de kg × repeticiones de series completadas de pesas con carga externa. No se equipara a mejora de fuerza. |
| 1RM estimado | Epley: kg × (1 + reps/30), exclusivamente pesas con carga externa positiva, entre 1 y 12 reps. No se usa para calistenia, asistencia, isometría, cardio o tipo desconocido. |
| Reps a carga fija | Máximo de reps de series válidas con exactamente la carga elegida. |
| Carga a reps fijas | Máximo de kg con exactamente las reps elegidas. |
| Segundos | Mejor duración para el mismo ejercicio/variante/modo/asistencia; con carga cuantificada se exige filtro de kg para compararla. |
| Esfuerzo | Media aritmética de los RPE registrados en series completadas; no se califica como récord. |
| Series por músculo | Una serie válida completa cuenta una vez para el músculo principal capturado. Excluye cardio y músculo desconocido. No se atribuyen fracciones a músculos secundarios. Semanas de lunes a domingo. |
| Peso semanal | Media aritmética de los pesos registrados dentro de cada semana; se muestra un punto incluso sin tendencia. |
| Nutrición | Valor conocido por 100 g × gramos/100. Los subtotales indican datos sin cuantificar. Una marca sencilla no aporta calorías ni macros. |

Una sola sesión es un punto de partida. No se comparan tipos, variantes o modos diferentes. El aumento de series se muestra junto al volumen para evitar presentarlo como aumento automático de fuerza.

Reglas iniciales de propuestas: dos sesiones comparables, todas las series previstas alcanzan sus objetivos con la misma carga, RPE registrado ≤8; incremento de 1,25 kg. RPE alto propone revisar. Datos insuficientes proponen mantener. Los controles de reglas afectan la propuesta de la vista; las condiciones efectivas quedan en el motivo al aprobar. No sustituyen la revisión de técnica.

## Migración y puesta en marcha tras revisión

Aplicar **primero en staging** `supabase/migrations/20261002120000_session_tracking.sql` y después la aplicación de esta rama. Añade:

1. `exercises.tracking_kind`, inicializado con los metadatos estructurados existentes (`stimulus_type`, `exercise_type`, `muscle_group`), nunca buscando palabras en el nombre. Conviene revisar la clasificación de ejercicios cuyo catálogo estuviera incompleto.
2. `workout_sessions`, `session_adjustments`, `nutrition_entries`, `training_target_adjustments`.
3. RPC `save_workout_session`: bloqueo por UUID, control de revisión, reintento idempotente, validación de series, transacción y auditoría.
4. RPC `approve_training_target`: solo equipo autorizado, evidencia compatible y motivo obligatorio; registro inmutable de aprobación.
5. RLS: lectura del propietario, entrenador asignado y administrador; escritura de sesiones exclusivamente por RPC; nutrición solo escribible por el propietario; auditoría no editable por clientes.

El backfill conserva el día original de `workout_logs`, agrupa por usuario/día/etiqueta y no elimina tablas ni filas. Un registro antiguo se marca `legacy`: se desconoce su variante, sus objetivos y su zona horaria original. Se usa UTC como marcador técnico con una nota explícita; **no se desplaza la fecha civil original**. Se conserva también el JSON original en la instantánea. No se inventan objetivos ni se reinterpretan reps como segundos. Solo se importa como finalizada una sesión con marca de finalización antigua y series válidas.

Las nuevas sesiones escriben en el modelo nuevo. Una reversión solo del frontend haría que los clientes antiguos no vieran esas sesiones: conservar las nuevas tablas y exportar los registros antes de planificar un rollback. No borrar datos nuevos para volver atrás. Evitar mantener clientes antiguos escribiendo durante el cambio; el backfill es un paso de migración, no una sincronización continua.

## Verificación reproducible

```sh
npm ci --legacy-peer-deps --ignore-scripts
npm test
npm run test:db
./node_modules/.bin/tsc --noEmit -p tsconfig.app.json
npm run build
./node_modules/.bin/eslint src/lib/tracking src/components/tracking src/components/dashboard/WorkoutTracker.tsx src/components/dashboard/WorkoutProgress.tsx scripts/test-session-db.mjs
```

- 97 pruebas Vitest: incluidas 10/12, segundos, referencia anterior, independencia de rutina, recarga, reintento con el mismo UUID, separación local por usuario, nutrición y métricas compatibles.
- `test:db` aplica la migración real a PostgreSQL embebido PGlite desechable. Comprueba backfill, sesión parcial, idempotencia, revisión, vacías, segundos, auditoría, usuario ajeno, entrenador asignado, retirada de asignación, aislamiento nutricional y autorización/idempotencia de objetivos. Las funciones de autenticación y asignación se proporcionan como fixtures equivalentes al contrato; no es una instancia Supabase completa.
- TypeScript y build pasan. Se corrigen tres incompatibilidades de tipos que existían en la base (dos usos de `.at` y el selector de métrica del escaparate).
- Lint de los módulos nuevos pasa sin errores ni advertencias. El lint global no pasa: 360 errores también reproducidos en el `main` base, principalmente `any` y reglas preexistentes. No se oculta este resultado ni se hace una limpieza masiva ajena al cambio.
- `npm ci` sin el modo de compatibilidad falla por el peer de `@vitejs/plugin-react-swc@3.11` frente a Vite 8. Se conserva el árbol de versiones; PGlite se añade únicamente como dependencia de desarrollo.
- Revisión visual local a 390×844 y 1280×900. Capturas de componentes reales con datos ficticios y red remota bloqueada en la página de prueba. En móvil, ancho del contenido y viewport: 390 px. Probado introducir 22 segundos y completar la serie; historial con punto inicial y consumo calculado desde 150 g.

## Límites concretos antes de producción

- No se han aplicado migraciones remotas ni desplegado. Falta smoke test de staging con Supabase Auth/PostgREST reales, dos usuarios y entrenador asignado, antes de aprobar producción.
- No hay un estado estructurado de «vídeo de técnica pendiente de revisión» en el esquema inspeccionado; existen medios en chat y vídeos de ejercicios, pero no se inventa una cola de revisión de vídeos.
- Nutrición usa información de etiqueta/fuente introducida, sin inventar una base de alimentos. El seguimiento cuantificado exige registrar cada alimento; no infiere cantidades del texto del menú.
- Las aprobaciones implementadas cambian objetivos de carga externa. Las demás modalidades tienen seguimiento y propuesta de mantener/revisar, sin una regla automática de progresión de habilidades.
- La política ante edición simultánea es detectar conflicto, conservar la copia local y pedir revisión; no fusionar resultados silenciosamente.
- Las tablas antiguas se conservan, pero los componentes antiguos no montados no se han reescrito. El dashboard, el progreso del cliente, el detalle del entrenador y las métricas de actividad del administrador usan el modelo nuevo.
