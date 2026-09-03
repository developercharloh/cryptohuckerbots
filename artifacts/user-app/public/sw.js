const CACHE_NAME = "vixus-shell-v9";

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => (key.startsWith("vixus-ai-shell-") || key.startsWith("vixus-shell-")) && key !== CACHE_NAME)
          .map((key) => caches.delete(key)),
      ),
    ).then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request, { cache: "no-store" })
        .then((response) => response)
        .catch(() => caches.match(request).then((cached) => cached ?? caches.match("./index.html"))),
    );
    return;
  }

  if (url.pathname.includes("/assets/") || url.pathname.endsWith("/manifest.webmanifest")) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // A missing hashed asset must never be cached as the SPA HTML shell.
          // Otherwise one stale chunk can keep breaking every later reload.
          const contentType = response.headers.get("content-type") ?? "";
          if (contentType.includes("text/html")) {
            void caches.open(CACHE_NAME).then((cache) => cache.delete(request));
            return new Response(null, { status: 404, statusText: "Asset not found" });
          }
          if (response.ok) {
            const copy = response.clone();
            void caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          } else {
            void caches.open(CACHE_NAME).then((cache) => cache.delete(request));
          }
          return response;
        })
        .catch(() =>
          caches.match(request).then(
            (cached) => cached ?? new Response(null, { status: 503, statusText: "Offline" }),
          ),
        ),
    );
  }
});