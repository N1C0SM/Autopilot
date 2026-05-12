# Plan: Rol de Entrenadores

Añadir un rol `trainer` para que entrenadores puedan gestionar usuarios asignados, con sección pública en la landing y chat con el admin.

## 1. Base de datos

**Nuevo valor en enum `app_role`:** añadir `'trainer'`.

**Nueva tabla `trainer_assignments`:**
- `trainer_id uuid` (entrenador)
- `user_id uuid` (cliente asignado)
- `assigned_at`, `assigned_by`
- Unique (trainer_id, user_id), un user solo puede tener 1 trainer activo (unique parcial sobre user_id).

**Nueva tabla `trainer_profiles`** (perfil público para la landing):
- `user_id uuid` (FK al auth user que es trainer)
- `display_name`, `headline`, `bio`, `photo_url`, `specialty`, `sort_order`, `visible`

**Nueva función SQL `is_trainer_of(_trainer uuid, _user uuid)`** SECURITY DEFINER → bool.

**RLS — actualizar políticas existentes** para permitir que un trainer vea/edite los datos de SUS usuarios asignados en:
`profiles`, `onboarding`, `training_plan`, `nutrition_plan`, `workout_logs`, `day_completions`, `weight_logs`, `personal_records`, `progress_photos`, `external_activities`, `user_schedule`, `training_schedule_overrides`, `notifications`, `chat_messages`.

Patrón: añadir policy `Trainers can view/manage assigned users data` con `is_trainer_of(auth.uid(), user_id)`.

**Chat admin↔trainer:** ampliar `chat_messages.conversation_user_id` para representar también conversaciones admin↔trainer (el `conversation_user_id` será el user_id del trainer cuando hable con admin). RLS ya cubre admin; añadir policy para que el trainer vea su propia conversación con admin.

## 2. Edge functions

- `admin-delete-user`: sin cambios mayores, sigue siendo solo admin.
- Nuevo endpoint **no necesario** — gestión de roles trainer y asignaciones via tabla con RLS de admin.

## 3. Frontend — Admin Dashboard

**`AdminSidebar`:** añadir item "Entrenadores".

**`Admin.tsx`:** nueva sección `trainers`:
- Lista de entrenadores con email, nº usuarios asignados, perfil público completado o no.
- Botón "Promover a entrenador" desde detalle de usuario → inserta rol trainer.
- Detalle de entrenador: editar perfil público, lista de usuarios asignados, asignar/desasignar usuarios, abrir chat con el entrenador.

**`UserList`:** mostrar trainer asignado en cada card, separar visualmente:
- Sección "Usuarios" (clientes finales)
- Sección "Entrenadores"
- Sección "Administradores"

**`UserDetail`:** selector "Asignar entrenador" + badge mostrando trainer actual.

**Nuevo `AdminChatWithTrainers`** (similar a Chat existente) en sección entrenadores.

## 4. Frontend — Trainer Dashboard

Nueva ruta `/trainer` protegida (solo rol trainer):
- Lista de usuarios asignados (mismo card style que admin).
- Al seleccionar un usuario: reutilizar `UserDetail` (o versión recortada sin acciones destructivas: sin borrar cuenta, sin tocar pagos, sin dar rol).
- Tab "Chat con admin".

**Routing:** redirigir tras login según rol → admin → `/admin`, trainer → `/trainer`, user → `/dashboard`.

## 5. Landing — Sección Entrenadores

Nuevo componente `<TrainersSection />` en `pages/Index.tsx`:
- Grid de tarjetas con foto, nombre, especialidad, bio corta.
- Lee de `trainer_profiles` donde `visible = true` ordenado por `sort_order`.
- Estética minimalista premium acorde al resto de la landing.

**Editor en admin "Landing"** (`SiteContentEditor`): añadir tab para gestionar visibilidad/orden de los perfiles públicos.

## Detalles técnicos

- Todas las nuevas RLS usan `is_trainer_of()` security-definer para evitar recursión.
- Idempotente: upsert por `(trainer_id, user_id)`.
- `chat_messages` admin↔trainer: cuando admin escribe a trainer, `conversation_user_id = trainer.user_id`, `sender_id = admin.user_id`. El trainer accede via nueva policy: `auth.uid() = conversation_user_id AND has_role(auth.uid(), 'trainer')`.
- Migración no destructiva, no toca datos existentes.
- UI 100% en español, estilo existente.

## Orden de implementación

1. Migración (enum + tablas + función + policies).
2. Routing + ProtectedRoute para rol trainer.
3. Admin: sección Entrenadores + asignaciones + promover.
4. Trainer Dashboard.
5. Landing: TrainersSection + editor admin.
6. Chat admin↔trainer.
