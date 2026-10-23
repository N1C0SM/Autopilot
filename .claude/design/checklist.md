# Checklist antes de publicar una versión

Pásala en cada pantalla nueva o cambiada. Si algo falla, no se publica.

## Identidad

- [ ] Fondo negro, dorado solo en lo importante (una acción dorada por pantalla).
- [ ] Tarjetas sin bordes, con radios del sistema (22 / 28 px); botones y campos en píldora.
- [ ] Lo primero que se lee es una cifra grande, una foto real o un titular redondeado.
- [ ] Fotos reales o de marca; ninguna ilustración, emoji ni icono suelto como protagonista.
- [ ] Usa los componentes comunes (`EmptyState`, `ListGroup`, `PageHero`, `PublicLayout`, piezas de acceso…) en vez de copias.
- [ ] Textos con clases `type-*`; ningún `text-xs`/`text-sm`/`text-[Npx]` para interfaz.
- [ ] Números en español (`49,6`, `2.366`), cifras con `tabular-nums`.

## Plataformas

- [ ] Revisada a 375–393 px (iPhone) y a 1280 px (Mac/escritorio).
- [ ] Sin scroll horizontal; nada aplastado en columnas flex (`shrink-0` en cabeceras).
- [ ] Funciona igual en la app de iPhone, la de Mac (`isMacApp`) y el APK de Android.

## Accesibilidad

- [ ] Zonas táctiles ≥ 44 pt y etiquetas en los botones de solo icono.
- [ ] Con letra al 140 % (`--type-scale: 1.4`) nada se corta ni se monta.
- [ ] Con «reducir movimiento» todo se ve quieto y completo.
- [ ] VoiceOver lee todo el contenido (las escenas animadas tienen su lista `sr-only`).

## Verdad

- [ ] Ninguna cifra, testimonio ni función inventada.
- [ ] Lo de pago dice su plan y respeta los planes ocultos en Admin (`usePlanAvailability`).

## Publicar

- [ ] `npx vitest run` y `npx tsc --noEmit -p tsconfig.app.json` en verde.
- [ ] Push a `main` (genera el APK de Android y la web) y publicar en Lovable.
- [ ] Reinstalar en iPhone y Mac.
