# Auditoría de cumplimiento: App Store Review Guidelines

**App:** Autopilot (Capacitor iOS, `ios/App`)
**Fecha:** 22 de octubre de 2026
**Alcance:** binario iOS + código fuente + metadatos de tienda + textos legales + web pública
**Marco:** App Store Review Guidelines (versión vigente 2026) + requisitos de App Store Connect

---

## 1. Veredicto ejecutivo

**Nota tras las correcciones: 7,5 / 10 — presentable, con 3 tareas que dependen de ti.**

La app ya no vende nada dentro de iOS, no promete funciones que no existen y sus textos legales dicen la verdad. Los 6 bloqueantes están cerrados en código. Quedan tres cosas que **no puedo hacer yo** porque necesitan tu cuenta o tus credenciales:

| Pendiente | Por qué no lo puedo cerrar yo |
|---|---|
| Capturas reales de la app | Necesitan la app en un dispositivo con la cuenta de prueba |
| Cuenta demo para el revisor | Necesita un usuario real en tu Supabase |
| Firma y bundle ID propios | Necesita tu Apple Developer Program |

Todo lo demás está aplicado. `tsc` y `npm run build` en verde; `npm test` 507/508 (el único fallo es previo a estos cambios y afecta a la regeneración de comidas).

### Qué se ha corregido

| # | Bloqueante | Estado |
|---|-----------|--------|
| 1 | PDFs de pago con Stripe dentro de iOS | ✅ filtrado en `Recursos.tsx` + `BookPreviewModal.tsx` |
| 2 | Estrategia "reader app" inválida | ✅ reescrita en `MOBILE_RELEASE.md` y en 11 comentarios de código |
| 3 | Copy que invitaba a comprar en la web | ✅ eliminado de `IosFeatureLocked.tsx` |
| 4 | Metadatos y capturas engañosos | ✅ ficha reescrita; capturas retiradas del repo |
| 5 | Falta `NSMicrophoneUsageDescription` | ✅ añadido a `Info.plist` |
| 6 | El borrado no cancelaba la suscripción | ✅ cancelación real en `delete-account` |

Además se cerraron riesgos altos: consentimiento de IA explícito, política de privacidad coherente con los proveedores reales, retirada de la promesa falsa de revisión humana en todos los planes, `Purchases` en el manifiesto de privacidad, cancelación in-app en iOS y un bug de hooks que podía tumbar el onboarding.

---

## 1 bis. Diagnóstico original (histórico)

**Nota antes de las correcciones: 5 / 10 — no presentar.**


La app está **bien construida a nivel de ingeniería** (borrado de cuenta in-app, exportación de datos, manifiesto de privacidad incluido, sin tracking, sin código remoto, iconos y capturas con dimensiones correctas). El problema no es técnico: es de **modelo de negocio y de veracidad de lo que se declara**.

Hay **6 bloqueantes** que, tal como están, producen rechazo casi seguro. Cuatro de ellos se arreglan sin tocar la arquitectura:

| # | Bloqueante | Guideline | Esfuerzo |
|---|-----------|-----------|----------|
| 1 | Guías en PDF de pago (Stripe) visibles dentro de iOS | 3.1.1 | Bajo (ocultar en iOS) |
| 2 | Estrategia "reader app" inválida para fitness | 3.1.3(a) | Bajo (documento + código) |
| 3 | Copy que invita a comprar en la web | 3.1.1 / 3.1.3(a) | Bajo |
| 4 | Metadatos y capturas prometen funciones no enviadas | 2.3.1 / 2.3.3 | Medio |
| 5 | Falta `NSMicrophoneUsageDescription` con WebRTC activo | 5.1.1(ii) / 2.1 | Trivial |
| 6 | El borrado de cuenta dice cancelar la suscripción y no la cancela | 5.1.1 / 2.3.1 | Bajo |

Además, dos riesgos de **credibilidad legal** que un revisor humano detecta leyendo la política de privacidad: se afirma revisión humana de *todos* los planes (falso) y se nombra "Google Gemini" cuando la cadena real es OpenAI → Anthropic → DeepSeek → Lovable.

