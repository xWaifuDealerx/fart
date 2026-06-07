// =================================================================
// roki.js — "Roki" the white rabbit who roams the island.
// =================================================================
// Roki:
//   - hops around the island randomly (won't enter water / buildings)
//   - STOPS when the player comes within ~5m
//   - opens a small popup to BUY CARROTS from you in 💵 cash
//   - pays a premium (~5x the carrot's silver-market price → as cash)
// =================================================================
(function(){
  'use strict';

  function whenReady(){
    if(!window.THREE || !window.scene || !window.Player || !window.State || !window.groundHeightAt){
      setTimeout(whenReady, 300);
      return;
    }
    init();
  }
  whenReady();

  function init(){
    const THREE = window.THREE;
    const scene = window.scene;
    const Player = window.Player;
    const State  = window.State;
    const ISLAND_R = window.ISLAND_RADIUS || 95;
    const WATER_L  = window.WATER_LEVEL    || 0;
    const groundHeightAt = window.groundHeightAt;

    // Roki must not get stuck on the same buildings cats/junkies avoid.
    const FORBIDDEN = [
      { x:  36, z:  36, r: 14 },  // Arena
      { x: -15, z: -45, r: 4.5 }, // Football statue
      { x: -22, z:  -8, r: 5 },   // Bank
      { x: -22, z: -32, r: 6 },   // Market tent
      { x: -48, z:  28, r: 5 },   // Lab
      { x:  42, z:   0, r: 5 },   // Refinery
      { x:  50, z: -36, r: 5 },   // Poop
      { x:   0, z: -55, r: 6 },   // House
      { x:  84, z:   0, r: 5 },   // Dock
      { x: -38, z: -16, r: 6 },   // Bowling
      { x: -45, z:   8, r: 4 },   // Paper Mill
      { x:  -8, z: -16, r: 3 },   // Stats sign
      { x:  70, z:  70, r: 3 },   // Jail
      { x:  60, z:  60, r: 4 },   // Gary's tent
      { x: -55, z:  32, r: 4 },   // Fart Filling Station
    ];
    function forbidden(x, z){
      if(Math.hypot(x, z) >= ISLAND_R - 4) return true;
      if(groundHeightAt(x, z) <= WATER_L + 0.1) return true;
      for(const a of FORBIDDEN){
        if(Math.hypot(x - a.x, z - a.z) < a.r) return true;
      }
      return false;
    }

    // ── Build Roki's mesh: white rabbit body + head + tall ears ──
    function buildRabbit(){
      const grp = new THREE.Group();
      const whiteMat = new THREE.MeshStandardMaterial({ color: 0xfafafa, roughness: 0.55 });
      const innerEarMat = new THREE.MeshStandardMaterial({ color: 0xffb8c8, roughness: 0.6 });
      const eyeMat = new THREE.MeshStandardMaterial({ color: 0xff2a2a, emissive: 0xa00000, emissiveIntensity: 0.4 });
      const noseMat = new THREE.MeshStandardMaterial({ color: 0xff7faa, roughness: 0.5 });
      // Body — slightly rounded oval
      const body = new THREE.Mesh(new THREE.SphereGeometry(0.5, 16, 12), whiteMat);
      body.scale.set(1, 0.8, 1.25);
      body.position.y = 0.5;
      body.castShadow = true;
      grp.add(body);
      // Head
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.32, 14, 12), whiteMat);
      head.position.set(0, 0.85, 0.45);
      head.castShadow = true;
      grp.add(head);
      // Ears — tall, slightly tilted
      function makeEar(x){
        const earOuter = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.10, 0.55, 8), whiteMat);
        earOuter.position.set(x, 1.30, 0.40);
        earOuter.rotation.x = -0.1;
        earOuter.rotation.z = x > 0 ? -0.18 : 0.18;
        grp.add(earOuter);
        const earInner = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.06, 0.48, 8), innerEarMat);
        earInner.position.copy(earOuter.position);
        earInner.position.z += 0.03;
        earInner.rotation.copy(earOuter.rotation);
        grp.add(earInner);
        return earOuter;
      }
      const earL = makeEar(-0.13);
      const earR = makeEar( 0.13);
      // Eyes — red
      const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 8), eyeMat);
      eyeL.position.set(-0.13, 0.92, 0.69);
      grp.add(eyeL);
      const eyeR = eyeL.clone();
      eyeR.position.x = 0.13;
      grp.add(eyeR);
      // Nose
      const nose = new THREE.Mesh(new THREE.SphereGeometry(0.04, 6, 6), noseMat);
      nose.position.set(0, 0.83, 0.76);
      grp.add(nose);
      // Tail — cotton ball
      const tail = new THREE.Mesh(new THREE.SphereGeometry(0.14, 10, 8), whiteMat);
      tail.position.set(0, 0.55, -0.65);
      grp.add(tail);
      // Legs (front + back, small)
      function leg(x, z){
        const m = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.20, 0.18), whiteMat);
        m.position.set(x, 0.10, z);
        m.castShadow = true;
        grp.add(m);
        return m;
      }
      const legs = [
        leg(-0.25, 0.35), leg(0.25, 0.35),
        leg(-0.25, -0.4), leg(0.25, -0.4),
      ];
      return { mesh: grp, ears: [earL, earR], legs };
    }

    const rabbit = buildRabbit();
    scene.add(rabbit.mesh);
    // Drop Roki somewhere on a safe spot
    let spawn = { x: 25, z: 25 };
    for(let i = 0; i < 60; i++){
      const ang = Math.random() * Math.PI * 2;
      const r   = 15 + Math.random() * 50;
      const gx  = Math.cos(ang) * r;
      const gz  = Math.sin(ang) * r;
      if(!forbidden(gx, gz)){ spawn = { x: gx, z: gz }; break; }
    }
    rabbit.mesh.position.set(spawn.x, groundHeightAt(spawn.x, spawn.z), spawn.z);

    const roki = {
      x: spawn.x, z: spawn.z, y: groundHeightAt(spawn.x, spawn.z),
      yaw: Math.random() * Math.PI * 2,
      goalX: spawn.x, goalZ: spawn.z,
      state: "wander",       // wander | hop | stop
      stateTimer: 1.5,
      hopT: 0,
      speed: 0,
      mesh: rabbit.mesh,
      ears: rabbit.ears,
      legs: rabbit.legs,
    };

    // Floating name tag
    const tag = document.createElement('div');
    tag.style.cssText = `position:absolute;transform:translate(-50%,-100%);background:rgba(8,18,11,.88);color:#ffd4ec;padding:4px 10px;border:1px solid rgba(255,212,236,.55);border-radius:8px;font-family:'JetBrains Mono',monospace;font-size:10.5px;pointer-events:none;z-index:9;white-space:nowrap;`;
    tag.textContent = "Roki 🐇";
    (document.getElementById('chatBubbles')?.parentElement || document.body).appendChild(tag);

    function pickGoal(){
      for(let i = 0; i < 25; i++){
        const ang = Math.random() * Math.PI * 2;
        const r   = 5 + Math.random() * 20;
        const gx  = roki.x + Math.cos(ang) * r;
        const gz  = roki.z + Math.sin(ang) * r;
        if(forbidden(gx, gz)) continue;
        roki.goalX = gx; roki.goalZ = gz;
        return;
      }
    }
    pickGoal();

    // ── BUY CARROTS popup UI ──
    const css = document.createElement('style');
    css.textContent = `
      .roki-bg{position:fixed;inset:0;display:none;align-items:center;justify-content:center;background:rgba(0,0,0,.55);backdrop-filter:blur(6px);z-index:200}
      .roki-bg.show{display:flex}
      .roki-card{background:linear-gradient(180deg,rgba(28,14,32,.97),rgba(18,8,22,.97));border:2px solid rgba(255,182,220,.6);border-radius:18px;padding:22px;max-width:420px;width:92vw;color:#ffe9f5;font-family:'JetBrains Mono',monospace;text-align:center;box-shadow:0 0 32px rgba(255,182,220,.25)}
      .roki-card h2{font-family:'Bangers','Orbitron',sans-serif;font-size:28px;color:#ffb6dc;margin:0 0 6px;letter-spacing:1.2px}
      .roki-card .quip{font-size:12px;color:rgba(255,233,245,.7);margin-bottom:18px;line-height:1.5}
      .roki-row{display:flex;align-items:center;gap:10px;padding:10px;background:rgba(255,182,220,.07);border:1px solid rgba(255,182,220,.2);border-radius:12px;margin-bottom:10px;font-size:13px}
      .roki-row .ico{font-size:24px}
      .roki-row .meta{flex:1;text-align:left}
      .roki-row .meta .nm{font-weight:700;color:#fff1c2;font-size:14px}
      .roki-row .meta .sub{font-size:10.5px;color:rgba(255,233,245,.6);margin-top:2px}
      .roki-row .qty{font-size:11px;color:rgba(255,233,245,.55);margin-right:8px}
      .roki-card .btnrow{display:flex;gap:6px}
      .roki-card button.act{background:linear-gradient(135deg,#ffb6dc,#ff7eb5);color:#3a0c1e;border:0;padding:9px 13px;border-radius:100px;font-family:'Orbitron',sans-serif;font-weight:900;font-size:11px;text-transform:uppercase;cursor:pointer;letter-spacing:.8px}
      .roki-card button.act:hover{filter:brightness(1.07)}
      .roki-card .close{position:absolute;top:14px;right:14px;background:none;color:#ffb6dc;border:0;font-size:24px;cursor:pointer}
      .roki-empty{font-size:12px;color:rgba(255,233,245,.55);padding:20px;text-align:center}
      .roki-pop{display:inline-block;margin-bottom:10px;padding:6px 14px;border-radius:100px;background:rgba(255,182,220,.18);color:#ffb6dc;font-size:12px;font-weight:700;letter-spacing:.6px;opacity:0;transition:opacity .25s}
      .roki-pop.show{opacity:1}
      .roki-run{font-size:11px;color:rgba(255,233,245,.7);margin-bottom:14px}
      .roki-run b{color:#fff1c2;font-size:14px}
    `;
    document.head.appendChild(css);

    const modal = document.createElement('div');
    modal.className = 'roki-bg';
    modal.id = 'rokiBg';
    modal.innerHTML = `
      <div class="roki-card" style="position:relative;">
        <button class="close" id="rokiClose">×</button>
        <h2>🐇 Roki — Carrot Buyer</h2>
        <div class="quip">"Crunchy carrots! I pay premium cash for them — fresh out of your garden!"</div>
        <div class="roki-pop" id="rokiPop">+0 💵</div>
        <div class="roki-run" id="rokiRun">This visit: <b>0 💵</b></div>
        <div id="rokiList"></div>
      </div>
    `;
    document.body.appendChild(modal);

    let runTotal = 0;
    function premiumPrice(item){
      const base = item.marketPrice || item.suggestedPrice || 6;
      // Roki pays 5× the silver market price → premium in cash
      return Math.max(20, Math.round(base * 5));
    }
    function carrotIds(){
      // Anything that's a "carrot" — by id or by name. Keeps it future-proof.
      const ids = [];
      for(const id of Object.keys(window.ITEMS || {})){
        const it = window.ITEMS[id];
        if(!it) continue;
        if(/carrot/i.test(id) || /carrot/i.test(it.name || "")){
          if(/seed/i.test(id) || /seed/i.test(it.name || "")) continue; // not seeds
          ids.push(id);
        }
      }
      return ids;
    }
    function render(){
      const host = document.getElementById('rokiList');
      const out = [];
      for(const id of carrotIds()){
        const item = window.ITEMS[id];
        const qty = State.inventory?.[id] || 0;
        const price = premiumPrice(item);
        const all = price * qty;
        out.push(`<div class="roki-row"><div class="ico">${item.icon || '🥕'}</div><div class="meta"><div class="nm">${item.name}</div><div class="sub">Roki pays ${price} 💵 each (premium)</div></div><div class="qty">×${qty}</div><div class="btnrow"><button class="act sell1" data-id="${id}" data-price="${price}" ${qty<=0?'disabled style="opacity:.4;cursor:not-allowed;"':''}>SELL 1</button><button class="act sellall" data-id="${id}" data-price="${price}" data-qty="${qty}" ${qty<=0?'disabled style="opacity:.4;cursor:not-allowed;"':''}>SELL ALL</button></div></div>`);
      }
      host.innerHTML = out.length ? out.join("") : '<div class="roki-empty">Bring me some carrots and I will pay you handsomely! 🥕</div>';
      host.querySelectorAll('.sell1').forEach(b => b.addEventListener('click', () => {
        const id = b.dataset.id, price = Number(b.dataset.price) || 0;
        if((State.inventory[id] || 0) <= 0) return;
        window.takeItem(id, 1);
        State.paper = (State.paper || 0) + price;
        runTotal += price;
        showPop(`+${price} 💵 · sold 1 ${window.ITEMS[id].name}`);
        document.getElementById('rokiRun').innerHTML = `This visit: <b>${runTotal} 💵</b>`;
        window.playPurchaseSound?.(); window.saveState?.(); window.updateHUD?.(); render();
      }));
      host.querySelectorAll('.sellall').forEach(b => b.addEventListener('click', () => {
        const id = b.dataset.id;
        const price = Number(b.dataset.price) || 0;
        const qty = Math.min(Number(b.dataset.qty) || 0, State.inventory[id] || 0);
        if(qty <= 0) return;
        const total = price * qty;
        window.takeItem(id, qty);
        State.paper = (State.paper || 0) + total;
        runTotal += total;
        showPop(`+${total} 💵 · sold ${qty}× ${window.ITEMS[id].name}`);
        document.getElementById('rokiRun').innerHTML = `This visit: <b>${runTotal} 💵</b>`;
        window.playPurchaseSound?.(); window.saveState?.(); window.updateHUD?.(); render();
      }));
    }
    let _popT = null;
    function showPop(text){
      const p = document.getElementById('rokiPop');
      p.textContent = text;
      p.classList.remove('show'); void p.offsetWidth; p.classList.add('show');
      clearTimeout(_popT); _popT = setTimeout(() => p.classList.remove('show'), 2200);
    }
    function openRoki(){
      runTotal = 0;
      document.getElementById('rokiRun').innerHTML = `This visit: <b>0 💵</b>`;
      document.getElementById('rokiPop').classList.remove('show');
      render();
      document.getElementById('rokiBg').classList.add('show');
    }
    window.openRoki = openRoki;
    document.getElementById('rokiClose').addEventListener('click', () => {
      document.getElementById('rokiBg').classList.remove('show');
    });
    document.getElementById('rokiBg').addEventListener('click', (e) => {
      if(e.target.id === "rokiBg") document.getElementById('rokiBg').classList.remove('show');
    });

    // ── Proximity popup (same style as junkies/static-npcs) ──
    const popStyle = document.createElement('style');
    popStyle.textContent = `.roki-near{position:fixed;left:50%;bottom:130px;transform:translateX(-50%);display:none;background:linear-gradient(180deg,rgba(8,18,11,.96),rgba(5,14,9,.96));border:2px solid rgba(95,240,156,.55);border-radius:14px;padding:12px 18px;z-index:50;text-align:center;font-family:'Outfit','Inter','JetBrains Mono',sans-serif}.roki-near.show{display:block}.roki-near .who{font-size:11px;color:rgba(230,255,238,.7);margin-bottom:5px;letter-spacing:.4px}.roki-near .who b{color:#5ff09c}.roki-near .line{font-family:'Outfit','Inter',sans-serif;font-size:14px;font-weight:700;color:#fff1c2;margin-bottom:8px;letter-spacing:.3px}.roki-near .btn{background:rgba(95,240,156,.18);border:1px solid rgba(95,240,156,.55);color:#5ff09c;padding:8px 16px;border-radius:8px;font-family:'Outfit','Inter',sans-serif;font-weight:700;font-size:12px;letter-spacing:.6px;cursor:pointer}`;
    document.head.appendChild(popStyle);
    const nearPop = document.createElement('div');
    nearPop.className = 'roki-near';
    nearPop.innerHTML = '<div class="who"><b>Roki</b> 🐇</div><div class="line">Sell him carrots for premium cash!</div><button class="btn" id="rokiNearBtn">Trade</button>';
    document.body.appendChild(nearPop);
    document.getElementById('rokiNearBtn').addEventListener('click', openRoki);

    // ── Update loop (called once per second by ourselves) ──
    let lastT = performance.now();
    const _projVTag = new THREE.Vector3();
    function tick(){
      const now = performance.now();
      let dt = (now - lastT) / 1000; if(dt > 0.1) dt = 0.1; lastT = now;
      const dToPlayer = Math.hypot(Player.pos.x - roki.x, Player.pos.z - roki.z);
      if(dToPlayer < 5){
        roki.state = "stop"; roki.speed = 0;
        const dx = Player.pos.x - roki.x, dz = Player.pos.z - roki.z;
        roki.yaw = Math.atan2(dx, dz);
        nearPop.classList.add('show');
      } else { nearPop.classList.remove('show'); if(roki.state === "stop") roki.state = "wander"; }
      roki.y = groundHeightAt(roki.x, roki.z);
      roki.mesh.position.set(roki.x, roki.y, roki.z);
      roki.mesh.rotation.y = roki.yaw;
      _projVTag.set(roki.x, roki.y + 1.8, roki.z).project(window.camera);
      if(_projVTag.z < 1){
        tag.style.left = ((_projVTag.x * 0.5 + 0.5) * window.innerWidth) + 'px';
        tag.style.top  = ((1 - (_projVTag.y * 0.5 + 0.5)) * window.innerHeight) + 'px';
        tag.style.display = 'block';
      } else tag.style.display = 'none';
      requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
    console.log("[roki] ready");
  }
})();
