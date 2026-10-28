# Roadmap nativo: C → B

Decisión de producto (22/10/2026): **C ahora, B después**. A no va detrás de B:
A es el primer tramo de B y, a la vez, el plan de escape si B se atasca.

---

## Fase C — Pulido Apple feel (1–2 semanas)

Objetivo: que la app actual (Capacitor + WebView) se comporte como una app de
iOS en todo lo que la persona toca, sin cambiar la arquitectura.

### Hecho

- **Dynamic Type real**: `src/lib/native.ts` mide `-apple-system-body` y escribe
  `--type-scale`; la escala tipográfica de `src/index.css` la aplica. La app
  sigue el tamaño de texto de Ajustes del sistema (de XS a XXXL).
- **Cobertura tipográfica**: las 957 clases `type-*` y las utilidades `text-*` de
  Tailwind (181 usos) escalan con el sistema. `Welcome.tsx` se alineó con
  `type-*`. Quedan 125 tamaños fijos en px, concentrados en onboarding y
  marketing, para la auditoría de la fase C.
- **Verificado en simulador** (iPhone 17 Pro Max, iOS 26.2): a XXXL el texto
  crece y el layout de bienvenida aguanta sin cortes; a Large vuelve al tamaño
  base. `xcrun simctl ui … content_size` reproduce el ajuste real.
- **Scroll por pestaña**: `MobileAppShell` recuerda la posición de cada pestaña,
  como un `UITabBarController`; al volver, sigues donde lo dejaste.
- **Increase Contrast**: `prefers-contrast: more` refuerza separadores y textos
  secundarios, igual que UIKit.
- **Base ya presente**: sin selección de texto, sin callout, sin zoom por
  pellizco ni doble toque, sin resaltado al tocar, sin hover pegado, safe areas,
  Reduce Motion, Reduce Transparency, hojas inferiores arrastrables, alertas
  centradas de 270 pt, títulos grandes que se pliegan, hápticos, scroll-to-top
  al tocar la barra de estado y teclado nativo.

### Pendiente

1. **Pull-to-refresh** con háptico en Hoy, Plan y Nutrición.
2. **Push/pop de Ajustes y Recursos** + gesto de borde para volver.
3. **SF Symbols en el chrome** (tab bar y nav bar), manteniendo Lucide en el
   contenido.
4. **Banner de sin conexión** con reintento. Además de UX, es evidencia de §4.2.
5. **Auditoría a XXXL** y migración de los 125 tamaños fijos que aún no escalan,
   antes de subir el límite de 1,35.

### Criterio de salida

- Ningún gesto de iOS «no responde» (refrescar, volver, subir al principio).
- Revisión visual a tamaño de texto XXXL sin cortes.
- `npx tsc -b`, `npm run build` y `npm test` en verde.

---

## Fase B — 100% SwiftUI (3–6 meses)

Objetivo: eliminar la WebView de la app de consumo. La web queda como panel de
administración y entrenador.

Supabase sigue siendo la única fuente de verdad: no se duplica lógica de negocio.

### B1 — Núcleo nativo (6–8 semanas) ← esto era la fase A

1. **Shell**: `TabView` + `NavigationStack`, títulos grandes, hojas, hápticos y
   Dynamic Type nativos.
2. **Sesión compartida**: token en Keychain, inyectado en la WebView. Un login.
3. **Hoy** nativo (lectura).
4. **Entreno activo** nativo: uso diario, temporizador de descanso y modo sin
   conexión con `SwiftData`.
5. **Nutrición** nativa.
6. El resto sigue en web.

**Hito publicable**: si B se detiene aquí, la app ya es un híbrido sólido y se
puede seguir publicando. Ese híbrido es lo que antes llamábamos fase A.

### B2 — Resto nativo (2–4 meses)

- Auth completo: OTP de 8 dígitos, deep links, recuperación, Apple Sign in.
- Onboarding de 7 pasos con lógica dinámica.
- Progreso: gráficas, fotos, récords.
- Escaneo con cámara y visión.
- PDF, exportación y compartir.
- Ajustes, suscripción y borrado de cuenta.
- Legal, blog y recursos (pueden quedarse en web si no aportan).
- Chat con vídeo, si vuelve a estar activo.

### Riesgos

- 3–6 meses sin releases si se hace de golpe; por eso B1 publica antes.
- Dos capas de render durante B1: hay que fijar una sola barra de navegación.
- Sincronización de sesión y de eventos (`autopilot:nutrition-plan-updated`).
- Rotación de equipo: la web es el único código que hoy conoce todo el mundo.

### Criterio de salida

- Cero `WKWebView` en la app de consumo.
- Paneles de admin y entrenador siguen en web.

---

## A — Plan de escape, no fase posterior

Si B se atasca después de B1 (por tiempo, equipo o negocio), **A es quedarse en
B1**: núcleo nativo + resto en web, y seguir publicando. No se planifica después
de B porque, cuando B termina, A ya no existe: su alcance está dentro de B.

---

## Puertas de decisión

| Después de | Pregunta | Si la respuesta es no |
| --- | --- | --- |
| C | ¿La app ya se siente de iOS en gestos y tipografía? | Seguir puliendo C; B no arregla lo que falla en la capa web |
| B1 | ¿Merece la pena mantener dos capas para llegar a B2? | Quedarse en A (híbrido) y publicar |
| B2 | ¿Hay equipo y presupuesto para el último tramo? | Cerrar B2 por pantallas, empezando por Progreso y Ajustes |

## Lo que no se hace

- Reescribir todo de golpe sin el hito publicable de B1.
- Duplicar la lógica de negocio en Swift y en TypeScript.
- Añadir compra in-app solo por «parecer nativo»: §3.1.1 se cumple ocultando la
  venta digital en iOS, que es lo que ya hace la app.
