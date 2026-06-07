// =================================================================
// bank-fix.js — robust silver↔gold + silver↔cash + gold↔silver
// conversion handlers, attached on top of the main module's handlers.
// =================================================================
// Re-uses State + window helpers so it works alongside the original
// code. If the inputs/buttons exist, this replaces the click flow with
// a coerced, error-reported version that never silently drops a tx.
// =================================================================
(function(){
  'use strict';
  function whenReady(){
    if(!window.State || !window.updateHUD || !window.saveState){
      setTimeout(whenReady, 300); return;
    }
    init();
  }
  whenReady();

  function init(){
    const State = window.State;
    // Rate is dynamic now — pulled from the main module each call so the
    // inflation drift (+1 silver/day) is reflected in every conversion.
    function rate(){
      if(typeof window.silverPerGold === "function") return window.silverPerGold();
      return 100000;
    }
    // Cash forward + buyback also inflate over time. Pull live each call.
    function paperPerSilver(){
      if(typeof window.paperPerSilver === "function") return window.paperPerSilver();
      return 50;
    }
    function cashPerSilverBack(){
      if(typeof window.cashPerSilverBack === "function") return window.cashPerSilverBack();
      return 100;
    }
    const GOLD_MIN_QTY = 0.01;

    function asNum(v){ v = Number(v); return Number.isFinite(v) ? v : 0; }
    function fmt(n){ return Number(n).toLocaleString(); }
    function refresh(){
      try { window.updateHUD?.(); } catch(e){}
      try { window.saveState?.(); } catch(e){}
      try {
        const s = document.getElementById('bankSilver'); if(s) s.textContent = fmt(asNum(State.credits));
        const p = document.getElementById('bankPaper');  if(p) p.textContent = fmt(asNum(State.paper));
        const g = document.getElementById('bankGold');   if(g) g.textContent = (asNum(State.gold)).toFixed(4);
      } catch(e){}
    }

    function attach(){
      // ── Silver → Gold ──
      const goBtn = document.getElementById('bankGoldGo');
      const goInput = document.getElementById('bankGoldQty');
      if(goBtn && goInput && !goBtn._fixWired){
        goBtn._fixWired = true;
        // Remove any old listeners by cloning the node
        const clone = goBtn.cloneNode(true);
        goBtn.parentNode.replaceChild(clone, goBtn);
        clone._fixWired = true;
        clone.addEventListener('click', () => {
          try {
            const silver = Math.max(0, Math.floor(asNum(goInput.value)));
            const r = rate();
            const minSilverForGold = Math.round(GOLD_MIN_QTY * r);
            if(silver < minSilverForGold){
              window.floater?.("Min spend: " + fmt(minSilverForGold) + " \u{1F948}", "bad");
              return;
            }
            const have = asNum(State.credits);
            if(have < silver){
              window.floater?.("Need " + fmt(silver) + " \u{1F948}", "bad");
              return;
            }
            const gold = +(silver / r).toFixed(4);
            State.credits = +(have - silver).toFixed(2);
            State.gold    = +((asNum(State.gold)) + gold).toFixed(4);
            window.floater?.("+" + gold.toFixed(4) + " \u{1F947} Gold · -" + fmt(silver) + " \u{1F948}", "good");
            window.playPurchaseSound?.();
            refresh();
            goInput.value = "";
            const prev = document.getElementById('bankGoldPreview');
            if(prev) prev.textContent = "→ 0.0000 \u{1F947}";
          } catch(err){
            console.error('[bank-fix] silver→gold', err);
            window.floater?.("Bank glitched — see console", "bad");
          }
        });
      }
      if(goInput && !goInput._fixWired){
        goInput._fixWired = true;
        goInput.addEventListener('input', () => {
          const silver = Math.max(0, Math.floor(asNum(goInput.value)));
          const gold = silver / rate();
          const prev = document.getElementById('bankGoldPreview');
          if(prev) prev.textContent = "→ " + gold.toFixed(4) + " \u{1F947}";
        });
      }

      // ── Silver → Cash ──
      const cashBtn = document.getElementById('bankPaperGo');
      const cashInput = document.getElementById('bankPaperQty');
      if(cashBtn && cashInput && !cashBtn._fixWired){
        cashBtn._fixWired = true;
        const c2 = cashBtn.cloneNode(true);
        cashBtn.parentNode.replaceChild(c2, cashBtn);
        c2._fixWired = true;
        c2.addEventListener('click', () => {
          try {
            const silver = Math.max(0, Math.floor(asNum(cashInput.value)));
            if(silver <= 0){ window.floater?.("Enter a Silver amount", "bad"); return; }
            const have = asNum(State.credits);
            if(have < silver){ window.floater?.("Need " + fmt(silver) + " \u{1F948}", "bad"); return; }
            const cash = silver * paperPerSilver();
            State.credits = +(have - silver).toFixed(2);
            State.paper   = asNum(State.paper) + cash;
            window.floater?.("+" + fmt(cash) + " \u{1F4B5} · -" + fmt(silver) + " \u{1F948}", "good");
            window.playPurchaseSound?.();
            refresh();
            cashInput.value = "";
            const prev = document.getElementById('bankPaperPreview');
            if(prev) prev.textContent = "→ 0 \u{1F4B5}";
          } catch(err){
            console.error('[bank-fix] silver→cash', err);
            window.floater?.("Bank glitched — see console", "bad");
          }
        });
      }

      // ── Cash → Silver (buyback rate) ──
      const c2sBtn = document.getElementById('bankCashToSilverGo');
      const c2sInput = document.getElementById('bankCashToSilverQty');
      if(c2sBtn && c2sInput && !c2sBtn._fixWired){
        c2sBtn._fixWired = true;
        const c = c2sBtn.cloneNode(true);
        c2sBtn.parentNode.replaceChild(c, c2sBtn);
        c._fixWired = true;
        c.addEventListener('click', () => {
          try {
            const cash = Math.max(0, Math.floor(asNum(c2sInput.value)));
            if(cash < cashPerSilverBack()){ window.floater?.("Min: " + cashPerSilverBack() + " \u{1F4B5}", "bad"); return; }
            const have = asNum(State.paper);
            if(have < cash){ window.floater?.("Need " + fmt(cash) + " \u{1F4B5}", "bad"); return; }
            const silver = Math.floor(cash / cashPerSilverBack());
            const cashUsed = silver * cashPerSilverBack();
            State.paper   = +(have - cashUsed).toFixed(2);
            State.credits = asNum(State.credits) + silver;
            window.floater?.("+" + fmt(silver) + " \u{1F948} · -" + fmt(cashUsed) + " \u{1F4B5}", "good");
            window.playPurchaseSound?.();
            refresh();
            c2sInput.value = "";
            const prev = document.getElementById('bankCashToSilverPreview');
            if(prev) prev.textContent = "→ 0 \u{1F948}";
          } catch(err){
            console.error('[bank-fix] cash→silver', err);
            window.floater?.("Bank glitched — see console", "bad");
          }
        });
      }

      // ── Gold → Silver ──
      const g2sBtn = document.getElementById('bankGoldToSilverGo');
      const g2sInput = document.getElementById('bankGoldToSilverQty');
      if(g2sBtn && g2sInput && !g2sBtn._fixWired){
        g2sBtn._fixWired = true;
        const c = g2sBtn.cloneNode(true);
        g2sBtn.parentNode.replaceChild(c, g2sBtn);
        c._fixWired = true;
        c.addEventListener('click', () => {
          try {
            const goldRaw = asNum(g2sInput.value);
            const gold = +goldRaw.toFixed(4);
            if(gold <= 0){ window.floater?.("Enter a Gold amount", "bad"); return; }
            const have = asNum(State.gold);
            if(have < gold){ window.floater?.("Need " + gold + " \u{1F947}", "bad"); return; }
            const silver = Math.round(gold * rate());
            State.gold    = +(have - gold).toFixed(4);
            State.credits = asNum(State.credits) + silver;
            window.floater?.("+" + fmt(silver) + " \u{1F948} · -" + gold + " \u{1F947}", "good");
            window.playPurchaseSound?.();
            refresh();
            g2sInput.value = "";
            const prev = document.getElementById('bankGoldToSilverPreview');
            if(prev) prev.textContent = "→ 0 \u{1F948}";
          } catch(err){
            console.error('[bank-fix] gold→silver', err);
            window.floater?.("Bank glitched — see console", "bad");
          }
        });
      }
    }

    // moment our cloned buttons are visible).
    attach();
    const bg = document.getElementById('bankBg');
    if(bg){
      const obs = new MutationObserver(() => attach());
      obs.observe(bg, { attributes: true, attributeFilter: ['class'] });
    }
    setInterval(attach, 5000);
    console.log('[bank-fix] dynamic-rate handlers installed');
  }
})();
