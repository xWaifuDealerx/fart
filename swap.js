// =================================================================
// swap.js — Native in-game Jupiter swap (Phantom sign)
// =================================================================
// Why a separate file: the main fartworld.html is at the editor's
// size ceiling. This module exposes window.openNativeSwap(ca) and
// gets called by both Fart Cup + Poop House BUY buttons.
//
// Flow:
//   1. User clicks BUY in the game → opens this modal
//   2. Picks a SOL amount (0.01 / 0.05 / 0.1 / custom)
//   3. Modal hits Jupiter quote API → shows estimated tokens received
//   4. Confirm Swap → Jupiter swap API → Phantom signs + sends
//   5. Display tx signature + Solscan link
// =================================================================
(function(){
  'use strict';

  const SOL_MINT = "So11111111111111111111111111111111111111112";
  const QUOTE_URL = "https://quote-api.jup.ag/v6/quote";
  const SWAP_URL  = "https://quote-api.jup.ag/v6/swap";

  // Look up token metadata from the global registries the main module
  // exposed on window. Falls back to "$CA" if neither has it.
  function tokenInfo(ca){
    const fcMap   = window.FARTCUP_COINS || [];
    const poopArr = window.POOP_TOKENS   || [];
    const fc = fcMap.find(c => c.ca === ca);
    if(fc){
      const code = fc.code;
      return {
        ca,
        sym: fc.sym,
        name: "Fart " + (code ? code.toUpperCase() : fc.sym),
        img: `https://flagcdn.com/w160/${code}.png`,
        kind: "fartcup",
      };
    }
    const pp = poopArr.find(t => t.ca === ca);
    if(pp){
      const d = (window._poopData || {})[ca] || {};
      return {
        ca,
        sym: pp.sym,
        name: pp.sym,
        img: d.image || null,
        kind: "poop",
      };
    }
    return { ca, sym: ca.slice(0, 6), name: "Token " + ca.slice(0, 6), img: null, kind: "unknown" };
  }

  // ── CSS ──
  const style = document.createElement('style');
  style.textContent = `
.swap-bg { position: fixed; inset: 0; background: rgba(0,0,0,.82); backdrop-filter: blur(14px); display: none; align-items: center; justify-content: center; z-index: 80; padding: 20px; }
.swap-bg.show { display: flex; }
.swap-card { max-width: 460px; width: 100%; max-height: 92vh; background: linear-gradient(180deg, rgba(8,18,12,.97), rgba(5,14,9,.97)); border: 2px solid rgba(95,240,156,.45); border-radius: 22px; overflow: hidden; display: flex; flex-direction: column; box-shadow: 0 30px 80px rgba(0,0,0,.6), 0 0 60px rgba(46,224,107,.25); }
.swap-head { display: flex; align-items: center; justify-content: space-between; padding: 14px 20px; border-bottom: 1px solid rgba(95,240,156,.25); background: linear-gradient(90deg, rgba(46,224,107,.10), transparent); }
.swap-head h2 { font-family: 'Bangers','Orbitron',sans-serif; font-size: 24px; letter-spacing: 2.2px; color: #5ff09c; }
.swap-head .close { background: transparent; border: 0; color: rgba(230,255,238,.55); font-size: 22px; cursor: pointer; line-height: 1; }
.swap-body { padding: 18px 22px; overflow-y: auto; }
.swap-token { display: flex; align-items: center; gap: 14px; padding: 12px 14px; background: rgba(255,214,77,.06); border: 1px solid rgba(255,214,77,.22); border-radius: 14px; margin-bottom: 16px; }
.swap-token .ico { width: 48px; height: 48px; border-radius: 12px; background-size: cover; background-position: center; background-color: rgba(255,255,255,.05); border: 1px solid rgba(255,255,255,.10); display: grid; place-items: center; font-size: 22px; color: #ffd64d; font-weight: 800; }
.swap-token .meta { flex: 1; }
.swap-token .name { font-family: 'Orbitron',sans-serif; font-weight: 800; font-size: 15px; color: #e6ffee; }
.swap-token .ca { font-family: 'JetBrains Mono',monospace; font-size: 10px; color: rgba(230,255,238,.42); margin-top: 2px; }
.swap-label { font-family: 'JetBrains Mono',monospace; font-size: 10.5px; color: rgba(230,255,238,.55); letter-spacing: 1.2px; text-transform: uppercase; margin-bottom: 6px; }
.swap-input-row { display: grid; grid-template-columns: 1fr auto; gap: 10px; align-items: center; padding: 12px 14px; background: rgba(46,224,107,.06); border: 1px solid rgba(46,224,107,.22); border-radius: 12px; margin-bottom: 8px; }
.swap-input-row input { background: transparent; border: 0; color: #e6ffee; font-family: 'Orbitron',sans-serif; font-weight: 800; font-size: 20px; outline: none; width: 100%; }
.swap-input-row .unit { font-family: 'JetBrains Mono',monospace; font-size: 14px; font-weight: 800; color: #ffd64d; }
.swap-presets { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; margin-bottom: 12px; }
.swap-preset { background: rgba(46,224,107,.06); border: 1px solid rgba(46,224,107,.22); border-radius: 8px; color: #5ff09c; padding: 6px; font-family: 'JetBrains Mono',monospace; font-size: 11px; cursor: pointer; }
.swap-preset:hover { background: rgba(46,224,107,.15); }
.swap-quote { padding: 12px 14px; background: rgba(255,214,77,.05); border: 1px solid rgba(255,214,77,.20); border-radius: 12px; margin-bottom: 14px; }
.swap-quote .row { display: flex; justify-content: space-between; font-family: 'JetBrains Mono',monospace; font-size: 12px; color: rgba(230,255,238,.7); margin-bottom: 4px; }
.swap-quote .row b { color: #ffd64d; font-family: 'Orbitron',sans-serif; font-weight: 800; }
.swap-quote .row.recv b { color: #5ff09c; font-size: 16px; }
.swap-cta { width: 100%; background: linear-gradient(135deg, #46f08a, #5ff09c); color: #042913; border: 0; padding: 14px; border-radius: 100px; font-family: 'Orbitron',sans-serif; font-weight: 900; font-size: 13px; letter-spacing: 1.4px; text-transform: uppercase; cursor: pointer; box-shadow: 0 8px 20px rgba(95,240,156,.35); }
.swap-cta:hover:not(:disabled) { transform: translateY(-1px); filter: brightness(1.08); }
.swap-cta:disabled { opacity: .45; cursor: not-allowed; box-shadow: none; }
.swap-status { font-family: 'JetBrains Mono',monospace; font-size: 11.5px; color: rgba(230,255,238,.7); padding: 10px 12px; background: rgba(255,255,255,.04); border-radius: 10px; margin-top: 10px; word-break: break-all; }
.swap-status.err { color: #ff7a6e; background: rgba(255,90,77,.06); border: 1px solid rgba(255,90,77,.25); }
.swap-status.ok  { color: #5ff09c; background: rgba(46,224,107,.06); border: 1px solid rgba(95,240,156,.25); }
.swap-status a { color: inherit; text-decoration: underline; }
.swap-spin { display: inline-block; width: 12px; height: 12px; border: 2px solid currentColor; border-right-color: transparent; border-radius: 50%; animation: swapSpin .8s linear infinite; vertical-align: middle; margin-right: 6px; }
@keyframes swapSpin { to { transform: rotate(360deg); } }
.swap-foot { font-family: 'JetBrains Mono',monospace; font-size: 10px; color: rgba(230,255,238,.4); text-align: center; margin-top: 10px; }
`;
  document.head.appendChild(style);

  // ── Modal HTML (built once) ──
  const wrap = document.createElement('div');
  wrap.innerHTML = `
<div class="swap-bg" id="swapBg">
  <div class="swap-card">
    <div class="swap-head"><h2>💱 BUY ON SOLANA</h2><button class="close" id="swapClose">×</button></div>
    <div class="swap-body">
      <div class="swap-token">
        <div class="ico" id="swapIco">?</div>
        <div class="meta"><div class="name" id="swapName">Token</div><div class="ca" id="swapCa">—</div></div>
      </div>
      <div class="swap-label">You pay (SOL)</div>
      <div class="swap-input-row">
        <input id="swapAmt" type="number" min="0" step="0.001" value="0.01" autocomplete="off" />
        <span class="unit">SOL</span>
      </div>
      <div class="swap-presets">
        <button class="swap-preset" data-amt="0.005">0.005</button>
        <button class="swap-preset" data-amt="0.01">0.01</button>
        <button class="swap-preset" data-amt="0.05">0.05</button>
        <button class="swap-preset" data-amt="0.1">0.1</button>
      </div>
      <div class="swap-quote" id="swapQuote">
        <div class="row"><span>Route</span><b id="swapRoute">Jupiter</b></div>
        <div class="row"><span>Price impact</span><b id="swapImpact">—</b></div>
        <div class="row"><span>Slippage</span><b>1.0%</b></div>
        <div class="row recv"><span>You receive (est.)</span><b id="swapRecv">—</b></div>
      </div>
      <button class="swap-cta" id="swapGo">Confirm Swap</button>
      <div class="swap-status" id="swapStatus" style="display:none;"></div>
      <div class="swap-foot">Routed via Jupiter Aggregator · signed by Phantom · 1% slippage default</div>
    </div>
  </div>
</div>
  `;
  document.body.appendChild(wrap.firstElementChild);

  const $ = (id) => document.getElementById(id);

  let _current = null;       // current token info
  let _lastQuote = null;     // last fetched quote
  let _quoting = false;
  let _quoteAbort = null;
  let _statusTimer = null;

  function setStatus(text, cls){
    const el = $('swapStatus');
    el.className = "swap-status" + (cls ? " " + cls : "");
    el.innerHTML = text;
    el.style.display = "";
  }
  function clearStatus(){ $('swapStatus').style.display = "none"; }
  function shortCa(ca){ return ca.slice(0, 6) + "…" + ca.slice(-4); }
  function fmtUi(amt, decimals){
    const n = Number(amt) / Math.pow(10, decimals);
    if(n >= 1e6) return (n / 1e6).toFixed(2) + "M";
    if(n >= 1e3) return (n / 1e3).toFixed(2) + "K";
    if(n >= 1)   return n.toFixed(2);
    if(n >= 0.01) return n.toFixed(4);
    return n.toExponential(2);
  }

  // ── Quote (debounced) ──
  async function updateQuote(){
    if(!_current) return;
    if(_quoteAbort) try { _quoteAbort.abort(); } catch(_){}
    _quoteAbort = new AbortController();
    const amt = Math.max(0, Number($('swapAmt').value) || 0);
    if(amt <= 0){
      $('swapRecv').textContent = "—";
      $('swapImpact').textContent = "—";
      _lastQuote = null;
      return;
    }
    _quoting = true;
    $('swapRecv').innerHTML = '<span class="swap-spin"></span>fetching…';
    const lamports = Math.floor(amt * 1e9);
    const url = `${QUOTE_URL}?inputMint=${SOL_MINT}&outputMint=${_current.ca}&amount=${lamports}&slippageBps=100`;
    try {
      const r = await fetch(url, { signal: _quoteAbort.signal });
      if(!r.ok) throw new Error("Quote HTTP " + r.status);
      const j = await r.json();
      _lastQuote = j;
      _quoting = false;
      const outAmt   = j.outAmount;
      const decimals = (j.routePlan?.[0]?.swapInfo?.outputMint === _current.ca) ? 6 : 6; // pump.fun tokens are 6
      $('swapRecv').textContent  = fmtUi(outAmt, decimals) + " $" + _current.sym;
      $('swapImpact').textContent = (Number(j.priceImpactPct) * 100).toFixed(2) + "%";
      $('swapRoute').textContent  = (j.routePlan?.length || 1) + " hop(s) · Jupiter";
    } catch(e){
      if(e.name === "AbortError") return;
      _quoting = false;
      _lastQuote = null;
      $('swapRecv').textContent  = "no route";
      $('swapImpact').textContent = "—";
    }
  }
  let _quoteTimer = null;
  function debounceQuote(){
    if(_quoteTimer) clearTimeout(_quoteTimer);
    _quoteTimer = setTimeout(updateQuote, 250);
  }

  // ── Swap execution ──
  async function executeSwap(){
    if(!_lastQuote){ setStatus("No quote yet — type an amount.", "err"); return; }
    const S = window.State;
    if(!S || !S.wallet){
      setStatus("Connect Phantom on the login screen first.", "err");
      return;
    }
    const W3 = window.solanaWeb3;
    if(!W3){
      setStatus("Solana library still loading — try again in a moment.", "err");
      return;
    }
    const phantom = window.phantom?.solana || (window.solana?.isPhantom ? window.solana : null);
    if(!phantom){
      setStatus("Phantom wallet not detected in this browser.", "err");
      return;
    }
    $('swapGo').disabled = true;
    setStatus('<span class="swap-spin"></span>Building transaction…');
    try {
      // Get the unsigned swap tx
      const r = await fetch(SWAP_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          quoteResponse: _lastQuote,
          userPublicKey: S.wallet,
          wrapAndUnwrapSol: true,
          dynamicComputeUnitLimit: true,
          prioritizationFeeLamports: "auto",
        }),
      });
      if(!r.ok){
        const t = await r.text();
        throw new Error("Swap API: " + (t || r.status));
      }
      const j = await r.json();
      const txB64 = j.swapTransaction;
      if(!txB64) throw new Error("No swapTransaction returned");
      // Decode base64 → bytes → VersionedTransaction
      const bin = atob(txB64);
      const buf = new Uint8Array(bin.length);
      for(let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
      const tx = W3.VersionedTransaction.deserialize(buf);
      setStatus('<span class="swap-spin"></span>Awaiting Phantom signature…');
      // Try to reconnect if session expired
      try { await phantom.connect(); } catch(_){}
      const res = await phantom.signAndSendTransaction(tx);
      const sig = (typeof res === "string") ? res : (res?.signature || res?.publicKey);
      if(!sig) throw new Error("Phantom returned no signature");
      setStatus(`✅ Sent! <a href="https://solscan.io/tx/${sig}" target="_blank" rel="noopener">View on Solscan</a><br>Sig: ${sig.slice(0, 16)}…`, "ok");
      // Refresh balances after a few seconds so the portfolio + Fart Cup
      // pick up the new holding.
      setTimeout(() => {
        try { window.fcFetchBalances && window.fcFetchBalances(); } catch(_){}
        try { window.refreshFartprintBalance && window.refreshFartprintBalance(); } catch(_){}
        try { window.renderInventory && window.renderInventory(); } catch(_){}
      }, 4000);
    } catch(e){
      console.warn("[Swap] failed", e);
      setStatus("❌ " + (e?.message || e), "err");
    } finally {
      $('swapGo').disabled = false;
    }
  }

  // ── Public API ──
  window.openNativeSwap = function(ca){
    _current = tokenInfo(ca);
    _lastQuote = null;
    $('swapName').textContent = _current.name + "  ·  $" + _current.sym;
    $('swapCa').textContent   = shortCa(ca);
    const ico = $('swapIco');
    if(_current.img){
      ico.style.backgroundImage = `url('${_current.img.replace(/'/g, '%27')}')`;
      ico.textContent = "";
    } else {
      ico.style.backgroundImage = "";
      ico.textContent = (_current.sym || "?").slice(0, 3);
    }
    clearStatus();
    $('swapBg').classList.add('show');
    updateQuote();
  };

  // ── Wire UI ──
  $('swapClose').addEventListener('click', () => $('swapBg').classList.remove('show'));
  $('swapBg').addEventListener('click', (e) => { if(e.target.id === "swapBg") $('swapBg').classList.remove('show'); });
  $('swapAmt').addEventListener('input', debounceQuote);
  document.querySelectorAll('.swap-preset').forEach(b => {
    b.addEventListener('click', () => {
      $('swapAmt').value = b.dataset.amt;
      debounceQuote();
    });
  });
  $('swapGo').addEventListener('click', executeSwap);

  console.log("[Swap] native Jupiter swap ready");
})();