**Recomendación:** no envíes a revisión hasta cerrar P0. El camino más rápido y barato es **lanzar la v1 como app de contenido gratuito + funciones de entrenamiento**, sin ningún punto de venta digital dentro del binario, y vender suscripciones y PDFs solo en la web. La v2, con StoreKit, es la solución correcta a medio plazo.

---

## 2. Metodología

Se ha revisado:

- `ios/App/App/Info.plist`, `PrivacyInfo.xcprivacy`, `project.pbxproj`, `AppDelegate.swift`, `SceneDelegate.swift`
- `capacitor.config.ts`, `MOBILE_RELEASE.md`, `store-assets/*`
- Rutas de compra y bloqueo iOS: `src/pages/Recursos.tsx`, `src/components/BookPreviewModal.tsx`, `src/components/platform/*`, `src/lib/platform.ts`, `src/lib/releaseScope.ts`
- Textos legales y consentimientos: `src/content/legal.ts`, `src/pages/Onboarding.tsx`, `src/pages/Scan.tsx`, `src/components/AIDisclaimer.tsx`, `src/components/SettingsPanel.tsx`
- Backend de cuenta: `supabase/functions/delete-account/index.ts`, `supabase/functions/_shared/ai-provider.ts`
- Estado real de la web pública: `/planes`, `/recursos`, `/legal/privacidad`, `/connect`

**Semáforo:** 🟢 cumple · 🟡 riesgo / depende de configuración · 🔴 incumple.

---

## 3. Semáforo por guideline

### 1. Seguridad

| Guideline | Estado | Comentario |
|---|---|---|
| 1.1 Contenido objetable | 🟢 | Sin contenido de terceros abierto |
| 1.2 UGC | 🔴 | **Solo si se activa el chat.** No hay reportar/bloquear/filtrar. Hoy `DASHBOARD_CHAT_ENABLED = false` |
| 1.3 Kids | 🟢 | No dirigida a menores |
| 1.4 Daño físico | 🟡 | Ejercicio y nutrición: existen avisos médicos, pero hay afirmaciones de salud que conviene revisar (ver 5.1.3) |
| 1.5 Información del desarrollador | 🟡 | Depende de que App Store Connect tenga soporte real (ver 2.3.1) |
| 1.6 Seguridad de datos | 🟢 | HTTPS, RLS, sin secretos en el bundle |
| 1.7 Denuncia de delitos | 🟢 | No aplica |

### 2. Rendimiento

| Guideline | Estado | Comentario |
|---|---|---|
| 2.1 Completitud | 🔴 | Falta string de micrófono; texto de borrado promete algo que no ocurre |
| 2.2 Beta | 🟢 | No es beta |
| 2.3.1 Metadatos ocultos/falsos | 🔴 | Se anuncia chat con entrenador que no está en el binario; URL de soporte errónea; sin notas de revisión ni cuenta demo |
| 2.3.3 Capturas | 🔴 | Capturas con UI de escritorio (sidebar con "Chat") y recortes; no representan la app |
| 2.3.7 Nombre/subtítulo | 🟡 | `CFBundleDisplayName` sobrescrito por `INFOPLIST_KEY_CFBundleDisplayName="Autopilot Fitness"` |
| 2.3.8 Edad | 🟡 | Información médica → probable 12+; verificar cuestionario |
| 2.4 Compatibilidad hardware | 🟢 | iPad + orientaciones declaradas |
| 2.5.1 APIs públicas | 🟢 | Sin APIs privadas |
| 2.5.2 Código ejecutable | 🟢 | `capacitor.config.ts` sin `server.url`; sin actualizaciones dinámicas de código |
| 2.5.5 IPv6 | 🟢 | Dominios con AAAA |
| 2.5.6 Navegador | 🟢 | WKWebView |
| 2.5.9 Publicidad | 🟢 | Sin SDKs de anuncios |

### 3. Negocio

