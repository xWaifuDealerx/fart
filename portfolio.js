// =================================================================
// portfolio.js — Player asset panel (off-chain + on-chain)
// =================================================================
// Lists every asset the player actually holds:
//   - Off-chain: Silver, Cash, Fake Cash, Gold (always shown)
//   - On-chain $FARTPRINT (shown if connected)
//   - FART&POOP500 coins (shown only if balance > 0)
//   - FartCup nation coins (shown only if balance > 0)
// Loaded with defer from fartworld.html. Reads State + cached price
// maps off window which the main module exposes before close.
(function(){
  'use strict';

  // ── CSS ──
  const style = document.createElement('style');
  style.textContent = `
.pf-bg { position: fixed; inset: 0; background: rgba(0,0,0,0.78); backdrop-filter: blur(12px); display: none; align-items: center; justify-content: center; z-index: 60; padding: 20px; }
.pf-bg.show { display: flex; }
.pf-card { max-width: 640px; width: 100%; max-height: 92vh; background: linear-gradient(180deg, rgba(8,18,12,0.97), rgba(5,14,9,0.97)); border: 2px solid rgba(95,240,156,0.42); border-radius: 22px; overflow: hidden; display: flex; flex-direction: column; box-shadow: 0 30px 80px rgba(0,0,0,0.6), 0 0 80px rgba(46,224,107,0.20); }
.pf-head { display: flex; align-items: center; justify-content: space-between; padding: 16px 22px; border-bottom: 1px solid rgba(95,240,156,0.20); background: linear-gradient(90deg, rgba(46,224,107,0.10), transparent); }
.pf-head h2 { font-family: 'Bangers', 'Orbitron', sans-serif; font-size: 30px; letter-spacing: 2.2px; background: linear-gradient(135deg, #5ff09c, #46f08a, #ffd64d); -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent; filter: drop-shadow(0 0 12px rgba(46,224,107,0.45)); }
.pf-head .close, .pf-head .refresh { background: transparent; border: 0; color: rgba(230,255,238,0.55); font-size: 22px; cursor: pointer; line-height: 1; padding: 4px 10px; }
.pf-head .close:hover, .pf-head .refresh:hover { color: #5ff09c; }
.pf-body { overflow-y: auto; padding: 16px 20px 22px; flex: 1; }
.pf-section { margin-bottom: 20px; }
.pf-section h3 { font-family: 'Orbitron', sans-serif; font-weight: 800; font-size: 11px; letter-spacing: 2px; text-transform: uppercase; color: rgba(95,240,156,0.85); margin-bottom: 8px; border-left: 3px solid #5ff09c; padding-left: 10px; }
.pf-row { display: grid; grid-template-columns: 36px 1fr auto auto; gap: 12px; align-items: center; padding: 8px 12px; background: rgba(46,224,107,0.05); border: 1px solid rgba(46,224,107,0.16); border-radius: 10px; margin-bottom: 6px; }
.pf-row.crypto { background: rgba(255,214,77,0.05); border-color: rgba(255,214,77,0.18); }
.pf-row.fake { background: rgba(255,90,77,0.07); border-color: rgba(255,90,77,0.20); }
.pf-row .ico { width: 36px; height: 36px; border-radius: 8px; background-size: cover; background-position: center; background-color: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.10); display: grid; place-items: center; font-size: 20px; }
.pf-row .meta { display: flex; flex-direction: column; min-width: 0; }
.pf-row .nm { font-family: 'Orbitron', sans-serif; font-weight: 800; font-size: 13px; color: #e6ffee; }
.pf-row .sub { font-family: 'JetBrains Mono', monospace; font-size: 10px; color: rgba(230,255,238,0.5); margin-top: 2px; }
.pf-row .qty { font-family: 'Orbitron', sans-serif; font-weight: 900; font-size: 14px; color: #ffd64d; text-align: right; }
.pf-row .val { font-family: 'JetBrains Mono', monospace; font-size: 10.5px; color: rgba(230,255,238,0.55); text-align: right; margin-top: 2px; }
.pf-empty { color: rgba(230,255,238,0.4); font-family: 'JetBrains Mono', monospace; font-size: 11px; text-align: center; padding: 12px 0; }
.pf-foot { font-family: 'JetBrains Mono', monospace; font-size: 10px; color: rgba(230,255,238,0.42); text-align: center; padding-top: 6px; border-top: 1px solid rgba(95,240,156,0.10); margin-top: 8px; }
`;
  document.head.appendChild(style);

  // ── Modal HTML ──
  const el = document.createElement('div');
  el.innerHTML = `
<div class="pf-bg" id="pfBg">
  <div class="pf-card">
    <div class="pf-head">
      <h2>💼 PORTFOLIO</h2>
      <div>
        <button class="refresh" id="pfRefresh" title="Refresh on-chain">↻</button>
        <button class="close" id="pfClose">×</button>
      </div>
    </div>
    <div class="pf-body" id="pfBody"></div>
  </div>
</div>
  `;
  document.body.appendChild(el.firstElementChild);

  const $ = (id) => document.getElementById(id);
  $('pfClose').addEventListener('click', () => $('pfBg').classList.remove('show'));
  $('pfBg').addEventListener('click', (e) => { if(e.target.id === "pfBg") $('pfBg').classList.remove('show'); });

  function fmtUsd(n){
    if(n == null || isNaN(n) || n <= 0) return "—";
    if(n < 0.01) return "$" + n.toExponential(2);
    if(n < 1000) return "$" + n.toFixed(2);
    if(n < 1e6)  return "$" + (n / 1e3).toFixed(2) + "K";
    if(n < 1e9)  return "$" + (n / 1e6).toFixed(2) + "M";
    return "$" + (n / 1e9).toFixed(2) + "B";
  }
  function fmtQty(n){
    if(n == null || isNaN(n)) return "—";
    if(n >= 1e6) return (n / 1e6).toFixed(2) + "M";
    if(n >= 1e3) return (n / 1e3).toFixed(2) + "K";
    if(Number.isInteger(n)) return String(n);
    return Number(n.toFixed(4)).toString();
  }
  function esc(s){ return String(s||"").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c])); }
  function flagImg(code){ return `https://flagcdn.com/w80/${code}.png`; }

  // ── Build the modal contents ──
  function render(){
    const S = window.State || {};
    const POOP = window.POOP_TOKENS || [];
    const FC   = window.FARTCUP_COINS || [];
    const poopD = window._poopData || {};
    const fcD   = window._fcData   || {};

    const lines = [];

    // ── Off-chain currency ──
    const silver = S.credits || 0;
    const cash   = S.paper   || 0;
    const fake   = S.fakeMoney || 0;
    const gold   = S.gold || 0;
    lines.push('<div class="pf-section"><h3>Off-chain Currency</h3>');
    lines.push(currencyRow("🥈", "Silver",     fmtQty(silver), "in-game earnings"));
    lines.push(currencyRow("💵", "Cash",       fmtQty(cash),   "from Bank / Laundry"));
    lines.push(currencyRow("🪙", "Fake Cash",  fmtQty(fake),   "printed (illegal!)", "fake"));
    lines.push(currencyRow("🥇", "Gold",       gold.toFixed(4), "scarce — never depreciates"));
    lines.push('</div>');

    // ── On-chain crypto ──
    lines.push('<div class="pf-section"><h3>On-chain (Solana)</h3>');
    if(!S.wallet){
      lines.push('<div class="pf-empty">Connect your Phantom wallet to see on-chain holdings.</div>');
    } else {
      let any = false;
      // $FARTPRINT
      const fp = Number(S.fartprintBalance) || 0;
      if(fp > 0){
        any = true;
        lines.push(`<div class="pf-row crypto">
          <div class="ico" style="background:linear-gradient(135deg,#5ff09c,#ffd64d);color:#042913;font-family:Orbitron;font-weight:900;font-size:11px;">FP</div>
          <div class="meta"><div class="nm">$FARTPRINT</div><div class="sub">native token</div></div>
          <div><div class="qty">${fmtQty(fp)}</div><div class="val">on-chain</div></div>
          <div></div>
        </div>`);
      }
      // FART&POOP500
      const poopOwned = POOP.filter(t => (poopD[t.ca]?.balance || 0) > 0);
      if(poopOwned.length){
        any = true;
        for(const t of poopOwned){
          const d = poopD[t.ca] || {};
          const bal = d.balance || 0;
          const usd = bal * (d.price || 0);
          const img = d.image ? `style="background-image:url('${d.image.replace(/'/g,'%27')}')"` : "";
          lines.push(`<div class="pf-row crypto">
            <div class="ico" ${img}>${d.image ? "" : esc(t.sym.slice(0,3))}</div>
            <div class="meta"><div class="nm">$${esc(t.sym)}</div><div class="sub">FART&amp;POOP500</div></div>
            <div><div class="qty">${fmtQty(bal)}</div><div class="val">${fmtUsd(usd)}</div></div>
            <div></div>
          </div>`);
        }
      }
      // FartCup nations
      const fcOwned = FC.filter(c => (fcD[c.ca]?.balance || 0) > 0);
      if(fcOwned.length){
        any = true;
        // Sort by USD value descending
        fcOwned.sort((a, b) => {
          const ua = (fcD[a.ca]?.balance || 0) * (fcD[a.ca]?.price || 0);
          const ub = (fcD[b.ca]?.balance || 0) * (fcD[b.ca]?.price || 0);
          return ub - ua;
        });
        for(const c of fcOwned){
          const d = fcD[c.ca] || {};
          const bal = d.balance || 0;
          const usd = bal * (d.price || 0);
          lines.push(`<div class="pf-row crypto">
            <div class="ico" style="background-image:url('${flagImg(c.code)}');"></div>
            <div class="meta"><div class="nm">$${esc(c.sym)}</div><div class="sub">Fart Cup nation</div></div>
            <div><div class="qty">${fmtQty(bal)}</div><div class="val">${fmtUsd(usd)}</div></div>
            <div></div>
          </div>`);
        }
      }
      if(!any){
        lines.push('<div class="pf-empty">No on-chain tokens detected. Buy some at the Fart Cup, Poop House, or Printr.</div>');
      }
    }
    lines.push('</div>');

    lines.push(`<div class="pf-foot">Updated ${new Date().toTimeString().slice(0, 8)} · prices via DexScreener · balances via Solana RPC</div>`);
    $('pfBody').innerHTML = lines.join("");
  }

  function currencyRow(icon, name, qty, sub, cls){
    return `<div class="pf-row ${cls || ''}">
      <div class="ico" style="background:transparent;border:0;font-size:24px;">${icon}</div>
      <div class="meta"><div class="nm">${esc(name)}</div><div class="sub">${esc(sub)}</div></div>
      <div><div class="qty">${qty}</div></div>
      <div></div>
    </div>`;
  }

  // ── Open + refresh ──
  async function openPortfolio(){
    $('pfBg').classList.add('show');
    render();
    // Fire off background refreshes — when they land, re-render so the
    // panel updates without making the user wait.
    try { if(window.refreshFartprintBalance) await window.refreshFartprintBalance(); } catch(_){}
    try { if(window.fcFetchPrices)   window.fcFetchPrices()  .then(render).catch(()=>{}); } catch(_){}
    try { if(window.poopFetchPrices) window.poopFetchPrices().then(render).catch(()=>{}); } catch(_){}
    try { if(window.fcFetchBalances) window.fcFetchBalances().then(async ()=>{
      // Also pull poop balances using the same parsed accounts list
      await fetchPoopBalances();
      render();
    }).catch(()=>{}); } catch(_){}
    render();
  }
  window.openPortfolio = openPortfolio;

  // Fetch POOP token balances using a single getTokenAccountsByOwner call
  async function fetchPoopBalances(){
    const S = window.State;
    const POOP = window.POOP_TOKENS;
    if(!S || !S.wallet || !POOP) return;
    try {
      const rpcs = [
        "https://solana-rpc.publicnode.com",
        "https://rpc.ankr.com/solana",
        "https://api.mainnet-beta.solana.com",
      ];
      const TOKEN_PROG = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
      const body = JSON.stringify({
        jsonrpc: "2.0", id: 1, method: "getTokenAccountsByOwner",
        params: [S.wallet, { programId: TOKEN_PROG }, { encoding: "jsonParsed" }],
      });
      let accs;
      for(const url of rpcs){
        try {
          const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body });
          if(!r.ok) continue;
          const j = await r.json();
          if(j?.result?.value){ accs = j.result.value; break; }
        } catch(_){}
      }
      if(!accs) return;
      const mintToBal = {};
      for(const a of accs){
        try {
          const info = a.account.data.parsed.info;
          const amt = Number(info.tokenAmount.uiAmount) || 0;
          if(amt > 0) mintToBal[info.mint] = (mintToBal[info.mint] || 0) + amt;
        } catch(_){}
      }
      const pd = window._poopData;
      for(const t of POOP){
        if(pd[t.ca]) pd[t.ca].balance = mintToBal[t.ca] || 0;
        else pd[t.ca] = { balance: mintToBal[t.ca] || 0 };
      }
    } catch(_){}
  }

  // Wire up the toolbar button + P keyboard shortcut
  function wire(){
    const btn = document.getElementById('portfolioToggle');
    if(btn){
      btn.addEventListener('click', () => {
        if($('pfBg').classList.contains('show')){
          $('pfBg').classList.remove('show');
        } else {
          openPortfolio();
        }
      });
    }
    document.getElementById('pfRefresh').addEventListener('click', openPortfolio);
    window.addEventListener('keydown', (e) => {
      if(e.code === "KeyP"){
        // Skip when typing in chat or any input
        const a = document.activeElement;
        if(a && (a.tagName === "INPUT" || a.tagName === "TEXTAREA")) return;
        if($('pfBg').classList.contains('show')) $('pfBg').classList.remove('show');
        else openPortfolio();
      }
    });
  }
  // Wait until DOM is ready
  if(document.readyState === "loading"){
    document.addEventListener('DOMContentLoaded', wire);
  } else {
    wire();
  }

  console.log("[Portfolio] ready");
})();
