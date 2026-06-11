// =================================================================
// controls.js — Action control scheme + Settings menu.
//
//  ACTION SCHEME (default):
//    • Mouse-look without holding a button (pointer lock — click the
//      world once to grab the mouse, Esc to release it)
//    • LMB  = shoot (Desert Eagle / deathmatch weapons)
//    • RMB  = hold to aim (FOV zoom + slower sensitivity)
//    • Wheel = zoom; all the way in = FPS mode (printer hidden),
//      zoom out to see the printer again
//  CLASSIC SCHEME: the original controls (LMB-drag to look,
//    RMB to shoot) — selectable in Settings.
//
//  SETTINGS (⚙ button below the 🏆 leaderboard button):
//    control scheme · brightness · quality (High End / Performance)
// =================================================================
(function(){
  'use strict';

  // ── Persisted settings ──
  const KEY = 'fw.settings.v1';
  const DEFAULTS = { scheme: 'action', brightness: 100, contrast: 100, glow: 100, quality: 'perf', gamepad: false };
  let S = { ...DEFAULTS };
  try { S = Object.assign({}, DEFAULTS, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch(_){}
  function save(){ try { localStorage.setItem(KEY, JSON.stringify(S)); } catch(_){} }
  // Other modules (gunsmith fire-button mapping) read this:
  window.FWSettings = S;

  function whenReady(){
    if(!window.THREE || !window.Cam || !window.camera || !window.Player || !document.getElementById('canvas')){
      setTimeout(whenReady, 250);
      return;
    }
    init();
  }
  whenReady();

  function init(){
    const THREE  = window.THREE;
    const Cam    = window.Cam;
    const camera = window.camera;
    const Player = window.Player;
    const canvas = document.getElementById('canvas');
    // Signal that the pointer-lock controls are actually running —
    // gunsmith.js only switches the fire button to LMB when this is set,
    // so shooting can never break if this module fails to boot.
    window.FWControlsActive = true;

    // ────────────────────────────────────────────────────────────
    // ACTION SCHEME — pointer lock mouse-look
    // ────────────────────────────────────────────────────────────
    let aiming = false;
    let vDist = Cam.distance;          // our own zoom value (1.15 → 20)
    const FPS_AT = 2.1;                // distance below this = FPS mode

    const locked = () => document.pointerLockElement === canvas;
    const anyModalOpen = () => {
      if(document.querySelector(
        '.bank-bg.show, .stor-bg.show, .dc-bg.show, .est-bg.show, .junk-bg.show, '
        + '.junk-choose-bg.show, .wave-bg.show, .gary-bg.show, .hot-bg.show, .apt-bg.show, '
        + '#invBg.show, #marketBg.show, #poopBg.show, .gs-bg.show, .fc-bg.show, '
        + '.carlos-bg.show, .roki-bg.show, .wr-bg.show, .fw-case-bg.show, .uname-bg.show, '
        + '.casino-bg.show, #lbBg.show, .fw-set-bg.show, #login:not(.hidden), '
        + '#seedChBg.show, #paySelBg.show, #labBg.show, #millBg.show, #goldBg.show, '
        + '#swapBg.show, #bowlBg.show, #launderBg.show, #pfBg.show, #junkBg.show, #bankBg.show, '
        + '.fw-rest.show, .cas-bg.show, .fw-msn-bg.show, .fw-skill-bg.show'
      )) return true;
      // Deathmatch waiting panel = a menu with buttons → release the mouse
      const dmw = document.getElementById('dmWaiting');
      if(dmw && dmw.style.display !== 'none' &&
         document.getElementById('dmOverlay')?.classList.contains('show')) return true;
      return false;
    };

    // Click the world → grab the mouse (action scheme only)
    canvas.addEventListener('mousedown', (e) => {
      if(S.scheme !== 'action') return;
      if(e.button !== 0) return;
      if(locked() || anyModalOpen()) return;
      const a = document.activeElement;
      if(a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA')) return;
      try { canvas.requestPointerLock(); } catch(_){}
    });

    // ── Virtual aim cursor ──
    // Third person: the mouse moves a DYNAMIC crosshair across the
    // screen (camera follows gently, and turns fully when you push past
    // the inner zone). FPS mode: STATIC centre crosshair, mouse rotates
    // the camera directly. Gun + deathmatch shots fire through it.
    const vAim = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    window.FWAim = vAim;
    document.addEventListener('pointerlockchange', () => {
      vAim.x = window.innerWidth / 2;
      vAim.y = window.innerHeight / 2;
    });

    // Mouse-look while locked
    window.addEventListener('mousemove', (e) => {
      if(S.scheme !== 'action' || !locked()) return;
      const sens = (aiming ? 0.0011 : 0.0023);
      const mx = e.movementX || 0, my = e.movementY || 0;
      const fps = Cam.curDistance < FPS_AT;
      if(fps){
        // FPS: static centre aim, camera rotates directly
        vAim.x = window.innerWidth / 2;
        vAim.y = window.innerHeight / 2;
        Cam.yaw -= mx * sens;
        Cam.pitch = THREE.MathUtils.clamp(Cam.pitch + my * sens, -1.10, 1.25);
      } else {
        // Third person: dynamic cursor + gentle camera follow
        vAim.x = Math.max(0, Math.min(window.innerWidth,  vAim.x + mx));
        vAim.y = Math.max(0, Math.min(window.innerHeight, vAim.y + my));
        Cam.yaw -= mx * sens * 0.45;
        Cam.pitch = THREE.MathUtils.clamp(Cam.pitch + my * sens * 0.45, 0.05, 0.90);
        // Pushing past the inner zone turns the camera fully and the
        // cursor rides the zone edge
        const zx = window.innerWidth * 0.30, zy = window.innerHeight * 0.26;
        const cx = window.innerWidth / 2,  cy = window.innerHeight / 2;
        const ox = vAim.x - cx, oy = vAim.y - cy;
        if(Math.abs(ox) > zx){
          Cam.yaw -= (ox - Math.sign(ox) * zx) * sens;
          vAim.x = cx + Math.sign(ox) * zx;
        }
        if(Math.abs(oy) > zy){
          Cam.pitch = THREE.MathUtils.clamp(Cam.pitch + (oy - Math.sign(oy) * zy) * sens, 0.05, 0.90);
          vAim.y = cy + Math.sign(oy) * zy;
        }
      }
    });

    // RMB = aim (hold)
    window.addEventListener('mousedown', (e) => {
      if(S.scheme !== 'action') return;
      if(e.button === 2 && (locked() || e._fwPad)) aiming = true;
    });
    window.addEventListener('mouseup', (e) => {
      if(e.button === 2) aiming = false;
    });
    document.addEventListener('contextmenu', (e) => {
      if(S.scheme === 'action') e.preventDefault();
    });

    // Wheel zoom 1.15 → 20 (the stock handler clamps ≥4; we run after
    // it and override, which lets the camera continue into FPS range)
    canvas.addEventListener('wheel', (e) => {
      if(S.scheme !== 'action') return;
      vDist = THREE.MathUtils.clamp(vDist + e.deltaY * 0.01, 1.15, 20);
      Cam.distance = vDist;
      e.preventDefault();
    }, { passive: false });

    // Auto-release the pointer when any modal / chat input takes over
    document.addEventListener('focusin', (e) => {
      const t = e.target;
      if(t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA') && locked()){
        try { document.exitPointerLock(); } catch(_){}
      }
    });
    setInterval(() => {
      if(locked() && anyModalOpen()){
        try { document.exitPointerLock(); } catch(_){}
      }
    }, 400);

    // "Click to look around" hint chip (action scheme, unlocked, no modal)
    const hint = document.createElement('div');
    hint.style.cssText = 'position:fixed;left:50%;bottom:84px;transform:translateX(-50%);'
      + "font:600 11.5px 'Outfit',sans-serif;letter-spacing:.6px;color:rgba(230,255,238,.75);"
      + 'background:rgba(5,13,9,.72);border:1px solid rgba(95,240,156,.25);border-radius:100px;'
      + 'padding:6px 16px;z-index:40;pointer-events:none;display:none;backdrop-filter:blur(8px)';
    hint.textContent = '🖱 Click the world to look around · Esc frees the cursor';
    document.body.appendChild(hint);
    setInterval(() => {
      hint.style.display = (S.scheme === 'action' && !locked() && !anyModalOpen()) ? '' : 'none';
    }, 600);

    // ── FPS gun viewmodel — Desert Eagle on the right side ──
    const gunCss = document.createElement('style');
    gunCss.textContent = `
#fwGunVm{position:fixed;right:-1vmin;bottom:-3vmin;width:42vmin;height:34vmin;z-index:38;
  pointer-events:none;display:none;transform-origin:85% 95%;
  filter:drop-shadow(-8px 10px 14px rgba(0,0,0,.55))}
#fwGunVm.show{display:block;animation:fwGunSway 3.2s ease-in-out infinite}
@keyframes fwGunSway{0%,100%{transform:translate(0,0) rotate(0deg)}50%{transform:translate(-4px,7px) rotate(.7deg)}}
#fwGunVm.kick{animation:fwGunKick .12s ease-out}
@keyframes fwGunKick{0%{transform:translate(6px,16px) rotate(5deg)}100%{transform:translate(0,0) rotate(0)}}
`;
    document.head.appendChild(gunCss);
    const gunEl = document.createElement('div');
    gunEl.id = 'fwGunVm';
    gunEl.innerHTML = `<svg viewBox="0 0 420 340" xmlns="http://www.w3.org/2000/svg" width="100%" height="100%">
      <defs>
        <linearGradient id="fwgSlide" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#9aa1ab"/><stop offset=".45" stop-color="#5d646e"/>
          <stop offset=".55" stop-color="#454b54"/><stop offset="1" stop-color="#23272d"/>
        </linearGradient>
        <linearGradient id="fwgFrame" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#4a505a"/><stop offset="1" stop-color="#1c2025"/>
        </linearGradient>
        <linearGradient id="fwgGrip" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#3a2c20"/><stop offset="1" stop-color="#17100a"/>
        </linearGradient>
      </defs>
      <g transform="rotate(-14 210 170)">
        <!-- slide -->
        <rect x="20" y="86" width="320" height="64" rx="10" fill="url(#fwgSlide)"/>
        <rect x="20" y="86" width="320" height="12" rx="6" fill="#aeb6c0" opacity=".5"/>
        <!-- muzzle -->
        <rect x="6" y="98" width="22" height="40" rx="6" fill="#14171b"/>
        <circle cx="17" cy="118" r="9" fill="#000"/>
        <!-- slide serrations -->
        <g fill="#2c3138">
          <rect x="252" y="92" width="7" height="52" rx="2"/><rect x="266" y="92" width="7" height="52" rx="2"/>
          <rect x="280" y="92" width="7" height="52" rx="2"/><rect x="294" y="92" width="7" height="52" rx="2"/>
          <rect x="308" y="92" width="7" height="52" rx="2"/>
        </g>
        <!-- sights -->
        <rect x="36" y="76" width="14" height="14" rx="2" fill="#23272d"/>
        <rect x="318" y="74" width="16" height="16" rx="2" fill="#23272d"/>
        <!-- frame -->
        <path d="M48 150 L340 150 L340 196 L210 196 L196 172 L96 172 L84 150 Z" fill="url(#fwgFrame)"/>
        <!-- trigger guard -->
        <path d="M180 172 q-30 4 -30 34 q0 26 30 28 l16 0 0 -18 -10 0 q-14 -2 -14 -12 q0 -14 18 -14 Z" fill="#23272d"/>
        <!-- trigger -->
        <path d="M196 186 q-10 14 -2 30" stroke="#9aa1ab" stroke-width="9" fill="none" stroke-linecap="round"/>
        <!-- grip -->
        <path d="M236 192 L330 192 L368 318 L290 330 Q262 256 240 214 Z" fill="url(#fwgGrip)"/>
        <path d="M252 210 L322 206 M258 228 L330 224 M266 248 L340 244 M274 268 L348 264 M282 288 L356 284" stroke="#0c0805" stroke-width="5" opacity=".5"/>
        <!-- hammer -->
        <path d="M336 132 l26 -16 10 14 -24 22 Z" fill="#2c3138"/>
      </g>
    </svg>`;
    document.body.appendChild(gunEl);

    // ── Real Desert Eagle model (assets/models/deserteagle.glb) held in
    //    front of the camera. The SVG above is only the fallback while
    //    the GLB loads (or if it fails).
    let gunModel = null;
    let gunRecoil = 0;
    const GUN_BASE = { x: 0.42, y: -0.34, z: -0.95 };
    function tryLoadGunModel(){
      if(!window.FWModels || !window.scene){ setTimeout(tryLoadGunModel, 500); return; }
      try { window.scene.add(camera); } catch(_){}   // camera children need the camera in the graph
      window.FWModels.get('deserteagle').then(m => {
        if(gunModel) return;        // never attach twice (no double guns)
        gunEl.classList.remove('show');
        m.position.set(GUN_BASE.x, GUN_BASE.y, GUN_BASE.z);
        m.rotation.set(0.02, Math.PI + 0.06, 0.02);  // muzzle forward, slightly angled in
        m.traverse(o => { if(o.isMesh){ o.castShadow = false; o.receiveShadow = false; } });
        m.visible = false;
        camera.add(m);
        gunModel = m;
        // quick console tuner: window.fwGunVm.position / .rotation
        window.fwGunVm = m;
        console.log('[controls] deagle viewmodel loaded');
      }).catch(err => console.warn('[controls] deagle viewmodel failed — using fallback', err));
    }
    tryLoadGunModel();

    window.addEventListener('mousedown', (e) => {
      if(e.button !== 0 || !locked()) return;
      gunRecoil = 1;
      if(!gunEl.classList.contains('show')) return;
      gunEl.classList.remove('kick');
      void gunEl.offsetWidth;
      gunEl.classList.add('kick');
      setTimeout(() => gunEl.classList.remove('kick'), 140);
    });

    // ── Camera post-hook (called by updateCamera inside the game
    //    module each frame): aim FOV + FPS mode ──
    let lastFps = false;
    window.fwCameraPost = function(dt){
      // Smooth aim zoom
      const targetFov = aiming ? 38 : 60;
      if(Math.abs(camera.fov - targetFov) > 0.15){
        camera.fov += (targetFov - camera.fov) * Math.min(1, 12 * dt);
        camera.updateProjectionMatrix();
      }
      if(S.scheme !== 'action'){
        gunEl.classList.remove('show');
        if(gunModel) gunModel.visible = false;
        return;
      }
      if(Player.boat){   // vessels own the camera/printer — hide ALL viewmodels
        gunEl.classList.remove('show');
        if(gunModel) gunModel.visible = false;
        return;
      }
      const fps = Cam.curDistance < FPS_AT;
      // Printer visibility follows camera distance
      try { if(window.printer) window.printer.visible = !fps; } catch(_){}
      // FPS gun viewmodel: visible when zoomed in AND armed (owning a
      // Deagle, or any active deathmatch where weapons are unlimited).
      // Prefer the real GLB model; the SVG is only a loading fallback.
      const armed = !window.fwSleeping &&
        ((window.State?.inventory?.deagle > 0 && !window.fwGunHolstered) || (window.Dm?.phase === 'active'));
      if(gunModel){
        gunModel.visible = fps && armed;
        gunEl.classList.remove('show');
        // recoil kick + idle sway
        gunRecoil = Math.max(0, gunRecoil - dt * 7);
        const t = performance.now() / 1000;
        gunModel.position.set(
          GUN_BASE.x + Math.sin(t * 1.7) * 0.006,
          GUN_BASE.y + Math.sin(t * 2.3) * 0.008 - gunRecoil * 0.05,
          GUN_BASE.z + gunRecoil * 0.14
        );
        gunModel.rotation.x = 0.02 - gunRecoil * 0.22;
      } else {
        gunEl.classList.toggle('show', fps && armed);
      }
      if(fps){
        // First-person: camera at eye height, free pitch
        const hx = Player.pos.x, hy = Player.pos.y + 2.02, hz = Player.pos.z;
        const cp = Math.cos(Cam.pitch), sp = Math.sin(Cam.pitch);
        camera.position.set(hx - Math.sin(Cam.yaw) * 0.15, hy, hz - Math.cos(Cam.yaw) * 0.15);
        camera.lookAt(hx - Math.sin(Cam.yaw) * cp * 3, hy - sp * 3, hz - Math.cos(Cam.yaw) * cp * 3);
      } else if(lastFps && Cam.pitch < 0.05){
        Cam.pitch = 0.05;                            // re-enter 3rd-person range
      }
      lastFps = fps;
      // Deathmatch crosshair follows the dynamic aim cursor (it's
      // centred in FPS mode automatically since vAim recentres there)
      try {
        const dmCh = document.getElementById('dmCrosshair');
        if(dmCh && dmCh.style.display !== 'none' && locked()){
          dmCh.style.left = vAim.x + 'px';
          dmCh.style.top  = vAim.y + 'px';
        }
      } catch(_){}
    };

    // ────────────────────────────────────────────────────────────
    // SETTINGS — ⚙ button (below 🏆) + modal
    // ────────────────────────────────────────────────────────────
    const css = document.createElement('style');
    css.textContent = `
.fw-set-btn{position:fixed;top:296px;right:14px;width:42px;height:42px;border-radius:12px;
  background:rgba(8,18,11,.85);border:2px solid rgba(110,208,214,.45);color:#6ed0d6;font-size:20px;
  cursor:pointer;z-index:33;display:flex;align-items:center;justify-content:center;padding:0;
  transition:transform .15s ease,border-color .15s ease,box-shadow .15s ease;box-shadow:0 6px 14px rgba(0,0,0,.35)}
.fw-set-btn:hover{background:rgba(110,208,214,.18);border-color:#6ed0d6;box-shadow:0 0 16px rgba(110,208,214,.30);transform:scale(1.05)}
.fw-set-bg{position:fixed;inset:0;display:none;align-items:center;justify-content:center;background:rgba(0,0,0,.78);
  -webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px);z-index:210;padding:18px}
.fw-set-bg.show{display:flex}
.fw-set-card{background:linear-gradient(180deg,rgba(8,24,30,.97),rgba(4,14,18,.97));border:2px solid rgba(110,208,214,.5);
  border-radius:18px;max-width:430px;width:100%;color:#e6ffee;font-family:'Outfit','Inter',sans-serif;overflow:hidden}
.fw-set-card .hd{display:flex;justify-content:space-between;align-items:center;padding:16px 22px;border-bottom:1px solid rgba(110,208,214,.18)}
.fw-set-card .hd h2{font-family:'Bangers','Orbitron',sans-serif;font-size:24px;color:#6ed0d6;letter-spacing:2px;margin:0}
.fw-set-card .hd .x{background:transparent;border:0;color:rgba(230,255,238,.55);font-size:22px;cursor:pointer}
.fw-set-card .bd{padding:16px 22px 20px}
.fw-set-card .lbl{font-size:11px;font-weight:800;letter-spacing:1.2px;color:#6ed0d6;margin:14px 0 8px}
.fw-set-card .lbl:first-child{margin-top:0}
.fw-set-seg{display:flex;gap:8px}
.fw-set-seg button{flex:1;background:rgba(110,208,214,.07);border:1px solid rgba(110,208,214,.3);color:rgba(230,255,238,.75);
  padding:10px 8px;border-radius:10px;font-family:'Outfit',sans-serif;font-weight:700;font-size:12.5px;cursor:pointer;
  transition:all .15s ease;line-height:1.35}
.fw-set-seg button small{display:block;font-weight:500;font-size:10px;color:rgba(230,255,238,.5);margin-top:3px}
.fw-set-seg button.on{background:rgba(110,208,214,.22);border-color:#6ed0d6;color:#fff;box-shadow:0 0 14px rgba(110,208,214,.25)}
.fw-set-card input[type=range]{width:100%;accent-color:#6ed0d6}
.fw-set-card .bval{font-family:'JetBrains Mono',monospace;font-size:11px;color:rgba(230,255,238,.6);text-align:right}
`;
    document.head.appendChild(css);

    const btn = document.createElement('button');
    btn.className = 'fw-set-btn';
    btn.id = 'fwSetBtn';
    btn.title = 'Settings';
    btn.textContent = '⚙️';
    document.body.appendChild(btn);

    const bg = document.createElement('div');
    bg.className = 'fw-set-bg';
    bg.innerHTML = `<div class="fw-set-card">
      <div class="hd"><h2>⚙ SETTINGS</h2><button class="x" id="fwSetX">×</button></div>
      <div class="bd">
        <div class="lbl">CONTROLS</div>
        <div class="fw-set-seg" id="fwSetScheme">
          <button data-v="action">🎯 Action<small>Mouse-look · LMB shoot · RMB aim · zoom to FPS</small></button>
          <button data-v="classic">🖱 Classic<small>Drag to look · RMB shoot (original)</small></button>
        </div>
        <div class="lbl">BRIGHTNESS</div>
        <input type="range" id="fwSetBright" min="60" max="150" step="5">
        <div class="bval" id="fwSetBrightVal">100%</div>
        <div class="lbl">CONTRAST</div>
        <input type="range" id="fwSetContrast" min="70" max="140" step="5">
        <div class="bval" id="fwSetContrastVal">100%</div>
        <div class="lbl">GLOW · neon bloom (High End quality only)</div>
        <input type="range" id="fwSetGlow" min="0" max="150" step="10">
        <div class="bval" id="fwSetGlowVal">100%</div>
        <div class="lbl">QUALITY</div>
        <div class="fw-set-seg" id="fwSetQual">
          <button data-v="high">✨ High End<small>Bloom, shadows, full res</small></button>
          <button data-v="perf">🚀 Performance<small>No bloom/shadows, capped res</small></button>
        </div>
        <div class="lbl">XBOX CONTROLLER</div>
        <div class="fw-set-seg" id="fwSetPad">
          <button data-v="on">🎮 Enabled<small>Sticks move &amp; look · A fart · X interact · RT shoot</small></button>
          <button data-v="off">🚫 Disabled<small>Keyboard + mouse only</small></button>
        </div>
      </div>
    </div>`;
    document.body.appendChild(bg);
    btn.addEventListener('click', () => { render(); bg.classList.add('show'); });
    bg.querySelector('#fwSetX').addEventListener('click', () => bg.classList.remove('show'));
    bg.addEventListener('click', (e) => { if(e.target === bg) bg.classList.remove('show'); });

    function render(){
      bg.querySelectorAll('#fwSetScheme button').forEach(b => b.classList.toggle('on', b.dataset.v === S.scheme));
      bg.querySelectorAll('#fwSetQual button').forEach(b => b.classList.toggle('on', b.dataset.v === S.quality));
      const r = bg.querySelector('#fwSetBright');
      r.value = S.brightness;
      bg.querySelector('#fwSetBrightVal').textContent = S.brightness + '%';
      const c = bg.querySelector('#fwSetContrast');
      c.value = S.contrast;
      bg.querySelector('#fwSetContrastVal').textContent = S.contrast + '%';
      const g = bg.querySelector('#fwSetGlow');
      g.value = S.glow ?? 100;
      bg.querySelector('#fwSetGlowVal').textContent = (S.glow ?? 100) + '%';
      bg.querySelectorAll('#fwSetPad button').forEach(b =>
        b.classList.toggle('on', (b.dataset.v === 'on') === !!S.gamepad));
    }
    bg.querySelector('#fwSetScheme').addEventListener('click', (e) => {
      const v = e.target.closest('button')?.dataset.v;
      if(!v) return;
      S.scheme = v; save(); render();
      if(v === 'classic' && locked()){ try { document.exitPointerLock(); } catch(_){} }
      if(v === 'classic'){ vDist = THREE.MathUtils.clamp(vDist, 4, 20); Cam.distance = vDist; }
      window.floater?.(v === 'action' ? '🎯 Action controls — click the world to look around' : '🖱 Classic controls restored', 'good');
    });
    bg.querySelector('#fwSetQual').addEventListener('click', (e) => {
      const v = e.target.closest('button')?.dataset.v;
      if(!v) return;
      S.quality = v; save(); render(); applyQuality();
    });
    bg.querySelector('#fwSetBright').addEventListener('input', (e) => {
      S.brightness = Number(e.target.value); save();
      bg.querySelector('#fwSetBrightVal').textContent = S.brightness + '%';
      applyBrightness();
    });
    bg.querySelector('#fwSetContrast').addEventListener('input', (e) => {
      S.contrast = Number(e.target.value); save();
      bg.querySelector('#fwSetContrastVal').textContent = S.contrast + '%';
      applyBrightness();
    });
    bg.querySelector('#fwSetGlow').addEventListener('input', (e) => {
      S.glow = Number(e.target.value); save();
      bg.querySelector('#fwSetGlowVal').textContent = S.glow + '%';
      applyGlow();
    });
    bg.querySelector('#fwSetPad').addEventListener('click', (e) => {
      const v = e.target.closest('button')?.dataset.v;
      if(!v) return;
      S.gamepad = v === 'on'; save(); render();
      window.floater?.(S.gamepad ? '🎮 Controller enabled — press any button' : '🎮 Controller disabled', 'good');
    });

    // ── Apply: brightness + contrast (one combined canvas filter) ──
    function applyBrightness(){
      const parts = [];
      if(S.brightness !== 100) parts.push('brightness(' + (S.brightness / 100) + ')');
      if((S.contrast ?? 100) !== 100) parts.push('contrast(' + (S.contrast / 100) + ')');
      canvas.style.filter = parts.join(' ');
    }

    // ── Apply: quality ──
    function findSun(){
      let sun = null;
      try { window.scene.traverse(o => { if(!sun && o.isDirectionalLight && o.castShadow !== undefined && o.shadow && o.shadow.mapSize.x >= 1024) sun = o; }); } catch(_){}
      return sun;
    }
    // ── Apply: glow (neon bloom strength) ──
    function applyGlow(){
      try {
        if(!window.bloom) return;
        const perf = S.quality === 'perf';
        const glow = S.glow ?? 100;
        window.bloom.strength = 0.65 * (glow / 100);
        window.bloom.enabled = !perf && glow > 0;
      } catch(_){}
    }

    let _sunHadShadow = null;
    function applyQuality(){
      const perf = S.quality === 'perf';
      applyGlow();   // bloom on/off + strength follows quality AND glow
      try {
        const sun = findSun();
        if(sun){
          if(_sunHadShadow === null) _sunHadShadow = sun.castShadow;
          sun.castShadow = perf ? false : (_sunHadShadow !== false);
          if(window.renderer) window.renderer.shadowMap.needsUpdate = true;
        }
      } catch(_){}
      try {
        if(window.renderer && perf){
          window.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.0));
          if(window.composer){ window.composer.setPixelRatio?.(Math.min(window.devicePixelRatio || 1, 1.0)); }
        } else if(window.Perf){
          window.Perf.reapply();   // hand control back to the adaptive controller
        }
      } catch(_){}
    }
    // Re-assert the perf cap after resizes (the resize handler calls Perf.reapply)
    window.addEventListener('resize', () => { if(S.quality === 'perf') setTimeout(applyQuality, 60); });

    // Apply persisted settings on boot (bloom may load late — retry)
    applyBrightness();
    applyQuality();
    let _glowBoot = setInterval(() => {
      if(window.bloom){ applyGlow(); clearInterval(_glowBoot); }
    }, 800);

    // ──────────────────────────────────────────────────────────────
    // ⛶ FULLSCREEN — small button docked above the compass (right side)
    // ──────────────────────────────────────────────────────────────
    const fsCss = document.createElement('style');
    fsCss.textContent = `
#fwFsBtn{position:fixed;width:32px;height:32px;border-radius:10px;z-index:36;
  background:rgba(8,18,11,.85);border:1.5px solid rgba(95,240,156,.45);color:#5ff09c;
  font-size:15px;cursor:pointer;display:flex;align-items:center;justify-content:center;padding:0;
  transition:transform .15s ease,border-color .15s ease,box-shadow .15s ease;
  box-shadow:0 6px 14px rgba(0,0,0,.4)}
#fwFsBtn:hover{background:rgba(95,240,156,.18);border-color:#5ff09c;
  box-shadow:0 0 14px rgba(95,240,156,.30);transform:scale(1.08)}
`;
    document.head.appendChild(fsCss);
    const fsBtn = document.createElement('button');
    fsBtn.id = 'fwFsBtn';
    fsBtn.title = 'Fullscreen';
    fsBtn.textContent = '⛶';
    document.body.appendChild(fsBtn);
    fsBtn.addEventListener('click', () => {
      try {
        if(document.fullscreenElement){
          document.exitFullscreen();
        } else {
          document.documentElement.requestFullscreen();
        }
      } catch(err){ console.warn('[controls] fullscreen', err); }
    });
    document.addEventListener('fullscreenchange', () => {
      const on = !!document.fullscreenElement;
      fsBtn.textContent = on ? '🗗' : '⛶';
      fsBtn.title = on ? 'Exit fullscreen' : 'Fullscreen';
    });
    // Dock above the compass, aligned to its RIGHT edge (the compass
    // repositions itself above the HP pill, so we follow it).
    function dockFsBtn(){
      const comp = document.getElementById('fwCompass');
      if(!comp) return;
      const r = comp.getBoundingClientRect();
      if(r.width < 20) return;
      fsBtn.style.left = (r.right - 32) + 'px';
      fsBtn.style.top = Math.max(6, r.top - 38) + 'px';
      fsBtn.style.right = 'auto';
      fsBtn.style.bottom = 'auto';
    }
    setInterval(dockFsBtn, 500);
    setTimeout(dockFsBtn, 600);

    // ──────────────────────────────────────────────────────────────
    // 🎮 XBOX CONTROLLER (Gamepad API) — enable in ⚙ Settings.
    //   Left stick  move        Right stick  look
    //   A  fart+jump            X  interact (E)
    //   B  mine / use tool (F)  Y  inventory
    //   RT shoot                LT aim
    //   LB/RB zoom out/in       D-pad ↑ map · ↓ bike
    //   Start ⚙ settings
    // Implemented by feeding the game's existing key map + synthetic
    // events, so every system (movement, planes, DM, mining) just works.
    // ──────────────────────────────────────────────────────────────
    const keysMap = () => window.keys || {};
    const DEAD = 0.28;
    const padPrev = {};
    function padEdge(gp, idx){
      const down = !!gp.buttons[idx]?.pressed;
      const was = !!padPrev[idx];
      padPrev[idx] = down;
      return down && !was;
    }
    function padHeld(gp, idx){ return !!gp.buttons[idx]?.pressed; }
    function synthKey(code){
      try {
        window.dispatchEvent(new KeyboardEvent('keydown', { code, bubbles: true }));
        setTimeout(() => window.dispatchEvent(new KeyboardEvent('keyup', { code, bubbles: true })), 60);
      } catch(_){}
    }
    function padShoot(){
      // center the aim, then fire through the normal click paths
      vAim.x = window.innerWidth / 2;
      vAim.y = window.innerHeight / 2;
      try {
        const dn = new MouseEvent('mousedown', { button: 0, bubbles: true, cancelable: true });
        dn._fwPad = true;
        canvas.dispatchEvent(dn);        // deathmatch fire (canvas listener)
        const dn2 = new MouseEvent('mousedown', { button: 0, bubbles: true, cancelable: true });
        dn2._fwPad = true;
        document.dispatchEvent(dn2);     // deagle fire (document listener)
        setTimeout(() => {
          const up = new MouseEvent('mouseup', { button: 0, bubbles: true });
          window.dispatchEvent(up);
        }, 70);
      } catch(_){}
    }
    let padSeen = false;
    window.addEventListener('gamepadconnected', (e) => {
      console.log('[controls] gamepad connected:', e.gamepad.id);
      window.floater?.(S.gamepad
        ? '🎮 Controller connected!'
        : '🎮 Controller detected — enable it in ⚙ Settings', 'good');
    });
    const PAD_KEYS = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'Space', 'KeyZ', 'ShiftLeft'];
    function padClearKeys(){
      const k = keysMap();
      for(const code of PAD_KEYS){ if(k['_pad_' + code]){ k[code] = false; k['_pad_' + code] = false; } }
    }
    function padSetKey(code, on){
      const k = keysMap();
      if(on){ k[code] = true; k['_pad_' + code] = true; }
      else if(k['_pad_' + code]){ k[code] = false; k['_pad_' + code] = false; }
    }
    function padTick(){
      requestAnimationFrame(padTick);
      if(!S.gamepad){ if(padSeen){ padClearKeys(); padSeen = false; } return; }
      let gp = null;
      try {
        for(const g of (navigator.getGamepads?.() || [])){ if(g && g.connected){ gp = g; break; } }
      } catch(_){}
      if(!gp){ if(padSeen){ padClearKeys(); padSeen = false; } return; }
      padSeen = true;
      const typing = document.activeElement &&
        (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA');
      const inPlane = !!(Player.boat && Player.boat.isPlane);
      // ── left stick → WASD ──
      const lx = gp.axes[0] || 0, ly = gp.axes[1] || 0;
      padSetKey('KeyW', ly < -DEAD);
      padSetKey('KeyS', ly >  DEAD);
      padSetKey('KeyA', lx < -DEAD);
      padSetKey('KeyD', lx >  DEAD);
      // ── right stick → camera ──
      const rx = Math.abs(gp.axes[2] || 0) > 0.18 ? gp.axes[2] : 0;
      const ry = Math.abs(gp.axes[3] || 0) > 0.18 ? gp.axes[3] : 0;
      if(rx || ry){
        const sens = aiming ? 0.022 : 0.045;
        Cam.yaw -= rx * sens;
        const fps = Cam.curDistance < FPS_AT;
        const lo = fps ? -1.10 : 0.05, hi = fps ? 1.25 : 0.90;
        Cam.pitch = THREE.MathUtils.clamp(Cam.pitch + ry * sens, lo, hi);
        vAim.x = window.innerWidth / 2;
        vAim.y = window.innerHeight / 2;
      }
      if(typing) return;          // buttons pause while chat is focused
      // ── held semantics ──
      padSetKey('Space', padHeld(gp, 0));               // A held = climb (plane)
      padSetKey('KeyZ',  inPlane && padHeld(gp, 1));    // B held in plane = dive
      // ── edge-triggered buttons ──
      if(padEdge(gp, 0)) synthKey('Space');                              // A → fart+jump
      if(padEdge(gp, 2)) synthKey('KeyE');                               // X → interact
      if(padEdge(gp, 1) && !inPlane) synthKey('KeyF');                   // B → mine/use
      if(padEdge(gp, 3)) document.getElementById('invToggle')?.click();  // Y → inventory
      if(padEdge(gp, 12)) synthKey('KeyM');                              // D-pad ↑ → map
      if(padEdge(gp, 13)) synthKey('KeyB');                              // D-pad ↓ → bike
      if(padEdge(gp, 9)) btn.click();                                    // Start → settings
      // LB/RB → zoom (through the normal wheel path: FPS + DM both work)
      if(padEdge(gp, 4)) canvas.dispatchEvent(new WheelEvent('wheel', { deltaY:  120, cancelable: true }));
      if(padEdge(gp, 5)) canvas.dispatchEvent(new WheelEvent('wheel', { deltaY: -120, cancelable: true }));
      // RT → shoot · LT → aim
      if(padEdge(gp, 7)) padShoot();
      const lt = padHeld(gp, 6);
      if(lt && !aiming){
        const ev = new MouseEvent('mousedown', { button: 2, bubbles: true });
        ev._fwPad = true;
        window.dispatchEvent(ev);
      } else if(!lt && aiming && padPrev['_lt']){
        window.dispatchEvent(new MouseEvent('mouseup', { button: 2, bubbles: true }));
      }
      padPrev['_lt'] = lt;
    }
    requestAnimationFrame(padTick);

    console.log('[controls] ready · scheme=' + S.scheme);
  }
})();
