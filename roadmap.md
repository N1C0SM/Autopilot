# Roadmap

## Peticiones actuales
- [x] Entrada general de administradores corregida: sesión real abre /admin, vista explícita de usuario preservada y 15 pruebas de entrada/callback pasan; no se ha publicado ni probado el consentimiento externo de Google/Apple.
- [x] Auditoría: separación de foto/formulario de Biblioteca, contraste de Guías e indicadores de cuentas gratis corregidos en la ronda anterior.
- [x] Confirmaciones y campos de texto compartidos: explicación accesible incluso cuando no se proporciona una descripción específica; pruebas de confirmar/cancelar y edición verificadas.
- [x] Fotos del cuestionario: respaldos distintos comprobados en navegador; caché web/nativa elimina fotos retiradas sin perder las conocidas si falla la conexión.
- [ ] Activación pública de fotos de biblioteca: bloqueada por conexión de Lovable Cloud.
- [x] Enlaces antiguos de iPhone/Mac: legal, ayuda y blog apuntan al sitio público; administración al subdominio de la app.
- [ ] Análisis corporal: destino Nutrición comprobado con sesión en navegador y cinco pruebas pasan; lectura del panel y cuenta admin bloqueadas por Lovable Cloud aún no disponible.
- [ ] Paridad web/nativa: 13 comprobaciones siguen fallando; incluyen expectativas de diseños anteriores y diferencias de Progreso/entreno que requieren revisión, no cambios ciegos del test.
- [x] Tracker: visor de 140, encuadre completo, caché PNG transparente y crunch APNG (12 fotogramas); 23 pruebas específicas y lectura en Biblioteca verificadas.
- [ ] Verificar tracker en iPhone/Mac tras recompilar (requiere Xcode/dispositivo); prueba completa web bloqueada por sesión admin sin acceso al tracker. La suite general de paridad reporta 15 fallos fuera de las pruebas específicas.
- [ ] Aplicar los 29 ejercicios y los siete días de THE 0.1% PROTOCOL a la cuenta indicada y verificar la lectura.
- [ ] Rematar telemetría de Progreso, botones de Ajustes, estados vacíos y proporciones de escritorio en web e iPhone/Mac.
- [ ] Priorizar fotos reales en nativo, regenerar Xcode si está disponible y verificar pruebas y capturas sin publicar.

- [ ] Muestras públicas fieles al móvil: Hoy, Entrenar, Progreso y navegación; verificar en móvil y escritorio.

- [x] Resumen final del cuestionario más visual (semana, objetivo, datos clave)
- [x] Pantalla para elegir cómo empezar rediseñada
- [x] Revisión de portada web y panel de ordenador (textos duplicados, alineación)
- [x] «Hoy»: Empezar entreno / Continuar entreno / Entrenar igualmente en descanso
- [x] Entrenar primero: botón fijo «Ir a entrenar» en pestañas secundarias del móvil
- [x] Hoy: quitado botón duplicado en descanso
- [x] Probado a 375 px: 1 toque desde Hoy hasta la primera serie; cabecera «Lastre» sin cortar

- [x] Fase A Apple: confirmaciones del entreno como hojas inferiores deslizables
- [x] Fase B Apple: explicar por qué se sube o mantiene el peso en cada ejercicio
- [x] Fase C Apple: icono, capturas y texto (vídeo pendiente: grabar en iPhone real) para la candidatura (App Store Connect → Nominations)
- [ ] Probar con usuarios reales en distintos iPhone (bloqueado: requiere dispositivos y usuarios)

## Integración con el ecosistema Apple (versión posterior)
- [x] HealthKit: guardar cada entrenamiento en Salud (duración, calorías) y leer el peso corporal (HealthKitManager.swift)
- [x] Widgets de pantalla de inicio y de bloqueo: sesión de hoy y racha semanal
- [ ] App para Apple Watch: registrar series y ver el descanso desde la muñeca

## Rediseño landing (referencia del usuario)
- [x] Portada idéntica a la referencia (cabecera, hero, dispositivos, problema, por qué, planes, cierre)
- [x] Paleta carbón cálido + champán en web, iPhone/Mac, imágenes compartidas y correos
- [ ] Repaso visual pantalla a pantalla de app móvil, web, Mac, compartir y correos

- [x] Drive: nombre del archivo = nombre del ejercicio asignado
- [x] iPhone/Mac: .apng animados en las fichas de ejercicio
- [x] Quitar el borde blanco del recorte de GIFs de ejercicios

## Ejercicios en movimiento
- [x] Landing con narrativa interactiva (teléfono fijo que muestra el entreno al hacer scroll)
- [x] Quitar el dibujo de patrón de movimiento y el campo «Patrón» del formulario; ejercicios animados
- [ ] Generar animación para los ejercicios que aún no la tienen (bloqueado: consume créditos de imagen, pendiente de tu visto bueno)
