# Capturas para App Store

## Por qué se retiraron las anteriores

Las capturas antiguas se generaban recortando `src/assets/dashboard-preview.png`,
que es una **vista de escritorio en 1280×720**. El resultado mostraba la barra
lateral de escritorio, la opción **"Chat"** (que no existe en el binario) y texto
cortado por el borde.

Eso incumple **§2.3.3** (las capturas deben mostrar la app tal como es) y
**§2.3.1** (no anunciar funciones que no existen). Se han eliminado para no
enviarlas por error.

## Cómo generarlas (una sola vez, con la app real)

1. Abre la app en un iPhone físico o en el simulador:

   ```bash
   npm run ios:sync
   npm run ios:open
   ```

2. Inicia sesión con la **cuenta de prueba** y carga datos de ejemplo
   (plan generado, algún entreno registrado, un par de fotos de progreso).

3. Captura estas tres pantallas **en vertical**, sin barra lateral:

   | Archivo | Pantalla |
   |---|---|
   | `01.png` | Dashboard: plan de la semana |
   | `02.png` | Entreno activo con series registradas |
   | `03.png` | Progreso: peso y evolución |

   En el simulador: `Dispositivo → Capturar pantalla` (⌘S).

4. Guarda la captura principal en `store-assets/source/mobile-dashboard.png`
   y genera el resto:

   ```bash
   node scripts/generate-store-assets.mjs
   ```

   El script monta la captura real dentro del marco, sin recortarla, y produce
   los tres tamaños (iPhone 6.7", iPad 12.9" y Google Play).

## Reglas que deben cumplir

- Mostrar **solo** pantallas que existen en el binario enviado.
- **No** mostrar "Chat", videollamadas ni precios de suscripción: no están en
  esta versión.
- No añadir texto superpuesto que prometa funciones ausentes.
- Sin datos personales reales: usa la cuenta de prueba.
