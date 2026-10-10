# Validación — Autopilot

Fecha: 10 de octubre de 2026. [PR 37](https://github.com/N1C0SM/Autopilot/pull/37) fusionada en `main`: `2c7473b25bdf655610f8834c84c4cd16be778f25`. Se conservaron los cambios recientes de main sobre seguimiento y medios de ejercicios.

## Publicación

Lovable sincronizó el commit de fusión y confirmó «Your website was updated». Publicación: `f9f82f34-d326-4492-997f-3728a745d87b`. Se comprobó después la cuenta de entrenador en [autopilotplan.com](https://autopilotplan.com).

Esta publicación acredita el frontend. Las funciones Edge `generate-plan` y `auto-tasks` mostraban despliegues anteriores a la fusión; sus fuentes están sincronizadas, pero falta desplegar y comprobar las versiones nuevas del servidor.

## Cambios

- Entrenador adaptado a móvil: clientes, resumen, perfil, navegación y editor por tarjetas con controles etiquetados de 44 px.
- Chat con carga, error, reintento, borrador conservado y deduplicación realtime; distingue conversación interna y conversación con cliente.
- Capacidades Free/Plus/Coach compartidas y aislamiento por asignación; contexto mínimo del cliente con referencia de pago enmascarada.
- Semana accesible en descanso; fecha real de sesión independiente del día elegido; no se guarda actividad hasta iniciar.
- Disponibilidad calculada sin metadatos; métricas con la misma población de clientes y valoración mensual presentada como estimación.
- Validación de macros, conservación de objetivos históricos dudosos y corrección selectiva de recomendaciones.
- Ajuste automático con escrituras comprobadas; un fallo de nutrición no avanza el peso base y un fallo de notificación se informa por separado. Su versión del servidor está pendiente de despliegue.

## Comprobaciones automáticas

| Comprobación | Resultado |
| --- | --- |
| Vitest completo | 155 pruebas correctas en 34 archivos |
| TypeScript y build de producción | Correctos |
| test-nutrition-db.mjs | Conserva objetivos históricos al editar comidas; rechaza objetivos nuevos inválidos y admite correcciones |
| test-nutrition-access-db.mjs | Acceso Plus/Coach, chat Coach, alias antiguos, caducidad, canal interno y aislamiento correctos |
| test-trainer-context-db.mjs | Asignación, denegación anónima y referencia enmascarada correctas |
| test-recommendation-copy.mjs | Conservación de campos propios e idempotencia correctas |
| Lint global | No pasa: 364 errores y 37 advertencias; base inicial 388 y 37. Sin diagnósticos nuevos propios de esta PR; main incorporó uno en exercise-video |
| git diff --check | Correcto |
| GitHub | CodeQL, Analyze y dependency-review correctos para `c5d230dc578a1f9a5e10dd5eb26ed445d86d6513`; Copilot falló con error 402 por cuota mensual agotada |

Repetición:
```sh
npm test -- --reporter=dot
npx tsc -p tsconfig.app.json --noEmit
npm run build
node scripts/test-nutrition-db.mjs
node scripts/test-nutrition-access-db.mjs
node scripts/test-trainer-context-db.mjs
node scripts/test-recommendation-copy.mjs
npm run lint
```

Los cuatro scripts SQL usan PGlite 0.5.8 y datos ficticios aislados; no prueban por sí solos las políticas desplegadas. Las pruebas usaron las dependencias locales existentes. Una instalación limpia puede encontrar el conflicto previo entre Vite 8 y @vitejs/plugin-react-swc 3.11.0; no se forzaron ni actualizaron estas dependencias. El lint sigue siendo deuda pendiente.

## Comprobaciones visuales en producción

- Perfil a 390 px: antes la página medía 506 px de ancho; después, 390 px. También sin desbordamiento a 320, 430, 768 y 1440 px.
- Ficha del cliente: resumen real de 6 sesiones y acceso a chat sujeto a Coach; sin desbordamiento a 320 px.
- Chat interno a 320 px: página de 320 px, campo de mensaje de 44 px y borde inferior en 651 px, por encima de la navegación que comienza en 700 px. También comprobado a 390 px. No se enviaron mensajes.
- Administrador: dashboard y Métricas coinciden en 1 cliente Free, 0 Plus, 0 Coach y estimación mensual de 0 €; excluyen al personal y aclaran que no representan cobros de Stripe. Son los valores observados el 10 de octubre, sujetos a cambios. No se reiniciaron datos.
- Usuario Free: entrada, rutina semanal y acceso humano reservado a Coach comprobados. Al elegir domingo de descanso aparece la salida a otras rutinas; al abrir lunes se mantiene «Se registra hoy · 10 de octubre» y el botón «Empezar entrenamiento». No se inició ni completó una sesión. El día real era sábado; no se simuló el reloj del dispositivo.
- Capturas publicadas: `entrenador-perfil-publicado-390.png`, `entrenador-cliente-publicado-390.png`, `entrenador-chat-publicado-320.png` y `entrenador-chat-publicado-390.png` y `usuario-descanso-publicado-390.png` en la carpeta de entrega.

Comprobaciones locales anteriores: editor a 320 px con datos ficticios, campos de 44 px y sin desbordamiento; interacción parcial en Safari de escritorio; coherencia entre dashboard y métricas de administración. El editor no se guardó en un plan real. Safari de escritorio no acredita Safari de iPhone.

## Base de datos real

Aplicadas y registradas las cinco migraciones de esta PR en `enebrcdrdnfkyduzyrzm`: `20261009122000`, `20261009150000`, `20261009160000`, `20261010010000` y `20261010011000`. Verificados 5 registros de migración, contexto de acceso en el RPC, 3 políticas restrictivas y el disparador de nutrición activo. Permanecen los 6 planes y la asignación existente; 3 objetivos históricos siguen por revisar. No se concedieron planes ni se cambiaron pagos.

## Pendiente

Desplegar y verificar `generate-plan` y `auto-tasks` con sus helpers. No hubo una vía de despliegue disponible en las herramientas, la interfaz o la CLI accesibles; sincronizar el código y aplicar SQL no demuestra ese despliegue.

Quedan las pruebas con cuentas de prueba de persistencia del editor y mensajes Coach, sesión completa persistida, Safari de iPhone con teclado y checkout en modo de prueba. No se hicieron cargos ni envíos de mensajes reales. No se acredita superioridad respecto a Hevy o Symmetry.

El siguiente trabajo está en `docs/lovable-publish-prompt.md`.
