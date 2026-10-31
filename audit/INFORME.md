# Auditoría visual y sistema de diseño · Autopilot

**Fecha:** 31 de octubre de 2026 · **Rama:** `main` · **Alcance:** web pública completa + app (evidencia real de iPhone y Mac) + revisión de código de las pantallas con sesión
**Estado:** Fase 1 y 2 cerradas para lo público; Fase 3 (sistema) propuesta. Sin cambios de código de producto, tal como pediste.

---

## 1. Resumen ejecutivo

Autopilot ya tiene una identidad reconocible: negro, dorado contenido, tipografía grande y fotos reales. La base es buena — no hace falta una app nueva. Lo que falla es el **acabado**: el sistema existe en el documento pero no se aplica de forma mecánica, y eso se ve en cada pantalla.

Cinco conclusiones:

1. **Hay tres lenguajes de color en la pantalla más importante** (el registro de series): dorado para lo activo, verde para lo hecho y rojo para el número de serie. El rojo está reservado a borrar en el propio manual de diseño. Es el problema de mayor impacto visual del producto.
2. **La barra de navegación móvil tapa contenido** en Nutrición, Entrenar y Progreso. No es estética: hay texto y tarjetas que quedan debajo y no se pueden leer.
3. **La app no tiene un ancho de lectura ni una rejilla**: en Mac las tarjetas miden 1.170 px de ancho, la foto del entreno se recorta mal y los widgets quedan medio vacíos; en tablet las páginas legales ocupan los 834 px sin margen (≈110 caracteres por línea).
4. **La jerarquía se rompe en los formularios**: el botón de entrar está a 200–260 px del último campo y existen dos estilos de login distintos (acceso general vs. Drive).
5. **La web pública cuenta la misma historia cuatro veces** con cuatro teléfonos y tres CTAs idénticos, en una página de 14.860 px (16.126 px en móvil). La landing no es larga por narrativa: es larga por repetición.

Además hay dos fallos de producto visibles desde fuera: **`/para-entrenadores` es una página muerta** enlazada desde el pie, y **Nutrición aparece con candado** aunque los macros son gratis y la pestaña se abre igual.

Nota: la nota global de Lighthouse en la landing (dev) es **Accesibilidad 91 / Buenas prácticas 100 / SEO 83**, con fallos de contraste en textos pequeños y orden de encabezados. En producción el SEO no falla por el prerender; el contraste y los encabezados sí.

---

## 2. Método y cobertura

| Qué | Cómo |
|---|---|
| Rutas | 18 pantallas públicas + demo, en 3 tamaños |
| Capturas | **54** (18 × escritorio 1440×900, tablet 834×1112, móvil 390×844), página completa |
| Herramientas | Playwright 1.64 (`scripts/audit/capture.mjs`), movimiento reducido, locale `es-ES`, tema oscuro |
| App con sesión | Capturas reales de iPhone (`public/app-shots/*.jpg`) y Mac (`mac-hoy.jpg`) + lectura de código |
| Roles | Público auditado. Usuario Free/Plus/Coach, admin (17 secciones) y entrenador: **pendiente de credenciales** |
| Informe técnico | `audit/antes/report-public.json` (errores de consola y peticiones ≥500: **0**) |

Carpetas de capturas (`audit/antes/<viewport>/<sección>/`):

- `publico/` landing, planes, cómo funciona, equipo, FAQ, recursos, blog, entrenadores, app, scan, drive
- `acceso/` entrar, crear cuenta, recuperar
- `legal/` términos, privacidad
- `onboarding/` elegir camino
- `sistema/` 404
- hojas de contacto en `audit/contacto/contacto-{desktop,tablet,mobile}.jpg`

**Pendiente para cerrar la Fase 1:** capturas con sesión de Inicio, Entrenar, Nutrición, Progreso, Ajustes, Mi calendario, Drive, Admin (17 secciones) y panel de entrenador, más los estados Free / Plus / Coach. El script ya está preparado (`--group app|admin --state ...`); solo falta la cuenta admin de QA.

---

## 3. Lo que ya funciona (no tocar)

