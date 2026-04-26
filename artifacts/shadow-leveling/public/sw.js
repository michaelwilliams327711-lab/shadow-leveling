const CACHE_VERSION = "v5";
const STATIC_CACHE  = `shadow-static-${CACHE_VERSION}`;
const API_CACHE     = `shadow-api-${CACHE_VERSION}`;

// ── Sync Queue (IndexedDB) ───────────────────────────────────────────────────
// Failed POST requests are persisted here so they can be replayed when the
// network returns. Survives SW restarts and full app reloads.
const SYNC_DB_NAME = "shadow-sync-queue";
const SYNC_STORE   = "pending-mutations";
const SYNC_TAG     = "shadow-replay-mutations";

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

// ── Activate: purge old caches, ensure sync DB exists ───────────────────────
self.addEventListener("activate", (event) => {
  event.waitUntil(
    Promise.all([
      caches.keys().then((keys) =>
        Promise.all(
          keys
            .filter((k) => k !== STATIC_CACHE && k !== API_CACHE)
            .map((k) => caches.delete(k))
        )
      ),
      openSyncDb().catch(() => {}),
    ])
  );
  self.clients.claim();
});

// ── Fetch: route-based strategy ──────────────────────────────────────────────
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // ── POST/PUT/PATCH/DELETE → enqueue for retry on network failure ─────────
  if (request.method !== "GET") {
    if (url.pathname.startsWith("/api/")) {
      event.respondWith(networkWithSyncQueue(request));
    }
    return;
  }

  // Never intercept Vite dev-server module requests — let HMR work freely
  if (isViteDevPath(url)) return;

  // Dedicated /api/character handler — last-known-good fallback for the
  // Status Window so the UI never goes blank when offline.
  if (url.pathname === "/api/character" || url.pathname.startsWith("/api/character?")) {
    event.respondWith(characterNetworkFirst(request));
    return;
  }

  // All other /api/* routes → Network-First with cached fallback
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

// ── Strategy: /api/character — Network-First w/ guaranteed last-known-good ──
// On failure, returns the most recent cached response with an
// `x-shadow-cache: stale` header so the UI can surface an offline indicator.
async function characterNetworkFirst(request) {
  const cache = await caches.open(API_CACHE);
  try {
    const fresh = await fetch(request);
    if (fresh.ok) {
      cache.put(request, fresh.clone());
    }
    return fresh;
  } catch {
    const cached = await cache.match(request);
    if (cached) {
      // Re-issue the cached response with a marker header.
      const body = await cached.clone().text();
      const headers = new Headers(cached.headers);
      headers.set("x-shadow-cache", "stale");
      headers.set("x-shadow-offline", "1");
      return new Response(body, {
        status: 200,
        statusText: "OK (cached)",
        headers,
      });
    }
    // No cached version exists — surface a structured offline payload so
    // the client can render the offline shell instead of crashing.
    return new Response(
      JSON.stringify({ offline: true, message: "Status Window unavailable — no cached character." }),
      { status: 503, headers: { "Content-Type": "application/json", "x-shadow-cache": "miss" } },
    );
  }
}

// ── Strategy: POST/PUT/PATCH/DELETE → network, fall back to Sync Queue ──────
async function networkWithSyncQueue(request) {
  try {
    const response = await fetch(request.clone());
    return response;
  } catch (err) {
    // Network failed — persist the request body so it can be replayed.
    try {
      await enqueueMutation(request.clone());
      // Best-effort Background Sync registration (Chromium-only).
      if ("sync" in self.registration) {
        try { await self.registration.sync.register(SYNC_TAG); } catch {}
      }
      // Notify clients so they can show "Queued for sync" UI.
      broadcast({ type: "MUTATION_QUEUED", url: request.url, method: request.method });

      return new Response(
        JSON.stringify({
          queued: true,
          offline: true,
          message: "Action queued. Will retry when connection returns.",
        }),
        { status: 202, headers: { "Content-Type": "application/json", "x-shadow-queued": "1" } },
      );
    } catch (queueErr) {
      throw err;
    }
  }
}

// ── IndexedDB sync queue helpers ─────────────────────────────────────────────
function openSyncDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(SYNC_DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(SYNC_STORE)) {
        db.createObjectStore(SYNC_STORE, { keyPath: "id", autoIncrement: true });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function enqueueMutation(request) {
  const body = await request.text();
  const headers = {};
  request.headers.forEach((v, k) => { headers[k] = v; });
  const record = {
    url: request.url,
    method: request.method,
    headers,
    body,
    queuedAt: Date.now(),
    attempts: 0,
  };
  const db = await openSyncDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(SYNC_STORE, "readwrite");
    tx.objectStore(SYNC_STORE).add(record);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function getQueuedMutations() {
  const db = await openSyncDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(SYNC_STORE, "readonly");
    const req = tx.objectStore(SYNC_STORE).getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

async function deleteQueuedMutation(id) {
  const db = await openSyncDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(SYNC_STORE, "readwrite");
    tx.objectStore(SYNC_STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function bumpAttempt(id, attempts) {
  const db = await openSyncDb();
  return new Promise((resolve) => {
    const tx = db.transaction(SYNC_STORE, "readwrite");
    const store = tx.objectStore(SYNC_STORE);
    const getReq = store.get(id);
    getReq.onsuccess = () => {
      const rec = getReq.result;
      if (rec) { rec.attempts = attempts; store.put(rec); }
      resolve();
    };
    getReq.onerror = () => resolve();
  });
}

// ── Replay queue: exponential-ish retry, drop after 5 attempts ──────────────
const MAX_ATTEMPTS = 5;

async function replayQueuedMutations() {
  const items = await getQueuedMutations();
  let succeeded = 0;
  let failed = 0;

  for (const item of items) {
    try {
      const res = await fetch(item.url, {
        method: item.method,
        headers: item.headers,
        body: item.body || undefined,
        credentials: "include",
      });
      if (res.ok || (res.status >= 400 && res.status < 500)) {
        // Success OR client-error (don't retry 4xx — bad payload).
        await deleteQueuedMutation(item.id);
        succeeded++;
      } else {
        const next = (item.attempts ?? 0) + 1;
        if (next >= MAX_ATTEMPTS) {
          await deleteQueuedMutation(item.id);
        } else {
          await bumpAttempt(item.id, next);
        }
        failed++;
      }
    } catch {
      const next = (item.attempts ?? 0) + 1;
      if (next >= MAX_ATTEMPTS) {
        await deleteQueuedMutation(item.id);
      } else {
        await bumpAttempt(item.id, next);
      }
      failed++;
    }
  }

  if (succeeded > 0) {
    broadcast({ type: "MUTATIONS_REPLAYED", succeeded, failed });
  }
}

self.addEventListener("sync", (event) => {
  if (event.tag === SYNC_TAG) {
    event.waitUntil(replayQueuedMutations());
  }
});

// Manual trigger from clients (used as fallback when Background Sync
// isn't available — e.g. Safari, Firefox).
self.addEventListener("message", (event) => {
  if (event.data?.type === "REPLAY_QUEUE") {
    event.waitUntil?.(replayQueuedMutations());
    replayQueuedMutations();
  }
});

function broadcast(message) {
  self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
    for (const client of clients) client.postMessage(message);
  });
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

// Trigger a queue replay whenever connectivity is restored.
self.addEventListener("online", () => { replayQueuedMutations(); });
