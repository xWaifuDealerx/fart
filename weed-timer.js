// =================================================================
// weed-timer.js — always-visible crop timer panel.
// =================================================================
// Lists EVERY plot that has something planted with a live countdown +
// "READY" state. No longer requires the player to be standing on the
// plot — that was the bug. Also shows distance from player so you know
// which one is closest.
// =================================================================
(function(){
  'use strict';
  function whenReady(){
    if(!window.Player || !window.State || !window.ITEMS){ setTimeout(whenReady, 300); return; }
    // Don't gate on Plots existing — Plots may be empty at init and only
    // populate after the player buys their first plot.
    if(!Array.isArray(window.Plots)){ setTimeout(whenReady, 300); return; }
    init();
  }
  whenReady();

  function init(){
    const Player = window.Player;
    const State = window.State;
    const ITEMS = window.ITEMS;
    const Plots = window.Plots;

    const css = document.createElement('style');
    css.textContent = `
.wt-panel{position:fixed;right:14px;top:90px;display:none;background:linear-gradient(180deg,rgba(10,28,12,.96),rgba(6,18,8,.96));border:2px solid rgba(140,220,90,.55);border-radius:14px;padding:12px 14px;z-index:32;color:#e6ffee;font-family:'Outfit','JetBrains Mono',sans-serif;min-width:240px;max-width:320px;box-shadow:0 14px 28px rgba(0,0,0,.55)}
.wt-panel.show{display:block}
.wt-panel h3{margin:0 0 8px;font-family:'Bangers','Orbitron',sans-serif;font-size:16px;color:#a8e060;letter-spacing:1.1px;text-align:center}
.wt-row{padding:7px 0;border-top:1px solid rgba(140,220,90,.15);font-size:11.5px}
.wt-row:first-of-type{border-top:none}
.wt-row .ttl{font-weight:700;color:#fff1c2;font-size:13px;margin-bottom:3px}
.wt-bar{position:relative;width:100%;height:7px;background:rgba(140,220,90,.15);border:1px solid rgba(140,220,90,.3);border-radius:6px;overflow:hidden;margin:3px 0}
.wt-fill{position:absolute;left:0;top:0;bottom:0;background:linear-gradient(90deg,#5ed060,#a8ff80);transition:width .25s}
.wt-sub{font-size:10.5px;color:rgba(230,255,238,.75);display:flex;justify-content:space-between;margin-top:3px}
.wt-ready{color:#ffd64d;font-weight:700;font-size:12px;margin-top:3px;text-align:center}
.wt-ready b{color:#fff}
.wt-rarity{display:flex;justify-content:center;gap:5px;margin-top:5px;flex-wrap:wrap}
.wt-r{padding:1.5px 5px;border-radius:6px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.15);font-size:9.5px}
.wt-r.green{color:#5ed060}.wt-r.blue{color:#5fb6ff}.wt-r.purple{color:#c890ff}.wt-r.orange{color:#ff9a3a}.wt-r.rainbow{color:#ffce4a}
.wt-result{margin-top:8px;padding:6px 8px;background:rgba(255,206,74,.12);border:1px solid rgba(255,206,74,.4);border-radius:8px;font-size:11px;text-align:center;color:#fff1c2;display:none}
.wt-result.show{display:block}
`;
    document.head.appendChild(css);
    const panel = document.createElement('div');
    panel.className = 'wt-panel';
    panel.innerHTML = '<h3>\u{1F331} CROPS GROWING</h3><div id="wtList"></div><div class="wt-result" id="wtResult"></div>';
    document.body.appendChild(panel);

    function fmtTime(ms){
      const s = Math.max(0, Math.ceil(ms / 1000));
      if(s < 60) return s + 's';
      const m = Math.floor(s / 60), ss = s % 60;
      if(m < 60) return m + 'm ' + ss + 's';
      return Math.floor(m / 60) + 'h ' + (m % 60) + 'm';
    }
    function ownedByMe(plot){
      if(!plot) return false;
      // Owner check — main module sets plot.owner to the player wallet/name.
      // If we can't determine ownership reliably, just show all plots.
      const me = State.wallet || State.name || null;
      if(!plot.owner) return true;
      if(!me) return true;
      return plot.owner === me;
    }

    // ── Harvest result detection (carries over from earlier build) ──
    if(!window._wtAddItemWrap && typeof window.addItem === 'function'){
      window._wtAddItemWrap = true;
      const _origAdd = window.addItem;
      window._weedTierBatch = { count: 0, t: { green:0, blue:0, purple:0, orange:0, rainbow:0 } };
      window.addItem = function(id, qty){
        const r = _origAdd(id, qty);
        const map = { weed_dirt:'green', weed_pineapple:'blue', weed_diesel:'purple', weed_cosmic:'orange', weed_unicorn:'rainbow' };
        const tier = map[id];
        if(tier){
          window._weedTierBatch.count += (qty || 1);
          window._weedTierBatch.t[tier] += (qty || 1);
          clearTimeout(window._weedTierT);
          window._weedTierT = setTimeout(() => {
            const t = window._weedTierBatch.t;
            const parts = [];
            if(t.green)   parts.push('<span class="wt-r green">' + t.green + '× green</span>');
            if(t.blue)    parts.push('<span class="wt-r blue">' + t.blue + '× blue</span>');
            if(t.purple)  parts.push('<span class="wt-r purple">' + t.purple + '× purple</span>');
            if(t.orange)  parts.push('<span class="wt-r orange">' + t.orange + '× orange</span>');
            if(t.rainbow) parts.push('<span class="wt-r rainbow">' + t.rainbow + '× rainbow</span>');
            const res = document.getElementById('wtResult');
            res.innerHTML = '<b>Harvested ' + window._weedTierBatch.count + ' buds!</b><div class="wt-rarity">' + parts.join('') + '</div>';
            res.classList.add('show');
            clearTimeout(window._wtClearT);
            window._wtClearT = setTimeout(() => {
              res.classList.remove('show');
              window._weedTierBatch = { count: 0, t: { green:0, blue:0, purple:0, orange:0, rainbow:0 } };
            }, 7000);
          }, 350);
        }
        return r;
      };
    }

    // Live update every 0.5s
    setInterval(() => {
      const planted = Plots.filter(p => p && p.crop && p.plantedAt && ownedByMe(p));
      if(planted.length === 0){
        panel.classList.remove('show');
        return;
      }
      panel.classList.add('show');
      const lines = [];
      // Sort: ready first, then closest
      function resolveGrowMs(crop){
        const it = ITEMS[crop];
        if(it && it.growMs) return it.growMs;
        for(const k of Object.keys(ITEMS)){
          const c = ITEMS[k];
          if(c && c.harvest === crop && c.growMs) return c.growMs;
        }
        return 1;
      }
      planted.sort((a, b) => {
        const ta = Math.min(1, (Date.now() - a.plantedAt) / resolveGrowMs(a.crop));
        const tb = Math.min(1, (Date.now() - b.plantedAt) / resolveGrowMs(b.crop));
        if((ta >= 1) !== (tb >= 1)) return ta >= 1 ? -1 : 1;
        const da = Math.hypot(Player.pos.x - a.x, Player.pos.z - a.z);
        const db = Math.hypot(Player.pos.x - b.x, Player.pos.z - b.z);
        return da - db;
      });
      for(const plot of planted){
        const item = ITEMS[plot.crop];
        if(!item) continue;
        // growMs lives on the SEED item, not the harvest. Find the seed
        // whose `.harvest` points back to this crop.
        let growMs = item.growMs;
        if(!growMs){
          for(const k of Object.keys(ITEMS)){
            const it = ITEMS[k];
            if(it && it.harvest === plot.crop && it.growMs){ growMs = it.growMs; break; }
          }
        }
        if(!growMs) continue;
        const t = Math.min(1, (Date.now() - plot.plantedAt) / growMs);
        const dist = Math.hypot(Player.pos.x - plot.x, Player.pos.z - plot.z);
        const distStr = dist < 1 ? 'here' : Math.round(dist) + 'm away';
        let body;
        if(t >= 1){
          let rarity = '';
          if(plot.crop === 'weed_seed' || (item.name || '').toLowerCase().includes('weed')){
            rarity = '<div class="wt-rarity"><span class="wt-r green">60%</span><span class="wt-r blue">25%</span><span class="wt-r purple">10%</span><span class="wt-r orange">4%</span><span class="wt-r rainbow">1%</span></div>';
          }
          body = '<div class="wt-ready">\u{1F389} READY · press <b>F</b> to harvest!</div>' + rarity;
          const remain = growMs * (1 - t);
          body = '<div class="wt-bar"><div class="wt-fill" style="width:' + (t * 100).toFixed(1) + '%"></div></div>'
               + '<div class="wt-sub"><span>' + (t * 100).toFixed(0) + '%</span><span>' + fmtTime(remain) + ' left</span></div>';
        }
        lines.push('<div class="wt-row"><div class="ttl">' + (item.icon || '\u{1F331}') + ' ' + (item.name || 'Crop') + ' · <small style="color:rgba(230,255,238,.55);font-size:10px;">' + distStr + '</small></div>' + body + '</div>');
      }
      document.getElementById('wtList').innerHTML = lines.join('');
    }, 500);

    console.log("[weed-timer] always-visible crop panel ready");
  }
})();
