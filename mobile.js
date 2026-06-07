// =================================================================
// mobile.js — touch controls + perf tuning for phones.
// =================================================================
// On touch devices:
//   • Lowers renderer pixelRatio to 1 (was up to devicePixelRatio).
//   • Disables shadows.
//   • Hides the nature scatter (grass / flowers / mushrooms / rocks).
//   • Removes the fog so close terrain reads more cleanly.
//   • Adds an on-screen joystick (left) and action buttons (right):
//       W/A/S/D from joystick, plus E, F, Space, Shift, Ctrl, Q.
//   • Touches set window.keys[…] = true so all existing handlers work.
// =================================================================
(function(){
  'use strict';
  function isTouchDevice(){
    return ('ontouchstart' in window) || (navigator.maxTouchPoints > 0) || /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent || '');
  }
  if(!isTouchDevice()) return;

  function whenReady(){
    if(!window.scene || !window.camera || !window.Player || !window.keys){
      setTimeout(whenReady, 300); return;
    }
    init();
  }
  whenReady();

  function init(){
    const scene = window.scene;
    const camera = window.camera;
    const keys = window.keys;

    // ── PERFORMANCE TUNING ──
    try {
      // Find the renderer's canvas + use its parent renderer if exposed
      // We don't get the renderer directly, but Three.js attaches one
      // canvas to the document; we can downscale that backing buffer.
      const allCanvases = document.querySelectorAll('canvas');
      let mainCvs = null;
      allCanvases.forEach(c => {
        if(c.width > 800 && c.height > 600 && c.id !== 'mmCanvas') mainCvs = c;
      });
      if(mainCvs){
        // Force CSS-px sized backing
        const w = mainCvs.clientWidth, h = mainCvs.clientHeight;
        if(w && h){
          mainCvs.width = w;
          mainCvs.height = h;
        }
      }
    } catch(e){}
    // Hide everything from nature.js — heavy instanced meshes
    try {
      // InstancedMesh / Mesh / Points / Group at scene root that were added
      // by nature.js. We can't easily distinguish them so we just hide
      // anything with a huge instance count or with the "scatter" tag.
      scene.traverse(obj => {
        if(obj.isInstancedMesh && obj.count && obj.count > 100){
          obj.visible = false;
        }
      });
      // Remove fog so the horizon doesn't shimmer on weak GPUs
      scene.fog = null;
    } catch(e){}

    // Disable shadows on every light + every mesh
    try {
      scene.traverse(obj => {
        if(obj.castShadow !== undefined) obj.castShadow = false;
        if(obj.receiveShadow !== undefined) obj.receiveShadow = false;
      });
    } catch(e){}

    // ── ON-SCREEN CONTROLS ──
    const css = document.createElement('style');
    css.textContent = `
.mc-pad{position:fixed;left:18px;bottom:18px;width:130px;height:130px;background:rgba(0,0,0,.35);border:2px solid rgba(255,255,255,.25);border-radius:50%;z-index:40;touch-action:none}
.mc-pad .knob{position:absolute;left:50%;top:50%;width:60px;height:60px;margin:-30px 0 0 -30px;background:radial-gradient(circle at 35% 35%,#fff,#a8e0ff);border-radius:50%;border:2px solid rgba(255,255,255,.6);box-shadow:0 4px 10px rgba(0,0,0,.5)}
.mc-pad .lbl{position:absolute;color:rgba(255,255,255,.5);font-family:monospace;font-size:10px;font-weight:700;pointer-events:none}
.mc-pad .lbl.n{top:4px;left:50%;transform:translateX(-50%)}
.mc-pad .lbl.s{bottom:4px;left:50%;transform:translateX(-50%)}
.mc-pad .lbl.w{left:4px;top:50%;transform:translateY(-50%)}
.mc-pad .lbl.e{right:4px;top:50%;transform:translateY(-50%)}
.mc-buttons{position:fixed;right:14px;bottom:18px;display:grid;grid-template-columns:repeat(3,60px);gap:6px;z-index:40;touch-action:none}
.mc-btn{width:60px;height:60px;border-radius:50%;background:rgba(8,18,11,.85);border:2px solid rgba(95,240,156,.6);color:#5ff09c;font-family:Outfit,monospace;font-weight:900;font-size:14px;letter-spacing:.4px;text-align:center;line-height:56px;user-select:none;-webkit-tap-highlight-color:transparent;box-shadow:0 4px 12px rgba(0,0,0,.5)}
.mc-btn.act{background:rgba(36,12,18,.9);border-color:rgba(255,206,74,.7);color:#ffce4a}
.mc-btn.pressed{transform:scale(.92);filter:brightness(1.3)}
.mc-btn small{display:block;font-size:9px;letter-spacing:.4px;color:rgba(230,255,238,.6);line-height:1;margin-top:-3px}
@media (orientation:landscape){
  .mc-pad{left:14px;bottom:14px}
  .mc-buttons{right:14px;bottom:14px}
}
`;
    document.head.appendChild(css);

    // ── Joystick ──
    const pad = document.createElement('div');
    pad.className = 'mc-pad';
    pad.innerHTML = '<div class="lbl n">W</div><div class="lbl s">S</div><div class="lbl w">A</div><div class="lbl e">D</div><div class="knob" id="mcKnob"></div>';
    document.body.appendChild(pad);
    const knob = document.getElementById('mcKnob');
    let touchId = null;
    let center = { x: 0, y: 0 };
    function getRect(){ return pad.getBoundingClientRect(); }
    function setKnob(dx, dy){
      const r = 38; // max knob travel from center
      const m = Math.hypot(dx, dy);
      let nx = dx, ny = dy;
      if(m > r){ nx = dx / m * r; ny = dy / m * r; }
      knob.style.transform = `translate(${nx}px, ${ny}px)`;
      const f = m > 8 ? Math.min(1, m / r) : 0;
      // dead zone
      const ux = m > 8 ? dx / Math.max(m, 1) : 0;
      const uy = m > 8 ? dy / Math.max(m, 1) : 0;
      // Map to WASD: up = north (negative y on screen) = forward (W)
      keys['KeyW'] = uy * f < -0.35;
      keys['KeyS'] = uy * f > 0.35;
      keys['KeyA'] = ux * f < -0.35;
      keys['KeyD'] = ux * f > 0.35;
    }
    function resetKnob(){
      knob.style.transform = 'translate(0,0)';
      keys['KeyW'] = false; keys['KeyS'] = false; keys['KeyA'] = false; keys['KeyD'] = false;
    }
    pad.addEventListener('touchstart', (e) => {
      e.preventDefault();
      const t = e.changedTouches[0];
      touchId = t.identifier;
      const r = getRect();
      center.x = r.left + r.width / 2;
      center.y = r.top + r.height / 2;
      setKnob(t.clientX - center.x, t.clientY - center.y);
    }, { passive: false });
    pad.addEventListener('touchmove', (e) => {
      e.preventDefault();
      for(const t of e.changedTouches){
        if(t.identifier === touchId){
          setKnob(t.clientX - center.x, t.clientY - center.y);
          break;
        }
      }
    }, { passive: false });
    function endTouch(e){
      for(const t of e.changedTouches){
        if(t.identifier === touchId){
          touchId = null; resetKnob();
        }
      }
    }
    pad.addEventListener('touchend', endTouch);
    pad.addEventListener('touchcancel', endTouch);

    // ── Action buttons ──
    const btns = document.createElement('div');
    btns.className = 'mc-buttons';
    const BUTTONS = [
      { id: 'mcQ',   code: 'KeyQ',   label: 'Q',  sub: 'WARP' },
      { id: 'mcSp',  code: 'Space',  label: '\u{2B06}', sub: 'JUMP' },
      { id: 'mcE',   code: 'KeyE',   label: 'E',  sub: 'USE',  cls: 'act' },
      { id: 'mcCt',  code: 'ControlLeft', label: '\u{25BC}', sub: 'BRAKE' },
      { id: 'mcSh',  code: 'ShiftLeft',   label: '\u{25B2}', sub: 'BOOST' },
      { id: 'mcF',   code: 'KeyF',   label: 'F',  sub: 'TOOL', cls: 'act' },
    ];
    btns.innerHTML = BUTTONS.map(b =>
      `<button class="mc-btn ${b.cls || ''}" data-code="${b.code}" data-id="${b.id}">${b.label}<small>${b.sub}</small></button>`
    ).join('');
    document.body.appendChild(btns);
    btns.querySelectorAll('.mc-btn').forEach(b => {
      const code = b.dataset.code;
      function press(e){
        e.preventDefault();
        keys[code] = true;
        b.classList.add('pressed');
        // Also dispatch a synthetic keydown so handlers using addEventListener
        // fire on first press (some game logic checks events not keys).
        try {
          const ev = new KeyboardEvent('keydown', { code, bubbles: true });
          window.dispatchEvent(ev);
        } catch(e){}
      }
      function release(e){
        e.preventDefault();
        keys[code] = false;
        b.classList.remove('pressed');
        try {
          const ev = new KeyboardEvent('keyup', { code, bubbles: true });
          window.dispatchEvent(ev);
        } catch(e){}
      }
      b.addEventListener('touchstart', press, { passive: false });
      b.addEventListener('touchend',   release, { passive: false });
      b.addEventListener('touchcancel',release, { passive: false });
      // Also support mouse for testing in desktop dev tools
      b.addEventListener('mousedown',  press);
      b.addEventListener('mouseup',    release);
      b.addEventListener('mouseleave', release);
    });

    // Move chat / HUD elements that overlap the joystick zone
    try {
      const chat = document.getElementById('chatInput')?.parentElement || document.getElementById('chatBubbles');
      if(chat){ chat.style.bottom = '160px'; }
    } catch(e){}

    console.log('[mobile] touch controls + perf tuning active');
  }
})();
