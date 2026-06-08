## Objetivo

El Scan es gratis y genera el "aha moment", pero la conversión a plan de pago (19€/mes) depende de un solo CTA al final. Voy a meter **5 palancas de conversión psicológica** dentro de `/scan` para multiplicar el % de upgrade, sin tocar el motor de análisis ni el modelo de negocio.

---

## Palancas a implementar

### 1. Proyección visual "Tú con plan vs. sin plan" (anchor emocional)
Justo después del bloque de Diagnóstico Clínico, una tarjeta gráfica con dos timelines paralelos:
- **Sin plan (6 meses):** Score actual repetido → barra plana, color apagado, texto "Mismo físico, misma frustración"
- **Con plan (X meses):** Score proyectado (actual + delta IA) → barra creciente con gradient primary, hitos mensuales ("Mes 1: pérdida grasa visible", "Mes 3: V-taper definido", etc.)

Los hitos se generan dinámicamente desde `result.priorities` + `result.body_composition`. Hace el coste de oportunidad **palpable**.

### 2. Bloque de insights bloqueados expandido (curiosity gap)
Hoy `locked_insights` se muestra como lista corta. Voy a:
- Pedir al edge function `analyze-physique` que devuelva **6-8 locked insights** específicos (en vez de los actuales 2-3), con título + 1 frase teaser desenfocada (blur CSS sobre el detalle).
- Mostrarlos en grid 2x3/2x4 con candado encima de cada uno, hover muestra "Desbloquea con tu plan".
- Categorías: ratio calórico exacto, ventana anabólica, descansos óptimos por grupo, orden de ejercicios, frecuencia semanal por músculo débil, % grasa objetivo realista, semanas hasta primer hito visible, predicción de plateau.

### 3. CTA sticky inteligente + exit-intent
- **Sticky bar** en mobile/desktop que aparece cuando el usuario hace scroll más allá del 40% de los resultados: "Tu plan personalizado · 7 días gratis · 19€/mes" + botón "Empezar".
- **Exit-intent modal** (solo desktop, primera vez): cuando el cursor sale por arriba, muestra "Espera — guardamos tu análisis. Empieza tu plan en 60s" con CTA directo.
- Ambos se ocultan si `isPaid`.

### 4. Prueba social contextual
Hoy no hay testimonios en `/scan`. Voy a leer 2-3 `site_testimonials` (random, los que tengan foto + resultado numérico) y mostrarlos en una tira horizontal **justo antes del CTA final**, con formato: foto + "−8kg en 4 meses" + frase corta. Anclaje: "Otros con tu mismo perfil ya lo hicieron".

### 5. CTA principal con pricing visible + reducción de fricción
El CTA actual dice "Empezar mi plan" sin precio. Voy a:
- Mostrar precio con anchor: ~~Coach 1:1 200€/mes~~ → **19€/mes · 7 días gratis**
- Cambiar copy: "Empezar mi plan por 0€ hoy" (anclar gratis primero, no el precio)
- Añadir microcopy: "Cancela en 1 clic · Sin permanencia · Garantía 30 días"
- En `/signup?from=scan`, prerellenar el flow para que llegue al checkout **en 2 clics** (ya existe el flow, solo verifico que `from=scan` salta pasos opcionales del onboarding y va directo a paywall).

---

## Cambios técnicos

```text
src/pages/Scan.tsx
├── + <ProjectionTimeline />        (palanca 1, después del Diagnóstico Clínico)
├── ~ <LockedInsightsGrid />        (palanca 2, expandido con blur + grid)
├── + <StickyConversionBar />       (palanca 3, scroll > 40%)
├── + <ExitIntentModal />           (palanca 3, solo desktop)
├── + <SocialProofStrip />          (palanca 4, antes del FUNNEL CTA)
└── ~ FUNNEL CTA                    (palanca 5, copy + pricing + microcopy)

supabase/functions/analyze-physique/index.ts
└── ~ schema.locked_insights        (mínimo 6 items, con teaser + categoría)

src/components/scan/                (carpeta nueva, componentes aislados)
├── ProjectionTimeline.tsx
├── LockedInsightsGrid.tsx
├── StickyConversionBar.tsx
├── ExitIntentModal.tsx
└── SocialProofStrip.tsx
```

Sin migraciones de BD. Sin cambios en pricing/Stripe. Sin nuevas dependencias.

---

## Métrica de éxito

Conversion rate `scan completado → checkout iniciado`. Se puede medir mirando `scan_leads` insertados (denominador) vs eventos de click en CTA — opcionalmente añado un `analytics.track("scan_cta_clicked", { variant })` para A/B futuro.

---

## Confirmación

¿Sigo con las **5 palancas** o prefieres que arranque solo con **1-2** (las de mayor impacto: proyección visual + locked insights expandido) y dejamos las otras para iteración?
