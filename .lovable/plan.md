# Landing premium: menos densidad, más respiración

ChatGPT tiene razón. El problema ya no es la longitud — es que **todas las secciones gritan al mismo volumen**. Cada bloque tiene título + subtítulo + grid + cards + badges + bordes + fondo distinto. No hay jerarquía ni descanso.

## Principio rector

**Alternar ritmo**: bloque denso → bloque respirado → bloque denso. Nunca dos secciones con la misma intensidad seguidas.

```
Hero (respirado, fuerte)
↓
AI Scan (denso, visual — el "wow")
↓
Cómo funciona (respirado, tipográfico)
↓
Diferenciación + chat (denso, visual)
↓
Testimonios (respirado, una sola voz)
↓
Pricing (denso, decisión)
↓
FAQ + CTA (respirado, cierre)
```

## Cambios concretos

### 1. Whitespace y ancho

- `py-20` → `py-28` o `py-32` en secciones respiradas (hero, cómo funciona, testimonios, FAQ, CTA)
- Mantener `py-20` solo en secciones densas (AI scan, diferenciación, pricing)
- Limitar ancho de texto: `max-w-2xl` para párrafos, `max-w-3xl` para titulares
- Aumentar `gap` entre cards de 4 a 6/8

### 2. Eliminar repetición de trust badges

Aparecen 4-5 veces "7 días gratis · sin permanencia · cancelas cuando quieras":
- Hero: mantener (es la primera vez)
- AI Scan: **quitar** los 3 badges "100% privado / Análisis 60s / 7 días gratis"
- Pricing: mantener microcopy
- CTA final: mantener microcopy
- Quitar de todos los demás CTAs intermedios

### 3. Reducir cards/cajas

**Cómo funciona** (4 cards iguales):
- Cambiar de 4 cards con borde a **timeline tipográfico** sin bordes: número grande + título + descripción, separados por espacio. Más editorial, menos "dashboard".

**Resultados sostenibles** (3 columnas Entrenamiento/Nutrición/Acompañamiento):
- Demasiadas listas. Reducir a **3 bloques tipográficos** sin borde ni card: icono grande + título + 1 frase corta (no lista de 4 items)
- Mover esto al hero o eliminarlo (redundante con "cómo funciona")

**Testimonios**:
- 3 cards con estrellas+borde+avatar = ruido. Cambiar a **1 testimonio destacado grande** (cita en tipografía display) + 2 más pequeños debajo sin borde

### 4. Diferenciación + chat

Actualmente: 2 cards (lo de siempre vs Autopilot) + chat mockup grande, todo con bordes.
- Reducir las 2 listas a **una sola fila comparativa horizontal** simple (ej: "Otros: bot · Autopilot: persona real")
- O eliminar las listas y dejar **solo el chat mockup** centrado con un titular fuerte arriba ("Así es el chat. Soy yo respondiendo.")

### 5. Un solo CTA por bloque

Actualmente CTA en: hero, AI scan, diferenciación, testimonios, pricing, CTA final.
- Hero → CTA principal
- AI Scan → CTA secundario "Escanear gratis" (diferente acción)
- Pricing → botón implícito en `PricingTiers`
- CTA final → CTA cierre
- **Quitar** CTAs intermedios de testimonios y diferenciación

### 6. Bordes y fondos

- Quitar `border border-border` de cards tipográficas (testimonios, cómo funciona)
- Mantener solo en pricing y AI scan (donde el card tiene sentido)
- Reducir alternancia `bg-card/30` ↔ `bg-background` — usar fondos solo 2-3 veces, no en cada sección

### 7. Pricing

- Quitar el titular largo "Un precio. Plan + acompañamiento real incluidos." → solo "Precio"
- Más aire alrededor de `PricingTiers`
- Garantía: convertir el card grande con icono flotante en una **línea simple bajo el precio** + badge ShieldCheck

### 8. Hero

- Quitar trainer trust-bar de arriba (foto+nombre antes del titular). Ya hay nav y aporta ruido. Mover al final del hero o a la sección "diferenciación"
- O dejarlo pero sin caja, solo foto + texto inline más pequeño

## Resultado esperado

- **Mismo contenido, mitad de elementos visuales**
- Cada sección tiene UN propósito visual claro
- El ojo descansa entre secciones densas
- Sensación: "esto es simple y premium" en lugar de "esto tiene mucho valor amontonado"

## Archivos a tocar

- `src/pages/Index.tsx` — reescritura de secciones para reducir densidad
- `src/components/AIScanSection.tsx` — quitar 3 badges duplicados, ajustar paddings

## Fuera de alcance

- No cambiar paleta ni fuentes
- No tocar pricing logic ni `PricingTiers`
- No reescribir copy nuevo (solo recortar)
