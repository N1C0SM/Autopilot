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
| Captación | contenido orgánico (blog/SEO/redes) | `generate-blog-post`, `seo/`, Metricool (Instagram @autopilotoficial__, Facebook) | — | inactiva hasta cerrar funnel |

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
| V2 | Obtener ventas netas actuales | conector Stripe (lectura) | [VERIFICADO] 0 € — nunca ha habido un cobro real |
| V3 | Auditar funnel en producción | por cada libro publicado: Payment Link live, redirect con `session_id={CHECKOUT_SESSION_ID}`, PDF entregado | pendiente (A2) |
| V4 | Auditar oferta (precio, copy, cubiertas, pack) | checklist + comparación de precios | pendiente tras V3 |
| V5 | Plan de captación orgánica | 1 canal priorizado por coste/impacto | pendiente tras V3 |

## Auditoría Payment Links live [HECHO 2026-10-22]
- 3 links de pago único redirigen directamente a un PDF de Google Drive: quien tenga la URL lo descarga sin pagar y no pasa por la verificación.
- 1 link redirige a `/payment-success` sin `session_id`: la entrega no puede verificar el pago.
- 1 link de pago único termina en confirmación de Stripe sin redirección: el comprador no recibe el libro automáticamente.
- 1 link redirige a `/d/<token>` fijo (compartible).
- Mapa: …06 Blueprint 49,90 € (Drive) · …05 Atlas de progresiones 29,90 € (Drive) · …04 Base de fuerza 19,90 € (Drive) · …07 Pack completo 29,90 € · …08 Nutrición y recomposición 19,90 € (`/d/` fijo) · …03 Guía en casa 9,99 €.
- [EJECUTADO 2026-10-22, A3] …07 y …03 redirigen ahora a `/payment-success?session_id={CHECKOUT_SESSION_ID}`.
- [EJECUTADO 2026-10-22] …06, …05, …04 y …08 también redirigen a `/payment-success?session_id=…` (el fundador confirmó que la web usa esos links y que los PDF están en Drive › Libros). Los 6 libros quedan con entrega verificada.
- Pendiente fundador: quitar acceso público a los PDF en Google Drive y revocar los enlaces `/d/` compartidos.

## Principal obstáculo para la primera venta
[HECHO] 0 ventas reales. [HIPÓTESIS] Dos causas: (1) entrega mal configurada en los links de libros (arriba); (2) falta de tráfico cualificado, sin medir. Primero se corrige (1) porque es barato y bloqueante.

## Aprobaciones pendientes
- **A3 · Corregir redirecciones de los Payment Links de libros** a `https://autopilotplan.com/payment-success?session_id={CHECKOUT_SESSION_ID}` y revocar el acceso público de los PDF en Drive. Riesgo: un comprador en curso podría ver otra pantalla; bajo. Coste: 0 €. Si no: PDFs gratis para quien tenga el enlace y entregas no verificables.
- **Revocar** la clave `rk_live_…` pegada en el chat (sustituida por el conector Stripe).
- **A2 · URL de producción + permiso para recorrer el funnel** (sin pagar) y lista de libros publicados con su Payment Link. Coste: 0 €. Sin ello: V3 no puede hacerse.

## Decisiones
- 2026-10-22 · Memoria en Markdown versionado (`empresa/`) en lugar de tablas nuevas: cero coste, legible, retomable. Revisar si el fundador quiere gestionarlo desde Admin.
- 2026-10-22 · Sin subagentes permanentes: el trabajo actual es secuencial.

## Próxima acción
Compra real de prueba de 1 libro (≈10 €, reembolsable) para verificar la entrega de punta a punta → plan de captación (Metricool).
