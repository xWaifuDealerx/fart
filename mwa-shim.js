// ============================================================
// mwa-shim.js — Mobile Wallet Adapter / Phantom Mobile bridge
// ============================================================
// Loaded by every page in the $FARTPRINT ecosystem. Two jobs:
//
//   1. On mobile browsers (Android Chrome, Solana Saga, iOS Safari) where
//      `window.phantom.solana` doesn't exist, install a Phantom-shaped
//      facade that, when `connect()` is called, deep-links the user into
//      Phantom Mobile's in-app browser pointed at this very page.
//      Inside Phantom Mobile, the real `window.phantom.solana` is
//      injected by Phantom itself and every app continues working
//      without any code changes.
//
//   2. Register the service worker (`sw.js`) so the site becomes a
//      proper Progressive Web App — installable on Solana Saga's home
//      screen, with the right theme color, name, and icon from
//      `manifest.json`.
//
// This file is a no-op on desktop (extension wallets keep working) and
// inside Phantom Mobile's dApp browser (its injected provider wins).
//
// Wallet Standard / MWA-native wallets (e.g. installed on Solana
// Mobile Stack) register themselves to `window.solana` automatically;
// this shim does not touch them.
// ============================================================

(function () {
  "use strict";

  // ────────────────────────────────────────────────────────────────
  // PWA: register the service worker on every page that loads us.
  // ────────────────────────────────────────────────────────────────
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", function () {
      navigator.serviceWorker.register("sw.js").catch(function () {
        // Ignore — service worker is optional. PWA install still works
        // on hosts that don't allow SW (e.g. file://) but offline shell
        // won't be cached.
      });
    });
  }

  // ────────────────────────────────────────────────────────────────
  // Wallet bridge: only relevant on mobile browsers.
  // ────────────────────────────────────────────────────────────────
  var ua = (navigator.userAgent || "").toLowerCase();
  var isMobile = /mobi|android|iphone|ipad|ipod|silk|kindle/.test(ua);
  if (!isMobile) return;

  // Defer until the document is interactive so existing apps can read
  // `window.phantom.solana` synchronously and find our facade.
  function install() {
    // Phantom (real, injected) wins over our facade.
    if (window.phantom && window.phantom.solana) return;
    if (window.solana && window.solana.isPhantom) return;

    // Build the deep link that opens Phantom Mobile pointed at this
    // page's URL. Phantom's docs:
    //   https://docs.phantom.app/developer-powertools/deeplinks#browse
    var here = window.location.href.split("#")[0];
    var ref  = window.location.origin;
    var deepLink =
      "https://phantom.app/ul/browse/" + encodeURIComponent(here) +
      "?ref=" + encodeURIComponent(ref);

    // A Phantom-shaped facade. The only operation that actually does
    // anything is `connect()`, which redirects the browser into
    // Phantom Mobile's in-app browser at this URL. Once inside,
    // Phantom injects the real provider and the rest of the app
    // continues normally.
    var facade = {
      isPhantom: true,
      isPhantomMobileShim: true,    // for any code that wants to detect us
      publicKey: null,

      connect: function () {
        // Open Phantom Mobile, return a never-resolving promise so the
        // caller doesn't try to use a null publicKey before navigation.
        try { window.location.assign(deepLink); }
        catch (e) { window.location.href = deepLink; }
        return new Promise(function () {});
      },
      disconnect: function () { return Promise.resolve(); },

      // These should not be invoked in this state because connect()
      // navigates away. We provide them so any optimistic call still
      // surfaces a clear error message.
      signTransaction: function () {
        return Promise.reject(new Error(
          "Open this site in Phantom Mobile to sign transactions."
        ));
      },
      signAndSendTransaction: function () {
        return Promise.reject(new Error(
          "Open this site in Phantom Mobile to send transactions."
        ));
      },
      signMessage: function () {
        return Promise.reject(new Error(
          "Open this site in Phantom Mobile to sign messages."
        ));
      },
      on: function () {},
      off: function () {},
      request: function () {
        return Promise.reject(new Error("Open in Phantom Mobile to interact."));
      },
    };

    window.phantom = window.phantom || {};
    if (!window.phantom.solana) window.phantom.solana = facade;
    if (!window.solana)         window.solana         = facade;

    // Soft hint for UI: dispatch a custom event so apps can show
    // "Open in Phantom Mobile" labelling if they want to.
    try {
      window.dispatchEvent(new CustomEvent("fartprint-mobile-shim-ready", {
        detail: { deepLink: deepLink }
      }));
    } catch (_) {}
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", install, { once: true });
  } else {
    install();
  }
})();
