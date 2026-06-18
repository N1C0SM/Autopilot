## Objetivo

Desde el panel de admin, poder ver la app **tal cual la vería ese usuario** (o entrenador) — impersonación real, no solo abrir su URL.

## Cómo funcionará

En la ficha de cada usuario habrá **un único botón** "Ver como este usuario" (y "Ver como entrenador" cuando aplique).

Al pulsarlo:

1. Se abre **una pestaña nueva** con la sesión de ese usuario.
2. Tu sesión de admin **sigue intacta** en la pestaña original (no te desloguea).
3. En la pestaña impersonada aparece una **barra superior roja fija** con el email impersonado y un botón "Salir de impersonación" que cierra esa pestaña.

## Detalles técnicos

- Nueva Edge Function `admin-impersonate` (service role): valida que el caller es admin y genera un **magic link** (`generateLink` type `magiclink`) para el `user_id` objetivo. Devuelve la URL.
- Frontend abre esa URL con `window.open(..., "_blank")`.
- Para que la sesión impersonada **no machaque** la sesión de admin en localStorage, la pestaña nueva carga una ruta `/impersonate/callback` que:
  - Crea un cliente Supabase con `storageKey` aislado (`sb-impersonation`) + `storage: sessionStorage` (solo vive en esa pestaña).
  - Intercambia el token del magic link en ese cliente aislado.
  - Setea un flag `sessionStorage.impersonating = <email>` y redirige a `/dashboard` o `/trainer`.
- Wrapper `ImpersonationBanner` global que, si detecta el flag, muestra la barra roja arriba.
- El cliente Supabase principal (`@/integrations/supabase/client`) se ajusta mínimamente para que, **si está en sessionStorage el flag**, use el storage de impersonación en lugar del default.

## Limitaciones honestas

- Las acciones que hagas como impersonado son **acciones reales** de ese usuario (envían mensajes, marcan tareas, etc.). Es para *ver*, no para operar — lo dejaré claro en la barra roja.
- Solo funciona en navegadores que soporten `sessionStorage` por pestaña (todos los modernos).

## Archivos

- `supabase/functions/admin-impersonate/index.ts` (nuevo)
- `src/integrations/supabase/client.ts` — ajuste mínimo de `storageKey` condicional (este archivo es auto-gen; si no puedo tocarlo, creo `src/integrations/supabase/impersonation-client.ts` aparte)
- `src/pages/ImpersonateCallback.tsx` (nuevo)
- `src/components/ImpersonationBanner.tsx` (nuevo, montado en `App.tsx`)
- `src/components/admin/UserDetail.tsx` — un solo botón "Ver como"
- `src/App.tsx` — ruta `/impersonate/callback` + banner

¿Lo monto así?