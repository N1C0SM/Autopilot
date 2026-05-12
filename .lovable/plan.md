

# Funnel Scan → Pago: quitar fricción y subir conversión

Objetivo: que el usuario que hace el scan llegue a pagar con el mínimo esfuerzo. Hoy se pierde el contexto entre scan, signup y onboarding. Vamos a propagar los datos del scan por todo el embudo y añadir ganchos de conversión donde más cae la gente.

## 1. Persistir el resultado del scan (base de todo)

En `src/pages/Scan.tsx`, al recibir el resultado guardar en `sessionStorage` bajo la key `autopilot_scan`:

```ts
{
  result: { attractiveness, potential, physique, style, similarity, estimated_months, improvements, summary },
  currentImg, // dataURL para mostrar miniatura en signup
  objectiveImg,
  inferred: { goal, primary_focus, intensity_level }, // ver §3
  createdAt: Date.now(),
}
```

Caduca a las 24h al leerla.

Ampliar el edge function `analyze-physique` para que devuelva 2 campos extra ya inferidos por la IA, útiles para pre-rellenar onboarding:
- `inferred_goal`: uno de `"perder_grasa" | "ganar_musculo" | "recomposicion" | "rendimiento"`
- `inferred_focus`: uno de `"gym" | "calistenia" | "mixto"` (lo más probable según el físico)
- `inferred_intensity`: 1–10
- `inferred_specific_goals`: array corto de strings (ej: "definir abdomen", "más volumen hombros") derivado de `improvements` priority Alta

## 2. Cambiar el CTA del scan a `/signup?from=scan`

En `src/pages/Scan.tsx` botón "Empezar mi plan":
```ts
navigate("/signup?from=scan")
```

## 3. Signup con contexto del scan

`src/pages/Signup.tsx` ya soporta `from=quiz`. Añadir caso `from=scan`:

- Leer `sessionStorage.autopilot_scan`. Si existe, mostrar arriba un banner premium:
  ```text
  ┌─────────────────────────────────────────┐
  │ [thumb actual] Tu AI Report está listo  │
  │   Potencial 8.5/10 · Físico 7.2/10      │
  │   3 mejoras detectadas esperándote      │
  └─────────────────────────────────────────┘
  ```
- Subtítulo: "Último paso para desbloquear tu plan personalizado"
- Microcopy debajo del botón: "7 días gratis · Sin tarjeta · Cancelas cuando quieras"

## 4. Pre-rellenar onboarding desde el scan

`src/pages/Onboarding.tsx` (steps 0–8). Al montar:

```ts
const scan = JSON.parse(sessionStorage.getItem("autopilot_scan") || "null");
if (scan?.inferred) {
  setData(prev => ({
    ...prev,
    goal: prev.goal || scan.inferred.goal,
    primary_focus: prev.primary_focus || scan.inferred.focus,
    intensity_level: prev.intensity_level || scan.inferred.intensity,
    specific_goal: prev.specific_goal || scan.inferred.specific_goals.join(", "),
    goal_photo_url: prev.goal_photo_url || scan.objectiveImgUploaded, // ver abajo
  }));
}
```

Cambios visuales en cada step pre-rellenado:
- Badge "✨ Detectado por IA · puedes cambiarlo" sobre el campo
- Si todos los campos del step están pre-rellenados, mostrar botón secundario "Saltar, ya está bien" además de "Continuar"

Foto objetivo: si el usuario subió `objectiveImg` en el scan, subirla automáticamente al bucket `progress-photos` la primera vez que el usuario llega al step 8 y guardarla como `goal_photo_url`. Así no la vuelve a subir.

Resultado esperado: onboarding pasa de ~9 pantallas con todo en blanco a ~9 pantallas con 4–5 ya rellenas y saltables. Tiempo estimado < 90s en lugar de 4 min.

## 5. Ganchos de conversión en el resultado del scan

Modificaciones en el bloque "Mejoras detectadas" + CTA final de `Scan.tsx`:

**Locked items** — mostrar 2 cards bloqueadas debajo de las mejoras:
```text
🔒 Tu plan exacto para [hombros]      → Desbloquear
🔒 Tu déficit calórico óptimo: ___ kcal → Desbloquear
🔒 Tiempo real para tu objetivo: ___ semanas
```