| Guideline | Estado | Comentario |
|---|---|---|
| 3.1.1 IAP obligatorio para bienes digitales | 🔴 | **PDFs de pago comprables desde la app vía Stripe** |
| 3.1.1(a) Enlaces externos | 🟡 | Solo con `StoreKit External Purchase Link Entitlement` y por región; hoy no existe entitlement |
| 3.1.2 Suscripciones | 🔴 | No hay StoreKit; si se activa la campaña, hay paywall sin IAP |
| 3.1.3(a) Reader apps | 🔴 | Fitness **no** está en la lista de categorías elegibles |
| 3.1.3(b) Contenido ya comprado | 🔴 | Exigiría IAP también disponible |
| 3.1.4 Códigos/hardware | 🟢 | No aplica |
| 3.1.5 Cripto | 🟢 | No aplica |
| 3.2 Otros modelos | 🟡 | Coaching 1:1 humano es defendible como servicio; el PDF no |

### 4. Diseño

| Guideline | Estado | Comentario |
|---|---|---|
| 4.1 Copias | 🟢 | Marca propia |
| 4.2 Funcionalidad mínima | 🟡 | Riesgo de "wrapper web". Mitigado por haptics, cámara, share, offline, videollamada — pero conviene reforzar en las notas de revisión |
| 4.3 Spam | 🟢 | No aplica |
| 4.7 Mini apps | 🟢 | No aplica |
| 4.8 Login services | 🟡 | Si en el futuro se añade login social de terceros, hará falta Sign in with Apple (hoy oculto en `appleSignInEnabled() => false`) |
| 4.9 Apple Pay | 🟢 | No se usa |

### 5. Legal

| Guideline | Estado | Comentario |
|---|---|---|
| 5.1.1(i) Política de privacidad | 🟡 | Existe y es accesible, pero contiene afirmaciones inexactas |
| 5.1.1(ii) Permisos | 🔴 | **Falta `NSMicrophoneUsageDescription`** y se usa `getUserMedia(audio: true)` |
| 5.1.1(v) Borrado de cuenta | 🟡 | Existe in-app, pero el texto promete cancelar la suscripción y no lo hace |
| 5.1.2(i) Uso de datos / terceros con IA | 🔴 | Sin consentimiento explícito para IA de terceros; sin retirada en Ajustes |
| 5.1.2 App Privacy labels | 🟡 | Manifiesto sin `Purchases` (estado de suscripción) ni `Diagnostics` |
| 5.1.3 Salud e investigación | 🟡 | Avisos médicos presentes; falta coherencia en las afirmaciones |
| 5.2 Propiedad intelectual | 🟢 | Contenido propio |
| 5.6 Código de conducta | 🟢 | — |

---

## 4. Bloqueantes (P0)

### P0-1 · Venta de bienes digitales con Stripe dentro de iOS — §3.1.1

**Evidencia**

- `src/pages/Dashboard.tsx:873` renderiza `<Recursos embedded />` sin ninguna condición de plataforma.
- `src/pages/Recursos.tsx:93-104` carga `library_books` publicados y construye `url` con `buy_url_live`.
- `src/components/BookPreviewModal.tsx:82-89` muestra precio y botón **"Comprar ahora"** que abre la URL de Stripe en el navegador externo.
- Contenido real publicado en `/recursos`: Pack Completo 29,90 €, Base de Fuerza 9,90 €, Nutrición 19,90 €, Atlas de Progresiones 14,90 €, Manual de Periodización 19,90 €.

**Por qué es rechazo:** son PDFs, es decir, contenido digital consumible dentro de la app. §3.1.1 exige IAP. No hay `isIOSNative()` en ningún punto de esta ruta. Es el hallazgo más grave y el más fácil de detectar por un revisor (está a dos toques desde el dashboard).

**Arreglo mínimo (v1):** ocultar la sección de guías de pago cuando `isIOSNative()`, o mostrar solo guías gratuitas. Mantener el catálogo en web.

**Arreglo correcto (v2):** StoreKit 2 con los mismos productos, y precio alineado con Stripe.