- **Jerarquía del saludo en Inicio**: fecha pequeña → «Hola, Nicolás.» → «Buen trabajo.» en gris. Es exactamente el patrón correcto y se lee en un segundo.
- **Cifras protagonistas** con `tabular-nums` y unidades pequeñas al lado (`2540 kcal`, `2012 kg`). Da sensación de producto deportivo serio.
- **Foto real a sangre** con degradado y estado encima. La tarjeta de sesión es la mejor pieza de la app.
- **Estados vacíos de descanso** (luna dorada) y **404** con enlaces útiles: están por encima de la media y demuestran que el sistema funciona cuando se aplica.
- **Landing**: el titular a tres frases con la última en dorado, el teléfono real y el halo. La dirección es buena; sobra repetición.
- **Accesibilidad base**: foco, `aria-label`s, reduced motion y reduced transparency ya implementados. Zonas táctiles de 44 px en el pie y cabecera pública.

---

## 4. Hallazgos

Severidad: **P0** rompe o engaña · **P1** se ve mal en el uso normal · **P2** pulido.

### P0 — Bloqueantes

**H1 · `/para-entrenadores` es una página muerta y está enlazada desde el pie.**
Captura: `antes/desktop/publico/para-entrenadores.jpg`. Muestra «Página no disponible» con un candado. El producto B2B está apagado en Admin (`trainer_plan` off) y, según la propia regla del proyecto, *lo oculto en Admin no se anuncia en ningún sitio*. Un enlace del pie que lleva a un callejón sin salida rompe la confianza y el SEO (contenido vacío indexable).
**Arreglo:** ocultar el enlace si `trainer_plan` está off y, si se entra por URL, redirigir a `/planes`.

**H2 · La barra de navegación tapa contenido en móvil.**
Evidencia: `public/app-shots/nutricion.jpg` (el texto de la tarjeta de comidas queda bajo la barra), `entrenar.jpg` («Copiar plan» / «Descargar plan» cortados), `progreso.jpg` (la tarjeta de ejercicio queda debajo). La barra es flotante y el contenido no reserva su altura real; `--mobile-nav-content-padding` no cubre todas las pantallas (el tracker usa otro contenedor).
**Arreglo:** una sola variable de inset (`barra 64 + 16 + safe-area`) aplicada en el `main` del shell, no en cada pantalla; y una prueba visual automatizada que compruebe que el último elemento no queda bajo la barra.

**H3 · Tres acentos de color en el registro de series.**
Evidencia: `public/app-shots/registro.jpg`. Serie hecha = **fondo verde + check verde**; número de serie = **rojo**; serie activa = **borde dorado**; RPE = **píldora dorada**. El rojo está documentado solo para borrar. El resultado parece una app distinta a la del resto de pantallas.
**Arreglo:** hecho = dorado suave + check dorado; activo = borde dorado + número dorado; pendiente = gris; fallo = rojo solo en la etiqueta «Fallo». Una sola escala de estado.

**H4 · Los formularios de acceso están partidos en dos.**
Evidencia: `acceso/entrar.jpg`, `acceso/recuperar-contrasena.jpg` (hueco de 200–260 px entre el último campo y el botón) y `publico/drive-publico.jpg` (campos con etiqueta y radio 12, no píldora; botón píldora). Son dos sistemas de formulario en el mismo producto.
**Arreglo:** un único `AuthLayout` (marca arriba, formulario centrado, CTA inmediatamente debajo, legal al pie) y un único `Field` píldora de 56 px con etiqueta. Drive reutiliza las mismas piezas.

**H5 · Las páginas legales no tienen columna de lectura.**
Evidencia: `tablet/legal/*.jpg`: 834 px de ancho, ≈110 caracteres por línea, 15 px. En escritorio también se estiran. Cansa leer y parece un volcado.
**Arreglo:** columna de 68 caracteres (`max-w-[68ch]`), `type-body` 17/26, índice lateral fijo en escritorio, `h2` 22 px con 40 px de aire.

**H6 · La comparativa de planes en móvil repite «Free / Plus» en las 10 filas.**
Evidencia: `mobile/publico/planes.jpg`. Además no hay separadores ni agrupación: es una lista continua de 10 bloques. La tarjeta de la tabla repite luego las dos mini-tarjetas de plan, ya vistas arriba.
**Arreglo:** cabecera fija con las dos columnas, filas agrupadas por tema (Entrenamiento / Nutrición / Análisis / Soporte), una sola etiqueta por columna, y fuera las mini-tarjetas duplicadas.