**Frame de pérdida** en el CTA:
- Antes: "El análisis es gratis. El plan que te lleva ahí no."
- Después: "Tu IA detectó 3 puntos de mejora. Sin un plan que los ataque, en 3 meses estarás igual. **Empieza hoy gratis 7 días.**"

**Countdown de reserva** (sessionStorage timer 15 min):
"⏱ Tu AI Report está reservado · expira en 14:32"

## 6. Captura de email pre-resultado (lead magnet de los que abandonan)

Antes de mostrar el resultado, mientras carga el análisis, abrir un mini modal opcional:

```text
"Te enviamos también el AI Report a tu email para que lo guardes"
[input email]  [Sí, enviármelo]   [No, gracias]
```

Si introduce email → `INSERT` en tabla `leads` (ya existe) con `source='scan'` y `quiz_answers` = `{ scan_result, has_objective }`. Disparar email transaccional con el resultado + CTA al plan (template nuevo `scan-report.tsx` análogo a `mini-plan.tsx`).

Esto NO bloquea ver el resultado: el modal se puede cerrar siempre. El email captura sirve para retargeting de los que no se registran.

Edge function nueva `save-scan-lead` (con service role) para insertar en `leads` sin auth.

## 7. Prueba social específica del scan

En `Scan.tsx` debajo del hero del upload:
- Contador animado: `+2.847 escaneos esta semana` (valor mock realista o leer `count` de `leads` con `source='scan'`)
- 3 mini-testimonios en línea: "*El scan clavó mis 2 puntos débiles* — Carlos, 6m"

## 8. Tracking mínimo de embudo

Helper `src/lib/track.ts` que hace `console.log` + `INSERT` en una tabla nueva `funnel_events (event, session_id, payload, created_at)` (RLS solo admin lee).

Eventos:
- `scan_started`, `scan_completed`, `scan_email_captured`, `scan_cta_click`
- `signup_view_from_scan`, `signup_completed_from_scan`
- `onboarding_step_{n}_view`, `onboarding_completed`
- `paywall_view`, `checkout_started`, `payment_completed`

Panel admin: añadir tarjeta simple en `Admin.tsx` que cuente cada evento de los últimos 7 días → calcular ratios.

---

## Detalles técnicos

**Archivos editados:**
- `src/pages/Scan.tsx` — sessionStorage save, locked items, countdown, CTA copy, email modal pre-resultado, contador social
- `src/pages/Signup.tsx` — banner `from=scan` con thumb + scores
- `src/pages/Onboarding.tsx` — pre-rellenar desde sessionStorage, badge IA, botón saltar, auto-upload de goal_photo
- `src/pages/Index.tsx` — link al scan en hero (verificar que ya está)
- `src/components/admin/AdminStats.tsx` o nueva `FunnelStats.tsx` — métricas de embudo

**Archivos nuevos:**
- `src/lib/track.ts` — helper de eventos
- `supabase/functions/save-scan-lead/index.ts` — captura email pre-resultado
- `supabase/functions/_shared/transactional-email-templates/scan-report.tsx` — email del AI Report
- Registrar template en `_shared/transactional-email-templates/registry.ts`

**Archivos editados (backend):**
- `supabase/functions/analyze-physique/index.ts` — añadir 4 campos `inferred_*` al schema y al prompt

**Migración SQL:**
```sql
create table public.funnel_events (
  id uuid primary key default gen_random_uuid(),
  event text not null,
  session_id text,
  user_id uuid,
  payload jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);
alter table public.funnel_events enable row level security;
create policy "anyone insert events" on public.funnel_events
  for insert to anon, authenticated with check (true);
create policy "admins read events" on public.funnel_events
  for select to authenticated using (public.has_role(auth.uid(), 'admin'));
create index funnel_events_event_created_idx on public.funnel_events (event, created_at desc);
```

## Orden de implementación (lo que más urge primero)

1. Persistir scan en sessionStorage + ampliar edge function con campos `inferred_*`
2. Pre-rellenar onboarding (esto es lo que tú pediste como prioridad)
3. Banner de scan en signup
4. Locked items + nuevo copy del CTA en el resultado del scan
5. Captura de email pre-resultado + email transaccional
6. Tracking de eventos + panel admin
7. Prueba social y countdown

## Fuera de alcance
- A/B testing real
- Integración con PostHog/GA externos
- Foto antes/después reales (placeholders)

