## Objetivo

Convertir Autopilot en una app móvil real (publicable en App Store / Google Play vía Capacitor) sin tocar el desktop. En móvil pasamos de "web responsive" a un shell tipo app: barra inferior fija de 5 tabs, header móvil propio, transiciones entre secciones y safe-areas iOS/Android.

## Decisiones clave

- **Capacitor** como envoltorio nativo. El código sigue siendo el mismo React + Vite que ya tienes; Capacitor lo empaqueta como app.
- **Desktop sin cambios**: todo el rediseño vive detrás de breakpoints `md:` (≥768px se queda igual).
- **Barra inferior con 5 tabs**: Hoy · Plan · Nutrición · Chat · Progreso. Es la opción que mejor refleja los 5 bloques reales del producto y evita esconder Nutrición/Progreso bajo un "Más".
- Memoria del proyecto que decía "No native app / web desktop" queda **actualizada**: pasa a "web desktop + app nativa móvil vía Capacitor".

## Alcance

1. **Shell móvil global** (nuevo `MobileAppShell`)
   - Header fijo arriba: avatar + nombre a la izquierda, campana de notificaciones a la derecha. Título dinámico según tab.
   - Bottom tab bar fija con 5 tabs (Hoy, Plan, Nutrición, Chat, Progreso) y un indicador animado con framer-motion (estilo iOS).
   - Respeta `env(safe-area-inset-top/bottom)` para notch y home indicator.
   - Transiciones de slide/fade al cambiar de tab.

2. **Dashboard móvil**
   - En móvil, la `UserSidebar` desaparece y la navegación se hace vía el shell.
   - Cada sección (`home`, `training`, `nutrition`, `chat`, `progress`) se muestra a pantalla completa, con padding ajustado y scroll independiente.
   - Sustituyo el `MobileNav` actual (4 tabs, hash-based) por la barra del nuevo shell con 5 tabs.
   - Ajustes/Settings se mueve a un acceso desde el avatar del header móvil (icono engranaje) en lugar de ocupar un tab.

3. **Onboarding + Paywall móvil**
   - Pasos a pantalla completa, botones "Atrás / Siguiente" fijados abajo (sticky) con safe-area.
   - Inputs y selects con tamaño táctil mínimo 44px (Apple HIG).
   - Paywall: tarjetas de plan apiladas en vertical, CTA fijo abajo, vista previa del plan compacta arriba.

4. **Settings móvil**
   - Layout de "lista de ajustes" tipo iOS (filas con icono + label + chevron).
   - Cabecera con back button hacia Dashboard.

5. **Capacitor setup**
   - Instalación de `@capacitor/core`, `@capacitor/cli`, `@capacitor/ios`, `@capacitor/android`.
   - `capacitor.config.ts` con `appId: app.lovable.aa0029da00154c05a2b503e61df0f87c`, `appName: autopilotv2` y bloque `server` apuntando al sandbox para hot-reload durante desarrollo.
   - Plugins recomendados: `@capacitor/status-bar`, `@capacitor/splash-screen`, `@capacitor/keyboard`, `@capacitor/app` (para back button Android y deep links).
   - Inicialización en `src/main.tsx`: configurar StatusBar dark, ocultar Splash al cargar, listener de back button Android que respete la navegación interna.

6. **Detalles tipo nativo**
   - Pull-to-refresh en Dashboard (Hoy y Plan) usando un componente propio ligero con framer-motion (sin librerías nuevas).
   - Haptic feedback opcional al cambiar de tab (vía `@capacitor/haptics`) cuando se ejecuta como app nativa; en web no se nota.
   - Tap highlights deshabilitados (`-webkit-tap-highlight-color: transparent`).
   - Scroll con momentum y `overscroll-behavior: contain` para que no rebote la app entera.

## Cómo se prueba

- **En el editor / preview web**: redimensionas a móvil con el botón de viewport y ves el shell completo, exactamente como en la app.
- **En tu móvil de verdad**: exportas a GitHub, `npm install`, `npx cap add ios` / `android`, `npm run build`, `npx cap sync`, `npx cap run ios` o `android`. (Necesitas Xcode para iOS y Android Studio para Android. Eso ya es manual y se sale del editor.)

## Lo que NO toco

- Desktop (≥768px): mismo Dashboard, misma sidebar, mismo paywall. Cero cambios visuales.
- Lógica de Stripe, generate-plan, calendar feed, training rules, edge functions: intacto.
- Backend / base de datos: cero migraciones.

## Detalles técnicos

- Nuevo: `src/components/mobile/MobileAppShell.tsx`, `src/components/mobile/MobileTabBar.tsx`, `src/components/mobile/MobileHeader.tsx`.
- `Dashboard.tsx` envuelto en `<MobileAppShell>` solo cuando `useIsMobile()` es true; en desktop sigue con `SidebarProvider + UserSidebar`.
- `MobileNav.tsx` antiguo se elimina (sustituido por `MobileTabBar`).
- `index.css`: variables `--safe-top` / `--safe-bottom`, reset de tap highlight.
- `Onboarding.tsx` y `Settings.tsx` reciben clases responsive nuevas (sticky footers en móvil) sin reescritura completa.
- `capacitor.config.ts` nuevo en raíz. `package.json` con nuevas deps Capacitor.
- Memoria de proyecto: actualizo el core de "No native app" para reflejar la nueva realidad.

## Fuera del plan (te pregunto antes de hacerlo)

- Push notifications nativas (requiere Firebase/APNs setup).
- Login con Apple / Google nativo (vs OAuth web actual).
- Iconos e imagen de splash personalizados (ahora mismo se generan placeholders; si quieres branding final me pasas el icono 1024×1024).
