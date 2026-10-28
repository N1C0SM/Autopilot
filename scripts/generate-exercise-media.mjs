#!/usr/bin/env node
/**
 * Genera las imágenes y los vídeos de técnica de toda la biblioteca de ejercicios.
 *
 * Recorre la cola del servidor (acción `batch` de la función exercise-video), así que
 * no depende de tener el panel de admin abierto: puedes parar con Ctrl+C y volver a
 * lanzarlo, y continuará por donde iba. Los ejercicios que fallan se saltan en esta
 * pasada (quedan con `media_error` visible en Admin → Biblioteca).
 *
 * Uso:
 *   1. Abre la app como administrador, y en la consola del navegador copia tu token:
 *        JSON.parse(localStorage.getItem('sb-<ref>-auth-token')).access_token
 *   2. Ejecuta:
 *        SUPABASE_URL=https://<ref>.supabase.co \
 *        SUPABASE_ANON_KEY=<clave publicable> \
 *        SUPABASE_ACCESS_TOKEN=<token del paso 1> \
 *        node scripts/generate-exercise-media.mjs
 *
 * Opciones:
 *   --images-only     Solo imágenes (mucho más rápido y barato).
 *   --videos-only     Solo vídeos.
 *   --limit=N         Procesa como máximo N ejercicios en esta ejecución.
 *   --dry-run         Solo cuenta los pendientes, sin generar nada.
 */

const URL_BASE = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
const ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLISHABLE_KEY || '';
const ACCESS_TOKEN = process.env.SUPABASE_ACCESS_TOKEN || '';
const FN = `${URL_BASE}/functions/v1/exercise-video`;

const args = process.argv.slice(2);
const has = (flag) => args.includes(flag);
const valueOf = (name, fallback) => {
  const found = args.find((a) => a.startsWith(`--${name}=`));
  return found ? Number(found.split('=')[1]) : fallback;
};

const IMAGES_ONLY = has('--images-only');
const VIDEOS_ONLY = has('--videos-only');
const DRY_RUN = has('--dry-run');
const LIMIT = valueOf('limit', Infinity);

const VIDEO_DEADLINE_MS = 10 * 60 * 1000;
const POLL_EVERY_MS = 6000;

