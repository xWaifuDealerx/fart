// =================================================================
// animals.js — huntable wildlife (Rats & Pigs)
//   • Rats and Pigs roam the island. They are HARMLESS — they never
//     attack or damage the player.
//   • Shoot one with the Desert Eagle and it dies, dropping meat:
//       Rat  → Rat Meat      Pig → Pork Meat
//     Pick the meat up off the ground with G (or the Vicinity panel).
//   • Killing registers each animal in window.fwHuntables, which
//     gunsmith.js's fire() also raycasts against (same as spiders).
// =================================================================
(function(){
  'use strict';
  function whenReady(){
    if(!window.THREE || !window.scene || !window.Player || !window.State || !window.groundHeightAt || !window.ITEMS){
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
    const ITEMS = window.ITEMS;
    const ISLAND_R = (typeof window.ISLAND_RADIUS === 'number') ? window.ISLAND_RADIUS : 90;
    const WATER = (typeof window.WATER_LEVEL === 'number') ? window.WATER_LEVEL : 0;

    // ── Meat items (so fwDropAt can place them & they show in the bag) ──
    if(!ITEMS.rat_meat){
      ITEMS.rat_meat = { id:'rat_meat', name:'Rat Meat', icon:'🍖', color:'#b0584a',
        type:'meat', isNFT:false, marketPrice:8, suggestedPrice:6 };
    }
    if(!ITEMS.pork_meat){
      ITEMS.pork_meat = { id:'pork_meat', name:'Pork Meat', icon:'🥓', color:'#e89aa0',
        type:'meat', isNFT:false, marketPrice:22, suggestedPrice:16 };
    }

    // ── Shared huntable registry the gun reads (spiders use their own) ──
    if(!Array.isArray(window.fwHuntables)) window.fwHuntables = [];

    // ──────────────────────────────────────────────────────────────
    // MODELS
    // ──────────────────────────────────────────────────────────────
    function buildRat(){
      const g = new THREE.Group();
      const fur = new THREE.MeshStandardMaterial({ color: 0x6b5d53, roughness: 0.95 });
      const body = new THREE.Mesh(new THREE.SphereGeometry(0.18, 12, 10), fur);
      body.scale.set(1, 0.8, 1.5); body.position.y = 0.2; body.castShadow = true; g.add(body);
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 10), fur);
      head.position.set(0, 0.22, 0.26); g.add(head);
      for(const s of [-1, 1]){
        const ear = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 8), fur);
        ear.position.set(s * 0.07, 0.33, 0.23); g.add(ear);
      }
      const nose = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 8),
        new THREE.MeshStandardMaterial({ color: 0xff9aa8 }));
      nose.position.set(0, 0.2, 0.38); g.add(nose);
      for(const s of [-1, 1]){
        const e = new THREE.Mesh(new THREE.SphereGeometry(0.025, 8, 8), new THREE.MeshBasicMaterial({ color: 0x101014 }));
        e.position.set(s * 0.06, 0.26, 0.34); g.add(e);
      }
      const tail = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.022, 0.34, 6),
        new THREE.MeshStandardMaterial({ color: 0xc98e8e }));
      tail.position.set(0, 0.16, -0.3); tail.rotation.x = 1.15; g.add(tail);
      for(const sx of [-1, 1]) for(const sz of [-1, 1]){
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.12, 6), fur);
        leg.position.set(sx * 0.1, 0.06, sz * 0.14); g.add(leg);
      }
      return g;
    }
    function buildPig(){
      const g = new THREE.Group();
      const skin = new THREE.MeshStandardMaterial({ color: 0xeeaab0, roughness: 0.85 });
      const dark = new THREE.MeshStandardMaterial({ color: 0xd98e96, roughness: 0.85 });
      const body = new THREE.Mesh(new THREE.SphereGeometry(0.34, 14, 12), skin);
      body.scale.set(1, 0.85, 1.35); body.position.y = 0.42; body.castShadow = true; g.add(body);
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.24, 14, 12), skin);
      head.position.set(0, 0.46, 0.42); g.add(head);
      const snout = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.08, 12), dark);
      snout.position.set(0, 0.42, 0.64); snout.rotation.x = Math.PI / 2; g.add(snout);
      for(const s of [-1, 1]){
        const n = new THREE.Mesh(new THREE.SphereGeometry(0.02, 6, 6), new THREE.MeshBasicMaterial({ color: 0x6a3a3a }));
        n.position.set(s * 0.035, 0.42, 0.69); g.add(n);
      }
      for(const s of [-1, 1]){
        const ear = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.14, 4), skin);
        ear.position.set(s * 0.16, 0.62, 0.38); ear.rotation.x = -0.3; g.add(ear);
      }
      for(const s of [-1, 1]){
        const e = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 8), new THREE.MeshBasicMaterial({ color: 0x101014 }));
        e.position.set(s * 0.1, 0.52, 0.58); g.add(e);
      }
      for(const sx of [-1, 1]) for(const sz of [-1, 1]){
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.3, 8), dark);
        leg.position.set(sx * 0.18, 0.15, sz * 0.22); g.add(leg);
      }
      const tail = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.02, 6, 12), skin);
      tail.position.set(0, 0.5, -0.46); g.add(tail);
      return g;
    }

    // ──────────────────────────────────────────────────────────────
    // SPAWNING + ROAMING
    // ──────────────────────────────────────────────────────────────
    const Animals = [];
    function randLandPoint(){
      for(let i = 0; i < 30; i++){
        const a = Math.random() * Math.PI * 2, r = 10 + Math.random() * (ISLAND_R - 24);
        const x = Math.cos(a) * r, z = Math.sin(a) * r;
        if(gH(x, z) > WATER + 0.4) return { x, z };
      }
      return { x: 8, z: 8 };
    }
    function spawnAnimal(kind){
      const p = randLandPoint();
      const mesh = (kind === 'pig') ? buildPig() : buildRat();
      mesh.position.set(p.x, gH(p.x, p.z), p.z);
      scene.add(mesh);
      const g = randLandPoint();
      const a = {
        kind, mesh, x: p.x, z: p.z, gx: g.x, gz: g.z, dead: false,
        meatId: kind === 'pig' ? 'pork_meat' : 'rat_meat',
        speed: kind === 'pig' ? 0.9 : 1.9,
        bob: Math.random() * 6.28,
      };
      a.onKill = () => killAnimal(a);     // gunsmith.js calls this on a hit
      Animals.push(a);
      window.fwHuntables.push(a);
    }
    function killAnimal(a){
      if(a.dead) return;
      a.dead = true;
      try { scene.remove(a.mesh); } catch(_){}
      let i = Animals.indexOf(a); if(i >= 0) Animals.splice(i, 1);
      i = window.fwHuntables.indexOf(a); if(i >= 0) window.fwHuntables.splice(i, 1);
      // drop the meat where it fell (pick up with G / Vicinity)
      try { window.fwDropAt?.(a.meatId, 1, a.x, a.z); } catch(_){}
      const it = ITEMS[a.meatId];
      const reward = a.kind === 'pig' ? 15 : 5;
      State.credits = (State.credits || 0) + reward;
      try { window.fwSkillXp?.('weapon', a.kind === 'pig' ? 8 : 4); } catch(_){}
      window.floater?.((a.kind === 'pig' ? '🐖' : '🐀') + ' down! Grab the ' + (it ? it.name : 'meat') + ' (G) · +' + reward + ' 🥈', 'good');
      try { window.updateHUD?.(); window.saveState?.(); } catch(_){}
      // respawn another of the same kind after a while
      setTimeout(() => spawnAnimal(a.kind), 18000 + Math.random() * 12000);
    }

    // initial population
    for(let i = 0; i < 7; i++) spawnAnimal('rat');
    for(let i = 0; i < 4; i++) spawnAnimal('pig');

    let lastT = performance.now();
    function tick(){
      const now = performance.now();
      let dt = (now - lastT) / 1000; if(dt > 0.1) dt = 0.1; lastT = now;
      for(const a of Animals){
        let dx = a.gx - a.x, dz = a.gz - a.z, d = Math.hypot(dx, dz);
        if(d < 1.0){ const g = randLandPoint(); a.gx = g.x; a.gz = g.z; }
        else {
          a.x += (dx / d) * a.speed * dt;
          a.z += (dz / d) * a.speed * dt;
          a.mesh.rotation.y = Math.atan2(dx, dz);
        }
        a.bob += dt * (a.kind === 'pig' ? 6 : 10);
        const gy = gH(a.x, a.z);
        a.mesh.position.set(a.x, gy + Math.abs(Math.sin(a.bob)) * (a.kind === 'pig' ? 0.03 : 0.05), a.z);
      }
      requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);

    window.fwAnimals = Animals;
    console.log('[animals] rats & pigs roaming (' + Animals.length + ')');
  }
})();
