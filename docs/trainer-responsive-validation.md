# Validación — Autopilot

Fecha: 10 de octubre de 2026. La [PR 37](https://github.com/N1C0SM/Autopilot/pull/37) integró entrenador responsive, chat, permisos, seguimiento, nutrición y métricas. Esta continuación corrige los errores de análisis del código, permite instalar desde cero y amplía las pruebas del servidor real.

## Publicación y límites

El frontend de la PR 37 se publicó en autopilotplan.com: Lovable confirmó «Your website was updated», publicación `f9f82f34-d326-4492-997f-3728a745d87b`. La revisión visual descrita más abajo corresponde a esa publicación. Las nuevas correcciones necesitan sincronización y publicación tras fusionarse.

Las funciones Edge `generate-plan` y `auto-tasks` tenían despliegues anteriores a la PR 37. Sincronizar fuentes, aplicar SQL o pasar Deno no acredita una versión desplegada. Esta continuación modifica otras 26 funciones, principalmente para concretar tipos y manejar errores. Deben publicarse las 28 entradas modificadas con sus helpers y verificarse sus versiones activas. El usuario eligió conectar Supabase y conservar créditos de Lovable; no se ha enviado una petición a su agente de IA para desplegarlas.

## Cambios

- Entrenador adaptado a móvil: clientes, resumen, perfil, navegación y editor por tarjetas con controles etiquetados de 44 px.
- Chat con carga, error, reintento, borrador conservado y deduplicación realtime; conversación interna separada de la conversación con cliente.
- Capacidades Free/Plus/Coach compartidas, aislamiento por asignación y referencia de pago enmascarada.
- Semana accesible en descanso; fecha real independiente de la rutina elegida; no se guarda actividad hasta iniciar.
- Disponibilidad sin contar metadatos; métricas con la misma población de clientes y valoración mensual presentada como estimación.
- Validación de macros, conservación de objetivos históricos dudosos y corrección selectiva de recomendaciones.
- Ajuste automático con escrituras comprobadas: un fallo de nutrición no avanza el peso base; un fallo de notificación se informa por separado. Pendiente publicar esta versión del servidor.
- JSON de recomendaciones y horarios comprobado antes de usarlo; errores HTTP conservan su mensaje y cuerpo original.
- Conexión MCP: consulta el perfil por `user_id`, conserva la autorización del usuario y detecta configuración ausente. Se regenera desde sus fuentes al compilar.
- Descargas de libros: exige sesión de Stripe pagada, completa y del entorno activo; comprueba el enlace real del producto. Elimina la búsqueda de ventas recientes y el uso de referencias públicas como prueba de pago. La interfaz no anuncia éxito si no se ha confirmado.
- Confirmación de planes: admite Plus activo además de Coach, evita confundir una compra de libro recordada con un retorno explícito de plan y cancela reintentos al salir.
- Actualización mínima de `@vitejs/plugin-react-swc` a 4.3.3 y `lovable-tagger` a 1.3.5 para admitir Vite 8 e instalar sin forzar dependencias.

## Comprobaciones automáticas de esta continuación

| Comprobación | Resultado |
| --- | --- |
| Instalación limpia `npm ci` | Correcta, sin `--force` ni `--legacy-peer-deps`, en dependencias aisladas |
| Vitest completo | 176 pruebas correctas en 38 archivos |
| TypeScript y build de producción | Correctos |
| Deno 2.9.6 | Las 28 funciones modificadas pasan tipos, incluido MCP regenerado |
| Lint global | 0 errores y 36 advertencias; antes, 364 errores y 37 advertencias |
| test-nutrition-db.mjs | Conserva objetivos históricos al editar comidas; rechaza nuevos objetivos inválidos y admite correcciones |
| test-nutrition-access-db.mjs | Acceso Plus/Coach, chat Coach, alias antiguos, caducidad, canal interno y aislamiento correctos |
| test-trainer-context-db.mjs | Asignación, denegación anónima y referencia enmascarada correctas |
| test-recommendation-copy.mjs | Conservación de campos propios e idempotencia correctas |
| git diff --check | Correcto |

La única excepción de lint nueva desactiva `no-var` exclusivamente en `supabase/functions/mcp/index.ts`: es salida de esbuild, emite `var` y se sobrescribe al compilar. Su fuente en `src/lib/mcp` conserva todas las reglas; el archivo generado conserva las demás. Las 36 advertencias siguen visibles, principalmente sobre efectos y React Refresh; no se han ocultado con una desactivación general.

Repetición:
```sh
npm ci
npm test -- --reporter=dot
npx tsc -p tsconfig.app.json --noEmit
npm run build
node scripts/test-nutrition-db.mjs
node scripts/test-nutrition-access-db.mjs
node scripts/test-trainer-context-db.mjs
node scripts/test-recommendation-copy.mjs
npm run lint
# Repetir para cada entrada Edge modificada:
deno check --node-modules-dir=none --no-config supabase/functions/generate-plan/index.ts
```

Los cuatro scripts SQL usan PGlite 0.5.8 y datos ficticios aislados. El entorno desplegado se comprobó por separado.

## Pruebas del servidor desplegado con cuentas temporales

Script: `scripts/verify-live-qa.mjs`. Requiere `AUTOPILOT_QA_ADMIN_EMAIL` y `AUTOPILOT_QA_ADMIN_PASSWORD` en el entorno; no contiene credenciales. Crea cuentas temporales Coach, Plus y dos entrenadores, verifica el destino y las elimina al terminar. No envía correos, ejecuta IA/cron ni modifica planes o pagos de clientes reales.

Resultado del 10 de octubre, 20:35 UTC: ocho grupos correctos.

1. Cliente visible solo para su entrenador asignado mediante el RPC; referencia de Stripe ausente o enmascarada.
2. Rutina guardada y recuperada desde otra sesión autenticada. Otro entrenador no puede leerla ni alterarla.
3. Series con la estructura real del producto y finalización recuperadas; fecha de Madrid independiente de la etiqueta «Lunes».
4. Mensaje y respuesta conservados; chat interno separado; otro entrenador no puede leer ni escribir.
5. Plus y Free no pueden escribir en el chat humano.
6. Nuevos objetivos nutricionales inválidos rechazados; objetivos y comida ficticios válidos conservados.
7. Plus y Coach devuelven enlaces Stripe de prueba con el cliente correcto. Pedir el enlace no concede acceso de pago.
8. Cuentas temporales eliminadas. SQL posterior: 0 usuarios y 0 perfiles temporales; permanecen 6 planes de nutrición y 1 asignación.

Son pruebas de API y persistencia del servidor real. No acreditan por sí solas el recorrido del editor/chat en navegador, ni un pago completado y procesado por webhook.

## Comprobaciones visuales de la publicación anterior

- Perfil a 390 px: antes medía 506 px de ancho; después, 390 px. También sin desbordamiento a 320, 430, 768 y 1440 px.
- Ficha del cliente: resumen observado de 6 sesiones y acceso a chat sujeto a Coach; sin desbordamiento a 320 px.
- Chat interno a 320 px: campo de 44 px y borde inferior en 651 px, por encima de la navegación que comienza en 700 px. También comprobado a 390 px. No se enviaron mensajes de cuentas reales.
- Administrador: dashboard y Métricas coincidían en 1 cliente Free, 0 Plus, 0 Coach y estimación de 0 €; excluyen al personal y aclaran que no representan cobros Stripe. Valores observados el 10 de octubre, sujetos a cambios; no se reiniciaron datos.
- Usuario Free: semana y acceso humano reservado a Coach comprobados. Elegir domingo de descanso permite abrir lunes conservando «Se registra hoy · 10 de octubre» y «Empezar entrenamiento». No se inició una sesión real; era sábado y no se simuló el reloj.

Revisión local anterior: editor a 320 px con datos ficticios, controles de 44 px y sin desbordamiento; interacción parcial en Safari de escritorio. Esto no acredita Safari de iPhone. Las capturas anteriores no se incluyen como archivos disponibles aquí. Las herramientas actuales no han permitido repetir la revisión visual después de los últimos cambios.

Las 14 pruebas nuevas de pagos cubren Plus, retorno de plan con un libro recordado, ausencia de sesión, rechazo del servidor, pago pendiente, suscripción ajena, entorno incorrecto, referencia manipulada y enlace de otro producto. No se ha intentado explotar la versión desplegada ni firmado descargas de compras ajenas.

## Base de datos real

Aplicadas y registradas las cinco migraciones de la PR 37 en `enebrcdrdnfkyduzyrzm`: `20261009122000`, `20261009150000`, `20261009160000`, `20261010010000` y `20261010011000`. Verificados registros, RPC, 3 políticas restrictivas y disparador de nutrición activo.

Tras las pruebas permanecen 6 planes y 1 asignación. Tres objetivos históricos requieren revisión: dos tienen proteína, carbohidratos y grasas a cero; otro tiene 50 g, 100 g y 500 g respectivamente. Se han conservado sin inventar sustituciones. No se concedieron planes ni se cambiaron pagos reales. Stripe está en modo de prueba.

## Pendiente

- Conectar Supabase, desplegar las funciones modificadas con sus helpers y acreditar versiones activas; prioritarias `generate-plan`, `auto-tasks` y `verify-book-purchase`. La corrección de descargas no está activa hasta desplegar esta última.
- Repetir recorridos visuales tras publicar: editor/chat con recarga, teclado y áreas seguras en Safari de iPhone, horizontal y comienzo/finalización de una sesión desde la interfaz en un día real de descanso.
- Confirmar en Stripe el retorno de los cinco libros publicados: `https://autopilotplan.com/descarga-libro?session_id={CHECKOUT_SESSION_ID}`. Sin sesión, la descarga queda bloqueada y se indica cómo recuperar la compra. No se ha modificado Stripe. [Configuración oficial del retorno](https://docs.stripe.com/payment-links/post-payment).
- Completar checkout de prueba en navegador y comprobar webhook y acceso resultante, sin cargos reales.
- Revisar con el responsable los tres objetivos nutricionales históricos.

No se acredita superioridad respecto a Hevy o Symmetry. Siguiente trabajo: `docs/lovable-publish-prompt.md`.
