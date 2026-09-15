# Autopilot — publicación en App Store (iOS) y Play Store (Android)

El proyecto `ios/` y `android/` ya existen en el repo y la configuración de
Capacitor está hecha. **No ejecutes `cap init` ni `cap add`.**

## Datos de la app

- **Nombre:** Autopilot
- **Bundle ID:** `app.lovable.aa0029da00154c05a2b503e61df0f87c`
- **Esquema de enlaces propios (deep links):** `autopilot://`
- **Retorno de autenticación nativa:** `autopilot://auth-callback`
- **Privacidad:** https://autopilotplan.com/legal/privacidad
- **Términos:** https://autopilotplan.com/legal/terminos
- **Soporte:** https://autopilotplan.com (chat dentro de la app)

## Requisitos

- Mac con **Xcode** actualizado + cuenta **Apple Developer Program** (99 USD/año).
- Node 20+.

---

## 1. Instalar dependencias

```bash
git pull
npm install
```

## 2. Build de producción + sync solo iOS

`capacitor.config.ts` solo añade `server.url` (hot-reload) cuando
`CAP_DEV=1`. Para la tienda **siempre** `CAP_DEV=0`, así la app carga el
bundle local de `dist/`.

```bash
npm run ios:sync     # CAP_DEV=0 → vite build + cap sync ios
```

Comprobación rápida de que no hay hot-reload en el binario (no debe imprimir
ninguna línea `url`):

```bash
grep -n "url" ios/App/App/capacitor.config.json
```

Solo para desarrollo contra Lovable (nunca para subir a la tienda):

```bash
npm run ios:dev      # CAP_DEV=1 cap sync ios
```

Iconos y splash (si cambias `resources/`):

```bash
npm run assets:generate && npm run ios:sync
```

## 3. Abrir Xcode

```bash
npm run ios:open     # equivale a CAP_DEV=0 npx cap open ios
```

## 4. Configurar firma

En Xcode, target **App** → **Signing & Capabilities**:

1. **Automatically manage signing** activado y selecciona tu **Team**.
2. **Bundle Identifier** = `app.lovable.aa0029da00154c05a2b503e61df0f87c`.
3. Añade la capability **Sign In with Apple** (obligatoria para el botón
   "Continuar con Apple").
4. `Info.plist` ya incluye el esquema `autopilot`, los textos de cámara/fotos
   y `ITSAppUsesNonExemptEncryption = false`.
5. Sube **Version** (`1.0.0`) y **Build** (`1`).

## 5. Probar en un iPhone real

```bash
npm run ios:sync
npm run ios:open
```

En Xcode elige tu iPhone conectado y pulsa **Run**. Prueba en el dispositivo:

- Registro con correo → abrir el enlace del email → debe abrir **la app**
  (probar con la app abierta y con la app cerrada).
- "¿Olvidaste tu contraseña?" → enlace del email → pantalla de nueva contraseña.
- **Continuar con Apple** → hoja de Apple → vuelve a la app con sesión activa.
- Cerrar y reabrir la app: la sesión debe mantenerse.
- Chat con el teclado abierto, subida de fotos (cámara y galería).
- Eliminar cuenta desde Ajustes.
- Girar el teléfono (horizontal) y probar en iPad.

## 6. Subir a TestFlight

En Xcode:

1. Destino **Any iOS Device (arm64)**.
2. **Product → Archive**.
3. En el Organizer: **Distribute App → App Store Connect → Upload**.

En https://appstoreconnect.apple.com:

4. **TestFlight** → espera el procesado → responde el cuestionario de
   exportación de cifrado → añade testers internos.
5. Instala TestFlight en tu iPhone y repite las pruebas del punto 5.

## 7. Enviar a revisión

1. Crea la ficha en App Store Connect: nombre, subtítulo, descripción,
   palabras clave, categoría **Salud y forma física**.
2. Capturas 6.7" y 6.5" (y iPad si declaras compatibilidad).
3. URL de privacidad y de soporte (arriba).
4. **App Privacy**: declara los datos que recoges (correo, nombre, datos de
   salud/actividad, fotos, contenido de chat, identificadores) y su uso.
5. **Account deletion**: indica que se borra desde Ajustes → Eliminar cuenta.
6. Cuenta de prueba para el revisor (correo + contraseña).
7. **Compras**: si la suscripción se vende dentro de la app, hay que usar
   compras dentro de la app de Apple (ver sección 9). Enviar la app con un
   checkout web de suscripción para consumo dentro de la app es motivo de
   rechazo (guideline 3.1.1).
8. **Submit for Review**.

---

## 8. Configuración externa pendiente (fuera de Lovable)

| Dónde | Qué falta |
|---|---|
| Backend → Auth → URL Configuration | Añadir a *Redirect URLs*: `autopilot://auth-callback` y `autopilot://auth-callback?**`. Sin esto los enlaces de email y Apple no vuelven a la app. |
| Backend → Auth → Sign In Methods → Apple | Activar Apple. Para publicar con tu propia marca hace falta *bring your own credentials*: **Team ID**, **Key ID**, **Services ID (Client ID)** y el **.p8** de Apple Developer. Yo no puedo generarlos. |
| Apple Developer → Identifiers | Activar **Sign In with Apple** en el App ID y crear el **Services ID** con el dominio `autopilotplan.com` y la callback de Supabase `https://<ref>.supabase.co/auth/v1/callback`. |
| App Store Connect | Ficha, capturas, App Privacy, cuenta de prueba. |
| Google Calendar | La conexión de calendario vuelve a la web (`autopilotplan.com`). Si la quieres dentro de la app hay que añadir el retorno nativo al OAuth de Google. |

## 9. Pagos en iOS (pendiente de decisión)

Hoy los planes (Entrenamiento 29 €/mes, Completo 49 €/mes, Transformación
299 €) se cobran con **enlaces de pago de Stripe** abiertos en el navegador,
y el acceso se activa por webhook. Eso es válido en la web, pero Apple exige
compras dentro de la app para desbloquear contenido dentro de la app.

Propuesta (a implementar cuando la apruebes):

1. Crear en App Store Connect las suscripciones auto-renovables equivalentes
   (mensual/anual) con prueba de 7 días.
2. Integrar un plugin de compras nativo, mostrar los precios de Apple en el
   muro de pago **solo en iOS** y mantener el checkout de Stripe en la web.
3. Botón **"Restaurar compras"** (obligatorio) en Ajustes.
4. Función de backend que valide el recibo/transacción con Apple y escriba
   `payment_status` y `subscription_tier` en el perfil, más notificaciones
   server-to-server de Apple para renovaciones y cancelaciones.
5. Un usuario que ya pagó por web mantiene el acceso: el estado vive en el
   perfil, no en la tienda.

---

## 10. Android (Play Store)

```bash
npm run mobile:sync
```

Keystore (una vez):

```bash
keytool -genkeypair -v -keystore android/autopilot-release.jks \
  -alias autopilot -keyalg RSA -keysize 2048 -validity 10000
```

Copia `android/keystore.properties.example` → `android/keystore.properties`,
rellena contraseñas y genera el AAB:

```bash
npm run android:aab
```

Salida: `android/app/build/outputs/bundle/release/app-release.aab`.

> Para Android falta además declarar el esquema `autopilot://` en
> `android/app/src/main/AndroidManifest.xml` (en iOS ya está hecho).

## 11. Actualizaciones futuras

```bash
git pull && npm install
npm run ios:sync
npm run ios:open   # sube Version/Build → Archive → Upload
```
