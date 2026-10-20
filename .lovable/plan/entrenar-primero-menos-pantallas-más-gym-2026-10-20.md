# Entrenar primero: menos pantallas, más gym

Idea guía (como Hevy/Symmetry): quien abre la app en el gimnasio quiere entrenar. Todo lo demás pasa a segundo plano.

## 1. Pantalla «Hoy» = tu entreno de hoy
- Lo primero que ves: el nombre de la sesión de hoy, los ejercicios en una lista corta y un botón grande amarillo «Empezar entreno».
- Si hoy es descanso: «Hoy toca descansar» y un botón secundario «Entrenar igualmente».
- Si ya hay un entreno a medias: «Continuar entreno» arriba del todo.
- Anillos, peso, mapa muscular y consejos bajan debajo, sin tapar el botón.

## 2. Un toque para entrenar
- Desde la app (móvil y Android), al abrirla: cero pantallas intermedias antes de «Empezar».
- El botón «Empezar» también fijo en la barra de abajo mientras no estés entrenando.
- Durante el entreno: solo la serie actual, el descanso y «Siguiente». Sin menús.

## 3. Del registro al primer entreno lo antes posible
- Tras verificar la cuenta: directo a la sesión de hoy con «Empezar mi primer entreno».
- El scan y el resto quedan como opcionales desde el panel, no en el camino.

## 4. Quitar ruido
- Revisar menús y tarjetas del panel: lo que no ayuda a entrenar o a comer según el plan, se agrupa o se esconde en Ajustes.
- Mismos textos y orden en web y en móvil.

## Cómo lo compruebo
- En móvil a 375 px: desde abrir la app hasta la primera serie en 2 toques como máximo.
- Con una cuenta de prueba con rutina: «Hoy», descanso y entreno a medias.

## Detalles técnicos
- Tocar `HomeOverview.tsx` (orden y CTA), barra de `MobileAppShell`, destino tras verificar en `signupVerification.ts`.
- Reutilizar el borrador de entreno activo (`activeWorkout.ts`) para «Continuar».
- Sin cambiar la lógica de progresión ni el escudo de rutinas.
