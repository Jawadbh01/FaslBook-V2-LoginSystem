// FaslBook Service Worker
// Strategy:
//   - Navigation (HTML pages)  → network-first, cache 200 OK responses, serve cache when offline
//   - Next.js static chunks    → cache-first, network fallback
//   - Firebase API calls       → bypass entirely (Firebase SDK manages its own offline queue)
//   - Everything else          → network-first, cache 200 OK

const CACHE_NAME   = "faslbook-pages-v3";
const STATIC_CACHE = "faslbook-static-v3";

// Only cache true static files at install time — NOT SSR pages (they redirect or need auth)
const INSTALL_ASSETS = [
  "/manifest.json",
  "/icon-192.png",
  "/icon-512.png",
  "/logo.png",
];

// ── Install ────────────────────────────────────────────────────────────────
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) =>
      Promise.allSettled(
        INSTALL_ASSETS.map((url) =>
          fetch(url).then((res) => {
            if (res.ok) return cache.put(url, res);
          }).catch(() => {})
        )
      )
    )
  );
  // Take control immediately — don't wait for old SW to release
  self.skipWaiting();
});

// ── Activate ───────────────────────────────────────────────────────────────
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

// ── Helpers ────────────────────────────────────────────────────────────────
function isFirebaseUrl(url) {
  return (
    url.includes("firestore.googleapis.com") ||
    url.includes("identitytoolkit.googleapis.com") ||
    url.includes("securetoken.googleapis.com") ||
    url.includes("firebase.googleapis.com") ||
    url.includes("storage.googleapis.com") ||
    url.includes("firebaseio.com") ||
    url.includes("googleapis.com/identitytoolkit")
  );
}

function isStaticAsset(url) {
  return (
    url.includes("/_next/static/") ||
    url.includes("/_next/image") ||
    /\.(png|jpg|jpeg|gif|webp|ico|svg|woff|woff2|ttf|eot|css)(\?|$)/.test(url)
  );
}

// Cache a response only if it's a real successful response (not a redirect)
function cacheResponse(cacheName, request, response) {
  if (response && response.ok && response.status === 200) {
    caches.open(cacheName).then((cache) => cache.put(request, response.clone()));
  }
}

// ── Fetch ──────────────────────────────────────────────────────────────────
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = request.url;

  // Only handle GET
  if (request.method !== "GET") return;

  // Let Firebase manage its own requests (it has built-in offline support)
  if (isFirebaseUrl(url)) return;

  // ── Next.js static assets: cache-first ──────────────────────────────────
  if (isStaticAsset(url)) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          cacheResponse(STATIC_CACHE, request, response);
          return response;
        });
      })
    );
    return;
  }

  // ── Navigation (HTML pages): network-first, cache fallback ───────────────
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Only cache real 200 OK HTML — not redirects (302) or errors
          cacheResponse(CACHE_NAME, request, response);
          return response;
        })
        .catch(async () => {
          // Offline — try exact URL first, then strip query params, then any cached page
          const exact = await caches.match(request);
          if (exact) return exact;

          const stripped = await caches.match(request.url.split("?")[0]);
          if (stripped) return stripped;

          // Last resort: serve the overview page (the "app shell")
          const overview = await caches.match("/overview");
          if (overview) return overview;

          // Nothing cached at all — return a minimal offline page
          return new Response(
            `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>FaslBook — Offline</title>
  <style>
    body { margin: 0; font-family: sans-serif; display: flex; flex-direction: column;
           align-items: center; justify-content: center; min-height: 100vh;
           background: #fff; color: #374151; text-align: center; gap: 16px; }
    h1 { font-size: 20px; margin: 0; }
    p  { font-size: 14px; color: #6b7280; margin: 0; }
    button { margin-top: 8px; padding: 10px 24px; background: #1B5E20; color: #fff;
             border: none; border-radius: 8px; font-size: 15px; cursor: pointer; }
  </style>
</head>
<body>
  <h1>You're offline</h1>
  <p>FaslBook couldn't connect. Please check your internet connection.</p>
  <button onclick="window.location.reload()">Try Again</button>
</body>
</html>`,
            { status: 200, headers: { "Content-Type": "text/html" } }
          );
        })
    );
    return;
  }

  // ── All other GET requests: network-first, cache fallback ────────────────
  event.respondWith(
    fetch(request)
      .then((response) => {
        cacheResponse(CACHE_NAME, request, response);
        return response;
      })
      .catch(() => caches.match(request))
  );
});

// ── Push notifications ─────────────────────────────────────────────────────
self.addEventListener("push", (event) => {
  if (!event.data) return;
  let data = {};
  try { data = event.data.json(); } catch {}

  event.waitUntil(
    self.registration.showNotification(data.title || "FaslBook", {
      body:               data.body  || "",
      icon:               data.icon  || "/icon-192.png",
      badge:              "/icon-192.png",
      data:               data.data  || {},
      vibrate:            [200, 100, 200],
      requireInteraction: false,
    })
  );
});

// ── Notification click ─────────────────────────────────────────────────────
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: "window" }).then((list) => {
      for (const c of list) {
        if ("focus" in c) return c.focus();
      }
      if (clients.openWindow) return clients.openWindow("/overview");
    })
  );
});
