## Objetivo
Que el alta sea rápida: copiar el código del correo de una vez, que el autocompletado del móvil funcione siempre, entrar directo tras verificar y un cuestionario que hable de ti.

## 1. Código fácil de copiar (correo)
- El código se mostrará en el correo como un solo número seguido (`45605536`), sin espacio en medio, para que un doble toque lo seleccione entero.
- Se añade debajo una línea pequeña «Mantén pulsado para copiar».
- El asunto lleva el código al principio («45605536 es tu código de Autopilot») para que el móvil lo detecte y lo ofrezca encima del teclado.

## 2. Pegar y autocompletar sin fallos (pantalla del código)
- Botón «Pegar código» que lee el portapapeles y rellena las 8 casillas.
- Pegar cualquier texto con espacios, guiones o letras: se quedan solo los números.
- Autocompletado de iPhone/Android activado correctamente (campo único de «código de un solo uso»), para que no se mezcle con otros datos.
- Al completar los 8 dígitos se verifica solo, sin pulsar el botón.

## 3. Entrar directo tras verificar
- Hoy, tras verificar, la app vuelve al cuestionario y te enseña otra vez el resumen (paso 5) para confirmar.
- Cambio: si el cuestionario ya está completo, al verificar se guardan tus respuestas, se crea el plan y entras directamente a tu panel con un mensaje «Preparando tu plan».
- Si faltan respuestas, se abre la primera pregunta pendiente (como ahora).

## 4. Cuestionario más personal
- Quitar la pregunta «¿Cómo quieres entrenar? Por mi cuenta / Con un entrenador» del cuestionario: el seguimiento de Nicolás se ofrece después, como mejora, no como pregunta a quien aún no sabe qué es.
- Reescribir los textos en segunda persona y cercanos, por ejemplo:
  - «Empecemos por lo que te importa» → «¿Qué quieres conseguir tú?»
  - «¿Cuál es tu nivel ahora?» → «¿Hasta dónde llegas hoy?»
  - «¿Lesiones o molestias?» → «¿Algo te molesta al entrenar?»
  - «Deportes y agenda» → «¿Qué más haces en tu semana?»
  - Resumen: «Así empieza tu plan» → «Tu plan, hecho con tus respuestas»
- El resumen enseña frases con tus datos («Entrenas 4 días, buscas ganar músculo, sin tocar la rodilla») en vez de textos genéricos.

## Detalles técnicos
- `signup.tsx`: dígitos sin separador, `user-select: all`; asunto en `auth-email-hook` con OTP al inicio; redeploy de `auth-email-hook`.
- `VerifyEmail.tsx`: `autoComplete="one-time-code"`, `inputMode="numeric"` en el input único de `InputOTP`; `onPaste`/botón con `navigator.clipboard.readText()` sanitizado `\D`; autosubmit con length 8 (o 6 legado).
- Tras `verifyOtp`: si `sessionStorage autopilot_quiz` está completo (misma regla de Onboarding), upsert onboarding + `generatePlanGuarded` y `navigate("/dashboard")`; si no, `context.next`.
- `Onboarding.tsx`: retirar `training_style` de la lista de pasos (valor por defecto "solo", campo conservado), reescritura de etiquetas.
- Actualizar `VerifyEmail.test.tsx` (pegado con guiones, autosubmit) y test de salto al panel.
