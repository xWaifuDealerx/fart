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
    function spawnPlane(){
      const mesh = buildPlane();
      // Pick a spot in front of the dock, on water
      const px = 82, pz = 14;
      const plane = {
        x: px, z: pz, y: WATER_LEVEL + 0.4, yaw: 0,
        speed: 0, vy: 0, mesh, occupied: false,
        flying: false,
      };
      mesh.position.set(px, plane.y, pz);
      mesh.rotation.y = 0;
      Planes.push(plane);
      window.floater?.("\u{1F6E9} Sea Plane spawned at the port", "good");
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
      // Lock player to plane position
      Player.boat = { isPlane: true, plane: p }; // re-use boat slot so movement system stops normal walk
      controls.classList.add('show');
    }
    function leave(){
      if(!myPlane) return;
      myPlane.occupied = false;
      myPlane = null;
      Player.boat = null;
      controls.classList.remove('show');
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
  <span><kbd>W</kbd> / <kbd>S</kbd></span><span>Throttle / Brake</span>
  <span><kbd>A</kbd> / <kbd>D</kbd></span><span>Yaw left / right</span>
  <span><kbd>SPACE</kbd></span><span>Climb</span>
  <span><kbd>SHIFT</kbd></span><span>Descend</span>
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
        // Throttle
        if(keys['KeyW']) p.speed += ACCEL * dt;
        if(keys['KeyS']) p.speed -= ACCEL * dt * 1.2;
        p.speed = Math.max(-2, Math.min(MAX_SPEED, p.speed * (keys['KeyW'] || keys['KeyS'] ? 1 : DRAG ** (dt * 60))));
        // Yaw
        if(keys['KeyA']) p.yaw += TURN_RATE * dt * (0.4 + Math.min(1, p.speed / TAKEOFF_SPEED) * 0.6);
        if(keys['KeyD']) p.yaw -= TURN_RATE * dt * (0.4 + Math.min(1, p.speed / TAKEOFF_SPEED) * 0.6);
        // Take off / land logic
        p.flying = p.speed > TAKEOFF_SPEED;
        if(p.flying){
          if(keys['Space'])     p.vy += PITCH_RATE * dt * 3;
          if(keys['ShiftLeft'] || keys['ShiftRight']) p.vy -= PITCH_RATE * dt * 3;
          // Gravity always pulls a bit when flying
          p.vy -= 1.2 * dt;
          p.vy = Math.max(-6, Math.min(6, p.vy));
          p.y += p.vy * dt;
          // Cap altitude
          p.y = Math.min(40, p.y);
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

    // ── Boarding / disembark via E ──
    window.addEventListener('keydown', (e) => {
      if(e.code !== "KeyE") return;
      const a = document.activeElement;
      if(a && (a.tagName === "INPUT" || a.tagName === "TEXTAREA")) return;
      if(myPlane){
        // disembark in place
        leave();
        window.floater?.("Stepped out of the plane", "good");
        return;
      }
      const near = findBoardable();
      if(near){
        board(near);
        window.floater?.("\u{1F6E9} Boarded — W to throttle, Space to climb", "good");
      }
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
    const wEl = document.createElement('div');
    wEl.innerHTML = '<div class="wave-bg" id="waveBg"><div class="wave-card"><h2>\u{1F5A8} Wave\'s Watercraft</h2><p>Pick your ride. Sea Plane spawns out on the water — board with <b>E</b> and take her up.</p><div class="row"><div class="ico">\u{26F5}</div><div><div class="nm">Tree Boat</div><div class="sub">200 \u{1F948} · simple paddle boat</div></div><button class="btn" id="waveBuyBoat">Buy</button></div><div class="row"><div class="ico">\u{1F6E9}</div><div><div class="nm">Sea Plane</div><div class="sub">'+PLANE_PRICE+' \u{1F948} · float-equipped — can take off + fly</div></div><button class="btn" id="waveBuyPlane">Buy</button></div><button class="cancel" id="waveCancel">Leave</button></div></div>';
    document.body.appendChild(wEl.firstElementChild);
    document.getElementById('waveCancel').addEventListener('click', () => document.getElementById('waveBg').classList.remove('show'));
    document.getElementById('waveBg').addEventListener('click', (e) => { if(e.target.id === "waveBg") document.getElementById('waveBg').classList.remove('show'); });
    document.getElementById('waveBuyBoat').addEventListener('click', () => {
      window.floater?.("Walk into the boat shop dock and press E", "good");
      document.getElementById('waveBg').classList.remove('show');
    });
    document.getElementById('waveBuyPlane').addEventListener('click', () => {
      if((State.credits || 0) < PLANE_PRICE){ window.floater?.(`Need ${PLANE_PRICE} \u{1F948}`, "bad"); return; }
      State.credits -= PLANE_PRICE;
      spawnPlane();
      window.showBuyToast?.(`Bought a Sea Plane for ${PLANE_PRICE} \u{1F948}`);
      window.playPurchaseSound?.();
      window.saveState?.();
      window.updateHUD?.();
      document.getElementById('waveBg').classList.remove('show');
    });
    window.openWaveShop = function(){ document.getElementById('waveBg').classList.add('show'); };

    console.log("[seaplane] Wave's plane shop + flight mechanic ready");
  }
})();
