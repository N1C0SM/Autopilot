# Autenticación, privacidad y publicación

## Autenticación que debe probarse en dispositivos reales

- Inicio de sesión con correo y contraseña.
- Registro y confirmación del correo.
- Recuperación y cambio de contraseña.
- Cierre de sesión y persistencia de la sesión al volver a abrir la app.
- “Continuar con Apple” en iPhone/iPad.
- Retornos desde el navegador a la app después de autenticar.

El proyecto todavía usa el identificador `app.lovable.aa0029da00154c05a2b503e61df0f87c`. Confírmalo antes de crear las fichas de las tiendas. Si se cambia, también deben actualizarse Xcode, Gradle y las URL/esquemas permitidos en Lovable/Supabase.

## App Store Connect — privacidad probable

Esta lista debe confirmarse contra la configuración real de Supabase, analítica, pagos y proveedores antes de enviarla:

- Datos de contacto: correo electrónico y, si se solicita, nombre.
- Salud y fitness: objetivos, peso, entrenamiento, nutrición y progreso.
- Contenido del usuario: fotos de progreso, mensajes y archivos compartidos.
- Identificadores: identificador de usuario/cuenta.
- Compras: estado de suscripción o plan contratado.
- Diagnósticos/uso: solo si la analítica desplegada realmente los recopila.

Usos previsibles: funcionalidad de la app, personalización, soporte, gestión de cuenta y analítica. No marcar “seguimiento” publicitario salvo que exista realmente publicidad o combinación de datos entre empresas.

## Google Play — formulario de seguridad de datos

- Declarar transmisión cifrada si todas las conexiones productivas usan HTTPS.
- Declarar si el usuario puede solicitar eliminación de cuenta y datos.
- Indicar qué datos son obligatorios y cuáles opcionales.
- Declarar fotos, información de salud/fitness, mensajes, identificadores y compras según el comportamiento real.
- Añadir una URL pública de eliminación de cuenta si Google la solicita.

## Revisión de las tiendas

- Facilitar una cuenta de demostración si la mayor parte de la app requiere acceso.
- Explicar en las notas que Autopilot ofrece planificación fitness y contacto con entrenador.
- Adjuntar instrucciones para llegar a entrenamiento, nutrición, progreso y chat.
- Probar que la compra/suscripción cumple las reglas de cada tienda. Apple puede exigir compra dentro de la app si se venden servicios o contenido digital consumidos en iOS.
- Verificar que la política de privacidad publicada coincide con la recogida real de datos.

## Pendiente del propietario de la cuenta

- Crear/activar Apple Developer y Google Play Console.
- Elegir el identificador definitivo de la app.
- Configurar firma, certificados y perfiles.
- Configurar retornos de autenticación y Sign in with Apple.
- Crear cuenta de revisión sin datos personales reales.
- Completar los cuestionarios oficiales con información verificada.
