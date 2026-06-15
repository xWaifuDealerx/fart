// =================================================================
// mookratha.js — 🥩 Moo Kratha Shop @ x:39 z:-51
//   Two ways to interact (press E):
//     1) INVEST — a market stake exactly like the Fartology Church.
//        Valuation starts at 10,000,000 🥈 and drifts; investors accrue
//        a share of the shop's daily takings, claimable hourly.
//     2) SELL PORK — sell your Pork Meat for CASH 💵.
//   Self-contained; market state persists in its own localStorage.
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

    const POS = { x: 39, z: -51 };
    const RADIUS = 6;
    const KEY = 'fw.mookratha.v1';
    const HOUR = 3600000;
    const PORK_PRICE = 50;          // 💵 CASH paid per Pork Meat

    function defaults(){
      return {
        v: 1e7, s: 1e7,             // valuation 10M, shares 10M (price starts at 1)
        rate: 0.10, appr: 0.0022,
        lastT: Date.now(), rollT: Date.now(),
        v24ago: 1e7, v24t: Date.now(),
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
      let dt = (now - st.lastT) / 1000; if(dt < 0) dt = 0; if(dt > 7 * 86400) dt = 7 * 86400;
      if(now - st.rollT >= HOUR){
        st.rollT = now;
        st.rate = 0.06 + Math.random() * 0.10;
        st.appr = -0.0006 + Math.random() * 0.0034;
      }
      if(dt > 0){
        st.v *= Math.pow(1 + st.appr, dt / 3600);
        if(st.myShares > 0 && st.s > 0){
          const perSec = (st.v * st.rate) / 86400;
          st.myPending += (st.myShares / st.s) * perSec * dt;
        }
        st.lastT = now;
      }
      if(now - st.v24t >= 86400000){ st.v24ago = st.v; st.v24t = now; }
    }

    function fmt(n){ n = Math.max(0, Math.floor(n));
      if(n >= 1e9) return (n / 1e9).toFixed(2) + 'B';
      if(n >= 1e6) return (n / 1e6).toFixed(2) + 'M';
      if(n >= 1e3) return (n / 1e3).toFixed(1) + 'K'; return String(n); }
    function full(n){ return Math.max(0, Math.floor(n)).toLocaleString('en-US'); }
    const price = () => st.v / Math.max(1, st.s);
    const myValue = () => st.myShares * price();
    const porkCount = () => (State.inventory && State.inventory.pork_meat) || 0;

    // ── BUILDING — a Thai BBQ hut with a hot-pot grill out front ──
    function buildShop(){
      const g = new THREE.Group();
      g.position.set(POS.x, gH(POS.x, POS.z), POS.z);
      const wall = new THREE.MeshStandardMaterial({ color: 0x8a2f24, roughness: 0.8 });
      const trim = new THREE.MeshStandardMaterial({ color: 0xffd64d, emissive: 0xffae00, emissiveIntensity: 0.4, metalness: 0.5, roughness: 0.4 });
      const roofMat = new THREE.MeshStandardMaterial({ color: 0x3a0f0a, roughness: 0.7 });
      const base = new THREE.Mesh(new THREE.BoxGeometry(7, 4, 6), wall);
      base.position.set(0, 2, 0); base.castShadow = base.receiveShadow = true; g.add(base);
      // gold trim band
      const band = new THREE.Mesh(new THREE.BoxGeometry(7.2, 0.35, 6.2), trim); band.position.y = 3.5; g.add(band);
      // pagoda-ish double roof
      for(let k = 0; k < 2; k++){
        const r = new THREE.Mesh(new THREE.ConeGeometry(5.4 - k * 1.6, 1.3, 4), roofMat);
        r.position.set(0, 4.4 + k * 1.1, 0); r.rotation.y = Math.PI / 4; g.add(r);
      }
      // open doorway
      const door = new THREE.Mesh(new THREE.BoxGeometry(2, 2.6, 0.2),
        new THREE.MeshStandardMaterial({ color: 0x1a0805, emissive: 0xff5a1f, emissiveIntensity: 0.25, roughness: 0.5 }));
      door.position.set(0, 1.3, 3.05); g.add(door);
      // a glowing grill (hot pot) out front
      const pot = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 0.8, 0.5, 16),
        new THREE.MeshStandardMaterial({ color: 0x2a2a2a, roughness: 0.6, metalness: 0.4 }));
      pot.position.set(2.6, 0.45, 3.2); g.add(pot);
      const embers = new THREE.Mesh(new THREE.CylinderGeometry(0.82, 0.82, 0.12, 16),
        new THREE.MeshStandardMaterial({ color: 0xff5a1f, emissive: 0xff6a2a, emissiveIntensity: 0.9, roughness: 0.5 }));
      embers.position.set(2.6, 0.72, 3.2); g.add(embers);
      const grillLight = new THREE.PointLight(0xff6a2a, 1.2, 10); grillLight.position.set(2.6, 1.2, 3.2); g.add(grillLight);
      // floating sign (auto-fit not needed, short text)
      const cv = document.createElement('canvas'); cv.width = 280; cv.height = 70;
      const ctx = cv.getContext('2d');
      ctx.fillStyle = 'rgba(20,6,4,0.9)'; ctx.fillRect(0, 0, 280, 70);
      ctx.strokeStyle = '#ffd64d'; ctx.lineWidth = 3; ctx.strokeRect(3, 3, 274, 64);
      ctx.fillStyle = '#ffe39a'; ctx.font = 'bold 22px Outfit, Arial'; ctx.textAlign = 'center';
      ctx.fillText('🥩 MOO KRATHA', 140, 30);
      ctx.font = '12px Outfit, Arial'; ctx.fillStyle = 'rgba(255,235,210,0.85)';
      ctx.fillText('Invest · Sell pork for 💵 · Press E', 140, 52);
      const tex = new THREE.CanvasTexture(cv);
      const sign = new THREE.Mesh(new THREE.PlaneGeometry(4.4, 1.1), new THREE.MeshBasicMaterial({ map: tex, transparent: true }));
      sign.position.set(0, 6.6, 0); g.add(sign);
      g.userData.sign = sign;
      scene.add(g);
      if(window.MinimapLandmarks){ try { window.MinimapLandmarks.push({ x: POS.x, z: POS.z, label: 'Moo Kratha', color: '#ff5a1f' }); } catch(_){} }
      return g;
    }
    const shopMesh = buildShop();

    // ── UI ──
    const css = document.createElement('style');
    css.textContent = `
#mkPrompt{position:fixed;left:50%;bottom:210px;transform:translateX(-50%);display:none;z-index:54;
  background:linear-gradient(180deg,rgba(24,8,5,.95),rgba(12,5,3,.95));border:2px solid rgba(255,120,60,.6);
  border-radius:13px;padding:9px 16px;color:#ffe7d8;font-family:'Outfit','Inter',sans-serif;text-align:center;pointer-events:none}
#mkPrompt .k{background:rgba(255,120,60,.25);border:1px solid rgba(255,120,60,.6);color:#ff9a6a;padding:1px 8px;border-radius:6px;font-family:monospace;font-weight:700}
.mk-bg{position:fixed;inset:0;display:none;align-items:center;justify-content:center;z-index:60;
  background:rgba(0,0,0,.74);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);padding:20px}
.mk-bg.show{display:flex}
.mk-card{width:430px;max-width:94vw;background:linear-gradient(180deg,rgba(30,12,8,.98),rgba(16,7,4,.98));
  border:2px solid rgba(255,120,60,.5);border-radius:18px;padding:18px 20px;color:#ffe7d8;
  font-family:'Outfit','Inter',sans-serif;box-shadow:0 24px 60px rgba(0,0,0,.6)}
.mk-card h2{font-family:'Bangers','Orbitron',sans-serif;font-size:25px;letter-spacing:1.3px;margin:0 0 8px;color:#ff8a4d}
.mk-tabs{display:flex;gap:8px;margin-bottom:12px}
.mk-tab{flex:1;background:rgba(255,255,255,.05);border:1px solid rgba(255,120,60,.3);color:#ffd2b8;border-radius:9px;
  padding:8px 0;font-family:'Outfit',sans-serif;font-weight:800;font-size:12px;cursor:pointer}
.mk-tab.on{background:linear-gradient(135deg,#ff7a3d,#ff9a5a);color:#2a0f05;border-color:transparent}
.mk-pane{display:none}.mk-pane.on{display:block}
.mk-val{font-size:14px;margin:6px 0 2px}.mk-val b{font-size:20px;color:#fff}
.mk-up{color:#5ff09c;font-weight:700}.mk-down{color:#ff7a6e;font-weight:700}
.mk-sub{font-size:12px;color:rgba(255,225,210,.7);margin:3px 0}.mk-sub b{color:#ffd2a8}
.mk-mine{background:rgba(255,120,60,.08);border:1px solid rgba(255,120,60,.25);border-radius:10px;padding:9px 12px;margin:12px 0;font-size:12.5px}
.mk-mine b{color:#fff}
.mk-row{display:flex;gap:8px;margin:9px 0;align-items:center}
.mk-card input{flex:1;background:rgba(0,0,0,.35);border:1px solid rgba(255,120,60,.4);border-radius:9px;
  padding:9px 12px;color:#ffe7d8;font-family:'JetBrains Mono',monospace;font-size:13px;outline:none}
.mk-card button{background:linear-gradient(135deg,#ff7a3d,#ff9a5a);border:0;border-radius:9px;padding:10px 14px;
  color:#2a0f05;font-family:'Outfit',sans-serif;font-weight:800;font-size:13px;cursor:pointer;transition:.12s}
.mk-card button:hover{filter:brightness(1.08);transform:translateY(-1px)}
.mk-card button.ghost{background:rgba(255,255,255,.06);color:#ffe7d8;border:1px solid rgba(255,120,60,.35)}
.mk-pork-big{font-size:34px;text-align:center;margin:6px 0}
`;
    document.head.appendChild(css);

    const prompt = document.createElement('div');
    prompt.id = 'mkPrompt';
    prompt.innerHTML = '<span class="k">E</span> visit the Moo Kratha Shop';
    document.body.appendChild(prompt);

    const bg = document.createElement('div');
    bg.className = 'mk-bg';
    bg.innerHTML =
      '<div class="mk-card">'
      + '<h2>🥩 Moo Kratha Shop</h2>'
      + '<div class="mk-tabs"><button class="mk-tab" data-p="invest">📈 Invest</button><button class="mk-tab on" data-p="pork">💵 Sell Pork</button></div>'
      + '<div class="mk-pane" id="mkPaneInvest">'
      +   '<div class="mk-val">Valuation <b id="mkVal">—</b> <span id="mkChange"></span></div>'
      +   '<div class="mk-sub">Shop takings · last hour <b id="mkDonH">—</b> · last 24h <b id="mkDon24">—</b></div>'
      +   '<div class="mk-mine">Your stake: <b id="mkMyVal">0 🥈</b> · <span id="mkMyShares">0</span> shares<br>'
      +     'Unclaimed cut: <b id="mkPending">0 🥈</b> <span id="mkClaimNote" style="color:rgba(255,225,210,.55);font-size:11px"></span></div>'
      +   '<div class="mk-row"><input id="mkAmt" type="number" min="1" placeholder="silver to invest"/><button id="mkInvest">Invest</button></div>'
      +   '<div class="mk-row"><button id="mkClaim" style="flex:1">💰 Claim cut</button><button id="mkSell" class="ghost" style="flex:1">Sell all shares</button></div>'
      + '</div>'
      + '<div class="mk-pane" id="mkPanePork">'
      +   '<div class="mk-pork-big">🥓</div>'
      +   '<div class="mk-sub" style="text-align:center">You have <b id="mkPorkN">0</b> Pork Meat · price <b>' + PORK_PRICE + ' 💵</b> each</div>'
      +   '<div class="mk-row"><input id="mkPorkQty" type="number" min="1" placeholder="how many to sell"/><button id="mkPorkSell">Sell</button></div>'
      +   '<div class="mk-row"><button id="mkPorkAll" style="flex:1">Sell ALL pork</button></div>'
      + '</div>'
      + '<div class="mk-row"><button id="mkClose" class="ghost" style="flex:1">Leave</button></div>'
      + '</div>';
    document.body.appendChild(bg);
    bg.addEventListener('click', (e) => { if(e.target === bg) close(); });

    // tabs
    bg.querySelectorAll('.mk-tab').forEach(t => t.addEventListener('click', () => {
      bg.querySelectorAll('.mk-tab').forEach(x => x.classList.remove('on'));
      bg.querySelectorAll('.mk-pane').forEach(x => x.classList.remove('on'));
      t.classList.add('on');
      bg.querySelector('#mkPane' + (t.dataset.p === 'pork' ? 'Pork' : 'Invest')).classList.add('on');
      render();
    }));
    // Sell Pork opens by default — reset to it each time the shop opens.
    function resetToPork(){
      bg.querySelectorAll('.mk-tab').forEach(x => x.classList.toggle('on', x.dataset.p === 'pork'));
      bg.querySelectorAll('.mk-pane').forEach(x => x.classList.remove('on'));
      bg.querySelector('#mkPanePork').classList.add('on');
    }

    function render(){
      sim();
      document.getElementById('mkVal').textContent = fmt(st.v) + ' 🥈';
      const chg = (st.v - st.v24ago) / Math.max(1, st.v24ago) * 100;
      const chEl = document.getElementById('mkChange');
      chEl.textContent = (chg >= 0 ? '▲ +' : '▼ ') + chg.toFixed(2) + '% (24h)';
      chEl.className = chg >= 0 ? 'mk-up' : 'mk-down';
      document.getElementById('mkDon24').textContent = fmt(st.v * st.rate) + ' 🥈';
      document.getElementById('mkDonH').textContent = fmt(st.v * st.rate / 24) + ' 🥈';
      document.getElementById('mkMyVal').textContent = full(myValue()) + ' 🥈';
      document.getElementById('mkMyShares').textContent = full(st.myShares);
      document.getElementById('mkPending').textContent = full(st.myPending) + ' 🥈';
      const wait = HOUR - (Date.now() - st.myLastClaim);
      document.getElementById('mkClaimNote').textContent =
        (st.myShares <= 0) ? '· invest first' : (wait > 0 ? '· claimable in ' + Math.ceil(wait / 60000) + ' min' : '· ready to claim');
      document.getElementById('mkPorkN').textContent = full(porkCount());
    }

    function open(){ render(); resetToPork(); bg.classList.add('show'); try { document.exitPointerLock?.(); } catch(_){} }
    function close(){ bg.classList.remove('show'); }

    document.getElementById('mkInvest').addEventListener('click', () => {
      sim();
      const amt = Math.max(0, Math.floor(Number(document.getElementById('mkAmt').value) || 0));
      if(amt <= 0){ window.floater?.('Enter an amount of silver', 'bad'); return; }
      if(silver() < amt){ window.floater?.('Not enough silver', 'bad'); return; }
      const shares = amt / price();
      State.credits -= amt; st.v += amt; st.s += shares; st.myShares += shares; st.myCost += amt;
      persist(); window.updateHUD?.(); window.saveState?.();
      document.getElementById('mkAmt').value = '';
      window.floater?.('🥩 Invested ' + full(amt) + ' 🥈 into Moo Kratha', 'good');
      render();
    });
    document.getElementById('mkClaim').addEventListener('click', () => {
      sim();
      if(st.myShares <= 0){ window.floater?.('You have no shares yet', 'bad'); return; }
      const wait = HOUR - (Date.now() - st.myLastClaim);
      if(wait > 0){ window.floater?.('Come back in ' + Math.ceil(wait / 60000) + ' min to claim', 'bad'); return; }
      const got = Math.floor(st.myPending);
      if(got <= 0){ window.floater?.('No takings accrued yet', 'bad'); return; }
      st.myPending -= got; st.myLastClaim = Date.now();
      State.credits = (State.credits || 0) + got;
      persist(); window.updateHUD?.(); window.saveState?.();
      window.floater?.('💰 Claimed ' + full(got) + ' 🥈', 'good');
      render();
    });
    document.getElementById('mkSell').addEventListener('click', () => {
      sim();
      if(st.myShares <= 0){ window.floater?.('You have no shares to sell', 'bad'); return; }
      const value = st.myShares * price(); const profit = value - st.myCost; const pend = Math.floor(st.myPending);
      State.credits = (State.credits || 0) + Math.floor(value) + pend;
      st.v = Math.max(1e6, st.v - value); st.s = Math.max(1, st.s - st.myShares);
      st.myShares = 0; st.myCost = 0; st.myPending = 0;
      persist(); window.updateHUD?.(); window.saveState?.();
      window.floater?.('📈 Sold shares for ' + full(value) + ' 🥈 (' + (profit >= 0 ? '+' : '') + full(profit) + ')', 'good');
      render();
    });

    // ── sell pork for CASH ──
    function sellPork(qty){
      const have = porkCount();
      qty = Math.min(have, Math.max(0, Math.floor(qty)));
      if(qty <= 0){ window.floater?.('No pork meat to sell', 'bad'); return; }
      try { window.takeItem ? window.takeItem('pork_meat', qty) : (State.inventory.pork_meat = have - qty); } catch(_){}
      const cash = qty * PORK_PRICE;
      State.paper = (State.paper || 0) + cash;
      window.updateHUD?.(); window.renderInventory?.(); window.saveState?.();
      // cha-ching!
      try { window.playPurchaseSound ? window.playPurchaseSound() : (window.fwSfx && window.fwSfx('coin', 0.5)); } catch (_) {}
      window.floater?.('🥓 Sold ' + qty + ' pork for +' + full(cash) + ' 💵 CASH', 'good');
      render();
    }
    document.getElementById('mkPorkSell').addEventListener('click', () => {
      const q = Math.max(0, Math.floor(Number(document.getElementById('mkPorkQty').value) || 0));
      document.getElementById('mkPorkQty').value = '';
      sellPork(q);
    });
    document.getElementById('mkPorkAll').addEventListener('click', () => sellPork(porkCount()));
    document.getElementById('mkClose').addEventListener('click', close);
    window.addEventListener('keydown', (e) => { if(e.code === 'Escape' && bg.classList.contains('show')) close(); });

    window.fwMooKrathaInteract = function(){
      if(Math.hypot(Player.pos.x - POS.x, Player.pos.z - POS.z) > RADIUS) return false;
      open(); return true;
    };

    setInterval(() => {
      sim(); persist();
      const near = Math.hypot(Player.pos.x - POS.x, Player.pos.z - POS.z) <= RADIUS;
      const inMenu = document.querySelector('.mk-bg.show, .church-bg.show, #invBg.show, #bankBg.show, #marketBg.show');
      prompt.style.display = (near && !inMenu) ? 'block' : 'none';
      if(window.camera && shopMesh.userData.sign){
        shopMesh.userData.sign.rotation.y = Math.atan2(window.camera.position.x - POS.x, window.camera.position.z - POS.z);
      }
    }, 500);

    // Exposed for the Ongoing Operations panel.
    window.fwMooKrathaInfo = function(){
      sim();
      return { pending: Math.floor(st.myPending), pct: (st.myShares / Math.max(1, st.s)) * 100,
               shares: st.myShares, claimWaitMs: HOUR - (Date.now() - st.myLastClaim) };
    };

    console.log('[mookratha] 🥩 Moo Kratha Shop ready @', POS.x, POS.z, '· valuation', fmt(st.v));
  }
})();
