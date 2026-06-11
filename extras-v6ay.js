// =================================================================
// extras-v6ay.js — Hospital + trees on the FartPrint hill +
//                  Operations panel (renamed from "Crops Growing"
//                  to combine farming crops + Data Center jobs).
// =================================================================
// Built as a single side file so we don't have to keep editing the
// main module's 460 KB script (which has been getting truncated by
// the linter every time we do).
// =================================================================
(function(){
  'use strict';
  function whenReady(){
    if(!window.THREE || !window.scene || !window.Player || !window.State || !window.groundHeightAt){
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
    const groundHeightAt = window.groundHeightAt;

    // ─────────────────────────────────────────────────────────────
    // 1) TREES ON THE FARTPRINT HILL
    //    The hill sits behind the island around z=-80, x≈0, with the
    //    sign mounted on it. Plant a small grove of green pines on
    //    the grass right behind/around it.
    // ─────────────────────────────────────────────────────────────
    function buildPine(){
      const grp = new THREE.Group();
      const trunkMat = new THREE.MeshStandardMaterial({ color: 0x5a3a18, roughness: 0.95 });
      const leafMat  = new THREE.MeshStandardMaterial({ color: 0x2a7a30, roughness: 0.85 });
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.20, 0.28, 1.8, 8), trunkMat);
      trunk.position.y = 0.9;
      trunk.castShadow = true;
      grp.add(trunk);
      // Stack three cones for the canopy
      for(let i = 0; i < 3; i++){
        const r = 1.6 - i * 0.35;
        const h = 1.5 - i * 0.20;
        const cone = new THREE.Mesh(new THREE.ConeGeometry(r, h, 10), leafMat);
        cone.position.y = 1.8 + i * 0.95;
        cone.castShadow = true;
        grp.add(cone);
      }
      return grp;
    }
    function plantHillTrees(){
      // Plant ~14 pines scattered around the hill on grass only.
      const POSITIONS = [
        { x:   8, z: -68 }, { x: -12, z: -70 }, { x:  20, z: -75 },
        { x: -22, z: -78 }, { x:  28, z: -82 }, { x: -28, z: -86 },
        { x:   4, z: -88 }, { x:  14, z: -92 }, { x: -14, z: -90 },
        { x:  34, z: -78 }, { x: -34, z: -82 }, { x:  22, z: -86 },
        { x: -22, z: -88 }, { x:   0, z: -78 },
      ];
      for(const p of POSITIONS){
        const y = groundHeightAt(p.x, p.z);
        // Only plant on grass (not water, not sand, not steep building roof).
        if(y < 1.7 || y > 7.0) continue;
        const tree = buildPine();
        tree.position.set(p.x, y, p.z);
        tree.rotation.y = Math.random() * Math.PI * 2;
        scene.add(tree);
      }
      console.log('[extras-v6ay] FartPrint hill pines planted');
    }
    try { plantHillTrees(); } catch(e){ console.error('[extras-v6ay] hill trees', e); }

    // ─────────────────────────────────────────────────────────────
    // 2) HOSPITAL — small white building. Player respawns here on
    //    death (hooked into window.respawnAtHospital). The bust
    //    flow already wipes inventory; we just relocate them here
    //    instead of where they died.
    // ─────────────────────────────────────────────────────────────
    const HOSPITAL_POS = { x: -64, z: -8 };
    const HOSPITAL_R = 5;
    function buildHospital(){
      const grp = new THREE.Group();
      const y0 = groundHeightAt(HOSPITAL_POS.x, HOSPITAL_POS.z);
      grp.position.set(HOSPITAL_POS.x, y0, HOSPITAL_POS.z);
      const wallMat  = new THREE.MeshStandardMaterial({ color: 0xf4f4f4, roughness: 0.55 });
      const trimMat  = new THREE.MeshStandardMaterial({ color: 0xe04848, roughness: 0.5 });
      const glassMat = new THREE.MeshStandardMaterial({ color: 0xa8c8e0, transparent: true, opacity: 0.55, roughness: 0.2 });
      const roofMat  = new THREE.MeshStandardMaterial({ color: 0xd03030, roughness: 0.5 });
      // Floor
      const base = new THREE.Mesh(new THREE.BoxGeometry(8.0, 0.3, 6.0), trimMat);
      base.position.y = 0.15; base.receiveShadow = true; grp.add(base);
      window.WalkableSurfaces?.push(base);
      // Walls
      const body = new THREE.Mesh(new THREE.BoxGeometry(7.4, 3.4, 5.4), wallMat);
      body.position.y = 1.9; body.castShadow = true; grp.add(body);
      // Flat roof
      const roof = new THREE.Mesh(new THREE.BoxGeometry(8.0, 0.25, 6.0), roofMat);
      roof.position.y = 3.75; grp.add(roof);
      // Red cross on the front
      const crossV = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.6, 0.05), trimMat);
      crossV.position.set(0, 2.3, 2.74); grp.add(crossV);
      const crossH = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.5, 0.05), trimMat);
      crossH.position.set(0, 2.3, 2.74); grp.add(crossH);
      // Windows
      for(const x of [-2.4, 2.4]){
        const w = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.0, 0.05), glassMat);
        w.position.set(x, 1.9, 2.71); grp.add(w);
      }
      // Door
      const door = new THREE.Mesh(new THREE.BoxGeometry(1.2, 2.1, 0.05), new THREE.MeshStandardMaterial({ color: 0xb83030, roughness: 0.7 }));
      door.position.set(-1.2, 1.25, 2.72); grp.add(door);
      // Sign canvas
      const cvs = document.createElement('canvas');
      cvs.width = 480; cvs.height = 110;
      const ctx = cvs.getContext('2d');
      ctx.fillStyle = '#f4f4f4'; ctx.fillRect(0, 0, 480, 110);
      ctx.strokeStyle = '#e04848'; ctx.lineWidth = 4;
      ctx.strokeRect(4, 4, 472, 102);
      ctx.fillStyle = '#e04848';
      ctx.font = "900 56px 'Bangers','Orbitron',sans-serif";
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('🏥 HOSPITAL', 240, 56);
      const tex = new THREE.CanvasTexture(cvs); tex.anisotropy = 4;
      const sign = new THREE.Mesh(new THREE.PlaneGeometry(4.0, 0.9),
        new THREE.MeshStandardMaterial({ map: tex, emissive: 0xe04848, emissiveIntensity: 0.3, roughness: 0.55, side: THREE.DoubleSide }));
      sign.position.set(0, 4.1, 2.75); grp.add(sign);
      // Soft glow light at night
      const lt = new THREE.PointLight(0xff8a8a, 1.0, 14);
      lt.position.set(0, 3.5, 0); grp.add(lt);
      scene.add(grp);
      window.HOSPITAL_POS = HOSPITAL_POS;
      // Swap in the GLB hospital (assets/models/hospital.glb) when it
      // loads — procedural stays as fallback. The floor slab + night
      // light stay live (floor keeps the walkable surface working).
      function trySwapGlb(){
        if(!window.FWModels){ setTimeout(trySwapGlb, 500); return; }
        if(!window.FWModels.cfg.hospital){
          window.FWModels.cfg.hospital = { url: 'hospital.glb', fit: 19, rotYdeg: 0, rotXdeg: 0, anchor: 'bottom' };
        }
        window.FWModels.get('hospital').then(model => {
          for(const ch of grp.children.slice()){
            if(ch === base || ch === lt) continue;   // keep floor + glow
            ch.visible = false;
          }
          grp.add(model);
          console.log('[extras-v6ay] hospital.glb swapped in');
        }).catch(err => console.warn('[extras-v6ay] hospital.glb failed — using procedural', err));
      }
      trySwapGlb();
      console.log('[extras-v6ay] Hospital built at', HOSPITAL_POS);
    }
    try { buildHospital(); } catch(e){ console.error('[extras-v6ay] hospital', e); }

    // Respawn API — call window.respawnAtHospital() to relocate the player.
    window.respawnAtHospital = function(){
      try {
        Player.pos.x = HOSPITAL_POS.x;
        Player.pos.z = HOSPITAL_POS.z + 3;
        Player.pos.y = (groundHeightAt(HOSPITAL_POS.x, HOSPITAL_POS.z + 3) || 0) + 0.05;
        Player.airborne = false;
        Player.vy = 0;
        Player.boat = null;
        State.onBike = false;
        window.floater?.('🏥 Patched up at the hospital', 'good');
        window.updateHUD?.();
      } catch(_){}
    };
    // Hook into the existing arrest / death flow if present.
    if(typeof window.counterfeitBusted === 'function' && !window._respawnPatched){
      const _origBust = window.counterfeitBusted;
      window.counterfeitBusted = function(){
        const r = _origBust.apply(this, arguments);
        try { window.respawnAtHospital(); } catch(_){}
        return r;
      };
      window._respawnPatched = true;
    }

    // Minimap landmark
    try {
      if(window.MinimapLandmarks){
        window.MinimapLandmarks.push({ x: HOSPITAL_POS.x, z: HOSPITAL_POS.z, label: 'Hospital', color: '#ff7a7a' });
      }
    } catch(_){}

    // ─────────────────────────────────────────────────────────────
    // 3) OPERATIONS PANEL — rename the existing "Crops Growing"
    //    title to "Operations" and append any active Data Center
    //    job with its remaining time, alongside farming plots.
    // ─────────────────────────────────────────────────────────────
    // The crops panel id is "cropsPanel" with a header text node.
    // We rename it once and then poll for the DC job each second.
    function renameCropsHeader(){
      const cands = [
        document.getElementById('cropsTitle'),
        document.querySelector('#cropsPanel .title'),
        document.querySelector('#cropsPanel h3'),
        document.querySelector('#cropsPanel h2'),
      ].filter(Boolean);
      for(const el of cands){
        if(el && /crops? growing/i.test(el.textContent || '')) el.textContent = 'Operations';
      }
    }
    function findCropsListEl(){
      return document.getElementById('cropsList')
          || document.querySelector('#cropsPanel ul')
          || document.querySelector('#cropsPanel .list')
          || document.querySelector('#cropsPanel');
    }
    function fmtMs(ms){
      if(ms <= 0) return 'ready';
      const s = Math.floor(ms / 1000);
      const m = Math.floor(s / 60);
      const ss = s % 60;
      return m + ':' + String(ss).padStart(2, '0');
    }
    function appendDcRow(){
      renameCropsHeader();
      const job = window._dcActiveJob || State?.dataCenterJob;
      const host = findCropsListEl();
      if(!host) return;
      let row = document.getElementById('opsDcRow');
      if(!job || !job.endsAt){
        if(row) row.remove();
        return;
      }
      const remaining = (job.endsAt || 0) - Date.now();
      if(remaining <= -2000){
        if(row) row.remove();
        return;
      }
      if(!row){
        row = document.createElement('div');
        row.id = 'opsDcRow';
        row.style.cssText = 'display:flex;justify-content:space-between;align-items:center;padding:6px 10px;background:rgba(95,240,156,.08);border:1px solid rgba(95,240,156,.32);border-radius:8px;margin-top:6px;font-size:12px;color:#fff1c2';
        host.appendChild(row);
      }
      const name = job.label || job.name || job.activity || 'Data Center';
      row.innerHTML = '<span>💻 ' + name + '</span><span style="font-family:\'JetBrains Mono\',monospace;color:#5ff09c">' + fmtMs(remaining) + '</span>';
    }
    setInterval(() => { try { appendDcRow(); } catch(_){} }, 1000);
    // First call gives the header the new name even before any job.
    setTimeout(renameCropsHeader, 2000);

    console.log('[extras-v6ay] ready');
  }
})();