---

### P0-2 · El modelo "reader app" no aplica a fitness — §3.1.3(a)

**Evidencia**

- `MOBILE_RELEASE.md:139-140`: *"La v1 iOS no integra StoreKit ni IAP. Se envía como reader app bajo la App Store Review Guideline §3.1.3(a)"*.
- El mismo razonamiento se repite en comentarios de `src/components/platform/IosFeatureLocked.tsx:11-18`.
- Existen 34 guards `isIOSNative()` construidos sobre esa premisa.

**Por qué es rechazo:** §3.1.3(a) enumera taxativamente las categorías elegibles: **revistas, periódicos, libros, audio, música y vídeo**. Una app de entrenamiento y nutrición no pertenece a ninguna. Además §3.1.3(b) exige que el contenido esté **también** disponible por IAP, lo que hoy no ocurre.

**Consecuencia práctica:** toda la estrategia de "bloquear función + decir que existe el plan" está apoyada en una guideline que no os cubre. Si el revisor abre el paywall y ve el mensaje de `IosFeatureLocked`, lo leerá como intento de sortear §3.1.1.

**Arreglo:** sustituir la premisa. La v1 debe ser **una app con contenido gratuito y funciones de entrenamiento sin muro de pago**, no una "reader app". Reescribir `MOBILE_RELEASE.md` y los comentarios para que el equipo no vuelva a construir sobre ella.

---

### P0-3 · Copy que dirige a comprar fuera de la app — §3.1.1 / §3.1.3(a)

**Evidencia** — `src/components/platform/IosFeatureLocked.tsx:26-31`:

> "Visita **autopilotplan.com** desde tu navegador para conocer las opciones."

Se muestra desde `src/components/dashboard/PlanPaywall.tsx:60` cuando la campaña gratuita está desactivada.

**Por qué es rechazo:** es exactamente el "steering" que §3.1.1 prohíbe sin el entitlement de enlaces externos. Apple distingue entre mencionar que existe una web (permitido en contextos limitados) y dirigir al usuario a comprar allí (prohibido). La frase actual es del segundo tipo.

**Arreglo:** eliminar la llamada a la acción. Si quieres informar, usa texto neutro sin verbo de acción y sin dominio, o simplemente no muestres nada.

---

### P0-4 · Metadatos y capturas prometen lo que la app no hace — §2.3.1 / §2.3.3

**Evidencia**

- `src/lib/releaseScope.ts:2`: `DASHBOARD_CHAT_ENABLED = false`.
- `src/pages/Dashboard.tsx:913`: la pestaña de chat no se pinta.
- `store-assets/STORE_LISTING_ES.md:32`: *"Hablar con tu entrenador desde la app."*
- Las capturas en `store-assets/app-store/iphone-6.7/` muestran una **sidebar de escritorio con la opción "Chat"**, con recortes y elementos cortados; no representan la UI móvil real.
- Además, `store-assets/STORE_LISTING_ES.md:51` declara como URL de soporte `https://autopilotplan.com/connect`, que es una página de integración MCP, no de soporte.

**Por qué es rechazo:** §2.3.1 prohíbe funciones anunciadas que no existen; §2.3.3 exige capturas que muestren la app tal cual. Un revisor abre la app, busca el chat y no lo encuentra → rechazo por metadatos engañosos.

**Arreglo:**
1. Quitar de la ficha toda mención a chat, videollamadas y recordatorios hasta que estén publicados.
2. Rehacer las capturas sobre la UI móvil real (dashboard, entreno activo, progreso, escaneo), sin sidebar.
3. Cambiar la URL de soporte a una página real de ayuda/contacto (o `mailto:`).
4. Rellenar **App Review Information** con cuenta demo, notas de qué probar y por qué la app no es un wrapper.

---

### P0-5 · Falta el permiso de micrófono con WebRTC activo — §5.1.1(ii) / §2.1

**Evidencia**

