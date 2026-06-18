## Objetivo

Que `/` (la landing) cargue como **HTML estático** con el mínimo JS posible, sin perder el look actual.

## Cómo lo haré

### 1. Prerender real en build (la clave)

Instalo `vite-prerender-plugin`. En build, Vite ejecuta la app en un Node headless y escribe el HTML completo de la landing (`/` y `/blog`) dentro del `dist/index.html`. Resultado:

- El usuario ve la landing **antes de que se descargue el JS**.
- Google y redes sociales leen contenido real, no un shell vacío.
- El JS se hidrata después en segundo plano (sigue siendo SPA al navegar).

### 2. Quitar framer-motion de la landing

Hoy cada bloque visible al cargar (`motion.div`, `motion.h1`, etc.) arrastra `framer-motion` (~50KB gzip). Lo sustituyo por animaciones CSS puras (`animate-fade-in` ya existente en Tailwind o keyframes nuevos). La landing queda **sin framer-motion**. El resto de la app sigue usándolo donde toque.

### 3. Lazy-load de las secciones que están bajo el fold

`PostScanFlow`, `PremiumTransformation`, `ComparisonTable`, `PricingTiers`, `TrainersSection`, `AIScanSection`, FAQ y footer pasan a `React.lazy` + `Suspense`. El hero y el trust strip cargan en el bundle inicial; el resto se descarga al hacer scroll (o tras `requestIdleCallback`).

### 4. Datos dinámicos sin bloquear

La llamada a `supabase` (testimonios, settings, stats) se mantiene pero:

- Los **fallbacks ya pintados en el HTML prerenderizado** (testimonios por defecto, nombre del entrenador "Nicolás") se ven al instante.
- La petición se dispara con un pequeño delay (`requestIdleCallback`) para no competir con el render.

### 5. Imágenes y assets

- `loading="lazy"` y `decoding="async"` en todas las imágenes salvo la del hero (eager).
- Preload del logo/imagen LCP en `index.html`.

## Qué NO toco

- El resto de páginas (dashboard, admin, onboarding, etc.) siguen igual.
- Los componentes shadcn y el design system no cambian.
- El comportamiento dinámico de la landing (CTAs, navegación, datos del admin) sigue funcionando — solo cambia *cuándo* se ejecuta JS.

## Resultado esperado

- **First Contentful Paint** de la landing: ~instantáneo (HTML ya tiene el contenido).
- **JS inicial de `/`**: de ~250KB a ~70-90KB (sin framer-motion, sin las secciones lazy).
- Lighthouse Performance > 90 en móvil.

## Archivos a tocar

- `package.json` — add `vite-prerender-plugin`
- `vite.config.ts` — registrar plugin con rutas `["/", "/blog"]`
- `src/main.tsx` — usar `hydrateRoot` en lugar de `createRoot` cuando el HTML viene prerenderizado
- `src/pages/Index.tsx` — quitar `motion.*`, `React.lazy` para secciones bajo el fold, datos en `requestIdleCallback`
- `src/index.css` o `tailwind.config.ts` — añadir keyframes `fade-in-up` si no existen
- `index.html` — preload del LCP

## Riesgo / limitación honesta

- El prerender se ejecuta en build. Si una sección hace algo dependiente de `window` sin guardas, hay que envolverlo en `typeof window !== 'undefined'`. Lo reviso al implementar.
- Lovable Cloud no requiere config extra: el `dist/index.html` final ya queda listo para hosting estático.

¿Le doy?