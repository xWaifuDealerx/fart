// =================================================================
// rocket.js — launchpad + ride-to-space rocketship.
// =================================================================
// Empty spot at (24, -22): far enough from Carlos (-22, -33), the
// stats sign (-8, -16), and the trophy (-15, -45). Player walks up,
// presses E to board, then W to throttle, A/D to bank, Space to launch.
// =================================================================
(function(){
  'use strict';
  function whenReady(){
    if(!window.THREE || !window.scene || !window.Player || !window.groundHeightAt){
      setTimeout(whenReady, 300); return;
    }
    init();
  }
  whenReady();

  function init(){
    const THREE = window.THREE;
    const scene = window.scene;
    const Player = window.Player;
    const groundHeightAt = window.groundHeightAt;

    const PAD_POS = { x: 24, z: -22 };
    const groundY = groundHeightAt(PAD_POS.x, PAD_POS.z);

    // ── Launchpad: concrete circle, hazard ring, four support arms ──
    const padGrp = new THREE.Group();
    padGrp.position.set(PAD_POS.x, groundY, PAD_POS.z);
    const padMat   = new THREE.MeshStandardMaterial({ color: 0x6a6a72, roughness: 0.95 });
    const stripeM  = new THREE.MeshStandardMaterial({ color: 0xffce4a, roughness: 0.75 });
    const stripeD  = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.85 });
    // Big circular slab
    const pad = new THREE.Mesh(new THREE.CylinderGeometry(5.5, 5.5, 0.4, 24), padMat);
    pad.position.y = 0.2; pad.receiveShadow = true;
    padGrp.add(pad);
    // Hazard stripes around the rim
    for(let i = 0; i < 16; i++){
      const ang = (i / 16) * Math.PI * 2;
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(1.05, 0.05, 0.6), i % 2 ? stripeM : stripeD);
      stripe.position.set(Math.cos(ang) * 5.0, 0.42, Math.sin(ang) * 5.0);
      stripe.rotation.y = -ang;
      padGrp.add(stripe);
    }
    // Tower arms (gantry)
    const armMat = new THREE.MeshStandardMaterial({ color: 0xcc4f3a, roughness: 0.6 });
    for(let i = 0; i < 4; i++){
      const ang = (i / 4) * Math.PI * 2 + Math.PI / 4;
      const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.18, 4.0, 8), armMat);
      arm.position.set(Math.cos(ang) * 2.5, 2.0, Math.sin(ang) * 2.5);
      arm.castShadow = true;
      padGrp.add(arm);
      // Crossbar
      const bar = new THREE.Mesh(new THREE.BoxGeometry(0.10, 0.10, 1.0), armMat);
      bar.position.set(Math.cos(ang) * 1.6, 3.6, Math.sin(ang) * 1.6);
      bar.rotation.y = -ang;
      padGrp.add(bar);
    }
    // Floor sign
    const cvs = document.createElement('canvas');
    cvs.width = 512; cvs.height = 512;
    const ctx = cvs.getContext('2d');
    ctx.fillStyle = '#1a1a1a'; ctx.fillRect(0, 0, 512, 512);
    ctx.strokeStyle = '#ffce4a'; ctx.lineWidth = 8;
    ctx.strokeRect(20, 20, 472, 472);
    ctx.fillStyle = '#ffce4a';
    ctx.font = "900 96px 'Bangers','Orbitron',sans-serif";
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('LAUNCH', 256, 200);
    ctx.fillText('PAD', 256, 320);
    const tex = new THREE.CanvasTexture(cvs);
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(4.5, 4.5),
      new THREE.MeshStandardMaterial({ map: tex, roughness: 0.95 }));
    sign.position.y = 0.41; sign.rotation.x = -Math.PI / 2;
    padGrp.add(sign);
    scene.add(padGrp);

    // ── Rocketship: tapered white body + red nose + 4 fins + 3 thrusters ──
    const rocketGrp = new THREE.Group();
    rocketGrp.position.set(PAD_POS.x, groundY + 0.4, PAD_POS.z);
    const hullMat  = new THREE.MeshStandardMaterial({ color: 0xfafafa, roughness: 0.35, metalness: 0.3 });
    const stripeR  = new THREE.MeshStandardMaterial({ color: 0xff4a4a, roughness: 0.5 });
    const noseMat  = new THREE.MeshStandardMaterial({ color: 0xff4a4a, roughness: 0.4 });
    const winMat   = new THREE.MeshStandardMaterial({ color: 0x8fc8e8, transparent: true, opacity: 0.55, roughness: 0.2 });
    const thrustMat = new THREE.MeshStandardMaterial({ color: 0x4a4a52, roughness: 0.55, metalness: 0.55 });
    // Body
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 1.05, 5.5, 16), hullMat);
    body.position.y = 3.0; body.castShadow = true;
    rocketGrp.add(body);
    // Red ring stripe
    const ring = new THREE.Mesh(new THREE.CylinderGeometry(1.06, 1.06, 0.4, 16), stripeR);
    ring.position.y = 2.3;
    rocketGrp.add(ring);
    // Nose cone
    const nose = new THREE.Mesh(new THREE.ConeGeometry(0.85, 2.2, 16), noseMat);
    nose.position.y = 6.85; nose.castShadow = true;
    rocketGrp.add(nose);
    // Window
    const win = new THREE.Mesh(new THREE.SphereGeometry(0.35, 12, 10, 0, Math.PI * 2, 0, Math.PI / 2), winMat);
    win.position.set(0, 4.4, 0.85); win.rotation.x = Math.PI / 2;
    rocketGrp.add(win);
    // 4 fins
    for(let i = 0; i < 4; i++){
      const ang = (i / 4) * Math.PI * 2;
      const finShape = new THREE.Shape();
      finShape.moveTo(0, 0); finShape.lineTo(1.4, 0); finShape.lineTo(0.4, 1.4); finShape.lineTo(0, 0);
      const fin = new THREE.Mesh(new THREE.ExtrudeGeometry(finShape, { depth: 0.12, bevelEnabled: false }), stripeR);
      fin.rotation.y = -ang;
      fin.position.set(Math.cos(ang) * 0.9, 0.6, Math.sin(ang) * 0.9);
      fin.castShadow = true;
      rocketGrp.add(fin);
    }
    // Thrusters
    for(let i = 0; i < 3; i++){
      const ang = (i / 3) * Math.PI * 2;
      const thr = new THREE.Mesh(new THREE.CylinderGeometry(0.30, 0.40, 0.5, 10), thrustMat);
      thr.position.set(Math.cos(ang) * 0.55, 0.15, Math.sin(ang) * 0.55);
      rocketGrp.add(thr);
    }
    // Flame (hidden until launched)
    const flameMat = new THREE.MeshBasicMaterial({ color: 0xffae5a, transparent: true, opacity: 0.85 });
    const flame = new THREE.Mesh(new THREE.ConeGeometry(0.9, 2.8, 14), flameMat);
    flame.position.y = -1.2; flame.rotation.x = Math.PI;
    flame.visible = false;
    rocketGrp.add(flame);
    scene.add(rocketGrp);

    // ── Controls overlay ──
    const css = document.createElement('style');
    css.textContent = `
.rocket-ctrls{position:fixed;bottom:80px;left:50%;transform:translateX(-50%);display:none;background:linear-gradient(180deg,rgba(36,12,18,.96),rgba(20,4,8,.96));border:2px solid rgba(255,90,77,.6);border-radius:14px;padding:12px 18px;z-index:55;font-family:Outfit,JetBrains Mono,sans-serif;font-size:11px;color:#fff1c2;box-shadow:0 14px 30px rgba(0,0,0,.55)}
.rocket-ctrls.show{display:block}
.rocket-ctrls .ttl{font-family:Bangers,Orbitron,sans-serif;font-size:18px;color:#ffce4a;letter-spacing:1.4px;margin-bottom:8px;text-align:center}
.rocket-ctrls .grid{display:grid;grid-template-columns:auto auto;gap:5px 18px}
.rocket-ctrls kbd{background:rgba(255,206,74,.2);border:1px solid rgba(255,206,74,.5);border-radius:5px;padding:2px 7px;font-family:monospace;font-size:11px;color:#ffce4a;font-weight:700}
.rocket-ctrls .stat{margin-top:8px;text-align:center;color:rgba(230,255,238,.65);font-size:10.5px}
.rocket-ctrls .stat b{color:#ffce4a}
.rocket-pop{position:fixed;left:50%;bottom:160px;transform:translateX(-50%);display:none;background:linear-gradient(180deg,rgba(36,12,18,.96),rgba(20,4,8,.96));border:2px solid rgba(255,90,77,.6);border-radius:14px;padding:12px 22px;z-index:55;text-align:center;font-family:Outfit,sans-serif;box-shadow:0 14px 26px rgba(0,0,0,.55)}
.rocket-pop.show{display:block}
.rocket-pop .who{font-size:11px;color:rgba(255,241,194,.7);margin-bottom:5px}
.rocket-pop .line{font-family:Bangers,Orbitron,sans-serif;font-size:17px;color:#fff1c2;letter-spacing:.7px;margin-bottom:4px}
.rocket-pop kbd{background:rgba(255,206,74,.22);border:1px solid rgba(255,206,74,.6);color:#ffce4a;padding:2px 8px;border-radius:6px;font-family:monospace;font-size:12px;font-weight:700}
`;
    document.head.appendChild(css);
    const ctrls = document.createElement('div');
    ctrls.className = 'rocket-ctrls';
    ctrls.innerHTML = '<div class="ttl">\u{1F680} ROCKETSHIP</div><div class="grid">'
      + '<span><kbd>SPACE</kbd></span><span>Launch / Thrust up</span>'
      + '<span><kbd>SHIFT</kbd></span><span>Slow descent</span>'
      + '<span><kbd>A</kbd> / <kbd>D</kbd></span><span>Bank left / right</span>'
      + '<span><kbd>W</kbd> / <kbd>S</kbd></span><span>Pitch forward / back</span>'
      + '<span><kbd>E</kbd></span><span>Eject (instant return)</span>'
      + '</div><div class="stat">Altitude: <b id="rocketAlt">0</b> m · Speed: <b id="rocketSpd">0</b> m/s</div>';
    document.body.appendChild(ctrls);

    const pop = document.createElement('div');
    pop.className = 'rocket-pop';
    pop.innerHTML = '<div class="who">\u{1F680} Launch Pad</div><div class="line">Board the Rocketship</div><div>Press <kbd>E</kbd> to climb in</div>';
    document.body.appendChild(pop);

    // ── State ──
    const state = {
      onboard: false,
      altitude: 0,
      vy: 0,
      vx: 0, vz: 0,
      pitch: 0,
      roll: 0,
    };

    function board(){
      state.onboard = true;
      state.altitude = 0;
      state.vy = 0;
      state.vx = 0; state.vz = 0;
      Player.boat = { isRocket: true };
      try { const pm = (window.printer || window.Player?.mesh); if(pm) pm.visible = false; } catch(e){}
      flame.visible = false;
      ctrls.classList.add('show');
      pop.classList.remove('show');
      window.floater?.("\u{1F680} Boarded — Space to launch!", "good");
    }
    function eject(){
      if(!state.onboard) return;
      state.onboard = false;
      ctrls.classList.remove('show');
      // Bring rocket back down to pad gently
      rocketGrp.position.set(PAD_POS.x, groundY + 0.4, PAD_POS.z);
      rocketGrp.rotation.set(0, 0, 0);
      flame.visible = false;
      state.altitude = 0; state.vy = 0; state.vx = 0; state.vz = 0;
      // Drop the player at the pad
      Player.pos.x = PAD_POS.x + 5;
      Player.pos.z = PAD_POS.z;
      Player.pos.y = groundY;
      Player.yaw = 0;
      Player.vy = 0; Player.airborne = false;
      Player.boat = null;
      try { const pm = (window.printer || window.Player?.mesh); if(pm) pm.visible = true; } catch(e){}
      window.floater?.("Ejected back to the launch pad", "good");
    }
    // Expose the rocket mesh + eject so moon.js can detect collisions
    // and force an eject when the player crashes into the moon.
    window.rocketGrp = rocketGrp;
    // expose current altitude + whether you're flying it (moon.js reads these)
    window.rocketAltitude = function(){ return state.altitude; };
    window.rocketOnboard  = function(){ return !!state.onboard; };
    window.rocketEject = function(){
      if(!state.onboard) return;
      state.onboard = false;
      ctrls.classList.remove('show');
      flame.visible = false;
      state.altitude = 0; state.vy = 0; state.vx = 0; state.vz = 0;
      Player.boat = null;
      try { const pm = (window.printer || window.Player?.mesh); if(pm) pm.visible = true; } catch(e){}
      // Don't reset rocket position — let it stay where it crashed.
    };

    // Proximity popup + E to board/eject
    setInterval(() => {
      if(state.onboard){ pop.classList.remove('show'); return; }
      const d = Math.hypot(Player.pos.x - PAD_POS.x, Player.pos.z - PAD_POS.z);
      pop.classList.toggle('show', d < 7);
    }, 200);
    window.addEventListener('keydown', (e) => {
      if(e.code !== 'KeyE') return;
      const a = document.activeElement;
      if(a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA')) return;
      if(state.onboard){ eject(); return; }
      const d = Math.hypot(Player.pos.x - PAD_POS.x, Player.pos.z - PAD_POS.z);
      if(d < 7) board();
    });

    // ── Physics tick ──
    const THRUST = 45;     // m/s² upward when SPACE held — strong launch
    const GRAV   = 6.0;    // gentler gravity for a rocketship
    const SIDE   = 12;     // sideways accel
    const DRAG   = 0.93;
    const MAX_VY = 80;     // top vertical speed
    const MAX_H  = 25;     // top horizontal speed
    let last = performance.now();
    function tick(t){
      const dt = Math.min(0.05, (t - last) / 1000); last = t;
      if(state.onboard){
        const keys = window.keys || {};
        if(keys['Space']) state.vy += THRUST * dt;
        if(keys['ShiftLeft'] || keys['ShiftRight']) state.vy += THRUST * 0.4 * dt;  // gentle hover boost
        state.vy -= GRAV * dt;
        // Cap vy
        state.vy = Math.max(-MAX_VY, Math.min(MAX_VY, state.vy));
        // Sideways
        if(keys['KeyA']) state.vx -= SIDE * dt;
        if(keys['KeyD']) state.vx += SIDE * dt;
        if(keys['KeyW']) state.vz -= SIDE * dt;
        if(keys['KeyS']) state.vz += SIDE * dt;
        state.vx *= Math.pow(DRAG, dt * 60);
        state.vz *= Math.pow(DRAG, dt * 60);
        state.vx = Math.max(-MAX_H, Math.min(MAX_H, state.vx));
        state.vz = Math.max(-MAX_H, Math.min(MAX_H, state.vz));
        // Integrate
        state.altitude += state.vy * dt;
        rocketGrp.position.x += state.vx * dt;
        rocketGrp.position.z += state.vz * dt;
        // Don't sink below the pad
        if(state.altitude < 0){
          state.altitude = 0;
          if(state.vy < 0) state.vy = 0;
        }
        rocketGrp.position.y = groundY + 0.4 + state.altitude;
        // Roll / pitch visual
        const targetRoll  = (keys['KeyA'] ? 0.25 : keys['KeyD'] ? -0.25 : 0);
        const targetPitch = (keys['KeyW'] ? -0.18 : keys['KeyS'] ? 0.18 : 0);
        rocketGrp.rotation.z += (targetRoll  - rocketGrp.rotation.z) * Math.min(1, 4 * dt);
        rocketGrp.rotation.x += (targetPitch - rocketGrp.rotation.x) * Math.min(1, 4 * dt);
        // Flame visibility + jitter
        flame.visible = state.vy > -0.5 && (keys['Space'] || state.altitude > 0.5);
        if(flame.visible){
          flame.scale.y = 1 + Math.random() * 0.4;
          flame.scale.x = 0.85 + Math.random() * 0.3;
        }
        // Sync player to rocket cockpit (camera follows player)
        Player.pos.x = rocketGrp.position.x;
        Player.pos.z = rocketGrp.position.z;
        Player.pos.y = rocketGrp.position.y + 4.0;
        Player.yaw = 0;
        Player.walking = false;
        // HUD readouts
        const al = document.getElementById('rocketAlt'); if(al) al.textContent = Math.round(state.altitude);
        const sd = document.getElementById('rocketSpd'); if(sd) sd.textContent = Math.round(Math.hypot(state.vx, state.vy, state.vz));
      }
      requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);

    // Floating name tag for the pad
    tag.textContent = "Launch Pad";
    (document.getElementById('chatBubbles')?.parentElement || document.body).appendChild(tag);
    const _v = new THREE.Vector3();
    function nameTick(){
      _v.set(PAD_POS.x, groundY + 8, PAD_POS.z).project(window.camera);
      if(_v.z < 1){
        tag.style.left = ((_v.x * 0.5 + 0.5) * window.innerWidth) + 'px';
        tag.style.top  = ((1 - (_v.y * 0.5 + 0.5)) * window.innerHeight) + 'px';
        tag.style.display = 'block';
      } else {
        tag.style.display = 'none';
      }
      requestAnimationFrame(nameTick);
    }
    requestAnimationFrame(nameTick);

    console.log("[rocket] launchpad ready");
  }
})();
