const CACHE_NAME   = "faslbook-v2-cache";
const STATIC_CACHE = "faslbook-static-v2";

const STATIC_ASSETS = [
  "/",
  "/overview",
  "/login",
  "/manifest.json",
  "/icon-192.png",
  "/icon-512.png",
];

// ── Install: cache static assets ──────────────────────────────────────────
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) =>
      cache.addAll(STATIC_ASSETS).catch((err) => {
        console.log("SW cache addAll partial error:", err);
      })
    )
  );
  self.skipWaiting();
});

// ── Activate: clean up old caches ─────────────────────────────────────────
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k !== CACHE_NAME && k !== STATIC_CACHE)
          .map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// ── Fetch: serve from cache, fall back to network ─────────────────────────
self.addEventListener("fetch", (event) => {
  const { request } = event;

  if (request.method !== "GET") return;

  // Let Firebase SDK handle its own network requests
  if (
    request.url.includes("firestore.googleapis.com") ||
    request.url.includes("identitytoolkit.googleapis.com") ||
    request.url.includes("securetoken.googleapis.com") ||
    request.url.includes("firebase.googleapis.com") ||
    request.url.includes("storage.googleapis.com")
  ) {
    return;
  }

  // Navigation: network first, cache fallback
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          return response;
        })
        .catch(() =>
          caches.match(request).then((cached) =>
            cached || caches.match("/overview") || caches.match("/")
          )
        )
    );
    return;
  }

  // Static assets: cache first, network fallback
  if (
    request.url.includes("/_next/static") ||
    request.url.includes(".png") ||
    request.url.includes(".jpg") ||
    request.url.includes(".ico") ||
    request.url.includes(".svg") ||
    request.url.includes(".woff") ||
    request.url.includes(".css")
  ) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((response) => {
            if (response.ok) {
              const clone = response.clone();
              caches.open(STATIC_CACHE).then((cache) => cache.put(request, clone));
            }
            return response;
          })
      )
    );
    return;
  }
});

// ── Push notifications ─────────────────────────────────────────────────────
self.addEventListener("push", (event) => {
  if (!event.data) return;
  const data = event.data.json();
  const { title, body, icon, data: notifData } = data;

  event.waitUntil(
    self.registration.showNotification(title || "FaslBook", {
      body:               body || "",
      icon:               icon || "/icon-192.png",
      badge:              "/icon-192.png",
      data:               notifData || {},
      vibrate:            [200, 100, 200],
      requireInteraction: false,
    })
  );
});

// ── Notification click ─────────────────────────────────────────────────────
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: "window" }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes("/overview") && "focus" in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) return clients.openWindow("/overview");
    })
  );
});
