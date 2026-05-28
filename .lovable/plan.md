## Cambios solicitados

### 1. Usuarios borrados no reaparecen en "Recientes"
En `AdminMetrics.tsx` (y donde se calcule la lista de "usuarios recientes"), filtrar la query para excluir los `user_id` que ya no existen en `profiles`. Hoy probablemente se leen de `scan_leads` / `leads` / `email_send_log` y por eso siguen apareciendo aunque borres la cuenta. Solución: hacer un `JOIN`/filtro contra `profiles` por email o user_id, o bien borrar también esas filas en `admin-delete-user` (añadir `scan_leads`, `leads`, `email_send_log`, `scan_history`, `payment_reminders` al cascade por email/user_id).

### 2. Vista del entrenador al hacer click (desde admin)
Cuando el admin clicka en un entrenador en la lista de usuarios:
- Detectar que ese perfil tiene rol `trainer` → mostrar una vista distinta (`TrainerDetail`) en vez de `UserDetail` normal.
- Esa vista mostrará solo:
  - Info del entrenador (nombre, email, foto, headline, bio, especialidad de `trainer_profiles`).
  - Lista de usuarios asignados (de `trainer_assignments`).
  - Chat con el admin (componente `Chat` con `conversationUserId = trainer.user_id`).
- Se ocultan: objetivo, progreso, entreno, calendario, nutrición, etc.

### 3. Vista al entrar en otro administrador
Igual que el caso anterior pero para rol `admin`: solo mostrar chat con ese admin, ocultar todo lo demás (plan, nutrición, calendario, objetivo, progreso).

En `UserDetail.tsx` añadir un branch al inicio: si el perfil objetivo tiene rol admin o trainer, renderizar versión reducida en lugar de los tabs completos.

### 4. Landing: ocultar contador cuando es bajo
En `Index.tsx` / componente de "social proof" que usa `get_public_stats`: si `paid_count < N` (umbral configurable, p.ej. 20), no mostrar el número. Mostrar texto neutro tipo "Comunidad creciendo" o simplemente ocultar el badge. Cuando supere el umbral, mostrar la cifra real.

### 5. Sección Entrenadores en landing como carrusel
Rediseñar `TrainersSection.tsx`:
- Reemplazar el grid de 3 columnas por un carrusel horizontal (usar `embla-carousel-react` que ya viene con shadcn `components/ui/carousel.tsx`).
- Tarjetas más grandes y cinematográficas: foto grande arriba, glow animado, nombre + verified badge, especialidad como chip, headline en grande, bio debajo, hover con parallax sutil.
- Auto-scroll suave + dots/arrows de navegación.
- Mantener estética premium con framer-motion.

---

### Archivos a tocar
- `supabase/functions/admin-delete-user/index.ts` — añadir borrado de `scan_leads`, `leads`, `email_send_log`, `scan_history`, `payment_reminders` por email/user_id.
- `src/components/admin/AdminMetrics.tsx` — filtrar "recientes" contra `profiles`.
- `src/components/admin/UserDetail.tsx` — branch para admin/trainer con vista reducida (info + asignados si trainer + chat).
- `src/components/Index.tsx` (sección stats) — ocultar número bajo umbral.
- `src/components/TrainersSection.tsx` — rediseño con carrusel.

¿Confirmas el umbral para el contador de la landing (sugiero ocultar si <20 pagados)?
