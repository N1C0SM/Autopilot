# Rediseño total estilo Apple (todo en un solo pase)

Objetivo: que toda la app se vea y se sienta como una app de Apple — márgenes limpios, tarjetas que siempre caben, todo alineado a la misma altura, nada se abre de golpe, cero elementos que no se puedan tocar.

## 1. Pagos: confirmación antes de Stripe
- Nutrición y Chat: al tocar «Elegir Coach» / «Mejorar a Plus» se abre una **hoja de confirmación estilo Apple** (fondo difuminado, tarjeta centrada) con el plan, el precio, 3-4 puntos de lo que incluye y el botón «Continuar al pago». Solo ahí se abre Stripe.
- En Nutrición la hoja deja elegir entre Plus (29 €) y Coach (49 €); en Chat solo Coach.
- Enlace discreto «Ahora no» para cerrar sin pagar.

## 2. Todas las pestañas a la misma altura
- Ahora mismo cada pestaña (Inicio, Plan, Nutrición, Chat, Progreso) sienta su contenido a una altura distinta — se ve en las capturas.
- Se fija una estructura única: cabecera, luego contenido empezando siempre a la misma distancia del techo, con el mismo padding lateral en todas.

## 3. Entrenamiento «Hecho por hoy»: sin tarjetas anidadas
- La tarjeta de «Entrenamiento completado» aparece metida dentro de otra tarjeta y queda mal.
- Se aplana la jerarquía: un solo contenedor con fondo uniforme y dentro los elementos sueltos (título, sello de telemetría, cifras, botones) con **el mismo espacio entre todos**, no huecos distintos entre título y tarjeta que entre tarjeta y botones.

## 4. Márgenes y tarjetas que siempre caben (todos los dispositivos)
- Padding lateral uniforme de 16-20 px en todas las pantallas móviles, respetando las zonas seguras del iPhone.
- Ninguna tarjeta supera el ancho: textos largos con puntos suspensivos, botones y precios que no se salen en iPhone SE (375 px) ni en Pro Max (430 px).
- Contenido centrado verticalmente cuando sobra espacio (nada de hueco negro abajo en pantallas altas).

## 5. Cero elementos zombi
- Todo lo que parece un botón responde al dedo; lo que es solo información no parece botón.

## 6. Jerarquía visual estilo Apple
- Títulos grandes en negrita, subtítulos en gris suave, una sola acción principal por pantalla (botón dorado), el resto discreto.
- Tarjetas con esquinas muy redondeadas, fondos suaves, sin bordes duros.
- Respuesta táctil inmediata: todo botón se hunde ligeramente al tocarlo.

## Archivos principales
- `src/pages/Dashboard.tsx`, `src/components/dashboard/PlanPaywall.tsx` (hoja de confirmación), `src/components/mobile/MobileAppShell.tsx`, `src/components/dashboard/HomeOverview.tsx`, `src/components/dashboard/WorkoutTracker.tsx` / `WorkoutStudyCards.tsx` (fin de entreno), `src/components/dashboard/MealsList.tsx`.

## Verificación (en el mismo pase)
- Typecheck limpio.
- Prueba en pantalla con móvil simulado (390×844 y 375×667): la hoja aparece antes de Stripe, todas las pestañas empiezan a la misma altura, ninguna tarjeta se sale ni se anida.
