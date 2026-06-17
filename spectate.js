// =================================================================
// spectate.js — Spectator mode. From the title screen "👁 Spectate" enters
// the world as an invisible watcher and rides whichever player you pick:
//   • real players in the room (Net.peers)
//   • the simulated players Toiletcarta & Skibidireaper (fwPrinterBots)
// Left mouse = next player, right mouse = previous (also on-screen ‹ › ).
// Zoom in (scroll) to see their view in first person, exactly like playing.
//
// It works by pinning the game's own camera-target (Player.pos) to the
// spectated entity each frame — so the existing follow-cam + scroll-to-FPS
// just work, with our own printer hidden.
// =================================================================
(function () {
  'use strict';
  function whenReady() {
    if (!window.State || !document.getElementById('skipBtn')) { setTimeout(whenReady, 400); return; }
    init();
  }
  whenReady();

  function init() {
    let active = false;
    let idx = 0;
    let targets = [];

    function collectTargets() {
      const list = [];
      try {
        const peers = window.Net && window.Net.peers;
        if (peers && peers.forEach) peers.forEach((p) => { if (p && p.mesh) list.push({ kind: 'peer', name: p.name || 'Player', obj: p }); });
      } catch (_) {}
      try {
        const bots = window.fwPrinterBots || [];
        for (const b of bots) { if (b && b.mesh && !b.dead) list.push({ kind: 'bot', name: b.name || 'Bot', obj: b }); }
      } catch (_) {}
      return list;
    }
    function targetPos(t) {
      const o = t.obj;
      if (t.kind === 'peer') {
        const m = o.mesh;
        return { x: m.position.x, y: m.position.y, z: m.position.z, yaw: (o.tyaw != null ? o.tyaw : m.rotation.y) || 0, walking: !!o.walking };
      }
      return { x: o.x, y: o.mesh ? o.mesh.position.y : 0, z: o.z, yaw: o.yaw || 0, walking: !!o.walking };
    }

    // current target → exposed so the game's movement step pins the camera to it
    window.fwSpectateTarget = function () {
      if (!active || !targets.length) return null;
      const t = targets[idx]; if (!t) return null;
      // a despawned target (peer left / bot died) → drop it
      if (t.kind === 'bot' && t.obj.dead) { targets = collectTargets(); if (idx >= targets.length) idx = 0; return targets.length ? targetPos(targets[idx]) : null; }
      return targetPos(t);
    };

    // ── HUD bar ──
    const css = document.createElement('style');
    css.textContent = `
.spec-bar{position:fixed;top:14px;left:50%;transform:translateX(-50%);z-index:130;display:none;align-items:center;gap:14px;
  background:rgba(8,14,26,.92);border:2px solid rgba(124,170,255,.6);border-radius:12px;padding:8px 14px;
  font-family:'Outfit','Inter',sans-serif;color:#eaf1ff;box-shadow:0 8px 20px rgba(0,0,0,.5)}
.spec-bar.show{display:flex}
.spec-bar .who{font-family:'Bangers','Orbitron',sans-serif;font-size:18px;letter-spacing:1px;color:#a8c8ff;line-height:1}
.spec-bar .hint{font-size:10.5px;color:rgba(220,235,255,.6);margin-top:2px}
.spec-bar .nav{background:rgba(124,170,255,.2);border:1px solid rgba(124,170,255,.5);color:#cfe0ff;border-radius:8px;padding:6px 11px;cursor:pointer;font-weight:800;font-size:12px;pointer-events:auto}
.spec-bar .nav:hover{background:rgba(124,170,255,.35)}
.spec-bar .exit{background:rgba(255,90,90,.18);border-color:rgba(255,90,90,.5);color:#ff9a9a}
`;
    document.head.appendChild(css);
    const bar = document.createElement('div');
    bar.className = 'spec-bar';
    bar.innerHTML =
      '<button class="nav" id="specPrev">‹</button>' +
      '<div style="text-align:center"><div class="who" id="specWho">—</div>' +
      '<div class="hint">Left-click / ‹ › : switch player · scroll in for first-person · Esc to exit</div></div>' +
      '<button class="nav" id="specNext">›</button>' +
      '<button class="nav exit" id="specExit">Exit</button>';
    document.body.appendChild(bar);

    function setIdx(n) {
      if (!targets.length) { document.getElementById('specWho').textContent = '👁 No players to watch yet…'; return; }
      idx = ((n % targets.length) + targets.length) % targets.length;
      document.getElementById('specWho').textContent = '👁 ' + targets[idx].name;
    }
    document.getElementById('specPrev').addEventListener('click', (e) => { e.stopPropagation(); setIdx(idx - 1); });
    document.getElementById('specNext').addEventListener('click', (e) => { e.stopPropagation(); setIdx(idx + 1); });
    document.getElementById('specExit').addEventListener('click', (e) => { e.stopPropagation(); try { location.reload(); } catch (_) {} });

    window.fwStartSpectate = function () {
      if (active) return;
      // Boot the world exactly like a guest, then take the camera over.
      try { if (typeof window.enterLobby === 'function') window.enterLobby(); } catch (_) {}
      window.fwSpectating = true;
      active = true;
      bar.classList.add('show');
      // Hide our own printer + name tag; we're an invisible watcher.
      const hide = () => { try { if (window.printer) window.printer.visible = false; } catch (_) {} };
      hide(); setTimeout(hide, 400); setTimeout(hide, 1200);
      // Keep the target list fresh (players join/leave, bots respawn).
      setInterval(() => {
        targets = collectTargets();
        if (idx >= targets.length) idx = 0;
        if (targets.length && !document.getElementById('specWho').textContent.includes(targets[idx].name)) setIdx(idx);
        if (!targets.length) setIdx(0);
      }, 1500);
      targets = collectTargets();
      setIdx(0);
    };

    // Mouse buttons cycle players while spectating (left = next, right = prev).
    window.addEventListener('mousedown', (e) => {
      if (!active) return;
      if (e.target && e.target.closest && e.target.closest('.spec-bar, .hud-card, button, input, .mm-root')) return;
      if (e.button === 0) { setIdx(idx + 1); }
      else if (e.button === 2) { e.preventDefault(); setIdx(idx - 1); }
    }, true);
    window.addEventListener('contextmenu', (e) => { if (active) e.preventDefault(); }, true);

    console.log('[spectate] ready — 👁 Spectate button installed');
  }
})();
