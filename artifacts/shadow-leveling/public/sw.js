const CACHE_VERSION = "v1";
const STATIC_CACHE  = `shadow-static-${CACHE_VERSION}`;
const API_CACHE     = `shadow-api-${CACHE_VERSION}`;

const STATIC_PRECACHE = [
  "/",
  "/index.html",
  "/manifest.json",
  "/favicon.svg",
  "/images/icon-192.png",
  "/images/icon-512.png",
];

const API_ROUTES = [
  "/api/character",
  "/api/ascension/powers",
  "/api/daily-orders",
  "/api/skills",
  "/api/inventory",
  "/api/dungeon/gates",
];

// ── Install: pre-cache static shell ─────────────────────────────────────────
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(STATIC_PRECACHE))
  );
  self.skipWaiting();
});

// ── Activate: purge old caches ───────────────────────────────────────────────
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k !== STATIC_CACHE && k !== API_CACHE)
          .map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// ── Fetch: route-based strategy ──────────────────────────────────────────────
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Only intercept same-origin or known API origin requests
  if (request.method !== "GET") return;

  const isApiCall = API_ROUTES.some((r) => url.pathname.startsWith(r));

  if (isApiCall) {
    // Network-First for API: try network, fall back to cache
    event.respondWith(networkFirst(request));
  } else if (url.origin === self.location.origin) {
    // Cache-First for all same-origin static assets
    event.respondWith(cacheFirst(request));
  }
  // Cross-origin (Google Fonts, CDN, etc.) — let pass through naturally
});

// ── Strategy: Cache-First ────────────────────────────────────────────────────
async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      const cache = await caches.open(STATIC_CACHE);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch {
    // Offline fallback: serve cached index.html so the SPA shell loads
    const fallback = await caches.match("/index.html");
    if (fallback) return fallback;
    return new Response("Shadow Leveling — offline. Please reconnect.", {
      status: 503,
      headers: { "Content-Type": "text/plain" },
    });
  }
}

// ── Strategy: Network-First ──────────────────────────────────────────────────
async function networkFirst(request) {
  const cache = await caches.open(API_CACHE);

  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch {
    // Offline: serve last-known API response from cache
    const cached = await cache.match(request);
    if (cached) return cached;

    return new Response(JSON.stringify({ offline: true, data: null }), {
      status: 503,
      headers: { "Content-Type": "application/json" },
    });
  }
}