### P1 — Alto

**H7 · Mac sin rejilla ni ancho máximo.** La tarjeta de sesión mide 1.170 px y la foto se recorta con la cabeza fuera de encuadre (`mac-hoy.jpg`); los widgets quedan con 60 % de aire. Falta `max-w-[1180px]` centrado y un encuadre de foto por `object-position` con punto focal por ejercicio.

**H8 · El récord se trunca en iPhone.** «Press militar co…» (`hoy.jpg`). Un widget que presume de récord no puede cortar el nombre del ejercicio. Dos líneas + `lineLimit(2)` o un título corto (`Press militar`).

**H9 · Gráfica con dos barras y guiones.** En `progreso.jpg` la tarjeta «Últimas 4 semanas» ocupa 640 px para 2 barras y seis guiones que parecen un fallo de carga. Sustituir por: estado vacío explícito si hay <3 semanas, barras con eje Y y una línea de objetivo; altura ligada al contenido.

**H10 · La landing repite la misma historia cuatro veces.** Hay 4 teléfonos con la misma pantalla de Inicio (`hero`, `PhoneStory`, «Dónde entrenes», demo) y 3 CTAs «Crear mi rutina gratis» idénticas (`Index.tsx`). Página de 14.860 px en escritorio y 16.126 px en móvil.
**Arreglo:** un solo teléfono narrativo (sticky), máximo 2 CTAs (hero y cierre), y eliminar los mockups duplicados. Objetivo: −35 % de altura sin perder argumentos.

**H11 · Estados de la semana sin leyenda ni forma consistente.** `entrenar.jpg`: lunes y martes son círculos grises, miércoles texto, jueves círculo dorado, resto texto. No se sabe qué significa gris. Unificar: hecho (check dorado), hoy (relleno dorado), programado (texto), descanso (punto), y leyenda en el pie de la tira.

**H12 · Dos familias de iconos y tres tratamientos de icono.** Lucide en web, Phosphor en la barra móvil, SF Symbols en nativo; el mismo icono aparece en línea, relleno, dentro de círculo gris o con anillo de progreso (widgets de Inicio). Elegir una familia por plataforma y un solo contenedor (`IconTile` 32/40 con `bg-secondary`), con el anillo reservado a Nutrición.

**H13 · El candado de Nutrición contradice el producto.** `Dashboard.tsx:954` bloquea visualmente Nutrición para Free, pero la pestaña se abre y los macros son gratis (así lo dice la landing y la tabla de planes). Quitar el candado; poner una insignia «Plus» solo en la sección de comidas.

**H14 · El pie móvil mide más de 1.100 px.** `landing-m5.jpg`: tres listas verticales con 44 px por enlace. En móvil, acordeón o dos columnas; en escritorio, 4 columnas con 15 px.

**H15 · Faltan estados de vacío/carga en la web pública.** La demo es una imagen estática (`/app-shots/hoy.jpg`) y el «producto dentro» no reacciona; las tiendas y el scan no tienen esqueletos. En la app, `Skeleton` existe pero no se usa en todas las pantallas.

**H16 · Texto por debajo de 13 px en pantallas reales.** Tabla de planes (10–11 px), notas legales, etiquetas de la barra. El manual prohíbe `text-xs` para interfaz; hay 11 usos directos y muchos `type-caption2` (11 px).

### P2 — Pulido

- **H17 · Radios mezclados:** 85 usos de `rounded-md/lg/xl/3xl` frente al sistema 22/28/píldora.
- **H18 · 81 colores hexadecimales sueltos** en `src/app` y `src/web`, fuera de los tokens.
- **H19 · Botones «píldora» de 100 px de ancho en la barra móvil** que parecen un botón dentro de la barra (el activo ocupa 1/4 del ancho).
- **H20 · Ritmo vertical irregular:** huecos de 90 a 200 px entre secciones de la landing, sin escala.
- **H21 · Cabecera pública de 48 px** con enlaces de 15 px y CTA al mismo peso que el logotipo.
- **H22 · Números de marca:** el manual promete Big Shoulders para cifras protagonistas; en las capturas las cifras se ven en Inter. Verificar registro de la fuente en dispositivo (el registro ignora el resultado de `CTFontManagerRegisterFontsForURL`).
- **H23 · Footer legal en dos líneas desiguales** en móvil; enlaces de 13 px con separadores inconsistentes.
- **H24 · Blog:** las tarjetas de categoría usan 12 iconos distintos y un contador «01» que no aporta; falta portada en la lista.
- **H25 · Precios:** «Ver pack / Ver guía» en 13 px dorado sin zona táctil clara; el pack y la guía no se alinean en altura.
- **H26 · Términos y privacidad** comparten fecha «18 de junio de 2026» con el resto de la app; verificar que la versión mostrada coincide con la publicada.

