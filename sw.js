// ============================================================
// sw.js — KILL-SWITCH
// ============================================================
// The previous service worker intercepted every same-origin GET and
// occasionally served stale / wrong content that interfered with the
// Phantom wallet integration. This replacement does three things:
//
//   1. Takes control immediately (skipWaiting + clients.claim).
//   2. Deletes every cache the old SW created.
//   3. Unregisters itself, then reloads any open client tabs once so
//      they're no longer controlled by a service worker at all.
//
// After this lands, fresh visitors get no service worker, and any user
// who had the old broken SW gets it auto-removed on their next visit.
// ============================================================

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    // Wipe all caches
    try {
      const keys = await caches.keys();
      await Promise.all(keys.map(k => caches.delete(k)));
    } catch (_) {}

    // Take control so we can unregister
    try { await self.clients.claim(); } catch (_) {}

    // Unregister this SW
    try { await self.registration.unregister(); } catch (_) {}

    // Reload every controlled tab so they're no longer SW-controlled
    try {
      const clients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const client of clients) {
        try { client.navigate(client.url); } catch (_) {}
      }
    } catch (_) {}
  })());
});

// Pass through every fetch — never intercept.
self.addEventListener("fetch", () => {});
