# Capturas reales de la app para la web pública

Estas imágenes las pinta la landing (hero, PhoneStory y DeviceShowcase). Si un fichero no
existe, la web cae automáticamente al mock HTML antiguo, así que se pueden añadir sin tocar código.

Generarlas con el iPhone conectado por USB y desbloqueado:

```
./scripts/capture-app-shots.sh
```

Ficheros esperados:

| Fichero | Pantalla |
|---|---|
| `hoy.jpg` | Hoy (Inicio) |
| `entrenar.jpg` | Entrenar (rutina semanal + sesión) |
| `nutricion.jpg` | Nutrición |
| `progreso.jpg` | Progreso |
| `mac-hoy.jpg` | App de Mac (ventana Hoy), para el portátil de DeviceShowcase |
