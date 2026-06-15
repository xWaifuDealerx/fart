// =================================================================
// church.js — ⛪ The Fartology Church (investment market) @ x:72 z:19
//   • A church building you can invest Silver into.
//   • Valuation starts at 1,000,000,000 🥈 and drifts up over time
//     (simulated market) and as players invest.
//   • The church "receives" millions in donations daily (simulated).
//     Investors accrue a SHARE of donations proportional to ownership,
//     claimable once per hour at the church.
//   • You can sell your shares any time at the current price — if the
//     valuation rose, you sell for a profit.
// Self-contained; persists in localStorage. State is per-client (a
// real shared market would sync over the network — future work).
// =================================================================
(function(){
  'use strict';
  function whenReady(){
    if(!window.THREE || !window.scene || !window.Player || !window.State || !window.groundHeightAt){
      setTimeout(whenReady, 400); return;
    }
    init();
  }
  whenReady();

  function init(){
    const THREE = window.THREE;
    const scene = window.scene;
    const Player = window.Player;
    const State = window.State;
    const gH = window.groundHeightAt;

    const POS = { x: 72, z: 19 };
    const RADIUS = 6;
    const KEY = 'fw.church.v1';
    const HOUR = 3600000;

    // ── persisted state ──
    function defaults(){
      return {
        v: 1e9, s: 1e9,              // valuation, total shares (price = v/s, starts at 1)
        rate: 0.10, appr: 0.0022,    // daily donation rate, hourly appreciation
        lastT: Date.now(), rollT: Date.now(),
        v24ago: 1e9, v24t: Date.now(),
        myShares: 0, myCost: 0, myPending: 0, myLastClaim: 0,
      };
    }
    let st;
    try { const o = JSON.parse(localStorage.getItem(KEY)); st = (o && typeof o.v === 'number') ? Object.assign(defaults(), o) : defaults(); }
    catch(_){ st = defaults(); }
    function persist(){ try { localStorage.setItem(KEY, JSON.stringify(st)); } catch(_){} }
    const silver = () => State.credits || 0;

    function sim(){
      const now = Date.now();
      let dt = (now - st.lastT) / 1000;
      if(dt < 0) dt = 0;
      if(dt > 7 * 86400) dt = 7 * 86400;     // cap offline catch-up at 7 days
      // Re-roll the (random) donation + growth rates each hour.
      if(now - st.rollT >= HOUR){
        st.rollT = now;
        st.rate = 0.06 + Math.random() * 0.10;        // 6%–16% of valuation / day in donations
        st.appr = -0.0006 + Math.random() * 0.0034;   // ~ -0.06% .. +0.28% per hour value drift
      }
      if(dt > 0){
        st.v *= Math.pow(1 + st.appr, dt / 3600);       // appreciation
        if(st.myShares > 0 && st.s > 0){
          const donPerSec = (st.v * st.rate) / 86400;   // total church donations / sec
          st.myPending += (st.myShares / st.s) * donPerSec * dt;   // your proportional slice
        }
        st.lastT = now;
      }
      if(now - st.v24t >= 86400000){ st.v24ago = st.v; st.v24t = now; }
    }

    // ── helpers ──
    function fmt(n){
      n = Math.max(0, Math.floor(n));
      if(n >= 1e9) return (n / 1e9).toFixed(2) + 'B';
      if(n >= 1e6) return (n / 1e6).toFixed(2) + 'M';
      if(n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
      return String(n);
    }
    function full(n){ return Math.max(0, Math.floor(n)).toLocaleString('en-US'); }
    const price = () => st.v / Math.max(1, st.s);
    const myValue = () => st.myShares * price();

    // ──────────────────────────────────────────────────────────────
    // BUILDING
    // ──────────────────────────────────────────────────────────────
    function buildChurch(){
      const g = new THREE.Group();
      g.position.set(POS.x, gH(POS.x, POS.z), POS.z);
      const stone = new THREE.MeshStandardMaterial({ color: 0xd2cab2, roughness: 0.9 });
      const roof  = new THREE.MeshStandardMaterial({ color: 0x7a4630, roughness: 0.85 });
      const cross = new THREE.MeshStandardMaterial({ color: 0xffd64d, emissive: 0xffce4a, emissiveIntensity: 0.45, roughness: 0.5 });
      // nave
      const nave = new THREE.Mesh(new THREE.BoxGeometry(6, 4.2, 9), stone);
      nave.position.set(0, 2.1, 0); nave.castShadow = nave.receiveShadow = true; g.add(nave);
      // gable roof (two tilted slabs)
      for(const side of [-1, 1]){
        const slope = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.28, 9.3), roof);
        slope.position.set(side * 1.45, 5.0, 0);
        slope.rotation.z = side * -0.7;
        g.add(slope);
      }
      // bell tower at the front
      const tower = new THREE.Mesh(new THREE.BoxGeometry(2.6, 7.5, 2.6), stone);
      tower.position.set(0, 3.75, 4.7); tower.castShadow = true; g.add(tower);
      const spire = new THREE.Mesh(new THREE.ConeGeometry(1.9, 3.2, 4), roof);
      spire.position.set(0, 9.1, 4.7); spire.rotation.y = Math.PI / 4; g.add(spire);
      // cross on the spire
      const cv = new THREE.Mesh(new THREE.BoxGeometry(0.2, 1.5, 0.2), cross); cv.position.set(0, 11.4, 4.7); g.add(cv);
      const cx = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.2, 0.2), cross); cx.position.set(0, 11.5, 4.7); g.add(cx);
      // big door
      const door = new THREE.Mesh(new THREE.BoxGeometry(1.5, 2.6, 0.2), new THREE.MeshStandardMaterial({ color: 0x5a3a1f, roughness: 0.8 }));
      door.position.set(0, 1.3, 4.62); g.add(door);
      // stained-glass windows (emissive glow, no real lights)
      const glass = [0xff5a8a, 0x5fa8ff, 0x5ff09c, 0xffd64d];
      for(const sx of [-1, 1]) for(let i = 0; i < 2; i++){
        const w = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.7, 1.0),
          new THREE.MeshStandardMaterial({ color: glass[i], emissive: glass[i], emissiveIntensity: 0.55, roughness: 0.4 }));
        w.position.set(sx * 3.0, 2.5, -1.8 + i * 3.4); g.add(w);
      }
      // floating sign
      const cv2 = document.createElement('canvas'); cv2.width = 256; cv2.height = 64;
      const ctx = cv2.getContext('2d');
      ctx.fillStyle = 'rgba(8,18,11,0.85)'; ctx.fillRect(0, 0, 256, 64);
      ctx.strokeStyle = '#ffd64d'; ctx.lineWidth = 3; ctx.strokeRect(2, 2, 252, 60);
      ctx.fillStyle = '#fff1c2'; ctx.font = 'bold 20px Outfit, Arial'; ctx.textAlign = 'center';
      ctx.fillText('⛪ FARTOLOGY CHURCH', 128, 30);
      ctx.font = '13px Outfit, Arial'; ctx.fillStyle = 'rgba(230,255,238,0.8)';
      ctx.fillText('Invest · Earn donations · Press E', 128, 50);
      const tex = new THREE.CanvasTexture(cv2);
      const sign = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 1.05), new THREE.MeshBasicMaterial({ map: tex, transparent: true }));
      sign.position.set(0, 7.2, 0); g.add(sign);
      g.userData.sign = sign;
      scene.add(g);
      return g;
    }
    const churchMesh = buildChurch();

    // ──────────────────────────────────────────────────────────────
    // UI — proximity prompt + invest/sell/claim modal
    // ──────────────────────────────────────────────────────────────
    const css = document.createElement('style');
    css.textContent = `
#chPrompt{position:fixed;left:50%;bottom:210px;transform:translateX(-50%);display:none;z-index:54;
  background:linear-gradient(180deg,rgba(18,14,6,.95),rgba(10,8,4,.95));border:2px solid rgba(255,206,74,.55);
  border-radius:13px;padding:9px 16px;color:#fff1c2;font-family:'Outfit','Inter',sans-serif;text-align:center;pointer-events:none}
#chPrompt .k{background:rgba(255,206,74,.22);border:1px solid rgba(255,206,74,.55);color:#ffd64d;padding:1px 8px;border-radius:6px;font-family:monospace;font-weight:700}
.church-bg{position:fixed;inset:0;display:none;align-items:center;justify-content:center;z-index:60;
  background:rgba(0,0,0,.74);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);padding:20px}
.church-bg.show{display:flex}
.church-card{width:420px;max-width:94vw;background:linear-gradient(180deg,rgba(26,20,8,.98),rgba(14,10,5,.98));
  border:2px solid rgba(255,206,74,.45);border-radius:18px;padding:20px 22px;color:#fff1c2;
  font-family:'Outfit','Inter',sans-serif;box-shadow:0 24px 60px rgba(0,0,0,.6)}
.church-card h2{font-family:'Bangers','Orbitron',sans-serif;font-size:26px;letter-spacing:1.5px;margin:0 0 4px;color:#ffd64d}
.church-card .ch-val{font-size:14px;margin:10px 0 2px}
.church-card .ch-val b{font-size:20px;color:#fff}
.church-card .ch-up{color:#5ff09c;font-weight:700}
.church-card .ch-down{color:#ff7a6e;font-weight:700}
.church-card .ch-sub{font-size:12px;color:rgba(230,255,238,.7);margin:3px 0}
.church-card .ch-sub b{color:#ffe39a}
.church-card .ch-mine{background:rgba(255,206,74,.08);border:1px solid rgba(255,206,74,.25);border-radius:10px;padding:9px 12px;margin:12px 0;font-size:12.5px}
.church-card .ch-mine b{color:#fff}
.church-card .ch-row{display:flex;gap:8px;margin:9px 0;align-items:center}
.church-card input{flex:1;background:rgba(0,0,0,.35);border:1px solid rgba(255,206,74,.4);border-radius:9px;
  padding:9px 12px;color:#fff1c2;font-family:'JetBrains Mono',monospace;font-size:13px;outline:none}
.church-card button{background:linear-gradient(135deg,#ffce4a,#ffd86e);border:0;border-radius:9px;padding:10px 14px;
  color:#3a2a08;font-family:'Outfit',sans-serif;font-weight:800;font-size:13px;cursor:pointer;transition:.12s}
.church-card button:hover{filter:brightness(1.08);transform:translateY(-1px)}
.church-card button.ghost{background:rgba(255,255,255,.06);color:#fff1c2;border:1px solid rgba(255,206,74,.35)}
`;
    document.head.appendChild(css);

    const prompt = document.createElement('div');
    prompt.id = 'chPrompt';
    prompt.innerHTML = '<span class="k">E</span> visit the Fartology Church';
    document.body.appendChild(prompt);

    const bg = document.createElement('div');
    bg.className = 'church-bg';
    bg.innerHTML =
      '<div class="church-card">'
      + '<h2>⛪ Fartology Church</h2>'
      + '<div class="ch-val">Valuation <b id="chVal">—</b> <span id="chChange"></span></div>'
      + '<div class="ch-sub">Donations received · last hour <b id="chDonH">—</b> · last 24h <b id="chDon24">—</b></div>'
      + '<div class="ch-mine">Your stake: <b id="chMyVal">0 🥈</b> &nbsp;·&nbsp; <span id="chMyShares">0</span> shares<br>'
      + 'Unclaimed donations: <b id="chPending">0 🥈</b> <span id="chClaimNote" style="color:rgba(230,255,238,.55);font-size:11px"></span></div>'
      + '<div class="ch-row"><input id="chAmt" type="number" min="1" placeholder="silver to invest"/><button id="chInvest">Invest</button></div>'
      + '<div class="ch-row"><button id="chClaim" style="flex:1">💰 Claim donations</button><button id="chSell" class="ghost" style="flex:1">Sell all shares</button></div>'
      + '<div class="ch-row"><button id="chClose" class="ghost" style="flex:1">Leave</button></div>'
      + '</div>';
    document.body.appendChild(bg);
    bg.addEventListener('click', (e) => { if(e.target === bg) close(); });

    function render(){
      sim();
      document.getElementById('chVal').textContent = fmt(st.v) + ' 🥈';
      const chg = (st.v - st.v24ago) / Math.max(1, st.v24ago) * 100;
      const chEl = document.getElementById('chChange');
      chEl.textContent = (chg >= 0 ? '▲ +' : '▼ ') + chg.toFixed(2) + '% (24h)';
      chEl.className = chg >= 0 ? 'ch-up' : 'ch-down';
      document.getElementById('chDon24').textContent = fmt(st.v * st.rate) + ' 🥈';
      document.getElementById('chDonH').textContent = fmt(st.v * st.rate / 24) + ' 🥈';
      document.getElementById('chMyVal').textContent = full(myValue()) + ' 🥈';
      document.getElementById('chMyShares').textContent = full(st.myShares);
      document.getElementById('chPending').textContent = full(st.myPending) + ' 🥈';
      const wait = HOUR - (Date.now() - st.myLastClaim);
      document.getElementById('chClaimNote').textContent =
        (st.myShares <= 0) ? '· invest first' : (wait > 0 ? '· claimable in ' + Math.ceil(wait / 60000) + ' min' : '· ready to claim');
    }

    function open(){ render(); bg.classList.add('show'); try { document.exitPointerLock?.(); } catch(_){} }
    function close(){ bg.classList.remove('show'); }

    document.getElementById('chInvest').addEventListener('click', () => {
      sim();
      const amt = Math.max(0, Math.floor(Number(document.getElementById('chAmt').value) || 0));
      if(amt <= 0){ window.floater?.('Enter an amount of silver', 'bad'); return; }
      if(silver() < amt){ window.floater?.('Not enough silver', 'bad'); return; }
      const shares = amt / price();
      State.credits -= amt;
      st.v += amt; st.s += shares; st.myShares += shares; st.myCost += amt;
      persist(); window.updateHUD?.(); window.saveState?.();
      document.getElementById('chAmt').value = '';
      window.floater?.('🙏 Invested ' + full(amt) + ' 🥈 into the Church', 'good');
      render();
    });
    document.getElementById('chClaim').addEventListener('click', () => {
      sim();
      if(st.myShares <= 0){ window.floater?.('You have no shares yet', 'bad'); return; }
      const wait = HOUR - (Date.now() - st.myLastClaim);
      if(wait > 0){ window.floater?.('Come back in ' + Math.ceil(wait / 60000) + ' min to claim', 'bad'); return; }
      const got = Math.floor(st.myPending);
      if(got <= 0){ window.floater?.('No donations accrued yet', 'bad'); return; }
      st.myPending -= got; st.myLastClaim = Date.now();
      State.credits = (State.credits || 0) + got;
      persist(); window.updateHUD?.(); window.saveState?.();
      window.floater?.('💰 Claimed ' + full(got) + ' 🥈 in donations', 'good');
      render();
    });
    document.getElementById('chSell').addEventListener('click', () => {
      sim();
      if(st.myShares <= 0){ window.floater?.('You have no shares to sell', 'bad'); return; }
      const value = st.myShares * price();
      const profit = value - st.myCost;
      const pend = Math.floor(st.myPending);
      State.credits = (State.credits || 0) + Math.floor(value) + pend;
      st.v = Math.max(1e6, st.v - value); st.s = Math.max(1, st.s - st.myShares);
      st.myShares = 0; st.myCost = 0; st.myPending = 0;
      persist(); window.updateHUD?.(); window.saveState?.();
      window.floater?.('📈 Sold shares for ' + full(value) + ' 🥈 (' + (profit >= 0 ? '+' : '') + full(profit) + ' profit)' + (pend > 0 ? ' · +' + full(pend) + ' donations' : ''), 'good');
      render();
    });
    document.getElementById('chClose').addEventListener('click', close);
    window.addEventListener('keydown', (e) => { if(e.code === 'Escape' && bg.classList.contains('show')) close(); });

    // E-dispatcher hook (called from tryInteract in fartworld.html)
    window.fwChurchInteract = function(){
      if(Math.hypot(Player.pos.x - POS.x, Player.pos.z - POS.z) > RADIUS) return false;
      open();
      return true;
    };

    // tick: keep the sim warm + show the prompt when near, billboard sign
    setInterval(() => {
      sim(); persist();
      const near = Math.hypot(Player.pos.x - POS.x, Player.pos.z - POS.z) <= RADIUS;
      const inMenu = document.querySelector('.church-bg.show, #invBg.show, #bankBg.show, #marketBg.show');
      prompt.style.display = (near && !inMenu) ? 'block' : 'none';
      if(window.camera && churchMesh.userData.sign){
        churchMesh.userData.sign.rotation.y = Math.atan2(window.camera.position.x - POS.x, window.camera.position.z - POS.z);
      }
    }, 500);

    // Exposed for the Ongoing Operations panel.
    window.fwChurchInfo = function(){
      sim();
      return { pending: Math.floor(st.myPending), pct: (st.myShares / Math.max(1, st.s)) * 100,
               shares: st.myShares, claimWaitMs: HOUR - (Date.now() - st.myLastClaim) };
    };

    console.log('[church] ⛪ Fartology Church ready @', POS.x, POS.z, '· valuation', fmt(st.v));
  }
})();
