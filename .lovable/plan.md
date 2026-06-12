# Plan: dejar la app nativa lista para subir a App Store y Play Store

Cuando tengas las cuentas de Apple/Google solo tendrás que ejecutar los comandos finales y subir el binario. Todo lo demás queda preparado ahora.

## 1. Identidad visual de la app (icono + splash)

Generaré dos imágenes maestras con la estética actual de Autopilot (negro premium + acento dorado/primary, wordmark minimalista):

- `resources/icon.png` — 1024×1024, fondo sólido (sin transparencia, requisito de Apple), logotipo centrado con margen de seguridad.
- `resources/splash.png` — 2732×2732, logotipo centrado sobre fondo `#090909` (mismo color que ya usa `SplashScreen.backgroundColor` en `capacitor.config.ts`).

Estas dos imágenes son la "fuente única". A partir de ellas se generan automáticamente todos los tamaños que piden iOS y Android.

## 2. Generación automática de todos los tamaños

Añadiré `@capacitor/assets` como devDependency y un script en `package.json`:

```json
"scripts": {
  "assets:generate": "capacitor-assets generate --iconBackgroundColor #090909 --splashBackgroundColor #090909"
}
```

Con un único `npm run assets:generate` se crean todos los iconos y splash screens para iOS y Android desde `resources/icon.png` y `resources/splash.png`.

## 3. Configuración de producción de Capacitor

Hoy `capacitor.config.ts` apunta a la preview de Lovable (hot-reload). Para build de stores eso no puede ir. Reescribiré el archivo para que:

- Por defecto (producción) **no** incluya `server.url` → la app carga el bundle local `dist/`.
- Si defines `CAP_DEV=1` al sincronizar, vuelve a activar el hot-reload contra la URL de Lovable (útil mientras seguimos iterando).

Así no hay que tocar el archivo a mano cada vez que quieras compilar para stores.

## 4. Pantalla de Welcome en build de producción

Hoy la Welcome nativa se activa con `?native=1` en la URL. En el build de producción no hay query string, así que dependerá solo de `Capacitor.isNativePlatform()`, que ya funciona. Verificaré que `src/lib/platform.ts` y la ruta `/` en `src/App.tsx` no requieran el query param para que la app empaquetada arranque correctamente en Welcome.

## 5. Política de privacidad (obligatoria en ambas stores)

Ya tienes `/legal`. Añadiré un enlace claro a la política de privacidad pública (URL `https://autopilotplan.com/legal`) que podrás pegar tal cual en App Store Connect y Play Console.

## 6. Documento `MOBILE_RELEASE.md`

Crearé una guía corta en la raíz del repo con los pasos exactos que tendrás que ejecutar **una vez tengas las licencias**:

1. `git pull`
2. `npm install`
3. `npm run build`
4. `npm run assets:generate`
5. `npx cap sync`
6. iOS → abrir `ios/App/App.xcworkspace` en Xcode, configurar Team, Archive, subir a App Store Connect.
7. Android → `cd android && ./gradlew bundleRelease`, firmar el `.aab` con tu keystore, subir a Play Console.

Incluye también: bundle id (`app.lovable.aa0029da00154c05a2b503e61df0f87c`), nombre (`autopilotv2`), checklist de capturas y enlaces a la política de privacidad.

## Detalles técnicos

- **No** se tocan: edge functions, base de datos, lógica de Stripe, onboarding, dashboard.
- Cambios sólo en: `capacitor.config.ts`, `package.json` (script + devDependency), nuevo directorio `resources/`, nuevo `MOBILE_RELEASE.md`.
- El icono debe ser PNG opaco 1024×1024 (Apple rechaza transparencias/canal alfa en el icono de la store).
- `@capacitor/assets` se ejecuta en local, no en el bundle final → cero impacto en tamaño de app.

## Lo que sigue necesitando tu acción (no se puede automatizar)

- Crear cuentas Apple Developer (99 USD/año) y Google Play Console (25 USD único).
- Generar el keystore de Android (`keytool`) — comando incluido en `MOBILE_RELEASE.md`.
- Tomar capturas de pantalla en simulador/emulador.
- Rellenar fichas de las stores (descripción, categoría, edad, etc.).

¿Procedo con esto?
