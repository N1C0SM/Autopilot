# Prompt para Lovable — Autopilot

Continúa el trabajo ya implementado en el repositorio N1C0SM/Autopilot, rama `codex/trainer-responsive-review`. Integra esa rama en la rama conectada a este proyecto antes de publicar. Lee primero `docs/trainer-responsive-validation.md` y el diff; conserva el trabajo reciente de main y resuelve los conflictos por comportamiento. No vuelvas a generar toda la app.

Objetivo: terminar la publicación y la validación real de la experiencia del usuario, administrador y entrenador. Mantén el diseño actual negro/dorado, con navegación clara, controles cómodos y textos sencillos.

Ya está implementado:
- Entrenador responsive: clientes, resumen de plan, perfil, navegación móvil, chat interno y editor de ejercicios por tarjetas con campos etiquetados de al menos 44 px.
- Chat con carga, error y reintento; conserva el borrador si falla el envío y evita mensajes duplicados por realtime. Distingue chat interno de chat con cliente.
- Vista semanal accesible en día de descanso; elegir una rutina distinta conserva la fecha real del entrenamiento y no crea registros hasta iniciar.
- Disponibilidad de días calculada sin contar metadatos; avisos ante diferencias con un plan guardado sin sobrescribirlo.
- Dashboard y métricas cuentan la misma población de clientes, excluyen al personal y llaman “estimación mensual” a la valoración por tarifas; no la presentan como cobros de Stripe.
- Textos de Free / Plus / Coach coherentes: Plus incluye IA y nutrición; el entrenador humano y su chat pertenecen a Coach.
- Validación compartida de macros y calorías. Los datos históricos dudosos permanecen guardados y se señalan para revisión.
- Corrección selectiva de dos descripciones de suplementos, conservando ediciones propias y otros datos.

Termina lo pendiente en este orden:
1. Comprueba qué migraciones están aplicadas en el proyecto real y aplica SOLO las que falten:
   - `20261009122000_recommendation_copy.sql`
   - `20261009150000_nutrition_input_review.sql`
   - `20261009160000_trainer_client_billing_context.sql`
   No reinicies la base de datos ni repitas una migración ya registrada. La restricción nutricional queda NOT VALID para conservar registros antiguos. No la valides globalmente hasta revisar los datos históricos.
2. Despliega `generate-plan` con el helper compartido actualizado y publica el frontend de la rama integrada. Comprueba que el proyecto y dominio de destino son los de autopilotplan.com.
3. Verifica que `get_trainer_assigned_profiles` devuelve el contexto mínimo de acceso del cliente, únicamente para sus entrenadores asignados. No amplíes RLS ni permitas lecturas generales de perfiles. El campo de referencia de pago solo devuelve una marca de presencia, nunca el identificador de Stripe.
4. Haz QA con cuentas de prueba Free, Plus, Coach, administrador y entrenador. Solicita credenciales por un canal seguro si hacen falta; no las escribas en código, prompts guardados ni logs. No concedas planes ni cambies pagos de clientes reales para facilitar la prueba.
5. Usa 320, 390, 430, 768 y 1440 px. Verifica clientes, ficha, resumen, pestañas, editor, chat y perfil sin desplazamiento horizontal de página. Prueba Safari de iPhone con teclado abierto, orientación horizontal, áreas seguras y navegación inferior: el campo de mensaje y el botón de envío deben seguir accesibles. Adjunta capturas.
6. Con un cliente Coach de prueba asignado, guarda cambios de rutina y recarga para confirmar persistencia. Comprueba chat cliente-entrenador y chat interno por separado, con cuentas de prueba; prueba error/reintento y conserva el borrador. Confirma que otro entrenador no puede abrir esa conversación ni ese perfil. Plus y Free no deben obtener chat humano por un nombre de plan antiguo.
7. En un día de descanso, abre la semana, elige otra rutina y registra una sesión de prueba. Al recargar, debe conservar series y fecha real. Abrir o consultar una rutina sin iniciarla no debe crear entrenamientos. No cambies de rutina durante una sesión iniciada.
8. Revisa las discrepancias históricas de disponibilidad, comidas y objetivos con el responsable del plan. No inventes macros ni reemplaces automáticamente planes guardados. Los límites añadidos son controles del producto, no una prescripción nutricional. Si se edita un registro antiguo inválido, corrige sus objetivos con el responsable antes de guardar.
9. Comprueba Free, Plus 29 €/mes y Coach 49 €/mes en todas las superficies y contrástalos con la configuración real de precios. Si el negocio ha cambiado las tarifas, usa una fuente compartida. Comprueba el checkout únicamente en modo de prueba, sin cargos reales.
10. Ejecuta las pruebas, TypeScript, build y los tres scripts de base de datos descritos en la validación. El lint global tenía 388 errores y 37 advertencias antes de los cambios y queda con 364 errores y 37 advertencias heredados; no ocultes esa deuda con desactivaciones generales. Informa cualquier diagnóstico nuevo.

Antes de actualizar librerías, comprueba el entorno: las pruebas locales usaron dependencias ya instaladas y npm detectó un conflicto previo entre Vite 8 y @vitejs/plugin-react-swc 3.11.0. No hagas una actualización general ni ocultes incompatibilidades; resuelve el mínimo necesario si bloquea tu instalación y repite la validación.

Entrega final: enlace publicado, rama/commit desplegado, migraciones realmente aplicadas, pruebas realizadas por rol y dispositivo, capturas y cualquier bloqueo concreto. No afirmes que está todo funcionando solo porque compila. No prometas que supera a Hevy o Symmetry sin una comparación de los recorridos reales.
