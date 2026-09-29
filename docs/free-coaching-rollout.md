# Registro gratuito y contratación de entrenador

## Resultado

Todas las cuentas nuevas (correo o Apple) comienzan con `unpaid/free/inactive`. Completar el cuestionario prepara una rutina inicial sin forzar un pago. Registro de sesiones, rutina y progreso siguen disponibles gratis. Chat y nutrición requieren los permisos del plan contratado, tanto en la interfaz como en la base de datos.

Abrir checkout no cambia permisos. Stripe confirma una suscripción activa o en prueba y un producto reconocido. Los precios se reconocen por la configuración del entorno o por los artículos del enlace de Stripe configurado. Una compra de libro, un pago pendiente o metadatos de registro no conceden seguimiento. Se conservan las compras únicas históricas identificadas con `stripe_payment_id`.

El plan del entrenador queda pendiente de preparación al pasar de gratis a pago. La rutina automática gratuita no se presenta como revisada por una persona. Cancelación efectiva o caducidad retira el seguimiento, pero conserva la rutina y los registros.

## Activación coordinada — no publicar solo el frontend

Se necesita acceso de despliegue al proyecto Supabase `enebrcdrdnfkyduzyrzm`. Esta entrega no incluye credenciales. No se han realizado cobros ni registros de prueba en producción.

1. Revisar y respaldar el estado actual. Verificar en Stripe que los enlaces configurados corresponden a Entrenamiento y Completo, a sus importes y a la prueba anunciada. La configuración consultada estaba en modo `test`; no cambiar a `live` sin verificar los productos reales.
2. En una ventana de mantenimiento, aplicar `supabase/migrations/20260929120000_free_and_coaching_access.sql` y desplegar juntas las funciones `create-checkout`, `check-subscription`, `stripe-webhook`, `generate-plan` y `ai-generate-meals` con sus módulos `_shared`. No aplicar indiscriminadamente migraciones anteriores pendientes.
3. Publicar el frontend de este mismo commit y comprobar un registro nuevo con correo y Apple, rutina inicial, guardado de sesión, checkout de prueba, retorno, webhook, cancelación y continuidad de los registros gratuitos.
4. Comprobar con una cuenta de entrenador la preparación del plan pagado y con una cuenta de usuario la separación de nutrición entre Entrenamiento y Completo.

No cambia automáticamente a gratis cuentas antiguas con cliente/pago Stripe o sin la marca histórica `is_free=true`: requieren reconciliación con Stripe. La sincronización respeta los pagos únicos antiguos. Los campos de facturación no son editables por el usuario ni por un entrenador; el administrador conserva su capacidad de gestión.

## Verificación reproducible

- `npm run build`
- `npx tsc --noEmit -p tsconfig.app.json`
- `npm test` (reglas de acceso y resolución de precios incluidas)
- `PGLITE_MODULE=/ruta/a/@electric-sql/pglite node supabase/tests/run-free-access.cjs`

La última prueba crea una base de datos desechable con roles y políticas. Verifica registro gratuito, imposibilidad de autoactivarse, edición legítima de perfil, bloqueo de chat gratis, acceso de prueba a chat, nutrición por plan y caducidad. No conecta a producción.

También se verificó en navegador con respuestas de prueba aisladas: rutina accesible en Gratis, oferta y checkout de Entrenamiento desde Chat, chat accesible en planes de pago y nutrición exclusiva de Completo. Esto no sustituye una prueba integral con Stripe y las funciones desplegadas.

## Trabajo desde VS Code, sin el asistente de Lovable

El codigo se modifica, prueba y sube desde este repositorio. En VS Code, abre **Terminal > Ejecutar tarea > Autopilot: iniciar sesion de despliegue** para iniciar sesion en Supabase en tu propio ordenador. No compartas tokens en chats ni los guardes en Git. Despues ejecuta **Autopilot: comprobar acceso al servidor**: el proyecto `enebrcdrdnfkyduzyrzm` debe aparecer. Si no aparece, esa cuenta no tiene acceso al servidor y no se debe desplegar a otro proyecto.

Estas tareas no publican ni modifican datos. Una vez verificado el acceso, sigue la activacion coordinada indicada arriba; iniciar sesion o hacer commit no despliega las funciones ni aplica la migracion.
