# Rediseño total estilo Apple (todo en un solo pase)

Objetivo: que toda la app se vea y se sienta como una app de Apple — márgenes limpios, tarjetas que siempre caben, nada se abre de golpe, cero elementos que no se puedan tocar.

## 1. Pagos: confirmación antes de Stripe
- Nutrición y Chat: al tocar «Elegir Coach» / «Mejorar a Plus» se abre una **hoja de confirmación estilo Apple** (fondo difuminado, tarjeta centrada) con el plan, el precio, 3-4 puntos de lo que incluye y el botón «Continuar al pago». Solo ahí se abre Stripe.
- En Nutrición la hoja deja elegir entre Plus (29 €) y Coach (49 €); en Chat solo Coach.
- Enlace discreto «Ahora no» para cerrar sin pagar.

## 2. Márgenes y tarjetas que siempre caben (todos los dispositivos)
- Padding lateral uniforme de 16-20 px en todas las pantallas móviles, respetando las zonas seguras del iPhone (notch y barra inferior).
- Ninguna tarjeta supera el ancho: `max-w-full`, textos largos con puntos suspensivos, botones y precios que no se salen en iPhone SE (375 px) ni en iPhone Pro Max (430 px).
- Contenido centrado verticalmente cuando sobra espacio (nada de hueco negro abajo en pantallas altas).

## 3. Cero elementos zombi
- Todo lo que parece un botón responde al dedo; lo que es solo información no parece botón.
- La fila de días de la semana (donde quede) se convierte en acceso directo al entreno de ese día o se quita.

## 4. Jerarquía visual estilo Apple
- Títulos grandes en negrita, subtítulos en gris suave, una sola acción principal por pantalla (botón dorado), el resto en botones discretos.
- Tarjetas con esquinas muy redondeadas (20-28 px), fondos suaves, sin bordes duros ni sombras pesadas.
- Iconos en círculos o cuadrados redondeados con fondo tenue, como en Ajustes de iOS.

## 5. Movimiento suave
- Transiciones cortas y suaves entre pestañas y al abrir hojas (sin animaciones de entrada llamativas ni rebotes).
- Respuesta táctil inmediata: todo botón se hunde ligeramente al tocarlo (`active:scale`).

## 6. Limpieza de pantallas concretas
- **Inicio:** compacto, cabe entero sin bajar, saludo + sesión de hoy + nutrición + semana.
- **Nutrición:** ficha grande «en preparación» o anillo de calorías + comidas; sin botón «Gestionar suscripción» (eso vive en Perfil).
- **Progreso:** una fila de píldoras (Evolución | Fotos | Récords), gráfico de barras grande, sin scroll.
- **Chat:** paywall directo a Coach con la hoja de confirmación.
- **Admin:** selector de plan a 1 toque (Free / Plus / Coach), sin «Activar» redundante.

## Archivos principales
- `src/pages/Dashboard.tsx`, `src/components/dashboard/PlanPaywall.tsx` (hoja de confirmación), `src/components/mobile/MobileAppShell.tsx`, `src/components/dashboard/HomeOverview.tsx`, `src/components/dashboard/MealsList.tsx`, `src/components/admin/UserDetail.tsx`.

## Verificación (en el mismo pase)
- Typecheck limpio.
- Prueba en pantalla con móvil simulado (390×844 y 375×667): la hoja de confirmación aparece antes de Stripe, ninguna tarjeta se sale, todo cabe sin scroll.
