## Objetivo
Al pulsar "Previsualizar" en el editor de emails del admin, abrir una pestaña nueva que muestre el email renderizado y se actualice automáticamente mientras editas en el admin.

## Cambios

1. **`src/components/admin/EmailTemplatesEditor.tsx`**
   - Botón "Previsualizar" → abre `/admin/email-preview/{templateKey}` en una pestaña nueva (`window.open`, `target="_blank"`).
   - Mientras la pestaña esté abierta, cada cambio en el HTML/asunto/variables de muestra se emite por un `BroadcastChannel("email-preview-{templateKey}")` (con debounce ~200ms). Fallback a `localStorage` + evento `storage` para navegadores sin BroadcastChannel.

2. **Nueva ruta `/admin/email-preview/:templateKey`** (`src/pages/EmailPreview.tsx`)
   - Página protegida solo-admin (mismo guard que `/admin`).
   - Carga inicial: lee la plantilla actual de la BD vía `render-email-template` para mostrar algo aunque no haya editor abierto.
   - Se suscribe al `BroadcastChannel` (y `storage`) del mismo `templateKey`; cuando llega un update, vuelve a llamar a `render-email-template` con el HTML/variables recibidos y refresca un `<iframe sandbox>` con el resultado.
   - Cabecera fija con: asunto renderizado, selector de viewport (desktop/mobile) y badge "🟢 Sincronizado con el editor" / "⚪ Sin conexión".

3. **`supabase/functions/render-email-template/index.ts`**
   - Aceptar un modo `previewHtml` opcional: si viene en el body, renderiza ese HTML en lugar del guardado en BD (para previsualizar sin guardar). Mantiene el resto del comportamiento.

4. **Router (`src/App.tsx`)**
   - Registrar la nueva ruta `/admin/email-preview/:templateKey` dentro del bloque admin.

## Detalles técnicos
- El iframe usa `srcDoc` con `sandbox="allow-same-origin"` (sin scripts) para aislar el HTML del email.
- Debounce en el editor para no saturar la edge function; el render se hace en el lado de la pestaña preview, no en cada keystroke del editor.
- No se toca el guardado: "Previsualizar" nunca persiste; solo "Guardar" lo hace (ya existente).