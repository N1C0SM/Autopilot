# Plan

## 1. Admin asigna usuarios a un entrenador desde su ficha

Hoy un entrenador puede auto-asignarse usuarios desde `/trainer`. Falta que el **admin**, entrando en la ficha de un usuario que tenga rol `trainer` (en `/admin` → Usuarios → ficha), pueda gestionar a qué usuarios entrena.

### Backend (migración)

Nuevas funciones `SECURITY DEFINER`:

- `admin_assign_user_to_trainer(_trainer_id uuid, _email text) → uuid`
  - Solo admin (`has_role(auth.uid(), 'admin')`).
  - Valida que `_trainer_id` tenga rol `trainer` (si no, lo añade automáticamente al rol).
  - Busca user por email en `profiles`, borra cualquier asignación previa de ese usuario y crea `trainer_assignments(trainer_id=_trainer_id, user_id=found)`.
- `admin_unassign_user_from_trainer(_trainer_id uuid, _user_id uuid) → void`
  - Solo admin. `DELETE FROM trainer_assignments WHERE trainer_id=_trainer_id AND user_id=_user_id`.
- `admin_list_trainer_users(_trainer_id uuid) → TABLE(user_id, email, name, avatar_url, created_at)`
  - Solo admin. JOIN `trainer_assignments` con `profiles`.

### Frontend

`src/components/admin/UserDetail.tsx`:

- Detectar si el usuario abierto tiene rol `trainer` (query a `user_roles`).
- Si lo tiene, mostrar nueva sección **"Usuarios asignados a este entrenador"**:
  - Input email + botón **Asignar** → `admin_assign_user_to_trainer`.
  - Lista de usuarios asignados (avatar, nombre, email) con botón papelera → `admin_unassign_user_from_trainer`.
  - Refetch tras cada acción, toasts de éxito/error.

## 2. Carga rápida: prerender + optimización SPA

> Aviso: **Next.js no es compatible con Lovable** (stack fijo: React + Vite). La forma más cercana a "HTML directo" sin salir del stack es prerenderizar las rutas públicas en build y reducir el JS inicial. Es lo que hace que el navegador pinte al instante sin esperar a React.

### 2a. Prerender estático de rutas públicas

- Añadir `vite-plugin-prerender-spa` (o `react-snap` como alternativa) en `vite.config.ts`.
- Rutas a prerenderizar: `/`, `/legal`, `/login`, `/signup`, `/welcome`.
- El plugin lanza un Chromium headless en build, renderiza cada ruta y escribe `dist/<ruta>/index.html` con el HTML ya pintado (hero, copys, precios, testimonios, footer). React hidrata encima al cargar.
- Resultado: FCP/LCP casi inmediatos en landing, mejora SEO (crawlers ven HTML real sin ejecutar JS).
- Las rutas privadas (`/dashboard`, `/admin`, etc.) siguen como SPA — no tiene sentido prerenderizarlas.

### 2b. Code-splitting + lazy load

`src/App.tsx`:

- Convertir rutas pesadas a `React.lazy()` + `<Suspense>`:
  - `Dashboard`, `Admin`, `Trainer`, `Onboarding`, `Scan`, `EmailPreview`, `Settings`, `MySchedule`, `PaymentSuccess`.
- Mantener `Index` (landing) eager para que el prerender funcione sin parpadeo.

`src/pages/Index.tsx`:

- Lazy-import de secciones below-the-fold con `React.lazy`: `TrainersSection`, `PremiumTransformation`, `ComparisonTable`, `PricingTiers`, `AIScanSection`, testimonios.
- Mantener hero eager.

### 2c. Recursos críticos

`index.html`:

- `<link rel="preload" as="image" href="<hero/poster>" fetchpriority="high">` para el LCP.
- `<link rel="preconnect">` a `enebrcdrdnfkyduzyrzm.supabase.co` y dominio de Stripe.
- Verificar que el `<video>` del hero use `preload="metadata"` y `poster`.

### 2d. Bundle hygiene

`vite.config.ts`: `build.rollupOptions.output.manualChunks` separando `react`, `framer-motion`, `@supabase/supabase-js`, `recharts` para que la landing no descargue chunks que solo usa el dashboard.

## Archivos afectados

```
supabase/migrations/<timestamp>_admin_trainer_assignments.sql   (nuevo)
src/components/admin/UserDetail.tsx                             (sección nueva)
src/integrations/supabase/types.ts                              (regen tras migración)
vite.config.ts                                                  (prerender + manualChunks)
src/App.tsx                                                     (React.lazy + Suspense)
src/pages/Index.tsx                                             (lazy de secciones)
index.html                                                      (preload/preconnect)
package.json                                                    (vite-plugin-prerender-spa)
```

## Notas técnicas

- El prerender corre en build de Lovable; si el plugin falla por entorno headless, fallback a `react-snap` (más maduro). Si ninguno funciona en el sandbox de Lovable, queda solo 2b+2c+2d (sigue siendo una mejora muy notable, pero la primera pintada depende de JS).
- La detección de rol `trainer` en `UserDetail` se hace con `select role from user_roles where user_id=? and role='trainer'`; ya está cubierto por las policies actuales de lectura.
