# Composición de pantallas

## Landing (web, móvil y escritorio)

Recorrido narrativo en este orden; la longitud la dicta la historia, no los píxeles:

1. **Hero** (una pantalla): titular de tres frases con la última en dorado, subtítulo, «Crear mi rutina gratis» + «Probar la demo», teléfono grande con la interfaz real y halo dorado.
2. **Teléfono fijo** (`PhoneStory`): la pantalla cambia con el scroll — rutina de hoy → registro de series → progreso — con el texto sincronizado.
3. **Ventajas** (`Benefits`): bloques editoriales alternos con foto o interfaz real.
4. **Guías** (`BookShowcase`): portadas apiladas que se abren en abanico y acaban en fila con precio real y «Ver guía».
5. **Galería horizontal** (`FeatureGallery`).
6. **Cómo funciona** (`StickySteps`) + demo interactiva.
7. **Plan gratuito** (`FreePlanSection`) y debajo solo los planes de pago activos.
8. **Fundador, dudas y CTA final.**

Reglas: una sección fijada (sticky) solo si hay una transformación visual real; en móvil, recorridos más cortos; con movimiento reducido, todo en lista.

## Páginas públicas interiores

`PublicLayout` + `PageHero` + contenido en tarjetas sin borde. Tablas que no caben en móvil se convierten en lista (ver `PlanDifferences`).

## App (iPhone, Android, Mac)

- Título grande de pantalla (`type-large-title`), barra inferior flotante en píldora (móvil) o barra lateral (escritorio).
- Lo primero que se lee es una **cifra o una portada**: kcal del día, kg levantados, mejor marca, foto de la sesión.
- Portadas: foto real a sangre con degradado negro abajo y el titular encima, `rounded-[28px]`.
- Listas de datos: `ListGroup` con miniaturas reales a la izquierda.
- Estados vacíos y de descanso: `EmptyState` (`photo` o `rest`), nunca solo un icono pequeño.
- Escritorio: mismo contenido con más aire; nada se aplasta ni queda vacío a la derecha (las cabeceras en columnas flex llevan `shrink-0`).

## Acceso y cuentas

Negro, halo dorado, «Autopilot» en dorado arriba, icono o avatar circular, titular redondeado, campos y botón en píldora. «¿Quién entrena?» sigue la misma estructura: una fila píldora por cuenta (avatar, nombre, correo) y «Añadir cuenta».

## Estados

| Estado | Cómo |
|---|---|
| Cargando | `Skeleton` con la forma final; sin spinners a pantalla completa salvo el arranque. |
| Vacío | `EmptyState` con acción si la hay. |
| Error de red | `EmptyState` con `WifiOff` y «Reintentar»; nunca perder datos guardados. |
| Éxito / récord | Háptica + `RecordCelebration` o resumen; sin toasts genéricos para momentos importantes. |