---

## 5. Inventario de pantallas, roles y planes

### Rutas y acceso

| Área | Rutas | Quién |
|---|---|---|
| Público | `/`, `/planes`, `/como-funciona`, `/equipo`, `/preguntas-frecuentes`, `/recursos`, `/blog`, `/blog/:slug`, `/para-entrenadores`, `/app`, `/scan`, `/drive`, `/legal/:slug` | Todos |
| Acceso | `/login`, `/signup`, `/forgot-password`, `/reset-password`, `/verify-email`, `/onboarding-choice`, `/onboarding` | Sin sesión |
| App | `/dashboard/user/:id` (Inicio, Entrenar, Nutrición, Progreso, Ajustes, Recursos), `/settings`, `/my-schedule`, `/scan/user/:id` | Usuario |
| Admin | `/admin?s=<sección>` (17 secciones), `/admin/email-preview/:key`, `/drive` | Admin |
| Entrenador | `/trainer` | Trainer (B2B) |

### Free vs Plus vs Coach

| Capacidad | Free | Plus | Coach |
|---|---|---|---|
| Rutina, registro de series, historial, récords | ✓ | ✓ | ✓ |
| Macros y calorías | ✓ | ✓ | ✓ |
| Comidas del día | — | ✓ | ✓ |
| Progresión de cargas automática | — | ✓ | ✓ |
| Scan básico | ✓ | ✓ | ✓ |
| Scan completo (composición, postura, protocolo) | — | ✓ | ✓ |
| Chat con entrenador humano | — | — | ✓ (oculto en el lanzamiento) |
| Candado actual en la pestaña Nutrición | ✗ incoherente | — | — |

Roles (`admin`, `trainer`) son independientes del plan: un admin ve el panel aunque sea Free. Cualquier cambio de diseño debe respetar `resolveFeatures` y no duplicar comprobaciones.

---

## 6. Sistema de diseño propuesto — «Autopilot 2»

La dirección: **menos piezas, más precisas**. Apple Design Awards enseña contención, jerarquía y movimiento con intención; Hevy enseña densidad útil y registro a un toque. Autopilot debe quedarse con lo primero y la mecánica de lo segundo, sin copiar ni el look de Apple ni el de Hevy: negro cálido, un solo dorado, cifras grandes y una rejilla estricta.

### 6.1 Principios

1. **Un acento.** El dorado marca acción, cifra y estado activo. Nada más. Verde y rojo solo para semántica real (pago confirmado, borrar).
2. **Una rejilla.** 8 pt, ancho máximo 1.180 px en la app y 1.200 px en la web. Nada ocupa el ancho completo por accidente.
3. **Una cifra por bloque.** Si hay dos cifras protagonistas, una es secundaria por tamaño y color.
4. **Densidad consciente.** Móvil: 20 px de margen, filas de 56, tarjetas de 22. Escritorio: 32–40 px y tarjetas de 24 de padding. Ni aire de más ni apiñamiento.
5. **El movimiento confirma, no decora.** 120/220/320 ms; spring solo en arrastre y hojas.

### 6.2 Tokens

**Color** (sustituye a los actuales; mantiene el dorado de marca)

| Token | Valor | Uso |
|---|---|---|
| `--bg` | `#000000` | Fondo |
| `--surface-1` | `#131316` | Tarjeta |
| `--surface-2` | `#1C1C20` | Superficie dentro de tarjeta, campos |
| `--surface-3` | `#26262B` | Chips, segmentado, hover |
| `--line` | `rgb(255 255 255 / .07)` | Separadores de lista (nunca bordes de tarjeta) |
| `--text` | `#FFFFFF` | Principal |
| `--text-2` | `#A8A8AE` | Secundario (AA sobre las tres superficies) |
| `--text-3` | `#6E6E75` | Solo deshabilitado o pie legal |
| `--gold` | `#D8B25E` | Acción, cifra, activo |
| `--gold-strong` | `#E8C87A` | Hover / foco |
| `--gold-soft` | `rgb(216 178 94 / .14)` | Fondo de estado hecho y chips |
| `--gold-line` | `rgb(216 178 94 / .30)` | Borde de activo |
| `--danger` | `#FF453A` | Solo borrar / error |
| `--success` | **eliminado del entreno** | Solo confirmación de pago |