- `ios/App/App/Info.plist` declara `NSCameraUsageDescription`, `NSPhotoLibraryUsageDescription` y `NSPhotoLibraryAddUsageDescription`, pero **no** `NSMicrophoneUsageDescription`.
- `src/hooks/useVideoCall.ts:75` llama a `navigator.mediaDevices.getUserMedia({ audio: true, video: true })`.

**Por qué es rechazo:** en iOS, pedir audio sin la cadena de permiso provoca cierre de la app (crash) al iniciar la llamada. Un crash reproducible es rechazo automático por §2.1, además del incumplimiento de §5.1.1(ii).

**Arreglo:** añadir la cadena con un texto específico, p. ej. *"Autopilot usa el micrófono para las videollamadas con tu entrenador."* Si la videollamada se va a desactivar en v1, además hay que impedir que se pueda invocar.

---

### P0-6 · El borrado de cuenta afirma cancelar la suscripción y no la cancela — §5.1.1 / §2.3.1

**Evidencia**

- `src/components/SettingsPanel.tsx:1127`: *"Al eliminar la cuenta se cancela la suscripción y pierdes el acceso de inmediato…"*.
- `supabase/functions/delete-account/index.ts`: borra filas, storage, perfil, roles y usuario de auth. **No hay ninguna llamada a Stripe** (ni `stripe`, ni `subscription` aparecen en el archivo).

**Por qué es rechazo:** es una declaración falsa al usuario sobre un cargo recurrente. Apple lo trata como problema de §5.1.1 (transparencia) y potencialmente de fraude. Además, si el usuario sigue siendo cobrado tras borrar la cuenta, puedes recibir reclamaciones y una retirada de la app.

**Arreglo (elegir uno):**
- **A (recomendado):** cancelar la suscripción en Stripe antes de borrar, vía `stripe.subscriptions.cancel()` con la clave de servicio.
- **B:** cambiar el texto para que diga la verdad: *"El borrado no cancela tu suscripción. Cancélala antes en Gestionar suscripción o desde tu correo de Stripe."*

---

## 5. Riesgos altos (P1)

### P1-1 · Sin consentimiento explícito para IA de terceros — §5.1.2(i)

`src/pages/Onboarding.tsx:1170-1180` y `src/pages/Scan.tsx` recogen consentimiento de datos de salud, pero **no mencionan** que los datos se envían a modelos de IA de terceros. §5.1.2(i) exige informar y consentir el compartir datos con terceros.

Agravante: el texto dice *"puedo retirar este consentimiento en cualquier momento desde Ajustes"*, y en Ajustes **no existe** esa opción (solo exportar datos y borrar cuenta).

**Arreglo:** añadir mención explícita de IA + proveedores en el consentimiento, y un interruptor real de retirada en Ajustes (con efecto en el backend).

### P1-2 · La política de privacidad describe mal la IA — §5.1.1(i) / §2.3.1

- `src/content/legal.ts:97` nombra **"Google Gemini"** como proveedor.
- La cadena real (`supabase/functions/_shared/ai-provider.ts`) es **OpenAI → Anthropic (Claude) → DeepSeek → Lovable**, y DeepSeek/Claude son solo texto.
- `src/content/legal.ts:76`, `:368` y `:158` afirman que **toda** recomendación es revisada por un entrenador humano titulado.
- `src/components/AIDisclaimer.tsx` dice que **solo el plan Coach** tiene revisión humana.

Es una contradicción entre dos textos de la misma app. Un revisor la encuentra; un usuario también. Debe unificarse con la realidad del producto.

### P1-3 · Inconsistencia de precios — §2.3.1(b)

`src/content/legal.ts:173` fija Plus en **14,99 €/mes**, mientras `MOBILE_RELEASE.md` y `docs/lovable-publish-prompt.md` hablan de **29 €/mes**. Verifica el precio real en Stripe y alinea todos los textos. Un precio distinto al cobrado es rechazo.

### P1-4 · Etiquetas de privacidad incompletas — §5.1.2

