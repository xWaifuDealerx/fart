// =================================================================
// minimap.js — bottom-right mini-map with zoom + readable labels.
// v2 "next level": the static world (water, island, landmarks) is
// pre-rendered once per zoom level into an offscreen canvas and
// blitted per frame — far cheaper than redrawing every emoji each
// frame, and it lets the art be much richer. Player marker gets a
// view-cone + pulse, water gets animated shimmer, frame gets a
// compass ring.
// =================================================================
(function(){
  'use strict';
  function whenReady(){
    if(!window.THREE || !window.Player || !window.scene){ setTimeout(whenReady, 250); return; }
    init();
  }
  whenReady();

  function init(){
    const Player = window.Player;
    const ISLAND_R = window.ISLAND_RADIUS || 95;

    const LANDMARKS = [
      { x:  36, z:  36, c: '#ff5050', l: 'Arena',     e: '⚔️' },
      { x: -15, z: -45, c: '#ffb347', l: 'Trophy',    e: '🏆' },
      { x: -22, z:  -8, c: '#ffd64d', l: 'Bank',      e: '🏦' },
      { x: -22, z: -32, c: '#5ff09c', l: 'Market',    e: '🛒' },
      { x: -48, z:  28, c: '#a0a0ff', l: 'Lab',       e: '⚗️' },
      { x:  42, z:   0, c: '#ff7d3b', l: 'Glassworks',e: '🔥' },
      { x:  50, z: -36, c: '#a05030', l: 'Poop',      e: '💩' },
      { x:   0, z: -55, c: '#a8e0ff', l: 'House',     e: '🏠' },
      { x:  84, z:   0, c: '#6ed0d6', l: 'Dock',      e: '⛵' },
      { x: -45, z:   8, c: '#d0a070', l: 'Mill',      e: '📜' },
      { x:  -8, z: -16, c: '#ffe4a8', l: 'Sign',      e: '📊' },
      { x:  55, z:  50, c: '#888',    l: 'Jail',      e: '🚨' },
      { x:  60, z:  60, c: '#c89858', l: 'Pawn',      e: '🏚️' },
      { x: -55, z:  32, c: '#90d090', l: 'Fart Stn',  e: '🫙' },
      { x: -10.5,z: -45, c: '#ff7a2a', l: 'Alex',     e: '🥅' },
      { x: -50, z: -22, c: '#5ff09c', l: 'Data Ctr',  e: '💻' },
      { x: -27, z:  32, c: '#ffce4a', l: 'Storage',   e: '📦' },
      { x:  35, z: -70, c: '#ffce4a', l: 'Gunsmith',  e: '🔫' },
      { x: -64, z:  -8, c: '#ff7a7a', l: 'Hospital',  e: '🏥' },
      { x: -64, z:  18, c: '#ffd64d', l: 'Hotel',     e: '🏨' },
      { x: -67, z: -27, c: '#ff5ad6', l: 'Casino',    e: '🎰' },
      { x:  39, z: -51, c: '#ff5a1f', l: 'Moo Kratha', e: '🥩' },
    ];

    // ── Three sizes: small, medium, large + optional fullscreen view ──
    const SIZES = [
      { px: 160, span: 220, label: 'S' },
      { px: 240, span: 200, label: 'M' },
      { px: 360, span: 180, label: 'L' },
    ];
    let sizeIdx = 1;       // start at medium
    let fullscreen = false;

    const css = document.createElement('style');
    css.textContent = `
.mm-root{position:fixed;bottom:14px;right:14px;z-index:42;font-family:'Outfit','Inter','JetBrains Mono',sans-serif;color:#e6ffee;user-select:none}
.mm-root.full{bottom:50%;right:50%;transform:translate(50%,50%)}
.mm-card{position:relative;background:linear-gradient(180deg,rgba(8,20,14,.96),rgba(5,12,9,.96));border:2px solid rgba(95,240,156,.45);border-radius:16px;box-shadow:0 14px 32px rgba(0,0,0,.6),inset 0 0 0 1px rgba(255,255,255,.04),0 0 24px rgba(46,224,107,.10);overflow:hidden;transition:box-shadow .3s ease}
.mm-card:hover{box-shadow:0 14px 32px rgba(0,0,0,.6),inset 0 0 0 1px rgba(255,255,255,.06),0 0 32px rgba(46,224,107,.22)}
.mm-card canvas{display:block}
.mm-card::after{content:'';position:absolute;inset:0;pointer-events:none;border-radius:14px;box-shadow:inset 0 0 38px rgba(0,0,0,.55)}
.mm-bar{position:absolute;top:6px;left:6px;right:6px;display:flex;justify-content:space-between;align-items:center;pointer-events:none;z-index:2}
.mm-title{font-weight:800;letter-spacing:1.4px;font-size:11px;color:#5ff09c;text-shadow:0 0 6px rgba(0,0,0,.6),0 1px 0 rgba(0,0,0,.7)}
.mm-tools{display:flex;gap:4px;pointer-events:auto}
.mm-btn{background:rgba(8,18,11,.85);border:1px solid rgba(95,240,156,.45);color:#5ff09c;font-family:'Outfit','JetBrains Mono',sans-serif;font-size:11px;font-weight:700;padding:3px 8px;border-radius:6px;cursor:pointer;line-height:1;letter-spacing:.5px;transition:background .15s,box-shadow .15s}
.mm-btn:hover{background:rgba(95,240,156,.22);box-shadow:0 0 10px rgba(95,240,156,.35)}
.mm-coord{position:absolute;bottom:6px;left:8px;font-size:11px;color:rgba(230,255,238,.9);text-shadow:0 1px 2px rgba(0,0,0,.8);z-index:2;background:rgba(5,12,9,.55);padding:1px 7px;border-radius:8px;border:1px solid rgba(95,240,156,.18)}
.mm-legend{position:absolute;bottom:6px;right:8px;font-size:10px;color:rgba(230,255,238,.7);text-shadow:0 1px 2px rgba(0,0,0,.8);z-index:2}
`;
    document.head.appendChild(css);

    const root = document.createElement('div');
    root.className = 'mm-root';
    root.innerHTML = `<div class="mm-card" id="mmCard">
      <canvas id="mmCanvas"></canvas>
      <div class="mm-bar">
        <span class="mm-title">MAP · N↑</span>
        <div class="mm-tools">
          <button class="mm-btn" id="mmZoomOut" title="Zoom out">−</button>
          <button class="mm-btn" id="mmZoomIn"  title="Zoom in">+</button>
          <button class="mm-btn" id="mmFull"    title="Toggle fullscreen">⛶</button>
        </div>
      </div>
      <div class="mm-coord" id="mmCoord">x:0 z:0</div>
      <div class="mm-legend" id="mmLegend">zoom 1×</div>
    </div>`;
    document.body.appendChild(root);
    const cvs = root.querySelector('#mmCanvas');
    const ctx = cvs.getContext('2d');
    // Move out of the way of the mobile action buttons (which sit at
    // bottom-right on touch devices).
    function reanchorForMobile(){
      const isTouch = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0) || /Mobi|Android|iPhone|iPad|iPod/.test(navigator.userAgent || '');
      if(isTouch){
        root.style.right = 'auto';
        root.style.left = '14px';
        root.style.bottom = '14px';
        root.style.top = '14px';
      }
    }
    reanchorForMobile();

    // ── Offscreen pre-rendered world layer ──
    // World-space rect covered: ±WORLD_HALF metres. Re-rendered only
    // when the zoom (scale) changes — per frame we just blit it.
    const WORLD_HALF = 420;   // covers the mainland AND the four outer islands (~321 out)
    let worldCvs = null;
    let worldScale = 0;     // px per metre of the cached layer

    function renderWorldLayer(scale){
      worldScale = scale;
      const wpx = Math.ceil(WORLD_HALF * 2 * scale);
      worldCvs = document.createElement('canvas');
      worldCvs.width = wpx; worldCvs.height = wpx;
      const w = worldCvs.getContext('2d');
      const W2P = (x, z) => [(x + WORLD_HALF) * scale, (z + WORLD_HALF) * scale];

      // Water base — deep-to-shallow radial around the island
      const [ic0, ic1] = W2P(0, 0);
      const sea = w.createRadialGradient(ic0, ic1, ISLAND_R * scale, ic0, ic1, WORLD_HALF * 1.45 * scale);
      sea.addColorStop(0, '#15384a');
      sea.addColorStop(1, '#0b1f2d');
      w.fillStyle = sea;
      w.fillRect(0, 0, wpx, wpx);
      // Soft wave rings
      w.strokeStyle = 'rgba(110,208,214,.10)';
      w.lineWidth = Math.max(1, scale * 0.5);
      for(let rr = ISLAND_R + 10; rr < WORLD_HALF * 1.4; rr += 14){
        w.beginPath();
        w.arc(ic0, ic1, rr * scale, 0, Math.PI * 2);
        w.stroke();
      }
      // Shallow-water halo hugging the shore
      const halo = w.createRadialGradient(ic0, ic1, (ISLAND_R - 6) * scale, ic0, ic1, (ISLAND_R + 12) * scale);
      halo.addColorStop(0, 'rgba(110,208,214,.30)');
      halo.addColorStop(1, 'rgba(110,208,214,0)');
      w.fillStyle = halo;
      w.beginPath(); w.arc(ic0, ic1, (ISLAND_R + 12) * scale, 0, Math.PI * 2); w.fill();

      // Island body — wobbled coastline so it doesn't read as a perfect disc
      const wob = (a) => 1 + Math.sin(a * 3 + 0.7) * 0.035 + Math.sin(a * 7 + 2.1) * 0.018;
      function coast(rMul){
        w.beginPath();
        for(let a = 0; a <= Math.PI * 2 + 0.01; a += 0.05){
          const rr = ISLAND_R * rMul * wob(a) * scale;
          const px = ic0 + Math.cos(a) * rr, py = ic1 + Math.sin(a) * rr;
          if(a === 0) w.moveTo(px, py); else w.lineTo(px, py);
        }
        w.closePath();
      }
      // Sand ring
      coast(1.0);
      w.fillStyle = '#cdb289';
      w.fill();
      // Wet-sand edge line
      coast(1.0);
      w.strokeStyle = 'rgba(255,228,168,.9)';
      w.lineWidth = Math.max(1.2, scale * 0.7);
      w.stroke();
      // Grass interior
      coast(0.88);
      const grass = w.createRadialGradient(ic0, ic1, 8 * scale, ic0, ic1, ISLAND_R * 0.9 * scale);
      grass.addColorStop(0, '#3f8a4d');
      grass.addColorStop(0.65, '#2f6f3c');
      grass.addColorStop(1, '#27592f');
      w.fillStyle = grass;
      w.fill();
      // Mottled grass texture — deterministic speckle
      w.save();
      coast(0.88); w.clip();
      let seed = 1337;
      const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
      for(let i = 0; i < 380; i++){
        const a = rnd() * Math.PI * 2, rr = Math.sqrt(rnd()) * ISLAND_R * 0.86 * scale;
        const px = ic0 + Math.cos(a) * rr, py = ic1 + Math.sin(a) * rr;
        w.fillStyle = rnd() > 0.5 ? 'rgba(95,240,156,.07)' : 'rgba(10,30,12,.10)';
        w.beginPath();
        w.arc(px, py, (1.2 + rnd() * 2.6) * scale, 0, Math.PI * 2);
        w.fill();
      }
      w.restore();

      // Landmarks — emoji on backing chips (crisp: drawn once)
      for(const L of LANDMARKS){
        const [lx, ly] = W2P(L.x, L.z);
        const r = Math.max(8, 6.4 * scale);
        // glow
        const gl = w.createRadialGradient(lx, ly, 0, lx, ly, r * 1.9);
        gl.addColorStop(0, 'rgba(0,0,0,.50)');
        gl.addColorStop(1, 'rgba(0,0,0,0)');
        w.fillStyle = gl;
        w.beginPath(); w.arc(lx, ly, r * 1.9, 0, Math.PI * 2); w.fill();
        // chip
        w.beginPath(); w.arc(lx, ly, r, 0, Math.PI * 2);
        w.fillStyle = 'rgba(4,10,7,.72)';
        w.fill();
        w.lineWidth = Math.max(1, scale * 0.55);
        w.strokeStyle = L.c || 'rgba(255,255,255,.6)';
        w.stroke();
        w.font = Math.max(11, 9 * scale) + 'px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';
        w.textAlign = 'center'; w.textBaseline = 'middle';
        w.fillText(L.e, lx, ly + scale * 0.4);
      }
      // Cardinal letters offshore
      w.font = '800 ' + Math.max(11, 8 * scale) + 'px Outfit, sans-serif';
      w.fillStyle = 'rgba(255,255,255,.85)';
      w.textAlign = 'center'; w.textBaseline = 'middle';
      const cr = (ISLAND_R + 22) * scale;
      w.fillText('N', ic0, ic1 - cr);
      w.fillText('S', ic0, ic1 + cr);
      w.fillText('W', ic0 - cr, ic1);
      w.fillText('E', ic0 + cr, ic1);

      // ── Outer PVP islands (E/W/N/S) baked into the world layer ──
      const PIS = window.FW_PVP_ISLANDS || [];
      for(const C of PIS){
        const [cx, cy] = W2P(C.x, C.z);
        const rr = C.r * scale;
        // shallow halo
        const hg = w.createRadialGradient(cx, cy, rr * 0.7, cx, cy, rr * 1.25);
        hg.addColorStop(0, 'rgba(110,208,214,.25)'); hg.addColorStop(1, 'rgba(110,208,214,0)');
        w.fillStyle = hg; w.beginPath(); w.arc(cx, cy, rr * 1.25, 0, Math.PI * 2); w.fill();
        // sand + grass
        w.beginPath(); w.arc(cx, cy, rr, 0, Math.PI * 2); w.fillStyle = '#cdb289'; w.fill();
        w.beginPath(); w.arc(cx, cy, rr * 0.86, 0, Math.PI * 2); w.fillStyle = '#2f6f3c'; w.fill();
        // red PVP-zone ring at the expanded sea boundary (~ r + 53)
        w.beginPath(); w.arc(cx, cy, (C.r + 53) * scale, 0, Math.PI * 2);
        w.lineWidth = Math.max(1.5, scale * 0.7); w.strokeStyle = 'rgba(255,59,59,.8)';
        w.setLineDash([scale * 3, scale * 2]); w.stroke(); w.setLineDash([]);
        // guild-post dot
        w.beginPath(); w.arc(cx, cy, Math.max(3, scale * 1.4), 0, Math.PI * 2); w.fillStyle = '#ffd64d'; w.fill();
        // label
        w.font = '800 ' + Math.max(11, 8 * scale) + 'px Outfit, sans-serif';
        w.fillStyle = '#ff8a8a'; w.textAlign = 'center'; w.textBaseline = 'middle';
        w.fillText('PVP ' + (C.dir || ''), cx, cy - rr - Math.max(9, scale * 3));
      }
    }

    // Fullscreen = whole-world overview (centred on origin) so you can see the
    // mainland AND all four outer islands at once.
    function curSpan(){ return fullscreen ? 920 : SIZES[sizeIdx].span; }

    function applySize(){
      const s = SIZES[sizeIdx];
      const px = fullscreen ? Math.min(720, Math.floor(Math.min(window.innerWidth, window.innerHeight) * 0.8)) : s.px;
      cvs.width  = px * 2;          // 2× backing for crispness
      cvs.height = px * 2;
      cvs.style.width  = px + 'px';
      cvs.style.height = px + 'px';
      document.getElementById('mmLegend').textContent = (fullscreen ? 'fullscreen · ' : '') + 'zoom ' + s.label;
      renderWorldLayer(cvs.width / curSpan());
    }
    applySize();
    // The outer islands may not exist yet on first render — re-bake once they do.
    setTimeout(applySize, 1500);
    document.getElementById('mmZoomIn').addEventListener('click', () => { sizeIdx = Math.min(SIZES.length - 1, sizeIdx + 1); applySize(); });
    document.getElementById('mmZoomOut').addEventListener('click', () => { sizeIdx = Math.max(0, sizeIdx - 1); applySize(); });
    function setFullscreen(on){
      fullscreen = on;
      root.classList.toggle('full', fullscreen);
      applySize();
      if(on) window.fwPanels?.closeOthers('map');   // map open → close other panels
    }
    window.fwCloseMapFull = () => { if(fullscreen) setFullscreen(false); };
    document.getElementById('mmFull').addEventListener('click', () => setFullscreen(!fullscreen));

    // Smoothed player position so the map glides rather than jitters
    const sm = { x: 0, z: 0, yaw: 0, init: false };
    // Current view centre (player while normal, origin while fullscreen)
    let viewX = 0, viewZ = 0;

    function w2c(x, z){
      const scale = cvs.width / curSpan();
      return [cvs.width / 2 + (x - viewX) * scale, cvs.height / 2 + (z - viewZ) * scale];
    }

    let lastDraw = 0;
    function draw(now){
      requestAnimationFrame(draw);
      // Cap at ~30fps and skip entirely when the tab is hidden — the
      // old version redrew every emoji at full rAF speed.
      if(now - lastDraw < 33 || document.hidden) return;
      lastDraw = now;

      const w = cvs.width, h = cvs.height;
      const scale = w / curSpan();
      // Smooth-follow the player
      const tx = Player.pos?.x || 0, tz = Player.pos?.z || 0;
      if(!sm.init){ sm.x = tx; sm.z = tz; sm.init = true; }
      sm.x += (tx - sm.x) * 0.25;
      sm.z += (tz - sm.z) * 0.25;
      let dy = (Player.yaw || 0) - sm.yaw;
      while(dy >  Math.PI) dy -= Math.PI * 2;
      while(dy < -Math.PI) dy += Math.PI * 2;
      sm.yaw += dy * 0.3;

      // View centre: follow the player normally, but frame the WHOLE world
      // (centred on origin) in fullscreen so every island is visible.
      viewX = fullscreen ? 0 : sm.x;
      viewZ = fullscreen ? 0 : sm.z;

      // Blit cached world layer translated to the view centre
      ctx.fillStyle = '#0b1f2d';
      ctx.fillRect(0, 0, w, h);
      const ox = w / 2 - (viewX + WORLD_HALF) * scale;
      const oy = h / 2 - (viewZ + WORLD_HALF) * scale;
      ctx.drawImage(worldCvs, ox, oy);

      // Animated water shimmer — two faint moving bands (cheap)
      ctx.save();
      ctx.globalAlpha = 0.05;
      ctx.fillStyle = '#a8e0ff';
      const shm = (now * 0.012) % (h + 80);
      ctx.fillRect(0, shm - 40, w, 14);
      ctx.fillRect(0, (shm + h * 0.55) % (h + 80) - 40, w, 8);
      ctx.restore();

      // Other players
      try{
        const peers = window.peers || window.Peers || {};
        for(const id of Object.keys(peers)){
          const p = peers[id];
          if(!p || p.x === undefined) continue;
          const [ppx, ppy] = w2c(p.x, p.z);
          ctx.beginPath();
          ctx.arc(ppx, ppy, 5, 0, Math.PI * 2);
          ctx.fillStyle = '#6ed0d6';
          ctx.fill();
          ctx.lineWidth = 1.5;
          ctx.strokeStyle = 'rgba(0,0,0,.6)';
          ctx.stroke();
        }
      }catch(e){}
      // Cats
      try{
        if(Array.isArray(window.Cats)){
          ctx.fillStyle = '#ffae5a';
          for(const c of window.Cats){
            const [cx, cy] = w2c(c.x, c.z);
            ctx.fillRect(cx - 2, cy - 2, 4, 4);
          }
        }
      }catch(e){}

      // Player marker — pulse ring + view cone + arrow
      const [px, py] = w2c(tx, tz);
      const pulse = (now % 1600) / 1600;
      ctx.beginPath();
      ctx.arc(px, py, 8 + pulse * 16, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(95,240,156,' + (0.5 * (1 - pulse)).toFixed(3) + ')';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.save();
      ctx.translate(px, py);
      ctx.rotate(sm.yaw);
      // view cone
      const coneR = 30 * (scale / (cvs.width / 200));
      const cone = ctx.createRadialGradient(0, 0, 2, 0, 0, coneR);
      cone.addColorStop(0, 'rgba(95,240,156,.30)');
      cone.addColorStop(1, 'rgba(95,240,156,0)');
      ctx.fillStyle = cone;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, coneR, -Math.PI / 2 - 0.5, -Math.PI / 2 + 0.5);
      ctx.closePath();
      ctx.fill();
      // arrow
      const arrowS = 12;
      ctx.beginPath();
      ctx.moveTo(0, -arrowS);
      ctx.lineTo(arrowS * 0.7, arrowS * 0.7);
      ctx.lineTo(0, arrowS * 0.35);
      ctx.lineTo(-arrowS * 0.7, arrowS * 0.7);
      ctx.closePath();
      ctx.fillStyle = '#5ff09c';
      ctx.shadowColor = 'rgba(95,240,156,.8)';
      ctx.shadowBlur = 8;
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = 'rgba(0,0,0,.7)';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();

      // Coord readout
      document.getElementById('mmCoord').textContent =
        'x:' + Math.round(tx) + ' z:' + Math.round(tz);
    }
    requestAnimationFrame(draw);

    cvs.addEventListener('wheel', (e) => {
      e.preventDefault();
      if(e.deltaY < 0){
        sizeIdx = Math.min(SIZES.length - 1, sizeIdx + 1);
      } else {
        sizeIdx = Math.max(0, sizeIdx - 1);
      }
      applySize();
    }, { passive: false });
    window.addEventListener('keydown', (e) => {
      if(e.code !== 'KeyM') return;
      const a = document.activeElement;
      if(a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA')) return;
      setFullscreen(!fullscreen);
    });
    console.log('[minimap] ready (v2 cached-world)');
  }
})();
