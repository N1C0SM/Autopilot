# Verificación de la cuenta con código de 6 dígitos

**Fecha:** 2026-10-19 · **Estado:** implementado en el repo; falta aplicar la configuración de Supabase (abajo) y desplegar las funciones de email.

## Qué cambia

Antes, después de `/signup` el usuario tenía que salir de la app y abrir un enlace del correo. Eso rompía la continuidad del embudo: el enlace suele abrirse en otra pestaña o dispositivo, donde `sessionStorage` (plan elegido, contexto del scan, quiz) ya no existe, y si el correo no llegaba el único reenvío estaba en una pantalla que se perdía al recargar.

Ahora el camino principal es un **código de 6 dígitos** que se introduce en la propia app:

1. `/signup` crea la cuenta y guarda en `sessionStorage` el email y el destino (`autopilot_verify`), y navega a `/verify-email`. Si el usuario recarga o vuelve a `/signup` con una verificación pendiente, se le redirige de nuevo al código (el formulario ya no puede reutilizar ese email).
2. `/verify-email` pide el código, llama a `supabase.auth.verifyOtp({ email, token, type: "signup" })` y navega al destino de siempre (`next`, vuelta al scan u onboarding).
3. Incluye **reenviar código** (cooldown 60 s), «Corregir mi correo» (vuelve a `/signup` con el email precargado), errores en español y `autocomplete="one-time-code"` para el autofill de iOS/Android.
4. El **enlace del correo sigue existiendo** como alternativa: `/auth/callback` en web y el deep link `autopilot://auth-callback` en la app nativa. Si el usuario ya verificó con el código y luego pulsa el enlace, `/auth/callback` detecta la sesión y entra en vez de mostrar un error.
5. Desde Login, si Supabase responde «Email not confirmed», aparece «Introducir código de verificación» y se abre la misma pantalla (ya no se remite a un re-registro que el formulario bloquea).
6. Se emite el evento de analítica `verify_email` (método `code` o `link`), que estaba declarado pero nunca se disparaba.
7. Como el usuario ya no cambia de pestaña, al volver a `/scan` se **restaura el informe** del análisis anónimo (y sus fotos) desde `sessionStorage`, en vez de obligarle a repetir la IA. Solo se restaura el contexto de un scan anónimo que llegó al formulario de lead; caduca a las 24 h y se limpia al cerrar sesión o al pulsar «Hacer otro scan».

## Archivos

| Archivo | Cambio |
|---|---|
| `src/lib/signupVerification.ts` | Contexto de verificación en `sessionStorage`, `safeNextPath` y `postVerificationPath` compartidos, email pendiente del alta. |
| `src/pages/VerifyEmail.tsx` | Pantalla del código (`InputOTP`), verificación, reenvío, errores y recuperación del email. |
| `src/App.tsx` | Ruta pública `/verify-email`. |
| `src/pages/Signup.tsx` | Guarda el contexto, navega a `/verify-email`, vuelve al código si hay una verificación pendiente y elimina la pantalla antigua de «Verifica tu correo» (el reenvío vive ahora en `/verify-email`). |
| `src/pages/Login.tsx` | Botón para introducir el código cuando el correo no está verificado. |
| `src/pages/AuthCallback.tsx` | Usa los helpers compartidos, entra si ya hay sesión y emite `verify_email`. También corrige `exchangeCodeForSession(code)` (antes pasaba un objeto, rompiendo el flujo PKCE). |
| `src/lib/pendingScan.ts` | Lectura/limpieza del análisis anónimo guardado en la pestaña (24 h). |
| `src/pages/Scan.tsx` | Restaura el informe tras verificar y limpia el contexto en «Hacer otro scan». |
| `src/contexts/AuthContext.tsx` | Al cerrar sesión olvida el informe anónimo (PII de salud) además del id anónimo. |
| `supabase/functions/_shared/email-templates/signup.tsx` | Pinta el código de 6 dígitos (si el hook lo entrega) y mantiene el botón/enlace. |
| `supabase/functions/auth-email-hook/index.ts` | Asuntos en español y remitente «Autopilot» en vez de «autopilotv2». |
| `src/pages/Signup.test.tsx`, `Login.test.tsx`, `AuthCallback.test.tsx`, `VerifyEmail.test.tsx`, `src/lib/signupVerification.test.ts` | Cobertura del flujo nuevo. |

## Configuración necesaria en Supabase

> Sin esto el código no aparece en el correo y la pantalla no sirve. Es el punto que ya estaba marcado como bloqueante en la auditoría (C-12).

### 1. Confirmación de email activa

**Authentication → Sign In / Providers → Email**: `Confirm email` **ON**. El flujo asume que `signUp` no devuelve sesión hasta verificar.

### 2. El correo debe incluir el código

Hay dos escenarios según cómo se envíen los emails de Auth:

