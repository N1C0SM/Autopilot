# Plan: Revelación del plan y fichas de fin de entreno

## Cambios
- Sustituir el análisis largo del entrenamiento por un carrusel horizontal de tres fichas compactas: foco muscular, progreso y próximo paso.
- Mantener el mapa muscular, pero reducido dentro de su ficha; limitar textos para evitar desplazamiento vertical dentro del resumen.
- Convertir el último paso del cuestionario en una revelación visual del plan antes del registro, mostrando rutina de ejemplo y macros personalizados cuando haya peso.
- Conservar consentimientos, opciones de calendario/foto y el flujo actual de registro y generación del plan.
- Validar la compilación y revisar ambas pantallas en móvil.

## Detalles técnicos
- Crear un componente reutilizable para las fichas del entrenamiento con desplazamiento táctil, ajuste por tarjeta e indicadores de posición.
- Reutilizar el cálculo existente de nutrición y adaptar la vista previa para no prometer resultados ni datos que no se hayan calculado.
- No cambiar precios, permisos, almacenamiento ni lógica del plan generado.