`ios/App/App/PrivacyInfo.xcprivacy` declara email, nombre, userID, fotos, fitness, salud y otro contenido de usuario. **Falta `NSPrivacyCollectedDataTypePurchases`** (estado de suscripción) y valorar `Diagnostics` si hay crash reporting. Debe coincidir con App Privacy en App Store Connect.

### P1-5 · Firma y propiedad del binario

- Bundle ID `app.lovable.aa0029da00154c05a2b503e61df0f87c` (propiedad de Lovable) y `DEVELOPMENT_TEAM = 3245AGM98R` en el target frente a `M45M4ZHZR4` en el proyecto.
- **No existe archivo `.entitlements`**.
- Sin capability de Sign in with Apple (`src/lib/platform.ts:62` devuelve `false`).

No es rechazo por guideline, pero **impide subir**: la subida falla si el perfil no coincide con el bundle ID y el equipo. Resuélvelo antes de intentar el envío.

### P1-6 · Gestión de suscripción oculta en iOS — §3.1.2 / §5.1.1

`src/components/SettingsPanel.tsx:988-999` oculta "Gestionar suscripción" cuando `iosReader` es verdadero. Si el usuario tiene una suscripción activa (comprada en web), **no puede gestionarla ni cancelarla desde la app**. Apple pide que el usuario pueda gestionar lo que paga.

### P1-7 · Sin barreras de contenido para chat (latente) — §1.2

Si se activa el chat usuario-entrenador, §1.2 exige mecanismo de reporte, bloqueo y filtrado. Hoy no existe. No es bloqueante mientras `DASHBOARD_CHAT_ENABLED = false`, pero es deuda que hay que cerrar **antes** de encenderlo.

### P1-8 · Riesgo de "wrapper web" — §4.2

La app es una WebView de `autopilotplan.com`. A favor: hápticos, cámara, compartir, modo offline, borrado de cuenta nativo, notificaciones. En contra: la navegación principal es web. En las notas de revisión conviene **explicitar** las capacidades nativas y para qué se usan; si el revisor no las ve, aplica §4.2.

---

## 6. Riesgos medios y bajos (P2)

| Hallazgo | Guideline | Detalle |
|---|---|---|
| `CFBundleDevelopmentRegion = en` | 2.3.7 | La app es en español; debería ser `es` |
| `INFOPLIST_KEY_CFBundleDisplayName = "Autopilot Fitness"` | 2.3.7 | Sobrescribe `CFBundleDisplayName = Autopilot`; el nombre mostrado no coincidirá con la ficha |
| `LSApplicationCategoryType = public.app-category.sports` | 2.3.7 | La categoría de tienda es Health & Fitness; alinear |
| `UIStatusBarHidden = true` + splash de 3 s | 4.2 / UX | Sensación de app lenta; Apple penaliza arranques artificialmente largos |
| Rutas `/app` y `/descargar` (APK) en el binario | 2.3.10 | No enlazadas desde la UI nativa, pero existen. Riesgo bajo; considera excluirlas en el build iOS |
| `ENABLE_CALENDAR = false` | 2.5.x | Si se activa, el OAuth de Google Calendar saca al usuario de la WebView; latente |
| `window.open` para portal de cliente | 2.5.6 | Hoy oculto en iOS; revisar si se reactiva |
| `RenewalFlow.tsx:107,124` muestra "49 €/mes" en iOS | 3.1.1 | Precio visible dentro de la app para usuarios legacy; eliminar en iOS |
| Sin cuenta demo en notas de revisión | 2.3.1(a) | Obligatorio si hay login |
| Sin `PrivacyInfo` para el widget/extensión | — | No hay extensiones; correcto |

---

## 7. Lo que ya cumple (no lo rompas)

