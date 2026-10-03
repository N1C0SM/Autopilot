# Paywall estilo Apple: paso de elección antes de Stripe + tarjetas que siempre caben

## Problema
1. En Nutrición y Chat, al tocar «Elegir Coach» se abre Stripe directamente (`handleCompletePayment` → `create-checkout` → `window.location.href`). No hay paso intermedio donde el usuario vea y confirme qué está comprando.
2. Algunas tarjetas no caben en pantalla: se pegan o se salen por los lados en móvil, sin los márgenes laterales limpios estilo Apple.

## Solución

### 1. Paso intermedio de elección de plan (antes de Stripe)
- Al tocar «Elegir Coach» o «Mejorar a Plus» en Nutrición/Chat, se abre una **hoja de confirmación estilo Apple** (sheet centrado con fondo difuminado) en vez de ir directo a Stripe.
- La hoja muestra:
  - Nombre del plan y precio (Coach 49 €/mes o Plus 29 €/mes).
  - 3-4 puntos de lo que incluye, en una línea cada uno.
  - Botón principal «Continuar al pago» → ahí sí se abre Stripe.
  - Enlace discreto «Ahora no» para cerrar.
- En Nutrición, la hoja ofrece las dos opciones (Plus y Coach) para elegir antes de pagar; en Chat solo Coach.
- Nada se cobra ni se abre Stripe hasta que el usuario pulsa «Continuar al pago».

### 2. Tarjetas que siempre caben (márgenes estilo Apple)
- Revisar las tarjetas del dashboard móvil (paywall, «plan en preparación», fichas de fin de entreno, tarjeta de Coach) para que:
  - Nunca superen el ancho disponible: `max-w-full` con márgenes laterales de 16 px mínimo respetando las zonas seguras del iPhone.
  - Textos largos se cortan con puntos suspensivos en vez de desbordar.
  - Botones y precios no se salen en pantallas estrechas (iPhone SE 375 px).
- Mismo aire lateral en todas: padding lateral uniforme en cada pantalla móvil.

## Archivos a tocar
- `src/pages/Dashboard.tsx` — el paywall deja de llamar a Stripe directamente; abre la hoja de confirmación.
- `src/components/dashboard/PlanPaywall.tsx` — nueva hoja de confirmación de plan (Plus/Coach) con botón «Continuar al pago».
- `src/components/mobile/MobileAppShell.tsx` y tarjetas afectadas — márgenes laterales y `max-w-full` para que nada se salga.

## Verificación
- Typecheck limpio.
- Probar en pantalla con móvil simulado (390×844 y 375×667): tocar «Elegir Coach» en Chat muestra la hoja primero, y Stripe solo se abre al pulsar «Continuar al pago». Ninguna tarjeta se sale por los lados.
