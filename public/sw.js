// Offline shell: pages network-first (copia guardada si no hay cobertura),
// hashed /assets/ y medios públicos cache-first. Nunca /~oauth.
const CACHE = "autopilot-shell-v3";
// Fotos y vídeos públicos de Supabase: se guardan y se sirven al instante la próxima vez.
const SUPABASE_ORIGIN = "https://enebrcdrdnfkyduzyrzm.supabase.co";
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) =>
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("autopilot-shell-") && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  ),
);
self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);
  if (req.method !== "GET" || url.pathname.startsWith("/~oauth")) return;
  const sameOrigin = url.origin === self.location.origin;
  // Solo imágenes públicas: los vídeos son grandes y no se cachean.
  const publicMedia = url.origin === SUPABASE_ORIGIN
    && url.pathname.startsWith("/storage/v1/object/public/")
    && /\.(jpe?g|png|webp|avif|gif)$/i.test(url.pathname);
  if (!sameOrigin && !publicMedia) return;
  if (publicMedia) {
    // Cache-first: la foto ya vista no vuelve a esperar a la red (se refresca por detrás).
    event.respondWith(
      caches.open(CACHE).then(async (cache) => {
        const hit = await cache.match(req);
        const fresh = fetch(req)
          .then((res) => { if (res.ok) cache.put(req, res.clone()); return res; })
          .catch(() => null);
        return hit || (await fresh) || Response.error();
      }),
    );
    return;
  }
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
