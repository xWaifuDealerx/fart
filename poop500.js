// =================================================================
// poop500.js — Fart&Poop500 holding-based daily silver yield.
// Tracks the player's on-chain holdings of POOP_TOKENS and accrues
// a small daily silver yield like "dividends on shares".
// =================================================================
(function(){
  'use strict';
  function whenReady(){
    if(!window.State || !window.POOP_TOKENS){
      setTimeout(whenReady, 300); return;
    }
    init();
  }
  whenReady();

  function init(){
    const State = window.State;
    const POOP_TOKENS = window.POOP_TOKENS || [];

    // ── State ──
    if(!State.poopHoldings || typeof State.poopHoldings !== "object") State.poopHoldings = {};
    if(typeof State.poopYieldAccrued !== "number") State.poopYieldAccrued = 0;
    if(typeof State.poopYieldLastTs !== "number") State.poopYieldLastTs = Date.now();

    // Yield curve — kept deliberately tiny so this doesn't break the
    // game economy. For every 1 token held you earn this many silver
    // per real-time hour. Scaled with a log curve so whales don't
    // eclipse the rest of the income.
    const SILVER_PER_TOKEN_PER_HOUR = 0.0025;
    const MAX_PER_TOKEN_PER_DAY     = 1200;  // hard cap per token

    function fetchHoldings(){
      // Three sources, best-effort, no network failure ever blocks
      // gameplay:
      //   1) main module's _poopData (RPC-driven), if populated
      //   2) State.poopHoldings (persistent fallback)
      //   3) zero
      const pd = window._poopData || {};
      const out = {};
      for(const t of POOP_TOKENS){
        const dataBal = pd[t.ca]?.balance;
        const stateBal = Number(State.poopHoldings[t.ca] || 0);
        const v = (typeof dataBal === "number" && isFinite(dataBal)) ? dataBal : stateBal;
        out[t.ca] = Math.max(0, Number(v) || 0);
      }
      return out;
    }
    function holdingsSum(h){
      let s = 0;
      for(const ca in h) s += Number(h[ca] || 0);
      return s;
    }
    function yieldPerHour(h){
      let s = 0;
      for(const ca in h){
        const q = Number(h[ca] || 0);
        if(q <= 0) continue;
        // Log scaling: ln(1 + q) keeps small holders relevant
        const scaled = Math.log(1 + q);
        s += scaled * SILVER_PER_TOKEN_PER_HOUR;
      }
      return s;
    }
    function yieldPerDay(h){ return yieldPerHour(h) * 24; }

    function accrue(){
      const now = Date.now();
      const dtHr = Math.max(0, (now - (State.poopYieldLastTs || now)) / 3600_000);
      State.poopYieldLastTs = now;
      const h = fetchHoldings();
      // Persist the latest holdings so the panel still shows numbers
      // when the on-chain fetch hasn't populated yet
      for(const ca of Object.keys(h)) State.poopHoldings[ca] = h[ca];
      const earned = yieldPerHour(h) * dtHr;
      const capped = Math.min(earned, MAX_PER_TOKEN_PER_DAY);
      State.poopYieldAccrued = (State.poopYieldAccrued || 0) + capped;
    }
    setInterval(() => {
      try { accrue(); window.saveState?.(); paint(); } catch(e){}
    }, 30_000);
    // First tick after a beat
    setTimeout(() => { try { accrue(); paint(); } catch(e){} }, 2000);

    // ── UI inside the existing Poop House modal (#poopBg) ──
    // We inject a panel near the top so the player sees their yield.
    function ensurePanel(){
      const host = document.getElementById('poopBg');
      if(!host) return null;
      let panel = host.querySelector('#poop500Panel');
      if(!panel){
        panel = document.createElement('div');
        panel.id = 'poop500Panel';
        panel.style.cssText = "background:linear-gradient(180deg,rgba(168,72,32,.10),rgba(120,52,20,.05));border:1px solid rgba(255,154,77,.45);border-radius:14px;padding:14px;margin:12px 0;color:#fff1c2;font-family:'Outfit','Inter',sans-serif;font-size:12.5px;line-height:1.5;";
        panel.innerHTML = '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;"><div><div style="font-family:Bangers,Orbitron,sans-serif;letter-spacing:1.4px;color:#ff9a4d;font-size:18px;">FART&POOP500 · YIELD</div><div style="font-size:11px;color:rgba(230,255,238,.6);margin-top:2px;">Hold tokens → earn silver. Real on-chain holdings; on-chain price; small in-game dividend.</div></div><button id="poopYieldClaim" style="background:linear-gradient(135deg,#ffce4a,#fff1c2);color:#1a1408;border:0;padding:9px 18px;border-radius:10px;font-family:Outfit,sans-serif;font-weight:800;font-size:11.5px;letter-spacing:.9px;cursor:pointer;text-transform:uppercase;">Claim</button></div><div id="poop500Stats" style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:10px;"></div><div id="poop500Hold"></div>';
        // Insert near top of the modal body
        const head = host.querySelector('.poop-head, .poop-card h2, h2');
        if(head && head.parentNode){
          head.parentNode.insertBefore(panel, head.nextSibling);
        } else {
          host.querySelector('.poop-card, div')?.appendChild(panel);
        }
        host.querySelector('#poopYieldClaim').addEventListener('click', () => {
          const amt = Math.floor(State.poopYieldAccrued || 0);
          if(amt <= 0){ window.floater?.('Nothing to claim yet', 'bad'); return; }
          State.credits = (State.credits || 0) + amt;
          State.poopYieldAccrued -= amt;
          window.floater?.('+' + amt.toLocaleString() + ' \u{1F948} from FART&POOP500', 'good');
          window.playPurchaseSound?.();
          window.saveState?.(); window.updateHUD?.();
          paint();
        });
      }
      return panel;
    }
    function paint(){
      const panel = ensurePanel();
      if(!panel) return;
      const h = fetchHoldings();
      const total = holdingsSum(h);
      const perHr = yieldPerHour(h);
      const perDay = perHr * 24;
      const stats = panel.querySelector('#poop500Stats');
      if(stats){
        stats.innerHTML = ''
          + '<div style="background:rgba(255,154,77,.07);border:1px solid rgba(255,154,77,.25);border-radius:10px;padding:10px;text-align:center;"><div style="font-size:10.5px;color:rgba(230,255,238,.65);letter-spacing:.8px;text-transform:uppercase;">Total tokens</div><div style="font-family:Outfit,sans-serif;font-size:22px;font-weight:800;color:#fff1c2;">' + (total > 1e6 ? (total / 1e6).toFixed(2) + 'M' : total.toLocaleString(undefined, { maximumFractionDigits: 2 })) + '</div></div>'
          + '<div style="background:rgba(255,154,77,.07);border:1px solid rgba(255,154,77,.25);border-radius:10px;padding:10px;text-align:center;"><div style="font-size:10.5px;color:rgba(230,255,238,.65);letter-spacing:.8px;text-transform:uppercase;">Yield · 24h</div><div style="font-family:Outfit,sans-serif;font-size:22px;font-weight:800;color:#5ff09c;">' + perDay.toFixed(1) + ' \u{1F948}</div></div>'
          + '<div style="background:rgba(255,154,77,.07);border:1px solid rgba(255,154,77,.25);border-radius:10px;padding:10px;text-align:center;"><div style="font-size:10.5px;color:rgba(230,255,238,.65);letter-spacing:.8px;text-transform:uppercase;">Accrued</div><div style="font-family:Outfit,sans-serif;font-size:22px;font-weight:800;color:#ffce4a;">' + (State.poopYieldAccrued || 0).toFixed(1) + ' \u{1F948}</div></div>';
      }
      const hold = panel.querySelector('#poop500Hold');
      if(hold){
        const rows = POOP_TOKENS.map(t => {
          const q = Math.max(0, Number(h[t.ca] || 0));
          const qHr = Math.log(1 + q) * SILVER_PER_TOKEN_PER_HOUR;
          return '<div style="display:grid;grid-template-columns:1fr 100px 110px;gap:8px;align-items:center;padding:6px 10px;font-size:11.5px;border-bottom:1px solid rgba(255,154,77,.10);"><span><b style="color:#fff1c2;">' + (t.sym || t.name || '???') + '</b> <span style="color:rgba(230,255,238,.45);font-family:JetBrains Mono,monospace;font-size:10.5px;">' + (t.ca || '').slice(0, 6) + '…</span></span><span style="text-align:right;font-family:JetBrains Mono,monospace;color:#fff1c2;">' + (q > 1e6 ? (q / 1e6).toFixed(2) + 'M' : q.toLocaleString(undefined, { maximumFractionDigits: 2 })) + '</span><span style="text-align:right;font-family:JetBrains Mono,monospace;color:#5ff09c;">' + (qHr * 24).toFixed(2) + ' \u{1F948}/day</span></div>';
        }).join('');
        hold.innerHTML = '<div style="font-size:11px;color:rgba(230,255,238,.65);letter-spacing:.7px;text-transform:uppercase;margin-bottom:4px;">Holdings · daily yield breakdown</div>' + rows;
      }
    }
    // Re-paint when the Poop modal opens
    const poopBg = document.getElementById('poopBg');
    if(poopBg){
      const obs = new MutationObserver(() => { if(poopBg.classList.contains('show')) paint(); });
      obs.observe(poopBg, { attributes: true, attributeFilter: ['class'] });
    }
    // First paint attempt
    setTimeout(paint, 1500);
    setInterval(paint, 30_000);

    console.log('[poop500] holding yield ready');
  }
})();
