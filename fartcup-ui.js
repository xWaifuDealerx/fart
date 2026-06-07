// =================================================================
// fartcup-ui.js — Fart Cup modal CSS + HTML injection
// =================================================================
// Lifted out of fartworld.html to keep the main file under the editor
// size cap. The render functions (fcRenderTrade / fcRenderClaim) and
// the FARTCUP_COINS data still live in the main module; this file just
// injects the modal's CSS + HTML and wires the buttons.
(function(){
  'use strict';

  // ── CSS ──
  const style = document.createElement('style');
  style.textContent = `
.fc-bg { position: fixed; inset: 0; background: rgba(0,0,0,.78); backdrop-filter: blur(12px); display: none; align-items: center; justify-content: center; z-index: 56; padding: 20px; }
.fc-bg.show { display: flex; }
.fc-card { max-width: 760px; width: 100%; max-height: 90vh; background: linear-gradient(180deg, rgba(8,28,18,.97), rgba(5,16,11,.97)); border: 2px solid rgba(255,214,77,.42); border-radius: 22px; overflow: hidden; display: flex; flex-direction: column; box-shadow: 0 30px 80px rgba(0,0,0,.6), 0 0 80px rgba(255,214,77,.22); }
.fc-head { display: flex; align-items: center; justify-content: space-between; padding: 18px 24px; border-bottom: 1px solid rgba(255,214,77,.20); background: linear-gradient(90deg, rgba(255,214,77,.10), transparent); }
.fc-head h2 { font-family: 'Bangers', 'Orbitron', sans-serif; font-size: 34px; letter-spacing: 2.4px; background: linear-gradient(135deg, #fff1a8, #ffd64d, #b27538); -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent; filter: drop-shadow(0 0 14px rgba(255,214,77,.55)); }
.fc-head .close { background: transparent; border: 0; color: rgba(230,255,238,.55); font-size: 26px; cursor: pointer; line-height: 1; }
.fc-tabs { display: flex; border-bottom: 1px solid rgba(255,214,77,.16); }
.fc-tab { flex: 1; background: transparent; border: 0; color: rgba(230,255,238,.55); padding: 14px; font-family: 'Orbitron', sans-serif; font-weight: 800; font-size: 12px; letter-spacing: 1.6px; text-transform: uppercase; cursor: pointer; border-bottom: 2px solid transparent; transition: all .14s; }
.fc-tab.active { color: #ffd64d; border-bottom-color: #ffd64d; background: rgba(255,214,77,.06); }
.fc-body { overflow-y: auto; padding: 18px 22px 26px; flex: 1; }
.fc-intro { color: rgba(230,255,238,.72); font-size: 13px; line-height: 1.55; margin-bottom: 16px; }
.fc-intro b { color: #ffd64d; }
.fc-list { display: flex; flex-direction: column; gap: 8px; }
.fc-row { display: grid; grid-template-columns: 44px 1.1fr 1fr auto; gap: 12px; align-items: center; padding: 10px 12px; background: rgba(255,214,77,.05); border: 1px solid rgba(255,214,77,.18); border-radius: 12px; }
.fc-row:hover { background: rgba(255,214,77,.12); border-color: #ffd64d; }
.fc-row.claim { grid-template-columns: 44px 1.1fr .9fr auto; }
.fc-row .ico { width: 44px; height: 44px; border-radius: 10px; background-size: cover; background-position: center; background-color: rgba(255,255,255,.05); border: 1px solid rgba(255,214,77,.30); display: grid; place-items: center; font-size: 22px; }
.fc-row .meta { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.fc-row .sym { font-family: 'Orbitron', sans-serif; font-weight: 900; font-size: 13.5px; background: linear-gradient(135deg, #fff1a8, #ffd64d); -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent; }
.fc-row .ticker { font-family: 'JetBrains Mono', monospace; font-size: 10.5px; color: rgba(230,255,238,.55); margin-top: 2px; letter-spacing: 0.3px; }
.fc-row .price-col { text-align: right; }
.fc-row .price { font-family: 'Orbitron', sans-serif; font-weight: 800; font-size: 14px; color: #e6ffee; }
.fc-row .mcap { font-family: 'JetBrains Mono', monospace; font-size: 10px; font-weight: 700; color: #ffd64d; margin-top: 2px; letter-spacing: 0.3px; }
.fc-row .bal-col { text-align: right; }
.fc-row .bal-lbl { font-family: 'JetBrains Mono', monospace; font-size: 9px; letter-spacing: 1.1px; color: rgba(230,255,238,.45); text-transform: uppercase; }
.fc-row .bal { font-family: 'Orbitron', sans-serif; font-weight: 800; font-size: 14px; color: #e6ffee; margin-top: 2px; }
.fc-row .trade-btn { background: linear-gradient(135deg, #b27538, #ffd64d); color: #2a1a04; border: 0; padding: 8px 14px; border-radius: 100px; font-family: 'Orbitron', sans-serif; font-weight: 900; font-size: 11px; letter-spacing: 1.1px; text-transform: uppercase; cursor: pointer; text-decoration: none; box-shadow: 0 6px 14px rgba(180,128,48,.34); }
.fc-row .trade-btn:hover { transform: translateY(-1px); filter: brightness(1.08); }
.fc-claim-btn { border: 0; padding: 8px 14px; border-radius: 100px; font-family: 'Orbitron', sans-serif; font-weight: 900; font-size: 11px; letter-spacing: 1.1px; text-transform: uppercase; cursor: pointer; }
.fc-claim-btn.go { background: linear-gradient(135deg, #46f08a, #5ff09c); color: #042913; box-shadow: 0 6px 14px rgba(95,240,156,.36); }
.fc-claim-btn.locked, .fc-claim-btn.done { background: rgba(255,214,77,.10); color: rgba(230,255,238,.4); cursor: not-allowed; }
.fc-claim-btn.done { background: rgba(95,240,156,.18); color: #5ff09c; }
.fc-foot { margin-top: 14px; font-family: 'JetBrains Mono', monospace; font-size: 10.5px; color: rgba(230,255,238,.45); text-align: center; }
.inv-slot { position: relative; }
.inv-slot.wearable { box-shadow: inset 0 0 0 1px rgba(255,214,77,.45); }
.inv-slot.wearable.worn { box-shadow: inset 0 0 0 2px #ffd64d, 0 0 18px rgba(255,214,77,.35); }
.inv-slot .wear-badge { position: absolute; top: 4px; right: 4px; background: linear-gradient(135deg, #ffd64d, #fff1a8); color: #2a1a04; font-family: 'Orbitron', sans-serif; font-weight: 900; font-size: 8px; letter-spacing: 0.6px; padding: 2px 6px; border-radius: 5px; pointer-events: none; }
`;
  document.head.appendChild(style);

  // ── Modal HTML ──
  const wrap = document.createElement('div');
  wrap.innerHTML = `
<div class="fc-bg" id="fcBg">
  <div class="fc-card">
    <div class="fc-head"><h2>⚽ FART CUP</h2><button class="close" id="fcClose">×</button></div>
    <div class="fc-tabs">
      <button class="fc-tab active" data-fctab="trade">Trade Nation Coins</button>
      <button class="fc-tab" data-fctab="claim">Claim Flags</button>
    </div>
    <div class="fc-body">
      <div class="fc-pane" data-fcpane="trade">
        <p class="fc-intro">The 48 national FART tokens. Sorted by market cap. <b>BUY</b> opens the in-app Jupiter swap.</p>
        <div class="fc-list" id="fcTradeList"></div>
      </div>
      <div class="fc-pane" data-fcpane="claim" style="display:none;">
        <p class="fc-intro">Hold <b>100,000</b> of a country's FART token to claim its flag as a wearable. <b>No burn required.</b></p>
        <div class="fc-list" id="fcClaimList"></div>
        <div class="fc-foot">Flags are forever.</div>
      </div>
    </div>
  </div>
</div>
  `;
  document.body.appendChild(wrap.firstElementChild);

  // ── Wire tabs + close button ──
  let currentTab = "trade";
  document.getElementById('fcClose').addEventListener('click', () => {
    if(window.closeFartCup) window.closeFartCup();
    else document.getElementById('fcBg').classList.remove('show');
  });
  document.getElementById('fcBg').addEventListener('click', (e) => {
    if(e.target.id === "fcBg"){
      if(window.closeFartCup) window.closeFartCup();
      else document.getElementById('fcBg').classList.remove('show');
    }
  });
  document.querySelectorAll('.fc-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      const t = btn.dataset.fctab;
      currentTab = t;
      document.querySelectorAll('.fc-tab').forEach(b => b.classList.toggle('active', b === btn));
      document.querySelectorAll('.fc-pane').forEach(p => p.style.display = p.dataset.fcpane === t ? "" : "none");
      if(t === "trade"){ if(window.fcRenderTrade) window.fcRenderTrade(); }
      else { if(window.fcRenderClaim) window.fcRenderClaim(); }
    });
  });

  console.log("[fartcup-ui] modal injected");
})();
