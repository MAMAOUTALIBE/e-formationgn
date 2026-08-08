// Service worker volontairement conservateur : seules les ressources publiques
// explicitement listées ci-dessous peuvent être conservées hors ligne.

const CACHE_VERSION = "efgn-v2";
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const PAGES_CACHE = `${CACHE_VERSION}-public-pages`;

const PUBLIC_PAGE_ALLOWLIST = new Set([
  "/",
  "/a-propos",
  "/aide",
  "/categories",
  "/cgv",
  "/confidentialite",
  "/contact",
  "/cookies",
  "/cours",
  "/credits",
  "/devenir-formateur",
  "/mentions-legales",
]);

self.addEventListener("install", (event) => {
  // Ne précharge aucune page HTML : l'installation peut avoir lieu pendant
  // une session connectée. Une page n'entre dans le cache qu'après validation
  // de sa réponse par `isCacheableResponse`.
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter(
              (key) => key.startsWith("efgn-") && !key.startsWith(CACHE_VERSION),
            )
            .map((key) => caches.delete(key)),
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

  // Les bundles Next portent une empreinte de contenu et ne contiennent pas de
  // données utilisateur. Aucun autre asset ou endpoint n'est mis en cache.
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(cacheFirstStatic(request));
    return;
  }

  const isDocument = request.mode === "navigate" || request.destination === "document";
  const isAllowlistedPage =
    isDocument && url.search === "" && PUBLIC_PAGE_ALLOWLIST.has(url.pathname);

  if (isAllowlistedPage) {
    event.respondWith(networkFirstPublicPage(request));
  }
});

function isCacheableResponse(response, expectedContentType) {
  if (!response.ok || response.redirected || response.type !== "basic") return false;

  const cacheControl = (response.headers.get("cache-control") || "").toLowerCase();
  if (cacheControl.includes("private") || cacheControl.includes("no-store")) return false;

  if (!expectedContentType) return true;
  const contentType = (response.headers.get("content-type") || "").toLowerCase();
  return contentType.includes(expectedContentType);
}

async function cacheFirstStatic(request) {
  const cache = await caches.open(STATIC_CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (isCacheableResponse(response)) {
      await cache.put(request, response.clone());
    }
    return response;
  } catch {
    return Response.error();
  }
}

async function networkFirstPublicPage(request) {
  const cache = await caches.open(PAGES_CACHE);

  try {
    const response = await fetch(request);
    if (isCacheableResponse(response, "text/html")) {
      await cache.put(request, response.clone());
    }
    return response;
  } catch {
    return (await cache.match(request)) ?? Response.error();
  }
}