Degradados: únicamente el halo dorado (`radial-gradient(closest-side, rgba(216,178,94,.16), transparent)`) y el degradado negro de las fotos. Prohibido texto con degradado.

**Tipografía** (Inter Variable; `--font-figure` Big Shoulders solo para cifras de marketing y celebración de récord)

| Rol | Tamaño / línea | Peso | Tracking |
|---|---|---|---|
| Display web | 64 / 64 (móvil 40/42) | 700 | −0.04em |
| Título de pantalla | 34 / 40 | 700 | −0.03em |
| Título de bloque | 28 / 34 · 22 / 28 | 700 | −0.025em |
| Headline | 17 / 22 | 600 | −0.01em |
| Body | 17 / 26 | 400 | 0 |
| Subhead | 15 / 21 | 400 | 0 |
| Footnote | 13 / 18 | 400 | 0 |
| Caption | 12 / 16 | 500 | 0.01em (solo etiquetas técnicas) |
| Cifra protagonista | 56–88 app · 96–180 web | 700 | −0.03em, `tabular-nums` |

Regla dura: **nada de interfaz por debajo de 13 px**. En móvil, `17` es el cuerpo y `15` el mínimo de apoyo.

**Espacio**: 4 · 8 · 12 · 16 · 20 · 24 · 32 · 40 · 48 · 64 · 80 · 96 · 128.
- Márgenes: 20 móvil, 32 tablet, 40 escritorio (centrado en 1.180/1.200).
- Padding de tarjeta: 20 móvil, 24 escritorio.
- Separación entre bloques: 32 app, 96 web.
- Altura de fila: 56 (lista), 64 (ajuste), 44 mínimo táctil.

**Radios**: `28` portada/hoja · `22` tarjeta · `18` media · `14` chip interno · `999` botón/campo. Prohibidos 6/8/10/12.

**Elevación**: sin sombras. Material solo en barras flotantes: `rgba(0,0,0,.72)` + `blur(24px)` + `--line` superior. Halo dorado solo en CTA principal y cifra récord.

**Movimiento**: `--ease-out cubic-bezier(.22,1,.36,1)`, `--ease-ios cubic-bezier(.32,.72,0,1)`; 120 (pulsación), 220 (estado), 320 (hoja), 600 (entrada de bloque). Háptica: 1 pulso en tab, 2-1-2 en récord (ya existe).

**Iconos**: Lucide en web, SF Symbols en nativo, 20/24 px, trazo 1.75. Activo = mismo glifo + dorado + punto de 4 px; nunca relleno en web y línea en nativo para el mismo estado.

### 6.3 Componentes (especificación)

| Componente | Especificación |
|---|---|
| `AppShell` | Sidebar 240 (icono 64), cabecera 64, contenido `max-w-[1180px]`, inset inferior = barra + 16 + safe-area. |
| `PageTitle` | Eyebrow 13 dorado opcional; título 34/40; subtítulo 15 `--text-2`; 24 de aire. |
| `HeroCard` (sesión) | Foto 16:10 con `object-position` por ejercicio, degradado 70 % abajo, chip de estado arriba (dorado suave), título 28, meta 15, acción «Resumen» a la derecha. Sin cortes a media tarjeta. |
| `MetricCard` | Icono 20 dorado sobre `IconTile` 40; cifra 48–56 + unidad 17; etiqueta 17; delta 13 con flecha. Dos widgets = misma anatomía. |
| `SetTable` | Cabecera 13 semibold; filas 56; columnas 24/56/72/56/44/44. Estados: pendiente `surface-2`, activo `--gold-line` + número dorado, hecho `--gold-soft` + check dorado, fallo rojo solo en la etiqueta. Números siempre `tabular-nums`. |
| `Segmented` | 44 de alto, thumb `--gold-soft` + texto dorado, deslizante, 4 opciones máximo. |
| `TabBar` | 64 de alto, material, 5 destinos máx.; activo = icono dorado + etiqueta dorada + indicador 3×3; sin bloque dorado de 100 px. |
| `Field` | Píldora 56, etiqueta 13 encima, valor 17, foco `--gold` 2 px, error rojo + texto 13. |
| `ListGroup/Row` | 56 mín., separador `--line` inset 20, chevron 16, destructivo rojo. |
| `Sheet` | 28 arriba, grabber 36×4, título 22, CTA full-width al pie. |
| `Chart` | Eje 12 `--text-2`, barras doradas radio 8, línea de objetivo punteada, estado vacío con texto (nunca guiones falsos). Altura por contenido, no fija. |
| `EmptyState` | Foto 16:9 + degradado o `IconTile` 56; título 22; una línea 15; acción opcional. |
| `Toast` | Material oscuro, 13, sobre la barra, 3 s. |
| `AuthLayout` | Marca + halo arriba, formulario 400 de ancho, CTA a 16 px del último campo, legal al pie. |
| `PricingCard` | Igual altura, CTA anclado al fondo, badge «Recomendado» píldora `--gold-soft`, precio 40 con `€` 20. |

