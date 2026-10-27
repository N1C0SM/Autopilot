# Autopilot

Aplicación de entrenamiento y nutrición con IA.

## Estructura del Proyecto

```
Autopilot/
│
├── 📱 native/              # App nativa SwiftUI (iPhone + Mac)
│   ├── Autopilot/
│   │   └── Features/
│   │       └── Train/      # Módulo de entrenamiento
│   ├── Autopilot.xcodeproj/
│   └── build/
│
├── 🌐 src/                 # Código fuente web
│   └── shared/
│       └── lib/            # Librerías compartidas
│
├── 🤖 android/             # App Android (Capacitor)
│   └── app/
│
├── 🍎 ios/                 # App iOS legacy (Capacitor)
│   └── App/
│
├── 💻 macos/               # App macOS legacy (Capacitor)
│   └── AutopilotMac.xcodeproj/
│
├── 🗄️ supabase/            # Backend (edge functions, SQL)
│   └── .temp/
│
├── 📦 dist/                # Build web estático
│   ├── assets/
│   ├── blog/
│   ├── planes/
│   ├── scan/
│   └── ...
│
├── 🤖 .claude/             # Agentes y configuración IA
│
└── 📝 .gitignore
```

## Stack Tecnológico

- **Frontend Web**: React + TypeScript + Vite
- **Frontend Nativo**: SwiftUI (iPhone + Mac)
- **Android**: Capacitor
- **Backend**: Supabase (PostgreSQL + Edge Functions)
- **IA**: OpenAI + Claude + DeepSeek

## Notas

- Las apps nativas (iPhone/Mac) son **SwiftUI puro** en `native/`
- Las carpetas `ios/` y `macos/` son versiones legacy con Capacitor (ya no se envían)
- Android sigue usando Capacitor
- Todo comparte las mismas tablas de Supabase y lógica de negocio

