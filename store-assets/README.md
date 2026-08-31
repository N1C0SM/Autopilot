# Material de publicación

- `shared/icon-1024.png`: icono fuente de App Store.
- `google-play/icon-512.png`: icono de alta resolución para Google Play.
- `google-play/feature-graphic-1024x500.png`: feature graphic.
- `google-play/phone-*.png`: imágenes promocionales de teléfono Android (1080×1920).
- `app-store/iphone-6.7/*.png`: imágenes para iPhone 6.7" (1290×2796).
- `app-store/ipad-12.9/*.png`: imágenes para iPad 12.9" (2048×2732).
- `STORE_LISTING_ES.md`: textos de la ficha en español.
- `AUTH_AND_PRIVACY_CHECKLIST.md`: autenticación, privacidad y pasos humanos pendientes.

Las imágenes promocionales usan una vista real incluida en el proyecto, adaptada a formatos de tienda. Antes del envío definitivo conviene reemplazar o complementar estas imágenes con capturas obtenidas en dispositivos autenticados para mostrar entrenamiento, nutrición, progreso y chat con datos de demostración.

Para regenerar las imágenes después de cambiar la interfaz:

```bash
node scripts/generate-store-assets.mjs
```
