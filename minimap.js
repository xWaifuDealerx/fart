// =================================================================
// minimap.js — bottom-right mini-map with zoom + readable labels.
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
      { x:  36, z:  36, c: '#ff5050', l: 'Arena' },
      { x: -15, z: -45, c: '#ffb347', l: 'Trophy' },
      { x: -22, z:  -8, c: '#ffd64d', l: 'Bank' },
      { x: -22, z: -32, c: '#5ff09c', l: 'Market' },
      { x: -48, z:  28, c: '#a0a0ff', l: 'Lab' },
      { x:  42, z:   0, c: '#ff7d3b', l: 'Glassworks' },
      { x:  50, z: -36, c: '#a05030', l: 'Poop' },
      { x:   0, z: -55, c: '#a8e0ff', l: 'House' },
      { x:  84, z:   0, c: '#6ed0d6', l: 'Dock' },
      { x: -45, z:   8, c: '#d0a070', l: 'Mill' },
      { x:  -8, z: -16, c: '#ffe4a8', l: 'Sign' },
      { x:  70, z:  70, c: '#888',    l: 'Jail' },
      { x:  60, z:  60, c: '#c89858', l: 'Pawn' },
      { x: -55, z:  32, c: '#90d090', l: 'Fart Stn' },
      { x: -10.5, z: -45, c: '#ff7a2a', l: 'Alex' },
      { x: -50, z: -22, c: '#5ff09c', l: 'Data Ctr' },
      { x: -27, z:  32, c: '#ffce4a', l: 'Storage' },
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
.mm-card{position:relative;background:rgba(8,18,11,.94);border:2px solid rgba(95,240,156,.55);border-radius:14px;box-shadow:0 14px 28px rgba(0,0,0,.55);overflow:hidden}
.mm-card canvas{display:block}
.mm-bar{position:absolute;top:6px;left:6px;right:6px;display:flex;justify-content:space-between;align-items:center;pointer-events:none}
.mm-title{font-weight:800;letter-spacing:1.4px;font-size:11px;color:#5ff09c;text-shadow:0 0 6px rgba(0,0,0,.6),0 1px 0 rgba(0,0,0,.7)}
.mm-tools{display:flex;gap:4px;pointer-events:auto}
.mm-btn{background:rgba(8,18,11,.85);border:1px solid rgba(95,240,156,.45);color:#5ff09c;font-family:'Outfit','JetBrains Mono',sans-serif;font-size:11px;font-weight:700;padding:3px 8px;border-radius:6px;cursor:pointer;line-height:1;letter-spacing:.5px}
.mm-btn:hover{background:rgba(95,240,156,.18)}
.mm-coord{position:absolute;bottom:6px;left:8px;font-size:11px;color:rgba(230,255,238,.85);text-shadow:0 1px 2px rgba(0,0,0,.8)}
.mm-legend{position:absolute;bottom:6px;right:8px;font-size:10px;color:rgba(230,255,238,.7);text-shadow:0 1px 2px rgba(0,0,0,.8)}
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
          <button class="mm-btn" id="mmFull"    title="Toggle fullscreen">⤢</button>
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

    function applySize(){
      const s = SIZES[sizeIdx];
      const px = fullscreen ? Math.min(720, Math.floor(Math.min(window.innerWidth, window.innerHeight) * 0.8)) : s.px;
      cvs.width  = px * 2;          // 2× backing for crispness
      cvs.height = px * 2;
      cvs.style.width  = px + 'px';
      cvs.style.height = px + 'px';
      document.getElementById('mmLegend').textContent = (fullscreen ? 'fullscreen · ' : '') + 'zoom ' + s.label;
    }
    applySize();
    document.getElementById('mmZoomIn').addEventListener('click', () => { sizeIdx = Math.min(SIZES.length - 1, sizeIdx + 1); applySize(); });
    document.getElementById('mmZoomOut').addEventListener('click', () => { sizeIdx = Math.max(0, sizeIdx - 1); applySize(); });
    document.getElementById('mmFull').addEventListener('click', () => {
      fullscreen = !fullscreen;
      root.classList.toggle('full', fullscreen);
      applySize();
    });

    function curSpan(){ return fullscreen ? 220 : SIZES[sizeIdx].span; }

    function w2c(x, z){
      const span = curSpan();
      const scale = cvs.width / span;
      return [cvs.width / 2 + x * scale, cvs.height / 2 + z * scale];
    }
    function draw(){
      // 2× upscale: scale up everything proportionally
      const w = cvs.width, h = cvs.height;
      const SCALE = w / 200;        // base scale factor for sizes
      ctx.fillStyle = 'rgba(20,38,52,1)';
      ctx.fillRect(0, 0, w, h);
      // Wavy sea pattern
      ctx.strokeStyle = 'rgba(60,120,150,.45)';
      ctx.lineWidth = 1.5 * SCALE / 2;
      for(let y = 8; y < h; y += 24){
        ctx.beginPath();
        for(let x = 0; x < w; x += 6){
          const yy = y + Math.sin((x + y) * 0.02) * 1.2;
          if(x === 0) ctx.moveTo(x, yy); else ctx.lineTo(x, yy);
        }
        ctx.stroke();
      }
      // Island disc
      const [icx, icy] = w2c(0, 0);
      const span = curSpan();
      const islPx = ISLAND_R * (w / span);
      ctx.beginPath();
      ctx.arc(icx, icy, islPx, 0, Math.PI * 2);
      const g = ctx.createRadialGradient(icx, icy, islPx * 0.1, icx, icy, islPx);
      g.addColorStop(0, 'rgba(70,200,110,0.80)');
      g.addColorStop(0.7, 'rgba(40,140,70,0.85)');
      g.addColorStop(1, 'rgba(184,154,108,0.85)');  // sandy beach edge
      ctx.fillStyle = g;
      ctx.fill();
      ctx.lineWidth = 2 * SCALE / 2;
      ctx.strokeStyle = 'rgba(255,228,168,.85)';
      ctx.stroke();
      // Cardinal markers
      ctx.fillStyle = 'rgba(255,255,255,.95)';
      ctx.font = 'bold ' + (18 * SCALE / 2) + 'px Outfit, sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      const pad = 18 * SCALE / 2;
      ctx.fillText('N', icx, pad);
      ctx.fillText('S', icx, h - pad);
      ctx.fillText('W', pad, icy);
      ctx.fillText('E', w - pad, icy);
      // Landmarks with text outlines
      const dotR = 7 * SCALE / 2;
      ctx.lineJoin = 'round';
      for(const L of LANDMARKS){
        const [lx, ly] = w2c(L.x, L.z);
        // Dot
        // Dot
        ctx.beginPath();
        ctx.arc(lx, ly, dotR, 0, Math.PI * 2);
        ctx.fillStyle = L.c;
        ctx.fill();
        ctx.lineWidth = 1.6 * SCALE / 2;
        ctx.strokeStyle = 'rgba(0,0,0,.75)';
        ctx.stroke();
        // Label outline + fill
        const labelFont = 'bold ' + (Math.max(13, 14 * SCALE / 2)) + 'px Outfit, sans-serif';
        ctx.font = labelFont;
        ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
        ctx.lineWidth = 4 * SCALE / 2;
        ctx.strokeStyle = 'rgba(0,0,0,.85)';
        ctx.strokeText(L.l, lx + dotR + 4, ly);
        ctx.fillStyle = '#fff';
        ctx.fillText(L.l, lx + dotR + 4, ly);
      }
      try{
        const peers = window.peers || window.Peers || {};
        for(const id of Object.keys(peers)){
          const p = peers[id];
          if(!p || p.x === undefined) continue;
          const [px, py] = w2c(p.x, p.z);
          ctx.beginPath();
          ctx.arc(px, py, 5 * SCALE / 2, 0, Math.PI * 2);
          ctx.fillStyle = '#6ed0d6';
          ctx.fill();
        }
      }catch(e){}
      try{
        if(Array.isArray(window.Cats)){
          for(const c of window.Cats){
            const [cx, cy] = w2c(c.x, c.z);
            ctx.fillStyle = '#ffae5a';
            ctx.fillRect(cx - 2, cy - 2, 4, 4);
          }
        }
      }catch(e){}
      const [px, py] = w2c(Player.pos.x, Player.pos.z);
      const yaw = Player.yaw || 0;
      ctx.save();
      ctx.translate(px, py);
      ctx.rotate(yaw);
      const arrowS = 12 * SCALE / 2;
      ctx.beginPath();
      ctx.moveTo(0, -arrowS);
      ctx.lineTo(arrowS * 0.7, arrowS * 0.7);
      ctx.lineTo(0, arrowS * 0.35);
      ctx.lineTo(-arrowS * 0.7, arrowS * 0.7);
      ctx.closePath();
      ctx.fillStyle = '#5ff09c';
      ctx.fill();
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 1.6 * SCALE / 2;
      ctx.stroke();
      ctx.restore();
      const mc = document.getElementById('mmCoord');
      if(mc) mc.textContent = 'x:' + Math.round(Player.pos.x) + ' z:' + Math.round(Player.pos.z);
      requestAnimationFrame(draw);
    }
    requestAnimationFrame(draw);

    cvs.addEventListener('wheel', (e) => {
      e.preventDefault();
      if(e.deltaY < 0) sizeIdx = Math.min(SIZES.length - 1, sizeIdx + 1);
      else sizeIdx = Math.max(0, sizeIdx - 1);
      applySize();
    }, { passive: false });
    window.addEventListener('keydown', (e) => {
      if(e.code !== 'KeyM') return;
      const a = document.activeElement;
      if(a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA')) return;
      fullscreen = !fullscreen;
      root.classList.toggle('full', fullscreen);
      applySize();
    }, { passive: false });
    window.addEventListener('keydown', (e) => {
      if(e.code !== 'KeyM') return;
      const a = document.activeElement;
      if(a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA')) return;
      fullscreen = !fullscreen;
      root.classList.toggle('full', fullscreen);
      applySize();
    });
    console.log('[minimap] ready');
  }
})();