if (!URL_BASE || !ANON_KEY || !ACCESS_TOKEN) {
  console.error(
    'Faltan variables. Necesitas SUPABASE_URL, SUPABASE_ANON_KEY y SUPABASE_ACCESS_TOKEN.\n' +
      'Consulta la cabecera de este fichero para ver cómo obtener el token.',
  );
  process.exit(1);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function call(body) {
  const res = await fetch(FN, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: ANON_KEY,
      Authorization: `Bearer ${ACCESS_TOKEN}`,
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    /* respuesta no JSON */
  }
  return { ok: res.ok, status: res.status, data };
}

/**
 * La cola vive en el servidor (acción `batch`), pero esa acción llega con el
 * despliegue nuevo. Si la función desplegada todavía no la tiene, se listan los
 * pendientes directamente por REST con tu propio token, así el script funciona
 * igual sin esperar a desplegar.
 */
let restQueue = null;

async function buildRestQueue() {
  const rows = [];
  const pageSize = 500;
  for (let from = 0; ; from += pageSize) {
    const url = `${URL_BASE}/rest/v1/exercises?select=id,name,image_url,video_url&order=image_url.asc.nullslast,video_url.asc.nullslast,name.asc&offset=${from}&limit=${pageSize}`;
    const res = await fetch(url, {
      headers: { apikey: ANON_KEY, Authorization: `Bearer ${ACCESS_TOKEN}` },
    });
    if (!res.ok) throw new Error(`No se pudo leer la biblioteca (${res.status}). ¿El token sigue siendo válido?`);
    const batch = await res.json();
    rows.push(...batch);
    if (batch.length < pageSize) break;
  }
  return rows.filter((r) => !r.image_url || !r.video_url);
}

async function nextPending(exclude) {
  if (restQueue) {
    const next = restQueue.find((r) => !exclude.includes(r.id));
    if (!next) return { done: true, remaining: 0 };
    return { done: false, nextId: next.id, name: next.name, action: next.image_url ? 'create' : 'image' };
  }

  const { ok, status, data } = await call({ action: 'batch', exclude });
  if (ok) return data;

  // La función desplegada aún no conoce `batch`: pasamos a modo REST.
  restQueue = await buildRestQueue();
  console.log(`La función desplegada no tiene la cola del servidor; uso la lista directa (${restQueue.length} pendientes).`);
  return nextPending(exclude);
}

async function generateImage(exerciseId) {
  const { ok, status, data } = await call({ action: 'image', exercise_id: exerciseId });
  if (!ok) throw new Error(data?.error || `Error ${status}`);
  return data;
}

async function generateVideo(exerciseId) {
  const created = await call({ action: 'create', exercise_id: exerciseId });
  if (!created.ok) throw new Error(created.data?.error || `Error ${created.status}`);

  const deadline = Date.now() + VIDEO_DEADLINE_MS;
  let lastProgress = null;
  while (Date.now() < deadline) {
    await sleep(POLL_EVERY_MS);
    const check = await call({ action: 'check', exercise_id: exerciseId });
    if (!check.ok) continue;
    const status = check.data?.status;
    if (status === 'completed') return check.data;
    if (status === 'failed') throw new Error(check.data?.error || 'La generación del vídeo falló');
    if (typeof check.data?.progress === 'number' && check.data.progress !== lastProgress) {
      lastProgress = check.data.progress;
      process.stdout.write(` ${Math.round(lastProgress)}%`);
    }
  }
  throw new Error('El vídeo tardó más de 10 minutos');
}

async function main() {
  if (DRY_RUN) {
    let total = 0;
    const exclude = [];
    for (;;) {
      const next = await nextPending(exclude);
      if (next?.done) break;
      exclude.push(next.nextId);
      total += 1;
      if (total >= 500) break;
    }
    console.log(`Pendientes (imagen o vídeo): ${total}`);
    return;
  }

  const started = Date.now();
  const exclude = [];
  let done = 0;
  let failed = 0;
  let alreadyDismissed = false;

  for (;;) {
    if (done >= LIMIT) {
      console.log(`\nLímite de ${LIMIT} alcanzado. Vuelve a lanzarlo para continuar.`);
      break;
    }
    const next = await nextPending(exclude);
    if (next?.done) {
      const skipped = exclude.length;
      console.log(`\nCola vacía. Hechos: ${done}. Fallidos saltados: ${failed}.`);
      if (skipped > 0) {
        console.log(`Revisa los ${skipped} con error en Admin → Biblioteca (filtro «Con error») y reinténtalos sin --limit.`);
      }
      break;
    }

    const { nextId, name, action } = next;
    const task = action === 'image' ? 'imagen' : 'vídeo';
    if ((IMAGES_ONLY && action !== 'image') || (VIDEOS_ONLY && action !== 'create')) {
      // Este ejercicio ya tiene lo que pedíamos: lo saltamos en esta pasada.
      if (!alreadyDismissed) {
        console.log(`Solo ${IMAGES_ONLY ? 'imágenes' : 'vídeos'}: se omiten los que ya los tienen.`);
        alreadyDismissed = true;
      }
      exclude.push(nextId);
      continue;
    }

    process.stdout.write(`[${done + 1}] ${name} · ${task}…`);
    try {
      if (action === 'image') {
        await generateImage(nextId);
      } else {
        await generateVideo(nextId);
      }
      done += 1;
      console.log(' ok');
    } catch (error) {
      failed += 1;
      exclude.push(nextId); // que no bloquee la cola en esta ejecución
      console.log(` fallo: ${error.message}`);
    }
  }

  const minutos = ((Date.now() - started) / 60000).toFixed(1);
  console.log(`\nResumen: ${done} generados, ${failed} fallidos, en ${minutos} min.`);
}

main().catch((error) => {
  console.error(`\nSe detuvo: ${error.message}`);
  console.error('Vuelve a lanzarlo y continuará por donde iba (la cola es del servidor).');
  process.exit(1);
});
