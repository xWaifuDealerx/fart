// =================================================================
// fartcup.js — Fart Cup modal. Lists every country token in
// FARTCUP_COINS with a flag emoji + a Wear/Equip button that
// unlocks when the wallet holds ≥100,000 of that country's mint.
// =================================================================
(function(){
  'use strict';
  function whenReady(){
    if(!window.State || typeof window.FARTCUP_COINS === "undefined"){
      setTimeout(whenReady, 300); return;
    }
    init();
  }
  whenReady();

  function init(){
    const State = window.State;
    const COINS = window.FARTCUP_COINS;
    const THRESHOLD = window.FLAG_CLAIM_THRESHOLD || 100000;

    // ── Style ──
    const css = document.createElement('style');
    css.textContent = `
.fc-bg{position:fixed;inset:0;display:none;align-items:center;justify-content:center;background:rgba(0,0,0,.78);backdrop-filter:blur(10px);z-index:200;padding:16px}
.fc-bg.show{display:flex;animation:fcFade .3s ease}
@keyframes fcFade{from{opacity:0}to{opacity:1}}
.fc-card{background:linear-gradient(180deg,rgba(8,14,28,.97),rgba(4,8,18,.97));border:2px solid rgba(255,206,74,.55);border-radius:20px;max-width:780px;width:100%;max-height:88vh;display:flex;flex-direction:column;box-shadow:0 0 60px rgba(255,206,74,.18);color:#fff1c2;font-family:'Outfit','Inter',sans-serif}
.fc-head{display:flex;justify-content:space-between;align-items:center;padding:18px 22px;border-bottom:1px solid rgba(255,206,74,.18)}
.fc-head h2{font-family:'Bangers','Orbitron',sans-serif;font-size:30px;background:linear-gradient(135deg,#ffd64d,#fff1c2);-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;letter-spacing:2px;margin:0}
.fc-head .x{background:transparent;border:0;color:rgba(255,241,194,.55);font-size:26px;cursor:pointer;line-height:1}
.fc-body{padding:18px 22px;overflow:auto}
.fc-intro{background:rgba(255,206,74,.08);border:1px solid rgba(255,206,74,.32);border-radius:12px;padding:14px 16px;margin-bottom:16px;font-size:12.5px;line-height:1.55}
.fc-intro b{color:#ffd64d}
.fc-intro .title{font-family:'Bangers','Orbitron',sans-serif;font-size:17px;color:#ffd64d;letter-spacing:1.4px;margin-bottom:6px}
.fc-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:12px}
.fc-cell{background:rgba(255,206,74,.05);border:1px solid rgba(255,206,74,.2);border-radius:12px;padding:14px;display:flex;flex-direction:column;align-items:center;gap:8px;transition:transform .15s ease,border-color .15s ease}
.fc-cell:hover{transform:translateY(-2px);border-color:rgba(255,206,74,.55)}
.fc-flag{font-size:48px;line-height:1;filter:drop-shadow(0 4px 8px rgba(0,0,0,.4))}
.fc-name{font-family:'Outfit',sans-serif;font-weight:800;font-size:14px;color:#ffd64d;text-align:center;letter-spacing:.4px}
.fc-bal{font-family:'JetBrains Mono',monospace;font-size:11px;color:rgba(230,255,238,.55);text-align:center}
.fc-btn{width:100%;padding:8px 12px;border:0;border-radius:8px;font-family:'Outfit',sans-serif;font-weight:800;font-size:11.5px;letter-spacing:.6px;cursor:pointer;text-transform:uppercase}
.fc-btn.locked{background:rgba(120,120,120,.18);color:rgba(230,255,238,.4);cursor:not-allowed}
.fc-btn.equip{background:linear-gradient(135deg,#ffd64d,#fff1c2);color:#1a1408}
.fc-btn.worn{background:rgba(95,240,156,.22);color:#5ff09c;border:1px solid rgba(95,240,156,.55)}
.fc-btn.buy{background:linear-gradient(135deg,#5ff09c,#a8ffd0);color:#0a1410}
.fc-tabs{display:flex;gap:8px;margin:0 16px}
.fc-tab{background:transparent;border:1px solid rgba(255,206,74,.4);color:rgba(255,241,194,.7);padding:6px 14px;border-radius:100px;font-family:'Orbitron',sans-serif;font-weight:800;font-size:10.5px;letter-spacing:1px;cursor:pointer;text-transform:uppercase}
.fc-tab.active{background:linear-gradient(135deg,#ffd64d,#fff1c2);color:#1a1408;border-color:transparent}
`;
    document.head.appendChild(css);

    // ── Build the modal ──
    const bg = document.createElement('div');
    bg.id = 'fcBg';
    bg.className = 'fc-bg';
    bg.innerHTML = ''
      + '<div class="fc-card">'
      + '  <div class="fc-head">'
      + '    <h2>🏆 FART CUP</h2>'
      + '    <div class="fc-tabs">'
      + '      <button class="fc-tab active" id="fcTabBuy">BUY</button>'
      + '      <button class="fc-tab" id="fcTabEquip">EQUIP FLAGS</button>'
      + '    </div>'
      + '    <button class="x" id="fcX">×</button>'
      + '  </div>'
      + '  <div class="fc-body">'
      + '    <div class="fc-intro" id="fcIntro">'
      + '      <div class="title">BUY YOUR COUNTRY\'S TOKEN</div>'
      + '      Tap any flag below to buy that country\'s token on <b>pump.fun</b>. Hold <b>100,000</b> of one to wear its flag in the world.'
      + '    </div>'
      + '    <div class="fc-grid" id="fcGrid"></div>'
      + '  </div>'
      + '</div>';
    document.body.appendChild(bg);
    document.getElementById('fcX').addEventListener('click', () => bg.classList.remove('show'));
    bg.addEventListener('click', (e) => { if(e.target === bg) bg.classList.remove('show'); });

    // ── Tabs (Buy vs Equip) ──
    let mode = 'buy';
    function setMode(m){
      mode = m;
      document.getElementById('fcTabBuy').classList.toggle('active', m === 'buy');
      document.getElementById('fcTabEquip').classList.toggle('active', m === 'equip');
      const intro = document.getElementById('fcIntro');
      if(m === 'buy'){
        intro.innerHTML = '<div class="title">BUY YOUR COUNTRY\'S TOKEN</div>Tap any flag below to buy that country\'s token on <b>pump.fun</b>. Hold <b>100,000</b> of one to wear its flag in the world.';
      } else {
        intro.innerHTML = '<div class="title">FUNGIBLE NON-FUNGIBLE TOKENS</div>Hold <b>100,000 tokens</b> of a country to <b>wear that flag</b>. No mint, no claim — your wallet IS the NFT. During the World Cup, every match win pays a <b>silver bonus</b> to wallets carrying that team\'s tokens.';
      }
      render();
    }
    document.getElementById('fcTabBuy').addEventListener('click', () => setMode('buy'));
    document.getElementById('fcTabEquip').addEventListener('click', () => setMode('equip'));

    // ISO-2 country code → flag emoji via regional indicator symbols.
    function flagOf(code){
      if(!code || code.length !== 2) return '🏳️';
      const cc = code.toUpperCase();
      return String.fromCodePoint(0x1F1E6 + cc.charCodeAt(0) - 65)
           + String.fromCodePoint(0x1F1E6 + cc.charCodeAt(1) - 65);
    }
    function fmt(n){
      if(n == null) return '—';
      if(n >= 1e6) return (n/1e6).toFixed(2) + 'M';
      if(n >= 1e3) return (n/1e3).toFixed(1) + 'k';
      return String(Math.round(n));
    }

    function render(){
      const grid = document.getElementById('fcGrid');
      if(!grid) return;
      const _fcData = window._fcData || {};
      const walletConn = !!State.wallet;
      grid.innerHTML = COINS.map(c => {
        const d = _fcData[c.ca] || {};
        const bal = d.balance;
        const flag = flagOf(c.code);
        const worn = State.wornFlag === c.code;
        let btn;
        if(mode === 'buy'){
          const url = c.url || ('https://pump.fun/coin/' + c.ca);
          btn = '<a class="fc-btn buy" target="_blank" rel="noopener noreferrer" href="' + url + '" style="display:block;text-decoration:none;text-align:center">BUY ON PUMP.FUN</a>';
        } else if(!walletConn){
          btn = '<button class="fc-btn locked" disabled>CONNECT WALLET</button>';
        } else if(bal == null){
          btn = '<button class="fc-btn locked" disabled>CHECKING…</button>';
        } else if(bal < THRESHOLD){
          btn = '<button class="fc-btn locked" disabled>NEED 100K TO WEAR</button>';
        } else if(worn){
          btn = '<button class="fc-btn worn" data-unwear="' + c.code + '">✓ WEARING · UNWEAR</button>';
        } else {
          btn = '<button class="fc-btn equip" data-wear="' + c.code + '">EQUIP FLAG</button>';
        }
        return '<div class="fc-cell">'
             + '  <div class="fc-flag">' + flag + '</div>'
             + '  <div class="fc-name">' + (c.sym || c.code) + '</div>'
             + '  <div class="fc-bal">Bal: ' + fmt(bal) + '</div>'
             + '  ' + btn
             + '</div>';
      }).join('');
      grid.querySelectorAll('.fc-btn[data-wear]').forEach(b => {
        b.addEventListener('click', () => {
          const coin = COINS.find(c => c.code === b.dataset.wear);
          if(!coin) return;
          if(typeof window.grantFlag === "function"){ try { window.grantFlag(coin); } catch(_){} }
          State.wornFlag = coin.code;
          window.saveState?.();
          window.renderInventory?.();
          window.floater?.('Wearing ' + flagOf(coin.code) + ' ' + coin.sym + ' flag', 'good');
          render();
        });
      });
      grid.querySelectorAll('.fc-btn[data-unwear]').forEach(b => {
        b.addEventListener('click', () => {
          State.wornFlag = null;
          window.saveState?.();
          window.renderInventory?.();
          window.floater?.('Flag removed', 'good');
          render();
        });
      });
    }

    window.openFartCup = function(){ render(); bg.classList.add('show'); };
    window.closeFartCup = function(){ bg.classList.remove('show'); };
    setInterval(() => { if(bg.classList.contains('show')) render(); }, 1500);
    console.log('[fartcup] ready · ' + COINS.length + ' countries');
  }
})();
