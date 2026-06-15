// =================================================================
// nature.js — scattered natural beauty across the island.
// =================================================================
// All scatter uses THREE.InstancedMesh so we can paint thousands of
// little decorations across the terrain for almost zero render cost.
//
//   • Grass tufts (4500 instances)
//   • Wildflower clusters — pink, white, yellow, blue (1600 total)
//   • Mushrooms (180 instances)
//   • Pebbles + small rocks (350 instances)
//   • Drifting clouds (8 sprites)
//   • Two slow birds flying loops above the island
//
// Each item is placed only on land (groundHeightAt > water + small)
// and avoided around the 15 known building footprints so things
// don't poke through walls.
// =================================================================
(function(){
  'use strict';
  function whenReady(){
    if(!window.THREE || !window.scene || !window.groundHeightAt){
      setTimeout(whenReady, 300); return;
    }
    init();
  }
  whenReady();

  function init(){
    const THREE = window.THREE;
    const scene = window.scene;
    const groundHeightAt = window.groundHeightAt;
    const ISLAND_R = (window.ISLAND_RADIUS || 90) - 2;
    const WATER_L  = window.WATER_LEVEL || 0;

    const AVOID = [
      { x:  36, z:  36, r: 16 },  // Arena
      { x: -15, z: -45, r: 5 },   // Trophy
      { x: -22, z:  -8, r: 5 },   // Bank
      { x: -22, z: -32, r: 6 },   // Market
      { x: -48, z:  28, r: 5 },   // Lab
      { x:  42, z:   0, r: 5 },   // Refinery
      { x:  50, z: -36, r: 5 },   // Poop
      { x:   0, z: -55, r: 7 },   // House
      { x:  84, z:   0, r: 6 },   // Dock
      { x: -45, z:   8, r: 4 },   // Paper Mill
      { x:  -8, z: -16, r: 3 },   // Stats sign
      { x:  55, z:  50, r: 4 },   // Jail
      { x:  60, z:  60, r: 5 },   // Pawn
      { x: -55, z:  32, r: 4 },   // Fart Stn
      { x: -10.5, z: -45, r: 4 }, // Alexandre
      { x:  39,   z: -51, r: 6 }, // Moo Kratha Shop
      // Brainrot bases — keep the platforms (and their immediate surround)
      // clear of grass / flowers / mushrooms.
      { x:-72, z:36, r:7 }, { x:37, z:-9, r:7 }, { x:67, z:-21, r:7 },
      { x:29, z:67, r:7 },  { x:-5, z:62, r:7 }, { x:-1, z:-39, r:7 },
      { x:-13, z:71, r:7 }, { x:29, z:-81, r:7 },{ x:62, z:-44, r:7 },
      { x:41, z:64, r:7 },  { x:-78, z:2, r:7 }, { x:-59, z:-45, r:7 },
      { x:-29, z:-63, r:7 },{ x:1, z:15, r:7 },
    ];
    function blocked(x, z){
      const r = Math.hypot(x, z);
      if(r >= ISLAND_R) return true;
      const g = groundHeightAt(x, z);
      if(g <= WATER_L + 0.1) return true;          // water
      // Grass / flowers / mushrooms grow on GRASS ONLY, never on the
      // sandy band that hugs the shore. The terrain vertex ramp paints
      // sand from water-edge up to y≈1.7 and full grass from y≈1.7+,
      // so anything below that is excluded.
      if(g <  WATER_L + 1.6) return true;
      if(g >  WATER_L + 4.5) return true;          // too steep / building roof
      for(const a of AVOID){
        if(Math.hypot(x - a.x, z - a.z) < a.r) return true;
      }
      // Skip the player's plot area + the spawn pad
      if(Math.hypot(x, z) < 10) return true;       // central spawn pad
      return false;
    }

    function makeDummy(){ return new THREE.Object3D(); }
    const dummy = makeDummy();

    // ── Grass tufts ──
    (function buildGrass(){
      const cnt = 4500;
      const blade = new THREE.ConeGeometry(0.10, 0.5, 4);
      blade.translate(0, 0.25, 0);
      const mat = new THREE.MeshStandardMaterial({
        color: 0x5fb45a, roughness: 0.95, flatShading: true,
        emissive: 0x0c2a0c, emissiveIntensity: 0.10,
      });
      const im = new THREE.InstancedMesh(blade, mat, cnt);
      im.castShadow = false; im.receiveShadow = false;
      let placed = 0;
      let tries = 0;
      while(placed < cnt && tries < cnt * 8){
        tries++;
        const ang = Math.random() * Math.PI * 2;
        const r = Math.sqrt(Math.random()) * ISLAND_R;
        const x = Math.cos(ang) * r;
        const z = Math.sin(ang) * r;
        if(blocked(x, z)) continue;
        const y = groundHeightAt(x, z) + 0.02;
        dummy.position.set(x, y, z);
        dummy.rotation.y = Math.random() * Math.PI;
        dummy.rotation.z = (Math.random() - 0.5) * 0.18;
        const s = 0.7 + Math.random() * 0.6;
        dummy.scale.set(s, s, s);
        dummy.updateMatrix();
        im.setMatrixAt(placed, dummy.matrix);
        // Per-instance colour variance
        const c = new THREE.Color().setHSL(0.27 + Math.random() * 0.07, 0.55, 0.40 + Math.random() * 0.18);
        im.setColorAt(placed, c);
        placed++;
      }
      im.count = placed;
      im.instanceMatrix.needsUpdate = true;
      if(im.instanceColor) im.instanceColor.needsUpdate = true;
      scene.add(im);
    })();

    // ── Wildflowers (four palettes for variety) ──
    function buildFlowerCluster(colorHex, count){
      // A flower = small stem cylinder + spherical bloom; we build it as
      // two instanced meshes that share the same matrix pool via the dummy.
      const stemGeo = new THREE.CylinderGeometry(0.018, 0.018, 0.35, 5);
      stemGeo.translate(0, 0.18, 0);
      const stemMat = new THREE.MeshStandardMaterial({ color: 0x3a7a32, roughness: 0.9 });
      const stem = new THREE.InstancedMesh(stemGeo, stemMat, count);
      const bloomGeo = new THREE.SphereGeometry(0.08, 6, 6);
      bloomGeo.translate(0, 0.36, 0);
      const bloomMat = new THREE.MeshStandardMaterial({
        color: colorHex, roughness: 0.55,
        emissive: colorHex, emissiveIntensity: 0.15,
      });
      const bloom = new THREE.InstancedMesh(bloomGeo, bloomMat, count);
      let placed = 0, tries = 0;
      while(placed < count && tries < count * 8){
        tries++;
        const ang = Math.random() * Math.PI * 2;
        const r = Math.sqrt(Math.random()) * (ISLAND_R - 4);
        const x = Math.cos(ang) * r;
        const z = Math.sin(ang) * r;
        if(blocked(x, z)) continue;
        const y = groundHeightAt(x, z);
        dummy.position.set(x, y, z);
        dummy.rotation.y = Math.random() * Math.PI * 2;
        dummy.rotation.z = (Math.random() - 0.5) * 0.10;
        const s = 0.85 + Math.random() * 0.5;
        dummy.scale.set(s, s, s);
        dummy.updateMatrix();
        stem.setMatrixAt(placed, dummy.matrix);
        bloom.setMatrixAt(placed, dummy.matrix);
        placed++;
      }
      stem.count = placed; bloom.count = placed;
      stem.instanceMatrix.needsUpdate = true;
      bloom.instanceMatrix.needsUpdate = true;
      scene.add(stem); scene.add(bloom);
    }
    buildFlowerCluster(0xff8fbf, 450); // pink
    buildFlowerCluster(0xfff8c8, 450); // white-yellow
    buildFlowerCluster(0xffd64d, 350); // gold
    buildFlowerCluster(0x9bb0ff, 350); // blue

    // ── Mushrooms ──
    (function buildShrooms(){
      const cnt = 180;
      const stemGeo = new THREE.CylinderGeometry(0.04, 0.06, 0.22, 6);
      stemGeo.translate(0, 0.11, 0);
      const capGeo = new THREE.SphereGeometry(0.12, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2);
      capGeo.translate(0, 0.22, 0);
      const stemMat = new THREE.MeshStandardMaterial({ color: 0xf2efd2, roughness: 0.85 });
      const capMat  = new THREE.MeshStandardMaterial({
        color: 0xc23a3a, roughness: 0.5, emissive: 0x3a0808, emissiveIntensity: 0.15,
      });
      const stem = new THREE.InstancedMesh(stemGeo, stemMat, cnt);
      const cap  = new THREE.InstancedMesh(capGeo,  capMat,  cnt);
      let placed = 0, tries = 0;
      while(placed < cnt && tries < cnt * 8){
        tries++;
        const ang = Math.random() * Math.PI * 2;
        const r = Math.sqrt(Math.random()) * (ISLAND_R - 6);
        const x = Math.cos(ang) * r;
        const z = Math.sin(ang) * r;
        if(blocked(x, z)) continue;
        const y = groundHeightAt(x, z);
        dummy.position.set(x, y, z);
        dummy.rotation.y = Math.random() * Math.PI * 2;
        const s = 0.7 + Math.random() * 1.1;
        dummy.scale.set(s, s, s);
        dummy.updateMatrix();
        stem.setMatrixAt(placed, dummy.matrix);
        cap.setMatrixAt(placed, dummy.matrix);
        // Random cap colour per instance
        const palette = [0xc23a3a, 0xff7a3a, 0xc890ff, 0xd2c2f0, 0xfff1c2];
        cap.setColorAt(placed, new THREE.Color(palette[Math.floor(Math.random() * palette.length)]));
        placed++;
      }
      stem.count = placed; cap.count = placed;
      stem.instanceMatrix.needsUpdate = true;
      cap.instanceMatrix.needsUpdate  = true;
      if(cap.instanceColor) cap.instanceColor.needsUpdate = true;
      scene.add(stem); scene.add(cap);
    })();

    // ── Pebbles ──
    (function buildRocks(){
      const cnt = 350;
      const geo = new THREE.DodecahedronGeometry(0.18, 0);
      const mat = new THREE.MeshStandardMaterial({ color: 0x8a8580, roughness: 0.95, flatShading: true });
      const im = new THREE.InstancedMesh(geo, mat, cnt);
      let placed = 0, tries = 0;
      while(placed < cnt && tries < cnt * 8){
        tries++;
        const ang = Math.random() * Math.PI * 2;
        const r = Math.sqrt(Math.random()) * (ISLAND_R - 2);
        const x = Math.cos(ang) * r;
        const z = Math.sin(ang) * r;
        if(blocked(x, z)) continue;
        const y = groundHeightAt(x, z);
        dummy.position.set(x, y - 0.05, z);
        dummy.rotation.set(
          Math.random() * Math.PI,
          Math.random() * Math.PI * 2,
          Math.random() * Math.PI
        );
        const s = 0.5 + Math.random() * 1.6;
        dummy.scale.set(s, s * 0.7, s);
        dummy.updateMatrix();
        im.setMatrixAt(placed, dummy.matrix);
        const tone = 0.55 + Math.random() * 0.25;
        im.setColorAt(placed, new THREE.Color(tone, tone * 0.96, tone * 0.92));
        placed++;
      }
      im.count = placed;
      im.instanceMatrix.needsUpdate = true;
      if(im.instanceColor) im.instanceColor.needsUpdate = true;
      scene.add(im);
    })();

    // ── Drifting clouds (8 cheap white blobs that slowly orbit) ──
    const Clouds = [];
    for(let i = 0; i < 8; i++){
      const grp = new THREE.Group();
      const baseMat = new THREE.MeshStandardMaterial({
        color: 0xffffff, transparent: true, opacity: 0.78,
        roughness: 0.9, emissive: 0xfff8e8, emissiveIntensity: 0.08,
      });
      for(let j = 0; j < 5; j++){
        const blob = new THREE.Mesh(
          new THREE.SphereGeometry(2 + Math.random() * 2.5, 12, 8),
          baseMat
        );
        blob.position.set(
          (Math.random() - 0.5) * 6,
          (Math.random() - 0.5) * 0.8,
          (Math.random() - 0.5) * 6
        );
        grp.add(blob);
      }
      const r = 70 + Math.random() * 70;
      const ang = (i / 8) * Math.PI * 2 + Math.random() * 0.4;
      grp.position.set(Math.cos(ang) * r, 35 + Math.random() * 18, Math.sin(ang) * r);
      Clouds.push({ mesh: grp, ang, r, speed: 0.005 + Math.random() * 0.005, y: grp.position.y });
      scene.add(grp);
    }

    // ── Birds — two simple flapping triangles that loop above ──
    function buildBird(){
      const grp = new THREE.Group();
      const mat = new THREE.MeshStandardMaterial({ color: 0x111, side: THREE.DoubleSide, flatShading: true });
      const lShape = new THREE.Shape();
      lShape.moveTo(0, 0); lShape.lineTo(0.7, 0.15); lShape.lineTo(0, 0.05); lShape.lineTo(0, 0);
      const rShape = new THREE.Shape();
      rShape.moveTo(0, 0); rShape.lineTo(-0.7, 0.15); rShape.lineTo(0, 0.05); rShape.lineTo(0, 0);
      const lWing = new THREE.Mesh(new THREE.ShapeGeometry(lShape), mat);
      const rWing = new THREE.Mesh(new THREE.ShapeGeometry(rShape), mat);
      grp.add(lWing); grp.add(rWing);
      grp.userData = { lWing, rWing };
      return grp;
    }
    const Birds = [];
    for(let i = 0; i < 3; i++){
      const b = buildBird();
      scene.add(b);
      Birds.push({ mesh: b, ang: Math.random() * Math.PI * 2, r: 50 + Math.random() * 40, y: 22 + Math.random() * 8, speed: 0.04 + Math.random() * 0.03 });
    }

    let last = performance.now();
    function tick(t){
      const dt = Math.min(0.1, (t - last) / 1000);
      last = t;
      for(const c of Clouds){
        c.ang += c.speed * dt;
        c.mesh.position.set(Math.cos(c.ang) * c.r, c.y, Math.sin(c.ang) * c.r);
      }
      for(const b of Birds){
        b.ang += b.speed * dt;
        b.mesh.position.set(Math.cos(b.ang) * b.r, b.y, Math.sin(b.ang) * b.r);
        b.mesh.rotation.y = -b.ang + Math.PI / 2;
        // Flap wings
        const flap = Math.sin(t / 80) * 0.6;
        b.mesh.userData.lWing.rotation.z = -flap;
        b.mesh.userData.rWing.rotation.z =  flap;
      }
      requestAnimationFrame(birdTick);
    }
    requestAnimationFrame(birdTick);

    console.log('[nature] scatter ready');
  }
})();
