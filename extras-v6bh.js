// =================================================================
// extras-v6bh.js — Hard rocket-level gate, button alignment override,
//                   bank min-spend lowered.
// =================================================================
(function(){
  'use strict';
  function whenReady(){
    if(!window.State){ setTimeout(whenReady, 300); return; }
    init();
  }
  whenReady();

  function init(){
    const State = window.State;

    // ──────────────────────────────────────────────────────────────
    // 1) HARD ROCKET GATE — capture-phase E-key handler that fires
    //    BEFORE rocket.js's own handler. If the player is within
    //    7 m of the launch pad and below Level 30, we block boarding
    //    and show a centered modal.
    // ──────────────────────────────────────────────────────────────
    const PAD_POS = { x: 24, z: -22 };
    const ROCKET_LV = 30;
    const Player = window.Player || {};

    const lvCss = document.createElement('style');
    lvCss.textContent = `
.fw-rocketgate{position:fixed;inset:0;display:none;align-items:center;justify-content:center;background:rgba(0,0,0,.78);backdrop-filter:blur(8px);z-index:220}
.fw-rocketgate.show{display:flex}
.fw-rocketgate .card{background:linear-gradient(180deg,rgba(40,12,40,.97),rgba(20,4,20,.97));border:2px solid rgba(255,90,90,.6);border-radius:18px;padding:24px 28px;text-align:center;color:#fff1c2;max-width:380px;width:92vw;box-shadow:0 24px 50px rgba(0,0,0,.55),0 0 50px rgba(255,90,90,.22)}
.fw-rocketgate h2{font-family:'Bangers','Orbitron',sans-serif;font-size:28px;color:#ff7a6e;letter-spacing:1.8px;margin-bottom:6px}
.fw-rocketgate .sub{font-size:12.5px;color:rgba(230,255,238,.7);margin-bottom:14px;line-height:1.55}
.fw-rocketgate .sub b{color:#ffd64d}
.fw-rocketgate .lv{font-family:'Orbitron',sans-serif;font-weight:900;font-size:22px;color:#ffd64d;margin-bottom:14px}
.fw-rocketgate .ok{background:rgba(255,206,74,.18);border:1px solid rgba(255,206,74,.55);color:#ffd64d;padding:9px 22px;border-radius:100px;font-family:'Orbitron',sans-serif;font-weight:900;font-size:11.5px;cursor:pointer;letter-spacing:.6px}
`;
    document.head.appendChild(lvCss);
    const gate = document.createElement('div');
    gate.className = 'fw-rocketgate';
    gate.innerHTML = '<div class="card"><h2>🚀 ROCKET LOCKED</h2><div class="sub">The moon mission is reserved for veteran printers. Keep farting, mining, and printing to level up.</div><div class="lv" id="fwRocketLv">Lv ? / 30</div><button class="ok" id="fwRocketOk">GOT IT</button><div class="sub" style="margin:11px 0 0;font-size:10.5px;opacity:.75">Press <b>Esc</b> or <b>Enter</b> to close</div></div>';
    document.body.appendChild(gate);
    function closeGate(){ gate.classList.remove('show'); }
    document.getElementById('fwRocketOk').addEventListener('click', closeGate);
    gate.addEventListener('click', (e) => { if(e.target === gate) closeGate(); });
    // Esc / Enter closes the gate (capture phase so it beats other key handlers).
    window.addEventListener('keydown', (e) => {
      if(!gate.classList.contains('show')) return;
      if(e.code === 'Escape' || e.code === 'Enter' || e.code === 'NumpadEnter'){
        e.preventDefault(); e.stopImmediatePropagation();
        closeGate();
      }
    }, true);
    function showGate(){
      const lv = State.level || 1;
      document.getElementById('fwRocketLv').textContent = 'Lv ' + lv + ' / ' + ROCKET_LV;
      gate.classList.add('show');
    }

    function nearRocketPad(){
      if(!window.Player || !window.Player.pos) return false;
      const d = Math.hypot(window.Player.pos.x - PAD_POS.x, window.Player.pos.z - PAD_POS.z);
      return d < 7;
    }

    window.addEventListener('keydown', (e) => {
      if(e.code !== 'KeyE') return;
      const a = document.activeElement;
      if(a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA')) return;
      if(!nearRocketPad()) return;
      // Don't gate if already on the rocket — they can press E to eject.
      if(window.Player?.boat?.isRocket) return;
      if((State.level || 1) < ROCKET_LV){
        e.preventDefault(); e.stopImmediatePropagation();
        showGate();
      }
    }, true); // capture phase — fires before rocket.js's listener

    // Also block any rocket proximity popup's Open button.
    document.addEventListener('click', (e) => {
      const t = e.target;
      if(!t || !t.closest) return;
      const el = t.closest('.rocket-pop .btn, #rocketBoardBtn, [data-rocket-board]');
      if(!el) return;
      if((State.level || 1) < ROCKET_LV){
        e.preventDefault(); e.stopImmediatePropagation();
        showGate();
      }
    }, true);

    // ──────────────────────────────────────────────────────────────
    // 2) TOP-RIGHT BUTTON ALIGNMENT — override any leftover
    //    !important rules in fartworld.html that fight ours.
    //    Inspect what's there and force a clean stack.
    // ──────────────────────────────────────────────────────────────
    const css = document.createElement('style');
    css.textContent = `
/* Reset ALL existing inline + stylesheet top values, then force ours. */
#invToggle, #portfolioToggle, #lbToggle, .fw-ref-btn{
  right: 14px !important;
  position: fixed !important;
  z-index: 33 !important;
}
#invToggle       { top:  80px !important; }
#portfolioToggle { top: 134px !important; }
.fw-ref-btn      { top: 188px !important; }
#lbToggle        { top: 242px !important; }

/* Uniform size + look for the 🤝 referrals button so it matches
   inv/portfolio/lb visually. inv-toggle styling from fartworld.html
   uses 42x42 rounded squares. */
.fw-ref-btn{
  width: 42px !important;
  height: 42px !important;
  border-radius: 12px !important;
  background: rgba(8,18,11,.85) !important;
  border: 2px solid rgba(255,206,74,0.45) !important;
  color: #ffd64d !important;
  font-size: 20px !important;
  cursor: pointer !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  padding: 0 !important;
  box-shadow: 0 6px 14px rgba(0,0,0,.35) !important;
  transition: transform .15s ease, border-color .15s ease, box-shadow .15s ease !important;
}
.fw-ref-btn:hover{
  background: rgba(255,206,74,0.18) !important;
  border-color: #ffd64d !important;
  box-shadow: 0 0 16px rgba(255,214,77,0.30) !important;
  transform: scale(1.05) !important;
}
`;
    document.head.appendChild(css);

    // Also nuke any inline style="top:..." attribute the button might
    // carry from fartworld.html so our CSS rule isn't bypassed.
    function nukeInlineTop(){
      for(const id of ['invToggle','portfolioToggle','lbToggle']){
        const el = document.getElementById(id);
        if(el && el.style.top){ el.style.removeProperty('top'); }
      }
    }
    setInterval(nukeInlineTop, 700);
    setTimeout(nukeInlineTop, 200);

    // ──────────────────────────────────────────────────────────────
    // 3) BANK MIN-SPEND → 1 SILVER (fractional gold OK)
    //    The input has min="1000" step="1000". Drop both to 1 and
    //    let the user buy fractions of gold.
    // ──────────────────────────────────────────────────────────────
    function relaxBankMin(){
      const inp = document.getElementById('bankGoldQty');
      if(!inp) return;
      if(inp.getAttribute('min') !== '1'){
        inp.setAttribute('min', '1');
        inp.setAttribute('step', '1');
      }
    }
    setInterval(relaxBankMin, 1000);
    relaxBankMin();
    // And patch the conversion validator: extras-v6bg.js's silver→gold
    // path checks `silver < minSilver` where minSilver was ceil(0.01 * rate).
    // Replace it with just "silver < 1" so any positive amount works.
    // We do this by intercepting bankGoldGo at capture before v6bg.
    document.addEventListener('click', (e) => {
      const t = e.target;
      if(!t || (t.id !== 'bankGoldGo' && !t.closest?.('#bankGoldGo'))) return;
      e.stopImmediatePropagation();
      try {
        const inp = document.getElementById('bankGoldQty');
        if(!inp) return;
        const silver = Math.max(0, Math.floor(Number(inp.value) || 0));
        if(silver < 1){ window.floater?.('Enter at least 1 🥈', 'bad'); return; }
        if((Number(State.credits) || 0) < silver){ window.floater?.('Need ' + silver.toLocaleString() + ' 🥈', 'bad'); return; }
        const rate = (typeof window.silverPerGold === 'function') ? window.silverPerGold() : 100000;
        const gold = +(silver / rate).toFixed(6);
        State.credits = +((Number(State.credits) || 0) - silver).toFixed(2);
        State.gold    = +(((Number(State.gold) || 0) + gold).toFixed(6));
        window.floater?.('+' + gold.toFixed(6) + ' 🥇 · -' + silver.toLocaleString() + ' 🥈', 'good');
        window.playPurchaseSound?.();
        inp.value = '';
        const prev = document.getElementById('bankGoldPreview'); if(prev) prev.textContent = '→ 0.000000 🥇';
        try { window.updateHUD?.(); window.saveState?.(); } catch(_){}
        const s = document.getElementById('bankSilver'); if(s) s.textContent = Math.floor(State.credits).toLocaleString();
        const g = document.getElementById('bankGold');   if(g) g.textContent = Number(State.gold).toFixed(6);
      } catch(err){ console.error('[v6bh] silver→gold', err); }
    }, true);

    console.log('[extras-v6bh] ready');
  }
})();
