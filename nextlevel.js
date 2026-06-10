// =================================================================
// nextlevel.js — FartWorld visual & performance upgrade pack.
//
//  1) UI POLISH    — glassy restyle of every NPC proximity popup,
//                    interaction prompt and dialog/shop modal.
//  2) REST SCREEN  — a proper idle overlay while idling inside the
//                    Hotel or an apartment (vignette, 💤, countdown).
//  3) TERRAIN      — procedural detail texture + per-vertex color
//                    jitter on the island ground (grass + sand).
//  4) WAKE & SPRAY — foam trail behind the tree boat / sea plane /
//                    yacht while moving on water.
//  5) CAROUSEL FX  — tick sounds, winner pop + screen flash for the
//                    weed & FartJar case-opening reveals.
//  6) PERF         — texture anisotropy, throttled spawners, zero
//                    per-frame allocations in the hot paths.
// =================================================================
(function(){
  'use strict';

  // ───────────────────────────────────────────────────────────────
  // 1) UI POLISH — pure CSS, applies immediately (no THREE needed).
  //    Covers: .npc-pop .hot-pop .apt-pop .plane-prox .junkie-pop
  //            .alex-pop .roki-near .wt-pop .plot-prompt
  //    Modals: .wave-card .gary-card .hot-card .casino-card etc.
  // ───────────────────────────────────────────────────────────────
  const ui = document.createElement('style');
  ui.textContent = `
/* ── proximity popups: glass + glow + spring-in ── */
.npc-pop, .hot-pop, .apt-pop, .plane-prox, .junkie-pop, .alex-pop, .roki-near, .wt-pop {
  background: linear-gradient(160deg, rgba(10,24,16,.82), rgba(5,13,9,.92)) !important;
  -webkit-backdrop-filter: blur(14px) saturate(1.3) !important;
  backdrop-filter: blur(14px) saturate(1.3) !important;
  border-radius: 16px !important;
  box-shadow: 0 18px 40px rgba(0,0,0,.55), inset 0 1px 0 rgba(255,255,255,.08), 0 0 30px rgba(46,224,107,.10) !important;
}
.npc-pop.show, .hot-pop.show, .apt-pop.show, .plane-prox.show, .junkie-pop.show, .alex-pop.show, .roki-near.show, .wt-pop.show {
  animation: fwPopSpring .32s cubic-bezier(.34,1.56,.64,1) !important;
}
@keyframes fwPopSpring {
  from { opacity: 0; transform: translateX(-50%) translateY(14px) scale(.92); }
  to   { opacity: 1; transform: translateX(-50%) translateY(0)    scale(1);   }
}
/* keycap look for every kbd in popups */
.npc-pop kbd, .hot-pop kbd, .apt-pop kbd, .plane-prox kbd, .plot-prompt kbd, .junkie-pop kbd, .wt-pop kbd {
  box-shadow: 0 2px 0 rgba(0,0,0,.5), inset 0 1px 0 rgba(255,255,255,.18) !important;
  animation: fwKeyPulse 1.6s ease-in-out infinite !important;
}
@keyframes fwKeyPulse {
  0%, 100% { transform: translateY(0); filter: brightness(1); }
  50%      { transform: translateY(-1px); filter: brightness(1.25); }
}
/* popup buttons: lift on hover */
.npc-pop .btn, .hot-pop .btn, .apt-pop .btn {
  transition: transform .15s ease, box-shadow .15s ease, background .15s ease !important;
}
.npc-pop .btn:hover, .hot-pop .btn:hover, .apt-pop .btn:hover {
  transform: translateY(-1px) !important;
  box-shadow: 0 6px 16px rgba(46,224,107,.30) !important;
}
/* ── plot/interact prompt: glass chip ── */
.plot-prompt {
  background: linear-gradient(160deg, rgba(10,24,16,.85), rgba(5,13,9,.93)) !important;
  -webkit-backdrop-filter: blur(12px) !important;
  backdrop-filter: blur(12px) !important;
  border-radius: 14px !important;
  box-shadow: 0 14px 30px rgba(0,0,0,.5), inset 0 1px 0 rgba(255,255,255,.07) !important;
}
.plot-prompt.show { animation: fwPopSpring .28s cubic-bezier(.34,1.56,.64,1) !important; }
/* ── dialog / shop cards: entrance + gloss sheen ── */
.wave-bg.show .wave-card, .gary-bg.show .gary-card, .hot-bg.show .hot-card,
.junk-bg.show .junk-card, .est-bg.show .est-card, .apt-bg.show .apt-card,
.dc-bg.show .dc-card, .stor-bg.show .stor-card, .bank-bg.show .bank-card {
  animation: fwCardIn .34s cubic-bezier(.22,1.2,.36,1);
  position: relative;
}
@keyframes fwCardIn {
  from { opacity: 0; transform: translateY(22px) scale(.95); }
  to   { opacity: 1; transform: translateY(0)    scale(1);   }
}
.wave-card::before, .gary-card::before, .hot-card::before {
  content: ''; position: absolute; left: 10%; right: 10%; top: 0; height: 1px;
  background: linear-gradient(90deg, transparent, rgba(255,255,255,.35), transparent);
  pointer-events: none;
}
/* shop rows: hover lift */
.wave-card .row, .gary-row {
  transition: transform .15s ease, box-shadow .15s ease, border-color .15s ease !important;
}
.wave-card .row:hover, .gary-row:hover {
  transform: translateX(3px);
  border-color: rgba(255,255,255,.35) !important;
  box-shadow: 0 4px 14px rgba(0,0,0,.35);
}
`;
  document.head.appendChild(ui);

  // ───────────────────────────────────────────────────────────────
  // 2) REST SCREEN — shows after ~5s of standing still inside the
  //    Hotel or an apartment. Wakes on any movement key / click.
  // ───────────────────────────────────────────────────────────────
  const REST_ZONES = [
    { x: -64, z: 18,  r: 6,  name: 'Hotel',                  emoji: '🏨', hotel: true },
    { x: 15,  z: -71, r: 6,  name: 'Soviet Block Apartment', emoji: '🏚', hotel: false, apt: 'apt_soviet' },
    { x: -11, z: 37,  r: 6,  name: 'Middle-Class Apartment', emoji: '🏢', hotel: false, apt: 'apt_middle' },
    { x: -13, z: 75,  r: 6,  name: 'Luxury Penthouse',       emoji: '🏢', hotel: false, apt: 'apt_luxury' },
  ];
  const TIPS = [
    'Your printer heals faster while resting in a safe zone.',
    'Spiders can’t bite you in here. Sweet dreams.',
    'Booked hotel hours keep ticking even while you’re away.',
    'Gary pays +25% for Fart Jars from the Filling Station.',
    'Rare weed strains sell for serious silver to the junkies.',
    'Press M to open the full island map.',
    'Mr Wave’s yacht is the fastest way around the island.',
  ];
  const restCss = document.createElement('style');
  restCss.textContent = `
.fw-rest{position:fixed;inset:0;z-index:120;pointer-events:none;opacity:0;transition:opacity 1.1s ease;visibility:hidden}
.fw-rest.show{opacity:1;visibility:visible}
.fw-rest .vig{position:absolute;inset:0;background:radial-gradient(ellipse at 50% 45%, transparent 32%, rgba(2,6,4,.78) 100%)}
.fw-rest .card{position:absolute;left:50%;top:12%;transform:translateX(-50%);text-align:center;font-family:'Outfit','Inter',sans-serif;color:#e6ffee}
.fw-rest .zzz{font-size:46px;line-height:1;margin-bottom:6px;display:inline-block;animation:fwZzz 3s ease-in-out infinite}
@keyframes fwZzz{0%,100%{transform:translateY(0) rotate(-4deg)}50%{transform:translateY(-10px) rotate(5deg)}}
.fw-rest h2{font-family:'Bangers','Orbitron',sans-serif;font-size:34px;letter-spacing:3px;color:#ffd64d;text-shadow:0 0 24px rgba(255,206,74,.45),0 2px 0 rgba(0,0,0,.7);margin:0 0 4px}
.fw-rest .where{font-size:13px;letter-spacing:1px;color:rgba(230,255,238,.8);margin-bottom:12px}
.fw-rest .chips{display:flex;gap:8px;justify-content:center;flex-wrap:wrap}
.fw-rest .chip{background:rgba(8,20,12,.72);border:1px solid rgba(95,240,156,.35);border-radius:100px;padding:6px 14px;font-size:12px;color:#a8ffd0;-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px)}
.fw-rest .chip b{color:#5ff09c}
.fw-rest .chip.gold{border-color:rgba(255,206,74,.4);color:#ffe9b0}
.fw-rest .chip.gold b{color:#ffd64d}
.fw-rest .tip{position:absolute;left:50%;bottom:12%;transform:translateX(-50%);font-family:'Outfit',sans-serif;font-size:13px;color:rgba(230,255,238,.75);background:rgba(8,20,12,.6);border:1px solid rgba(95,240,156,.22);border-radius:100px;padding:8px 18px;-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px);white-space:nowrap;max-width:90vw;overflow:hidden;text-overflow:ellipsis}
.fw-rest .tip b{color:#5ff09c}
.fw-rest .wake{position:absolute;left:50%;bottom:6.5%;transform:translateX(-50%);font-size:11px;letter-spacing:1.2px;color:rgba(230,255,238,.5);font-family:'Outfit',sans-serif}
.fw-rest .stars{position:absolute;inset:0;overflow:hidden}
.fw-rest .stars span{position:absolute;font-size:18px;opacity:0;animation:fwStarFloat 6s linear infinite}
@keyframes fwStarFloat{0%{opacity:0;transform:translateY(20px) scale(.7)}15%{opacity:.85}80%{opacity:.5}100%{opacity:0;transform:translateY(-110px) scale(1.15)}}
`;
  document.head.appendChild(restCss);
  const rest = document.createElement('div');
  rest.className = 'fw-rest';
  rest.innerHTML = '<div class="vig"></div>'
    + '<div class="stars" id="fwRestStars"></div>'
    + '<div class="card">'
    +   '<span class="zzz">😴</span>'
    +   '<h2>RESTING</h2>'
    +   '<div class="where" id="fwRestWhere">—</div>'
    +   '<div class="chips">'
    +     '<div class="chip">🛡 <b>SAFE ZONE</b> · no damage</div>'
    +     '<div class="chip" id="fwRestHp">❤️ HP <b>—</b></div>'
    +     '<div class="chip gold" id="fwRestTime" style="display:none">🏨 booked <b>—</b></div>'
    +   '</div>'
    + '</div>'
    + '<div class="tip" id="fwRestTip"></div>'
    + '<div class="wake">MOVE OR PRESS ANY KEY TO WAKE UP</div>';
  document.body.appendChild(rest);
  // floating 💤 particles
  (function(){
    const stars = rest.querySelector('#fwRestStars');
    for(let i = 0; i < 7; i++){
      const s = document.createElement('span');
      s.textContent = i % 2 ? '💤' : '✨';
      s.style.left = (12 + Math.random() * 76) + '%';
      s.style.top = (25 + Math.random() * 45) + '%';
      s.style.animationDelay = (Math.random() * 6) + 's';
      stars.appendChild(s);
    }
  })();

  let restShown = false, stillSince = 0, lastPX = 0, lastPZ = 0, tipIdx = 0, tipTimer = 0;
  function zoneAt(x, z){
    for(const zn of REST_ZONES){
      if(Math.hypot(zn.x - x, zn.z - z) >= zn.r) continue;
      // Apartments only count as a rest spot if the player OWNS them
      if(zn.apt && !(window.State?.apartments?.[zn.apt]?.owned)) continue;
      return zn;
    }
    return null;
  }
  function hideRest(){ if(restShown){ restShown = false; rest.classList.remove('show'); } }
  window.addEventListener('keydown', hideRest, true);
  window.addEventListener('mousedown', hideRest, true);
  setInterval(() => {
    const P = window.Player, S = window.State;
    if(!P || !P.pos){ return; }
    const zn = zoneAt(P.pos.x, P.pos.z);
    const moved = Math.hypot(P.pos.x - lastPX, P.pos.z - lastPZ) > 0.35;
    lastPX = P.pos.x; lastPZ = P.pos.z;
    const modalOpen = document.querySelector('.hot-bg.show, .apt-bg.show, .gary-bg.show, .wave-bg.show, #invBg.show');
    if(!zn || moved || P.boat || modalOpen){
      if(!zn || P.boat || modalOpen) hideRest();
      stillSince = performance.now();
      if(moved) hideRest();
      return;
    }
    if(!restShown && performance.now() - stillSince > 5000){
      restShown = true;
      document.getElementById('fwRestWhere').textContent = zn.emoji + ' ' + zn.name.toUpperCase();
      rest.classList.add('show');
      tipIdx = Math.floor(Math.random() * TIPS.length);
    }
    if(restShown){
      // HP chip
      try {
        const hp = Math.round(S?.hp ?? S?.health ?? P.hp ?? 100);
        document.getElementById('fwRestHp').innerHTML = '❤️ HP <b>' + hp + '</b>';
      } catch(_){}
      // Hotel booking countdown
      const tEl = document.getElementById('fwRestTime');
      if(zn.hotel && S && (S.hotelBookedUntil || 0) > Date.now()){
        const ms = S.hotelBookedUntil - Date.now();
        const hrs = Math.floor(ms / 3600000), min = Math.floor((ms % 3600000) / 60000);
        tEl.style.display = '';
        tEl.innerHTML = '🏨 booked <b>' + hrs + 'h ' + String(min).padStart(2, '0') + 'm</b>';
      } else {
        tEl.style.display = 'none';
      }
      // Rotating tips
      if(performance.now() - tipTimer > 6000){
        tipTimer = performance.now();
        tipIdx = (tipIdx + 1) % TIPS.length;
        document.getElementById('fwRestTip').innerHTML = '💡 <b>TIP</b> · ' + TIPS[tipIdx];
      }
    }
  }, 500);

  // ───────────────────────────────────────────────────────────────
  // 5) CAROUSEL FX — works for both reveals without touching their
  //    internals: watches the spinning track and plays a tick every
  //    time an item crosses the pin, then pops the winning item.
  // ───────────────────────────────────────────────────────────────
  const carCss = document.createElement('style');
  carCss.textContent = `
/* richer strips */
.wr-strip, .fw-case-strip {
  background: linear-gradient(180deg, rgba(0,0,0,.45), rgba(0,0,0,.15) 30%, rgba(0,0,0,.15) 70%, rgba(0,0,0,.45)) !important;
  box-shadow: inset 0 0 26px rgba(0,0,0,.6) !important;
}
.wr-strip::before, .fw-case-strip::before,
.wr-strip::after, .fw-case-strip::after {
  content: ''; position: absolute; top: 0; bottom: 0; width: 60px; z-index: 3; pointer-events: none;
}
.wr-strip::before, .fw-case-strip::before { left: 0;  background: linear-gradient(90deg,  rgba(0,0,0,.65), transparent); }
.wr-strip::after,  .fw-case-strip::after  { right: 0; background: linear-gradient(270deg, rgba(0,0,0,.65), transparent); }
.wr-strip .pin, .fw-case-strip .pin {
  width: 2.5px !important;
  background: linear-gradient(180deg, #ffd64d, #ff5050, #ffd64d) !important;
  box-shadow: 0 0 16px rgba(255,90,80,.9), 0 0 4px #fff !important;
}
.wr-track .item, .fw-case-track .item {
  box-shadow: inset 0 -14px 18px rgba(0,0,0,.30);
  transition: filter .2s ease;
}
/* winner pop */
.wr-track .item.fw-win, .fw-case-track .item.fw-win {
  animation: fwWinPop .7s cubic-bezier(.34,1.56,.64,1) forwards;
  z-index: 2; position: relative;
}
@keyframes fwWinPop {
  0%   { transform: scale(1);    filter: brightness(1); }
  40%  { transform: scale(1.22); filter: brightness(1.8) drop-shadow(0 0 18px rgba(255,255,255,.8)); }
  100% { transform: scale(1.12); filter: brightness(1.35) drop-shadow(0 0 12px rgba(255,255,255,.55)); }
}
/* full-screen rarity flash */
.fw-flash{position:fixed;inset:0;z-index:260;pointer-events:none;opacity:0;background:radial-gradient(circle at 50% 50%, rgba(255,255,255,.5), transparent 65%)}
.fw-flash.go{animation:fwFlash .8s ease-out forwards}
@keyframes fwFlash{0%{opacity:0}12%{opacity:1}100%{opacity:0}}
`;
  document.head.appendChild(carCss);
  const flash = document.createElement('div');
  flash.className = 'fw-flash';
  document.body.appendChild(flash);

  let AC = null;
  function tickSound(freq, vol, dur){
    try {
      AC = AC || new (window.AudioContext || window.webkitAudioContext)();
      const o = AC.createOscillator(), g = AC.createGain();
      o.type = 'square';
      o.frequency.value = freq;
      g.gain.setValueAtTime(vol, AC.currentTime);
      g.gain.exponentialRampToValueAtTime(0.0001, AC.currentTime + dur);
      o.connect(g).connect(AC.destination);
      o.start();
      o.stop(AC.currentTime + dur);
    } catch(_){}
  }
  function watchCarousel(trackId){
    const track = document.getElementById(trackId);
    if(!track) return;
    let lastIdx = -1;
    const t0 = performance.now();
    function poll(){
      if(performance.now() - t0 > 5200){ finish(); return; }
      const m = getComputedStyle(track).transform;
      let tx = 0;
      if(m && m !== 'none'){
        const p = m.includes('matrix3d') ? m.slice(9, -1).split(',') : m.slice(7, -1).split(',');
        tx = parseFloat(m.includes('matrix3d') ? p[12] : p[4]) || 0;
      }
      const idx = Math.floor(-tx / 118);
      if(idx !== lastIdx){
        lastIdx = idx;
        tickSound(420 + Math.random() * 80, 0.035, 0.05);
      }
      requestAnimationFrame(poll);
    }
    function finish(){
      const win = track.children[50];
      if(win){
        win.classList.add('fw-win');
        const cls = win.className;
        if(/rainbow/.test(cls)){
          flash.classList.remove('go'); void flash.offsetWidth; flash.classList.add('go');
          tickSound(880, 0.06, 0.4); setTimeout(() => tickSound(1320, 0.06, 0.5), 130);
        } else if(/orange|purple/.test(cls)){
          tickSound(660, 0.05, 0.3); setTimeout(() => tickSound(880, 0.05, 0.35), 120);
        } else {
          tickSound(520, 0.04, 0.25);
        }
      }
    }
    requestAnimationFrame(poll);
  }
  window.addEventListener('fw:weedRoll', () => { try { watchCarousel('wrTrack'); } catch(_){} });
  window.addEventListener('fw:jarRoll',  () => { try { watchCarousel('fwCaseTrack'); } catch(_){} });

  // ───────────────────────────────────────────────────────────────
  // 3, 4, 6 — need THREE + the scene. Wait for the world.
  // ───────────────────────────────────────────────────────────────
  function whenReady(){
    if(!window.THREE || !window.scene || !window.Player || !window.groundHeightAt){
      setTimeout(whenReady, 300);
      return;
    }
    try { initWorld(); } catch(e){ console.error('[nextlevel] world init', e); }
  }
  whenReady();

  function initWorld(){
    const THREE = window.THREE;
    const scene = window.scene;
    const Player = window.Player;
    const WATER_LEVEL = window.WATER_LEVEL || 0;
    const groundHeightAt = window.groundHeightAt;

    // ── 3) TERRAIN — find the 300×300 ground plane ──
    let ground = null;
    scene.traverse(o => {
      if(!ground && o.isMesh && o.geometry && o.geometry.parameters &&
         o.geometry.parameters.width === 300 && o.geometry.parameters.height === 300){
        ground = o;
      }
    });
    if(ground){
      // (a) Procedural detail texture — multi-octave value noise,
      // neutral grey so it multiplies the vertex colors without
      // shifting hue. Adds the "grain" the flat shading was missing.
      const N = 256;
      const tc = document.createElement('canvas');
      tc.width = N; tc.height = N;
      const tg = tc.getContext('2d');
      const img = tg.createImageData(N, N);
      // simple tileable value noise via wrapped lattice
      function lat(x, y){
        const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
        return s - Math.floor(s);
      }
      function vnoise(x, y, f){
        const xf = (x * f) % N, yf = (y * f) % N;
        const x0 = Math.floor(xf / (N / f)) % f, y0 = Math.floor(yf / (N / f)) % f;
        const fx = (xf / (N / f)) - Math.floor(xf / (N / f));
        const fy = (yf / (N / f)) - Math.floor(yf / (N / f));
        const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
        const a = lat(x0, y0), b = lat((x0 + 1) % f, y0);
        const c = lat(x0, (y0 + 1) % f), d = lat((x0 + 1) % f, (y0 + 1) % f);
        return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
      }
      for(let y = 0; y < N; y++){
        for(let x = 0; x < N; x++){
          let v = vnoise(x, y, 8)  * 0.5
                + vnoise(x, y, 16) * 0.3
                + vnoise(x, y, 32) * 0.2;
          // sparse darker blades/cracks
          if(vnoise(x, y, 64) > 0.82) v -= 0.18;
          const g = Math.round(150 + (v - 0.5) * 70);   // 115..185 grey
          const i = (y * N + x) * 4;
          img.data[i] = g; img.data[i + 1] = g; img.data[i + 2] = g; img.data[i + 3] = 255;
        }
      }
      tg.putImageData(img, 0, 0);
      const tex = new THREE.CanvasTexture(tc);
      tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
      tex.repeat.set(48, 48);
      try { tex.anisotropy = Math.min(8, window.renderer?.capabilities?.getMaxAnisotropy() || 4); } catch(_){ tex.anisotropy = 4; }
      // brighten base color to compensate for the (avg ~0.59) multiply
      ground.material.map = tex;
      ground.material.color = new THREE.Color(1.7, 1.7, 1.7);
      ground.material.needsUpdate = true;

      // (b) Per-vertex color jitter — patchy grass + speckled sand.
      try {
        const pos = ground.geometry.attributes.position;
        const col = ground.geometry.attributes.color;
        if(col){
          for(let i = 0; i < pos.count; i++){
            const y = pos.getY(i);
            if(y < -0.3) continue;                      // leave water bed alone
            const x = pos.getX(i), z = pos.getZ(i);
            const h = Math.sin(x * 12.9898 + z * 78.233) * 43758.5453;
            const r1 = h - Math.floor(h);
            if(y > 1.3){
              // grass: hue-ish patchiness (some yellower, some deeper green)
              const m = 0.88 + r1 * 0.26;
              col.setXYZ(i, Math.min(1, col.getX(i) * m * 1.02),
                            Math.min(1, col.getY(i) * m),
                            Math.min(1, col.getZ(i) * (0.86 + r1 * 0.2)));
            } else {
              // sand/desert: subtle warm speckle
              const m = 0.94 + r1 * 0.12;
              col.setXYZ(i, Math.min(1, col.getX(i) * m),
                            Math.min(1, col.getY(i) * m * 0.99),
                            Math.min(1, col.getZ(i) * m * 0.96));
            }
          }
          col.needsUpdate = true;
        }
      } catch(e){ console.warn('[nextlevel] vertex jitter', e); }
      console.log('[nextlevel] terrain detail applied');
    } else {
      console.warn('[nextlevel] ground mesh not found — terrain pass skipped');
    }

    // ── 6) PERF: bump anisotropy on existing big textures ──
    try {
      const maxAn = window.renderer?.capabilities?.getMaxAnisotropy() || 4;
      scene.traverse(o => {
        if(o.isMesh && o.material && o.material.map && o.material.map.anisotropy < 4){
          o.material.map.anisotropy = Math.min(8, maxAn);
          o.material.map.needsUpdate = true;
        }
      });
    } catch(_){}

    // ── 4) WAKE & SPRAY — pooled foam quads, zero allocation per frame ──
    const FOAM_N = 42;
    const foamGeo = new THREE.PlaneGeometry(1, 1);
    foamGeo.rotateX(-Math.PI / 2);
    const foamPool = [];
    const foamMatBase = new THREE.MeshBasicMaterial({
      color: 0xdff6ff, transparent: true, opacity: 0.5,
      depthWrite: false,
    });
    for(let i = 0; i < FOAM_N; i++){
      const m = new THREE.Mesh(foamGeo, foamMatBase.clone());
      m.visible = false;
      m.renderOrder = 2;
      scene.add(m);
      foamPool.push({ mesh: m, t: 0, life: 0, grow: 1 });
    }
    let foamIdx = 0;
    function spawnFoam(x, z, scale, life, opacity){
      const f = foamPool[foamIdx];
      foamIdx = (foamIdx + 1) % FOAM_N;
      f.mesh.position.set(x, WATER_LEVEL + 0.06, z);
      f.mesh.scale.set(scale, 1, scale);
      f.mesh.material.opacity = opacity;
      f.mesh.visible = true;
      f.t = 0; f.life = life; f.grow = 1 + 1.6 / life;
    }
    let lastWake = 0, prevX = 0, prevZ = 0, prevT = performance.now();
    function wakeTick(now){
      requestAnimationFrame(wakeTick);
      const dt = Math.min(0.06, (now - prevT) / 1000) || 0.016;
      prevT = now;
      // age the pool
      for(const f of foamPool){
        if(!f.mesh.visible) continue;
        f.t += dt;
        if(f.t >= f.life){ f.mesh.visible = false; continue; }
        const k = f.t / f.life;
        f.mesh.scale.x = f.mesh.scale.z = f.mesh.scale.x * (1 + (f.grow - 1) * dt);
        f.mesh.material.opacity = (1 - k) * 0.5;
      }
      // does the player pilot a water vessel?
      const b = Player.boat;
      if(!b){ prevX = Player.pos.x; prevZ = Player.pos.z; return; }
      const dx = Player.pos.x - prevX, dz = Player.pos.z - prevZ;
      const spd = Math.hypot(dx, dz) / dt;
      prevX = Player.pos.x; prevZ = Player.pos.z;
      // skip the rocket + airborne plane
      if(b.isRocket) return;
      const overWater = groundHeightAt(Player.pos.x, Player.pos.z) <= WATER_LEVEL + 0.1;
      const flyingHigh = Player.pos.y > WATER_LEVEL + 3.2;
      if(!overWater || flyingHigh || spd < 1.2) return;
      if(now - lastWake < 90) return;
      lastWake = now;
      const yaw = (b.isYacht || b.isPlane) ? (Player.yaw || 0) : (Player.boatYaw || Player.yaw || 0);
      // stern offset behind the vessel
      const back = b.isYacht ? 3.6 : b.isPlane ? 1.8 : 1.2;
      const sx = Player.pos.x + Math.sin(yaw) * back;
      const sz = Player.pos.z + Math.cos(yaw) * back;
      const big = b.isYacht ? 1.6 : 1.0;
      spawnFoam(sx, sz, (0.7 + Math.random() * 0.5) * big, 1.6 + Math.random() * 0.8, 0.45);
      // side spray at speed
      if(spd > 5){
        const side = (Math.random() > 0.5 ? 1 : -1) * (b.isYacht ? 1.5 : 0.8);
        spawnFoam(
          Player.pos.x + Math.cos(yaw) * side,
          Player.pos.z - Math.sin(yaw) * side,
          0.4 + Math.random() * 0.3, 0.9, 0.5
        );
      }
    }
    requestAnimationFrame(wakeTick);

    console.log('[nextlevel] ready');
  }
})();
