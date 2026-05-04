
# Funnel de captación y conversión "Empezar gratis"

## Objetivo
Reducir fricción del CTA principal y aumentar percepción de personalización antes de pedir email/registro. Hoy el CTA de la landing lleva a `/signup` (login upfront). Cambiamos a quiz primero → preview → registro → trial.

## Arquitectura de rutas nuevas

```text
/                       Landing (rediseño hero + social proof + lead magnet)
/quiz                   Quiz largo (1–2 min, 6–8 pasos) — sin auth
/quiz/preview           Preview del plan personalizado + CTA registro
/signup?from=quiz       Registro con datos del quiz pre-rellenados → trial 7 días
/mini-plan              Lead magnet (3–4 preguntas) + captura email
```

Estado del quiz se guarda en `sessionStorage` (`autopilot_quiz`) para sobrevivir al registro y pre-poblar el onboarding existente, evitando repetir preguntas.

## PRIORIDAD 1 — Landing + Funnel sin fricción

### Wireframe landing (`/`)

```text
┌─────────────────────────────────────────────┐
│ NAV: Autopilot                  [Login]     │
├─────────────────────────────────────────────┤
│ HERO                                        │
│  H1: "Tu plan de gym y dieta,               │
│       ajustado a ti cada semana."           │
│  Sub: Entrenador humano + plan que se       │
│       adapta. Sin apps confusas, todo en    │
│       tu Google Calendar.                   │
│  [▶ Empezar gratis (2 min)]   ← /quiz       │
│  ✓ 7 días gratis  ✓ Sin tarjeta para empezar│
│  Mockup calendario + chat                   │
├─────────────────────────────────────────────┤
│ PROBLEMAS (los 4 ya existentes)             │
├─────────────────────────────────────────────┤
│ CÓMO FUNCIONA — 3 pasos                     │
│  1. Cuestionario 2 min                      │
│  2. Recibes tu plan personalizado           │
│  3. Lo vives desde Google Calendar          │
├─────────────────────────────────────────────┤
│ PERSONALIZACIÓN (las 4 cards existentes)    │
├─────────────────────────────────────────────┤
│ SOCIAL PROOF                                │
│  - 3 testimonios con foto/iniciales         │
│  - 2 transformaciones antes/después         │
│    + narrativa emocional (3-4 líneas)       │
│  - Métricas: "+500 planes generados"        │
├─────────────────────────────────────────────┤
│ LEAD MAGNET                                 │
│  "¿Aún no estás listo? Recibe tu mini-plan  │
│   personalizado gratis en 60 segundos"      │
│  [Quiero mi mini-plan] → /mini-plan         │
├─────────────────────────────────────────────┤
│ PRICING (existente, simplificado)           │
│  19€/mes · 7 días gratis                    │
├─────────────────────────────────────────────┤
│ FAQ + CTA final                             │
│  [Empezar gratis] → /quiz                   │
└─────────────────────────────────────────────┘
```

Cambio clave: **todos los CTAs principales** apuntan a `/quiz`, no a `/signup`. Solo "Login" en nav va a `/login`.

### Quiz `/quiz` (sin auth)

Componente nuevo `src/pages/Quiz.tsx`. Cada paso = pantalla full con barra de progreso, una pregunta, opciones grandes tappables, animación `framer-motion` slide.

Pasos:
1. **Objetivo** — perder grasa / ganar músculo / rendimiento / salud
2. **Nivel actual** — principiante / intermedio / avanzado
3. **Frecuencia disponible** — 2/3/4/5+ días por semana
4. **Equipamiento** — gym / calistenia / mixto
5. **Tiempo por sesión** — 30/45/60/90 min
6. **Problema principal** — falta de constancia / no sé qué hacer / no veo resultados / lesiones
7. **Edad + sexo** (compactos en una pantalla)
8. **Generando tu plan…** — loader 2-3s con mensajes "Analizando tu nivel… Cruzando con 9 reglas de progresión… Listo."

### Preview `/quiz/preview`

Pantalla con resultado generado **client-side** (sin backend, sin coste) usando reglas determinísticas a partir de las respuestas:

```text
┌─────────────────────────────────────────────┐
│ ✓ Tu plan está listo, [Nombre opcional]     │
│                                             │
│ ENFOQUE: Hipertrofia + déficit moderado     │
│ FRECUENCIA: 4 entrenos/semana · 60 min      │
│ ESTRUCTURA SEMANAL:                         │
│   L  Empuje superior      ░░░░░             │
│   M  Tren inferior        ░░░░░             │
│   X  Descanso             ─────             │
│   J  Tirón superior       ░░░░░ 🔒          │
│   V  Full body            ░░░░░ 🔒          │
│                                             │
│ NUTRICIÓN:                                  │
│   ~2.100 kcal · 160g proteína 🔒            │
│                                             │
│ INSIGHT CLAVE:                              │
│   "Tu mayor bloqueo es la constancia.       │
│    Por eso tu plan vive en tu Calendar      │
│    y se reajusta cuando fallas un día."     │
│                                             │
│ [Desbloquear mi plan completo — 7 días gratis]│
│  ✓ Sin tarjeta · ✓ Cancelas cuando quieras  │
└─────────────────────────────────────────────┘
```

