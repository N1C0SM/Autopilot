Haré estos cambios:

1. Usuarios eliminados fuera de “Recientes”
- En el panel general, la lista de “Usuarios recientes” seguirá saliendo solo de `profiles`, pero además refrescaré la lista tras borrar y evitaré que cualquier registro ya eliminado pueda quedarse seleccionado o visible.
- En métricas, los datos de scans/leads/email no se usarán como “usuarios recientes” sin comprobar que sigan existiendo en `profiles`.

2. Ocultar el administrador actual en Usuarios
- En `Admin.tsx`, filtraré el usuario logueado (`user.id`) de la lista que se pasa a `UserList`, `AdminStats`, acciones rápidas, recientes y gestión de entrenadores.
- Así, si entra un admin, no se verá a sí mismo; sí verá al otro administrador.

3. Vista de entrenador editable desde Usuarios
- En `UserDetail.tsx`, cuando el perfil sea entrenador, la pestaña “Info” pasará de solo lectura a formulario editable.
- Permitirá editar: foto, nombre público, especialidad, titular, descripción/bio, visibilidad en landing y orden.
- La foto se subirá a `site-assets` como ya se hace en la gestión de entrenadores, sin usar URL manual.
- Mantendré en esa vista solo: info del entrenador, usuarios asignados y chat con admin.

4. Consistencia visual y guardado
- Reutilizaré el patrón actual de `TrainerManagement` para que ambas zonas guarden en `trainer_profiles` igual.
- Añadiré estados de carga/guardado y mensajes claros en español.

No tocaré la estructura de base de datos porque ya existen `trainer_profiles`, `trainer_assignments` y el bucket público necesario.