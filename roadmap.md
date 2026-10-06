# Roadmap

- [x] Convertir el análisis final del entrenamiento en fichas horizontales compactas.
- [x] Mostrar una revelación visual de rutina y macros al terminar el cuestionario antes del registro.

- [x] Eliminar Transformación de la comparativa superior y conservarla solo en su bloque premium.
- [x] Hacer editable desde administración el número de plazas mensuales de Transformación.
- [x] Conectar esa cifra real con la landing y su mensaje de disponibilidad.
- [x] Revisar y corregir incoherencias principales del embudo hasta el pago.
- [x] Verificar landing y recorridos clave en escritorio y móvil.
- [x] Clarificar toda la landing: el entrenador real prepara y ajusta el plan; la IA solo apoya el análisis inicial.
- [x] Simplificar y reorganizar toda la landing con una composición modular orientada a compra y uso real.
- [x] Auditar y convertir el entrenamiento del cliente en un tracker de gimnasio realmente utilizable, revisando también entrenador y administración.
- [x] Mejorar conversión integral de landing, escáner, planes y recursos sin claims inventados
      Landing, escáner, recursos y legal alineados con los entitlements reales (Plus 29€ = IA + adaptación + nutrición, sin entrenador; Coach 49€ = entrenador real). Eliminados: badges de App Store/Play que apuntaban a Apple Fitness y Google Fit por defecto, comparativa inventada «Coach 1:1 desde 200€/mes», «diagnóstico clínico», bloque presentado como «tu genética», predicciones con cifras fijas, confianza 75%/55% inventada, insights hardcodeados presentados como del usuario, precios de guías y de pareja que no existen en el checkout, y los fallbacks de Recursos con dosis de suplementos. Unificado el mensaje de tarjeta (7 días de prueba, no se cobra hasta el día 8) y el plan elegido en la web ahora se preselecciona en el dashboard. CTAs del escáner propagan el plan recomendado.
- [x] Ficha de ejercicio al tocar: técnica con foto grande y vídeo; foto en cada fila de ejercicio
- [x] Biblioteca: ya existe con 271 ejercicios, 100% editable en admin
- [x] Vídeo de técnica con IA (botón en el editor, función exercise-video)
- [x] (anterior) Ficha de ejercicio al tocar: técnica con foto grande y vídeo; foto en cada fila de ejercicio
- [x] Foto y vídeo con IA coherentes (mismo estilo), vídeo como hero y miniatura junto al nombre; nada de YouTube en usuario
- [x] Nunca mostrar pantalla de error al usuario: fallos silenciosos y recuperación automática

- [x] Revisar fallo al abrir el usuario propio (N1C0) desde /admin: faltaba su onboarding; ahora se le pide al entrar
- [x] Lecturas blindadas (dashboard, ajustes, admin, rutas protegidas): si faltan datos, no se rompe nada
- [x] Nutrición vacía: mensaje «en preparación» en vez de pantalla vacía
- [x] Sin avisos rojos falsos por cortes momentáneos de conexión en tiempo real
- [x] Foto con IA verificada (funciona con cuenta admin) + miniatura junto al nombre en la lista admin
- [x] No repetir el vídeo debajo si ya está en el hero; al pasar el ratón sobre la portada, reproducir el vídeo
- [x] Claves de IA (OpenAI, Claude…) editables desde ajustes de admin; exercise-video las usa con prioridad
- [x] Cerrar aviso de seguridad de certificados: enlace firmado vía función certificate-link y quitar regla pública

## Barra de pestañas admin (en curso)
- [x] Pestañas de la ficha de usuario repartidas por igual (flex-1) en cualquier ancho.
- [x] Admin con mínimo scroll: roles/onboarding en sección aparte. (Roles y entrenador responsable en su propia pestaña «Acceso», separados de los datos del perfil.)
- [x] Progreso: último entreno fuera del flujo, en ventana emergente. (Fila compacta «Último entreno» con diálogo de detalle y revisión del entrenador; el resto de secciones ya no arrastra el último entreno.)
- [x] Revisar fotos de progreso/compartir.
      Fotos de progreso: renovación automática de URLs firmadas antes de caducar (y al volver el foco), borrado del objeto en el bucket antes que la fila (con reintento), rutas en lugar de URLs públicas inservibles en bucket privado, subida por lotes tolerante a ficheros inválidos, visor accesible (diálogo, Escape, flechas, aria-label) y orden determinista. Escáner: las fotos y el «antes vs. ahora» firmadas correctamente y reset que borra también los ficheros. Compartir: fallback a descarga cuando el menú nativo falla, y enlaces de invitación con base pública en móvil nativo.
