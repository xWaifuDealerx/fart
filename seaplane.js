// =================================================================
// seaplane.js — Wave sells a Sea Plane that spawns on the water,
// boards on E, takes off when fast enough, then flies.
// =================================================================
// Controls:
//   W       — Throttle forward
//   S       — Brake
//   A / D   — Yaw left / right
//   Space   — Pitch up (climb)
//   Shift   — Pitch down (descend)
//   E       — Disembark (lands or splashes wherever you are)
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
    const WATER_LEVEL = window.WATER_LEVEL || 0;

    const PLANE_PRICE   = 600;       // silver
    const MAX_SPEED     = 18;        // m/s
    const TAKEOFF_SPEED = 6;
    const TURN_RATE     = 1.4;       // rad/s yaw
    const PITCH_RATE    = 0.8;       // m/s² altitude when Space/Shift held
    const ACCEL         = 6;
    const DRAG          = 0.92;

    const Planes = [];               // { x, z, y, yaw, speed, mesh, occupied }
    let myPlane = null;              // the plane the player is currently in

    // ── Build plane mesh ──
    function buildPlane(){
      const grp = new THREE.Group();
      // Fuselage (long box)
      const fuse = new THREE.Mesh(
        new THREE.BoxGeometry(0.8, 0.7, 3.4),
        new THREE.MeshStandardMaterial({ color: 0xffd64d, roughness: 0.45, metalness: 0.2 })
      );
      fuse.position.y = 1.3;
      fuse.castShadow = true;
      grp.add(fuse);
      // Tapered nose cone
      const nose = new THREE.Mesh(
        new THREE.ConeGeometry(0.4, 0.7, 8),
        new THREE.MeshStandardMaterial({ color: 0xffd64d, roughness: 0.45, metalness: 0.2 })
      );
      nose.position.set(0, 1.3, -2.0);
      nose.rotation.x = -Math.PI / 2;
      grp.add(nose);
      // Tail fin (vertical)
      const tail = new THREE.Mesh(
        new THREE.BoxGeometry(0.08, 0.9, 0.6),
        new THREE.MeshStandardMaterial({ color: 0xc89858, roughness: 0.5 })
      );
      tail.position.set(0, 2.0, 1.5);
      grp.add(tail);
      // Horizontal tail wings
      const htail = new THREE.Mesh(
        new THREE.BoxGeometry(1.6, 0.08, 0.5),
        new THREE.MeshStandardMaterial({ color: 0xc89858, roughness: 0.5 })
      );
      htail.position.set(0, 1.55, 1.5);
      grp.add(htail);
      // Main wings (one wide thin box)
      const wing = new THREE.Mesh(
        new THREE.BoxGeometry(5.6, 0.10, 1.0),
        new THREE.MeshStandardMaterial({ color: 0xffd64d, roughness: 0.5 })
      );
      wing.position.y = 1.75;
      wing.castShadow = true;
      grp.add(wing);
      // Wing struts (cosmetic)
      for(const sx of [-1.4, 1.4]){
        const strut = new THREE.Mesh(
          new THREE.CylinderGeometry(0.04, 0.04, 0.85, 6),
          new THREE.MeshStandardMaterial({ color: 0x444, roughness: 0.6 })
        );
        strut.position.set(sx, 1.0, 0);
        grp.add(strut);
      }
      // Two pontoons / floats underneath
      const floatMat = new THREE.MeshStandardMaterial({ color: 0xc8e0ff, roughness: 0.55 });
      for(const fx of [-0.7, 0.7]){
        const fl = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.32, 3.0), floatMat);
        fl.position.set(fx, 0.3, 0);
        fl.castShadow = true;
        grp.add(fl);
        // Tapered float nose
        const fn = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.5, 6), floatMat);
        fn.position.set(fx, 0.3, -1.7);
        fn.rotation.x = -Math.PI / 2;
        grp.add(fn);
      }
      // Propeller (just a disc — visual cue)
      const prop = new THREE.Mesh(
        new THREE.BoxGeometry(1.2, 0.06, 0.06),
        new THREE.MeshStandardMaterial({ color: 0x222 })
      );
      prop.position.set(0, 1.3, -2.35);
      grp.add(prop);
      grp.userData.prop = prop;
      // Cockpit dome
      const cock = new THREE.Mesh(
        new THREE.SphereGeometry(0.35, 12, 10, 0, Math.PI * 2, 0, Math.PI / 2),
        new THREE.MeshStandardMaterial({ color: 0x4a90c8, transparent: true, opacity: 0.5, roughness: 0.2 })
      );
      cock.position.set(0, 1.85, -0.2);
      grp.add(cock);
      scene.add(grp);
      return grp;
    }

    // ── Spawn a plane on water near Wave (he's at 82, 1.5) ──
    // Wave's dock is at the +X end of the island. Island radius is ~90,
    // so we walk outward from Wave's position until we find a tile whose
    // ground is clearly below the water (open sea). Yaw is set so the
    // nose points further out to give a clean takeoff runway.
    function spawnPlane(){
      const mesh = buildPlane();
      // Spawn the plane to the SIDE of the dock (north — at -Z) so it
      // isn't on top of the dock walkway. Dock is at (≈84, 0) extending
      // along +X to about x=90. Offset to z=-12 puts the plane clearly
      // in open water, ~12m off the side of the dock. Scan outward until
      // ground is at or below water level.
      let px = 90, pz = -12;
      for(let r = 85; r <= 200; r += 1){
        const candX = r, candZ = -12;
        const g = groundHeightAt(candX, candZ);
        if(g <= WATER_LEVEL - 0.5){ px = candX; pz = candZ; break; }
      }
      // The plane faces away from the island so W gives a long runway
      const yaw = -Math.PI / 2;  // nose pointing +X (away from island)
      const plane = {
        x: px, z: pz, y: WATER_LEVEL + 0.4, yaw,
        speed: 0, vy: 0, mesh, occupied: false,
        flying: false,
      };
      mesh.position.set(px, plane.y, pz);
      mesh.rotation.y = yaw;
      Planes.push(plane);
      window.floater?.("\u{1F6E9} Sea Plane spawned out at sea — board with E", "good");
      // (Yellow beacon pole removed — looked ugly poking out of the cockpit.)
      return plane;
    }

    // ── Boarding ──
    const PLANE_BOARD_RANGE = 6;
    function findBoardable(){
      let best = null, bestD = PLANE_BOARD_RANGE;
      for(const p of Planes){
        if(p.occupied) continue;
        const d = Math.hypot(p.x - Player.pos.x, p.z - Player.pos.z);
        if(d < bestD){ bestD = d; best = p; }
      }
      return best;
    }
    function board(p){
      p.occupied = true;
      myPlane = p;
      // Build a small seated-printer marker so the player has a visible
      // body inside the cockpit while the plane flies. Cloned once per
      // boarding so we don't accumulate meshes.
      if(!p._pilot){
        // Mini-printer that sits in the cockpit. Mirrors the main
        // printer model (box body + bezel + paper sheet + eyes + antenna)
        // so the seated pilot reads as a small printer, not a humanoid.
        const pilot = new THREE.Group();
        const bodyMat = new THREE.MeshStandardMaterial({ color: 0xe6ffee, roughness: 0.55 });
        const darkMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.6 });
        const eyeW    = new THREE.MeshStandardMaterial({ color: 0xffffff });
        const eyeB    = new THREE.MeshBasicMaterial({ color: 0x000000 });
        // Body box
        const body = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.46, 0.50), bodyMat);
        body.position.y = 1.62;
        body.castShadow = true;
        pilot.add(body);
        // Top bezel (where the paper feeds out)
        const bezel = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.04, 0.42), darkMat);
        bezel.position.y = 1.87;
        pilot.add(bezel);
        // Paper sheet sticking up from the bezel
        const paper = new THREE.Mesh(
          new THREE.PlaneGeometry(0.36, 0.30),
          new THREE.MeshStandardMaterial({ color: 0xffffff, side: THREE.DoubleSide, roughness: 0.95 })
        );
        paper.position.set(0, 1.92, -0.02);
        paper.rotation.x = -Math.PI / 2 + 0.35;
        pilot.add(paper);
        // Eyes — matching the player printer style (white sphere + black pupil)
        const eyeR = 0.075;
        const eL = new THREE.Mesh(new THREE.SphereGeometry(eyeR, 12, 12), eyeW);
        eL.position.set(-0.12, 1.70, 0.245);
        pilot.add(eL);
        const eR = eL.clone(); eR.position.x = 0.12; pilot.add(eR);
        const pL = new THREE.Mesh(new THREE.SphereGeometry(eyeR * 0.42, 8, 8), eyeB);
        pL.position.set(-0.12, 1.70, 0.32);
        pilot.add(pL);
        const pR = pL.clone(); pR.position.x = 0.12; pilot.add(pR);
        // Antenna with green orb (matches player)
        const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.18, 6), darkMat);
        ant.position.set(0.22, 1.97, 0);
        pilot.add(ant);
        const orb = new THREE.Mesh(
          new THREE.SphereGeometry(0.04, 8, 8),
          new THREE.MeshStandardMaterial({ color: 0x6ed0d6, emissive: 0x6ed0d6, emissiveIntensity: 1.4 })
        );
        orb.position.set(0.22, 2.07, 0);
        pilot.add(orb);
        pilot.position.set(0, 0, -0.2);   // sit at the cockpit
        p.mesh.add(pilot);
        p._pilot = pilot;
      }
      p._pilot.visible = true;
      // Lock player to plane position
      Player.boat = { isPlane: true, plane: p }; // re-use boat slot so movement system stops normal walk
      // Hide the player's own printer (named "printer" in main module) so we
      // don't render two bodies. Try both common references.
      try {
        const pm = (window.printer || window.Player?.mesh);
        if(pm) pm.visible = false;
      } catch(e){}
      controls.classList.add('show');
    }
    function leave(){
      if(!myPlane) return;
      const p = myPlane;
      if(p._pilot) p._pilot.visible = false;
      // Drop the player onto the dock to avoid the mid-air "blue sky" view.
      const dockX = (window.DOCK_POS && window.DOCK_POS.x) || 84;
      const dockZ = (window.DOCK_POS && window.DOCK_POS.z) || 0;
      // If we were over water near the plane, splash beside it; if we
      // were flying, port to the dock so we don't ragdoll mid-air.
      const wasFlying = p.flying;
      if(wasFlying){
        Player.pos.x = dockX;
        Player.pos.z = dockZ;
        Player.pos.y = (window.groundHeightAt?.(dockX, dockZ) ?? 0);
      } else {
        // Step out onto the water surface next to the plane
        Player.pos.x = p.x;
        Player.pos.z = p.z + 2.0;
        Player.pos.y = (window.WATER_LEVEL ?? 0);
      }
      Player.yaw = 0;
      Player.vy = 0;
      Player.airborne = false;
      // Re-show the player printer when stepping out
      try {
        const pm = (window.printer || window.Player?.mesh);
        if(pm) pm.visible = true;
      } catch(e){}
      p.occupied = false;
      myPlane = null;
      Player.boat = null;
      // Stop the plane in place
      p.speed = 0; p.vy = 0; p.flying = false;
      controls.classList.remove('show');
      window.floater?.("Stepped out of the plane", "good");
    }

    // ── Controls overlay ──
    const cs = document.createElement('style');
    cs.textContent = `
.plane-ctrls { position: fixed; bottom: 80px; left: 50%; transform: translateX(-50%); display: none; background: rgba(8,18,11,.85); border: 2px solid rgba(110,208,214,.55); border-radius: 14px; padding: 12px 18px; z-index: 50; font-family: 'JetBrains Mono',monospace; font-size: 11px; color: #e6ffee; box-shadow: 0 12px 30px rgba(0,0,0,.5); }
.plane-ctrls.show { display: block; }
.plane-ctrls .title { font-family: 'Bangers','Orbitron',sans-serif; font-size: 18px; letter-spacing: 1.4px; color: #6ed0d6; margin-bottom: 8px; text-align: center; }
.plane-ctrls .grid { display: grid; grid-template-columns: auto auto; gap: 4px 16px; }
.plane-ctrls kbd { background: rgba(110,208,214,.18); border: 1px solid rgba(110,208,214,.4); border-radius: 5px; padding: 2px 7px; font-family: monospace; font-size: 11px; color: #6ed0d6; }
.plane-ctrls .stat { text-align: center; margin-top: 8px; font-size: 10.5px; color: rgba(230,255,238,.55); }
.plane-ctrls .stat b { color: #ffd64d; font-family: 'Orbitron',sans-serif; }
`;
    document.head.appendChild(cs);
    const controls = document.createElement('div');
    controls.className = 'plane-ctrls';
    controls.innerHTML = `<div class="title">\u{1F6E9} SEA PLANE</div>
<div class="grid">
  <span><kbd>W</kbd> / <kbd>SHIFT</kbd></span><span>Throttle up</span>
  <span><kbd>S</kbd> / <kbd>CTRL</kbd></span><span>Brake</span>
  <span><kbd>A</kbd> / <kbd>D</kbd></span><span>Yaw left / right</span>
  <span><kbd>SPACE</kbd></span><span>Climb</span>
  <span><kbd>Z</kbd> / <kbd>↓</kbd></span><span>Dive</span>
  <span><kbd>E</kbd></span><span>Disembark</span>
</div>
<div class="stat">Speed: <b id="planeSpd">0</b> · Alt: <b id="planeAlt">0</b></div>`;
    document.body.appendChild(controls);

    // ── Per-frame plane physics ──
    let last = performance.now();
    function tick(t){
      const dt = Math.min(0.05, (t - last) / 1000);
      last = t;
      // Spin propellers for visual feedback
      for(const p of Planes){
        if(p.mesh?.userData?.prop){
          p.mesh.userData.prop.rotation.z += dt * (p.flying ? 30 : (p.speed > 0.2 ? 18 : 4));
        }
      }
      if(myPlane){
        const p = myPlane;
        const keys = window.keys || {};
        const throttleUp = keys['KeyW'] || keys['ShiftLeft'] || keys['ShiftRight'];
        const brake      = keys['KeyS'] || keys['ControlLeft'] || keys['ControlRight'];
        // Throttle
        if(throttleUp) p.speed += ACCEL * dt;
        if(brake)      p.speed -= ACCEL * dt * 1.2;
        p.speed = Math.max(-2, Math.min(MAX_SPEED, p.speed * (throttleUp || brake ? 1 : Math.pow(DRAG, dt * 60))));
        // Yaw — works in flight or on water; better with speed
        if(keys['KeyA']) p.yaw += TURN_RATE * dt * (0.4 + Math.min(1, Math.abs(p.speed) / TAKEOFF_SPEED) * 0.6);
        if(keys['KeyD']) p.yaw -= TURN_RATE * dt * (0.4 + Math.min(1, Math.abs(p.speed) / TAKEOFF_SPEED) * 0.6);
        // Take off / land logic — once airborne we stay airborne until
        // touching down, even if the player throttles off (real planes
        // glide). Use a 1m AGL buffer to decide ground contact.
        const groundY = (window.groundHeightAt?.(p.x, p.z) ?? -6);
        const overWater = groundY <= WATER_LEVEL + 0.1;
        if(!p.flying){
          // On water — take off when fast enough
          if(p.speed > TAKEOFF_SPEED && overWater) p.flying = true;
        } else {
          // Touch down when low and slow
          if(p.y <= WATER_LEVEL + 0.45 && p.speed < TAKEOFF_SPEED * 0.7){
            p.flying = false;
            p.vy = 0;
          }
        }
        if(p.flying){
          // ── Lift / gravity / glide model ──
          // Lift scales with current speed; gravity is constant. At cruise
          // speed lift roughly cancels gravity so the plane holds altitude.
          // At low speed, lift drops and the plane glides downward at a
          // gentle, recoverable rate (no hard fall).
          const lift = p.speed * 0.42;             // per m/s of speed
          const gravity = 3.4;
          let pitchInput = 0;
          if(keys['Space'])                    pitchInput += 1;   // climb
          if(keys['ArrowDown'] || keys['KeyZ']) pitchInput -= 1;  // dive
          p.vy += (lift - gravity + pitchInput * PITCH_RATE * 4) * dt;
          // Clamp + soft floor so a stalled plane glides instead of plummeting.
          p.vy = Math.max(-3.5, Math.min(8, p.vy));
          p.y += p.vy * dt;
          // Soft altitude cap
          p.y = Math.min(60, p.y);
          // Minimum altitude during flight — if we'd dip below water, glide
          // along just above it until we touch down properly.
          if(p.y < WATER_LEVEL + 0.4){
            p.y = WATER_LEVEL + 0.4;
            if(p.vy < 0) p.vy = 0;
          }
        } else {
          // On water — pin to water surface, no vertical movement
          p.y += (WATER_LEVEL + 0.4 - p.y) * Math.min(1, 5 * dt);
          p.vy = 0;
        }
        // Move forward in facing direction
        const nx = Math.sin(p.yaw);
        const nz = Math.cos(p.yaw);
        p.x -= nx * p.speed * dt;
        p.z -= nz * p.speed * dt;
        // Land check: if low enough AND over water, settle; if over land, bump
        if(!p.flying && groundHeightAt(p.x, p.z) > WATER_LEVEL + 0.2){
          // On land — block forward motion
          p.x += nx * p.speed * dt;
          p.z += nz * p.speed * dt;
          p.speed *= 0.5;
        }
        // Sync mesh + player
        p.mesh.position.set(p.x, p.y, p.z);
        p.mesh.rotation.y = p.yaw;
        // Slight roll while turning
        const roll = keys['KeyA'] ? 0.18 : keys['KeyD'] ? -0.18 : 0;
        p.mesh.rotation.z += (roll - p.mesh.rotation.z) * Math.min(1, 4 * dt);
        // Pitch up while climbing
        const pitch = (p.flying && keys['Space']) ? -0.18 : (p.flying && (keys['ShiftLeft'] || keys['ShiftRight'])) ? 0.18 : 0;
        p.mesh.rotation.x += (pitch - p.mesh.rotation.x) * Math.min(1, 3 * dt);
        Player.pos.x = p.x; Player.pos.z = p.z;
        Player.pos.y = p.y + 1.1;
        Player.yaw = p.yaw;
        Player.walking = false;
        // Update HUD readouts
        const sd = document.getElementById('planeSpd'); if(sd) sd.textContent = p.speed.toFixed(1);
        const al = document.getElementById('planeAlt'); if(al) al.textContent = (p.y - WATER_LEVEL).toFixed(1);
      }
      requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);

    // ── Proximity popup near plane / yacht (tells you to press E) ──
    const proxCSS = document.createElement('style');
    proxCSS.textContent = `.plane-prox{position:fixed;left:50%;bottom:160px;transform:translateX(-50%);display:none;background:linear-gradient(180deg,rgba(8,24,30,.96),rgba(4,14,18,.96));border:2px solid rgba(110,208,214,.6);border-radius:14px;padding:12px 22px;z-index:55;text-align:center;box-shadow:0 14px 26px rgba(0,0,0,.55);font-family:'Outfit','JetBrains Mono',sans-serif}
.plane-prox.show{display:block;animation:popInProx .25s cubic-bezier(.2,.7,.4,1)}
.plane-prox .who{font-size:11px;color:rgba(230,255,238,.7);margin-bottom:5px;letter-spacing:.4px}
.plane-prox .line{font-family:'Bangers','Orbitron',sans-serif;font-size:17px;color:#fff1c2;letter-spacing:.7px;margin-bottom:4px}
.plane-prox kbd{display:inline-block;background:rgba(110,208,214,.22);border:1px solid rgba(110,208,214,.6);color:#a8e0ff;padding:2px 8px;border-radius:6px;font-family:'JetBrains Mono',monospace;font-size:12px;font-weight:700;box-shadow:0 2px 0 rgba(0,0,0,.45)}
@keyframes popInProx{from{opacity:0;transform:translateX(-50%) translateY(8px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}`;
    document.head.appendChild(proxCSS);
    const proxEl = document.createElement('div');
    proxEl.className = 'plane-prox';
    proxEl.innerHTML = '<div class="who">\u{1F6E9} Sea Plane</div><div class="line" id="planeProxLine">Press <kbd>E</kbd> to board</div>';
    document.body.appendChild(proxEl);
    setInterval(() => {
      if(myPlane || myYacht){ proxEl.classList.remove('show'); return; }
      // If the player is at Wave's dock, the main module already shows
      // the green "WAVE'S DOCK · Press E" prompt — don't stack a second
      // plane prompt on top of it.
      if(window.nearbyDock){ proxEl.classList.remove('show'); return; }
      const pl = findBoardable();
      const yt = findBoardableYacht();
      if(pl){
        document.getElementById('planeProxLine').innerHTML = 'Press <kbd>E</kbd> to board the Sea Plane';
        proxEl.querySelector('.who').textContent = '\u{1F6E9} Sea Plane';
        proxEl.classList.add('show');
      } else if(yt){
        document.getElementById('planeProxLine').innerHTML = 'Press <kbd>E</kbd> to board the Yacht';
        proxEl.querySelector('.who').textContent = '\u{1F6A4} Luxury Yacht';
        proxEl.classList.add('show');
      } else {
        proxEl.classList.remove('show');
      }
    }, 200);
    // E-key handler — boards plane / yacht when nothing else captures it.
    window.addEventListener('keydown', (e) => {
      if(e.code !== 'KeyE') return;
      const a = document.activeElement;
      if(a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA')) return;
      // Already in a vessel — disembark.
      if(myPlane){ try { leave(); } catch(err){ console.error('[plane] leave failed', err); } return; }
      if(myYacht){ try { leaveYacht(); } catch(err){ console.error('[yacht] leave failed', err); } return; }
      // Don't board if a modal is showing — the modal owns the keys.
      const modalOpen = document.querySelector('.bank-bg.show, .stor-bg.show, .dc-bg.show, .est-bg.show, .junk-bg.show, .junk-choose-bg.show, .alex-pop.show, .wave-bg.show, .gary-bg.show, #invBg.show, #marketBg.show, #poopBg.show');
      if(modalOpen) return;
      const pl = findBoardable();
      if(pl){ try { board(pl); } catch(_){} return; }
      const yt = findBoardableYacht();
      if(yt){ try { boardYacht(yt); } catch(_){} return; }
    });

    // ── Wave's shop modal ──
    const ws = document.createElement('style');
    ws.textContent = `
.wave-bg { position: fixed; inset: 0; background: rgba(0,0,0,.78); backdrop-filter: blur(10px); display: none; align-items: center; justify-content: center; z-index: 67; padding: 20px; }
.wave-bg.show { display: flex; }
.wave-card { max-width: 440px; width: 100%; background: linear-gradient(180deg, rgba(8,24,30,.97), rgba(4,14,18,.97)); border: 2px solid rgba(110,208,214,.55); border-radius: 18px; padding: 20px 24px; }
.wave-card h2 { font-family: 'Bangers','Orbitron',sans-serif; font-size: 26px; letter-spacing: 2.2px; color: #6ed0d6; margin-bottom: 4px; }
.wave-card p { color: rgba(230,255,238,.7); font-size: 13px; line-height: 1.5; margin-bottom: 14px; }
.wave-card p b { color: #ffd64d; }
.wave-card .row { display: grid; grid-template-columns: 50px 1fr auto; gap: 12px; align-items: center; padding: 12px 14px; background: rgba(110,208,214,.07); border: 1px solid rgba(110,208,214,.25); border-radius: 12px; margin-bottom: 8px; }
.wave-card .row .ico { font-size: 28px; text-align: center; }
.wave-card .row .nm { font-family: 'Orbitron',sans-serif; font-weight: 800; font-size: 14px; color: #e6ffee; }
.wave-card .row .sub { font-family: 'JetBrains Mono',monospace; font-size: 10.5px; color: rgba(230,255,238,.55); margin-top: 2px; }
.wave-card .btn { background: linear-gradient(135deg, #6ed0d6, #a8e0ff); color: #061a1c; border: 0; padding: 10px 18px; border-radius: 100px; font-family: 'Orbitron',sans-serif; font-weight: 900; font-size: 12px; text-transform: uppercase; cursor: pointer; box-shadow: 0 6px 14px rgba(110,208,214,.36); }
.wave-card .cancel { width: 100%; background: transparent; border: 1px solid rgba(230,255,238,.25); color: rgba(230,255,238,.6); padding: 8px; border-radius: 100px; font-family: 'JetBrains Mono',monospace; font-size: 11px; cursor: pointer; margin-top: 6px; }
`;
    document.head.appendChild(ws);
    const YACHT_PRICE = 3500;
    // ── Yacht builder + spawn ──
    function buildYacht(){
      const grp = new THREE.Group();
      const hullMat = new THREE.MeshStandardMaterial({ color: 0xfafafa, roughness: 0.4, metalness: 0.15 });
      const trimMat = new THREE.MeshStandardMaterial({ color: 0x2030a0, roughness: 0.5 });
      const glassMat = new THREE.MeshStandardMaterial({ color: 0x8fc8e8, transparent: true, opacity: 0.55, roughness: 0.2 });
      const woodMat  = new THREE.MeshStandardMaterial({ color: 0x9a5a25, roughness: 0.75 });
      // Hull (large)
      const hull = new THREE.Mesh(new THREE.BoxGeometry(2.8, 1.0, 7.5), hullMat);
      hull.position.y = 0.7; hull.castShadow = true; grp.add(hull);
      // Bow taper (cone)
      const bow = new THREE.Mesh(new THREE.ConeGeometry(1.4, 1.6, 4), hullMat);
      bow.position.set(0, 0.7, -4.55);
      bow.rotation.x = -Math.PI / 2;
      bow.rotation.z = Math.PI / 4;
      grp.add(bow);
      // Blue trim line
      const trim = new THREE.Mesh(new THREE.BoxGeometry(2.85, 0.16, 7.55), trimMat);
      trim.position.y = 1.10; grp.add(trim);
      // Mid deck / cabin
      const cabin = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.85, 3.5), hullMat);
      cabin.position.set(0, 1.62, -0.5); grp.add(cabin);
      // Windows (just a coloured strip)
      const win = new THREE.Mesh(new THREE.BoxGeometry(2.21, 0.45, 3.0), glassMat);
      win.position.set(0, 1.75, -0.5); grp.add(win);
      // Upper bridge
      const bridge = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.6, 1.8), hullMat);
      bridge.position.set(0, 2.30, -0.8); grp.add(bridge);
      // Antenna / mast
      const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 2.2, 6), trimMat);
      mast.position.set(0, 3.5, -0.7); grp.add(mast);
      const mastBall = new THREE.Mesh(new THREE.SphereGeometry(0.10, 8, 8),
        new THREE.MeshStandardMaterial({ color: 0xff5060, emissive: 0xff5060, emissiveIntensity: 1.0 }));
      mastBall.position.set(0, 4.65, -0.7); grp.add(mastBall);
      // Aft deck with wooden floor
      const aft = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.08, 1.8), woodMat);
      aft.position.set(0, 1.22, 2.4); grp.add(aft);
      // Aft rails
      for(const dx of [-1.05, 1.05]){
        const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.8, 6), trimMat);
        rail.rotation.x = Math.PI / 2;
        rail.position.set(dx, 1.62, 2.4); grp.add(rail);
      }
      scene.add(grp);
      return grp;
    }
    const Yachts = [];
    let myYacht = null;
    function spawnYacht(){
      const mesh = buildYacht();
      let px = 130, pz = -10;
      for(let r = 110; r <= 220; r += 4){
        const g = groundHeightAt(r, -10);
        if(g <= WATER_LEVEL - 0.8){ px = r; pz = -10; break; }
      }
      const yacht = { x: px, z: pz, y: WATER_LEVEL + 0.15, yaw: -Math.PI / 2, speed: 0, mesh, occupied: false };
      mesh.position.set(px, yacht.y, pz);
      mesh.rotation.y = yacht.yaw;
      Yachts.push(yacht);
      try {
        const beacon = new THREE.Mesh(
          new THREE.SphereGeometry(0.30, 12, 12),
          new THREE.MeshStandardMaterial({ color: 0xff5060, emissive: 0xff5060, emissiveIntensity: 1.5 })
        );
        beacon.position.set(0, 5.6, 0);
        mesh.add(beacon);
      } catch(_){}
      window.floater?.("\u{1F6A4} Yacht spawned out at sea — board with E", "good");
      return yacht;
    }
    const YACHT_MAX = 9, YACHT_TURN = 1.0, YACHT_ACCEL = 4;
    let yachtLast = performance.now();
    function yachtTick(t){
      const dt = Math.min(0.05, (t - yachtLast) / 1000);
      yachtLast = t;
      if(myYacht){
        const y = myYacht;
        const keys = window.keys || {};
        if(keys['KeyW']) y.speed += YACHT_ACCEL * dt;
        if(keys['KeyS']) y.speed -= YACHT_ACCEL * dt * 1.4;
        y.speed = Math.max(-3, Math.min(YACHT_MAX, y.speed * (keys['KeyW']||keys['KeyS'] ? 1 : Math.pow(0.96, dt*60))));
        if(keys['KeyA']) y.yaw += YACHT_TURN * dt * (0.4 + Math.min(1, y.speed / YACHT_MAX) * 0.6);
        if(keys['KeyD']) y.yaw -= YACHT_TURN * dt * (0.4 + Math.min(1, y.speed / YACHT_MAX) * 0.6);
        const nx = Math.sin(y.yaw), nz = Math.cos(y.yaw);
        const oldX = y.x, oldZ = y.z;
        y.x -= nx * y.speed * dt;
        y.z -= nz * y.speed * dt;
        if(groundHeightAt(y.x, y.z) > WATER_LEVEL - 0.2){
          y.x = oldX; y.z = oldZ; y.speed *= 0.4;
        }
        y.y = WATER_LEVEL + 0.15 + Math.sin(t / 800) * 0.06;
        y.mesh.position.set(y.x, y.y, y.z);
        y.mesh.rotation.y = y.yaw;
        Player.pos.x = y.x; Player.pos.z = y.z;
        Player.pos.y = y.y + 1.6;
      }
      requestAnimationFrame(yachtTick);
    }
    requestAnimationFrame(yachtTick);
    function boardYacht(y){
      y.occupied = true; myYacht = y;
      Player.boat = { isYacht: true, yacht: y };
      // Hide the player printer so we don't render two bodies stacked.
      try { const pm = (window.printer || window.Player?.mesh); if(pm) pm.visible = false; } catch(e){}
      window.floater?.("Boarded the yacht — W to throttle, E to leave.", "good");
    }
    function leaveYacht(){
      if(!myYacht) return;
      const y = myYacht;
      // Drop the player onto the dock to avoid the mid-air / mid-sea
      // "blue sky" view. Same approach as the plane disembark.
      const dockX = (window.DOCK_POS && window.DOCK_POS.x) || 84;
      const dockZ = (window.DOCK_POS && window.DOCK_POS.z) || 0;
      Player.pos.x = dockX;
      Player.pos.z = dockZ;
      Player.pos.y = (window.groundHeightAt?.(dockX, dockZ) ?? 0);
      Player.yaw = 0;
      Player.vy = 0;
      Player.airborne = false;
      try { const pm = (window.printer || window.Player?.mesh); if(pm) pm.visible = true; } catch(e){}
      y.occupied = false;
      myYacht = null;
      Player.boat = null;
      y.speed = 0;
      // Reset rotation so the player isn't permanently looking up at the sky.
      Player.pitch = 0;
      Player.boatYaw = 0;
      window.floater?.("Stepped off the yacht — back on dry land", "good");
    }
    function findBoardableYacht(){
      for(const y of Yachts){
        if(y.occupied) continue;
        if(Math.hypot(y.x - Player.pos.x, y.z - Player.pos.z) < 7) return y;
      }
      return null;
    }

    // Persist ownership in localStorage so it survives reloads even when
    // the main game's saveState doesn't include the waveOwn field.
    const OWN_KEY = 'fw.waveOwn.v1';
    function loadOwn(){
      try {
        const raw = localStorage.getItem(OWN_KEY);
        if(raw) return Object.assign({ boat:false, plane:false, yacht:false }, JSON.parse(raw));
      } catch(e){}
      return { boat:false, plane:false, yacht:false };
    }
    function saveOwn(){
      try { localStorage.setItem(OWN_KEY, JSON.stringify(State.waveOwn)); } catch(e){}
    }
    // Merge persisted state with whatever State.waveOwn already has
    {
      const persisted = loadOwn();
      State.waveOwn = Object.assign(persisted, State.waveOwn || {});
      saveOwn();
    }

    const waveBg = document.createElement('div');
    waveBg.className = 'wave-bg';
    waveBg.id = 'waveBg';
    document.body.appendChild(waveBg);
    function closeWave(){ waveBg.classList.remove('show'); }
    // ─ EVENT DELEGATION ─ a single click listener on the modal bg
    // handles every Buy / Retrieve / Cancel button regardless of how
    const tryBuy = (cost, key, spawner, label) => {
      if(State.waveOwn[key]){
        window.floater?.("You already own that. Use Retrieve.", "bad");
        renderWave();
        return;
      }
      if((State.credits || 0) < cost){
        window.floater?.("Need " + cost + " \u{1F948}", "bad");
        return;
      }
      State.credits -= cost;
      State.waveOwn[key] = true;
      saveOwn();
      try { spawner(); } catch(err){
        console.error("[wave] spawn error", err);
        window.floater?.("Spawn glitched — try Retrieve.", "bad");
      }
      window.playPurchaseSound?.();
      window.saveState?.();
      window.updateHUD?.();
      window.floater?.(label + " purchased!", "good");
      closeWave();
    };
    const tryGet = (spawner, label) => {
      try { spawner(); } catch(err){ console.error("[wave] retrieve error", err); }
      window.floater?.(label + " ready at the dock!", "good");
      closeWave();
    };
    waveBg.addEventListener('click', (e) => {
      const t = e.target;
      if(!t) return;
      const id = t.id;
      if(id === "waveBg")        { closeWave(); return; }
      if(id === "waveCancel")    { closeWave(); return; }
      if(id === "waveBuyBoat")   { tryBuy(200, 'boat',
                                          () => { if(typeof window.spawnBoatNearPlayer === 'function'){ try { window.spawnBoatNearPlayer(); } catch(e){ console.error('[wave] boat spawn', e); } } else if(typeof window.spawnTreeBoat === 'function'){ window.spawnTreeBoat(); } },
                                          "\u{26F5} Tree Boat"); return; }
      if(id === "waveGetBoat")   { tryGet(() => { if(typeof window.spawnBoatNearPlayer === 'function'){ try { window.spawnBoatNearPlayer(); } catch(e){ console.error('[wave] boat spawn', e); } } else if(typeof window.spawnTreeBoat === 'function'){ window.spawnTreeBoat(); } },
                                          "\u{26F5} Boat"); return; }
      if(id === "waveBuyPlane")  { tryBuy(PLANE_PRICE, 'plane', () => spawnPlane(), "\u{1F6E9} Sea Plane"); return; }
      if(id === "waveGetPlane")  { tryGet(() => spawnPlane(), "\u{1F6E9} Sea Plane"); return; }
      if(id === "waveBuyYacht")  { tryBuy(YACHT_PRICE, 'yacht', () => spawnYacht(), "\u{1F6A4} Yacht"); return; }
      if(id === "waveGetYacht")  { tryGet(() => spawnYacht(), "\u{1F6A4} Yacht"); return; }
    });
    function renderWave(){
      const own = State.waveOwn || {};
      waveBg.innerHTML = '<div class="wave-card"><h2>\u{1F5A8} Wave’s Watercraft</h2><p>Pick your ride. Already bought one? Use Retrieve to bring it back.</p>'
        + '<div class="row"><div class="ico">\u{26F5}</div><div><div class="nm">Tree Boat</div><div class="sub">200 \u{1F948} · simple paddle boat</div></div>'
        + (own.boat ? '<button class="btn" id="waveGetBoat">Retrieve</button>' : '<button class="btn" id="waveBuyBoat">Buy</button>') + '</div>'
        + '<div class="row"><div class="ico">\u{1F6E9}</div><div><div class="nm">Sea Plane</div><div class="sub">' + PLANE_PRICE + ' \u{1F948} · float-equipped — takes off + flies</div></div>'
        + (own.plane ? '<button class="btn" id="waveGetPlane">Retrieve</button>' : '<button class="btn" id="waveBuyPlane">Buy</button>') + '</div>'
        + '<div class="row"><div class="ico">\u{1F6A4}</div><div><div class="nm">Yacht</div><div class="sub">' + YACHT_PRICE + ' \u{1F948} · floating palace</div></div>'
        + (own.yacht ? '<button class="btn" id="waveGetYacht">Retrieve</button>' : '<button class="btn" id="waveBuyYacht">Buy</button>') + '</div>'
        + '<button class="cancel" id="waveCancel">Leave</button>'
        + '</div>';
      const cancelBtn = document.getElementById('waveCancel');
      if(cancelBtn) cancelBtn.addEventListener('click', () => waveBg.classList.remove('show'));
    }
    function openWaveShop(){ renderWave(); waveBg.classList.add('show'); }
    function closeWave(){ waveBg.classList.remove('show'); }
    window.openWaveShop = openWaveShop;
    window.closeWaveShop = closeWave;
    waveBg.addEventListener('click', (e) => { if(e.target === waveBg) closeWave(); });
    console.log('[seaplane] ready');
  }
})();
