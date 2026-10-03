# Panel de admin de usuario: navegación limpia

## Problema
La ficha de usuario en Admin tiene 6 pestañas con icono + texto (Cliente, Plan y acceso, Progreso, Entreno, Nutrición, Chat) que ocupan todo el ancho y se ven apretadas, y dentro de Entreno hay otra fila de sub-pestañas (Plan / Calendario). Es un lío visual.

## Solución

### Navegación principal
- Las 6 pestañas pasan a un control segmentado compacto y limpio: icono + etiqueta corta, espaciado uniforme, sin que cada una luche por el ancho.
- En pantallas estrechas: solo iconos con etiqueta debajo en miniatura (o scroll horizontal elegante), sin deformarse.
- La pestaña activa se marca con fondo dorado suave, el resto en gris silencioso.

### Entreno sin sub-pestañas
- Se elimina la segunda fila de pestañas dentro de Entreno: Plan y Calendario se muestran en una sola vista (calendario arriba compacto, plan debajo) o con un selector pequeño integrado en la cabecera de la sección, no otra barra.

### Cabecera de usuario
- Se compacta: avatar, nombre, plan y botones de acción (Auto-generar, Guardar, Ver como, borrar) en una sola fila que se adapta; en pantallas pequeñas las acciones pasan a un menú de tres puntos.

## Resultado
Una sola barra de navegación clara, sin barras anidadas, con aire y jerarquía. El admin encuentra todo de un vistazo.

## Verificación
- Typecheck limpio y revisión visual a varios anchos (móvil y escritorio).
