# Autopilot

**Entrenamiento, nutrición e inteligencia artificial en una aplicación web y multiplataforma.**

Proyecto de Nicolás San Marcos que conecta el desarrollo de software con el deporte. Incluye una interfaz para usuarios, herramientas para entrenadores y funciones de backend para análisis y generación de planes.

[Visitar la web](https://autopilotplan.com) · [Guía móvil](MOBILE_RELEASE.md) · [Hoja de ruta](roadmap.md)

## Qué incluye

- Registro, autenticación y configuración de cuenta.
- Incorporación del usuario, análisis de fotos y generación de planes con IA.
- Panel de seguimiento y herramientas para entrenadores y administración.
- Planificación y conexión con Google Calendar.
- Integración de pagos y suscripciones con Stripe.
- Recursos, contenido y comunicaciones por correo.

Los flujos conectados requieren configurar Supabase y los proveedores correspondientes.

## Tecnologías

| Capa | Stack |
| --- | --- |
| Frontend | React, TypeScript, Vite |
| Interfaz | Tailwind CSS, shadcn/ui, Radix UI |
| Datos y autenticación | Supabase, TanStack Query |
| Backend | Supabase Edge Functions y migraciones SQL |
| Móvil | Capacitor, iOS y Android |
| Comprobaciones | ESLint, Vitest, Testing Library |

Lovable forma parte del flujo de desarrollo del proyecto.

## Empezar en local

Necesitas Node.js y npm compatibles con las dependencias del proyecto, y acceso a un entorno Supabase de desarrollo.

```bash
git clone https://github.com/N1C0SM/Autopilot.git
cd Autopilot
npm install
```

Configura un archivo `.env.local` con los valores de tu proyecto:

```dotenv
VITE_SUPABASE_URL=https://TU_PROYECTO.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=TU_CLAVE_PUBLICABLE
```

Las variables `VITE_*` se incluyen en el cliente. Mantén las claves privadas de los proveedores y la clave `service_role` en el backend.

```bash
npm run dev
```

Abre la URL que muestre Vite. Para ejecutar los flujos completos también debes configurar el esquema de `supabase/migrations/`, las funciones de `supabase/functions/`, sus secretos y los proveedores de autenticación.

## Comandos

| Comando | Propósito |
| --- | --- |
| `npm run dev` | Desarrollo local |
| `npm run build` | Compilar la web en `dist/` |
| `npm run preview` | Previsualizar la compilación |
| `npm run lint` | Análisis estático |
| `npm test` | Ejecutar las pruebas |
| `npm run ios:sync` | Compilar y sincronizar el bundle local con iOS |
| `npm run ios:open` | Abrir el proyecto iOS |
| `CAP_DEV=0 npm run mobile:sync` | Compilar y sincronizar los proyectos móviles |

## Organización

```text
src/pages/                Pantallas de la aplicación
src/components/           Componentes de interfaz
src/hooks/                Lógica reutilizable
src/integrations/         Cliente y tipos de Supabase
src/test/                 Pruebas y configuración
supabase/functions/       Funciones de backend e integraciones
supabase/migrations/      Esquema de datos
ios/                      Proyecto iOS
android/                  Proyecto Android
resources/                Iconos y splash
store-assets/             Materiales de publicación
```

## Aplicaciones móviles

Los proyectos iOS y Android ya están incluidos; no hace falta ejecutar `cap init` ni `cap add`. Se necesita el entorno nativo correspondiente.

Con `CAP_DEV=0`, Capacitor utiliza el bundle local de `dist/`. El modo `CAP_DEV=1` apunta al entorno remoto de desarrollo.

Consulta la [guía móvil](MOBILE_RELEASE.md) y los [materiales de publicación](store-assets/README.md). Tener los proyectos nativos no implica que la aplicación esté publicada en tiendas: firma, configuración externa y pruebas en dispositivos son pasos independientes.

## Incidencias y colaboración

Incluye pasos para reproducir el problema, resultado esperado y entorno utilizado. No publiques credenciales ni datos personales de usuarios.
