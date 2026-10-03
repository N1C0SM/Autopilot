# Panel de admin de usuario: navegación limpia

## Problema
La ficha de usuario en Admin está saturada: 6 pestañas con icono + texto que ocupan todo el ancho, sub-pestañas dentro de Entreno, y etiquetas redundantes en la cabecera («Coach · 49€/mes», «Plan listo») que roban espacio sin aportar nada que no se vea ya en la pestaña Plan y acceso.

## Solución

### Cabecera compacta
- Se eliminan las etiquetas «Coach · 49€/mes» y «Plan listo» bajo el nombre. El plan se gestiona y se ve en la pestaña Plan y acceso.
- Avatar, nombre y acciones (Auto-generar, Guardar, Ver como, borrar) en una fila que se adapta; en pantallas estrechas las acciones secundarias van a un menú de tres puntos.

### Navegación principal
- Las 6 pestañas (Cliente, Plan y acceso, Progreso, Entreno, Nutrición, Chat) pasan a un control segmentado compacto: espaciado uniforme, pestaña activa con fondo dorado suave, resto en gris silencioso.
- En pantallas estrechas: iconos con etiqueta en miniatura o scroll horizontal elegante, sin deformarse.

### Entreno sin sub-pestañas
- Fuera la segunda fila de pestañas (Plan / Calendario): una sola vista con calendario compacto arriba y plan debajo, o un selector pequeño integrado en la cabecera de sección.

## Resultado
Una cabecera limpia sin etiquetas redundantes, una sola barra de navegación clara, sin barras anidadas. Todo se encuentra de un vistazo.

## Verificación
- Typecheck limpio y revisión visual a varios anchos (móvil y escritorio).
