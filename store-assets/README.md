# Material de publicación

- `shared/icon-1024.png`: icono fuente de App Store.
- `google-play/icon-512.png`: icono de alta resolución para Google Play.
- `google-play/feature-graphic-1024x500.png`: feature graphic.
- `google-play/phone-*.png`: imágenes promocionales de teléfono Android (1080×1920).
- `app-store/iphone-6.7/*.png`: imágenes para iPhone 6.7" (1290×2796).
- `app-store/ipad-12.9/*.png`: imágenes para iPad 12.9" (2048×2732).
- `STORE_LISTING_ES.md`: textos de la ficha en español.
- `AUTH_AND_PRIVACY_CHECKLIST.md`: autenticación, privacidad y pasos humanos pendientes.
- `app-store/README.md`: cómo capturar las pantallas reales de la app.

## Estado de las capturas

Las capturas se generaban recortando una vista de **escritorio** (1280×720), lo
que mostraba la barra lateral, la opción "Chat" y texto cortado. Incumple
§2.3.3 y se han retirado.

El generador ahora exige una **captura móvil real** en
`source/mobile-dashboard.png` y falla con un mensaje claro si no existe:

```bash
node scripts/generate-store-assets.mjs
```

Instrucciones completas en `app-store/README.md`.

Para regenerar el icono y el feature graphic no hace falta esa captura.
