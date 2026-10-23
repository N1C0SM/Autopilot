# Métricas verificadas

Solo datos con fuente y fecha. Sin fuente = no figura.

| Fecha | Métrica | Valor | Fuente |
|---|---|---|---|
| 2026-10-22 | Ventas netas libros (live) | 0,00 € | Stripe live vía conector: 0 balance transactions |
| 2026-10-22 | Checkouts completados (live) | 4, todos a 0 € (prueba/cupón) | Stripe live, checkout.sessions |

Fórmula: Σ importes cobrados live de libros − reembolsos − comisiones Stripe. Excluir modo test y compras del fundador/cuentas de `metrics_excluded_users`.
