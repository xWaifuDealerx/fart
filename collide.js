// =================================================================
// collide.js — world collision: you can't walk through buildings,
// walls or signs anymore. Doorways still work because every wall is
// its own mesh — we collide per-MESH (axis-aligned boxes), so gaps
// between wall pieces (like the laundry house entrance) stay open.
//
// How: a few seconds after the world builds, every solid, static,
// wall-sized mesh is measured into an AABB and dropped into a 4m
// spatial hash. Each frame the player's collision circle is pushed
// out of any box it overlaps. Snapshot refreshes every 20s to pick
// up late-built structures.
//
// Excluded: ground/water (too large), floors + walkable surfaces
// (too flat), transparent meshes (water, glow, windows), particles,
// printers (players), spiders/cats/junkies (they move), anything
// flagged userData.fwDynamic, and meshes parked out on the water
// (boats/planes/yachts).
// =================================================================
(function(){
  'use strict';

  function whenReady(){
    if(!window.THREE || !window.scene || !window.Player || !window.groundHeightAt){
      setTimeout(whenReady, 400);
      return;
    }
    init();
  }
  whenReady();

  function init(){
    const THREE  = window.THREE;
    const scene  = window.scene;
    const Player = window.Player;
    const groundHeightAt = window.groundHeightAt;
    const WATER_LEVEL = window.WATER_LEVEL ?? 0;

    const CELL = 4;            // spatial hash cell size (metres)
    const R    = 0.45;         // player collision radius
    let grid = new Map();      // "cx,cz" -> [ {x0,x1,z0,z1,y0,y1}, ... ]
    let boxCount = 0;

    const _box = new THREE.Box3();

    function dynamicRoots(){
      const set = new Set();
      for(const arr of [window.Spiders, window.Cats, window.Junkies]){
        if(Array.isArray(arr)){
          for(const o of arr){ if(o && o.mesh) set.add(o.mesh); }
        }
      }
      if(window.Roki && window.Roki.mesh) set.add(window.Roki.mesh);
      if(window.printer) set.add(window.printer);
      return set;
    }

    function isExcluded(o, dyn){
      let p = o;
      while(p){
        if(dyn.has(p)) return true;
        if(p.userData && (p.userData.kind === 'printer' || p.userData.fwDynamic)) return true;
        p = p.parent;
      }
      return false;
    }

    function snapshot(){
      const dyn = dynamicRoots();
      const walkable = new Set(window.WalkableSurfaces || []);
      const g = new Map();
      let n = 0;
      scene.traverse(o => {
        if(!o.isMesh || !o.visible) return;
        if(o.isPoints || o.isSprite || o.isLine) return;
        if(walkable.has(o)) return;                       // floors stay walkable
        const m = o.material;
        if(m && m.transparent && typeof m.opacity === 'number' && m.opacity < 0.85) return;
        if(isExcluded(o, dyn)) return;
        let bb;
        try { bb = _box.setFromObject(o); } catch(_){ return; }
        if(!isFinite(bb.min.x) || !isFinite(bb.max.x)) return;
        const sx = bb.max.x - bb.min.x;
        const sz = bb.max.z - bb.min.z;
        const sy = bb.max.y - bb.min.y;
        // Wall-ish filter: tall enough to block, not world-sized,
        // not a paper-flat floor/mat
        if(sy < 1.15) return;                  // low props/planks — step over
        if(sx > 26 || sz > 26) return;         // ground / water / sky domes
        if(sx < 0.06 && sz < 0.06) return;     // wires / antennas
        const cx = (bb.min.x + bb.max.x) / 2;
        const cz = (bb.min.z + bb.max.z) / 2;
        // Must be reachable on foot (not a rooftop deco or out at sea)
        const gY = groundHeightAt(cx, cz);
        if(gY <= WATER_LEVEL + 0.05) return;   // boats/planes/yachts/docks at sea
        if(bb.min.y > gY + 2.4) return;        // floats above head height
        const box = { x0: bb.min.x, x1: bb.max.x, z0: bb.min.z, z1: bb.max.z, y0: bb.min.y, y1: bb.max.y };
        const c0x = Math.floor((box.x0 - R) / CELL), c1x = Math.floor((box.x1 + R) / CELL);
        const c0z = Math.floor((box.z0 - R) / CELL), c1z = Math.floor((box.z1 + R) / CELL);
        for(let ix = c0x; ix <= c1x; ix++){
          for(let iz = c0z; iz <= c1z; iz++){
            const k = ix + ',' + iz;
            let arr = g.get(k);
            if(!arr){ arr = []; g.set(k, arr); }
            arr.push(box);
          }
        }
        n++;
      });
      grid = g;
      boxCount = n;
      console.log('[collide] snapshot: ' + n + ' solid boxes');
    }

    // World keeps building for a while after boot — snapshot late, then
    // refresh periodically to pick up new structures.
    setTimeout(snapshot, 9000);
    setInterval(snapshot, 20000);

    function resolve(){
      if(Player.boat) return;                 // vessels manage their own position
      const py = Player.pos.y;
      const k0x = Math.floor(Player.pos.x / CELL);
      const k0z = Math.floor(Player.pos.z / CELL);
      // Two passes handle corners (pushed out of one box into another)
      for(let pass = 0; pass < 2; pass++){
        const arr = grid.get(k0x + ',' + k0z);
        const cells = [arr];
        // also the 8 neighbours (cheap — most are empty)
        for(let dx = -1; dx <= 1; dx++){
          for(let dz = -1; dz <= 1; dz++){
            if(dx === 0 && dz === 0) continue;
            const a = grid.get((k0x + dx) + ',' + (k0z + dz));
            if(a) cells.push(a);
          }
        }
        let pushed = false;
        for(const cell of cells){
          if(!cell) continue;
          for(const w of cell){
            // standing on top of it (roof/floor via stairs) — no block
            if(py >= w.y1 - 0.35) continue;
            // box entirely above the player's head — no block
            if(w.y0 > py + 1.9) continue;
            const px = Player.pos.x, pz = Player.pos.z;
            if(px + R <= w.x0 || px - R >= w.x1 || pz + R <= w.z0 || pz - R >= w.z1) continue;
            // penetration depths on each side
            const dxl = (px + R) - w.x0;       // push left  (−x)
            const dxr = w.x1 - (px - R);       // push right (+x)
            const dzl = (pz + R) - w.z0;       // push back  (−z)
            const dzr = w.z1 - (pz - R);       // push fwd   (+z)
            const min = Math.min(dxl, dxr, dzl, dzr);
            if(min === dxl)      Player.pos.x = w.x0 - R;
            else if(min === dxr) Player.pos.x = w.x1 + R;
            else if(min === dzl) Player.pos.z = w.z0 - R;
            else                 Player.pos.z = w.z1 + R;
            pushed = true;
          }
        }
        if(!pushed) break;
      }
    }

    function tick(){
      try { resolve(); } catch(_){}
      requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);

    // Manual re-scan hook (e.g. after buying a building)
    window.fwRebuildColliders = snapshot;
    console.log('[collide] ready');
  }
})();
