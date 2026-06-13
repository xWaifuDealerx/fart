// =================================================================
// moon.js — physical moon in the sky. Fly to it, crash, walk on it.
// =================================================================
// No warp screens. The moon is a real white shiny globe parked in the
// sky at (300, 220, -180). Fly the rocket close to it (< 22m of center)
// → "lunar landing": the rocket parks on the moon, player is placed on
// the walkable surface on top. There's a return pad with a ready rocket
// that takes you back to the Earth pad.
// =================================================================
(function(){
  'use strict';
  function whenReady(){
    if(!window.THREE || !window.scene || !window.Player){ setTimeout(whenReady, 300); return; }
    init();
  }
  whenReady();

  function init(){
    const THREE = window.THREE;
    const scene = window.scene;
    const Player = window.Player;

    // World position of the moon's center
    const MOON_POS = { x: 300, y: 220, z: -180 };
    const MOON_RADIUS = 35;
    const LAND_ZONE = MOON_RADIUS + 5;

    // ── Moon globe — white shiny sphere with faint craters ──
    function makeMoonTexture(s){
      const cvs = document.createElement('canvas'); cvs.width = s; cvs.height = s;
      const ctx = cvs.getContext('2d');
      // Soft cream-white base with subtle gradient
      const g = ctx.createRadialGradient(s/2, s/2, s*0.1, s/2, s/2, s*0.6);
      g.addColorStop(0, '#ffffff'); g.addColorStop(1, '#e8e2d4');
      ctx.fillStyle = g; ctx.fillRect(0, 0, s, s);
      // Crater patches
      for(let i = 0; i < 70; i++){
        const x = Math.random() * s, y = Math.random() * s, r = 2 + Math.random() * 8;
        ctx.fillStyle = `rgba(140,135,120,${0.20 + Math.random() * 0.25})`;
        ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
        // Highlight rim
        ctx.fillStyle = 'rgba(255,255,255,.30)';
        ctx.beginPath(); ctx.arc(x - r*0.3, y - r*0.3, r*0.4, 0, Math.PI * 2); ctx.fill();
      }
      return new THREE.CanvasTexture(cvs);
    }
    const moonTex = makeMoonTexture(512);
    const moon = new THREE.Mesh(
      new THREE.SphereGeometry(MOON_RADIUS, 48, 36),
      new THREE.MeshStandardMaterial({
        map: moonTex,
        emissive: 0xfff8e8, emissiveIntensity: 0.25,
        roughness: 0.35, metalness: 0.05,
      })
    );
    moon.position.set(MOON_POS.x, MOON_POS.y, MOON_POS.z);
    moon.castShadow = false; moon.receiveShadow = false;
    scene.add(moon);
    // Soft glow halo
    const halo = new THREE.Mesh(
      new THREE.SphereGeometry(MOON_RADIUS + 8, 28, 22),
      new THREE.MeshBasicMaterial({ color: 0xfff6e0, transparent: true, opacity: 0.10 })
    );
    halo.position.copy(moon.position);
    scene.add(halo);

    // ── Walkable surface on top of the moon ──
    // Disc sits on the +Y pole. It's parented to its own world-anchored
    // group so the WalkableSurfaces raycaster can find it without
    // intersecting the sphere directly.
    // ── The WALKABLE moon is its own area FAR from the spawn world, so the
    //    home island is well beyond the camera's far plane (1500) and you're
    //    surrounded only by the black starry dome — a real "other planet". ──
    // A big white "blank island" FAR from the spawn world. Kept at LOW Y
    // (below the floor-ray origin at y=40) so the player physics actually
    // latch onto it instead of falling through. The far X keeps the home
    // island beyond the camera far plane (1500) and the opaque star dome
    // hides everything else — a real empty moon copy of the world.
    const SURF = { x: 3000, y: 2, z: 0 };
    const ISLAND_R = (typeof window.ISLAND_RADIUS === 'number') ? window.ISLAND_RADIUS : 90;
    const SURFACE_Y = SURF.y + 2;             // top of the white ground slab
    const surface = new THREE.Mesh(
      new THREE.CylinderGeometry(ISLAND_R, ISLAND_R + 6, 4, 64),
      new THREE.MeshStandardMaterial({ color: 0xf2efe8, roughness: 0.96, flatShading: true })
    );
    surface.position.set(SURF.x, SURF.y, SURF.z);
    surface.receiveShadow = true;
    scene.add(surface);
    if(window.WalkableSurfaces) window.WalkableSurfaces.push(surface);
    // expose the moon surface so other modules (moondc.js) can place things on it
    window.fwMoonSurface = { x: SURF.x, y: SURFACE_Y, z: SURF.z, r: ISLAND_R };
    // Scatter shallow craters across the white surface
    for(let i = 0; i < 60; i++){
      const r = 2 + Math.random() * 7;
      const c = new THREE.Mesh(
        new THREE.CylinderGeometry(r, r * 1.2, 0.4, 14),
        new THREE.MeshStandardMaterial({ color: 0xdcd6ca, roughness: 0.97 })
      );
      const ang = Math.random() * Math.PI * 2;
      const dist = Math.random() * (ISLAND_R - 6);
      c.position.set(SURF.x + Math.cos(ang) * dist, SURFACE_Y + 0.02, SURF.z + Math.sin(ang) * dist);
      scene.add(c);
    }

    // ── "EARTH" rocket return pad on the moon surface ──
    const RETURN_PAD = { x: SURF.x + 12, y: SURFACE_Y + 0.1, z: SURF.z + 6 };
    const padG = new THREE.Group();
    padG.position.set(RETURN_PAD.x, RETURN_PAD.y, RETURN_PAD.z);
    const pSlab = new THREE.Mesh(new THREE.CylinderGeometry(4.0, 4.0, 0.3, 18),
      new THREE.MeshStandardMaterial({ color: 0x6a6a72, roughness: 0.9 }));
    pSlab.position.y = 0.15;
    padG.add(pSlab);
    if(window.WalkableSurfaces) window.WalkableSurfaces.push(pSlab);
    for(let i = 0; i < 12; i++){
      const ang = (i / 12) * Math.PI * 2;
      const m = i % 2 ? new THREE.MeshStandardMaterial({color:0xffce4a}) : new THREE.MeshStandardMaterial({color:0x111});
      const s = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.05, 0.45), m);
      s.position.set(Math.cos(ang) * 3.6, 0.32, Math.sin(ang) * 3.6);
      s.rotation.y = -ang;
      padG.add(s);
    }
    // Mini return rocket
    const rGrp = new THREE.Group();
    rGrp.position.y = 0.3;
    const rBody = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.85, 4.0, 16),
      new THREE.MeshStandardMaterial({ color: 0x4a8fd6, roughness: 0.4, metalness: 0.3 }));
    rBody.position.y = 2.3;
    rGrp.add(rBody);
    const rNose = new THREE.Mesh(new THREE.ConeGeometry(0.7, 1.5, 16),
      new THREE.MeshStandardMaterial({ color: 0xff4a4a }));
    rNose.position.y = 5.05;
    rGrp.add(rNose);
    for(let i = 0; i < 4; i++){
      const ang = (i / 4) * Math.PI * 2;
      const finShape = new THREE.Shape();
      finShape.moveTo(0, 0); finShape.lineTo(1.0, 0); finShape.lineTo(0.35, 1.0); finShape.lineTo(0, 0);
      const fin = new THREE.Mesh(new THREE.ExtrudeGeometry(finShape, { depth: 0.10, bevelEnabled: false }),
        new THREE.MeshStandardMaterial({ color: 0xff4a4a }));
      fin.rotation.y = -ang;
      fin.position.set(Math.cos(ang) * 0.75, 0.3, Math.sin(ang) * 0.75);
      rGrp.add(fin);
    }
    // Small "EARTH" sign
    (function(){
      const cvs = document.createElement('canvas');
      cvs.width = 256; cvs.height = 80;
      const ctx = cvs.getContext('2d');
      ctx.fillStyle = '#1a1a1a'; ctx.fillRect(0, 0, 256, 80);
      ctx.strokeStyle = '#a8e0ff'; ctx.lineWidth = 4; ctx.strokeRect(6, 6, 244, 68);
      ctx.fillStyle = '#a8e0ff';
      ctx.font = "900 36px 'Bangers',sans-serif";
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('\u{1F30D} TO EARTH', 128, 42);
      const tex = new THREE.CanvasTexture(cvs);
      const sign = new THREE.Mesh(new THREE.PlaneGeometry(3, 0.9),
        new THREE.MeshBasicMaterial({ map: tex }));
      sign.position.set(0, 6.2, 0);
      sign.rotation.x = -0.1;
      rGrp.add(sign);
    })();
    padG.add(rGrp);
    scene.add(padG);

    // ── Proximity popup at the moon return pad ──
    const css = document.createElement('style');
    css.textContent = `
.moon-prox{position:fixed;left:50%;bottom:170px;transform:translateX(-50%);display:none;background:linear-gradient(180deg,rgba(20,20,40,.96),rgba(8,8,18,.96));border:2px solid rgba(168,224,255,.6);border-radius:14px;padding:12px 22px;z-index:55;text-align:center;color:#fff1c2;font-family:Outfit,sans-serif;box-shadow:0 14px 26px rgba(0,0,0,.55)}
.moon-prox.show{display:block}
.moon-prox .who{font-size:11px;color:rgba(168,224,255,.7);margin-bottom:5px}
.moon-prox .line{font-family:Bangers,Orbitron,sans-serif;font-size:17px;color:#fff;letter-spacing:.7px;margin-bottom:4px}
.moon-prox kbd{background:rgba(168,224,255,.22);border:1px solid rgba(168,224,255,.6);color:#a8e0ff;padding:2px 8px;border-radius:6px;font-family:monospace;font-size:12px;font-weight:700}
.moon-banner{position:fixed;top:32%;left:50%;transform:translate(-50%,-50%);display:none;background:rgba(8,8,18,.85);border:2px solid rgba(255,206,74,.8);border-radius:18px;padding:16px 26px;z-index:55;text-align:center;color:#fff;font-family:Bangers,Orbitron,sans-serif;font-size:24px;letter-spacing:2px;box-shadow:0 0 40px rgba(255,206,74,.4)}
.moon-banner.show{display:block;animation:moonB .4s cubic-bezier(.2,.7,.4,1)}
@keyframes moonB{from{transform:translate(-50%,-50%) scale(.85);opacity:0}to{transform:translate(-50%,-50%) scale(1);opacity:1}}
`;
    document.head.appendChild(css);
    const proxEl = document.createElement('div');
    proxEl.className = 'moon-prox';
    proxEl.innerHTML = '<div class="who">\u{1F30D} Return Pad</div><div class="line">Fly home to Earth</div><div>Press <kbd>E</kbd> to launch home</div>';
    document.body.appendChild(proxEl);
    const banner = document.createElement('div');
    banner.className = 'moon-banner';
    document.body.appendChild(banner);
    function showBanner(t, ms){
      banner.textContent = t;
      banner.classList.add('show');
      clearTimeout(window._moonBT);
      window._moonBT = setTimeout(() => banner.classList.remove('show'), ms || 2400);
    }

    let onMoon = false;
    Player.onMoon = false;

    // ── Starry-sky dome (only visible while you're ON the moon) ──
    const starDome = (function(){
      const cvs = document.createElement('canvas'); cvs.width = 1024; cvs.height = 512;
      const ctx = cvs.getContext('2d');
      ctx.fillStyle = '#05060f'; ctx.fillRect(0, 0, 1024, 512);
      for(let i = 0; i < 900; i++){
        const x = Math.random() * 1024, y = Math.random() * 512, r = Math.random() * 1.3;
        ctx.fillStyle = 'rgba(255,255,255,' + (0.4 + Math.random() * 0.6) + ')';
        ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
      }
      for(let i = 0; i < 40; i++){
        const x = Math.random() * 1024, y = Math.random() * 512;
        ctx.fillStyle = '#cfe6ff';
        ctx.beginPath(); ctx.arc(x, y, 1.5 + Math.random() * 1.2, 0, Math.PI * 2); ctx.fill();
      }
      const tex = new THREE.CanvasTexture(cvs);
      // opaque black dome → black starry sky in every direction, no fog so it
      // never washes out. Sits over the far surface; from the spawn world it's
      // beyond the camera far plane, so it's only ever seen on the moon.
      const dome = new THREE.Mesh(new THREE.SphereGeometry(320, 40, 28),
        new THREE.MeshBasicMaterial({ map: tex, side: THREE.BackSide, fog: false, depthWrite: false }));
      dome.position.set(SURF.x, SURF.y, SURF.z);
      dome.visible = true;
      scene.add(dome);
      // a soft fill light so the white surface reads well under the dark sky
      const moonLight = new THREE.DirectionalLight(0xdfe8ff, 0.7);
      moonLight.position.set(SURF.x + 60, SURF.y + 120, SURF.z + 40);
      scene.add(moonLight);
      return dome;
    })();

    // ── "Enter Moon" button — appears once the rocket passes 1000 m ──
    const enterBtn = document.createElement('button');
    enterBtn.id = 'moonEnterBtn';
    enterBtn.textContent = '\u{1F319} Enter Moon';
    enterBtn.style.cssText =
      'position:fixed;left:50%;top:38%;transform:translateX(-50%);display:none;z-index:56;cursor:pointer;' +
      'font-family:Bangers,Orbitron,sans-serif;font-size:26px;letter-spacing:2px;color:#06122a;' +
      'background:linear-gradient(135deg,#cfe6ff,#a8e0ff);border:2px solid #fff;border-radius:14px;' +
      'padding:14px 30px;box-shadow:0 0 36px rgba(168,224,255,.7),0 10px 24px rgba(0,0,0,.5);' +
      'animation:moonB .5s cubic-bezier(.2,.7,.4,1)';
    document.body.appendChild(enterBtn);

    function enterMoon(){
      if(onMoon) return;
      onMoon = true; Player.onMoon = true;
      try { if(window.rocketEject) window.rocketEject(); } catch(_){}
      Player.pos.x = SURF.x - 6; Player.pos.z = SURF.z; Player.pos.y = SURFACE_Y + 1.3;
      Player.yaw = 0; Player.vy = 0; Player.airborne = false;
      try { const pm = (window.printer || window.Player?.mesh); if(pm) pm.visible = true; } catch(_){}
      enterBtn.style.display = 'none';
      showBanner('\u{1F319} WELCOME TO THE MOON', 2800);
    }
    enterBtn.addEventListener('click', enterMoon);
    window.fwEnterMoon = enterMoon;
    // ENTER key also triggers the button when it's showing
    window.addEventListener('keydown', (e) => {
      if((e.code === 'Enter' || e.code === 'NumpadEnter') && enterBtn.style.display !== 'none' && !onMoon){
        const a = document.activeElement;
        if(a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA')) return;
        e.preventDefault(); enterMoon();
      }
    }, true);

    // ── Lunar landing detection — uses the rocket's world position ──
    // Looks for the rocket mesh exposed via window.rocketGrp (set in
    // rocket.js below); if missing we just skip.
    function rocketWorldPos(){
      if(window.rocketGrp) return window.rocketGrp.position;
      return null;
    }
    setInterval(() => {
      // Land on moon: rocket near moon center
      if(!onMoon){
        if(Player.boat && Player.boat.isRocket){
          const rp = rocketWorldPos();
          if(rp){
            const dx = rp.x - MOON_POS.x, dy = rp.y - MOON_POS.y, dz = rp.z - MOON_POS.z;
            const d = Math.sqrt(dx*dx + dy*dy + dz*dz);
            if(d < LAND_ZONE){
              // Crash landing: eject onto the moon disc
              onMoon = true; Player.onMoon = true;
              if(typeof window.rocketEject === 'function') window.rocketEject();
              // Teleport player onto the far moon surface
              Player.pos.x = SURF.x - 6;
              Player.pos.z = SURF.z;
              Player.pos.y = SURFACE_Y + 1.3;
              Player.yaw = 0; Player.vy = 0; Player.airborne = false;
              try { const pm = (window.printer || window.Player?.mesh); if(pm) pm.visible = true; } catch(e){}
              showBanner('\u{1F31A} LUNAR LANDING!', 2800);
              window.dispatchEvent(new CustomEvent('fw:milestone', { detail: { kind: 'moon_landing', label: 'reached the Moon' } }));
            }
          }
        }
      }
      // Show return pad proximity popup when on moon
      if(onMoon){
        const d = Math.hypot(Player.pos.x - RETURN_PAD.x, Player.pos.z - RETURN_PAD.z);
        proxEl.classList.toggle('show', d < 5);
        enterBtn.style.display = 'none';
      } else {
        proxEl.classList.remove('show');
        // "Enter Moon" button appears once the rocket climbs past 1000 m
        const onb = (typeof window.rocketOnboard === 'function') ? window.rocketOnboard() : !!(Player.boat && Player.boat.isRocket);
        const alt = (typeof window.rocketAltitude === 'function') ? window.rocketAltitude() : 0;
        enterBtn.style.display = (onb && alt >= 1000) ? 'block' : 'none';
      }
    }, 150);

    // E at return pad → teleport to Earth pad
    window.addEventListener('keydown', (e) => {
      if(e.code !== 'KeyE' || !onMoon) return;
      const a = document.activeElement;
      if(a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA')) return;
      const d = Math.hypot(Player.pos.x - RETURN_PAD.x, Player.pos.z - RETURN_PAD.z);
      if(d < 5){
        onMoon = false; Player.onMoon = false;
        Player.pos.x = 28; Player.pos.z = -22;
        Player.pos.y = (window.groundHeightAt?.(28, -22) ?? 0);
        Player.yaw = 0; Player.vy = 0; Player.airborne = false;
        showBanner('\u{1F30D} HOME ON EARTH', 2200);
      }
    });

    // Low gravity vertical decay while on the moon (gentle floaty falls)
    setInterval(() => {
      if(onMoon && Player.airborne && Player.vy < 0) Player.vy *= 0.94;
    }, 30);

    console.log('[moon] real moon at', MOON_POS, '— fly the rocket close and crash to land');
  }
})();