### 6.4 Marketing

- **Cabecera** 64 px, marca 24 (marca + palabra), nav 15 `--text-2`, CTA píldora 44. Máx. 5 enlaces + CTA.
- **Hero** 2 columnas 7/5, titular 64 con `text-balance`, acento dorado en la última frase, 2 acciones (primaria + texto), teléfono 320×640 con bisel `--line` y contenido completo (sin corte a media tarjeta).
- **Ritmo** 96/128, eyebrow 13 dorado con tracking 0.14em.
- **Una sola narrativa de teléfono** (sticky) con 3 estados reales; eliminar copias.
- **Precios**: dos tarjetas a igual altura, comparativa agrupada con cabecera fija, sin duplicar planes.
- **Pie**: 4 columnas, 15 px, filas 44; legal en una línea; en móvil, acordeón.
- **Legal**: 68ch, TOC sticky.
- **Blog/Recursos**: portadas 3:4 y 16:10 consistentes, precio alineado, botón píldora.

### 6.5 Accesibilidad y rendimiento

- Objetivo **AA** en todo texto (≥4.5:1; ≥3:1 en ≥24 px). Los tres grises propuestos pasan sobre `--surface-1/2`.
- Foco visible dorado 2 px en todos los interactivos; nunca `outline: none` sin sustituto.
- Zonas táctiles ≥44×44, separación ≥8.
- `prefers-reduced-motion` y `prefers-reduced-transparency` ya soportados: mantener y cubrir nuevas piezas.
- Imágenes con `width/height` y `loading="lazy"`; portadas con `srcset` 400/800/1200.
- Criterio de rendimiento: LCP <2,5 s en 4G, CLS <0,1; la caché de pantalla ya implementada se mantiene.

---

## 7. Rediseño por pantalla (qué cambia y por qué)

| Pantalla | Ahora | Propuesta |
|---|---|---|
| **Inicio** | Widgets con anatomías distintas; PR truncado; tarjeta de sesión enorme en Mac | Dos widgets idénticos (anillo + cifra), PR a 2 líneas, tarjeta de sesión 16:10 con foco por ejercicio, racha como tira de 7 puntos |
| **Entrenar** | Tira de semana con 3 formas; tarjeta de descanso de 720 px | Tira con estados claros y leyenda; descanso compacto (240 px) con próxima sesión y acción; plan en lista de filas 72 |
| **Registro** | Verde + rojo + dorado; CTA tapa la siguiente tarjeta | Un solo lenguaje de estado; cabecera sticky con progreso; CTA sobre el inset de la barra; auto-scroll a la serie activa |
| **Nutrición** | Texto bajo la barra; porcentajes desalineados | Anillo 200, macros en 3 columnas con % bajo la etiqueta y barra única; comidas con foto 72×72 y fila 80; candado fuera |
| **Progreso** | Segmentado gris; gráfica de 2 barras con guiones; tarjeta cortada | Segmentado dorado; gráfica con eje y estado vacío; resumen 2×2; «Por ejercicio» con fila 88 y foto 64 |
| **Ajustes** | Listas con radios variables | `ListGroup` único, filas 56, secciones con encabezado 13 |
| **Acceso** | CTA a 200 px; dos estilos de formulario | `AuthLayout` + `Field` únicos; CTA junto a los campos; misma pieza en Drive |
| **Landing** | 14.860 px, 4 teléfonos, 3 CTAs | 9.500 px objetivo, 1 teléfono narrativo, 2 CTAs, secciones de 96 |
| **Planes** | Tabla móvil repetitiva; mini-tarjetas duplicadas | Comparativa agrupada con cabecera fija; tarjetas de igual altura; sin duplicados |
| **Legal** | 110 caracteres por línea en tablet | 68ch + TOC sticky; 17/26 |
| **Recursos/Blog** | Carrusel cortado; precios pequeños | Rejilla 3:4, precio alineado, CTA píldora |
| **App/Scan** | Cabecera «Inicio» vs «Atrás»; sin esqueletos | Misma cabecera (`PageTitle`), esqueletos con la forma final |
| **Admin** | 17 secciones con cabecera propia | Reutiliza `AppShell` y `ListGroup`; una sola cabecera de 64, tabs en píldora |
| **Entrenador** | Shell propio | Mismo `AppShell`, densidad de tabla |