**A. Send Email Hook activo → edge function `auth-email-hook`**

- La plantilla del repo pinta `payload.data.token` cuando es un OTP numérico (6 dígitos) y mantiene el enlace.
- **Publicar la web NO despliega las edge functions.** Hay que desplegar el hook aparte; si no, el correo sigue saliendo con la versión anterior (sin código) aunque la pantalla `/verify-email` ya esté publicada:
  **Si el proyecto se gestiona con Lovable**, editar los archivos del repo no basta: hay que pedir a Lovable
  **«Redeploy my email templates»** (o desplegar `auth-email-hook`) y comprobarlo en
  **More → Cloud → Emails → Auth emails → Send test**. Es el motivo habitual de que el correo
  siga saliendo con la versión antigua.
  **Si se despliega por CLI**:
  ```bash
  cd ~/Developer/Autopilot-source
  npx --no-install supabase login   # solo la primera vez
  npx --no-install supabase functions deploy auth-email-hook --project-ref enebrcdrdnfkyduzyrzm
  ```
- Confirmar que **Authentication → Hooks → Send Email** apunta a `auth-email-hook`.
- El payload del hook incluye `token` (OTP); si el hook no está configurado, Supabase usa sus plantillas y el repo no interviene.

**B. Plantillas de Supabase (sin hook)**

En **Authentication → Emails → Confirm signup**, añadir el código al HTML, por ejemplo:

```html
<p>Tu código de verificación es:</p>
<p style="font-size:32px;font-weight:700;letter-spacing:0.25em">{{ .Token }}</p>
<p>Escribe este código en la app. Caduca en unos minutos.</p>
<p><a href="{{ .ConfirmationURL }}">O confirma desde este enlace</a></p>
```

Mantener `{{ .ConfirmationURL }}` como alternativa. En ambos casos, el enlace y el código son válidos de forma independiente y de un solo uso.

### 3. Caducidad y longitud del código

**Authentication → Settings**: `Email OTP length` = 6 y `Email OTP expiration` acorde con la copy («caduca a los pocos minutos»). Si se deja la caducidad por defecto (1 hora), ajustar la copy de `VerifyEmail.tsx` o bajar la expiración.

### 4. Límites de intentos

Supabase aplica rate limits a la verificación de tokens. La UI ya muestra un mensaje específico para 429. No bajar los límites sin probar el reenvío.

### 5. Redirect URLs (siguen siendo necesarias)

Para el enlace de respaldo y la recuperación de contraseña:

- `https://autopilotplan.com/auth/callback` y `https://autopilotplan.com/auth/callback?**`
- `autopilot://auth-callback` y `autopilot://auth-callback?**` (iOS y, tras el arreglo del manifest, Android)
- `http://localhost:8080/**` en desarrollo.

## Cómo probarlo (staging)

1. Nuevo alta con email real de prueba → llega correo con código de 6 dígitos.
2. Introducir el código → entra y va al destino (onboarding, scan o `next`), sin salir de la pestaña.
3. Código incorrecto → mensaje en español y el contexto no se pierde.
4. Reenviar código → llega uno nuevo tras el cooldown.
5. «Corregir mi correo» → vuelve a `/signup` con el email rellenado.
6. Pulsar el enlace del correo después de haber verificado con el código → `/auth/callback` entra sin error.
7. Si el correo todavía no incluye código (hook sin desplegar), la pantalla ofrece el fallback: abrir el correo y pulsar «Confirmar email».
7. Login con la cuenta sin verificar → aparece «Introducir código de verificación» y funciona.
8. App nativa iOS: el código se teclea en la WebView (sin depender del deep link).
9. Android: la verificación ya no depende del deep link; la recuperación de contraseña sigue necesitando el manifest (ver auditoría C-05).
10. Scan: hacer el scan sin cuenta → rellenar el lead → registrarse → verificar con el código en la misma pestaña → al volver a `/scan` aparece el informe anterior y se puede aplicar al plan.
11. Cerrar sesión y entrar con otra cuenta en el mismo navegador → el informe anónimo ya no reaparece.

## Pendiente / siguiente paso

- **Continuidad cross-dispositivo del scan**: si el correo se abre en otro dispositivo, `sessionStorage` no viaja. Falta una reclamación server-side por email verificado (`claim-scan-lead`) que devuelva el último `scan_leads` del usuario e inserte el resultado en `scan_history` (auditoría C-07, parte pendiente).
- **Recuperación de contraseña por código**: mismo patrón (`resetPasswordForEmail` + `verifyOtp({ type: "recovery" })` + nueva contraseña) para eliminar también la dependencia del deep link en Android y en el caso «correo en otro dispositivo». No incluido en este cambio.
- Confirmar en el dashboard que la plantilla/hook quedó aplicada (checklist de la auditoría, Anexo A).
