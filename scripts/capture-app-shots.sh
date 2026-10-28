#!/usr/bin/env bash
# Captura las pantallas REALES de la app (iPhone conectado por USB) para la web pública.
# Uso: ./scripts/capture-app-shots.sh
# Requiere: xcrun devicectl (Xcode), iPhone desbloqueado y con la app instalada.
set -euo pipefail
DEV="${DEV:-00008140-001A083E36DB801C}"
BID="app.lovable.aa0029da00154c05a2b503e61df0f87c"
OUT="$(cd "$(dirname "$0")/.." && pwd)/public/app-shots"
mkdir -p "$OUT"

shot() { # shot <fichero> <seccion>
  local name="$1" section="$2"
  xcrun devicectl device process launch --device "$DEV" --terminate-existing "$BID" \
    -- -skipPicker -section="$section" >/dev/null
  sleep 6
  local tmp; tmp="$(mktemp -t app-shot).png"
  xcrun devicectl device capture screenshot --device "$DEV" --destination "$tmp" >/dev/null
  sips -s format jpeg -s formatOptions 85 "$tmp" --out "$OUT/$name.jpg" >/dev/null
  rm -f "$tmp"
  echo "✓ $name.jpg"
}

shot hoy home
shot entrenar train
shot nutricion nutrition
shot progreso progress
echo "Listo: $OUT"
