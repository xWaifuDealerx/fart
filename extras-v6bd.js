// =================================================================
// extras-v6bd.js — Hide orphan NPC tags, rocket level gate,
//                   minimap hover tooltips.
// =================================================================
(function(){
  'use strict';
  function whenReady(){
    if(!window.State || !window.Player){ setTimeout(whenReady, 300); return; }
    init();
  }
  whenReady();

  function init(){
    const State = window.State;

    // ─────────────────────────────────────────────────────────────
    // 1) HIDE ORPHAN NPC NAME-TAGS
    //    Side files create floating <div>s that get projected from
    //    3D world coords to screen each frame. Before the camera
    //    exists or while the NPC is off-screen, those tags sit at
    //    (0,0) which reads as "stuck in the top-left". We sweep
    //    every 500 ms and hide any orphan tag whose computed left
    //    is "0px" / blank.
    // ─────────────────────────────────────────────────────────────
    function hideOrphanTags(){
      const tags = document.querySelectorAll('div[style*="position:absolute"], div[style*="position: absolute"]');
      for(const t of tags){
        const st = t.getAttribute('style') || '';
        // Only target the floating world tags — they use translate(-50%,-100%)
        if(!/translate\(-50%,\s*-100%\)/.test(st)) continue;
        const left = parseFloat(t.style.left);
        const top  = parseFloat(t.style.top);
        // If the projection loop hasn't moved them yet, they're at 0,0
        // (or never set). Hide until something actually positions them.
        if(!isFinite(left) || !isFinite(top) || (left < 5 && top < 60)){
          t.style.display = 'none';
        }
      }
    }
    setInterval(hideOrphanTags, 500);
    setTimeout(hideOrphanTags, 200);

    // ─────────────────────────────────────────────────────────────
    // 2) ROCKET LEVEL 30 GATE
    //    Wraps any existing rocket-launch entry points so a
    //    sub-30 player gets a clear floater and the launch is
    //    cancelled before it fires.
    // ─────────────────────────────────────────────────────────────
    const ROCKET_LEVEL = 30;
    function gateRocket(name){
      const orig = window[name];
      if(typeof orig !== 'function' || orig.__levelGated) return;
      const wrapped = function(){
        if((State.level || 1) < ROCKET_LEVEL){
          window.floater?.('🚀 Unlocks at Level ' + ROCKET_LEVEL + ' (you are Lv ' + (State.level || 1) + ')', 'bad');
          return;
        }
        return orig.apply(this, arguments);
      };
      wrapped.__levelGated = true;
      window[name] = wrapped;
    }
    // Cover every entry point we might be exposing.
    ['launchRocket','tryLaunchRocket','rocketLaunch','rocketTakeOff','rocketTakeoff','openRocketHud','engageRocket','startRocket','rocketEject']
      .forEach(gateRocket);

    // Also intercept clicks on any rocket-launch button by id/class.
    document.addEventListener('click', (e) => {
      const t = e.target;
      if(!t || !t.closest) return;
      const el = t.closest('#rocketLaunchBtn, .rocket-launch, .rocket-btn, [data-rocket-launch]');
      if(!el) return;
      if((State.level || 1) < ROCKET_LEVEL){
        e.preventDefault(); e.stopImmediatePropagation();
        window.floater?.('🚀 Unlocks at Level ' + ROCKET_LEVEL + ' (you are Lv ' + (State.level || 1) + ')', 'bad');
      }
    }, true);

    // ─────────────────────────────────────────────────────────────
    // 3) MINIMAP HOVER TOOLTIP
    //    When the user hovers over a landmark on the minimap, show
    //    a small label with the landmark's full name.
    //    We attach a mousemove listener on the canvas and use the
    //    same LANDMARKS / w2c math the minimap uses internally.
    // ─────────────────────────────────────────────────────────────
    const LM_LIST = [
      { x:  36, z:  36, l: 'Arena' },
      { x: -15, z: -45, l: 'Trophy' },
      { x: -22, z:  -8, l: 'Bank' },
      { x: -22, z: -32, l: 'Market' },
      { x: -48, z:  28, l: 'Lab' },
      { x:  42, z:   0, l: 'Glassworks' },
      { x:  50, z: -36, l: 'Poop House' },
      { x:   0, z: -55, l: 'House' },
      { x:  84, z:   0, l: 'Dock' },
      { x: -45, z:   8, l: 'Paper Mill' },
      { x:  -8, z: -16, l: 'Stats Sign' },
      { x:  55, z:  50, l: 'Jail' },
      { x:  60, z:  60, l: 'Gary\'s Pawn' },
      { x: -55, z:  32, l: 'Fart Filling Station' },
      { x: -10.5, z: -45, l: 'Alexandre' },
      { x: -50, z: -22, l: 'Data Center' },
      { x: -27, z:  32, l: 'Hapu\'s Storage' },
      { x:  35, z: -70, l: 'Gunsmith' },
      { x: -64, z:  -8, l: 'Hospital' },
      { x: -64, z:  18, l: 'Hotel' },
    ];
    // Tooltip element
    const tip = document.createElement('div');
    tip.style.cssText = 'position:fixed;display:none;z-index:60;background:rgba(8,18,11,.96);'
      + 'border:1px solid rgba(95,240,156,.55);color:#fff1c2;padding:5px 10px;border-radius:8px;'
      + "font-family:'Outfit','Inter',sans-serif;font-size:12px;font-weight:600;letter-spacing:.3px;"
      + 'pointer-events:none;box-shadow:0 6px 14px rgba(0,0,0,.5);white-space:nowrap';
    document.body.appendChild(tip);

    function curMinimapSpan(){
      const legend = document.getElementById('mmLegend');
      const label = (legend?.textContent || '').toLowerCase();
      // Roughly match SIZES in minimap.js
      if(label.includes('s')) return 220;
      if(label.includes('l')) return 180;
      return 200;
    }
    function findHoveredLm(mx, my){
      const cvs = document.getElementById('mmCanvas');
      if(!cvs) return null;
      const r = cvs.getBoundingClientRect();
      if(mx < r.left || mx > r.right || my < r.top || my > r.bottom) return null;
      // Translate to canvas pixel space (CSS pixels — the canvas has 2x backing)
      const localX = mx - r.left;
      const localY = my - r.top;
      // Now reverse w2c: lx = w/2 + (x - px) * scale
      const cssW = r.width;
      const span = curMinimapSpan();
      const scale = cssW / span;
      const px = window.Player?.pos?.x || 0;
      const pz = window.Player?.pos?.z || 0;
      // Pick nearest landmark within 18 px
      let best = null, bestD = 18;
      for(const L of LM_LIST){
        const lx = cssW / 2 + (L.x - px) * scale;
        const ly = cssW / 2 + (L.z - pz) * scale;
        const d = Math.hypot(lx - localX, ly - localY);
        if(d < bestD){ bestD = d; best = L; }
      }
      return best;
    }
    function showTip(text, x, y){
      tip.textContent = text;
      tip.style.left = (x + 14) + 'px';
      tip.style.top  = (y + 12) + 'px';
      tip.style.display = 'block';
    }
    function hideTip(){ tip.style.display = 'none'; }
    document.addEventListener('mousemove', (e) => {
      const hit = findHoveredLm(e.clientX, e.clientY);
      if(hit) showTip(hit.l, e.clientX, e.clientY);
      else hideTip();
    });

    console.log('[extras-v6bd] ready');
  }
})();
