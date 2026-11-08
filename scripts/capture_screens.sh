#!/bin/bash
# Captura todas las pantallas del simulador de iPhone.
# Uso: ./scripts/capture_screens.sh
# Ve navegando en el simulador y pulsa ENTER aquí para capturar cada pantalla.

OUT="$HOME/Desktop/autopilot-screens"
mkdir -p "$OUT"

SCREENS=(
  "01-hoy"
  "02-entrenar"
  "03-entrenar-sesion-expandida"
  "04-workout-activo"
  "05-workout-serie-marcada-rest-timer"
  "06-workout-resumen-final"
  "07-progreso-fuerza"
  "08-progreso-records"
  "09-progreso-fotos"
  "10-nutricion"
  "11-ajustes"
  "12-biblioteca-ejercicios"
  "13-ficha-ejercicio"
  "14-plan-editor"
)

echo ""
echo "📱 Capturas Autopilot → $OUT"
echo "────────────────────────────────────"
echo "Navega en el simulador a cada pantalla"
echo "y pulsa ENTER para capturar."
echo ""

for NAME in "${SCREENS[@]}"; do
  read -r -p "→ Navega a «$NAME» y pulsa ENTER... "
  FILE="$OUT/${NAME}.png"
  xcrun simctl io booted screenshot "$FILE" 2>/dev/null
  echo "  ✓ Guardado: ${NAME}.png"
  echo ""
done

echo "────────────────────────────────────"
echo "✅ ${#SCREENS[@]} capturas en $OUT"
open "$OUT"
