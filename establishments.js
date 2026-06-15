// =================================================================
// establishments.js — Tool Service (Siim) + Miner's Exchange (Traech)
// + new ores (Copper, Tin) + display-only rare ores.
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

    // ── New ore items ──
    // Copper ore (cheapest) — orange-pink
    // Tin ore — silvery gray with green hint
    // Iron ore already exists in main module; we set marketPrice if missing
    if(!ITEMS.copper_ore){
      ITEMS.copper_ore = {
        id: 'copper_ore', name: 'Copper Ore', icon: '\u{1F7E0}', color: '#d27a4a',
        type: 'ore', isNFT: false, suggestedPrice: 8, marketPrice: 8,
      };
    }
    if(!ITEMS.tin_ore){
      ITEMS.tin_ore = {
        id: 'tin_ore', name: 'Tin Ore', icon: '\u{2B1B}', color: '#a8c0c0',
        type: 'ore', isNFT: false, suggestedPrice: 15, marketPrice: 15,
      };
    }
    // Iron — ensure marketPrice
    if(ITEMS.iron_ore && !ITEMS.iron_ore.marketPrice) ITEMS.iron_ore.marketPrice = 30;
    if(!ITEMS.iron_ore){
      ITEMS.iron_ore = { id: 'iron_ore', name: 'Iron Ore', icon: '\u{1F501}', color: '#8c7060', type: 'ore', isNFT: false, marketPrice: 30 };
    }
    // Display-only rare ores
    if(!ITEMS.titanium_ore){
      ITEMS.titanium_ore = { id: 'titanium_ore', name: 'Titanium Ore', icon: '\u{1F4A0}', color: '#c0d8ff', type: 'ore', isNFT: false, marketPrice: 200 };
    }
    if(!ITEMS.adamantium_ore){
      ITEMS.adamantium_ore = { id: 'adamantium_ore', name: 'Adamantium Ore', icon: '\u{1F48E}', color: '#5060a0', type: 'ore', isNFT: false, marketPrice: 800 };
    }
    if(!ITEMS.mithril_ore){
      ITEMS.mithril_ore = { id: 'mithril_ore', name: 'Mithril Ore', icon: '\u{1F31F}', color: '#a8e0ff', type: 'ore', isNFT: false, marketPrice: 2500 };
    }

    // Build a basic printer NPC (re-used pattern).
    function buildNPC(name, tint, x, z, facing){
      const grp = new THREE.Group();
      const baseY = groundHeightAt(x, z);
      grp.position.set(x, baseY, z);
      grp.rotation.y = facing;
      const bodyMat = new THREE.MeshStandardMaterial({ color: tint, roughness: 0.55 });
      const darkMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.6 });
      const eyeWMat = new THREE.MeshStandardMaterial({ color: 0xffffff });
      const eyeBMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
      const body = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.95, 1.1), bodyMat);
      body.position.y = 1.4; body.castShadow = true;
      grp.add(body);
      const bezel = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.07, 0.95), darkMat);
      bezel.position.y = 1.91; grp.add(bezel);
      const paper = new THREE.Mesh(new THREE.PlaneGeometry(0.85, 0.7),
        new THREE.MeshStandardMaterial({ color: 0xffffff, side: THREE.DoubleSide, roughness: 0.95 }));
      paper.position.set(0, 1.97, -0.05);
      paper.rotation.x = -Math.PI / 2 + 0.35;
      grp.add(paper);
      const eyeR = 0.18;
      const eyeL = new THREE.Mesh(new THREE.SphereGeometry(eyeR, 14, 14), eyeWMat);
      eyeL.position.set(-0.28, 1.6, 0.55); grp.add(eyeL);
      const eyeRight = eyeL.clone(); eyeRight.position.x = 0.28; grp.add(eyeRight);
      const pupL = new THREE.Mesh(new THREE.SphereGeometry(eyeR * 0.4, 10, 10), eyeBMat);
      pupL.position.set(-0.28, 1.6, 0.72); grp.add(pupL);
      const pupR = pupL.clone(); pupR.position.x = 0.28; grp.add(pupR);
      // Name tag
      const tag = document.createElement('div');
      tag.style.cssText = "position:absolute;transform:translate(-50%,-100%);background:rgba(8,18,11,.88);color:#5ff09c;padding:4px 10px;border:1px solid rgba(95,240,156,.55);border-radius:8px;font-family:'Outfit','JetBrains Mono',monospace;font-size:10.5px;pointer-events:none;z-index:9;white-space:nowrap;";
      tag.textContent = name + " \u{1F5A8}";
      (document.getElementById('chatBubbles')?.parentElement || document.body).appendChild(tag);
      scene.add(grp);
      return { x, z, y: baseY + 2.6, tag, name };
    }

    // ── Tool Service building + Siim ──
    const TS_POS = { x: 18, z: 8 };
    (function buildToolService(){
      const grp = new THREE.Group();
      grp.position.set(TS_POS.x, groundHeightAt(TS_POS.x, TS_POS.z), TS_POS.z);
      const wallMat = new THREE.MeshStandardMaterial({ color: 0x4a3a25, roughness: 0.85 });
      const roofMat = new THREE.MeshStandardMaterial({ color: 0x7a4a25, roughness: 0.75 });
      const floorMat = new THREE.MeshStandardMaterial({ color: 0x3a2a18, roughness: 0.9 });
      // Floor slab
      const slab = new THREE.Mesh(new THREE.BoxGeometry(6, 0.2, 5), floorMat);
      slab.position.y = 0.1; grp.add(slab);
      // Back wall
      const back = new THREE.Mesh(new THREE.BoxGeometry(6, 3.2, 0.2), wallMat);
      back.position.set(0, 1.7, 2.4); grp.add(back);
      // Side walls
      for(const sx of [-3, 3]){
        const side = new THREE.Mesh(new THREE.BoxGeometry(0.2, 3.2, 5), wallMat);
        side.position.set(sx, 1.7, 0); grp.add(side);
      }
      // Open front — no wall
      // Slanted roof
      const roof = new THREE.Mesh(new THREE.BoxGeometry(6.4, 0.2, 5.4), roofMat);
      roof.position.set(0, 3.4, 0.5);
      roof.rotation.x = -0.15;
      grp.add(roof);
      // Workbench
      const bench = new THREE.Mesh(new THREE.BoxGeometry(3.5, 1.0, 1.2),
        new THREE.MeshStandardMaterial({ color: 0x6a4a25, roughness: 0.85 }));
      bench.position.set(0, 0.6, 1.4); grp.add(bench);
      // Sharpening wheel
      const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.18, 24),
        new THREE.MeshStandardMaterial({ color: 0x8a8a8a, roughness: 0.5, metalness: 0.6 }));
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(-1.4, 1.4, 1.4);
      grp.add(wheel);
      // Anvil
      const anvil = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.5, 0.5),
        new THREE.MeshStandardMaterial({ color: 0x2a2a2a, roughness: 0.65, metalness: 0.7 }));
      anvil.position.set(0.9, 1.3, 1.4); grp.add(anvil);
      // Sign canvas
      const cvs = document.createElement('canvas');
      cvs.width = 512; cvs.height = 128;
      const ctx = cvs.getContext('2d');
      ctx.fillStyle = '#1a1a1a'; ctx.fillRect(0, 0, 512, 128);
      ctx.strokeStyle = '#5ff09c'; ctx.lineWidth = 5; ctx.strokeRect(8, 8, 496, 112);
      ctx.fillStyle = '#5ff09c';
      ctx.font = "900 56px 'Bangers','Orbitron',sans-serif";
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('TOOL SERVICE', 256, 50);
      ctx.fillStyle = '#fff1c2';
      ctx.font = "700 22px 'Orbitron',sans-serif";
      ctx.fillText('SIIM SHARPENS YOUR GEAR', 256, 96);
      const tex = new THREE.CanvasTexture(cvs);
      const sign = new THREE.Mesh(new THREE.PlaneGeometry(4.5, 1.1),
        new THREE.MeshBasicMaterial({ map: tex }));
      sign.position.set(0, 3.7, -2.3);
      sign.rotation.x = 0.1;
      grp.add(sign);
      scene.add(grp);
    })();
    const Siim = buildNPC('Siim', 0xd4c4b4, TS_POS.x, TS_POS.z + 1.0, Math.PI);

    // ── Miner's Exchange + Traech ──
    const ME_POS = { x: -18, z: 8 };
    (function buildExchange(){
      const grp = new THREE.Group();
      grp.position.set(ME_POS.x, groundHeightAt(ME_POS.x, ME_POS.z), ME_POS.z);
      const wallMat = new THREE.MeshStandardMaterial({ color: 0x3a4a35, roughness: 0.85 });
      const roofMat = new THREE.MeshStandardMaterial({ color: 0x2a3a25, roughness: 0.75 });
      const slab = new THREE.Mesh(new THREE.BoxGeometry(6, 0.2, 5),
        new THREE.MeshStandardMaterial({ color: 0x2a2a2a, roughness: 0.9 }));
      slab.position.y = 0.1; grp.add(slab);
      const back = new THREE.Mesh(new THREE.BoxGeometry(6, 3.2, 0.2), wallMat);
      back.position.set(0, 1.7, 2.4); grp.add(back);
      for(const sx of [-3, 3]){
        const side = new THREE.Mesh(new THREE.BoxGeometry(0.2, 3.2, 5), wallMat);
        side.position.set(sx, 1.7, 0); grp.add(side);
      }
      const roof = new THREE.Mesh(new THREE.BoxGeometry(6.4, 0.2, 5.4), roofMat);
      roof.position.set(0, 3.4, 0.5);
      roof.rotation.x = -0.15;
      grp.add(roof);
      // Counter
      const counter = new THREE.Mesh(new THREE.BoxGeometry(3.5, 1.0, 1.2),
        new THREE.MeshStandardMaterial({ color: 0x5a4a30, roughness: 0.85 }));
      counter.position.set(0, 0.6, 1.4); grp.add(counter);
      // Crates of "ore"
      for(let i = 0; i < 3; i++){
        const crate = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.7, 0.7),
          new THREE.MeshStandardMaterial({ color: 0x6a4a25, roughness: 0.85 }));
        crate.position.set(-1.4 + i * 1.4, 0.45, 2.0);
        grp.add(crate);
        // Ore bumps on top
        const c = [0xd27a4a, 0xa8c0c0, 0x8c7060][i];
        const ore = new THREE.Mesh(new THREE.SphereGeometry(0.18, 10, 8),
          new THREE.MeshStandardMaterial({ color: c, roughness: 0.6, metalness: 0.3 }));
        ore.position.set(-1.4 + i * 1.4, 0.95, 2.0); grp.add(ore);
      }
      // Sign
      const cvs = document.createElement('canvas');
      cvs.width = 512; cvs.height = 128;
      const ctx = cvs.getContext('2d');
      ctx.fillStyle = '#1a1a1a'; ctx.fillRect(0, 0, 512, 128);
      ctx.strokeStyle = '#5ff09c'; ctx.lineWidth = 5; ctx.strokeRect(8, 8, 496, 112);
      ctx.fillStyle = '#5ff09c';
      ctx.font = "900 50px 'Bangers','Orbitron',sans-serif";
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText("MINER'S EXCHANGE", 256, 50);
      ctx.fillStyle = '#fff1c2';
      ctx.font = "700 22px 'Orbitron',sans-serif";
      ctx.fillText('TRAECH BUYS & SELLS ORES', 256, 96);
      const tex = new THREE.CanvasTexture(cvs);
      const sign = new THREE.Mesh(new THREE.PlaneGeometry(4.5, 1.1),
        new THREE.MeshBasicMaterial({ map: tex }));
      // Sign faces the customer who enters from the open front of the
      // building (z > 0 side). Rotate 180° so the readable face points
      // the right way.
      sign.position.set(0, 3.7, -2.3);
      sign.rotation.set(0.1, Math.PI, 0);
      grp.add(sign);
      scene.add(grp);
    })();
    const Traech = buildNPC('Traech', 0x6a8a4a, ME_POS.x, ME_POS.z + 1.0, Math.PI);

    // ── Shared styles ──
    const css = document.createElement('style');
    css.textContent = `
.est-bg{position:fixed;inset:0;display:none;align-items:center;justify-content:center;background:rgba(0,0,0,.65);z-index:200}
.est-bg.show{display:flex}
.est-card{background:linear-gradient(180deg,rgba(8,18,11,.97),rgba(5,14,9,.97));border:2px solid rgba(95,240,156,.55);border-radius:18px;padding:22px;max-width:520px;width:94vw;max-height:90vh;overflow:auto;color:#fff1c2;font-family:'Outfit','Inter',sans-serif;position:relative;box-shadow:0 24px 60px rgba(0,0,0,.55)}
.est-card h2{font-family:'Bangers','Orbitron',sans-serif;font-size:24px;color:#5ff09c;letter-spacing:1.5px;margin-bottom:6px;text-align:center}
.est-card p{font-size:11.5px;color:rgba(230,255,238,.7);margin-bottom:14px;text-align:center;line-height:1.5}
.est-row{display:flex;align-items:center;gap:10px;padding:9px 10px;background:rgba(95,240,156,.05);border:1px solid rgba(95,240,156,.18);border-radius:10px;margin-bottom:7px;font-size:12px}
.est-row .ic{font-size:22px;width:30px;text-align:center}
.est-row .meta{flex:1}
.est-row .nm{font-weight:700;color:#fff1c2;font-size:13.5px}
.est-row .sub{font-size:10.5px;color:rgba(230,255,238,.6);margin-top:2px}
.est-row .qty{font-size:10.5px;color:rgba(230,255,238,.5);margin-right:6px}
.est-row .btns{display:flex;gap:5px}
.est-btn{background:rgba(95,240,156,.18);border:1px solid rgba(95,240,156,.55);color:#5ff09c;padding:6px 11px;border-radius:8px;font-family:'Outfit','Inter',sans-serif;font-weight:700;font-size:11px;cursor:pointer;letter-spacing:.5px}
.est-btn:hover{background:rgba(95,240,156,.3)}
.est-btn.sell{background:rgba(255,206,74,.12);border-color:rgba(255,206,74,.5);color:#ffd64d}
.est-btn:disabled{opacity:.4;cursor:not-allowed}
.est-close{position:absolute;top:14px;right:14px;background:none;color:#5ff09c;border:0;font-size:26px;cursor:pointer}
.est-pop{position:fixed;left:50%;bottom:130px;transform:translateX(-50%);display:none;background:linear-gradient(180deg,rgba(8,18,11,.96),rgba(5,14,9,.96));border:2px solid rgba(95,240,156,.55);border-radius:14px;padding:12px 18px;z-index:50;text-align:center;font-family:'Outfit','Inter',sans-serif}
.est-pop.show{display:block}
.est-pop .who{font-size:11px;color:rgba(230,255,238,.7);margin-bottom:5px}
.est-pop .who b{color:#5ff09c}
.est-pop .line{font-size:14px;font-weight:700;color:#fff1c2;margin-bottom:6px}
.est-pop kbd{background:rgba(95,240,156,.22);border:1px solid rgba(95,240,156,.55);color:#5ff09c;padding:2px 8px;border-radius:6px;font-family:monospace;font-size:11px;font-weight:700}
.est-tabs{display:flex;gap:4px;margin-bottom:12px;border-bottom:1px solid rgba(95,240,156,.18)}
.est-tabs button{flex:1;background:transparent;border:0;color:rgba(230,255,238,.5);padding:9px 4px;font-family:'Outfit','Inter',sans-serif;font-size:11px;font-weight:700;letter-spacing:.6px;text-transform:uppercase;cursor:pointer;border-bottom:2px solid transparent}
.est-tabs button.on{color:#5ff09c;border-bottom-color:#5ff09c}
`;
    document.head.appendChild(css);

    // ── Tool Service modal ──
    const tsBg = document.createElement('div');
    tsBg.className = 'est-bg';
    tsBg.id = 'siimBg';
    tsBg.innerHTML = '<div class="est-card"><button class="est-close" id="siimClose">×</button><h2>\u{1F527} Tool Service · Siim</h2><p>"Bring me your dull tools — I sharpen them sharper than a printer’s wit. Price scales with how dull they are."</p><div id="siimRows"></div></div>';
    document.body.appendChild(tsBg);
    document.getElementById('siimClose').addEventListener('click', () => tsBg.classList.remove('show'));
    tsBg.addEventListener('click', (e) => { if(e.target === tsBg) tsBg.classList.remove('show'); });

    function sharpenCostFor(durability){
      const missing = Math.max(0, 100 - durability);
      return Math.max(5, Math.round(missing * 1.5));
    }
    function renderSiim(){
      const host = document.getElementById('siimRows');
      const tools = ['pickaxe', 'saw'];
      const lines = [];
      for(const id of tools){
        const have = (State.inventory?.[id] || 0) > 0 || !!(State.tools && State.tools[id]);
        if(!have){
          lines.push('<div class="est-row"><div class="ic">' + (ITEMS[id]?.icon || '\u{1F527}') + '</div><div class="meta"><div class="nm">' + (ITEMS[id]?.name || id) + '</div><div class="sub">You don\'t own this tool yet</div></div><div class="btns"><button class="est-btn" disabled>—</button></div></div>');
          continue;
        }
        const dur = State.tools?.[id]?.durability ?? 100;
        const cost = sharpenCostFor(dur);
        const canSharpen = dur < 100;
        lines.push('<div class="est-row"><div class="ic">' + (ITEMS[id]?.icon || '\u{1F527}') + '</div><div class="meta"><div class="nm">' + (ITEMS[id]?.name || id) + '</div><div class="sub">Durability: ' + Math.round(dur) + '% · Cost: ' + cost + ' \u{1F948}</div></div><div class="btns"><button class="est-btn" data-tool="' + id + '" data-cost="' + cost + '" ' + (canSharpen ? '' : 'disabled') + '>' + (canSharpen ? 'Sharpen' : 'Sharp') + '</button></div></div>');
      }
      host.innerHTML = lines.join('');
    }
    // ONE delegated click handler on the modal — survives every re-render and
    // can't miss a freshly-built button (the old per-button binding sometimes
    // didn't fire). Reads the tool + cost off the clicked button.
    tsBg.addEventListener('click', (e) => {
      const b = e.target.closest('.est-btn[data-tool]');
      if(!b || b.disabled) return;
      const id = b.dataset.tool, cost = Number(b.dataset.cost) || 0;
      if((State.credits || 0) < cost){ window.floater?.('Need ' + cost + ' \u{1F948}', 'bad'); return; }
      State.credits -= cost;
      if(!State.tools) State.tools = {};
      if(!State.tools[id]) State.tools[id] = { durability: 100 };
      State.tools[id].durability = 100;
      State.xp = (State.xp || 0) + 5;
      window.floater?.('Sharpened ' + (ITEMS[id]?.name || id) + ' to 100% · -' + cost + ' \u{1F948}', 'good');
      window.playPurchaseSound?.();
      window.saveState?.(); window.updateHUD?.();
      renderSiim();
    });
    window.openSiim = () => { renderSiim(); tsBg.classList.add('show'); };

    // ── Miner's Exchange modal ──
    const meBg = document.createElement('div');
    meBg.className = 'est-bg';
    meBg.id = 'traechBg';
    meBg.innerHTML = '<div class="est-card"><button class="est-close" id="traechClose">×</button><h2>\u{26CF} Miner\'s Exchange · Traech</h2><p>"All ores welcome, all paid in silver. I never touch cash."</p><div class="est-tabs"><button class="ctab on" data-tab="buy">BUY</button><button class="ctab" data-tab="sell">SELL (70%)</button></div><div id="traechRows"></div></div>';
    document.body.appendChild(meBg);
    document.getElementById('traechClose').addEventListener('click', () => meBg.classList.remove('show'));
    meBg.addEventListener('click', (e) => { if(e.target === meBg) meBg.classList.remove('show'); });

    const ORES = ['copper_ore', 'tin_ore', 'iron_ore', 'titanium_ore', 'adamantium_ore', 'mithril_ore'];
    let traechTab = 'buy';
    function renderTraech(){
      const host = document.getElementById('traechRows');
      meBg.querySelectorAll('.ctab').forEach(b => b.classList.toggle('on', b.dataset.tab === traechTab));
      const lines = [];
      // Traech only handles ore — no gold trading (use the bank for that).
      if(traechTab === 'buy'){
        for(const id of ORES){
          const item = ITEMS[id]; if(!item) continue;
          const price = item.marketPrice || 1;
          const have = State.inventory?.[id] || 0;
          lines.push('<div class="est-row"><div class="ic">' + (item.icon || '') + '</div><div class="meta"><div class="nm">' + item.name + '</div><div class="sub">' + price + ' \u{1F948} each · own: <b style="color:#fff1c2;">' + have + '</b></div></div><div class="btns"><button class="est-btn" data-buy="' + id + '" data-price="' + price + '">BUY 1</button></div></div>');
        }
      } else {
        // Sell side at 70%
        for(const id of ORES){
          const item = ITEMS[id]; if(!item) continue;
          const have = State.inventory?.[id] || 0;
          const sellAt = Math.max(1, Math.floor((item.marketPrice || 1) * 0.7));
          lines.push('<div class="est-row"><div class="ic">' + (item.icon || '') + '</div><div class="meta"><div class="nm">' + item.name + '</div><div class="sub">Pays ' + sellAt + ' \u{1F948} each · own: <b style="color:#fff1c2;">' + have + '</b></div></div><div class="btns"><button class="est-btn sell" data-sell="' + id + '" data-pay="' + sellAt + '" data-qty="' + have + '" ' + (have <= 0 ? 'disabled' : '') + '>SELL 1</button>' + (have > 0 ? '<button class="est-btn sell" data-sellall="' + id + '" data-pay="' + sellAt + '" data-qty="' + have + '">SELL ALL</button>' : '') + '</div></div>');
        }
      }
      host.innerHTML = lines.join('');
      host.querySelectorAll('.est-btn[data-buy]').forEach(b => b.addEventListener('click', () => {
        const id = b.dataset.buy, price = Number(b.dataset.price) || 0;
        if((State.credits || 0) < price){ window.floater?.('Need ' + price + ' \u{1F948}', 'bad'); return; }
        State.credits -= price; window.addItem?.(id, 1);
        window.floater?.('+1 ' + ITEMS[id].name + ' · -' + price + ' \u{1F948}', 'good');
        window.playPurchaseSound?.(); window.saveState?.(); window.updateHUD?.(); renderTraech();
      }));
      host.querySelectorAll('.est-btn[data-cur="gold"]').forEach(b => b.addEventListener('click', () => {
        const price = Number(b.dataset.price) || 0;
        if((State.credits || 0) < price){ window.floater?.('Need ' + price + ' \u{1F948}', 'bad'); return; }
        State.credits -= price; State.gold = (Number(State.gold) || 0) + 1;
        window.floater?.('+1 \u{1F947} Gold · -' + price + ' \u{1F948}', 'good');
        window.playPurchaseSound?.(); window.saveState?.(); window.updateHUD?.(); renderTraech();
      }));
      host.querySelectorAll('.est-btn[data-sell]').forEach(b => b.addEventListener('click', () => {
        const id = b.dataset.sell, pay = Number(b.dataset.pay) || 0;
        if((State.inventory?.[id] || 0) <= 0) return;
        window.takeItem?.(id, 1);
        State.credits = (State.credits || 0) + pay;
        window.floater?.('+' + pay + ' \u{1F948} · -1 ' + ITEMS[id].name, 'good');
        window.playPurchaseSound?.(); window.saveState?.(); window.updateHUD?.(); renderTraech();
      }));
      host.querySelectorAll('.est-btn[data-sellall]').forEach(b => b.addEventListener('click', () => {
        const id = b.dataset.sellall, pay = Number(b.dataset.pay) || 0;
        const qty = Math.min(Number(b.dataset.qty) || 0, State.inventory?.[id] || 0);
        if(qty <= 0) return;
        const total = pay * qty;
        window.takeItem?.(id, qty);
        State.credits = (State.credits || 0) + total;
        window.floater?.('+' + total + ' \u{1F948} · -' + qty + 'x ' + ITEMS[id].name, 'good');
        window.playPurchaseSound?.(); window.saveState?.(); window.updateHUD?.(); renderTraech();
      }));
      host.querySelectorAll('.est-btn[data-cur="gold-sell"]').forEach(b => b.addEventListener('click', () => {
        const pay = Number(b.dataset.pay) || 0;
        if((Number(State.gold) || 0) < 1){ window.floater?.('Need 1 \u{1F947}', 'bad'); return; }
        State.gold = Number(State.gold) - 1;
        State.credits = (State.credits || 0) + pay;
        window.floater?.('+' + pay + ' \u{1F948} · -1 \u{1F947}', 'good');
        window.playPurchaseSound?.(); window.saveState?.(); window.updateHUD?.(); renderTraech();
      }));
    }
    meBg.querySelectorAll('.ctab').forEach(b => b.addEventListener('click', () => { traechTab = b.dataset.tab; renderTraech(); }));
    window.openTraech = () => { traechTab = 'buy'; renderTraech(); meBg.classList.add('show'); };

    // ── Shared proximity popup ──
    const pop = document.createElement('div');
    pop.className = 'est-pop';
    pop.innerHTML = '<div class="who"><b id="estName">-</b> \u{1F5A8}</div><div class="line" id="estLine">-</div><div>Press <kbd>E</kbd> or click below</div><button class="est-btn" id="estBtn" style="margin-top:7px;">Open</button>';
    document.body.appendChild(pop);
    let nearWhich = null;
    document.getElementById('estBtn').addEventListener('click', () => {
      if(nearWhich === 'siim') window.openSiim();
      else if(nearWhich === 'traech') window.openTraech();
    });
    setInterval(() => {
      const ds = Math.hypot(Player.pos.x - TS_POS.x, Player.pos.z - TS_POS.z);
      const dt = Math.hypot(Player.pos.x - ME_POS.x, Player.pos.z - ME_POS.z);
      if(ds < 4.5 && ds < dt){
        nearWhich = 'siim';
        document.getElementById('estName').textContent = 'Siim';
        document.getElementById('estLine').textContent = 'Sharpen your tools';
        pop.classList.add('show');
      } else if(dt < 4.5){
        nearWhich = 'traech';
        document.getElementById('estName').textContent = 'Traech';
        document.getElementById('estLine').textContent = 'Trade ores and metals';
        pop.classList.add('show');
      } else {
        nearWhich = null; pop.classList.remove('show');
      }
    }, 200);
    window.addEventListener('keydown', (e) => {
      if(e.code !== 'KeyE' || !nearWhich) return;
      const a = document.activeElement;
      if(a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA')) return;
      if(nearWhich === 'siim') window.openSiim();
      else if(nearWhich === 'traech') window.openTraech();
    });

    // Project name tags
    const _v = new THREE.Vector3();
    function tagTick(){
      for(const npc of [Siim, Traech]){
        _v.set(npc.x, npc.y, npc.z).project(window.camera);
        if(_v.z < 1){
          npc.tag.style.left = ((_v.x * 0.5 + 0.5) * window.innerWidth) + 'px';
          npc.tag.style.top  = ((1 - (_v.y * 0.5 + 0.5)) * window.innerHeight) + 'px';
          npc.tag.style.display = 'block';
          npc.tag.style.display = 'block';
        } else { npc.tag.style.display = 'none'; }
      }
      requestAnimationFrame(tagTick);
    }
    requestAnimationFrame(tagTick);
    console.log('[establishments] ready');
  }
})();
