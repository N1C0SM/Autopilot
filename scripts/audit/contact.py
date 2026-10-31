#!/usr/bin/env python3
"""Hoja de contactos de las capturas: una rejilla con el nombre de cada pantalla."""
import sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

root = Path(sys.argv[1] if len(sys.argv) > 1 else "audit/antes")
out = Path(sys.argv[2] if len(sys.argv) > 2 else "audit/contacto")
out.mkdir(parents=True, exist_ok=True)

COLS, TW, TH, PAD, LABEL = 6, 300, 380, 16, 26
font = ImageFont.load_default(size=18)

for viewport in sorted(p for p in root.iterdir() if p.is_dir()):
    files = sorted(viewport.rglob("*.jpg"))
    if not files:
        continue
    rows = (len(files) + COLS - 1) // COLS
    sheet = Image.new("RGB", (COLS * (TW + PAD) + PAD, rows * (TH + LABEL + PAD) + PAD), (8, 8, 8))
    draw = ImageDraw.Draw(sheet)
    for i, file in enumerate(files):
        img = Image.open(file).convert("RGB")
        # Recorte superior: se ve la cabecera real de cada pantalla.
        ratio = TW / img.width
        img = img.resize((TW, max(1, int(img.height * ratio))), Image.LANCZOS)
        img = img.crop((0, 0, TW, min(TH, img.height)))
        x = PAD + (i % COLS) * (TW + PAD)
        y = PAD + (i // COLS) * (TH + LABEL + PAD)
        sheet.paste(img, (x, y))
        label = f"{file.parent.name}/{file.stem}"
        draw.text((x + 6, y + TH + 4), label[:44], fill=(210, 210, 210), font=font)
    target = out / f"contacto-{viewport.name}.jpg"
    sheet.save(target, quality=78)
    print(f"{target} ({len(files)} capturas)")
