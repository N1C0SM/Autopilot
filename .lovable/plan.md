## Objetivo

`/scan` (general) no debe hablar de "plan" ni de "dashboard" porque ahí no hay contexto de usuario/plan. Solo `/scan/user/:id` (espacio personal) puede aplicar el scan al plan y enlazar al dashboard.

## Cambios en `src/pages/Scan.tsx`

1. **No auto-aplicar al plan desde `/scan` general**
   - En el bloque que dispara `applyScanToPlan(r)` tras el análisis (`if (user && isPaid)`), añadir condición `routeUserId`. Sin `routeUserId` no se llama a `applyScanToPlan` ni se hace el upsert `plan_status: "plan_pending"`.

2. **Ocultar la tarjeta de estado del plan en `/scan` general**
   - El bloque `{planApplyState !== "idle" && (...)}` (mensajes "Aplicando…", "Plan actualizado correctamente ✓", botón "Ver mi plan", error) solo se renderiza si hay `routeUserId`.

3. **CTAs finales coherentes según contexto**
   Reemplazar el bloque actual `Volver al dashboard / Aplicar a mi plan / Hacer otro scan` por una versión condicional:
   - `/scan/user/:id` (logueado, en su espacio): `Aplicar a mi plan` (si idle/error) + `Ver mi plan` (→ /dashboard) + `Hacer otro scan`.
   - `/scan` general logueado: solo `Hacer otro scan` + enlace secundario `Ir a mi progreso` (→ /scan/user/:id). Sin "Volver al dashboard" ni "Aplicar a mi plan".
   - `/scan` general anónimo: `Empezar mi plan` (→ /signup?from=scan) + `Hacer otro scan` (sin dashboard).

4. **StickyConversionBar / ExitIntentModal**
   - Mantener su CTA actual a `/dashboard` solo si el user está logueado **y** estamos en `/scan/user/:id`; en `/scan` general logueado, llevar a `/scan/user/${user.id}` (ver progreso); anónimo sigue a `/signup?from=scan`.

## Resultado

En `/scan` desaparecen todos los textos de "plan actualizado", "aplicando a tu plan" y "volver al dashboard". Toda esa lógica vive exclusivamente en `/scan/user/:id`, que es donde sí hay usuario y plan asociados.
