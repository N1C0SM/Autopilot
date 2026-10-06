

- Los vídeos de técnica con IA se generan vía la edge function `exercise-video` (AI Gateway, modelo de vídeo por defecto) y se guardan en el bucket público `site-assets` en `exercise-videos/`; el estado del trabajo se guarda en `exercises.video_job_id`.
- Consumer plan (free/plus/coach) and role (user/trainer/admin) are separate; capabilities resolve only through `supabase/functions/_shared/entitlements.ts` (`resolveFeatures`) — avoids scattered plan checks.
- Stored tier "training" = Plus, "full"/"transform"/"personal" = Coach; Stripe sync mirrors into `entitlements` (source column) so other payment sources can be added later.
- B2B trainer product lives in `product_configs` (key trainer_plan), off by default; flags are enforced server-side in SQL functions/RLS, never only in UI.
- Edge functions call AI only through `supabase/functions/_shared/ai-provider.ts` (aiFetch/getAiConfig), which chains admin OpenAI key -> admin Claude key -> admin DeepSeek key -> Lovable AI (or Lovable only per `app_secrets.AI_PROVIDER`) — one switch for every AI feature. DeepSeek y Claude son SOLO texto: las imágenes y los vídeos de ejercicio exigen OpenAI o créditos de Lovable.
- Every product-like landing section (books, recommendations, future ones) opens a preview modal before any external link: books use BookPreviewModal, everything else ItemPreviewModal with a PreviewVariant — keeps conversion UX consistent.
