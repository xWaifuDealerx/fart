// =================================================================
// dev.js — local testing cheats.
// =================================================================
// One-time auto-grant: 100,000,000 silver on first load (per-browser).
// Console helpers under window.dev:
//   dev.giveSilver(n)  — add n silver (default 100M)
//   dev.giveGold(n)    — add n gold (default 1M)
//   dev.giveCash(n)    — add n cash (default 1M)
//   dev.giveAll()      — silver + gold + cash + tools + seeds
//   dev.unlockBoats()  — set State.waveOwn.{boat,plane,yacht} all true
//   dev.resetGrant()   — clear the "already granted" flag so reload re-grants
//   dev.status()       — log current balances
// Press Ctrl+Shift+M to instantly add 100M silver (any time).
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
    // Bump this version to force the auto-grant to fire again
    const GRANT_KEY = 'fw.dev.granted.v4';

    function bigFloater(text){
      // Make a one-off centered floater so it stands out
      const el = document.createElement('div');
      el.style.cssText = 'position:fixed;left:50%;top:30%;transform:translateX(-50%);background:linear-gradient(180deg,rgba(8,28,12,.96),rgba(4,18,8,.96));border:2px solid rgba(255,206,74,.7);color:#ffd64d;font-family:Bangers,Outfit,sans-serif;letter-spacing:1.2px;font-size:26px;padding:14px 26px;border-radius:18px;z-index:300;box-shadow:0 20px 40px rgba(0,0,0,.6),0 0 40px rgba(255,206,74,.25);text-align:center;animation:devPop .35s cubic-bezier(.2,.7,.4,1)';
      el.innerHTML = text;
      document.body.appendChild(el);
      setTimeout(() => { el.style.transition = 'opacity .6s'; el.style.opacity = '0'; }, 2200);
      setTimeout(() => el.remove(), 2900);
    }
    const popAnim = document.createElement('style');
    popAnim.textContent = '@keyframes devPop{from{transform:translateX(-50%) scale(.85);opacity:0}to{transform:translateX(-50%) scale(1);opacity:1}}';
    document.head.appendChild(popAnim);

    function fmt(n){ return (n || 0).toLocaleString(); }

    function asNum(v){ v = Number(v); return Number.isFinite(v) ? v : 0; }
    function giveSilver(n){
      n = asNum(n) || 100000000;
      State.credits = asNum(State.credits) + n;
      try { window.updateHUD && window.updateHUD(); } catch(e){ console.error('[dev] updateHUD', e); }
      try { window.saveState && window.saveState(); } catch(e){ console.error('[dev] saveState', e); }
      bigFloater('+' + fmt(n) + ' \u{1F948} SILVER');
    }
    function giveGold(n){
      n = asNum(n) || 1000000;
      State.gold = asNum(State.gold) + n;
      try { window.updateHUD && window.updateHUD(); } catch(e){}
      try { window.saveState && window.saveState(); } catch(e){}
      bigFloater('+' + fmt(n) + ' \u{1F947} GOLD');
    }
    function giveCash(n){
      n = asNum(n) || 1000000;
      State.paper = asNum(State.paper) + n;
      try { window.updateHUD && window.updateHUD(); } catch(e){}
      try { window.saveState && window.saveState(); } catch(e){}
      bigFloater('+' + fmt(n) + ' \u{1F4B5} CASH');
    }
    function giveAll(){
      State.credits = asNum(State.credits) + 100000000;
      State.gold    = asNum(State.gold)    + 1000000;
      State.paper   = asNum(State.paper)   + 1000000;
      // Tools + crafting essentials
      State.inventory = State.inventory || {};
      const stock = { pickaxe: 1, saw: 1, plastic_bag: 50, paper: 500, ink: 200, cat_food: 100, carrot_seed: 50, weed_seed: 50, jar_empty: 50, sand_bag: 50 };
      for(const k of Object.keys(stock)) State.inventory[k] = (State.inventory[k] || 0) + stock[k];
      // Pickaxe durability
      if(!State.tools) State.tools = {};
      State.tools.pickaxe = { durability: 100 };
      window.updateHUD?.(); window.saveState?.();
      if(typeof window.renderInventory === 'function') window.renderInventory();
      bigFloater(`+100M 🥈 · +1M 🥇 · +1M 💵 · +tools`);
    }
    function unlockBoats(){
      State.waveOwn = State.waveOwn || {};
      State.waveOwn.boat = true; State.waveOwn.plane = true; State.waveOwn.yacht = true;
      try { localStorage.setItem('fw.waveOwn.v1', JSON.stringify(State.waveOwn)); } catch(e){}
      window.saveState?.();
      bigFloater(`🛥 All vessels unlocked at Wave's`);
    }
    function resetGrant(){
      try { localStorage.removeItem(GRANT_KEY); } catch(e){}
      console.log('[dev] grant flag cleared — reload to re-grant 100M silver');
    }
    function status(){
      console.log('[dev] balances:',
        { silver: State.credits, gold: State.gold, cash: State.paper, fake: State.fakeMoney, xp: State.xp, level: State.level });
    }
    window.dev = { giveSilver, giveGold, giveCash, giveAll, unlockBoats, resetGrant, status };

    // ── First-load auto-grant ──
    let granted = false;
    try { granted = !!localStorage.getItem(GRANT_KEY); } catch(e){}
    if(!granted){
      try { localStorage.setItem(GRANT_KEY, '1'); } catch(e){}
      // Slight delay so the HUD has settled
      setTimeout(() => {
        try {
          giveSilver(1000000);
          giveCash(1000000);
          console.log('[dev] 1,000,000 silver + 1,000,000 cash granted. Use window.dev.* in the console for more.');
        } catch(e){
          console.error('[dev] auto-grant failed', e);
        }
      }, 800);
    } else {
      console.log('[dev] Auto-grant already used. Console: window.dev.giveSilver(), giveAll(), unlockBoats(), status(), resetGrant().');
    }

    window.addEventListener('keydown', (e) => {
      if(e.ctrlKey && e.shiftKey && e.code === 'KeyM'){
        e.preventDefault();
        try { giveSilver(100000000); } catch(err){ console.error("[dev]", err); }
      }
    });
  }
})();
