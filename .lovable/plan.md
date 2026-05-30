## Objetivo

Tras el scan, el email que recibe el usuario tendrá como protagonista la **misma imagen-tarjeta** que se genera al pulsar "Compartir/Descargar" en `/scan` (la que hoy se baja como `autopilot-scan.png`), incrustada como hero. Debajo, 2-3 líneas de resumen + CTA. Se elimina la maraña actual de scores/prioridades/locked insights del email.

## Cómo funciona hoy

- En `src/pages/Scan.tsx`, `handleShare()` usa `html-to-image` (`toPng`) sobre `shareRef.current` para producir la tarjeta PNG y descargarla.
- El email se manda desde dos sitios de `Scan.tsx`:
  - `submitLead()` (línea ~518): usuario no logueado tras dejar email.
  - `saveAndEmailScan()` (línea ~654): usuario logueado.
- Ambos invocan `send-transactional-email` con `templateName: "scan-diagnosis"` y pasan métricas como `templateData`.
- La plantilla `supabase/functions/_shared/transactional-email-templates/scan-diagnosis.tsx` ya acepta `photoUrl` pero solo se usa para la foto del usuario (no la tarjeta).

## Cambios

### 1. Generar la imagen-tarjeta antes de enviar el email
Extraer la lógica actual de `handleShare` a una función reutilizable `renderScanCardPng()` en `Scan.tsx` que devuelve un `Blob` PNG a partir de `shareRef.current` (mismo `toPng` con `pixelRatio: 2`, mismo fondo). `handleShare` la reutiliza para descarga/compartir nativo.

### 2. Nueva Edge Function `upload-scan-card`
- Endpoint público (sin JWT requerido).
- Recibe `{ pngBase64: string }`.
- Sube a bucket público `site-assets` bajo `scan-cards/<uuid>.png` con service_role.
- Devuelve `{ publicUrl }`.
- Validación: tamaño máximo (~3MB), `image/png` magic bytes, rate-limit básico por IP (header `x-forwarded-for`, en memoria por instancia — suficiente para evitar abuso casual).

Se usa edge function en vez de subir directo desde el cliente para no tener que abrir INSERT anónimo al bucket `site-assets`.

### 3. Flujo de envío
En ambos puntos de `Scan.tsx` (submitLead y saveAndEmailScan), tras tener `result` y estar el `shareRef` montado:
1. `const blob = await renderScanCardPng()`.
2. Convertir a base64 → `supabase.functions.invoke('upload-scan-card', { body: { pngBase64 } })`.
3. Si éxito → pasar `cardImageUrl` en `templateData`. Si falla → enviar el email igualmente sin imagen (fallback al diseño actual reducido).

Nota: el `shareRef` solo está montado cuando hay `result`, así que la generación se hará justo después de que el render del resultado esté en pantalla (ya es el caso en `submitLead` porque se llama cuando ya hay `pendingResult` mostrado, y en `saveAndEmailScan` cuando ya hay `result`).

### 4. Rediseñar `scan-diagnosis.tsx`
La plantilla pasará a ser mucho más simple — "imagen + resumen corto":

```
[Hero compacto]
  ✦ AI PHYSIQUE SCAN ✦
  Hola {name}, tu diagnóstico está listo

[IMAGEN TARJETA — full width, bordes redondeados]  ← lo nuevo
  <Img src={cardImageUrl} width="560" />

[Resumen corto — 2-3 líneas máx]
  {headline}
  {summary recortado a ~180 chars}

[CTA grande]
  ¿Listo para acelerarlo a {monthsWithPlan} meses?
  [Empezar mi plan →]

[Footer estándar]
```

Se eliminan del email: bloque de scores, similitud, bottleneck, prioridades, locked insights, hero stats (percentil/edad/meses). Todo eso ya va dentro de la imagen-tarjeta, así que duplicarlo era ruido. Se mantienen como `props` opcionales para no romper invocaciones, pero no se renderizan.

Se añade prop `cardImageUrl?: string`. Si no llega (fallback), se muestra `photoUrl` como antes y un resumen mínimo.

`previewData` se actualiza con un `cardImageUrl` de ejemplo (URL pública de `site-assets` o placeholder) para que el preview en Cloud siga funcionando.

### 5. Despliegue
- Nueva edge function `upload-scan-card` → `deploy_edge_functions`.
- Cambios en `send-transactional-email` no hay (solo cambia el template, que se bundlea con el deploy de esa función) → redeploy `send-transactional-email`.

## Archivos tocados

- **Nuevo**: `supabase/functions/upload-scan-card/index.ts`
- **Editado**: `src/pages/Scan.tsx` — extraer `renderScanCardPng`, llamar a `upload-scan-card` y pasar `cardImageUrl` en ambos `invoke`.
- **Editado**: `supabase/functions/_shared/transactional-email-templates/scan-diagnosis.tsx` — rediseño "imagen + resumen corto", nuevo prop `cardImageUrl`.

## Fuera de alcance

- No se toca el bucket `site-assets` (ya es público).
- No se toca infraestructura de email (queue, suppression, unsubscribe).
- La descarga manual de la tarjeta sigue funcionando igual.
