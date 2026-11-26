// Offline shell: pages network-first (copia guardada si no hay cobertura),
// hashed /assets/ y medios públicos cache-first. Nunca /~oauth.
// v4: las fotos ya no van en la caché del shell (ahora tienen la suya, con tope).
const CACHE = "autopilot-shell-v4";
// Fotos y clips públicos de Supabase: se guardan y se sirven al instante la próxima vez, con tope.
// La misma foto y el mismo clip tienen siempre la misma URL (al regenerarlos, la URL cambia), así
// que lo guardado nunca se queda viejo y no hace falta volver a pedirlo a la red.
const SUPABASE_ORIGIN = "https://enebrcdrdnfkyduzyrzm.supabase.co";
const MEDIA_CACHE = "autopilot-media-v1";
const VIDEO_CACHE = "autopilot-video-v1";
// Fotos reducidas (WebP de 1–15 KB): 400 caben en unos pocos MB.
const MEDIA_MAX = 400;
// Clips de técnica de 4 s: los 40 últimos (los de varias rutinas). Como `ExerciseVideoCache` en la app.
const VIDEO_MAX = 40;
const KEEP = [CACHE, MEDIA_CACHE, VIDEO_CACHE];

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) =>
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("autopilot-") && !KEEP.includes(k)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  ),
);

// Lo más antiguo sale primero cuando se pasa del tope.
const trim = async (name, max) => {
  const cache = await caches.open(name);
  const keys = await cache.keys();
  for (let i = 0; i < keys.length - max; i += 1) await cache.delete(keys[i]);
};

// Se pide con CORS (Supabase lo permite): así la respuesta se puede leer, se guarda con su tamaño
// real y se puede recortar para el vídeo. Si fallara, la petición original, sin guardar. Con el
// `Accept` del navegador: sin él, el render de Supabase devuelve PNG (~500 KB) en vez de WebP.
const corsFetch = (url, req) => fetch(url, {
  mode: "cors",
  credentials: "omit",
  headers: { Accept: req.headers.get("Accept") || "image/webp,image/*,*/*" },
});

const cachedImage = async (req, url) => {
  const cache = await caches.open(MEDIA_CACHE);
  const hit = await cache.match(url.href);
  if (hit) return hit;
  try {
    const res = await corsFetch(url.href, req);
    if (res.ok) {
      await cache.put(url.href, res.clone());
      trim(MEDIA_CACHE, MEDIA_MAX);
    }
    return res;
  } catch {
    return fetch(req);
  }
};

// «bytes=0-», «bytes=0-1», «bytes=-500» sobre un archivo de `size` bytes.
const rangeOf = (header, size) => {
  const m = /bytes=(\d*)-(\d*)/.exec(header || "");
  if (!m) return null;
  let start = m[1] === "" ? NaN : Number(m[1]);
  let end = m[2] === "" ? size - 1 : Number(m[2]);
  if (Number.isNaN(start)) { start = Math.max(0, size - end); end = size - 1; }
  return start < size ? { start, end: Math.min(end, size - 1) } : null;
};

// El clip entero se guarda una vez; cada petición de rango (Safari pide trozos) sale del guardado.
const fromBlob = async (res, req) => {
  const blob = await res.blob();
  const type = res.headers.get("Content-Type") || "video/mp4";
  const range = rangeOf(req.headers.get("Range"), blob.size);
  if (!range) {
    return new Response(blob, { status: 200, headers: { "Content-Type": type, "Content-Length": String(blob.size), "Accept-Ranges": "bytes" } });
  }
  const part = blob.slice(range.start, range.end + 1);
  return new Response(part, {
    status: 206,
    headers: {
      "Content-Type": type,
      "Content-Length": String(part.size),
      "Content-Range": `bytes ${range.start}-${range.end}/${blob.size}`,
      "Accept-Ranges": "bytes",
    },
  });
};

const cachedVideo = async (req, url) => {
  const cache = await caches.open(VIDEO_CACHE);
  const hit = await cache.match(url.href);
  if (hit) return fromBlob(hit, req);
  try {
    const res = await corsFetch(url.href, req);
    if (res.status !== 200) return fetch(req);
    await cache.put(url.href, res.clone());
    trim(VIDEO_CACHE, VIDEO_MAX);
    return fromBlob(res, req);
  } catch {
    return fetch(req);
  }
};

self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);
  if (req.method !== "GET" || url.pathname.startsWith("/~oauth")) return;
  const sameOrigin = url.origin === self.location.origin;
  const supabase = url.origin === SUPABASE_ORIGIN;
  // Fotos públicas: la original y la reducida del render (`fastImage`), que es la que piden las pantallas.
  const publicImage = supabase
    && (url.pathname.startsWith("/storage/v1/render/image/public/")
      || (url.pathname.startsWith("/storage/v1/object/public/") && /\.(jpe?g|png|webp|avif|gif)$/i.test(url.pathname)));
  // Clips de técnica (`site-assets/exercise-videos/*.mp4`).
  const exerciseVideo = supabase
    && url.pathname.startsWith("/storage/v1/object/public/")
    && url.pathname.includes("/exercise-videos/")
    && /\.(mp4|mov|m4v)$/i.test(url.pathname);
  if (publicImage) { event.respondWith(cachedImage(req, url)); return; }
  if (exerciseVideo) { event.respondWith(cachedVideo(req, url)); return; }
  if (!sameOrigin) return;
  if (url.pathname.startsWith("/assets/")) {
    event.respondWith(
      caches.match(req).then((hit) => hit || fetch(req).then((res) => {
        if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
        return res;
      })),
    );
    return;
  }
  event.respondWith(
    fetch(req).then((res) => {
      if (res.ok && req.mode === "navigate") { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
      return res;
    }).catch(() => caches.match(req).then((hit) => hit || caches.match("/"))),
  );
});
