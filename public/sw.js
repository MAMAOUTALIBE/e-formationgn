// Service worker minimal pour E-FormationGN.
// Stratégies :
//   - Network-first pour les pages HTML (toujours essayer le réseau, fallback
//     cache si offline)
//   - Cache-first pour les assets statiques (/_next/static, fonts, images)
//   - On évite de cacher les routes API et les pages d'authentification

const CACHE_VERSION = "efgn-v1";
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const PAGES_CACHE = `${CACHE_VERSION}-pages`;

const OFFLINE_FALLBACK_URL = "/";

const STATIC_PREFIXES = ["/_next/static/", "/_next/image"];
const SKIP_PREFIXES = [
  "/api/",
  "/connexion",
  "/inscription",
  "/admin",
  "/formateur",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(PAGES_CACHE)
      .then((cache) => cache.add(OFFLINE_FALLBACK_URL))
      .catch(() => {})
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => !k.startsWith(CACHE_VERSION))
            .map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (SKIP_PREFIXES.some((p) => url.pathname.startsWith(p))) return;

  // Cache-first pour les assets statiques
  if (STATIC_PREFIXES.some((p) => url.pathname.startsWith(p))) {
    event.respondWith(cacheFirst(request, STATIC_CACHE));
    return;
  }

  // Network-first pour les pages HTML
  if (request.mode === "navigate" || request.destination === "document") {
    event.respondWith(networkFirst(request));
    return;
  }
});

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch {
    return cached ?? Response.error();
  }
}

async function networkFirst(request) {
  const cache = await caches.open(PAGES_CACHE);
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch {
    const cached = await cache.match(request);
    if (cached) return cached;
    const fallback = await cache.match(OFFLINE_FALLBACK_URL);
    return fallback ?? Response.error();
  }
}
