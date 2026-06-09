// =================================================================
// extras-v6bg.js — bullet-proof silver→gold + proper top-right
//                  button stacking (no overlap, uniform style).
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
    // 1) BULLET-PROOF SILVER → GOLD CONVERSION
    //    We delegate-listen for clicks anywhere on #bankGoldGo so
    //    even if a side file clones / replaces the button later, we
    //    still catch it. We also run the same logic for the
    //    Silver→Cash, Cash→Silver and Gold→Silver buttons.
    // ──────────────────────────────────────────────────────────────
    function asNum(v){ v = Number(v); return Number.isFinite(v) ? v : 0; }
    function silverPerGold(){
      if(typeof window.silverPerGold === 'function') return window.silverPerGold();
      return 100000;
    }
    function paperPerSilver(){
      if(typeof window.paperPerSilver === 'function') return window.paperPerSilver();
      return 50;
    }
    function cashPerSilverBack(){
      if(typeof window.cashPerSilverBack === 'function') return window.cashPerSilverBack();
      return 100;
    }
    function refreshHud(){
      try { window.updateHUD?.(); window.saveState?.(); } catch(_){}
      const s = document.getElementById('bankSilver'); if(s) s.textContent = Math.floor(asNum(State.credits)).toLocaleString();
      const p = document.getElementById('bankPaper');  if(p) p.textContent = Math.floor(asNum(State.paper)).toLocaleString();
      const g = document.getElementById('bankGold');   if(g) g.textContent = asNum(State.gold).toFixed(4);
    }

    // Single delegated click handler on document — runs at capture
    // phase so it always wins over later-attached listeners.
    document.addEventListener('click', (e) => {
      const t = e.target;
      if(!t) return;
      // Silver → Gold
      if(t.id === 'bankGoldGo' || t.closest?.('#bankGoldGo')){
        e.preventDefault(); e.stopImmediatePropagation();
        try {
          const inp = document.getElementById('bankGoldQty');
          if(!inp) return;
          const silver = Math.max(0, Math.floor(asNum(inp.value)));
          const r = silverPerGold();
          if(silver < 1){
            window.floater?.('Enter at least 1 🥈', 'bad'); return;
          }
          if(asNum(State.credits) < silver){
            window.floater?.('Need ' + silver.toLocaleString() + ' 🥈', 'bad'); return;
          }
          const gold = +(silver / r).toFixed(4);
          State.credits = +(asNum(State.credits) - silver).toFixed(2);
          State.gold    = +((asNum(State.gold)) + gold).toFixed(4);
          window.floater?.('+' + gold.toFixed(4) + ' 🥇 · -' + silver.toLocaleString() + ' 🥈', 'good');
          window.playPurchaseSound?.();
          inp.value = '';
          const prev = document.getElementById('bankGoldPreview'); if(prev) prev.textContent = '→ 0.0000 🥇';
          refreshHud();
        } catch(err){
          console.error('[v6bg] silver→gold', err);
          window.floater?.('Bank glitched — see console', 'bad');
        }
        return;
      }
      // Silver → Cash
      if(t.id === 'bankPaperGo' || t.closest?.('#bankPaperGo')){
        e.preventDefault(); e.stopImmediatePropagation();
        try {
          const inp = document.getElementById('bankPaperQty');
          if(!inp) return;
          const silver = Math.max(0, Math.floor(asNum(inp.value)));
          if(silver <= 0){ window.floater?.('Enter a Silver amount', 'bad'); return; }
          if(asNum(State.credits) < silver){ window.floater?.('Need ' + silver.toLocaleString() + ' 🥈', 'bad'); return; }
          const cash = silver * paperPerSilver();
          State.credits = +(asNum(State.credits) - silver).toFixed(2);
          State.paper   = asNum(State.paper) + cash;
          window.floater?.('+' + cash.toLocaleString() + ' 💵 · -' + silver.toLocaleString() + ' 🥈', 'good');
          window.playPurchaseSound?.();
          inp.value = '';
          const prev = document.getElementById('bankPaperPreview'); if(prev) prev.textContent = '→ 0 💵';
          refreshHud();
        } catch(err){ console.error('[v6bg] silver→cash', err); }
        return;
      }
      // Gold → Silver
      if(t.id === 'bankGoldToSilverGo' || t.closest?.('#bankGoldToSilverGo')){
        e.preventDefault(); e.stopImmediatePropagation();
        try {
          const inp = document.getElementById('bankGoldToSilverQty');
          if(!inp) return;
          const gold = +asNum(inp.value).toFixed(4);
          if(gold <= 0){ window.floater?.('Enter a Gold amount', 'bad'); return; }
          if(asNum(State.gold) < gold){ window.floater?.('Need ' + gold + ' 🥇', 'bad'); return; }
          const silver = Math.round(gold * silverPerGold());
          State.gold    = +(asNum(State.gold) - gold).toFixed(4);
          State.credits = asNum(State.credits) + silver;
          window.floater?.('+' + silver.toLocaleString() + ' 🥈 · -' + gold + ' 🥇', 'good');
          window.playPurchaseSound?.();
          inp.value = '';
          const prev = document.getElementById('bankGoldToSilverPreview'); if(prev) prev.textContent = '→ 0 🥈';
          refreshHud();
        } catch(err){ console.error('[v6bg] gold→silver', err); }
        return;
      }
      // Cash → Silver
      if(t.id === 'bankCashToSilverGo' || t.closest?.('#bankCashToSilverGo')){
        e.preventDefault(); e.stopImmediatePropagation();
        try {
          const inp = document.getElementById('bankCashToSilverQty');
          if(!inp) return;
          const cash = Math.max(0, Math.floor(asNum(inp.value)));
          const rate = cashPerSilverBack();
          if(cash < rate){ window.floater?.('Min: ' + rate + ' 💵', 'bad'); return; }
          if(asNum(State.paper) < cash){ window.floater?.('Need ' + cash.toLocaleString() + ' 💵', 'bad'); return; }
          const silver = Math.floor(cash / rate);
          const cashUsed = silver * rate;
          State.paper   = +(asNum(State.paper) - cashUsed).toFixed(2);
          State.credits = asNum(State.credits) + silver;
          window.floater?.('+' + silver.toLocaleString() + ' 🥈 · -' + cashUsed.toLocaleString() + ' 💵', 'good');
          window.playPurchaseSound?.();
          inp.value = '';
          const prev = document.getElementById('bankCashToSilverPreview'); if(prev) prev.textContent = '→ 0 🥈';
          refreshHud();
        } catch(err){ console.error('[v6bg] cash→silver', err); }
        return;
      }
    }, true);

    // ──────────────────────────────────────────────────────────────
    // 2) PROPERLY STACK TOP-RIGHT BUTTONS
    //    Existing buttons in fartworld.html:
    //      🎒 #invToggle           top:80    (inv-toggle class)
    //      💼 #portfolioToggle     top:134   (inv-toggle class)
    //      🏆 #lbToggle            top:80 default → fights inv
    //    Our 🤝 referrals button (.fw-ref-btn) needs to slot in.
    //    Force a clean 54-px stack and uniform styling.
    // ──────────────────────────────────────────────────────────────
    const css = document.createElement('style');
    css.textContent = `
/* Stack order top-down: Inventory, Portfolio, Referrals, Leaderboard */
#invToggle        { top:  80px !important; }
#portfolioToggle  { top: 134px !important; }
#lbToggle         { top: 242px !important; }

/* Match the existing .inv-toggle styling for our new 🤝 button. */
.fw-ref-btn{
  position: fixed !important;
  top: 188px !important;
  right: 14px !important;
  width: 42px !important;
  height: 42px !important;
  border-radius: 12px !important;
  background: rgba(8,18,11,.85) !important;
  border: 2px solid rgba(255,206,74,0.45) !important;
  color: #ffd64d !important;
  font-size: 20px !important;
  font-weight: 700 !important;
  cursor: pointer !important;
  z-index: 33 !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  padding: 0 !important;
  transition: transform .15s ease, border-color .15s ease, box-shadow .15s ease !important;
  box-shadow: 0 6px 14px rgba(0,0,0,.35) !important;
}
.fw-ref-btn:hover{
  background: rgba(255,206,74,0.18) !important;
  border-color: #ffd64d !important;
  box-shadow: 0 0 16px rgba(255,214,77,0.30) !important;
  transform: scale(1.05) !important;
}
`;
    document.head.appendChild(css);

    console.log('[extras-v6bg] ready · bank conv + button stack');
  }
})();
