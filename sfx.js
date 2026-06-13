// =================================================================
// sfx.js — tiny sound-effect player for assets/sounds/*.mp3
//   Uses a small REUSED pool of <audio> elements per file instead of
//   cloning a new element on every play. Cloning leaks media elements
//   (browsers cap how many can exist) — after a while ALL audio dies.
//   A bounded pool fixes that: a handful of elements, recycled forever,
//   so overlapping shots still work and nothing ever stops playing.
//   Works on file://, a local server, and the deployed site (no fetch).
//
//   window.fwSfx(file, volume)   // e.g. fwSfx('ak47', 0.5)
// =================================================================
(function () {
  'use strict';
  const POOL_SIZE = 6;        // max simultaneous copies of one sound
  const pools = {};          // file -> [HTMLAudioElement, ...]

  window.fwSfx = function (file, vol) {
    if (!file) return;
    try {
      let pool = pools[file];
      if (!pool) {
        pool = [];
        for (let i = 0; i < POOL_SIZE; i++) {
          const a = new Audio('assets/sounds/' + file + '.mp3');
          a.preload = 'auto';
          pool.push(a);
        }
        pools[file] = pool;
      }
      // grab an idle/finished element; if all are busy, recycle the first
      let a = pool.find(x => x.paused || x.ended) || pool[0];
      a.volume = (vol == null ? 0.6 : vol);
      try { a.currentTime = 0; } catch (_) {}
      a.play().catch(() => {});
    } catch (_) {}
  };
})();
