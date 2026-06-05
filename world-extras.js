// =================================================================
// world-extras.js — jail cell, paper mill, extra trees, chop mechanic
// =================================================================
// Builds 3D meshes for the new buildings and wires the gameplay loops.
// All globals (THREE, scene, Player, ITEMS, etc) come from window —
// the main module's closing block exposes them before this file runs.
(function(){
  'use strict';

  function whenReady(){
    if(!window.THREE || !window.scene || !window.Player || !window.JAIL_POS){
      setTimeout(whenReady, 200);
      return;
    }
    init();
  }
  whenReady();

  function init(){
    const THREE = window.THREE;
    const scene = window.scene;
    const Player = window.Player;
    const groundHeightAt = window.groundHeightAt;
    const sampleSurfaceY = window.sampleSurfaceY;
    const WalkableSurfaces = window.WalkableSurfaces || [];
    const State = window.State;
    const JAIL_POS = window.JAIL_POS;

    // ──────────────────────────────────────────────────────────────
    // 1) JAIL CELL — small barred box at JAIL_POS
    // ──────────────────────────────────────────────────────────────
    (function buildJail(){
      const grp = new THREE.Group();
      const y0 = groundHeightAt(JAIL_POS.x, JAIL_POS.z);
      grp.position.set(JAIL_POS.x, y0, JAIL_POS.z);
      const stoneMat = new THREE.MeshStandardMaterial({ color: 0x4a4a52, roughness: 0.92 });
      const barsMat  = new THREE.MeshStandardMaterial({ color: 0x222, roughness: 0.4, metalness: 0.85 });
      const roofMat  = new THREE.MeshStandardMaterial({ color: 0x2a2a30, roughness: 0.85 });
      const W = 3.6, H = 3.0, D = 3.6;
      // Base
      const base = new THREE.Mesh(new THREE.BoxGeometry(W + 0.4, 0.3, D + 0.4), stoneMat);
      base.position.y = 0.15;
      base.receiveShadow = true;
      grp.add(base);
      WalkableSurfaces.push(base);
      // Back wall + sides (solid stone)
      const back = new THREE.Mesh(new THREE.BoxGeometry(W, H, 0.25), stoneMat);
      back.position.set(0, H/2 + 0.3, -D/2);
      back.castShadow = true;
      grp.add(back);
      const left = new THREE.Mesh(new THREE.BoxGeometry(0.25, H, D), stoneMat);
      left.position.set(-W/2, H/2 + 0.3, 0);
      left.castShadow = true;
      grp.add(left);
      const right = left.clone();
      right.position.x = W/2;
      grp.add(right);
      // Front: 6 vertical iron bars
      for(let i = 0; i < 6; i++){
        const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, H, 6), barsMat);
        bar.position.set(-W/2 + 0.2 + i * (W - 0.4) / 5, H/2 + 0.3, D/2);
        grp.add(bar);
      }
      // Horizontal bar tops
      for(const y of [0.5, H + 0.1]){
        const hbar = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, W, 6), barsMat);
        hbar.position.set(0, y + 0.3, D/2);
        hbar.rotation.z = Math.PI / 2;
        grp.add(hbar);
      }
      // Roof
      const roof = new THREE.Mesh(new THREE.BoxGeometry(W + 0.5, 0.3, D + 0.5), roofMat);
      roof.position.y = H + 0.5;
      roof.castShadow = true;
      grp.add(roof);
      // "JAIL" sign
      const cvs = document.createElement('canvas');
      cvs.width = 256; cvs.height = 96;
      const ctx = cvs.getContext('2d');
      ctx.fillStyle = '#1a1a1a'; ctx.fillRect(0, 0, 256, 96);
      ctx.fillStyle = '#ff5a4d';
      ctx.font = "900 64px 'Bangers','Orbitron',sans-serif";
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('JAIL', 128, 50);
      const signTex = new THREE.CanvasTexture(cvs);
      const sign = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.6),
        new THREE.MeshBasicMaterial({ map: signTex }));
      sign.position.set(0, H + 0.95, D/2 + 0.01);
      grp.add(sign);
      // Floor inside (walkable + slightly raised)
      const floor = new THREE.Mesh(new THREE.BoxGeometry(W - 0.2, 0.08, D - 0.2), stoneMat);
      floor.position.y = 0.4;
      grp.add(floor);
      WalkableSurfaces.push(floor);
      // Dim red bulb (it's a holding cell)
      const lt = new THREE.PointLight(0xff5a4d, 0.9, 10);
      lt.position.set(0, H + 0.1, 0);
      grp.add(lt);
      scene.add(grp);
      console.log("[Jail] built at", JAIL_POS);
    })();

    // ──────────────────────────────────────────────────────────────
    // 2) JAIL HUD — countdown pill that shows while State.jailUntil
    //    is in the future. Updates every second.
    // ──────────────────────────────────────────────────────────────
    (function buildJailHud(){
      const style = document.createElement('style');
      style.textContent = `
.jail-pill { position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); background: linear-gradient(180deg, rgba(36,8,8,.94), rgba(20,4,4,.94)); border: 2px solid rgba(255,90,77,.55); border-radius: 18px; padding: 16px 28px; display: none; z-index: 70; box-shadow: 0 20px 60px rgba(0,0,0,.6), 0 0 60px rgba(255,90,77,.30); text-align: center; pointer-events: none; }
.jail-pill.show { display: block; }
.jail-pill h3 { font-family: 'Bangers','Orbitron',sans-serif; font-size: 32px; letter-spacing: 2.4px; color: #ff7a6e; margin-bottom: 4px; }
.jail-pill .time { font-family: 'Orbitron',sans-serif; font-weight: 900; font-size: 28px; color: #ffd64d; }
.jail-pill .sub { font-family: 'JetBrains Mono',monospace; font-size: 11px; color: rgba(230,255,238,.55); margin-top: 6px; }
`;
      document.head.appendChild(style);
      const el = document.createElement('div');
      el.className = 'jail-pill';
      el.id = 'jailPill';
      el.innerHTML = '<h3>🚨 JAILED</h3><div class="time" id="jailTime">5:00</div><div class="sub">Caught with counterfeit bills</div>';
      document.body.appendChild(el);
      setInterval(() => {
        const until = State.jailUntil || 0;
        const remaining = until - Date.now();
        if(remaining > 0){
          el.classList.add('show');
          const m = Math.floor(remaining / 60000);
          const s = Math.floor((remaining % 60000) / 1000);
          document.getElementById('jailTime').textContent = m + ":" + String(s).padStart(2, '0');
        } else {
          if(el.classList.contains('show')){
            el.classList.remove('show');
            if(window.floater) window.floater("🆓 Released from jail", "good");
            if(until){ State.jailUntil = 0; if(window.saveState) window.saveState(); }
          }
        }
      }, 1000);
    })();

    // ──────────────────────────────────────────────────────────────
    // 3) EXTRA TREES — pine-style with cones, placed in clear ground
    // ──────────────────────────────────────────────────────────────
    const Trees = [];
    const TREE_REGROW_MS = 4 * 60 * 1000;   // 4 minutes
    function buildTree(x, z){
      const grp = new THREE.Group();
      const baseY = groundHeightAt(x, z);
      grp.position.set(x, baseY, z);
      const trunkMat = new THREE.MeshStandardMaterial({ color: 0x6b4a25, roughness: 0.92 });
      const leafMat  = new THREE.MeshStandardMaterial({ color: 0x2a5a30, roughness: 0.8, flatShading: true });
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.32, 2.0, 7), trunkMat);
      trunk.position.y = 1.0;
      trunk.castShadow = true;
      grp.add(trunk);
      // Three stacked cones for foliage
      for(let i = 0; i < 3; i++){
        const cone = new THREE.Mesh(
          new THREE.ConeGeometry(1.2 - i * 0.3, 1.1, 7),
          leafMat
        );
        cone.position.y = 2.0 + i * 0.7;
        cone.castShadow = true;
        grp.add(cone);
      }
      scene.add(grp);
      Trees.push({ x, z, mesh: grp, alive: true, choppedAt: 0, kind: "pine" });
    }
    // 10 positions chosen to avoid all existing buildings, plots, and ore
    const treePositions = [
      [ 18, 60], [-25, 60], [ 32, 48], [-30, -25], [ 40, 20],
      [-50, -15], [-45, -50], [ 55, 12], [-12,  62], [ 28, -55],
    ];
    treePositions.forEach(([x, z]) => buildTree(x, z));

    // ── Chop mechanic: F when near a tree (alive) AND have a saw ──
    const CHOP_RANGE = 3.5;
    const sawFloater = (txt, kind) => window.floater && window.floater(txt, kind);
    function findNearbyTree(){
      let best = null, bestD = CHOP_RANGE;
      for(const t of Trees){
        if(!t.alive) continue;
        const d = Math.hypot(t.x - Player.pos.x, t.z - Player.pos.z);
        if(d < bestD){ bestD = d; best = t; }
      }
      return best;
    }
    function tryChopTree(){
      const tree = findNearbyTree();
      if(!tree) return false;
      if(!(window.ITEMS?.saw) || !(State.inventory?.saw)){
        sawFloater("Need a 🪚 Saw — buy one at the market", "bad");
        return true;
      }
      // Chop! Tree disappears, wood added, regrow timer set.
      tree.alive = false;
      tree.choppedAt = Date.now();
      if(tree.mesh){
        scene.remove(tree.mesh);
        tree.mesh.traverse(o => {
          if(o.geometry) o.geometry.dispose();
          if(o.material){
            if(Array.isArray(o.material)) o.material.forEach(m => m.dispose());
            else o.material.dispose();
          }
        });
        tree.mesh = null;
      }
      if(window.addItem) window.addItem("wood", tree.kind === "palm" ? 2 : 1);
      State.xp += 8;
      sawFloater(`+${tree.kind === "palm" ? 2 : 1} 🪵 Wood  +8 XP`, "good");
      if(window.playPurchaseSound) window.playPurchaseSound();
      if(window.saveState) window.saveState();
      if(window.updateHUD) window.updateHUD();
      return true;
    }
    function tickTreeRegrow(){
      const now = Date.now();
      for(const t of Trees){
        if(t.alive || !t.choppedAt) continue;
        if(now - t.choppedAt > TREE_REGROW_MS){
          // Regrow — re-spawn the mesh
          if(t.kind === "palm"){
            // palms grow back as our new pine for simplicity
            // (the original palm trees are still procedurally placed
            // separately — but we mark them as "palm" if registered).
          }
          buildTreeMesh(t);
        }
      }
    }
    function buildTreeMesh(t){
      const grp = new THREE.Group();
      grp.position.set(t.x, groundHeightAt(t.x, t.z), t.z);
      const trunkMat = new THREE.MeshStandardMaterial({ color: 0x6b4a25, roughness: 0.92 });
      const leafMat  = new THREE.MeshStandardMaterial({ color: 0x2a5a30, roughness: 0.8, flatShading: true });
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.32, 2.0, 7), trunkMat);
      trunk.position.y = 1.0;
      trunk.castShadow = true;
      grp.add(trunk);
      for(let i = 0; i < 3; i++){
        const cone = new THREE.Mesh(new THREE.ConeGeometry(1.2 - i * 0.3, 1.1, 7), leafMat);
        cone.position.y = 2.0 + i * 0.7;
        cone.castShadow = true;
        grp.add(cone);
      }
      scene.add(grp);
      t.alive = true;
      t.choppedAt = 0;
      t.mesh = grp;
    }
    setInterval(tickTreeRegrow, 8000);

    // Bind F key for chop. The main loop already calls tryMineOre on F —
    // we listen separately and only consume the event when there's a tree
    // in range (mine ore code can still run for non-tree F presses).
    window.addEventListener('keydown', (e) => {
      if(e.code !== "KeyF") return;
      const a = document.activeElement;
      if(a && (a.tagName === "INPUT" || a.tagName === "TEXTAREA")) return;
      const near = findNearbyTree();
      if(near) tryChopTree();
    });

    // ──────────────────────────────────────────────────────────────
    // 4) PAPER MILL — converts 1 wood → 5 paper. Located east of the
    //    plots, near the bowling alley, in clear ground.
    // ──────────────────────────────────────────────────────────────
    const MILL_POS    = { x: -45, z: 8 };
    const MILL_RADIUS = 4.0;
    const MILL_RATE   = 5;   // 1 wood = 5 paper items
    (function buildMill(){
      const grp = new THREE.Group();
      const y0 = groundHeightAt(MILL_POS.x, MILL_POS.z);
      grp.position.set(MILL_POS.x, y0, MILL_POS.z);
      const wallMat = new THREE.MeshStandardMaterial({ color: 0x5e3a1f, roughness: 0.85 });
      const roofMat = new THREE.MeshStandardMaterial({ color: 0x2a1408, roughness: 0.7 });
      const trimMat = new THREE.MeshStandardMaterial({ color: 0xc89858, roughness: 0.55, metalness: 0.3 });
      // Footprint
      const base = new THREE.Mesh(new THREE.BoxGeometry(5, 0.3, 5), trimMat);
      base.position.y = 0.15;
      base.receiveShadow = true;
      grp.add(base);
      WalkableSurfaces.push(base);
      // Walls
      const body = new THREE.Mesh(new THREE.BoxGeometry(4.6, 2.8, 4.6), wallMat);
      body.position.y = 1.7;
      body.castShadow = true; body.receiveShadow = true;
      grp.add(body);
      // Pitched roof
      const roof = new THREE.Mesh(new THREE.ConeGeometry(3.6, 1.6, 4), roofMat);
      roof.position.y = 3.9;
      roof.rotation.y = Math.PI / 4;
      roof.castShadow = true;
      grp.add(roof);
      // Big spinning waterwheel on the side
      const wheelGrp = new THREE.Group();
      wheelGrp.position.set(-2.6, 1.8, 0);
      const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.8, 10), trimMat);
      hub.rotation.z = Math.PI / 2;
      wheelGrp.add(hub);
      for(let i = 0; i < 8; i++){
        const blade = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.6, 0.6),
          new THREE.MeshStandardMaterial({ color: 0x6b4a25, roughness: 0.9 }));
        blade.rotation.z = (i / 8) * Math.PI * 2;
        wheelGrp.add(blade);
      }
      grp.add(wheelGrp);
      // Sign canvas
      const cvs = document.createElement('canvas');
      cvs.width = 384; cvs.height = 96;
      const ctx = cvs.getContext('2d');
      ctx.fillStyle = '#3a1c08'; ctx.fillRect(0, 0, 384, 96);
      ctx.strokeStyle = '#c89858'; ctx.lineWidth = 4; ctx.strokeRect(4, 4, 376, 88);
      ctx.fillStyle = '#fff1c2';
      ctx.font = "900 56px 'Bangers','Orbitron',sans-serif";
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('PAPER MILL', 192, 50);
      const signTex = new THREE.CanvasTexture(cvs);
      const sign = new THREE.Mesh(new THREE.PlaneGeometry(3.5, 0.9),
        new THREE.MeshBasicMaterial({ map: signTex }));
      sign.position.set(0, 3.25, 2.32);
      grp.add(sign);
      // Spinning ticker
      let angle = 0;
      function spin(){
        angle += 0.012;
        wheelGrp.rotation.x = angle;
        requestAnimationFrame(spin);
      }
      spin();
      scene.add(grp);
      console.log("[Mill] built at", MILL_POS);
    })();

    // ── Mill modal ──
    (function buildMillModal(){
      const style = document.createElement('style');
      style.textContent = `
.mill-bg { position: fixed; inset: 0; background: rgba(0,0,0,.78); backdrop-filter: blur(10px); display: none; align-items: center; justify-content: center; z-index: 60; padding: 20px; }
.mill-bg.show { display: flex; }
.mill-card { max-width: 440px; width: 100%; background: linear-gradient(180deg, rgba(36,22,8,.97), rgba(20,12,4,.97)); border: 2px solid rgba(200,152,88,.5); border-radius: 18px; padding: 20px 22px; box-shadow: 0 30px 80px rgba(0,0,0,.6); }
.mill-card h2 { font-family: 'Bangers','Orbitron',sans-serif; font-size: 28px; letter-spacing: 2.2px; color: #fff1c2; margin-bottom: 8px; }
.mill-card p { color: rgba(230,255,238,.7); font-size: 12.5px; line-height: 1.5; margin-bottom: 14px; }
.mill-card p b { color: #c89858; }
.mill-row { display: flex; align-items: center; gap: 10px; padding: 12px 14px; background: rgba(200,152,88,.06); border: 1px solid rgba(200,152,88,.20); border-radius: 12px; margin-bottom: 14px; }
.mill-row input { background: transparent; border: 0; color: #fff1c2; font-family: 'Orbitron',sans-serif; font-weight: 800; font-size: 18px; outline: none; width: 80px; }
.mill-row .preview { font-family: 'JetBrains Mono',monospace; font-size: 12px; color: rgba(230,255,238,.7); margin-left: auto; }
.mill-go { width: 100%; background: linear-gradient(135deg, #c89858, #fff1c2); color: #2a1408; border: 0; padding: 12px; border-radius: 100px; font-family: 'Orbitron',sans-serif; font-weight: 900; font-size: 12px; letter-spacing: 1.4px; text-transform: uppercase; cursor: pointer; }
.mill-cancel { width: 100%; background: transparent; border: 1px solid rgba(230,255,238,.25); color: rgba(230,255,238,.6); padding: 8px; border-radius: 100px; font-family: 'JetBrains Mono',monospace; font-size: 11px; cursor: pointer; margin-top: 6px; }
`;
      document.head.appendChild(style);
      const el = document.createElement('div');
      el.innerHTML = `
<div class="mill-bg" id="millBg"><div class="mill-card">
<h2>🏭 PAPER MILL</h2>
<p>Bring 🪵 Wood, get 📜 Paper. <b>1 wood = 5 paper</b>. Cheaper than the marketplace if you've been chopping trees.</p>
<div class="mill-row">
  <input id="millQty" type="number" min="1" value="1"/>
  <span style="font-family:Orbitron;font-weight:800;color:#c89858;">🪵 Wood</span>
  <span class="preview" id="millPreview">→ 5 📜</span>
</div>
<button class="mill-go" id="millGo">Mill it</button>
<button class="mill-cancel" id="millCancel">Leave</button>
</div></div>`;
      document.body.appendChild(el.firstElementChild);
      document.getElementById('millCancel').addEventListener('click', () => {
        document.getElementById('millBg').classList.remove('show');
      });
      document.getElementById('millBg').addEventListener('click', (e) => {
        if(e.target.id === "millBg") document.getElementById('millBg').classList.remove('show');
      });
      document.getElementById('millQty').addEventListener('input', (e) => {
        const n = Math.max(0, Math.floor(Number(e.target.value) || 0));
        document.getElementById('millPreview').textContent = `→ ${n * MILL_RATE} 📜`;
      });
      document.getElementById('millGo').addEventListener('click', () => {
        const n = Math.max(0, Math.floor(Number(document.getElementById('millQty').value) || 0));
        if(n <= 0){ window.floater?.("Enter a wood amount", "bad"); return; }
        if((State.inventory.wood || 0) < n){
          window.floater?.(`Need ${n} 🪵 Wood`, "bad"); return;
        }
        window.takeItem("wood", n);
        for(let i = 0; i < n * MILL_RATE; i++) window.addItem("paper", 1);
        window.floater?.(`+${n * MILL_RATE} 📜 Paper · -${n} 🪵`, "good");
        window.showBuyToast?.(`Milled ${n} Wood → ${n * MILL_RATE} Paper`);
        window.playPurchaseSound?.();
        window.saveState?.();
        window.updateHUD?.();
        document.getElementById('millBg').classList.remove('show');
      });
      window.openPaperMill = function(){
        document.getElementById('millQty').value = "1";
        document.getElementById('millPreview').textContent = "→ 5 📜";
        document.getElementById('millBg').classList.add('show');
      };
    })();

    // Proximity detection + open on E ── piggy-backs on the existing
    // proximity check by polling every ~150ms. Press E when nearby.
    let _millNear = false;
    setInterval(() => {
      const d = Math.hypot(Player.pos.x - MILL_POS.x, Player.pos.z - MILL_POS.z);
      const near = d < MILL_RADIUS;
      if(near !== _millNear){
        _millNear = near;
        // Show prompt
        const p = document.getElementById('plotPrompt');
        if(near && p){
          p.classList.add('show');
          p.classList.remove('locked');
          document.getElementById('plotPromptTitle').textContent = "🏭 PAPER MILL";
          document.getElementById('plotPromptSub').innerHTML = `Press <kbd>E</kbd> to mill 🪵 → 📜 (1:${MILL_RATE})`;
        }
      }
    }, 150);
    window.addEventListener('keydown', (e) => {
      if(e.code !== "KeyE" || !_millNear) return;
      const a = document.activeElement;
      if(a && (a.tagName === "INPUT" || a.tagName === "TEXTAREA")) return;
      if(window.openPaperMill) window.openPaperMill();
    });

    console.log("[world-extras] jail + trees + mill ready");
  }
})();
