# Validación — entrenador responsive y correcciones de auditoría

Fecha: 10 de octubre de 2026. Rama: `codex/trainer-responsive-review`. Base comprobada: `origin/main 067abf0`.

## Cambios

- Navegación y perfil del entrenador adaptados a móvil; ficha con resumen útil aunque falte contexto de acceso; editor por tarjetas y controles etiquetados de 44 px.
- Chat con estados de carga/error/reintento, borrador conservado si falla el envío y deduplicación realtime.
- Capacidades del cliente resueltas con el helper compartido. La migración del RPC conserva el aislamiento por asignación y enmascara la referencia de pago.
- Semana y sesión separadas: otro día de rutina mantiene la fecha real; no se guarda actividad sin iniciar.
- Disponibilidad compatible con formatos guardados, sin contar metadatos.
- Métricas consistentes para clientes y valoración mensual claramente estimada, con estados de error.
- Copy Free/Plus/Coach y corrección selectiva de recomendaciones.
- Macros validados en editor, generador y base de datos; registros históricos conservados para revisión.

## Comprobaciones automáticas

| Comprobación | Resultado |
| --- | --- |
| Vitest completo | 33 archivos, 144 pruebas correctas |
| TypeScript app, sin emisión | Correcto |
| Build de producción | Correcto |
| test-nutrition-db.mjs | Correcto: conserva histórico, rechaza nuevas entradas inválidas y admite correcciones |
| test-trainer-context-db.mjs | Correcto: asignación, denegación anónima, sin acceso directo a perfiles y referencia enmascarada |
| test-recommendation-copy.mjs | Correcto: conserva orden, campos propios y ediciones del propietario; idempotente |
| Lint global | No pasa: 364 errores y 37 advertencias. Base: 388 errores y 37 advertencias. Sin diagnósticos nuevos |
| git diff --check | Correcto |

Repetición:
```sh
npm test -- --reporter=dot
npx tsc -p tsconfig.app.json --noEmit
npm run build
node scripts/test-nutrition-db.mjs
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

## Pendiente antes de afirmar que está publicado

No se han aplicado las tres migraciones al proyecto real ni desplegado la función o el frontend. La cuenta de entrenador sigue leyendo el RPC antiguo: la nueva interfaz muestra el resumen y explica que falta el contexto de acceso. El cliente asignado aparecía sin pago; no se le concedió acceso para probar.

Faltan pruebas reales de persistencia del editor y mensajes entre cuentas Coach de prueba después de migrar, Safari de iPhone con teclado, sesión completa persistida y checkout en modo de prueba. No se hicieron cargos ni envíos de mensajes reales. No se acredita superioridad respecto a otras apps.

Consulta `docs/lovable-publish-prompt.md` para completar la integración, publicación y QA.
