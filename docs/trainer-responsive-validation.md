# Validación — entrenador responsive y correcciones de auditoría

Fecha: 10 de octubre de 2026. PR: https://github.com/N1C0SM/Autopilot/pull/37. Rama: `codex/trainer-responsive-review`. Base actualizada e integrada: `origin/main a25ac56`.

## Cambios

- Navegación y perfil del entrenador adaptados a móvil; ficha con resumen útil aunque falte contexto de acceso; editor por tarjetas y controles etiquetados de 44 px.
- Chat con estados de carga/error/reintento, borrador conservado si falla el envío y deduplicación realtime.
- Capacidades del cliente resueltas con el helper compartido. La migración del RPC conserva el aislamiento por asignación y enmascara la referencia de pago.
- Semana y sesión separadas: otro día de rutina mantiene la fecha real; no se guarda actividad sin iniciar.
- Disponibilidad compatible con formatos guardados, sin contar metadatos.
- Métricas consistentes para clientes y valoración mensual claramente estimada, con estados de error.
- Copy Free/Plus/Coach y corrección selectiva de recomendaciones.
- Macros validados en editor, generador y base de datos; registros históricos conservados para revisión.
- Restricciones del servidor coherentes con Plus/Coach y disparador que permite editar comidas/metadatos sin cambiar objetivos históricos inválidos.
- Ajuste automático con errores de persistencia comprobados y aviso de notificación separado del éxito del ajuste.
- Incorporados los cambios recientes de main sobre modos de seguimiento y medios de ejercicios.

## Comprobaciones automáticas

| Comprobación | Resultado |
| --- | --- |
| Vitest completo | 34 archivos, 155 pruebas correctas |
| TypeScript app, sin emisión | Correcto |
| Build de producción | Correcto |
| test-nutrition-db.mjs | Correcto: conserva objetivos históricos al editar comidas, rechaza nuevos objetivos inválidos y admite correcciones |
| test-nutrition-access-db.mjs | Correcto: nutrición Plus/Coach, chat humano Coach, alias y compras antiguas, caducidad, canal interno, asignaciones y aislamiento |
| test-trainer-context-db.mjs | Correcto: asignación, denegación anónima, sin acceso directo a perfiles y referencia enmascarada |
| test-recommendation-copy.mjs | Correcto: conserva orden, campos propios y ediciones del propietario; idempotente |
| Lint global | No pasa: 364 errores y 37 advertencias. Base: 388 errores y 37 advertencias. Sin diagnósticos nuevos propios de esta PR |
| git diff --check | Correcto |

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

Los scripts SQL usan PGlite 0.5.8, declarado como dependencia de desarrollo, y datos ficticios aislados. No prueban las políticas ni el despliegue del proyecto de Supabase real. El lint es deuda existente, no una comprobación aprobada.

Las pruebas se ejecutaron con las dependencias locales existentes, no desde una instalación limpia. Al resolver dependencias con npm se detectó un conflicto previo: Vite 8 frente al rango de compatibilidad de @vitejs/plugin-react-swc 3.11.0. No se actualizaron ni forzaron las dependencias de la aplicación para ocultarlo. Revisar este punto si una instalación nueva falla; los scripts SQL no modifican la base de datos real.

## Comprobaciones visuales

Frontend local conectado al backend existente, sin guardar cambios en datos reales:
- Entrenador: entrada, lista de clientes, resumen del cliente, navegación, perfil y chat interno.
- 320 y 390 px: ficha y chat sin desbordamiento; campo de mensaje accesible sobre la navegación inferior.
- Perfil a 320, 430, 768 y 1440 px: sin desbordamiento de página tras corregir el input de foto oculto.
- Editor a 320 px con datos ficticios y estado local: series y descanso editables, campos de 44 px, sin desbordamiento. No se guardó un plan real.
- Safari de escritorio: editor renderizado e interacción parcial con el campo de series. No acredita Safari de iPhone.
- Administración: dashboard y métricas muestran la misma población de clientes y la misma estimación. Los valores actuales pueden cambiar.

## Base de datos real

Aplicadas las cinco migraciones de esta PR en una transacción y registradas en el historial de `enebrcdrdnfkyduzyrzm`: las tres del 9 de octubre y las dos del 10. Verificado después: 5 registros de migración, contexto de acceso en el RPC del entrenador, 3 políticas restrictivas y el disparador de nutrición activo. Permanecen los 6 planes y la asignación existente; 3 objetivos históricos siguen por revisar. No se concedieron planes ni se enviaron mensajes.

## Pendiente de despliegue y prueba completa

Comprobar la integración y versión publicada del frontend. `generate-plan` y `auto-tasks` requieren desplegar las versiones de esta PR; aplicar SQL no actualiza sus funciones Edge. CodeQL y dependency-review pasaron. La revisión adicional de Copilot falló por cuota mensual agotada, sin emitir una revisión de código.

Faltan pruebas reales de persistencia del editor y mensajes entre cuentas Coach de prueba después de migrar, Safari de iPhone con teclado, sesión completa persistida y checkout en modo de prueba. No se hicieron cargos ni envíos de mensajes reales. No se acredita superioridad respecto a otras apps.

Consulta `docs/lovable-publish-prompt.md` para completar la integración, publicación y QA.
