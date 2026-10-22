# Estado de Autopilot

Actualizado: 2026-10-22 · Fase activa: **1 · Ventas**

## Objetivo del fundador
Primeros 100 € netos de libros PDF existentes (ventas reales − reembolsos − comisiones de pago; antes de impuestos y costes generales). Progreso: ver `METRICAS.md`.

## Estrategia vigente
No reconstruir web ni sustituir Stripe/entrega. Primero medir y quitar fricción del funnel existente; después captación orgánica de bajo coste.

## Organización
| Función | Responsabilidad | Herramientas | Criterio de aceptación | Estado |
|---|---|---|---|---|
| Atlas (dirección) | priorizar, verificar, informar | todas | ESTADO al día | activa |
| Comercial-funnel | auditar landing→pago→entrega de libros | código, navegador | cada paso con evidencia | activa |
| Datos | ventas netas verificadas | Stripe live (falta acceso) | cifra con fuente | bloqueada |
| Captación | contenido orgánico (blog/SEO/redes) | `generate-blog-post`, `seo/` | — | inactiva hasta cerrar funnel |

Motivo: un único agente basta; no hay trabajo paralelo que justifique subagentes.

## Diagnóstico técnico [HECHO, inspección de código 2026-10-22]
- App React/Vite + Capacitor (iOS/Android), backend Supabase (edge functions), gestionada desde Lovable.
- Libros: tabla `library_books` (precio como texto, `published`), cubierta y PDF en Storage; landing con `BookPreviewModal`.
- Pago de libros: **Stripe Payment Links** configurados manualmente; `withBookRef` añade `client_reference_id=book-<id>` (`src/lib/buyLink.ts`).
- Entrega: `/payment-success` → `verify-book-purchase` recupera la sesión Stripe y comprueba `livemode`; `redeem-book-link` entrega.
- Modo de pago global `settings.payment_mode` (test/live).
- Memoria/tareas previas: `AGENTS.md` (decisiones técnicas), `roadmap.md`, roadmap admin en BD. No existían memoria empresarial ni sistema de agentes.

## Tareas
| ID | Tarea | Criterio / verificación | Estado |
|---|---|---|---|
| V1 | Núcleo Atlas (este directorio) | `npm test` pasa `empresa.test.ts` | [VERIFICADO] |
| V2 | Obtener ventas netas actuales | export Stripe live de cobros de libros, reembolsos y comisiones | bloqueada (A1) |
| V3 | Auditar funnel en producción | por cada libro publicado: Payment Link live, redirect con `session_id={CHECKOUT_SESSION_ID}`, PDF entregado | pendiente (A2) |
| V4 | Auditar oferta (precio, copy, cubiertas, pack) | checklist + comparación de precios | pendiente tras V3 |
| V5 | Plan de captación orgánica | 1 canal priorizado por coste/impacto | pendiente tras V3 |

## Principal obstáculo para la primera venta
[HIPÓTESIS] No es técnico sino de **visibilidad y verificación**: el flujo de compra existe en código, pero no hay datos de tráfico ni ventas accesibles y los Payment Links son configuración manual externa al repo (un link test, sin redirect `session_id` o sin libro publicado rompe la venta o la entrega). Se confirma o descarta con V2+V3.

## Aprobaciones pendientes
- **A1 · Acceso de lectura a Stripe live** (clave restringida solo-lectura o export CSV de pagos/reembolsos). Motivo: medir el objetivo. Riesgo: bajo si la clave es read-only. Coste: 0 €. Sin ello: el progreso hacia 100 € no es verificable.
- **A2 · URL de producción + permiso para recorrer el funnel** (sin pagar) y lista de libros publicados con su Payment Link. Coste: 0 €. Sin ello: V3 no puede hacerse.

## Decisiones
- 2026-10-22 · Memoria en Markdown versionado (`empresa/`) en lugar de tablas nuevas: cero coste, legible, retomable. Revisar si el fundador quiere gestionarlo desde Admin.
- 2026-10-22 · Sin subagentes permanentes: el trabajo actual es secuencial.

## Próxima acción
Recibir A1/A2 → ejecutar V2 y V3.
