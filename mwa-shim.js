// ============================================================
// mwa-shim.js — Mobile wallet bridge (Phantom Mobile deep-link)
// ============================================================
// Two jobs:
//
//   1. CLEAN UP — if an old service worker is registered (a previous
//      version of this site shipped one that broke wallet flows), unregister
//      it and clear all caches. Runs on every page load so stale SWs get
//      auto-removed without any user action.
//
//   2. MOBILE WALLET BRIDGE — on mobile browsers (Android Chrome, Solana
//      Saga, iOS Safari) where `window.phantom.solana` doesn't exist,
//      install a Phantom-shaped facade. When the user clicks Connect, it
//      deep-links into Phantom Mobile's in-app browser pointed at the
//      current URL. Inside Phantom Mobile, the real provider is injected
//      and every app keeps working unchanged.
//
// This file is a no-op on desktop and inside Phantom Mobile's dApp browser
// (its injected provider wins over our facade).
// ============================================================

(function () {
  "use strict";

  // ────────────────────────────────────────────────────────────────
  // Clean up any old service worker (previous versions shipped one
  // that intercepted requests and broke Phantom). Best-effort — never
  // blocks anything else.
  // ────────────────────────────────────────────────────────────────
  if ("serviceWorker" in navigator) {
    try {
      navigator.serviceWorker.getRegistrations()
        .then(function (regs) {
          regs.forEach(function (r) {
            try { r.unregister(); } catch (_) {}
          });
        })
        .catch(function () {});
    } catch (_) {}
    if (window.caches && caches.keys) {
      try {
        caches.keys()
          .then(function (keys) { keys.forEach(function (k) { try { caches.delete(k); } catch (_) {} }); })
          .catch(function () {});
      } catch (_) {}
    }
  }

  // ────────────────────────────────────────────────────────────────
  // Mobile wallet bridge — only relevant on mobile browsers.
  // ────────────────────────────────────────────────────────────────
  var ua = (navigator.userAgent || "").toLowerCase();
  var isMobile = /mobi|android|iphone|ipod|silk|kindle/.test(ua);
  if (!isMobile) return;

  function install() {
    // Real Phantom (injected by the extension or by Phantom Mobile's
    // dApp browser) wins over our facade.
    if (window.phantom && window.phantom.solana) return;
    if (window.solana && window.solana.isPhantom) return;

    var here = window.location.href.split("#")[0];
    var ref  = window.location.origin;
    var deepLink =
      "https://phantom.app/ul/browse/" + encodeURIComponent(here) +
      "?ref=" + encodeURIComponent(ref);

    var facade = {
      isPhantom: true,
      isPhantomMobileShim: true,
      publicKey: null,

      connect: function () {
        try { window.location.assign(deepLink); }
        catch (e) { window.location.href = deepLink; }
        return new Promise(function () {});
      },
      disconnect: function () { return Promise.resolve(); },
      signTransaction: function () {
        return Promise.reject(new Error("Open this site in Phantom Mobile to sign transactions."));
      },
      signAndSendTransaction: function () {
        return Promise.reject(new Error("Open this site in Phantom Mobile to send transactions."));
      },
      signMessage: function () {
        return Promise.reject(new Error("Open this site in Phantom Mobile to sign messages."));
      },
      on:  function () {},
      off: function () {},
      request: function () {
        return Promise.reject(new Error("Open in Phantom Mobile to interact."));
      },
    };

    window.phantom = window.phantom || {};
    if (!window.phantom.solana) window.phantom.solana = facade;
    if (!window.solana)         window.solana         = facade;
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", install, { once: true });
  } else {
    install();
  }
})();
