// ============================================================
// sw.js — Service worker for the $FARTPRINT PWA
// ============================================================
// Minimal, network-first strategy. We're a Solana ecosystem app —
// almost every request needs the network for fresh on-chain data,
// so we pass through fetches and only cache static shell files for
// install-on-home-screen support.
//
// Bumping CACHE_VERSION will purge old caches on next activate.
// ============================================================

const CACHE_VERSION = "fp-v1";
const APP_SHELL = [
  "./",
  "./index.html",
  "./logo.png",
  "./manifest.json",
  "./mwa-shim.js",
];

self.addEventListener("install", (event) => {
  // Pre-cache the shell so the app can launch from the home screen offline
  event.waitUntil(
    caches.open(CACHE_VERSION)
      .then((cache) => cache.addAll(APP_SHELL).catch(() => {}))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  // Only handle GETs; never cache cross-origin RPC/API calls.
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  // Don't cache API endpoints — always fresh on-chain state.
  if (url.pathname.startsWith("/api/")) return;

  // Network-first with cache fallback (so a tab that opens offline still
  // gets the last-known HTML shell).
  event.respondWith(
    fetch(req)
      .then((res) => {
        // Don't pollute the cache with 4xx/5xx responses.
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put(req, copy).catch(()=>{}));
        }
        return res;
      })
      .catch(() => caches.match(req).then((cached) => cached || caches.match("./index.html")))
  );
});