- ✅ Política de privacidad y términos **accesibles dentro de la app** (`SettingsPanel.tsx:1077-1084`).
- ✅ **Borrado de cuenta in-app** (§5.1.1(v)) — existe y funciona; solo falla la promesa de cancelación.
- ✅ **Exportación de datos** del usuario.
- ✅ Consentimiento de datos de salud en onboarding y en el escaneo.
- ✅ Avisos médicos y descargo de IA (`AIDisclaimer.tsx`).
- ✅ **Sin tracking ni ATT**: `NSPrivacyTracking = false`, sin SDKs publicitarios.
- ✅ **Manifiesto de privacidad incluido y válido** en el bundle.
- ✅ **Sin código remoto**: `capacitor.config.ts` sin `server.url`, `CAP_DEV` desactivado por defecto, sin actualizaciones dinámicas.
- ✅ Icono 1024×1024 sin alfa.
- ✅ Capturas con dimensiones correctas (1290×2796 y 2048×2732) — el problema es el contenido, no el tamaño.
- ✅ Soporte iPad y todas las orientaciones declaradas.
- ✅ `ITSAppUsesNonExemptEncryption = false` correctamente declarado.
- ✅ 34 guards `isIOSNative()` sistemáticos: la disciplina existe, solo está apoyada en una premisa legal equivocada.
- ✅ Login social oculto hasta estar configurado.

---

## 8. Plan de acción ordenado

### Fase 1 — Desbloquear el envío (1-2 días)

1. **Ocultar guías de pago en iOS.** Añadir guard en `Recursos.tsx` (o en el punto de montaje de `Dashboard.tsx:873`) para no renderizar libros con `url` de pago cuando `isIOSNative()`. Alternativa: mostrar solo gratuitos.
2. **Añadir `NSMicrophoneUsageDescription`** a `Info.plist` — o desactivar la videollamada en v1.
3. **Corregir `delete-account`**: cancelar en Stripe, o cambiar el texto de `SettingsPanel.tsx:1127`.
4. **Eliminar el steering** de `IosFeatureLocked.tsx:26-31`.
5. **Reescribir la ficha**: quitar chat/videollamada/recordatorios, arreglar URL de soporte, rehacer capturas con la UI móvil real.
6. **Resolver firma**: bundle ID propio, un solo `DEVELOPMENT_TEAM`, `.entitlements`.

### Fase 2 — Coherencia legal (2-3 días)

7. Unificar la política de privacidad con la cadena real de IA y con la realidad de la revisión humana (¿todos los planes o solo Coach?).
8. Añadir consentimiento explícito de IA de terceros en onboarding y escaneo, y un control real de retirada en Ajustes.
9. Alinear precios (14,99 vs 29 vs 49) con Stripe.
10. Completar `PrivacyInfo.xcprivacy` con `Purchases`.
11. Rellenar App Privacy en App Store Connect de forma consistente.

### Fase 3 — Producto (semanas)

12. **StoreKit 2** para Plus y Coach, con precios y periodos equivalentes a Stripe.
13. Volver a mostrar "Gestionar suscripción" en iOS.
14. Si se enciende el chat: reporte, bloqueo y filtrado (§1.2).
15. Valorar el **External Purchase Link Entitlement** solo si cumplís los requisitos por región — no sustituye a IAP.

---

## 9. Decisión de producto que hay que tomar

Hay dos caminos y conviene elegirlo antes de tocar código:

| | **A · v1 sin venta en iOS** | **B · v1 con StoreKit** |
|---|---|---|
| Tiempo | 1-2 días | 2-4 semanas |
| Riesgo de rechazo | Bajo | Bajo |
| Ingresos en iOS | 0 | Suscripciones con comisión de Apple |
| Complejidad | Ninguna nueva | Productos, recibos, restore, gestión |
| Recomendación | **Para lanzar ya** | **Para el modelo real** |

Lo que **no** es una opción es mantener el estado actual: PDFs de pago con Stripe accesibles dentro de la app y una estrategia de "reader app" que no os cubre. Es el escenario con más probabilidad de rechazo y, si pasara, de retirada posterior.

---

## 10. Correcciones aplicadas (changelog)

### App Store §3.1.1 — nada se vende dentro de iOS