Bloques marcados con 🔒 generan curiosidad. CTA → `/signup?from=quiz`.

### Registro post-quiz

`Signup.tsx` lee `sessionStorage.autopilot_quiz`. Tras crear cuenta y verificar email, el usuario salta directamente al `Onboarding` con los pasos del quiz **pre-rellenados y saltables** (objetivo, frecuencia, equipamiento, nivel). Solo queda completar lo que el quiz no cubre (lesiones, horarios reales, etc.).

Trial: aprovechamos el flujo Stripe existente con periodo de prueba 7 días (config ya en `settings`). Mensaje claro en pantalla post-registro: "Tienes 7 días gratis. No te cobramos nada hasta el día 8."

## PRIORIDAD 2 — Lead Magnet `/mini-plan`

Funnel ultra-corto para tráfico frío:

1. 4 preguntas: objetivo, días/semana, mayor bloqueo, edad
2. Resultado **inmediato en pantalla** (no requiere email para verlo, pero lo muestra parcialmente):
   - **Insight**: "Entrenas 3 días pero tu bloqueo es nutrición, no volumen."
   - **Error común**: "Estás haciendo demasiado cardio para tu objetivo."
   - **Acción concreta hoy**: "Sube proteína a 1.6 g/kg y mide solo eso esta semana."
3. CTA: "Recibe el mini-plan completo por email + un PDF de 7 días"
4. Captura email → llama a edge function `send-transactional-email` con un nuevo template `mini-plan.tsx`
5. Email guarda lead en nueva tabla `leads (email, quiz_answers jsonb, created_at)` para retargeting

## PRIORIDAD 3 — Social Proof

Componente nuevo `TransformationStories.tsx`:
- 2-3 historias con estructura: foto antes/después (placeholder por ahora) + nombre + "antes sentía X, ahora Y" + métrica concreta
- Carrusel de testimonios reescrito: enfocado en cambio mental ("dejé de pensar qué entrenar"), no solo físico
- Banda de métricas sociales: planes generados, % de usuarios activos a los 30 días, rating

## PRIORIDAD 4 — UX y Copy

Principios aplicados:
- Copy en segunda persona, dolor concreto: "Vas al gym sin saber qué tocar hoy" (ya existe, mantener tono)
- Eliminar genéricos: fuera "mejora tu vida" / "transforma tu cuerpo"
- Cada CTA dice qué pasa después: "Empezar gratis (2 min)" en vez de "Empezar"
- Mobile-first real: quiz es full-screen, botones grandes (h-14), tipografía 18px+ en móvil
- Animaciones `framer-motion` sutiles en transiciones de paso (slide 200ms)

## Detalles técnicos

Archivos nuevos:
- `src/pages/Quiz.tsx` — quiz multi-step + preview en la misma página, controlado por `step` state
- `src/pages/MiniPlan.tsx` — lead magnet
- `src/lib/quizPreview.ts` — función pura que genera el preview a partir de respuestas (reglas si/entonces)
- `src/components/landing/TransformationStories.tsx`
- `src/components/landing/HowItWorks.tsx`
- `supabase/functions/_shared/transactional-email-templates/mini-plan.tsx`

Archivos editados:
- `src/pages/Index.tsx` — nuevo hero, CTAs apuntan a `/quiz`, añadir `HowItWorks`, `TransformationStories`, sección lead magnet
- `src/pages/Signup.tsx` — leer `sessionStorage.autopilot_quiz`, mostrar banner "Tu plan ya está reservado" y mensaje 7 días gratis
- `src/pages/Onboarding.tsx` — pre-rellenar y permitir saltar pasos cuyo dato venga del quiz
- `src/App.tsx` — rutas `/quiz`, `/mini-plan` (públicas)
- Registrar nuevo template en `_shared/transactional-email-templates/registry.ts`

Migración SQL:
```sql
create table public.leads (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  quiz_answers jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
alter table public.leads enable row level security;
create policy "admins read leads" on public.leads for select
  to authenticated using (public.has_role(auth.uid(), 'admin'));
-- inserts vía edge function con service role
```

Tracking: añadir eventos simples a `console`/futuro analytics en cada paso del quiz (`quiz_started`, `quiz_step_{n}`, `quiz_completed`, `preview_viewed`, `signup_from_quiz`) usando un helper único.

## Fuera de alcance (siguiente iteración)
- A/B testing de variantes
- Integración real con herramienta de analytics (PostHog/GA)
- Fotos reales de transformación (placeholders por ahora; el admin podrá subirlas luego)
