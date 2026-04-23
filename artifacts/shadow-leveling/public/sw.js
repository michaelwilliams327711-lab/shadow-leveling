const CACHE_VERSION = "v5";
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

function isViteDevPath(url) {
  return (
    url.pathname.startsWith("/@") ||
    url.pathname.startsWith("/src/") ||
    url.pathname.startsWith("/node_modules/") ||
    url.search.includes("t=") ||
    url.search.includes("v=") ||
    url.search.includes("import") ||
    url.pathname.endsWith(".ts") ||
    url.pathname.endsWith(".tsx")
  );
}

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

  if (request.method !== "GET") return;

  // Never intercept Vite dev-server module requests — let HMR work freely
  if (isViteDevPath(url)) return;

  // All /api/* routes → Network-First (no whitelist needed — regex catches every future endpoint)
  if (url.pathname.startsWith("/api/")) {
    event.respondWith(networkFirst(request));
  } else if (request.mode === "navigate") {
    // Page navigations (the app shell HTML) → Network-First so the installed PWA
    // never gets stuck on a stale or broken cached shell.
    event.respondWith(navigationNetworkFirst(request));
  } else if (url.origin === self.location.origin) {
    // Cache-First for static assets (icons, manifest, fonts)
    event.respondWith(cacheFirst(request));
  }
});

// ── Strategy: Navigation Network-First (app shell) ───────────────────────────
async function navigationNetworkFirst(request) {
  const cache = await caches.open(STATIC_CACHE);
  try {
    const networkResponse = await fetch(request);
    if (networkResponse && networkResponse.ok) {
      cache.put("/index.html", networkResponse.clone());
    }
    return networkResponse;
  } catch {
    const cached = (await cache.match("/index.html")) || (await cache.match("/"));
    if (cached) return cached;
    return new Response("Shadow Leveling — offline. Please reconnect.", {
      status: 503,
      headers: { "Content-Type": "text/plain" },
    });
  }
}

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
    const fallback = await caches.match("/index.html");
    if (fallback) return fallback;
    return new Response("Shadow Leveling — offline. Please reconnect.", {
      status: 503,
      headers: { "Content-Type": "text/plain" },
    });
  }
}

// ── Push Notifications ───────────────────────────────────────────────────────
const PENALTY_VIBRATE = [100, 50, 100, 50, 100, 50, 300, 50, 300, 50, 300, 50, 100, 50, 100, 50, 100];
const WARNING_VIBRATE = [200, 100, 200, 100, 400];

self.addEventListener("push", (event) => {
  let data = { title: "⚔️ Shadow System", body: "Your quests await.", url: "/quests", type: null, severity: null, vibrate: null };
  try {
    if (event.data) data = { ...data, ...event.data.json() };
  } catch { /* ignore */ }

  const isPenalty = data.type === "PENALTY_QUEST";
  const isWarning = data.type === "MISSION_WARNING";

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: "/images/icon-192.png",
      badge: "/images/icon-192.png",
      data: {
        url: isPenalty ? "/penalty-zone" : (data.url || "/quests"),
        type: data.type,
        severity: data.severity,
      },
      vibrate: isPenalty ? PENALTY_VIBRATE : isWarning ? WARNING_VIBRATE : (data.vibrate ?? [200, 100, 200]),
      requireInteraction: isPenalty || isWarning,
      tag: isPenalty ? "penalty-zone" : isWarning ? `mission-warning-${data.questId || ""}` : undefined,
    }).then(() => {
      if (isPenalty) {
        return self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
          for (const client of clients) {
            client.postMessage({ type: "PENALTY_ACTIVE" });
          }
        });
      }
      if (isWarning) {
        return self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
          for (const client of clients) {
            client.postMessage({ type: "MISSION_WARNING_ALARM", questId: data.questId });
          }
        });
      }
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data?.url) ?? "/quests";
  const isPenalty = event.notification.data?.type === "PENALTY_QUEST";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      if (isPenalty) {
        for (const client of clientList) {
          client.postMessage({ type: "PENALTY_ACTIVE" });
        }
      }
      for (const client of clientList) {
        if ("focus" in client) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(targetUrl);
    })
  );
});

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
    const cached = await cache.match(request);
    if (cached) return cached;

    return new Response(JSON.stringify({ offline: true, data: null }), {
      status: 503,
      headers: { "Content-Type": "application/json" },
    });
  }
}
