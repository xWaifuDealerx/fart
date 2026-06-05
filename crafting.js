// =================================================================
// crafting.js — beach sand collection, refinery jar melt, FartFilling
// =================================================================
// Adds:
//   - Shovel + Plastic Bag → "Dig sand" on the beach (F key)
//   - Bag of Sand + Refinery → Empty Jar (E-modal on existing refinery)
//   - "Fart Filling Station" building → fart into Empty Jar, get one of
//     the 5 FartJar rarities (green→blue→purple→orange→rainbow)
// =================================================================
(function(){
  'use strict';

  function whenReady(){
    if(!window.THREE || !window.scene || !window.Player || !window.State || !window.groundHeightAt || !window.ITEMS){
      setTimeout(whenReady, 250);
      return;
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
    const WATER_LEVEL = window.WATER_LEVEL || 0;

    // ──────────────────────────────────────────────────────────────
    // 1) BEACH SAND COLLECTION — F key, near shoreline, needs shovel
    // ──────────────────────────────────────────────────────────────
    // Beach = ground height within 0.0..1.2 of WATER_LEVEL (the sand
    // band). One dig = consume 1 plastic_bag, gain 1 sand_bag.
    let _digCool = 0;
    function tryDigSand(){
      const now = performance.now();
      if(now - _digCool < 700) return;
      _digCool = now;
      const x = Player.pos.x, z = Player.pos.z;
      const gh = groundHeightAt(x, z);
      const onBeach = gh > WATER_LEVEL - 0.1 && gh < WATER_LEVEL + 1.2;
      if(!onBeach){ window.floater?.("Find sand on the beach", "bad"); return; }
      if(!(State.inventory.shovel)){ window.floater?.("Need a \u{1FA8F} Shovel", "bad"); return; }
      if(!(State.inventory.plastic_bag)){ window.floater?.("Need a \u{1F6CD} Plastic Bag", "bad"); return; }
      window.takeItem("plastic_bag", 1);
      window.addItem("sand_bag", 1);
      State.xp += 3;
      window.floater?.("+1 \u{1F3D6} Bag of Sand", "good");
      window.playPurchaseSound?.();
      window.saveState?.();
      window.updateHUD?.();
    }
    // Bind to F (existing F on tree calls tryChopTree first; if no tree
    // is in range that handler no-ops and we run after it).
    window.addEventListener('keydown', (e) => {
      if(e.code !== "KeyF") return;
      const a = document.activeElement;
      if(a && (a.tagName === "INPUT" || a.tagName === "TEXTAREA")) return;
      // Only dig if we're not standing on a tree (tree-chop has priority)
      tryDigSand();
    });

    // ──────────────────────────────────────────────────────────────
    // 2) REFINERY JAR MELT — when you visit the existing refinery
    //     with sand bags, hold F to convert. Adds a side button to
    //     the refinery prompt + reuses the existing E-handler hook.
    // ──────────────────────────────────────────────────────────────
    // Simpler: poll proximity (existing refinery is at (42, 0)). When
    // near AND holding sand, offer a one-click "Melt 1" prompt button.
    const REF_POS = { x: 42, z: 0 }, REF_R = 5;
    const refStyle = document.createElement('style');
    refStyle.textContent = `
.melt-pop { position: fixed; left: 50%; bottom: 220px; transform: translateX(-50%); display: none; background: linear-gradient(180deg, rgba(36,16,8,.95), rgba(20,10,4,.95)); border: 2px solid rgba(255,154,77,.55); border-radius: 12px; padding: 10px 16px; z-index: 49; text-align: center; box-shadow: 0 12px 30px rgba(0,0,0,.5); }
.melt-pop.show { display: block; }
.melt-pop .line { font-family: 'Bangers','Orbitron',sans-serif; font-size: 16px; color: #fff1c2; margin-bottom: 6px; }
.melt-pop .btn { background: linear-gradient(135deg, #ff9d3d, #ffd64d); color: #2a1408; border: 0; padding: 8px 16px; border-radius: 100px; font-family: 'Orbitron',sans-serif; font-weight: 900; font-size: 11px; text-transform: uppercase; cursor: pointer; }
`;
    document.head.appendChild(refStyle);
    const meltPop = document.createElement('div');
    meltPop.className = 'melt-pop';
    meltPop.innerHTML = '<div class="line">Melt sand → \u{1FAD9} Empty Jar</div><button class="btn" id="meltBtn">Melt 1</button>';
    document.body.appendChild(meltPop);
    document.getElementById('meltBtn').addEventListener('click', () => {
      if((State.inventory.sand_bag || 0) <= 0){ window.floater?.("No \u{1F3D6} Sand Bag", "bad"); return; }
      window.takeItem("sand_bag", 1);
      window.addItem("jar_empty", 1);
      State.xp += 5;
      window.floater?.("+1 \u{1FAD9} Empty Jar", "good");
      window.playPurchaseSound?.();
      window.saveState?.();
      window.updateHUD?.();
    });
    setInterval(() => {
      const d = Math.hypot(Player.pos.x - REF_POS.x, Player.pos.z - REF_POS.z);
      const showIt = d < REF_R && (State.inventory.sand_bag || 0) > 0;
      meltPop.classList.toggle('show', showIt);
    }, 200);

    // ──────────────────────────────────────────────────────────────
    // 3) FART FILLING STATION — new building + mechanic
    // ──────────────────────────────────────────────────────────────
    // Location chosen in a clear area away from existing buildings.
    const FFS_POS = { x: -55, z: 32 }, FFS_R = 4.5;
    (function buildFFS(){
      const grp = new THREE.Group();
      grp.position.set(FFS_POS.x, groundHeightAt(FFS_POS.x, FFS_POS.z), FFS_POS.z);
      const wallMat = new THREE.MeshStandardMaterial({ color: 0x3a5a30, roughness: 0.85 });
      const trimMat = new THREE.MeshStandardMaterial({ color: 0xc0e02a, emissive: 0xc0e02a, emissiveIntensity: 0.35, roughness: 0.5 });
      const tubeMat = new THREE.MeshStandardMaterial({ color: 0xa8e0ff, transparent: true, opacity: 0.6, roughness: 0.2 });
      const base = new THREE.Mesh(new THREE.BoxGeometry(5.4, 0.3, 4.0), trimMat);
      base.position.y = 0.15; base.receiveShadow = true;
      grp.add(base);
      window.WalkableSurfaces?.push(base);
      // Walls
      const body = new THREE.Mesh(new THREE.BoxGeometry(5.0, 2.8, 3.6), wallMat);
      body.position.y = 1.7; body.castShadow = true; grp.add(body);
      // Dome roof (hemisphere)
      const dome = new THREE.Mesh(new THREE.SphereGeometry(2.8, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2),
        new THREE.MeshStandardMaterial({ color: 0x2a4a20, roughness: 0.7 }));
      dome.position.y = 3.1;
      grp.add(dome);
      // Glass collection tubes (3 standing cylinders out front)
      for(let i = -1; i <= 1; i++){
        const t = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.32, 1.8, 14), tubeMat);
        t.position.set(i * 1.2, 1.0, 2.1);
        grp.add(t);
        const cap = new THREE.Mesh(new THREE.SphereGeometry(0.3, 10, 10), trimMat);
        cap.position.set(i * 1.2, 1.95, 2.1);
        grp.add(cap);
      }
      // Sign canvas
      const cvs = document.createElement('canvas');
      cvs.width = 480; cvs.height = 110;
      const ctx = cvs.getContext('2d');
      ctx.fillStyle = '#0a2010'; ctx.fillRect(0, 0, 480, 110);
      ctx.strokeStyle = '#c0e02a'; ctx.lineWidth = 4;
      ctx.strokeRect(4, 4, 472, 102);
      ctx.fillStyle = '#c0e02a';
      ctx.font = "900 56px 'Bangers','Orbitron',sans-serif";
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('FART FILLING STN', 240, 60);
      const signTex = new THREE.CanvasTexture(cvs);
      const sign = new THREE.Mesh(new THREE.PlaneGeometry(4.0, 0.9),
        new THREE.MeshBasicMaterial({ map: signTex }));
      sign.position.set(0, 3.45, 1.82);
      grp.add(sign);
      // Soft green light
      const lt = new THREE.PointLight(0xc0e02a, 1.4, 14);
      lt.position.set(0, 2.2, 1);
      grp.add(lt);
      scene.add(grp);
      console.log("[FartFilling] built at", FFS_POS);
    })();

    // Fart Filling proximity + popup
    const ffStyle = document.createElement('style');
    ffStyle.textContent = `
.ff-pop { position: fixed; left: 50%; bottom: 130px; transform: translateX(-50%); display: none; background: linear-gradient(180deg, rgba(8,32,18,.95), rgba(4,18,10,.95)); border: 2px solid rgba(192,224,42,.55); border-radius: 14px; padding: 12px 18px; z-index: 50; text-align: center; box-shadow: 0 14px 36px rgba(0,0,0,.6); }
.ff-pop.show { display: block; }
.ff-pop .line { font-family: 'Bangers','Orbitron',sans-serif; font-size: 18px; color: #c0e02a; margin-bottom: 8px; letter-spacing: 1.4px; }
.ff-pop .btn { background: linear-gradient(135deg, #c0e02a, #fff1c2); color: #112000; border: 0; padding: 10px 18px; border-radius: 100px; font-family: 'Orbitron',sans-serif; font-weight: 900; font-size: 12px; text-transform: uppercase; cursor: pointer; }
.ff-pop .btn:disabled { opacity: .5; cursor: not-allowed; }
.ff-pop .sub { font-family: 'JetBrains Mono',monospace; font-size: 10.5px; color: rgba(230,255,238,.55); margin-top: 6px; }
`;
    document.head.appendChild(ffStyle);
    const ffPop = document.createElement('div');
    ffPop.className = 'ff-pop';
    ffPop.innerHTML = '<div class="line">Fart Filling Station</div><button class="btn" id="ffFill">Fart into 1 jar</button><div class="sub" id="ffSub">Empty jars: 0</div>';
    document.body.appendChild(ffPop);
    // Rarity table for fart jars
    const JAR_TIERS = [
      { id: "fartjar_green",   weight: 60, name: "Green" },
      { id: "fartjar_blue",    weight: 25, name: "Blue" },
      { id: "fartjar_purple",  weight: 10, name: "Purple" },
      { id: "fartjar_orange",  weight: 4,  name: "Orange" },
      { id: "fartjar_rainbow", weight: 1,  name: "Rainbow" },
    ];
    function rollJarTier(){
      const total = JAR_TIERS.reduce((s, t) => s + t.weight, 0);
      let r = Math.random() * total;
      for(const t of JAR_TIERS){ r -= t.weight; if(r <= 0) return t; }
      return JAR_TIERS[0];
    }
    document.getElementById('ffFill').addEventListener('click', () => {
      if((State.inventory.jar_empty || 0) <= 0){ window.floater?.("No \u{1FAD9} Empty Jar", "bad"); return; }
      window.takeItem("jar_empty", 1);
      const tier = rollJarTier();
      window.addItem(tier.id, 1);
      State.xp += 10;
      window.floater?.(`+1 ${ITEMS[tier.id].name}`, "good");
      window.playFartSound?.(0.7, false);
      window.saveState?.();
      window.updateHUD?.();
      ffSubUpdate();
    });
    function ffSubUpdate(){
      document.getElementById('ffSub').textContent = `Empty jars: ${State.inventory.jar_empty || 0}`;
      const fillBtn = document.getElementById('ffFill');
      fillBtn.disabled = !(State.inventory.jar_empty || 0);
    }
    setInterval(() => {
      const d = Math.hypot(Player.pos.x - FFS_POS.x, Player.pos.z - FFS_POS.z);
      const show = d < FFS_R;
      if(show){ ffSubUpdate(); }
      ffPop.classList.toggle('show', show);
    }, 200);

    console.log("[crafting] beach dig + jar melt + Fart Filling Station ready");
  }
})();