---

## 8. Plan de implementación (cuando lo apruebes)

| Fase | Contenido | Checkpoint |
|---|---|---|
| **F0** | Auditoría, scripts y este informe | commit `audit/tooling` |
| **F1** | Tokens + primitivas (`index.css`, `Button`, `Card`, `Field`, `ListGroup`, `Segmented`, `TabBar`, `Sheet`, `PageTitle`) | capturas de una pantalla piloto + axe |
| **F2** | Shell + Inicio + Entrenar + Registro | antes/después 3 tamaños |
| **F3** | Nutrición + Progreso + Ajustes + Calendario | idem |
| **F4** | Acceso + Drive + estados Free/Plus | idem |
| **F5** | Landing + Planes + pie + Legal + Blog + Recursos + App/Scan | idem |
| **F6** | Admin + Entrenador | idem |
| **F7** | Validación: contraste, 44 pt, overlap, tests, espejo nativo | informe final |

Cada fase: `tsc`, `eslint`, `vite build`, `vitest`, capturas y commit. Sin desplegar nada.

**Criterios de aceptación**
- 0 elementos bajo la barra móvil; 0 textos <13 px de interfaz; 0 hex fuera de tokens.
- Contraste AA en todas las pantallas; foco visible; 44×44 en todo lo táctil.
- Una sola acción dorada por pantalla; un solo lenguaje de estado en el tracker.
- Landing ≤10.000 px en móvil y ≤3 CTAs; precios sin duplicados.
- Tests actuales verdes (salvo los 3 fallos preexistentes conocidos) y paridad web/nativo en menús.

**Estimación honesta:** F1–F2 una semana; F3–F4 tres días; F5–F6 una semana; F7 un día. El rediseño completo son unas **2–2,5 semanas** de trabajo concentrado, no una tarde.

---

## 9. Reproducir la auditoría

```bash
npm run dev -- --port 8080            # servidor local
node scripts/audit/capture.mjs --group public --out audit/antes
node scripts/audit/capture.mjs --group app   --state audit/.auth/user.json  --out audit/antes
node scripts/audit/capture.mjs --group admin --state audit/.auth/admin.json --out audit/antes
python3 scripts/audit/contact.py audit/antes audit/contacto
```

Capturas base en `audit/antes/`, hojas de contacto en `audit/contacto/`.

---

## 10. Pendiente

1. **Cuenta admin de QA** (email + contraseña) para crear fixtures Free/Plus/Coach/entrenador con `scripts/verify-live-qa.mjs` y capturar Inicio, Entrenar, Nutrición, Progreso, Ajustes, Drive, las 17 secciones de Admin y el panel de entrenador en los tres tamaños. Con eso se cierra la Fase 1 y se afinan los hallazgos de esas pantallas.
2. **Decisión de dirección**: ¿apruebas el sistema «Autopilot 2» (tokens y componentes de la sección 6) para empezar por F1–F2, o quieres ajustar antes el dorado, la tipografía o la densidad?
3. Confirmar si el rediseño debe incluir el **espejo nativo** en la misma tanda (F2–F6) o si primero cerramos web y luego Mac/iPhone.
