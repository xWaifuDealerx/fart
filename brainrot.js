// =================================================================
// brainrot.js — ★ STEAL A BRAINROT ★
// A self-contained game mode:
//   • Glowing "Brainrot" NPCs roam the world (no nametag, can't talk).
//   • Press G to scoop the nearest one into your printer's LEFT HAND.
//     Press G again to set it back down. They can't go in your bag.
//   • Rent one of 6 bases (6 toilets each) for 1 hour / 1000 🥈.
//   • Press E at an empty toilet in YOUR base to plant a brainrot —
//     only its head pokes out of the bowl.
//   • Occupied toilets earn silver over time; press E at your base to
//     claim it. Rarer brainrots pay more.
//   • Press E at someone else's occupied toilet to STEAL it — a
//     "Stealing…" bar fills (longer for rarer brainrots). The base
//     owner is free to gun you down while you work.
//
// Hooks the same globals the other side-files use (THREE, scene,
// Player, State, groundHeightAt, printer, floater, updateHUD…).
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
    const floater = (m, t) => { try { window.floater?.(m, t); } catch(_){} };
    const save = () => { try { window.saveState?.(); } catch(_){} };
    const hud  = () => { try { window.updateHUD?.(); } catch(_){} };
    const silver = () => State.credits || 0;
    function addSilver(n){ State.credits = (State.credits || 0) + n; hud(); }
    function spendSilver(n){ if(silver() < n) return false; State.credits -= n; hud(); return true; }
    function meId(){ return (window.Net && window.Net.peerId) || State.username || 'me'; }

    // ── POOP ORB SILVER BONUS ───────────────────────────────────────
    // Each Poop Orb (won on the Fart Slide) you spend at your base adds +5%
    // to silver earnings for 10 minutes. Spending more stacks the % and
    // refreshes the timer. Persisted on State so it survives reloads.
    const BONUS_PCT = 1, BONUS_MS = 10 * 60 * 1000;
    function bonusState(){
      if(!State.poopBonus) State.poopBonus = { until: 0, pct: 0 };
      return State.poopBonus;
    }
    function activeBonusPct(){
      const b = bonusState();
      if(Date.now() >= b.until){ b.pct = 0; return 0; }
      return b.pct;
    }
    function bonusMult(){ return 1 + activeBonusPct() / 100; }
    function usePoopOrb(){
      const have = (State.inventory && State.inventory.poop_orb) || 0;
      if(have <= 0){ floater('No Poop Orbs — win them on the Fart Slide 🛝', 'bad'); return; }
      if(!window.takeItem || !window.takeItem('poop_orb', 1)){ floater('No Poop Orbs', 'bad'); return; }
      const b = bonusState();
      // stack the percentage FIRST (while the old window may still be active),
      // then refresh to a fresh 10 minutes.
      b.pct = (Date.now() < b.until ? b.pct : 0) + BONUS_PCT;
      b.until = Date.now() + BONUS_MS;
      save();
      floater('💩 Poop Orb used! +' + b.pct + '% silver for 10:00', 'good');
    }
    // expose for other systems / debugging
    window.fwSilverBonusMult = bonusMult;
    window.fwUsePoopOrb = usePoopOrb;

    // ── material helpers ──
    function mat(color, emi, ei, rough){
      return new THREE.MeshStandardMaterial({
        color, emissive: (emi == null ? color : emi),
        emissiveIntensity: (ei == null ? 0.5 : ei), roughness: (rough == null ? 0.55 : rough),
      });
    }
    // Soft additive halo — NO dynamic light (lights would recompile shaders).
    function halo(r, color){
      return new THREE.Mesh(
        new THREE.SphereGeometry(r, 16, 12),
        new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.14,
          blending: THREE.AdditiveBlending, depthWrite: false })
      );
    }
    function eyes(grp, y, z, sx, color){
      const w = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4 });
      const b = new THREE.MeshStandardMaterial({ color: 0x101014, roughness: 0.4 });
      for(const s of [-1, 1]){
        const e = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 12), w);
        e.position.set(s * sx, y, z); grp.add(e);
        const p = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 10), b);
        p.position.set(s * sx, y, z + 0.09); grp.add(p);
      }
    }

    // ──────────────────────────────────────────────────────────────
    // BRAINROT TYPES — each builds a full body and a head-only version
    // ──────────────────────────────────────────────────────────────
    // head() returns a small group (for the toilet). body() returns the
    // full standing creature (~1.4 tall, feet at y≈0).
    function headFartbubu(C){            // Labubu-ish: round fuzzy face, tall ears, jagged grin
      const g = new THREE.Group();
      const face = new THREE.Mesh(new THREE.SphereGeometry(0.34, 16, 14), mat(0xefe2cf, C, 0.35));
      g.add(face);
      for(const s of [-1, 1]){
        const ear = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.42, 10), mat(0xefe2cf, C, 0.35));
        ear.position.set(s * 0.2, 0.42, 0); ear.rotation.z = s * -0.25; g.add(ear);
      }
      eyes(g, 0.05, 0.30, 0.14, C);
      // jagged grin
      const grin = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.03, 8, 16, Math.PI), mat(0x402a2a, 0x000000, 0));
      grin.position.set(0, -0.08, 0.30); grin.rotation.z = Math.PI; g.add(grin);
      return g;
    }
    function headBaldur(C){               // Tung-Tung-Sahur-ish: wooden bat with a face
      const g = new THREE.Group();
      const log = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.30, 0.6, 14), mat(0x9b6a38, C, 0.3, 0.8));
      g.add(log);
      eyes(g, 0.08, 0.24, 0.11, C);
      const m = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.05, 0.04), mat(0x2a1c10, 0x000000, 0));
      m.position.set(0, -0.08, 0.25); g.add(m);
      return g;
    }
    function headFartolero(C){            // Tralalero shark head: blue, big toothy mouth
      const g = new THREE.Group();
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.33, 16, 14), mat(0x3b7fc4, C, 0.4));
      head.scale.set(1, 0.85, 1.25); g.add(head);
      eyes(g, 0.12, 0.18, 0.16, C);
      const jaw = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.12, 0.3), mat(0xeef4ff, 0x000000, 0));
      jaw.position.set(0, -0.16, 0.18); g.add(jaw);
      for(let i = 0; i < 5; i++){
        const t = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.08, 4), mat(0xffffff, 0x000000, 0));
        t.position.set(-0.16 + i * 0.08, -0.1, 0.32); t.rotation.x = Math.PI; g.add(t);
      }
      return g;
    }
    function headFartitos(C){             // Los Fartitos: three little skulls
      const g = new THREE.Group();
      for(let i = 0; i < 3; i++){
        const s = new THREE.Mesh(new THREE.SphereGeometry(0.17, 14, 12), mat(0xeae6da, C, 0.5));
        s.position.set((i - 1) * 0.26, 0.02 + (i === 1 ? 0.08 : 0), 0); g.add(s);
        const b = new THREE.MeshStandardMaterial({ color: 0x101014 });
        for(const e of [-1, 1]){
          const eye = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 8), b);
          eye.position.set((i - 1) * 0.26 + e * 0.06, 0.04 + (i === 1 ? 0.08 : 0), 0.15); g.add(eye);
        }
      }
      return g;
    }
    function headPopofanto(C){            // elephant: grey head, ears, trunk, tusks
      const g = new THREE.Group();
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.34, 16, 14), mat(0x9aa0aa, C, 0.3));
      g.add(head);
      for(const s of [-1, 1]){
        const ear = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 10), mat(0x8a909a, C, 0.3));
        ear.scale.set(0.4, 1, 1); ear.position.set(s * 0.34, 0.04, -0.05); g.add(ear);
      }
      eyes(g, 0.1, 0.24, 0.14, C);
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.12, 0.4, 10), mat(0x9aa0aa, C, 0.3));
      trunk.position.set(0, -0.18, 0.26); trunk.rotation.x = 0.9; g.add(trunk);
      for(const s of [-1, 1]){
        const tusk = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.16, 6), mat(0xfff4dd, 0x000000, 0));
        tusk.position.set(s * 0.1, -0.2, 0.28); tusk.rotation.x = 2.4; g.add(tusk);
      }
      return g;
    }
    function headFartifito(C){            // plain shark: teal/grey
      const g = new THREE.Group();
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.32, 16, 14), mat(0x6f7f86, C, 0.4));
      head.scale.set(1, 0.9, 1.3); g.add(head);
      const fin = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.26, 4), mat(0x6f7f86, C, 0.4));
      fin.position.set(0, 0.3, -0.05); g.add(fin);
      eyes(g, 0.08, 0.2, 0.15, C);
      const jaw = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.1, 0.26), mat(0xe9eef0, 0x000000, 0));
      jaw.position.set(0, -0.14, 0.2); g.add(jaw);
      return g;
    }

    function bodyWith(headFn, C, bodyColor){
      const g = new THREE.Group();
      const torso = new THREE.Mesh(new THREE.SphereGeometry(0.42, 16, 14), mat(bodyColor, C, 0.3));
      torso.scale.set(1, 1.15, 0.9); torso.position.y = 0.7; g.add(torso);
      // stubby legs
      for(const s of [-1, 1]){
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.4, 8), mat(bodyColor, C, 0.25));
        leg.position.set(s * 0.18, 0.2, 0); g.add(leg);
        const foot = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.08, 0.26), mat(0x2a2a30, 0x000000, 0));
        foot.position.set(s * 0.18, 0.02, 0.05); g.add(foot);
      }
      // little arms
      for(const s of [-1, 1]){
        const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.34, 8), mat(bodyColor, C, 0.25));
        arm.position.set(s * 0.42, 0.72, 0); arm.rotation.z = s * 0.5; g.add(arm);
      }
      const head = headFn(C);
      head.position.y = 1.28;
      head.scale.set(0.95, 0.95, 0.95);
      g.add(head);
      // (No halo ring — the emissive materials give the glow.)
      return g;
    }

    const BRAINROTS = {
      fartbubu:  { id:'fartbubu',  name:'Fartbubu',           rarity:'Legendary', yps:0.200, steal:30000, glow:0xff7ae0, body:0xf0c7e6, head:headFartbubu,  weight:1 },
      baldur:    { id:'baldur',    name:'Fart Fart Baldur',   rarity:'Legendary', yps:0.183, steal:30000, glow:0xffc04a, body:0xb07c44, head:headBaldur,    weight:1 },
      fartolero: { id:'fartolero', name:'Fartolero Fartela',  rarity:'Epic',      yps:0.133, steal:22000, glow:0x4ad6ff, body:0x3b7fc4, head:headFartolero, weight:2 },
      fartitos:  { id:'fartitos',  name:'Los Fartitos',       rarity:'Epic',      yps:0.117, steal:22000, glow:0xff5a5a, body:0x6b5b6b, head:headFartitos,  weight:2 },
      popofanto: { id:'popofanto', name:'Popofanto Elefarto', rarity:'Rare',      yps:0.083, steal:16000, glow:0x8aff9a, body:0x9aa0aa, head:headPopofanto, weight:3 },
      fartifito: { id:'fartifito', name:'Farti Fito',         rarity:'Common',    yps:0.050, steal:10000, glow:0x5fe0d0, body:0x6f7f86, head:headFartifito, weight:4 },
    };
    const RARITY_COLOR = { Legendary:'#ffae00', Epic:'#c084fc', Rare:'#5fa8ff', Common:'#9fb0a6' };
    const TYPE_LIST = Object.values(BRAINROTS);
    function makeBody(t){ return bodyWith(t.head, t.glow, t.body); }
    function makeHead(t){ return t.head(t.glow); }
    function weightedType(){
      const total = TYPE_LIST.reduce((a, t) => a + t.weight, 0);
      let r = Math.random() * total;
      for(const t of TYPE_LIST){ r -= t.weight; if(r <= 0) return t; }
      return TYPE_LIST[TYPE_LIST.length - 1];
    }

    const ISLAND_R = (typeof window.ISLAND_RADIUS === 'number') ? window.ISLAND_RADIUS : 90;
    const WATER = (typeof window.WATER_LEVEL === 'number') ? window.WATER_LEVEL : 0;

    // ──────────────────────────────────────────────────────────────
    // ROAMING BRAINROTS (no nametag, non-interactive, glowing)
    // ──────────────────────────────────────────────────────────────
    const Roamers = [];   // { t, mesh, x, z, gx, gz, idle, bob }
    const MAX_ROAMERS = 9;
    function randLandPoint(){
      for(let i = 0; i < 30; i++){
        const a = Math.random() * Math.PI * 2, r = 12 + Math.random() * (ISLAND_R - 26);
        const x = Math.cos(a) * r, z = Math.sin(a) * r;
        if(gH(x, z) > WATER + 0.4) return { x, z };
      }
      return { x: 10, z: 10 };
    }
    function spawnRoamer(at, forceType){
      const t = forceType || weightedType();   // keep a specific type when dropping
      const p = at || randLandPoint();
      const mesh = makeBody(t);
      mesh.scale.set(0.6, 0.6, 0.6);   // smaller roaming size (less huge next to the player)
      mesh.position.set(p.x, gH(p.x, p.z), p.z);
      scene.add(mesh);
      const g = randLandPoint();
      Roamers.push({ t, mesh, x: p.x, z: p.z, gx: g.x, gz: g.z, idle: !!(at && at.idle), bob: Math.random() * 6.28 });
    }
    function removeRoamer(r){
      try { scene.remove(r.mesh); } catch(_){}
      const i = Roamers.indexOf(r); if(i >= 0) Roamers.splice(i, 1);
    }
    for(let i = 0; i < MAX_ROAMERS; i++) spawnRoamer();

    // ──────────────────────────────────────────────────────────────
    // BASES (6 toilets each) at the requested coordinates
    // ──────────────────────────────────────────────────────────────
    const BASE_POS = [
      { x:-72, z:36 }, { x:37, z:-9 }, { x:67, z:-21 },
      { x:29, z:67 },  { x:-5, z:62 }, { x:-1, z:-39 },
      { x:-12, z:69 }, { x:29, z:-81 }, { x:62, z:-44 },
    ];
    const RENT_MS = 60 * 60 * 1000;     // 1 hour
    const RENT_COST = 1000;             // silver
    const BASE_R = 5.0;                 // claim / rent range (from centre)
    const TOILET_R = 2.4;               // place / steal range (from a toilet)
    const PICKUP_R = 2.4;

    // Persistent player base lives in State.br; squatter bases are
    // in-memory each session so there's always somewhere to raid solo.
    if(!State.br) State.br = { idx: -1, until: 0, toilets: [null,null,null,null,null,null], pending: 0, lastTick: Date.now() };
    if(typeof State.brCarry === 'undefined') State.brCarry = null;

    const Bases = BASE_POS.map((p, idx) => ({
      idx, x: p.x, z: p.z, y: gH(p.x, p.z),
      owner: null, ownerName: null, until: 0,
      toilets: [null,null,null,null,null,null],  // each = brainrot type id or null
      pending: 0, lastTick: Date.now(),
      group: null, toiletMeshes: [], headMeshes: [null,null,null,null,null,null], sign: null,
    }));

    function buildBaseMesh(b){
      const g = new THREE.Group();
      g.position.set(b.x, b.y, b.z);
      // platform
      const plat = new THREE.Mesh(new THREE.CylinderGeometry(4.6, 4.9, 0.3, 24),
        new THREE.MeshStandardMaterial({ color: 0x2a2f3a, roughness: 0.9 }));
      plat.position.y = 0.15; plat.receiveShadow = true; g.add(plat);
      const rim = new THREE.Mesh(new THREE.TorusGeometry(4.6, 0.12, 8, 32),
        new THREE.MeshStandardMaterial({ color: 0x5ff09c, emissive: 0x2ee06b, emissiveIntensity: 0.5, roughness: 0.5 }));
      rim.position.y = 0.32; rim.rotation.x = Math.PI / 2; g.add(rim);
      // 6 toilets in a ring
      for(let i = 0; i < 6; i++){
        const a = (i / 6) * Math.PI * 2;
        const tx = Math.cos(a) * 3.1, tz = Math.sin(a) * 3.1;
        const tg = new THREE.Group(); tg.position.set(tx, 0.3, tz); tg.rotation.y = -a + Math.PI / 2;
        const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.28, 0.4, 16),
          new THREE.MeshStandardMaterial({ color: 0xf3f6fb, roughness: 0.3 }));
        bowl.position.y = 0.2; tg.add(bowl);
        const tank = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.22),
          new THREE.MeshStandardMaterial({ color: 0xe8edf4, roughness: 0.3 }));
        tank.position.set(0, 0.42, -0.32); tg.add(tank);
        const seat = new THREE.Mesh(new THREE.TorusGeometry(0.27, 0.06, 8, 18),
          new THREE.MeshStandardMaterial({ color: 0xdfe6ef, roughness: 0.3 }));
        seat.position.y = 0.41; seat.rotation.x = Math.PI / 2; tg.add(seat);
        g.add(tg);
        b.toiletMeshes[i] = tg;
        // world position of the toilet (for proximity) — store absolute
        tg.userData.wx = b.x + tx; tg.userData.wz = b.z + tz;
      }
      // floating sign
      const signCv = document.createElement('canvas'); signCv.width = 256; signCv.height = 64;
      b.signCanvas = signCv; b.signTex = new THREE.CanvasTexture(signCv);
      const signMat = new THREE.MeshBasicMaterial({ map: b.signTex, transparent: true });
      const sign = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 0.8), signMat);
      sign.position.set(0, 3.4, 0); g.add(sign);
      b.sign = sign;
      scene.add(g);
      b.group = g;
      paintSign(b);
    }
    function paintSign(b){
      const cv = b.signCanvas, ctx = cv.getContext('2d');
      ctx.clearRect(0, 0, 256, 64);
      ctx.fillStyle = 'rgba(8,18,11,0.85)'; roundRect(ctx, 0, 0, 256, 64, 14); ctx.fill();
      ctx.strokeStyle = b.owner ? '#5ff09c' : 'rgba(230,255,238,0.4)'; ctx.lineWidth = 3; roundRect(ctx, 2, 2, 252, 60, 13); ctx.stroke();
      ctx.textAlign = 'center'; ctx.fillStyle = '#fff1c2';
      ctx.font = 'bold 22px Outfit, Arial';
      const occ = b.toilets.filter(Boolean).length;
      ctx.fillText(b.owner ? '🚽 ' + (b.ownerName || 'Base') : '🚽 BASE FOR RENT', 128, 27);
      ctx.font = '15px Outfit, Arial'; ctx.fillStyle = 'rgba(230,255,238,0.8)';
      ctx.fillText(b.owner ? (occ + '/6 toilets · ' + (b.owner === meId() ? 'yours' : 'rivals') ) : (RENT_COST + ' 🥈 / hour'), 128, 48);
      b.signTex.needsUpdate = true;
    }
    function roundRect(ctx, x, y, w, h, r){ ctx.beginPath(); ctx.moveTo(x+r,y); ctx.arcTo(x+w,y,x+w,y+h,r); ctx.arcTo(x+w,y+h,x,y+h,r); ctx.arcTo(x,y+h,x,y,r); ctx.arcTo(x,y,x+w,y,r); ctx.closePath(); }
    Bases.forEach(buildBaseMesh);

    function setToiletHead(b, i, typeId){
      // remove old head
      if(b.headMeshes[i]){ try { b.toiletMeshes[i].remove(b.headMeshes[i]); } catch(_){} b.headMeshes[i] = null; }
      if(typeId && BRAINROTS[typeId]){
        const h = makeHead(BRAINROTS[typeId]);
        h.position.y = 0.55;          // poking out of the bowl
        h.scale.set(0.7, 0.7, 0.7);
        b.toiletMeshes[i].add(h);
        b.headMeshes[i] = h;
      }
    }

    // ── restore the player's base from State + offline yield ──
    function restorePlayerBase(){
      const s = State.br;
      if(!s || s.idx < 0) return;
      if(Date.now() >= s.until){ // lease expired while away
        clearPlayerBase(false);
        return;
      }
      const b = Bases[s.idx];
      b.owner = meId(); b.ownerName = (State.username || 'You'); b.until = s.until;
      b.toilets = s.toilets.slice(); b.pending = s.pending || 0; b.lastTick = s.lastTick || Date.now();
      // accrue while you were gone (capped at the lease end)
      const end = Math.min(Date.now(), b.until);
      const dt = Math.max(0, (end - b.lastTick) / 1000);
      b.pending += occupiedYps(b) * dt;
      b.lastTick = Date.now();
      for(let i = 0; i < 6; i++) setToiletHead(b, i, b.toilets[i]);
      paintSign(b);
      syncStateBase(b);
    }
    function occupiedYps(b){ return b.toilets.reduce((a, id) => a + (id && BRAINROTS[id] ? BRAINROTS[id].yps : 0), 0); }
    function syncStateBase(b){
      State.br = { idx: b.idx, until: b.until, toilets: b.toilets.slice(), pending: b.pending, lastTick: b.lastTick };
    }
    function myBase(){ return Bases.find(b => b.owner === meId()) || null; }
    function clearPlayerBase(notify){
      const b = Bases.find(x => x.owner === meId());
      if(b){
        b.owner = null; b.ownerName = null; b.until = 0;
        for(let i = 0; i < 6; i++){ b.toilets[i] = null; setToiletHead(b, i, null); }
        b.pending = 0; paintSign(b);
      }
      State.br = { idx: -1, until: 0, toilets: [null,null,null,null,null,null], pending: 0, lastTick: Date.now() };
      save();
      if(notify) floater('🚽 Your base lease ended — toilets emptied', 'bad');
    }

    // ── seed a couple of rival (squatter) bases so raids are testable ──
    function seedSquatters(){
      const free = Bases.filter(b => !b.owner && b.idx !== State.br.idx);
      // shuffle, take 2
      free.sort(() => Math.random() - 0.5);
      free.slice(0, 2).forEach(b => {
        b.owner = 'squatter_' + b.idx; b.ownerName = ['Skibidi Gang','Toilet Cartel','The Rotters'][b.idx % 3];
        b.until = Date.now() + RENT_MS * 10;
        const n = 3 + Math.floor(Math.random() * 3);
        for(let i = 0; i < n; i++){ const t = weightedType(); b.toilets[i] = t.id; setToiletHead(b, i, t.id); }
        paintSign(b);
      });
    }

    restorePlayerBase();
    seedSquatters();

    // ──────────────────────────────────────────────────────────────
    // CARRYING (G to pick up / drop) — held in the printer's LEFT HAND
    // ──────────────────────────────────────────────────────────────
    let carry = null;   // { t, mesh }
    // Held in the printer's RIGHT arm (raised up — see animatePrinter).
    function printerArm(){ const p = window.printer; return p && p.userData ? p.userData.armR : null; }
    function attachCarry(t){
      const arm = printerArm();
      const mesh = makeBody(t);
      mesh.scale.set(0.45, 0.45, 0.45);
      // Counter the raised arm's tilt (-1.25) so the brainrot stands
      // UPRIGHT on the hand, facing the same way as the printer.
      mesh.rotation.set(1.25, 0, 0);
      mesh.position.set(0, -0.55, 0.12);   // standing on the raised hand
      if(arm){ arm.add(mesh); } else { mesh.position.set(Player.pos.x, gH(Player.pos.x, Player.pos.z) + 1, Player.pos.z); scene.add(mesh); }
      carry = { t, mesh, loose: !arm };
      window.fwCarryBrainrot = true;       // tells animatePrinter to raise the arm
      State.brCarry = t.id; save();
    }
    function detachCarry(){
      if(!carry) return;
      try { carry.mesh.parent && carry.mesh.parent.remove(carry.mesh); } catch(_){}
      carry = null; window.fwCarryBrainrot = false;
      if(fpView) fpView.visible = false;
      State.brCarry = null; save();
    }

    // ── FIRST-PERSON HELD VIEW ──────────────────────────────────────
    // In 3rd person the brainrot sits on the printer's raised hand. In 1st
    // person the printer is hidden, so we show a camera-attached copy in the
    // lower-LEFT of the screen (mirrors how the held item reads up close).
    const FPS_AT = 2.1;
    let fpView = null, fpViewType = null;
    function updateCarryFpView(){
      const cam = window.camera, THREE = window.THREE;
      if(!cam || !THREE) return;
      const fps = !!(window.Cam && window.Cam.curDistance < FPS_AT);
      if(!carry || !fps){ if(fpView) fpView.visible = false; return; }
      // (re)build when we start carrying a different brainrot
      if(!fpView || fpViewType !== carry.t.id){
        if(fpView){ try { cam.remove(fpView); } catch(_){} fpView = null; }
        fpView = new THREE.Group();
        const body = makeBody(carry.t);
        body.scale.set(0.4, 0.4, 0.4);
        fpView.add(body);
        // tucked into the LOWER-LEFT corner, close to the camera
        fpView.position.set(-0.78, -0.78, -1.25);
        fpView.rotation.set(0.12, 0.5, 0.06);
        // Always draw the held item ON TOP of the world (no sea/horizon bleed):
        // disable depth test + write, mark transparent, and give it a high
        // render order so it paints last, after the (transparent) ocean.
        fpView.traverse(o => {
          if(o.isMesh){ o.renderOrder = 9999; o.frustumCulled = false; }
          const mats = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : [];
          mats.forEach(m => { m.depthTest = false; m.depthWrite = false; m.transparent = true; m.needsUpdate = true; });
        });
        cam.add(fpView);
        fpViewType = carry.t.id;
      }
      fpView.visible = true;
      // gentle idle bob so it feels held
      const t = performance.now() / 1000;
      fpView.position.y = -0.78 + Math.sin(t * 2.2) * 0.015;
      fpView.rotation.z = 0.06 + Math.sin(t * 1.7) * 0.02;
    }
    if(State.brCarry && BRAINROTS[State.brCarry]){
      // re-grab whatever we were holding when we logged out
      setTimeout(() => { if(!carry) attachCarry(BRAINROTS[State.brCarry]); }, 1200);
    }

    function nearestRoamer(){
      let best = null, bd = PICKUP_R;
      for(const r of Roamers){
        const d = Math.hypot(Player.pos.x - r.x, Player.pos.z - r.z);
        if(d < bd){ bd = d; best = r; }
      }
      return best;
    }
    function pickUpOrDrop(){
      if(carry){
        // drop on the ground in front of you (becomes an idle roamer)
        const yaw = Player.yaw || 0;
        const fx = Math.sin(yaw + Math.PI), fz = Math.cos(yaw + Math.PI);
        const x = Player.pos.x + fx * 1.4, z = Player.pos.z + fz * 1.4;
        const t = carry.t;
        detachCarry();
        spawnRoamer({ x, z, idle: true }, t);   // keep the SAME type you were carrying
        floater('Set down ' + t.name, 'good');
        return;
      }
      const r = nearestRoamer();
      if(!r){ return; }   // nothing close — let other G handlers (ground loot) act
      const t = r.t;
      removeRoamer(r);
      attachCarry(t);
      floater('🧠 Carrying ' + t.name + ' — bring it to a toilet (E)', 'good');
    }
    window.addEventListener('keydown', (e) => {
      if(e.code !== 'KeyG') return;
      const a = document.activeElement;
      if(a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA')) return;
      // Only act on G if a brainrot is actually relevant (carrying, or one nearby)
      if(carry || nearestRoamer()) pickUpOrDrop();
    });

    // ──────────────────────────────────────────────────────────────
    // PROXIMITY + E ACTIONS (rent / place / claim / steal)
    // ──────────────────────────────────────────────────────────────
    function nearestBaseCentre(){
      let best = null, bd = BASE_R;
      for(const b of Bases){ const d = Math.hypot(Player.pos.x - b.x, Player.pos.z - b.z); if(d < bd){ bd = d; best = b; } }
      return best;
    }
    function nearestToilet(){
      let best = null, bd = TOILET_R;
      for(const b of Bases){
        for(let i = 0; i < 6; i++){
          const tm = b.toiletMeshes[i]; if(!tm) continue;
          const d = Math.hypot(Player.pos.x - tm.userData.wx, Player.pos.z - tm.userData.wz);
          if(d < bd){ bd = d; best = { b, i }; }
        }
      }
      return best;
    }
    function placeInToilet(nt){
      const b = nt.b, i = nt.i;
      b.toilets[i] = carry.t.id; setToiletHead(b, i, carry.t.id);
      b.lastTick = Date.now(); paintSign(b);
      floater('🚽 Planted ' + carry.t.name + ' (' + Math.round(BRAINROTS[carry.t.id].yps * 60) + ' 🥈/min)', 'good');
      detachCarry(); syncStateBase(b); save();
    }
    function rentBase(b){
      if(myBase()){ floater('You already rent a base — only one at a time', 'bad'); return; }
      if(b.owner){ floater('That base is already taken', 'bad'); return; }
      if(!spendSilver(RENT_COST)){ floater('Need ' + RENT_COST + ' 🥈 to rent', 'bad'); return; }
      b.owner = meId(); b.ownerName = (State.username || 'You'); b.until = Date.now() + RENT_MS;
      b.lastTick = Date.now(); b.pending = 0; paintSign(b);
      syncStateBase(b); save();
      floater('🚽 Rented this base for 1 hour! Fill the toilets with brainrots.', 'good');
    }
    function claimBase(b){
      const got = Math.floor(b.pending);
      if(got <= 0){ floater('Nothing to claim yet', 'bad'); return; }
      b.pending -= got; addSilver(got);
      floater('💰 Claimed ' + got + ' 🥈 from your toilets', 'good');
      paintSign(b); syncStateBase(b); save();
    }
    // E dispatcher hook (called from fartworld.html's tryInteract)
    window.fwBrainrotInteract = function(){
      if(steal.active) return true;     // busy stealing — swallow E
      const nt = nearestToilet();
      const nb = nearestBaseCentre();
      if(carry){
        if(nt && nt.b.owner === meId() && !nt.b.toilets[nt.i]){ placeInToilet(nt); return true; }
        if(nt && nt.b.owner === meId() && nt.b.toilets[nt.i]){ floater('That toilet is taken', 'bad'); return true; }
        return false;   // carrying but nothing to plant here — let normal E run
      }
      // not carrying
      if(nt && nt.b.toilets[nt.i] && nt.b.owner !== meId()){ startSteal(nt); return true; }
      if(nb){
        if(nb.owner === meId()){ claimBase(nb); return true; }
        if(nb.owner){ floater('This base belongs to ' + (nb.ownerName || 'someone else'), 'bad'); return true; }
        rentBase(nb); return true;
      }
      return false;
    };

    // ──────────────────────────────────────────────────────────────
    // STEALING — "Stealing…" bar, time scales with rarity
    // ──────────────────────────────────────────────────────────────
    const steal = { active: false, b: null, i: null, t0: 0, dur: 0, x: 0, z: 0 };
    function startSteal(nt){
      const id = nt.b.toilets[nt.i]; if(!id) return;
      const t = BRAINROTS[id];
      steal.active = true; steal.b = nt.b; steal.i = nt.i; steal.t0 = performance.now();
      steal.dur = t.steal; steal.x = Player.pos.x; steal.z = Player.pos.z;
      stealUI.style.display = 'block';
      floater('🥷 Stealing ' + t.name + '… stay close!', 'bad');
      // alert the owner (multiplayer hook — best effort)
      try { window.fwBroadcast?.({ kind: 'br_steal_start', base: nt.b.idx, by: State.username || 'someone' }); } catch(_){}
    }
    function cancelSteal(reason){
      if(!steal.active) return;
      steal.active = false; stealUI.style.display = 'none';
      if(reason) floater(reason, 'bad');
    }
    function finishSteal(){
      const b = steal.b, i = steal.i; const id = b.toilets[i];
      steal.active = false; stealUI.style.display = 'none';
      if(!id) return;
      const t = BRAINROTS[id];
      b.toilets[i] = null; setToiletHead(b, i, null); paintSign(b);
      if(b.owner === meId()) syncStateBase(b);
      if(carry) detachCarry();
      attachCarry(t);
      floater('🥷 Stole ' + t.name + '! Run to your base.', 'good');
    }

    // ──────────────────────────────────────────────────────────────
    // UI — prompt, steal bar, base-status pill
    // ──────────────────────────────────────────────────────────────
    const css = document.createElement('style');
    css.textContent = `
#brPrompt{position:fixed;left:50%;bottom:230px;transform:translateX(-50%);display:none;z-index:54;
  background:linear-gradient(180deg,rgba(8,18,11,.95),rgba(5,14,9,.95));border:2px solid rgba(95,240,156,.5);
  border-radius:13px;padding:9px 16px;color:#fff1c2;font-family:'Outfit','Inter',sans-serif;text-align:center;
  box-shadow:0 12px 26px rgba(0,0,0,.5);pointer-events:none}
#brPrompt .k{background:rgba(95,240,156,.22);border:1px solid rgba(95,240,156,.55);color:#5ff09c;
  padding:1px 8px;border-radius:6px;font-family:monospace;font-weight:700}
#brPrompt .sub{font-size:10.5px;color:rgba(230,255,238,.6);margin-top:2px}
#brSteal{position:fixed;left:50%;top:46%;transform:translate(-50%,-50%);display:none;z-index:60;width:300px;
  background:linear-gradient(180deg,rgba(20,8,8,.96),rgba(12,5,5,.97));border:2px solid rgba(255,90,77,.6);
  border-radius:14px;padding:14px 16px;color:#ffd9d4;font-family:'Outfit','Inter',sans-serif;text-align:center;
  box-shadow:0 16px 34px rgba(0,0,0,.6)}
#brSteal .t{font-family:'Bangers','Orbitron',sans-serif;letter-spacing:2px;font-size:20px;color:#ff7a6e}
#brSteal .bar{height:14px;background:rgba(255,90,77,.18);border:1px solid rgba(255,90,77,.5);border-radius:8px;overflow:hidden;margin:9px 0 4px}
#brSteal .fill{height:100%;width:0%;background:linear-gradient(90deg,#ff5a4d,#ffb4ab);transition:width .1s linear}
#brSteal .sub{font-size:10.5px;color:rgba(255,217,212,.7)}
#brBase{position:fixed;left:14px;bottom:14px;display:none;z-index:33;background:rgba(8,18,11,.82);
  border:1px solid rgba(95,240,156,.35);border-radius:12px;padding:9px 13px;color:#e6ffee;
  font-family:'Outfit','Inter',sans-serif;font-size:12px;box-shadow:0 6px 16px rgba(0,0,0,.4)}
#brBase b{color:#5ff09c}
`;
    document.head.appendChild(css);
    const prompt = document.createElement('div'); prompt.id = 'brPrompt'; document.body.appendChild(prompt);
    const stealUI = document.createElement('div'); stealUI.id = 'brSteal';
    stealUI.innerHTML = '<div class="t">STEALING…</div><div class="bar"><div class="fill" id="brStealFill"></div></div><div class="sub" id="brStealSub">Hold position</div>';
    document.body.appendChild(stealUI);
    const basePill = document.createElement('div'); basePill.id = 'brBase'; document.body.appendChild(basePill);

    function setPrompt(html){ if(html){ prompt.innerHTML = html; prompt.style.display = 'block'; } else prompt.style.display = 'none'; }
    function fmtMs(ms){ const s = Math.max(0, Math.floor(ms / 1000)); const m = Math.floor(s / 60); return m + ':' + String(s % 60).padStart(2, '0'); }

    // ──────────────────────────────────────────────────────────────
    // MAIN TICK
    // ──────────────────────────────────────────────────────────────
    let lastT = performance.now();
    function tick(){
      const now = performance.now();
      let dt = (now - lastT) / 1000; if(dt > 0.1) dt = 0.1; lastT = now;
      const inMenu = document.querySelector('#invBg.show, #launderBg.show, #bankBg.show, #marketBg.show, .fw-skill-bg.show');

      // roam
      for(const r of Roamers){
        if(!r.idle){
          let dx = r.gx - r.x, dz = r.gz - r.z; let d = Math.hypot(dx, dz);
          if(d < 1.2){ const g = randLandPoint(); r.gx = g.x; r.gz = g.z; }
          else { const sp = 1.5; r.x += (dx / d) * sp * dt; r.z += (dz / d) * sp * dt; r.mesh.rotation.y = Math.atan2(dx, dz); }
        }
        r.bob += dt * 3;
        const gy = gH(r.x, r.z);
        r.mesh.position.set(r.x, gy + Math.sin(r.bob) * 0.06, r.z);
        // gentle glow pulse via emissiveIntensity isn't worth a traverse each frame; skip.
      }
      // keep population up
      if(Roamers.filter(r => !r.idle).length < MAX_ROAMERS && Math.random() < dt * 0.3) spawnRoamer();

      // yield accrual for all owned/squatter bases
      for(const b of Bases){
        if(!b.owner) continue;
        // Don't expire/clear the base while the player is busy in the Fart
        // Slide — the lease keeps running and yielding silver in the background.
        if(b.owner === meId() && Date.now() >= b.until && !window.fwSlideActive){ clearPlayerBase(true); continue; }
        const yps = occupiedYps(b);
        // Poop Orb bonus multiplies silver earnings for everyone's owned bases.
        if(yps > 0){ b.pending += yps * bonusMult() * dt; if(b.owner === meId()) { b.lastTick = Date.now(); } }
      }
      // keep the floating base signs facing the player (yaw billboard)
      if(window.camera){
        for(const b of Bases){ if(b.sign) b.sign.rotation.y = Math.atan2(window.camera.position.x - b.x, window.camera.position.z - b.z); }
      }
      const mine = myBase();
      if(mine) syncStateBase(mine);

      // carry bob handled by arm animation already; nothing to do.

      // steal progress
      if(steal.active){
        if(Math.hypot(Player.pos.x - steal.x, Player.pos.z - steal.z) > TOILET_R + 1.2){
          cancelSteal('Steal cancelled — you moved away');
        } else if(!steal.b.toilets[steal.i]){
          cancelSteal('It’s already gone');
        } else {
          const p = Math.min(1, (now - steal.t0) / steal.dur);
          document.getElementById('brStealFill').style.width = (p * 100) + '%';
          document.getElementById('brStealSub').textContent = BRAINROTS[steal.b.toilets[steal.i]].name + ' · ' + fmtMs(steal.dur - (now - steal.t0)) + ' left';
          if(p >= 1) finishSteal();
        }
      }

      // prompt + base pill
      if(inMenu || steal.active){ setPrompt(null); }
      else {
        const nt = nearestToilet(), nb = nearestBaseCentre(), nr = nearestRoamer();
        if(carry){
          if(nt && nt.b.owner === meId() && !nt.b.toilets[nt.i]) setPrompt('<span class="k">E</span> plant ' + carry.t.name + ' in this toilet');
          else setPrompt('<span class="k">G</span> set down ' + carry.t.name);
        } else if(nt && nt.b.toilets[nt.i] && nt.b.owner !== meId()){
          const t = BRAINROTS[nt.b.toilets[nt.i]];
          setPrompt('<span class="k">E</span> steal ' + t.name + '<div class="sub">' + t.rarity + ' · ~' + Math.round(t.steal / 1000) + 's</div>');
        } else if(nb && nb.owner === meId()){
          const orbs = (State.inventory && State.inventory.poop_orb) || 0;
          let html = '<span class="k">E</span> claim <b>' + Math.floor(nb.pending) + ' 🥈</b>';
          if(orbs > 0) html += '<div class="sub"><span class="k">O</span> use Poop Orb 💩 (+1% silver / 10min) · ' + orbs + ' left</div>';
          setPrompt(html);
        } else if(nb && !nb.owner){
          setPrompt('<span class="k">E</span> rent this base<div class="sub">' + RENT_COST + ' 🥈 / hour · 6 toilets</div>');
        } else if(nr){
          setPrompt('<span class="k">G</span> grab ' + nr.t.name + '<div class="sub">' + nr.t.rarity + '</div>');
        } else setPrompt(null);
      }

      // base status pill
      if(mine){
        basePill.style.display = 'block';
        const occ = mine.toilets.filter(Boolean).length;
        let pill = '🚽 <b>Your base</b> · ' + occ + '/6 · <b>' + Math.floor(mine.pending) + ' 🥈</b> ready · ' + fmtMs(mine.until - Date.now()) + ' left';
        const bp = activeBonusPct();
        if(bp > 0) pill += '<br>💩 <b>+' + bp + '%</b> silver bonus · ' + fmtMs(bonusState().until - Date.now()) + ' left';
        basePill.innerHTML = pill;
      } else basePill.style.display = 'none';

      // keep the first-person held-brainrot view in sync
      updateCarryFpView();

      requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);

    // P → spend a Poop Orb for the silver bonus (only when standing at your
    // own base, and not while a text input / menu is focused).
    window.addEventListener('keydown', (e) => {
      if(e.code !== 'KeyO') return;
      if(window.fwSlideActive) return;
      const el = document.activeElement;
      if(el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA')) return;
      const nb = nearestBaseCentre();
      if(nb && nb.owner === meId()) usePoopOrb();
    });

    // expose a tiny API for debugging / future MP / the printer-bot sim
    window.fwBrainrots = {
      Bases, Roamers, BRAINROTS, get carry(){ return carry; },
      paintSign, setToiletHead, makeBody, occupiedYps,
      meId, syncStateBase,
    };
    console.log('[brainrot] ★ Steal a Brainrot ready — ' + Bases.length + ' bases, ' + Roamers.length + ' roaming');
  }
})();
