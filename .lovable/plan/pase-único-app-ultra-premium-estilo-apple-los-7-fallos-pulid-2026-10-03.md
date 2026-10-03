# Pase único: app ultra premium estilo Apple (los 7 fallos + pulido total)

Todo en una sola instrucción para gastar los mínimos créditos.

## Los 7 fallos de las capturas
1. **Pestañas a distinta altura** — Inicio, Plan, Nutrición, Chat y Progreso empiezan el contenido siempre a la misma distancia del techo, con el mismo padding lateral.
2. **Entrenamiento «Hecho por hoy»: tarjetas anidadas** — se aplana la jerarquía: un solo contenedor, elementos sueltos dentro, y las fichas dejan de cortarse por el borde derecho («FO… M… Gl…»).
3. **Espaciado irregular** — el mismo ritmo de separación entre título, tarjeta, cifras y botones en todas las pantallas.
4. **Evolución con una sesión** — la barra solitaria se ve más ancha y con presencia (ancho mínimo, centrada, brillo dorado), no un palito flaco.
5. **Fotos y Récords con hueco negro** — el contenido se centra verticalmente y aprovecha la pantalla; estados vacíos con tarjeta grande cuidada.
6. **Inicio: banner «Plan Gratis» enorme** — pasa a franja fina de una línea (o se oculta tras la primera visita); deja de empujar todo hacia abajo.
7. **Nutrición/Chat abren Stripe de golpe** — hoja de confirmación estilo Apple antes del pago: plan, precio, 3-4 puntos de lo que incluye, botón «Continuar al pago» y «Ahora no». Nutrición ofrece Plus (29 €) y Coach (49 €); Chat solo Coach.

## Pulido ultra premium (transversal)
- Márgenes laterales uniformes (16-20 px) respetando zonas seguras del iPhone; nada se sale en 375 px ni en 430 px.
- Tarjetas con esquinas muy redondeadas, fondos suaves, sin bordes duros; una sola acción principal dorada por pantalla.
- Todo botón se hunde al tocarlo (`active:scale`); transiciones cortas y suaves entre pestañas.
- Cero elementos zombi: lo que parece botón responde; lo que es información no parece botón.
- Tipografía: títulos grandes en negrita, subtítulos en gris suave, cifras con números tabulares.

## Archivos principales
- `src/components/mobile/MobileAppShell.tsx` (estructura y alturas), `src/pages/Dashboard.tsx`, `src/components/dashboard/PlanPaywall.tsx` (hoja de confirmación), `HomeOverview.tsx` (banner fino), `WorkoutTracker.tsx` / `WorkoutStudyCards.tsx` (fin de entreno plano), `ExerciseProgressChart.tsx` (barra con presencia), `ProgressPhotos.tsx` / `PRsList.tsx` (estados vacíos centrados), `MealsList.tsx`.

## Verificación (en el mismo pase)
- Typecheck limpio.
- Prueba en pantalla con móvil simulado (390×844 y 375×667): pestañas alineadas, hoja antes de Stripe, nada se sale ni se anida, sin huecos negros.
