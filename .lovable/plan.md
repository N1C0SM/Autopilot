# Rediseño Landing Autopilot + Nuevo Modelo de Precios

Cambio grande: pasamos de **1 plan a 19€** → **3 productos** (Entrenamiento 29€, Completo 49€, Transformación 299€), con el AI Scan como lead magnet principal, y gestión de price IDs de Stripe desde el panel admin.

## 1. Modelo de productos

Sustituir `src/config/tiers.ts` por:

```ts
export const TIERS = {
  training:  { key:"training",  name:"Entrenamiento", price:29,  interval:"month", trial_days:7,  features:[...] },
  full:      { key:"full",      name:"Completo",      price:49,  interval:"month", trial_days:7,  features:[...], recommended:true },
  transform: { key:"transform", name:"Transformación 12 semanas", price:299, interval:"one_time", trial_days:0, features:[...] },
}
```

- `price_id` y `product_id` **dejan de estar hardcodeados**: se leen de tabla `settings` (3 columnas nuevas, ver §4).
- Mantengo `TIER` (singular) como alias de `TIERS.full` para no romper imports antiguos durante la migración.

## 2. Landing nueva (`src/pages/Index.tsx` + componentes)

Reescribir secciones en este orden:

1. **Hero** — H1 “El cuerpo que quieres. Sin seguir improvisando.” + subtítulo nuevo + CTA primario **“Hacer mi diagnóstico gratis”** (→ `/scan`) + CTA secundario **“Ver planes”** (scroll a pricing) + badges (Gratis / Sin tarjeta / 60s / 100% privado). Quito el CTA “7 días gratis” como principal.
2. **AI Scan** (`AIScanSection`) — Reescribo copy a “Primero entendemos tu físico”, mantengo el mock card con 6.8 / 8.5 y prioridades.
3. **Post-scan → plan** (sección nueva) — 4 pasos: IA detecta → entrenador revisa → plan adaptado → ajustes semanales. CTA: “Empezar con mi diagnóstico gratis”.
4. **Por qué funciona** — 3 bloques (Diagnóstico claro / Plan humano / Ajustes continuos).
5. **Pricing principal** (`PricingTiers` reescrito) — 2 tarjetas lado a lado: Entrenamiento y Completo. Completo destacado (borde primario, badge “Más recomendado” + “Primera semana gratis”). Bajo las tarjetas: nota legal “Después de la primera semana, sigues por 29€/49€…”.
6. **Transformación 12 semanas** (sección premium aparte, distinta visualmente) — tarjeta única con bullets, precio 299€, CTA **“Hablar con un asesor”** (abre mailto o WhatsApp configurable). Texto “Diagnóstico + llamada gratis. Plazas limitadas.”
7. **Comparación** — tabla simple Apps / Entrenador presencial / Autopilot.
8. **Chat humano** — mantengo la demo actual con los 2 ejemplos pedidos (hombro / días disponibles).
9. **FAQ** — sustituyo por las 10 preguntas pedidas con respuestas claras.
10. **Footer** sin cambios estructurales.

Tono: directo, premium, español de España. Sin “7 días gratis” como CTA principal en ninguna sección antes de pricing.

## 3. Flujo de selección de plan

- En pricing, botón → `/signup?plan=training|full`.
- Transformación → CTA “Hablar con un asesor” (no checkout). Por ahora abre `mailto:` al email de contacto guardado en `settings.contact_email` (fallback hardcode).
- En `Signup` se almacena `plan` en `user_metadata`; tras login se llama a `create-checkout` con el `priceId` correspondiente leído desde `settings` (ya existe el patrón).
- Edge function `create-checkout` recibe `plan: "training"|"full"` y resuelve el price desde la tabla `settings` (no más price_id fijo en código).

## 4. Admin — gestión Stripe

Nueva pestaña en admin: **“Productos & Precios”** (`src/components/admin/StripeProducts.tsx`):

Campos editables (guardados en `settings`):
- `stripe_price_training_monthly`
- `stripe_price_full_monthly`
- `stripe_price_transform_onetime`
- (Mantengo `stripe_price_id` existente como legacy si hace falta)
- `contact_email` (para CTA del plan premium)

Migración SQL: añadir columnas TEXT nullable a `public.settings`. RLS ya existe.

`create-checkout` y cualquier referencia a `TIER.price_id` se actualizan para leer dinámicamente.

## 5. Post-scan recommendation

En `src/pages/Scan.tsx`, al terminar el análisis, añadir bloque “Tu plan recomendado: Completo” con CTA principal **“Probar mi plan completo gratis”** y secundario **“Solo quiero entrenamiento — 29€/mes”**. Si el gap potencial−actual ≥ 2, mostrar también banner Transformación con “Hablar con un asesor”.

## 6. SEO

- Actualizar `<title>` y meta description a la nueva propuesta de valor (scan + coaching).
- JSON-LD `Offer` → quitar precio 19, dejar 3 ofertas (29/49/299).

## 7. Restricciones respetadas

- No prometer resultados garantizados.
- No decir que IA sustituye al entrenador.
- Nutrición sólo en Completo y Transformación.
- CTA de asesor sólo en Transformación.
- Nada de “7 días gratis” como hook principal.

## Archivos tocados

- `src/config/tiers.ts` (rewrite)
- `src/components/PricingTiers.tsx` (rewrite: 2 cards)
- `src/components/PremiumTransformation.tsx` (nuevo)
- `src/components/AIScanSection.tsx` (copy update)
- `src/components/PostScanFlow.tsx` (nuevo)
- `src/components/ComparisonTable.tsx` (nuevo)
- `src/pages/Index.tsx` (reestructura + copys + FAQ nueva)
- `src/pages/Scan.tsx` (recomendación post-scan)
- `src/pages/Signup.tsx` (lee `?plan=`)
- `src/components/admin/StripeProducts.tsx` (nuevo)
- `src/pages/Admin.tsx` (añadir tab/route)
- `supabase/functions/create-checkout/index.ts` (resolver price desde settings + parámetro plan)
- Migración SQL: 4 columnas TEXT en `settings`.

## Confirmaciones que necesito antes de implementar

1. ¿Confirmas precios definitivos **29 / 49 / 299 €**?
2. ¿El CTA “Hablar con un asesor” abre **mailto** (a qué email?) o **WhatsApp** (qué número)?
3. ¿Quieres que **mantenga** el plan antiguo de 19€ activo para los usuarios ya suscritos (sólo dejar de venderlo)? Asumo que sí.
4. La Transformación 12 semanas: ¿es **pago único de 299€** vía Stripe Checkout también, o **sólo lead** (no se cobra en la web)? Asumo lead → asesor cierra fuera.
