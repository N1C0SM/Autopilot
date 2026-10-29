# Enlaces con UTM para medir la captación

Admin → **Captación** agrupa cada visita, scan y cuenta por la red de la que vino.
Para que cuente bien, **todo enlace que publiquemos debe llevar `utm_source`**.
Sin UTM, el panel intenta deducir la red por el referrer (Instagram y Facebook lo
suelen enviar; TikTok casi nunca), y si no puede la cuenta como «Directo / sin origen».

Reglas: `utm_source` = la red en minúsculas (`tiktok`, `instagram`, `youtube`,
`threads`, `facebook`); `utm_medium` = dónde está el enlace (`bio`, `story`,
`post`, `dm`); `utm_campaign` opcional (p. ej. `scan_oct26`).

## Bios

| Red | Landing | Scan gratis |
|---|---|---|
| TikTok | `https://autopilotplan.com/?utm_source=tiktok&utm_medium=bio` | `https://autopilotplan.com/scan?utm_source=tiktok&utm_medium=bio` |
| Instagram | `https://autopilotplan.com/?utm_source=instagram&utm_medium=bio` | `https://autopilotplan.com/scan?utm_source=instagram&utm_medium=bio` |
| YouTube | `https://autopilotplan.com/?utm_source=youtube&utm_medium=bio` | `https://autopilotplan.com/scan?utm_source=youtube&utm_medium=bio` |
| Threads | `https://autopilotplan.com/?utm_source=threads&utm_medium=bio` | `https://autopilotplan.com/scan?utm_source=threads&utm_medium=bio` |
| Facebook | `https://autopilotplan.com/?utm_source=facebook&utm_medium=bio` | `https://autopilotplan.com/scan?utm_source=facebook&utm_medium=bio` |

La bio solo admite un enlace: usar el de **Scan** (es la oferta gratis del
contenido). Para historias de Instagram: `utm_medium=story`; para la descripción de
un Short de YouTube: `utm_medium=post`.

## Cómo se mide

- Primer contacto: se guarda en el navegador 30 días; la primera red con UTM gana.
- Al crear la cuenta (registro normal, `/scan?from=scan`, Google o Apple) se guarda
  en `user_acquisition`. Las cuentas anteriores a esta versión salen como «sin origen».
- Visitas = visitantes nuevos por navegador (no páginas vistas). Scans = análisis
  hechos en la web. Activo 2ª semana = al menos un entreno entre los días 8 y 14.
- Se excluyen admins, entrenadores y cuentas de `metrics_excluded_users`.

## Persona a persona

Admin → Captación → **Personas**: cada cuenta del rango con su red, medio, campaña,
página por la que entró, fecha de alta, último entreno y el **paso en el que se quedó**
(Solo creó la cuenta → Hizo el scan → Entrenó al menos una vez → Activo la 2ª semana → Plus),
filtrable por red y por paso. El bloque **Embudo** muestra cuánto se pierde entre cada paso.
Los visitantes sin cuenta solo se cuentan: no se sigue a nadie que no se ha registrado.

## Siguiente paso (fuera de alcance)

Traer seguidores, alcance y clics de Metricool al mismo panel (requiere la API del
plan Advanced de Metricool) para ver el embudo completo: alcance → visita → cuenta.