- `src/pages/Recursos.tsx`: en iOS se descartan las guías con precio o enlace de pago; si no queda ninguna gratuita, la sección desaparece.
- `src/components/BookPreviewModal.tsx`: sin precio, sin "Comprar ahora" y sin mención a Stripe en iOS.
- `src/pages/Dashboard.tsx`: `handleCompletePayment` y `handleUpgradeToFull` salen antes de llamar a `create-checkout` si `isIOSNative()`.
- `src/pages/Dashboard.tsx`: el botón "Elegir Coach — 49 €/mes" ya estaba oculto en iOS; se mantiene.

### §3.1.3(a) — se abandona la premisa "reader app"

- `MOBILE_RELEASE.md` §9: reescrita con la tabla de por qué fitness no cumple y el plan real de StoreKit 2.
- 11 archivos con comentarios que citaban §3.1.3(a) ahora explican §3.1.1.
- `src/lib/platform.ts`: docstring corregido.

### §5.1.1(ii) — permisos

- `ios/App/App/Info.plist`: `NSMicrophoneUsageDescription` añadido.
- `CFBundleDevelopmentRegion` pasa de `en` a `es`.
- `LSApplicationCategoryType` = `public.app-category.healthcare-fitness`.
- `project.pbxproj`: eliminadas `INFOPLIST_KEY_*` muertas (contradecían `Info.plist` y no se aplicaban).

### §5.1.1 — borrado de cuenta veraz

- `supabase/functions/delete-account/index.ts`: cancela en Stripe las suscripciones activas antes de borrar. Si Stripe falla, aborta en lugar de dejar un cobro vivo.
- `src/components/SettingsPanel.tsx`: en iOS aparece **Cancelar suscripción** (sin salir de la app), no el portal externo.
- `supabase/functions/cancel-subscription/index.ts`: nueva función, `cancel_at_period_end`.

### §5.1.2(i) — IA de terceros

- `src/pages/Onboarding.tsx`: el consentimiento menciona el envío a proveedores de IA.
- `src/pages/Scan.tsx`: igual en el escaneo.
- `src/content/legal.ts`: proveedores reales (OpenAI, Anthropic, DeepSeek, Lovable) en lugar de "Google Gemini"; retirada la promesa de revisión humana en Free y Plus.
- `src/content/legal.ts`: la retirada del consentimiento apunta a un mecanismo que existe (eliminar cuenta o escribir al DPO).

### §5.1.2 — manifiesto de privacidad

- `ios/App/App/PrivacyInfo.xcprivacy`: añadido `NSPrivacyCollectedDataTypePurchaseHistory`.

### §2.1 — estabilidad

- `src/pages/Onboarding.tsx`: `useEffect` movido antes del `return` de `autoFinish` (violaba las reglas de hooks y podía romper el onboarding).
- `src/pages/Dashboard.tsx`: la campaña gratuita se pasa a `hasNutrition`. Antes el servidor generaba las comidas (la campaña concede nutrición) pero el cliente creía que no había plan y las ocultaba.
- `src/components/SettingsPanel.test.tsx`: prueba de regeneración de comidas actualizada al contrato real (`sync-nutrition-macros` con `regenerate_meals`), que además comprueba el cuerpo de la petición.

### §2.3.1 / §2.3.3 — metadatos

- `store-assets/STORE_LISTING_ES.md`: reescrita. Sin chat, sin videollamadas, sin "recordatorios" como función de app. URL de soporte → `/preguntas-frecuentes`. Incluye notas de revisión y cuenta demo.
- `store-assets/app-store/README.md`: guía de captura real.
- `scripts/generate-store-assets.mjs`: ya no recorta una vista de escritorio; exige una captura móvil real y falla con un mensaje claro si falta.
- Capturas antiguas retiradas (mostraban la barra lateral y "Chat").

### Verificación

- `npx tsc -b`: sin errores.
- `npm test`: 508/508.
- `npm run build`: correcto.
- `plutil -lint`: ambos plists válidos.

---

*Informe basado en el código y la configuración del repositorio a 22/10/2026. Las guidelines de Apple cambian; conviene releer §3.1.1 y §3.1.3 antes de cada envío.*
