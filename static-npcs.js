// =================================================================
// static-npcs.js — clean printer NPCs (Carlos, Moneycaller, Wave, Gary)
// =================================================================
// Each one sits behind a wooden desk at a fixed spot in the world.
// Walking near them shows a "Talk to X" floating popup with a button.
// They look like the player's printer (NOT junkies), with normal
// eyes, straight paper, no slump.
//
//   Carlos       — Marketplace clerk; buys any item for 70% of price.
//   Moneycaller  — Bank teller (visual only for now; bank UI already
//                  handles conversions through the existing modal).
//   Wave         — Boat seller at the dock (visual; dock E-buy works).
//   Gary         — Pawn Shop printer (visual; full pawn-shop economy
//                  ships in a later batch).
// =================================================================
(function(){
  'use strict';

  function whenReady(){
    if(!window.THREE || !window.scene || !window.Player || !window.State || !window.groundHeightAt){
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
    const groundHeightAt = window.groundHeightAt;

    // Build a sit-down counter (wooden desk) + the printer behind it.
    function buildCounter(x, z, facing){
      const grp = new THREE.Group();
      const y0 = groundHeightAt(x, z);
      grp.position.set(x, y0, z);
      grp.rotation.y = facing;
      // Counter top
      const wood = new THREE.MeshStandardMaterial({ color: 0x7a4a25, roughness: 0.78 });
      const dark = new THREE.MeshStandardMaterial({ color: 0x2a1408, roughness: 0.85 });
      const top  = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.16, 1.1), wood);
      top.position.set(0, 1.1, 0);
      top.castShadow = true; top.receiveShadow = true;
      grp.add(top);
      // Front panel
      const front = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.0, 0.12), dark);
      front.position.set(0, 0.55, 0.55);
      grp.add(front);
      // Side panels
      const sideL = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.0, 1.1), dark);
      sideL.position.set(-1.3, 0.55, 0);
      grp.add(sideL);
      const sideR = sideL.clone(); sideR.position.x = 1.3; grp.add(sideR);
      scene.add(grp);
      return grp;
    }

    // Build a static printer NPC that stays put behind a desk.
    // Lifted by 0.26 so the printer body sits ON the counter top
    // (counter top surface is at ground + 1.18; printer body bottom
    // is at local 0.925 above the group origin).
    function buildStaticPrinter(name, tint, x, z, facing, opts){
      const grp = new THREE.Group();
      // onCounter (default true): printer body bottom sits on the desk
      // top (lift = 0.26m). onCounter=false places it directly on the
      // ground — used when the NPC stands free inside a tent.
      const onCounter = !(opts && opts.onCounter === false);
      const baseY = groundHeightAt(x, z) + (onCounter ? 0.26 : -0.55);
      grp.position.set(x, baseY, z);
      grp.rotation.y = facing + Math.PI;       // face forward to the desk
      const bodyMat = new THREE.MeshStandardMaterial({ color: tint, roughness: 0.55 });
      const darkMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.6 });
      const eyeWMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.2 });
      const eyeBMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
      // Body
      const body = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.95, 1.1), bodyMat);
      body.position.y = 1.4;
      body.castShadow = true;
      grp.add(body);
      // Bezel
      const bezel = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.07, 0.95), darkMat);
      bezel.position.y = 1.91;
      grp.add(bezel);
      // Straight paper sticking out
      const paper = new THREE.Mesh(new THREE.PlaneGeometry(0.85, 0.7),
        new THREE.MeshStandardMaterial({ color: 0xffffff, side: THREE.DoubleSide, roughness: 0.95 }));
      paper.position.set(0, 1.97, -0.05);
      paper.rotation.x = -Math.PI / 2 + 0.35;
      grp.add(paper);
      // Eyes (sharp, focused — NOT rolling)
      const eyeR = 0.18;
      const eyeL = new THREE.Mesh(new THREE.SphereGeometry(eyeR, 14, 14), eyeWMat);
      eyeL.position.set(-0.28, 1.6, 0.55);
      grp.add(eyeL);
      const eyeRight = eyeL.clone();
      eyeRight.position.x = 0.28;
      grp.add(eyeRight);
      const pupilL = new THREE.Mesh(new THREE.SphereGeometry(eyeR * 0.4, 10, 10), eyeBMat);
      pupilL.position.set(-0.28, 1.6, 0.72);
      grp.add(pupilL);
      const pupilR = pupilL.clone();
      pupilR.position.x = 0.28;
      grp.add(pupilR);
      // Antenna with a friendly blue glow
      const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.3, 6),
        new THREE.MeshStandardMaterial({ color: 0x3a3a3a, roughness: 0.55 }));
      ant.position.set(0.55, 2.10, 0);
      grp.add(ant);
      const orb = new THREE.Mesh(
        new THREE.SphereGeometry(0.075, 10, 10),
        new THREE.MeshStandardMaterial({ color: 0x6ed0d6, emissive: 0x6ed0d6, emissiveIntensity: 1.2, roughness: 0.4 })
      );
      orb.position.set(0.55, 2.25, 0);
      grp.add(orb);
      // Floating name tag
      const tag = document.createElement('div');
      tag.style.cssText = `position:absolute;transform:translate(-50%,-100%);background:rgba(8,18,11,.86);color:#6ed0d6;padding:4px 10px;border:1px solid rgba(110,208,214,.5);border-radius:8px;font-family:'JetBrains Mono',monospace;font-size:10.5px;pointer-events:none;z-index:9;white-space:nowrap;`;
      tag.textContent = name + " \u{1F5A8}";
      (document.getElementById('chatBubbles')?.parentElement || document.body).appendChild(tag);
      scene.add(grp);
      return { mesh: grp, tag, name, x, z };
    }

    const _projV = new THREE.Vector3();
    const StaticNPCs = [];

    // ── Carlos INSIDE the marketplace tent. The market is at
    //     (-22, -32); place Carlos toward the back so the player walks
    //     in to greet him. NO counter — he just stands in the tent
    //     handling all buying and selling. ──
    const CARLOS_POS = { x: -22, z: -33 };
    // Build a nicer market table for Carlos + a wall of stacked produce
    // crates behind him so it looks like an actual stall.
    (function buildCarlosTable(){
      const grp = new THREE.Group();
      grp.position.set(CARLOS_POS.x, groundHeightAt(CARLOS_POS.x, CARLOS_POS.z), CARLOS_POS.z);
      grp.rotation.y = Math.PI; // face the player approach direction
      const lightWood = new THREE.MeshStandardMaterial({ color: 0xc8945a, roughness: 0.85 });
      const darkWood  = new THREE.MeshStandardMaterial({ color: 0x6a3a18, roughness: 0.9 });
      const cloth     = new THREE.MeshStandardMaterial({ color: 0xc02a2a, roughness: 0.75 });
      const crateMat  = new THREE.MeshStandardMaterial({ color: 0x8f5b30, roughness: 0.88 });
      const crateBand = new THREE.MeshStandardMaterial({ color: 0x4a2810, roughness: 0.9 });
      // Big counter top (in front of Carlos)
      const top = new THREE.Mesh(new THREE.BoxGeometry(3.0, 0.18, 1.2), lightWood);
      top.position.set(0, 1.05, 0.55);
      top.castShadow = true; top.receiveShadow = true;
      grp.add(top);
      // Red cloth draped over the front of the counter
      const draped = new THREE.Mesh(new THREE.BoxGeometry(3.05, 0.95, 0.10), cloth);
      draped.position.set(0, 0.55, 1.10);
      grp.add(draped);
      // Side panels
      for(const sx of [-1.5, 1.5]){
        const side = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.0, 1.2), darkWood);
        side.position.set(sx, 0.55, 0.55);
        grp.add(side);
      }
      // Three little goods baskets on top of the counter
      for(let i = -1; i <= 1; i++){
        const basket = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.18, 0.22, 12), darkWood);
        basket.position.set(i * 1.0, 1.27, 0.55);
        grp.add(basket);
        // produce blob inside (random colour)
        const colors = [0xff6a3a, 0xf8c84a, 0x6ad06a, 0xc070ff];
        const c = colors[(i + 1) % colors.length];
        const blob = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8),
          new THREE.MeshStandardMaterial({ color: c, roughness: 0.55 }));
        blob.position.set(i * 1.0, 1.45, 0.55);
        grp.add(blob);
      }
      // Crate wall behind Carlos — three columns × 3 rows
      function crate(x, y, z){
        const c = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.7, 0.7), crateMat);
        c.position.set(x, y, z); c.castShadow = true; c.receiveShadow = true;
        grp.add(c);
        // Slat bands
        for(const oy of [-0.20, 0.20]){
          const band = new THREE.Mesh(new THREE.BoxGeometry(0.82, 0.08, 0.72), crateBand);
          band.position.set(x, y + oy, z);
          grp.add(band);
        }
        // Stamp on front (random small dark rectangle)
        const stamp = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.16, 0.02), crateBand);
        stamp.position.set(x, y, z + 0.36);
        grp.add(stamp);
      }
      // Three columns, three rows, slightly behind Carlos (z = -0.9)
      for(let col = -1; col <= 1; col++){
        for(let row = 0; row < 3; row++){
          // Slight jitter so the stack looks hand-built
          const jx = col * 0.92 + (row % 2 ? 0.05 : -0.03);
          const jy = 0.40 + row * 0.78;
          const jz = -0.95 + (col === 0 ? 0 : 0.05);
          crate(jx, jy, jz);
        }
      }
      // A row of small produce boxes peeking on top of the back crates
      for(let i = -2; i <= 2; i++){
        const pBox = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.35, 0.55),
          new THREE.MeshStandardMaterial({ color: i % 2 ? 0xd6b070 : 0xb89464, roughness: 0.85 }));
        pBox.position.set(i * 0.58, 2.95, -0.95);
        grp.add(pBox);
        // Top blob (produce)
        const colors2 = [0xff6a3a, 0xf8c84a, 0x6ad06a, 0xc070ff, 0xf04060];
        const blob2 = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 8),
          new THREE.MeshStandardMaterial({ color: colors2[(i + 5) % colors2.length], roughness: 0.55 }));
        blob2.position.set(i * 0.58, 3.20, -0.95);
        grp.add(blob2);
      }
      // Hanging string of garlic / chillies above the counter
      (function(){
        const stringMat = new THREE.MeshStandardMaterial({ color: 0xb8a070, roughness: 0.95 });
        const garlic = new THREE.MeshStandardMaterial({ color: 0xf2efd2, roughness: 0.7 });
        for(let i = -2; i <= 2; i++){
          const t = new THREE.Mesh(new THREE.SphereGeometry(0.08, 10, 8), garlic);
          t.position.set(i * 0.20, 2.55, 0.05);
          grp.add(t);
        }
        const str = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 1.1, 6), stringMat);
        str.rotation.z = Math.PI / 2;
        str.position.set(0, 2.65, 0.05);
        grp.add(str);
      })();
      scene.add(grp);
    })();
    // Carlos stands ON the counter behind it — onCounter:true lifts the
    // printer 0.26m so it sits ON the table top instead of on the floor.
    StaticNPCs.push(Object.assign(buildStaticPrinter("Carlos", 0xe0d4b8, CARLOS_POS.x, CARLOS_POS.z, 0, { onCounter: true }), { kind: "market" }));

    // ── Moneycaller at the Bank (-22, -8) — centered between the
    //    columns and the back wall, facing the customer at the door.
    const MONEY_POS = { x: -22, z: -9.0 };
    // Counter sits in front of Moneycaller, facing the customer who
    // enters from the +z side of the bank.
    buildCounter(MONEY_POS.x, MONEY_POS.z + 0.7, 0);
    // Chair behind the desk — wooden seat + backrest + 4 legs.
    (function buildBankChair(){
      const grp = new THREE.Group();
      const y = groundHeightAt(MONEY_POS.x, MONEY_POS.z) + 0.45;
      grp.position.set(MONEY_POS.x, y, MONEY_POS.z - 0.05);
      const wood = new THREE.MeshStandardMaterial({ color: 0x6a4a25, roughness: 0.85 });
      const seat = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.08, 0.5), wood);
      seat.position.y = 0;
      grp.add(seat);
      const back = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.55, 0.06), wood);
      back.position.set(0, 0.28, -0.22);
      grp.add(back);
      for(const sx of [-0.2, 0.2]){
        for(const sz of [-0.2, 0.2]){
          const leg = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.45, 0.06), wood);
          leg.position.set(sx, -0.22, sz);
          grp.add(leg);
        }
      }
      scene.add(grp);
    })();
    StaticNPCs.push(Object.assign(buildStaticPrinter("Moneycaller", 0xc8a96b, MONEY_POS.x, MONEY_POS.z, Math.PI, { onCounter: true }), { kind: "bank" }));

    // ── Wave at the boat dock (≈ 84, 0) ──
    const WAVE_POS = { x: 82, z: 1.5 };
    buildCounter(WAVE_POS.x, WAVE_POS.z, Math.PI);
    StaticNPCs.push(Object.assign(buildStaticPrinter("Wave", 0x6ed0d6, WAVE_POS.x, WAVE_POS.z + 0.5, Math.PI), { kind: "dock" }));

    // ── Gary's Pawn Shop — striped summer tent + counter ──
    const GARY_POS = { x: 60, z: 60 };
    (function buildPawnTent(){
      const grp = new THREE.Group();
      grp.position.set(GARY_POS.x, groundHeightAt(GARY_POS.x, GARY_POS.z), GARY_POS.z);
      const polesMat = new THREE.MeshStandardMaterial({ color: 0x6e4a25, roughness: 0.9 });
      const stripe1 = new THREE.MeshStandardMaterial({ color: 0xc89858, roughness: 0.85, side: THREE.DoubleSide });
      const stripe2 = new THREE.MeshStandardMaterial({ color: 0xfff1c2, roughness: 0.85, side: THREE.DoubleSide });
      // 4 corner poles — bottom at 0, top at 4.0 (centered at y=2.0)
      const POLE_TOP_Y = 4.0;
      for(const [px, pz] of [[-3, -2.5], [3, -2.5], [-3, 2.5], [3, 2.5]]){
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.10, 0.10, POLE_TOP_Y, 8), polesMat);
        pole.position.set(px, POLE_TOP_Y / 2, pz);
        pole.castShadow = true;
        grp.add(pole);
      }
      // Horizontal cross-beams along the top of the poles (close the gap)
      const beamMat = polesMat;
      const beamFB = new THREE.Mesh(new THREE.BoxGeometry(6.2, 0.18, 0.18), beamMat);
      beamFB.position.set(0, POLE_TOP_Y, -2.5);
      grp.add(beamFB);
      const beamBack = beamFB.clone(); beamBack.position.z = 2.5; grp.add(beamBack);
      const beamSL = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.18, 5.18), beamMat);
      beamSL.position.set(-3, POLE_TOP_Y, 0); grp.add(beamSL);
      const beamSR = beamSL.clone(); beamSR.position.x = 3; grp.add(beamSR);
      // Pitched striped roof — two sloped slabs meeting at a ridge.
      // Slab bottom edges sit ON the cross-beams (POLE_TOP_Y); ridge in the
      // middle rises to RIDGE_Y so the slope is visible.
      const SLAB_LEN = Math.hypot(2.5, 1.6);                // sqrt(z² + rise²)
      const SLAB_ANG = Math.atan2(1.6, 2.5);                // ~32.6°
      const RIDGE_Y  = POLE_TOP_Y + 1.6;
      function makeSlab(sign){
        const slab = new THREE.Mesh(new THREE.BoxGeometry(6.4, 0.10, SLAB_LEN * 2), stripe1);
        // mid-Z = ±SLAB_LEN/2 (along the rotated plane projects to ±1.25 in world Z)
        slab.position.set(0, (POLE_TOP_Y + RIDGE_Y) / 2, sign * 1.25);
        slab.rotation.x = sign * -SLAB_ANG;
        slab.castShadow = true; slab.receiveShadow = true;
        return slab;
      }
      grp.add(makeSlab(1));
      grp.add(makeSlab(-1));
      // Painted stripe overlay on each slab — repeated stripes along width
      function makeStripeOverlay(sign){
        const grp2 = new THREE.Group();
        for(let i = 0; i < 6; i++){
          const m = i % 2 ? stripe2 : stripe1;
          const s = new THREE.Mesh(new THREE.BoxGeometry(1.05, 0.06, SLAB_LEN * 2 - 0.05), m);
          s.position.x = -3 + (i + 0.5) * 1.05;
          grp2.add(s);
        }
        grp2.position.set(0, (POLE_TOP_Y + RIDGE_Y) / 2 + sign * 0.04, sign * 1.25);
        grp2.rotation.x = sign * -SLAB_ANG;
        return grp2;
      }
      grp.add(makeStripeOverlay(1));
      grp.add(makeStripeOverlay(-1));
      // Closed gable triangles on the left & right sides between roof
      // slabs and beams (so the structure looks like a real tent — no
      // open gap looking through the roof).
      const gableShape = new THREE.Shape();
      gableShape.moveTo(-2.5, 0);
      gableShape.lineTo( 2.5, 0);
      gableShape.lineTo( 0,   1.6);
      gableShape.lineTo(-2.5, 0);
      const gableGeom = new THREE.ShapeGeometry(gableShape);
      const gableMatX = new THREE.MeshStandardMaterial({ color: 0xc89858, roughness: 0.85, side: THREE.DoubleSide });
      const gableL = new THREE.Mesh(gableGeom, gableMatX);
      gableL.rotation.y = Math.PI / 2;
      gableL.position.set(-3.0, POLE_TOP_Y, 0);
      grp.add(gableL);
      const gableR = gableL.clone();
      gableR.position.x = 3.0;
      grp.add(gableR);
      // Ridge beam along the top (caps the joint)
      const ridge = new THREE.Mesh(new THREE.CylinderGeometry(0.10, 0.10, 6.2, 8), polesMat);
      ridge.rotation.z = Math.PI / 2;
      ridge.position.set(0, RIDGE_Y, 0);
      grp.add(ridge);
      // Counter / display table in front
      const table = new THREE.Mesh(new THREE.BoxGeometry(5.0, 0.18, 1.2), polesMat);
      table.position.set(0, 1.10, -1.4);
      table.castShadow = true; table.receiveShadow = true;
      grp.add(table);
      const tableFront = new THREE.Mesh(new THREE.BoxGeometry(5.0, 1.0, 0.12), new THREE.MeshStandardMaterial({ color: 0x3a1c08, roughness: 0.85 }));
      tableFront.position.set(0, 0.55, -1.95);
      grp.add(tableFront);
      // Three glass display jars on the counter (decorative)
      const glassMat = new THREE.MeshStandardMaterial({ color: 0xa8e0ff, transparent: true, opacity: 0.55, roughness: 0.2 });
      for(let i = -1; i <= 1; i++){
        const jar = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.18, 0.35, 12), glassMat);
        jar.position.set(i * 1.0, 1.36, -1.4);
        grp.add(jar);
      }
      // Sign with "PAWN SHOP" hanging from front
      const cvs = document.createElement('canvas');
      cvs.width = 512; cvs.height = 128;
      const ctx = cvs.getContext('2d');
      ctx.fillStyle = '#1c0c04'; ctx.fillRect(0, 0, 512, 128);
      ctx.strokeStyle = '#fff1c2'; ctx.lineWidth = 5;
      ctx.strokeRect(8, 8, 496, 112);
      ctx.fillStyle = '#fff1c2';
      ctx.font = "900 64px 'Bangers','Orbitron',sans-serif";
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText("GARY'S PAWN", 256, 56);
      ctx.fillStyle = '#c89858';
      ctx.font = "700 24px 'Orbitron',sans-serif";
      ctx.fillText('· FART JARS BOUGHT @ 125% ·', 256, 100);
      const tex = new THREE.CanvasTexture(cvs);
      const sign = new THREE.Mesh(new THREE.PlaneGeometry(4.0, 1.0),
        new THREE.MeshBasicMaterial({ map: tex }));
      sign.position.set(0, 3.7, -2.05);
      grp.add(sign);
      // Warm lantern under the awning
      const lt = new THREE.PointLight(0xffae5a, 1.5, 14);
      lt.position.set(0, 3.4, -0.5);
      grp.add(lt);
      scene.add(grp);
    })();
    StaticNPCs.push(Object.assign(buildStaticPrinter("Gary", 0xc88858, GARY_POS.x, GARY_POS.z - 1.4, Math.PI), { kind: "pawn" }));

    // ── Name-tag projection loop ──
    function projectTags(){
      const camera = window.camera;
      for(const n of StaticNPCs){
        if(!camera) continue;
        _projV.set(n.x, groundHeightAt(n.x, n.z) + 3.0, n.z);
        _projV.project(camera);
        if(_projV.z < 1 && _projV.z > -1){
          const sx = (_projV.x * 0.5 + 0.5) * innerWidth;
          const sy = (-_projV.y * 0.5 + 0.5) * innerHeight;
          n.tag.style.left = sx + "px";
          n.tag.style.top  = sy + "px";
          n.tag.style.display = "";
        } else {
          n.tag.style.display = "none";
        }
      }
      requestAnimationFrame(projectTags);
    }
    requestAnimationFrame(projectTags);

    // ── Carlos: sell-to-NPC at 70% of marketprice ──
    // Builds a small modal listing every item in the player's inventory
    // that has a `marketPrice` (the things you can BUY at the market).
    // Click a row to instantly sell 1 for 70% of that price in 🥈 Silver.
    const style = document.createElement('style');
    style.textContent = `
.carlos-bg { position: fixed; inset: 0; background: rgba(0,0,0,.78); backdrop-filter: blur(10px); display: none; align-items: center; justify-content: center; z-index: 65; padding: 20px; }
.carlos-bg.show { display: flex; }
.carlos-card { max-width: 480px; width: 100%; max-height: 88vh; background: linear-gradient(180deg, rgba(8,18,11,.97), rgba(5,14,9,.97)); border: 2px solid rgba(95,240,156,.45); border-radius: 18px; overflow: hidden; display: flex; flex-direction: column; }
.carlos-head { display: flex; align-items: center; justify-content: space-between; padding: 14px 20px; border-bottom: 1px solid rgba(95,240,156,.20); background: linear-gradient(90deg, rgba(46,224,107,.10), transparent); }
.carlos-head h2 { font-family: 'Bangers','Orbitron',sans-serif; font-size: 24px; letter-spacing: 2.2px; color: #5ff09c; }
.carlos-head .close { background: transparent; border: 0; color: rgba(230,255,238,.55); font-size: 22px; cursor: pointer; }
.carlos-body { overflow-y: auto; padding: 14px 18px 18px; }
.carlos-intro { color: rgba(230,255,238,.7); font-size: 12.5px; line-height: 1.55; margin-bottom: 12px; }
.carlos-row { display: grid; grid-template-columns: 36px 1fr auto auto; gap: 10px; align-items: center; padding: 8px 12px; background: rgba(46,224,107,.06); border: 1px solid rgba(46,224,107,.20); border-radius: 10px; margin-bottom: 6px; }
.carlos-row .ico { font-size: 22px; text-align: center; }
.carlos-row .meta { display: flex; flex-direction: column; min-width: 0; }
.carlos-row .nm { font-family: 'Orbitron',sans-serif; font-weight: 800; font-size: 13px; color: #e6ffee; }
.carlos-row .sub { font-family: 'JetBrains Mono',monospace; font-size: 10px; color: rgba(230,255,238,.5); margin-top: 2px; }
.carlos-row .qty { font-family: 'Orbitron',sans-serif; font-weight: 900; font-size: 13px; color: #ffd64d; }
.carlos-row .btn { background: linear-gradient(135deg, #46f08a, #5ff09c); color: #042913; border: 0; padding: 7px 14px; border-radius: 100px; font-family: 'Orbitron',sans-serif; font-weight: 900; font-size: 11px; cursor: pointer; }
.carlos-row .btn:hover { transform: translateY(-1px); filter: brightness(1.08); }
.carlos-empty { color: rgba(230,255,238,.45); font-family: 'JetBrains Mono',monospace; font-size: 11px; text-align: center; padding: 14px 0; }
.carlos-pop { position: sticky; top: 0; background: linear-gradient(135deg, #46f08a, #5ff09c); color: #042913; font-family: 'Orbitron',sans-serif; font-weight: 900; font-size: 13px; letter-spacing: 1.2px; text-align: center; padding: 10px 14px; border-radius: 12px; margin-bottom: 10px; box-shadow: 0 8px 18px rgba(95,240,156,.36); opacity: 0; transform: translateY(-4px); transition: opacity .18s, transform .18s; }
.carlos-pop.show { opacity: 1; transform: translateY(0); }
.carlos-running { font-family: 'JetBrains Mono',monospace; font-size: 11px; color: rgba(230,255,238,.65); text-align: right; padding: 2px 6px 8px; }
.carlos-running b { color: #ffd64d; font-family: 'Orbitron',sans-serif; font-weight: 900; font-size: 13px; }
`;
    document.head.appendChild(style);
    const cmEl = document.createElement('div');
    cmEl.innerHTML = `<div class="carlos-bg" id="carlosBg"><div class="carlos-card"><div class="carlos-head"><h2>\u{1F5A8} Carlos — Market</h2><button class="close" id="carlosClose">×</button></div><div style="display:flex;border-bottom:1px solid rgba(95,240,156,.18);"><button class="ctab" data-ctab="buy" style="flex:1;background:transparent;border:0;color:#5ff09c;padding:12px;font-family:'Orbitron',sans-serif;font-weight:800;font-size:11px;letter-spacing:1.4px;text-transform:uppercase;cursor:pointer;border-bottom:2px solid #5ff09c;">BUY</button><button class="ctab" data-ctab="sell" style="flex:1;background:transparent;border:0;color:rgba(230,255,238,.55);padding:12px;font-family:'Orbitron',sans-serif;font-weight:800;font-size:11px;letter-spacing:1.4px;text-transform:uppercase;cursor:pointer;border-bottom:2px solid transparent;">SELL · 70%</button></div><div class="carlos-body"><div class="carlos-pop" id="carlosPop">+0</div><div class="carlos-running" id="carlosRunning">This visit: <b>0 💵</b></div><p class="carlos-intro" id="carlosIntro">Pick anything off the shop shelves below.</p><div id="carlosList"></div></div></div></div>`;
    document.body.appendChild(cmEl.firstElementChild);
    document.getElementById('carlosClose').addEventListener('click', () => {
      document.getElementById('carlosBg').classList.remove('show');
    });
    document.getElementById('carlosBg').addEventListener('click', (e) => {
      if(e.target.id === "carlosBg") document.getElementById('carlosBg').classList.remove('show');
    });

    // The shop list — driven by the main module's SEED_SHOP if it ever
    // shows up on window, else fall back to a built-in catalog.
    const CARLOS_SHOP_FALLBACK = [
      "carrot_seed", "weed_seed", "pickaxe", "cat_food",
      "saw", "paper", "ink", "plastic_bag",
    ];
    function carlosShopList(){
      const ids = (window.SEED_SHOP || []).map(r => r.itemId).filter(id => window.ITEMS?.[id]) ;
      const base = ids.length ? ids.slice() : CARLOS_SHOP_FALLBACK.filter(id => window.ITEMS?.[id]);
      if(window.ITEMS?.trampoline && !base.includes('trampoline')) base.push('trampoline');
      return base;
    }

    let _carlosTab = "buy";
    function renderCarlos(){
      const ITEMS = window.ITEMS;
      const host = document.getElementById('carlosList');
      const intro = document.getElementById('carlosIntro');
      const lines = [];
      if(_carlosTab === "buy"){
        intro.innerHTML = "Pick anything off the shop shelves below.";
        for(const id of carlosShopList()){
          const item = ITEMS[id]; if(!item) continue;
          const price = item.marketPrice || item.suggestedPrice || 1;
          const have = State.inventory[id] || 0;
          lines.push(`<div class="carlos-row"><div class="ico" style="color:${item.color||'#e6ffee'};">${item.icon||''}</div><div class="meta"><div class="nm">${item.name}</div><div class="sub">${price}\u{1F948} each · you own: <b style="color:#fff1c2;">${have}</b></div></div><div class="qty"></div><button class="btn buy" data-id="${id}" data-price="${price}">BUY 1</button></div>`);
        }
      } else {
        intro.innerHTML = "Carlos buys for 70% of market price. He pays in 💵 cash.";
        for(const id of Object.keys(State.inventory || {})){
          const item = ITEMS[id]; if(!item) continue;
          const qty = State.inventory[id] || 0; if(qty <= 0) continue;
          const ref = item.marketPrice || item.suggestedPrice;
          if(!ref || item.isNFT) continue;
          const sellAt = Math.max(1, Math.floor(ref * 0.7));
          const sellAll = sellAt * qty;
          lines.push(`<div class="carlos-row"><div class="ico" style="color:${item.color||'#e6ffee'};">${item.icon||''}</div><div class="meta"><div class="nm">${item.name}</div><div class="sub">market ${ref}\u{1F948} · Carlos pays ${sellAt}\u{1F4B5}</div></div><div class="qty">×${qty}</div><div style="display:flex;gap:6px;"><button class="btn sell" data-id="${id}" data-price="${sellAt}">SELL 1</button><button class="btn sellall" data-id="${id}" data-price="${sellAt}" data-qty="${qty}" data-total="${sellAll}" title="Sell all ${qty} for ${sellAll} 💵">SELL ALL</button></div></div>`);
        }
      }
      host.innerHTML = lines.length ? lines.join("") : '<div class="carlos-empty">Nothing here right now.</div>';
      host.querySelectorAll('.btn.buy').forEach(b => b.addEventListener('click', () => {
        const id = b.dataset.id, price = Number(b.dataset.price) || 0;
        const name = window.ITEMS[id]?.name || id;
        // Always go through the silver/cash/fake selector so the player
        // can choose. Fake cash carries a 50% bust risk handled inside
        // openPaySelector.
        if(typeof window.openPaySelector === "function"){
          window.openPaySelector(`1 ${name}`, price, (asset) => {
            window.addItem(id, 1);
            const tag = asset === "credits" ? "🥈 silver" : (asset === "paper" ? "💵 cash" : "🪙 fake");
            const pop = document.getElementById('carlosPop');
            if(pop){
              pop.textContent = `-${price} ${tag} · +1 ${name}`;
              pop.classList.remove('show'); void pop.offsetWidth; pop.classList.add('show');
              clearTimeout(window._carlosPopT);
              window._carlosPopT = setTimeout(() => pop.classList.remove('show'), 2000);
            }
            window.playPurchaseSound?.(); window.saveState?.(); window.updateHUD?.(); renderCarlos();
          });
          return;
        }
        // Fallback: silver only
        if((State.credits || 0) < price){ window.floater?.(`Need ${price} \u{1F948}`, "bad"); return; }
        State.credits -= price; window.addItem(id, 1);
        window.playPurchaseSound?.(); window.saveState?.(); window.updateHUD?.(); renderCarlos();
      }));
      host.querySelectorAll('.btn.sell').forEach(b => b.addEventListener('click', () => {
        if(b.classList.contains('sellall')) return; // handled below
        const id = b.dataset.id, price = Number(b.dataset.price) || 0;
        if((State.inventory[id] || 0) <= 0) return;
        window.takeItem(id, 1);
        State.paper = (State.paper || 0) + price;
        _carlosTotal += price;
        const pop = document.getElementById('carlosPop');
        pop.textContent = `+${price} \u{1F4B5} · sold 1 ${window.ITEMS[id].name}`;
        pop.classList.remove('show'); void pop.offsetWidth; pop.classList.add('show');
        clearTimeout(window._carlosPopT); window._carlosPopT = setTimeout(() => pop.classList.remove('show'), 2000);
        document.getElementById('carlosRunning').innerHTML = `This visit: <b>${_carlosTotal} \u{1F4B5}</b>`;
        window.playPurchaseSound?.(); window.saveState?.(); window.updateHUD?.(); renderCarlos();
      }));
      host.querySelectorAll('.btn.sellall').forEach(b => b.addEventListener('click', () => {
        const id = b.dataset.id;
        const price = Number(b.dataset.price) || 0;
        const qty = Math.min(Number(b.dataset.qty) || 0, State.inventory[id] || 0);
        if(qty <= 0) return;
        const total = price * qty;
        window.takeItem(id, qty);
        State.paper = (State.paper || 0) + total;
        _carlosTotal += total;
        const pop = document.getElementById('carlosPop');
        pop.textContent = `+${total} \u{1F4B5} · sold ${qty}× ${window.ITEMS[id].name}`;
        pop.classList.remove('show'); void pop.offsetWidth; pop.classList.add('show');
        clearTimeout(window._carlosPopT); window._carlosPopT = setTimeout(() => pop.classList.remove('show'), 2000);
        document.getElementById('carlosRunning').innerHTML = `This visit: <b>${_carlosTotal} \u{1F4B5}</b>`;
        window.playPurchaseSound?.(); window.saveState?.(); window.updateHUD?.(); renderCarlos();
      }));
    }
    let _carlosTotal = 0;
    document.querySelectorAll('.ctab').forEach(btn => btn.addEventListener('click', () => {
      _carlosTab = btn.dataset.ctab;
      document.querySelectorAll('.ctab').forEach(b => {
        const a = (b === btn);
        b.style.color = a ? "#5ff09c" : "rgba(230,255,238,.55)";
        b.style.borderBottomColor = a ? "#5ff09c" : "transparent";
      });
      renderCarlos();
    }));
    function openCarlos(){
      _carlosTotal = 0; _carlosTab = "buy";
      document.querySelectorAll('.ctab').forEach((b, i) => {
        const a = (i === 0);
        b.style.color = a ? "#5ff09c" : "rgba(230,255,238,.55)";
        b.style.borderBottomColor = a ? "#5ff09c" : "transparent";
      });
      const r = document.getElementById('carlosRunning'); if(r) r.innerHTML = "This visit: <b>0 \u{1F4B5}</b>";
      const p = document.getElementById('carlosPop'); if(p) p.classList.remove('show');
      renderCarlos();
      document.getElementById('carlosBg').classList.add('show');
    }
    const popStyle = document.createElement('style');
    popStyle.textContent = `.npc-pop{position:fixed;left:50%;bottom:130px;transform:translateX(-50%);display:none;background:linear-gradient(180deg,rgba(8,18,11,.96),rgba(5,14,9,.96));border:2px solid rgba(95,240,156,.55);border-radius:14px;padding:12px 18px;z-index:50;text-align:center;font-family:'Outfit','Inter','JetBrains Mono',sans-serif;min-width:220px;box-shadow:0 14px 26px rgba(0,0,0,.55)}.npc-pop.show{display:block}.npc-pop .who{font-size:11px;color:rgba(230,255,238,.7);margin-bottom:5px;letter-spacing:.4px}.npc-pop .who b{color:#5ff09c}.npc-pop .line{font-family:'Outfit','Inter',sans-serif;font-size:14px;font-weight:700;color:#fff1c2;margin-bottom:8px;letter-spacing:.3px}.npc-pop .btn{background:rgba(95,240,156,.18);border:1px solid rgba(95,240,156,.55);color:#5ff09c;padding:8px 16px;border-radius:8px;font-family:'Outfit','Inter',sans-serif;font-weight:700;font-size:12px;letter-spacing:.6px;cursor:pointer}.npc-pop .btn:hover{background:rgba(95,240,156,.3)}`;
    document.head.appendChild(popStyle);
    const pop = document.createElement('div');
    pop.className = 'npc-pop';
    pop.innerHTML = '<div class="who"><b id="npcPopName">-</b> \u{1F5A8}</div><div class="line" id="npcPopLine">Talk to them...</div><div style="font-size:11px;color:rgba(230,255,238,.7);margin-bottom:8px;letter-spacing:.4px;">Press <kbd style="background:rgba(110,208,214,.22);border:1px solid rgba(110,208,214,.6);color:#a8e0ff;padding:2px 8px;border-radius:6px;font-family:\'JetBrains Mono\',monospace;font-size:11px;font-weight:700;">E</kbd> or click below</div><button class="btn" id="npcPopBtn">Open</button>';
    document.body.appendChild(pop);
    let nearNpc = null;
    function tryHandle(n){
      if(!n) return;
      if(n.kind === "market") openCarlos();
      else if(n.kind === "bank"){ const el = document.getElementById('bankBg'); if(el) el.classList.add('show'); }
      else if(n.kind === "dock"){
        // Wave's shop modal lives in seaplane.js — call it directly. If
        // it's not loaded yet, retry briefly instead of telling the user
        // to walk into the dock (we already ARE next to Wave).
        const tryOpen = (attempt) => {
          if(typeof window.openWaveShop === "function"){ window.openWaveShop(); return; }
          if(attempt < 8) setTimeout(() => tryOpen(attempt + 1), 200);
          else window.floater?.("Wave is loading — try again in a sec", "bad");
        };
        tryOpen(0);
      }
      else if(n.kind === "pawn"){ if(typeof window.openGary === "function") window.openGary(); else window.floater?.("Gary's shop loading...", "bad"); }
    }
    document.getElementById('npcPopBtn').addEventListener('click', () => { if(nearNpc) tryHandle(nearNpc); });
    setInterval(() => {
      let best = null, bestD = 5.5;
      for(const n of StaticNPCs){
        const d = Math.hypot(Player.pos.x - n.x, Player.pos.z - n.z);
        if(d < bestD){ bestD = d; best = n; }
      }
      nearNpc = best;
      const popEl = document.getElementById('npcPop');
      if(!popEl) return;
      if(best && best.kind !== 'dock'){
        // (Wave/dock excluded: the main module already shows the dock
        // prompt there — both at once made a double popup.)
        const nameEl = document.getElementById('npcPopName');
        if(nameEl) nameEl.textContent = best.name || '';
        const lines = { market: "Browse Carlos's stall", bank: "Visit Moneycaller", pawn: "Visit Gary's pawn shop" };
        const lineEl = document.getElementById('npcPopLine');
        if(lineEl) lineEl.textContent = lines[best.kind] || "Talk";
        popEl.classList.add('show');
      } else {
        popEl.classList.remove('show');
      }
    }, 250);
    window.addEventListener('keydown', (e) => {
      if(e.code !== 'KeyE') return;
      const a = document.activeElement;
      if(a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA')) return;
      if(nearNpc) tryHandle(nearNpc);
    });
    console.log('[static-npcs] ready · ' + StaticNPCs.length + ' NPCs');
  }
})();
