// =================================================================
// sfx.js — sound-effect player for assets/sounds/*.mp3
//   Uses the WEB AUDIO API: each clip is fetched + decoded ONCE into an
//   AudioBuffer, then played through a throwaway BufferSource node every
//   time. Those nodes are tiny and auto-released, so — unlike <audio>
//   elements — they never pile up and hit the browser's media limit.
//   That's what made sounds die after a while; this version never does.
//
//   window.fwSfx(file, volume)   // e.g. fwSfx('ak47', 0.5)
//
//   (Needs to be served over http/https — the deployed site or PLAY.bat.
//    A raw file:// double-click can't fetch the clips; that's expected.)
// =================================================================
(function () {
  'use strict';

  // every clip we ship, so we can decode them up-front for instant playback
  const FILES = ['ak47', 'm40', 'deagle', 'fartbubu', 'baldur', 'fartol', 'fartit', 'popof', 'fito'];
  const buffers = {};      // file -> AudioBuffer
  const pending = {};      // file -> true while fetching/decoding
  let ctx = null;

  function getCtx() {
    if (ctx) return ctx;
    try {
      ctx = (window.ensureAudio && window.ensureAudio()) ||
            new (window.AudioContext || window.webkitAudioContext)();
    } catch (_) { ctx = null; }
    return ctx;
  }

  function loadFile(f) {
    const c = getCtx();
    if (!c || buffers[f] || pending[f]) return;
    pending[f] = true;
    fetch('assets/sounds/' + f + '.mp3')
      .then(r => r.ok ? r.arrayBuffer() : Promise.reject())
      .then(ab => c.decodeAudioData(ab))
      .then(buf => { buffers[f] = buf; pending[f] = false; })
      .catch(() => { pending[f] = false; });
  }

  function preloadAll() { const c = getCtx(); if (c) FILES.forEach(loadFile); }

  // Decode early; also resume the context on the first user gesture (the
  // browser keeps audio suspended until you interact with the page).
  setTimeout(preloadAll, 600);
  function wake() {
    const c = getCtx();
    if (c && c.state === 'suspended') { try { c.resume(); } catch (_) {} }
    preloadAll();
  }
  window.addEventListener('pointerdown', wake, true);
  window.addEventListener('keydown', wake, true);

  window.fwSfx = function (file, vol) {
    if (!file) return;
    const c = getCtx();
    if (!c) return;
    try { if (c.state === 'suspended') c.resume(); } catch (_) {}
    const buf = buffers[file];
    if (!buf) { loadFile(file); return; }     // not decoded yet — plays next time
    try {
      const src = c.createBufferSource();
      src.buffer = buf;
      const g = c.createGain();
      g.gain.value = (vol == null ? 0.6 : vol);
      src.connect(g); g.connect(c.destination);
      src.start(0);
      // BufferSource is one-shot and self-releases when it finishes
    } catch (_) {}
  };
})();
