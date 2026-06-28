// Quantum FX Bot — Admin Service Worker
// Handles background push notifications for login, deposit, and withdrawal events

self.addEventListener("push", (event) => {
  const defaults = {
    title: "Quantum FX Admin",
    body: "New activity",
    icon: self.registration.scope + "favicon.svg",
    tag: "qfx-admin",
    data: {},
  };

  let payload = defaults;
  try {
    if (event.data) payload = { ...defaults, ...event.data.json() };
  } catch { /* use defaults */ }

  const icon = payload.icon || defaults.icon;

  event.waitUntil(
    Promise.all([
      // 1. Show OS-level notification (works even when browser is closed)
      self.registration.showNotification(payload.title, {
        body: payload.body,
        icon,
        badge: self.registration.scope + "favicon.svg",
        tag: payload.tag ?? "qfx-admin",
        renotify: true,
        requireInteraction: false,
        // Vibrate pattern for mobile: buzz-pause-buzz-pause-long-buzz
        vibrate: [200, 100, 200, 100, 400],
        silent: false,
        data: payload.data ?? {},
      }),

      // 2. Message any open admin-app windows to play the custom alarm sound.
      //    Chrome allows AudioContext.resume() from SW postMessage events, so
      //    the page can play audio even when it's in the background.
      self.clients
        .matchAll({ type: "window", includeUncontrolled: true })
        .then((clients) => {
          for (const client of clients) {
            client.postMessage({ type: "QFX_PLAY_SOUND", payload });
          }
        }),
    ])
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        // Focus an existing admin window if one is open
        for (const client of clientList) {
          if (client.url.includes(self.registration.scope) && "focus" in client) {
            return client.focus();
          }
        }
        // Otherwise open the admin panel
        return self.clients.openWindow(self.registration.scope);
      })
  );
});

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));
