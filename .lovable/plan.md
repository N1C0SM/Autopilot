# Simplificar la landing

Sí, la landing actual es **demasiado larga** (~14 secciones, ~3-4 scrolls completos). El usuario llega del scan o del anuncio y antes de llegar al precio ya se ha cansado. Hay solapamiento de mensajes (3 secciones distintas dicen "soy persona real, no bot").

## Problemas actuales

- 14 secciones largas con `py-32` (256px de padding cada una)
- **Mensajes repetidos**: "persona real" aparece en hero, beneficios, diferenciación, sobre mí, testimonios
- **Mockup de chat enorme** (460px) que dice lo mismo que la sección comparativa de al lado
- **Bloque "Mensaje central"** suelto que no aporta nada nuevo
- **AIScanSection completo** dentro de la landing → es prácticamente una segunda landing dentro
- **Comparativa de precios con 3 columnas** + `PricingTiers` debajo = doble pricing
- 9 FAQs cuando 4-5 cubren el 90%

## Estructura propuesta (7 secciones)

```
1. HERO               → headline + bullets + CTA + trust bar (compacto)
2. AI SCAN (gancho)   → versión condensada: 1 frase + mockup + CTA "Escanear gratis"
3. CÓMO FUNCIONA      → 4 pasos en una fila (sin sección de dolor separada)
4. QUÉ HACE DIFERENTE → comparativa "lo de siempre vs Autopilot" + mini-mockup chat (más pequeño)
5. RESULTADOS + TESTIMONIOS → fusionar "qué incluye" + 3 testimonios en una sola sección
6. PRECIO + GARANTÍA  → solo PricingTiers + garantía (sin tabla comparativa de precios)
7. FAQ + CTA FINAL    → 5 FAQs clave + CTA
```

## Cambios concretos

**Eliminar:**
- Sección "Mensaje central" (línea 298-307) — redundante
- Sección "Dolor / pain points" (línea 339-372) — el hero + cómo funciona ya cubren el problema
- Sección "Sobre mí" como bloque separado (línea 532-583) — mover el avatar+stats al hero o al chat mockup
- Tabla comparativa de precios (línea 740-768) — `PricingTiers` ya posiciona el precio
- Sub-secciones internas de `AIScanSection`: dejar solo la hero del scan, quitar "cómo funciona scan", "compara objetivo", "puente coaching", "FAQ scan"

**Reducir:**
- `py-32` → `py-20` en todas las secciones
- 9 FAQs → 5 (entreno casa, lesiones, IA o persona, tiempo, garantía)
- Mockup chat 460px → 320px
- `mb-14` / `mb-16` titulares → `mb-8`

**Reorganizar:**
- Trust bar del entrenador (foto + "+8 años · +200 alumnos") va dentro del hero, no como sección aparte
- Stats (alumnos, experiencia, enfoque) van como mini-bar bajo el headline

## Resultado esperado

- De ~6500px de altura total a ~3200px (la mitad)
- Usuario ve precio en 2-3 scrolls en lugar de 5-6
- Mensaje único y claro en cada sección, sin repeticiones

## Archivos a tocar

- `src/pages/Index.tsx` — reestructura principal
- `src/components/AIScanSection.tsx` — recortar a 1 sola sección hero (eliminar 4 sub-secciones)

## Fuera de alcance

- No tocar copy nuevo, solo eliminar/reordenar lo existente
- No cambiar diseño visual ni paleta
- No tocar pricing logic ni `PricingTiers`
