// =================================================================
// storage.js — buy storage capacity from Hapu, store items safe from
// arrest/death. Cash, silver, gold, wearables, tokens, NFTs excluded.
// =================================================================
(function(){
  'use strict';
  function whenReady(){
    if(!window.THREE || !window.scene || !window.Player || !window.State || !window.ITEMS || !window.groundHeightAt){
      setTimeout(whenReady, 300); return;
    }
    init();
  }
  whenReady();

  function init(){
    const THREE = window.THREE;
    const scene = window.scene;
    const Player = window.Player;
    const State = window.State;
    const ITEMS = window.ITEMS;
    const groundHeightAt = window.groundHeightAt;

    // ── State ──
    if(typeof State.storageCap !== "number") State.storageCap = 0;       // total slot count
    if(!State.storageBox || typeof State.storageBox !== "object") State.storageBox = {};

    const TIERS = [
      { id: 'small',   label: 'Small Locker',  slots: 20,  price: 1000 },
      { id: 'medium',  label: 'Medium Locker', slots: 60,  price: 5000 },
      { id: 'large',   label: 'Large Vault',   slots: 200, price: 20000 },
      { id: 'massive', label: 'Massive Vault', slots: 600, price: 75000 },
    ];

    const HAPU_POS = { x: -27, z: 32 };

    // ── Building ──
    function buildBuilding(){
      const grp = new THREE.Group();
      grp.position.set(HAPU_POS.x, groundHeightAt(HAPU_POS.x, HAPU_POS.z), HAPU_POS.z);
      const wallMat = new THREE.MeshStandardMaterial({ color: 0x5a4a35, roughness: 0.85 });
      const trimMat = new THREE.MeshStandardMaterial({ color: 0x8a7a4a, roughness: 0.6, metalness: 0.5 });
      const floorMat = new THREE.MeshStandardMaterial({ color: 0x2a2218, roughness: 0.9 });
      const slab = new THREE.Mesh(new THREE.BoxGeometry(6, 0.2, 5), floorMat);
      slab.position.y = 0.1; grp.add(slab);
      const back = new THREE.Mesh(new THREE.BoxGeometry(6, 3.2, 0.2), wallMat);
      back.position.set(0, 1.7, 2.4); grp.add(back);
      for(const sx of [-3, 3]){
        const side = new THREE.Mesh(new THREE.BoxGeometry(0.2, 3.2, 5), wallMat);
        side.position.set(sx, 1.7, 0); grp.add(side);
      }
      const roof = new THREE.Mesh(new THREE.BoxGeometry(6.4, 0.2, 5.4), trimMat);
      roof.position.set(0, 3.4, 0.5); roof.rotation.x = -0.15;
      grp.add(roof);
      // Storage boxes lining the back wall
      for(let i = -2; i <= 2; i++){
        const box = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.9, 0.8),
          new THREE.MeshStandardMaterial({ color: 0x6a4a25, roughness: 0.85 }));
        box.position.set(i * 1.1, 0.6, 1.8);
        grp.add(box);
        const lid = new THREE.Mesh(new THREE.BoxGeometry(0.92, 0.08, 0.82), trimMat);
        lid.position.set(i * 1.1, 1.08, 1.8);
        grp.add(lid);
      }
      // Sign
      const cvs = document.createElement('canvas');
      cvs.width = 512; cvs.height = 128;
      const ctx = cvs.getContext('2d');
      ctx.fillStyle = '#1a1408'; ctx.fillRect(0, 0, 512, 128);
      ctx.strokeStyle = '#ffce4a'; ctx.lineWidth = 5; ctx.strokeRect(8, 8, 496, 112);
      ctx.fillStyle = '#ffce4a';
      ctx.font = "900 56px 'Bangers','Orbitron',sans-serif";
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('STORAGE ROOM', 256, 55);
      ctx.fillStyle = '#fff1c2';
      ctx.font = "700 22px 'Orbitron',sans-serif";
      ctx.fillText('HAPU KEEPS YOUR STUFF SAFE', 256, 100);
      const tex = new THREE.CanvasTexture(cvs);
      const sign = new THREE.Mesh(new THREE.PlaneGeometry(4.6, 1.15),
        new THREE.MeshBasicMaterial({ map: tex }));
      sign.position.set(0, 3.8, -2.4);
      sign.rotation.set(0.1, Math.PI, 0);
      grp.add(sign);
      // Warm interior glow
      const lt = new THREE.PointLight(0xffce4a, 1.6, 16);
      lt.position.set(0, 2.6, 0); grp.add(lt);
      scene.add(grp);
    }
    buildBuilding();

    // ── Hapu NPC ──
    function buildHapu(x, z){
      const grp = new THREE.Group();
      const baseY = groundHeightAt(x, z);
      grp.position.set(x, baseY, z);
      grp.rotation.y = Math.PI; // eyes face -z (toward the open front door)
      const bodyMat = new THREE.MeshStandardMaterial({ color: 0xffd6a0, roughness: 0.55 });
      const dark    = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.6 });
      const eyeW    = new THREE.MeshStandardMaterial({ color: 0xffffff });
      const eyeB    = new THREE.MeshBasicMaterial({ color: 0x000000 });
      const body = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.95, 1.1), bodyMat);
      body.position.y = 1.4; body.castShadow = true; grp.add(body);
      const bezel = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.07, 0.95), dark);
      bezel.position.y = 1.91; grp.add(bezel);
      const paper = new THREE.Mesh(new THREE.PlaneGeometry(0.85, 0.7),
        new THREE.MeshStandardMaterial({ color: 0xffffff, side: THREE.DoubleSide, roughness: 0.95 }));
      paper.position.set(0, 1.97, -0.05);
      paper.rotation.x = -Math.PI / 2 + 0.35;
      grp.add(paper);
      const eyeR = 0.18;
      const eL = new THREE.Mesh(new THREE.SphereGeometry(eyeR, 14, 14), eyeW);
      eL.position.set(-0.28, 1.6, 0.55); grp.add(eL);
      const eR = eL.clone(); eR.position.x = 0.28; grp.add(eR);
      const pL = new THREE.Mesh(new THREE.SphereGeometry(eyeR * 0.4, 10, 10), eyeB);
      pL.position.set(-0.28, 1.6, 0.72); grp.add(pL);
      const pR = pL.clone(); pR.position.x = 0.28; grp.add(pR);
      const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.3, 6), dark);
      ant.position.set(0.55, 2.1, 0); grp.add(ant);
      const orb = new THREE.Mesh(new THREE.SphereGeometry(0.075, 10, 10),
        new THREE.MeshStandardMaterial({ color: 0xffce4a, emissive: 0xffce4a, emissiveIntensity: 1.4 }));
      orb.position.set(0.55, 2.25, 0); grp.add(orb);
      // Tag
      const tag = document.createElement('div');
      tag.style.cssText = "position:absolute;transform:translate(-50%,-100%);background:rgba(8,18,11,.88);color:#ffce4a;padding:4px 10px;border:1px solid rgba(255,206,74,.55);border-radius:8px;font-family:'Outfit','JetBrains Mono',monospace;font-size:10.5px;pointer-events:none;z-index:9;white-space:nowrap;";
      tag.textContent = 'Hapu \u{1F5A8}';
      (document.getElementById('chatBubbles')?.parentElement || document.body).appendChild(tag);
      scene.add(grp);
      return { x, z, y: baseY + 2.6, tag };
    }
    const Hapu = buildHapu(HAPU_POS.x, HAPU_POS.z - 1.0);

    // ── Modal styles ──
    const css = document.createElement('style');
    css.textContent = `
.stor-bg{position:fixed;inset:0;display:none;align-items:center;justify-content:center;background:rgba(0,0,0,.7);z-index:200;padding:18px;}
.stor-bg.show{display:flex;}
.stor-card{background:linear-gradient(180deg,rgba(28,20,8,.97),rgba(14,10,4,.97));border:2px solid rgba(255,206,74,.55);border-radius:18px;padding:22px;max-width:720px;width:100%;max-height:90vh;overflow:auto;color:#fff1c2;font-family:'Outfit','Inter',sans-serif;position:relative;}
.stor-card h2{font-family:'Bangers','Orbitron',sans-serif;font-size:24px;color:#ffce4a;letter-spacing:1.5px;margin-bottom:4px;text-align:center;}
.stor-card .sub{font-size:11.5px;color:rgba(230,255,238,.7);margin-bottom:14px;text-align:center;line-height:1.5;}
.stor-close{position:absolute;top:14px;right:14px;background:none;color:#ffce4a;border:0;font-size:26px;cursor:pointer;}
.stor-stat{background:rgba(255,206,74,.08);border:1px solid rgba(255,206,74,.32);border-radius:12px;padding:10px 14px;display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;font-size:12.5px;}
.stor-stat b{color:#ffce4a;}
.stor-tier{display:grid;grid-template-columns:1fr auto;gap:10px;align-items:center;background:rgba(255,206,74,.05);border:1px solid rgba(255,206,74,.20);border-radius:10px;padding:11px;margin-bottom:8px;}
.stor-tier .nm{font-weight:700;font-size:13px;color:#fff1c2;}
.stor-tier .sub2{font-size:11px;color:rgba(230,255,238,.6);}
.stor-btn{background:linear-gradient(135deg,#ffce4a,#fff1c2);color:#1a1408;border:0;padding:9px 18px;border-radius:10px;font-family:'Outfit',sans-serif;font-weight:800;font-size:11.5px;letter-spacing:.9px;cursor:pointer;text-transform:uppercase;}
.stor-btn:hover{filter:brightness(1.06);}
.stor-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px;margin-top:14px;}
.stor-half{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:14px;}
.stor-half h3{font-size:11.5px;color:rgba(230,255,238,.7);letter-spacing:1.1px;text-transform:uppercase;font-weight:700;margin-bottom:6px;}
.stor-slot{background:rgba(255,206,74,.06);border:1px solid rgba(255,206,74,.22);border-radius:10px;padding:8px;text-align:center;cursor:grab;font-family:'Outfit','Inter',sans-serif;}
.stor-slot:hover{background:rgba(255,206,74,.12);border-color:rgba(255,206,74,.5);}
.stor-slot .ic{font-size:22px;display:block;margin-bottom:2px;}
.stor-slot .nm{font-size:10.5px;color:#fff1c2;font-weight:700;}
.stor-slot .qty{font-size:10.5px;color:#ffce4a;font-family:'JetBrains Mono',monospace;}
.stor-zone{min-height:140px;border:2px dashed rgba(255,206,74,.42);border-radius:12px;padding:8px;}
.stor-zone.over{background:rgba(255,206,74,.10);border-color:#ffce4a;}
.stor-zone .empty{font-size:11px;color:rgba(230,255,238,.45);text-align:center;padding:24px 12px;}
.stor-pop{position:fixed;left:50%;bottom:130px;transform:translateX(-50%);display:none;background:linear-gradient(180deg,rgba(28,20,8,.96),rgba(14,10,4,.96));border:2px solid rgba(255,206,74,.55);border-radius:14px;padding:12px 18px;z-index:50;text-align:center;font-family:'Outfit','Inter',sans-serif;color:#fff1c2;}
.stor-pop.show{display:block;}
.stor-pop .who{font-size:11px;color:rgba(230,255,238,.7);margin-bottom:5px;}
.stor-pop .who b{color:#ffce4a;}
.stor-pop .line{font-size:14px;font-weight:700;margin-bottom:6px;}
.stor-pop kbd{background:rgba(255,206,74,.22);border:1px solid rgba(255,206,74,.55);color:#ffce4a;padding:2px 8px;border-radius:6px;font-family:monospace;font-size:11px;font-weight:700;}
`;
    document.head.appendChild(css);

    const bg = document.createElement('div');
    bg.className = 'stor-bg';
    bg.id = 'storBg';
    bg.innerHTML = '<div class="stor-card"><button class="stor-close" id="storClose">×</button><h2>\u{1F4E6} STORAGE ROOM · HAPU</h2><div class="sub">Buy capacity once — your stuff survives arrest and death.</div><div id="storBody"></div></div>';
    document.body.appendChild(bg);
    document.getElementById('storClose').addEventListener('click', () => bg.classList.remove('show'));
    bg.addEventListener('click', (e) => { if(e.target === bg) bg.classList.remove('show'); });

    function canStore(id){
      const it = ITEMS[id];
      if(!it) return false;
      if(it.type === "wearable") return false;
      if(it.isNFT) return false;
      if(id === 'paper' || id === 'fake') return false;
      // Token-like coin holdings (e.g. POOP holdings) — skip if type is token
      if(it.type === 'token' || it.type === 'currency') return false;
      return true;
    }
    function usedSlots(){
      let s = 0;
      for(const id of Object.keys(State.storageBox || {})) s += Number(State.storageBox[id] || 0);
      return s;
    }

    function renderBody(){
      const host = document.getElementById('storBody');
      const cap = State.storageCap || 0;
      const used = usedSlots();
      let html = '<div class="stor-stat"><span>Capacity</span><b>' + used + ' / ' + cap + '</b></div>';
      if(used >= cap){
        html += '<div style="font-size:11.5px;color:rgba(230,255,238,.7);margin-bottom:10px;text-align:center;">Need more space? Upgrade below.</div>';
      }
      // Upgrade tiers — each click ADDS slots
      html += '<h3 style="font-size:11.5px;color:rgba(230,255,238,.7);letter-spacing:1.1px;text-transform:uppercase;font-weight:700;margin-bottom:6px;">Buy more space</h3>';
      for(const t of TIERS){
        html += '<div class="stor-tier"><div><div class="nm">' + t.label + '</div><div class="sub2">+' + t.slots + ' slots · ' + t.price.toLocaleString() + ' \u{1F948} Silver</div></div><button class="stor-btn" data-buy="' + t.id + '">Buy</button></div>';
      }
      if(cap > 0){
        html += '<div class="stor-half"><div><h3>\u{1F392} Your inventory · drag in</h3><div class="stor-zone" id="storInvZone"></div></div><div><h3>\u{1F4E6} In storage</h3><div class="stor-zone" id="storBoxZone"></div></div></div>';
      }
      host.innerHTML = html;
      host.querySelectorAll('.stor-btn[data-buy]').forEach(b => b.addEventListener('click', () => {
        const t = TIERS.find(x => x.id === b.dataset.buy);
        if(!t) return;
        if((State.credits || 0) < t.price){ window.floater?.('Need ' + t.price + ' \u{1F948}', 'bad'); return; }
        State.credits -= t.price;
        State.storageCap = (State.storageCap || 0) + t.slots;
        window.floater?.('+' + t.slots + ' storage slots', 'good');
        window.playPurchaseSound?.();
        window.saveState?.(); window.updateHUD?.();
        renderBody();
      }));
      if(cap <= 0) return;
      const invZone = document.getElementById('storInvZone');
      const boxZone = document.getElementById('storBoxZone');
      // Inventory side
      const invIds = Object.keys(State.inventory || {}).filter(id => (State.inventory[id] || 0) > 0 && canStore(id));
      if(invIds.length === 0){
        invZone.innerHTML = '<div class="empty">No storable items in inventory</div>';
      } else {
        invZone.innerHTML = invIds.map(id => {
          const it = ITEMS[id]; const qty = State.inventory[id];
          return '<div class="stor-slot" draggable="true" data-src="inv" data-id="' + id + '" style="display:inline-block;margin:4px;min-width:84px;"><span class="ic">' + (it?.icon || '\u{1F4E6}') + '</span><div class="nm">' + (it?.name || id) + '</div><div class="qty">×' + qty + '</div></div>';
        }).join('');
      }
      // Box side
      const boxIds = Object.keys(State.storageBox || {}).filter(id => (State.storageBox[id] || 0) > 0);
      if(boxIds.length === 0){
        boxZone.innerHTML = '<div class="empty">Empty — drag items here</div>';
      } else {
        boxZone.innerHTML = boxIds.map(id => {
          const it = ITEMS[id]; const qty = State.storageBox[id];
          return '<div class="stor-slot" draggable="true" data-src="box" data-id="' + id + '" style="display:inline-block;margin:4px;min-width:84px;"><span class="ic">' + (it?.icon || '\u{1F4E6}') + '</span><div class="nm">' + (it?.name || id) + '</div><div class="qty">×' + qty + '</div></div>';
        }).join('');
      }
      // Drag/drop wiring
      let dragInfo = null;
      host.querySelectorAll('.stor-slot[draggable="true"]').forEach(el => {
        el.addEventListener('dragstart', (e) => {
          dragInfo = { src: el.dataset.src, id: el.dataset.id };
          e.dataTransfer.setData('text/plain', el.dataset.id);
          e.dataTransfer.effectAllowed = 'move';
          el.style.opacity = '0.5';
        });
        el.addEventListener('dragend', () => { el.style.opacity = ''; });
      });
      [invZone, boxZone].forEach(zone => {
        zone.addEventListener('dragover', (e) => { e.preventDefault(); zone.classList.add('over'); });
        zone.addEventListener('dragleave', () => zone.classList.remove('over'));
        zone.addEventListener('drop', (e) => {
          e.preventDefault();
          zone.classList.remove('over');
          if(!dragInfo) return;
          const wantSrc = zone === invZone ? 'box' : 'inv';
          if(dragInfo.src !== wantSrc){ dragInfo = null; return; } // moving same direction = no-op
          const id = dragInfo.id;
          if(zone === boxZone){
            // inv → box
            if(!canStore(id)){ window.floater?.("Can't store that here", "bad"); return; }
            if(usedSlots() >= (State.storageCap || 0)){ window.floater?.('Storage full · upgrade', 'bad'); return; }
            const qty = Math.min(1, State.inventory?.[id] || 0);
            if(qty <= 0) return;
            window.takeItem?.(id, qty);
            State.storageBox[id] = (State.storageBox[id] || 0) + qty;
            window.floater?.('Stored 1 ' + (ITEMS[id]?.name || id), 'good');
          } else {
            // box → inv
            const have = State.storageBox?.[id] || 0;
            if(have <= 0) return;
            State.storageBox[id] = have - 1;
            if(State.storageBox[id] <= 0) delete State.storageBox[id];
            window.addItem?.(id, 1);
            window.floater?.('Retrieved 1 ' + (ITEMS[id]?.name || id), 'good');
          }
          dragInfo = null;
          window.saveState?.();
          window.updateHUD?.();
          renderBody();
        });
      });
    }
    window.openHapu = () => { renderBody(); bg.classList.add('show'); };

    // Proximity popup
    const pop = document.createElement('div');
    pop.className = 'stor-pop';
    pop.innerHTML = '<div class="who"><b>Hapu</b> \u{1F5A8}</div><div class="line">Store your stuff safely</div><div>Press <kbd>E</kbd> or click below</div><button class="stor-btn" id="storPopBtn" style="margin-top:7px;">Open Storage</button>';
    document.body.appendChild(pop);
    document.getElementById('storPopBtn').addEventListener('click', () => window.openHapu());
    let near = false;
    setInterval(() => {
      const d = Math.hypot(Player.pos.x - HAPU_POS.x, Player.pos.z - HAPU_POS.z);
      near = d < 5;
      pop.classList.toggle('show', near);
    }, 220);
    window.addEventListener('keydown', (e) => {
      if(e.code !== "KeyE" || !near) return;
      const a = document.activeElement;
      if(a && (a.tagName === "INPUT" || a.tagName === "TEXTAREA")) return;
      window.openHapu();
    });

    // Project Hapu's tag
    const _v = new THREE.Vector3();
    function tagTick(){
      _v.set(Hapu.x, Hapu.y, Hapu.z).project(window.camera);
      if(_v.z < 1){
        Hapu.tag.style.left = ((_v.x * 0.5 + 0.5) * window.innerWidth) + 'px';
        Hapu.tag.style.top  = ((1 - (_v.y * 0.5 + 0.5)) * window.innerHeight) + 'px';
        Hapu.tag.style.display = 'block';
      } else { Hapu.tag.style.display = 'none'; }
      requestAnimationFrame(tagTick);
    }
    requestAnimationFrame(tagTick);
    console.log('[storage] ready');
  }
})();
