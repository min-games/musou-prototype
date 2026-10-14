const PRECACHE = [];
const VERSION = "__BUILD_VERSION__";
const PREFIX = "iron-field:" + new URL("./", self.location).pathname + ":";
const CACHE = PREFIX + VERSION;
self.addEventListener("install", (event) =>
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      const root = new URL("./", self.location).href;
      const response = await fetch(root);
      const html = await response.clone().text();
      const assets = [...html.matchAll(/(?:src|href)="([^"]+)"/g)]
        .map((m) => new URL(m[1], root).href)
        .filter((u) => u.startsWith(root));
      await cache.put(root, response);
      await cache.addAll([
        ...new Set([
          ...assets,
          ...PRECACHE.map((path) => new URL(path, root).href),
          new URL("icon.svg", root).href,
        ]),
      ]);
      self.skipWaiting();
    })(),
  ),
);
self.addEventListener("activate", (event) =>
  event.waitUntil(
    (async () => {
      for (const key of await caches.keys())
        if (key.startsWith(PREFIX) && key !== CACHE) await caches.delete(key);
      await self.clients.claim();
    })(),
  ),
);
self.addEventListener("fetch", (event) => {
  if (
    event.request.method !== "GET" ||
    !event.request.url.startsWith(new URL("./", self.location).href)
  )
    return;
  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE);
      const cached = await cache.match(event.request);
      if (cached) return cached;
      if (event.request.mode === "navigate") {
        const root = new URL("./", self.location).href;
        return (await cache.match(root)) || fetch(event.request);
      }
      const response = await fetch(event.request);
      if (response.ok) await cache.put(event.request, response.clone());
      return response;
    })(),
  );
});
