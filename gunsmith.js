// =================================================================
// gunsmith.js — Gunsmith shop, Desert Eagle, ammo, and spider enemies
// =================================================================
// • New building "Gunsmith" with a clerk NPC ("Smitty").
// • Modal sells:
//     - Desert Eagle (500 silver, one-shot kill on spiders)
//     - .50AE Ammo (50 silver per 12-round box)
// • Once the player owns at least 1 Desert Eagle, spiders begin to
//   spawn on the island. They walk toward the player, knock them
//   back if they reach contact, and die in one shot.
// • Left-click anywhere in the 3D view fires the equipped gun if
//   ammo > 0. Bullets travel forward from the camera and only hit
//   spider entities (NPCs, players, and buildings are immune).
// =================================================================
(function(){
  'use strict';
  function whenReady(){
    if(!window.THREE || !window.scene || !window.Player || !window.State || !window.groundHeightAt || !window.ITEMS){
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
    const ITEMS = window.ITEMS;
    const groundHeightAt = window.groundHeightAt;
    const WATER_L = window.WATER_LEVEL || 0;
    const ISLAND_R = window.ISLAND_RADIUS || 95;

    // ── Items ──
    if(!ITEMS.deagle){
      ITEMS.deagle = {
        id: 'deagle',
        name: 'Desert Eagle',
        icon: '\u{1F52B}',
        color: '#c0a060',
        type: 'weapon',
        isNFT: false,
        suggestedPrice: 500,
        marketPrice: 500,
      };
    }
    if(!ITEMS.ammo_deagle){
      ITEMS.ammo_deagle = {
        id: 'ammo_deagle',
        name: '.50 AE Ammo (12)',
        icon: '\u{1F4A5}',
        color: '#b89060',
        type: 'ammo',
        isNFT: false,
        suggestedPrice: 50,
        marketPrice: 50,
        stackBundle: 12,
      };
    }

    // ── Building ──
    const SHOP_POS = { x: 35, z: -70 };
    const SHOP_R = 5;
    function buildShop(){
      const grp = new THREE.Group();
      const y0 = groundHeightAt(SHOP_POS.x, SHOP_POS.z);
      grp.position.set(SHOP_POS.x, y0, SHOP_POS.z);
      const wallMat  = new THREE.MeshStandardMaterial({ color: 0x4a3a25, roughness: 0.85 });
      const trimMat  = new THREE.MeshStandardMaterial({ color: 0x6a4a2a, roughness: 0.7 });
      const roofMat  = new THREE.MeshStandardMaterial({ color: 0x2a1a10, roughness: 0.9 });
      const metalMat = new THREE.MeshStandardMaterial({ color: 0xa08060, metalness: 0.7, roughness: 0.35 });
      // Floor pad
      const base = new THREE.Mesh(new THREE.BoxGeometry(6.0, 0.3, 4.6), trimMat);
      base.position.y = 0.15; base.receiveShadow = true;
      grp.add(base);
      window.WalkableSurfaces?.push(base);
      // Walls
      const body = new THREE.Mesh(new THREE.BoxGeometry(5.4, 3.0, 4.0), wallMat);
      body.position.y = 1.7; body.castShadow = true; grp.add(body);
      // Trim around top
      const ledge = new THREE.Mesh(new THREE.BoxGeometry(5.7, 0.18, 4.2), trimMat);
      ledge.position.y = 3.30;
      grp.add(ledge);
      // Sloped roof
      const roof = new THREE.Mesh(new THREE.BoxGeometry(6.0, 0.2, 4.4), roofMat);
      roof.position.y = 3.55;
      grp.add(roof);
      // Door
      const door = new THREE.Mesh(new THREE.BoxGeometry(1.0, 1.9, 0.05), new THREE.MeshStandardMaterial({ color: 0x2a1a08, roughness: 0.85 }));
      door.position.set(0, 1.15, 2.02);
      grp.add(door);
      // Window
      const win = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.8, 0.05), new THREE.MeshStandardMaterial({ color: 0xa8c8e0, transparent: true, opacity: 0.55, roughness: 0.2 }));
      win.position.set(-1.7, 2.0, 2.02);
      grp.add(win);
      // Hanging gun silhouette on front (just a cosmetic strip)
      const accent = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.15, 0.04), metalMat);
      accent.position.set(1.6, 1.6, 2.02);
      grp.add(accent);
      // Sign canvas
      const cvs = document.createElement('canvas');
      cvs.width = 560; cvs.height = 130;
      const ctx = cvs.getContext('2d');
      ctx.fillStyle = '#1a0a04'; ctx.fillRect(0, 0, 560, 130);
      ctx.strokeStyle = '#c0a060'; ctx.lineWidth = 4;
      ctx.strokeRect(4, 4, 552, 122);
      ctx.fillStyle = '#ffce4a';
      ctx.font = "900 64px 'Bangers','Orbitron',sans-serif";
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('GUNSMITH', 280, 68);
      const tex = new THREE.CanvasTexture(cvs);
      tex.anisotropy = 4;
      const sign = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 0.95),
        new THREE.MeshStandardMaterial({ map: tex, emissive: 0xc0a060, emissiveIntensity: 0.35, roughness: 0.55, side: THREE.DoubleSide }));
      sign.position.set(0, 4.0, 2.05);
      grp.add(sign);
      scene.add(grp);
      return grp;
    }
    try { buildShop(); } catch(e){ console.error('[gunsmith] build', e); }

    // ── Clerk NPC "Smitty" ──
    function buildSmitty(){
      const grp = new THREE.Group();
      const x = SHOP_POS.x - 1.2, z = SHOP_POS.z - 1.5;
      grp.position.set(x, groundHeightAt(x, z), z);
      grp.rotation.y = 0;
      const tint = 0xb89060;
      const bodyMat = new THREE.MeshStandardMaterial({ color: tint, roughness: 0.55 });
      const darkMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.6 });
      const eyeW = new THREE.MeshStandardMaterial({ color: 0xffffff });
      const eyeB = new THREE.MeshBasicMaterial({ color: 0x000000 });
      const body = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.95, 1.1), bodyMat);
      body.position.y = 1.4; body.castShadow = true; grp.add(body);
      const bezel = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.07, 0.95), darkMat);
      bezel.position.y = 1.91; grp.add(bezel);
      // Eyes
      const eyeR = 0.18;
      const eL = new THREE.Mesh(new THREE.SphereGeometry(eyeR, 12, 12), eyeW);
      eL.position.set(-0.28, 1.6, 0.55); grp.add(eL);
      const eR2 = eL.clone(); eR2.position.x = 0.28; grp.add(eR2);
      const pL = new THREE.Mesh(new THREE.SphereGeometry(eyeR * 0.4, 10, 10), eyeB);
      pL.position.set(-0.28, 1.6, 0.72); grp.add(pL);
      const pR = pL.clone(); pR.position.x = 0.28; grp.add(pR);
      // Cowboy hat
      const hatBrim = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.04, 16), new THREE.MeshStandardMaterial({ color: 0x4a2a10, roughness: 0.85 }));
      hatBrim.position.y = 2.04; grp.add(hatBrim);
      const hatTop = new THREE.Mesh(new THREE.CylinderGeometry(0.30, 0.30, 0.32, 14), new THREE.MeshStandardMaterial({ color: 0x4a2a10, roughness: 0.85 }));
      hatTop.position.y = 2.22; grp.add(hatTop);
      // Floating "Smitty" name tag removed per request.
      scene.add(grp);
      return { mesh: grp, tag: null, x, z };
    }
    const smitty = buildSmitty();

    // Name tag projection
    const _v = new THREE.Vector3();
    function projectTag(){
      try {
        if(!smitty.tag) return;   // name tag removed
        if(!window.camera) return;
        _v.set(smitty.x, groundHeightAt(smitty.x, smitty.z) + 2.7, smitty.z).project(window.camera);
        if(_v.z < 1){
          smitty.tag.style.display = 'block';
          smitty.tag.style.left = ((_v.x * 0.5 + 0.5) * window.innerWidth) + 'px';
          smitty.tag.style.top  = ((1 - (_v.y * 0.5 + 0.5)) * window.innerHeight) + 'px';
        } else {
          smitty.tag.style.display = 'none';
        }
      } catch(_){}
    }

    // ── Shop modal ──
    const css = document.createElement('style');
    css.textContent = `
.gs-bg{position:fixed;inset:0;display:none;align-items:center;justify-content:center;background:rgba(0,0,0,.78);backdrop-filter:blur(10px);z-index:200;padding:16px}
.gs-bg.show{display:flex}
.gs-card{background:linear-gradient(180deg,rgba(28,18,8,.97),rgba(18,10,4,.97));border:2px solid rgba(192,160,96,.55);border-radius:18px;max-width:460px;width:100%;color:#fff1c2;font-family:'Outfit','Inter',sans-serif;box-shadow:0 0 40px rgba(192,160,96,.18)}
.gs-head{display:flex;justify-content:space-between;align-items:center;padding:18px 22px;border-bottom:1px solid rgba(192,160,96,.18)}
.gs-head h2{font-family:'Bangers','Orbitron',sans-serif;font-size:28px;color:#ffce4a;letter-spacing:2px;margin:0}
.gs-head .x{background:transparent;border:0;color:rgba(255,241,194,.6);font-size:24px;cursor:pointer}
.gs-body{padding:18px 22px}
.gs-row{display:grid;grid-template-columns:50px 1fr auto;gap:12px;align-items:center;padding:12px 14px;background:rgba(192,160,96,.08);border:1px solid rgba(192,160,96,.28);border-radius:12px;margin-bottom:10px}
.gs-row .ico{font-size:28px;text-align:center}
.gs-row .nm{font-family:'Outfit',sans-serif;font-weight:800;font-size:14px;color:#ffd64d}
.gs-row .sub{font-family:'JetBrains Mono',monospace;font-size:10.5px;color:rgba(230,255,238,.55);margin-top:2px}
.gs-row .btn{background:linear-gradient(135deg,#ffce4a,#fff1c2);color:#2a1408;border:0;padding:9px 16px;border-radius:100px;font-family:'Orbitron',sans-serif;font-weight:900;font-size:11px;text-transform:uppercase;cursor:pointer}
.gs-row .btn:disabled{filter:grayscale(.7);cursor:not-allowed;opacity:.6}
.gs-row .owned{font-family:'JetBrains Mono',monospace;font-size:10.5px;color:#5ff09c}
.gs-foot{padding:12px 22px 18px;font-size:11px;color:rgba(230,255,238,.55);text-align:center;line-height:1.5}
`;
    document.head.appendChild(css);
    const bg = document.createElement('div');
    bg.id = 'gsBg';
    bg.className = 'gs-bg';
    bg.innerHTML = ''
      + '<div class="gs-card">'
      + '  <div class="gs-head"><h2>\u{1F52B} GUNSMITH</h2><button class="x" id="gsX">×</button></div>'
      + '  <div class="gs-body" id="gsBody"></div>'
      + '  <div class="gs-foot">Click anywhere in the world to fire the Desert Eagle. Each shot uses 1 round.</div>'
      + '</div>';
    document.body.appendChild(bg);
    document.getElementById('gsX').addEventListener('click', () => bg.classList.remove('show'));
    bg.addEventListener('click', (e) => { if(e.target === bg) bg.classList.remove('show'); });

    function render(){
      const body = document.getElementById('gsBody');
      if(!body) return;
      const haveGun = (State.inventory?.deagle || 0) > 0;
      const ammo = State.inventory?.ammo_deagle || 0;
      body.innerHTML = ''
        + '<div class="gs-row">'
        + '  <div class="ico">\u{1F52B}</div>'
        + '  <div><div class="nm">Desert Eagle .50AE</div><div class="sub">500 \u{1F948} · one-shot kill on spiders</div></div>'
        + (haveGun
            ? '<div class="owned">✓ OWNED</div>'
            : '<button class="btn" id="gsBuyGun">Buy</button>')
        + '</div>'
        + '<div class="gs-row">'
        + '  <div class="ico">\u{1F4A5}</div>'
        + '  <div><div class="nm">.50 AE Ammo Box</div><div class="sub">50 \u{1F948} · 12 rounds · you have ' + ammo + '</div></div>'
        + '  <button class="btn" id="gsBuyAmmo">Buy</button>'
        + '</div>';
      const g = document.getElementById('gsBuyGun');
      if(g){
        g.addEventListener('click', () => {
          if((State.credits || 0) < 500){ window.floater?.("Need 500 \u{1F948}", "bad"); return; }
          State.credits -= 500;
          window.addItem('deagle', 1);
          // First-time purchase: give 6 free starter rounds so the player
          // can immediately try shooting.
          if((State.inventory.ammo_deagle || 0) === 0){
            window.addItem('ammo_deagle', 6);
          }
          State.gunsmithUnlocked = true;
          window.floater?.("\u{1F52B} Desert Eagle acquired", "good");
          window.playPurchaseSound?.();
          window.saveState?.();
          window.updateHUD?.();
          render();
        });
      }
      document.getElementById('gsBuyAmmo')?.addEventListener('click', () => {
        if((State.credits || 0) < 50){ window.floater?.("Need 50 \u{1F948}", "bad"); return; }
        State.credits -= 50;
        window.addItem('ammo_deagle', 12);
        window.floater?.("+12 rounds", "good");
        window.playPurchaseSound?.();
        window.saveState?.();
        window.updateHUD?.();
        render();
      });
    }
    function openShop(){ render(); bg.classList.add('show'); }
    window.openGunsmith = openShop;

    // ── Proximity prompt ──
    const popCss = document.createElement('style');
    popCss.textContent = ".gs-pop{position:fixed;left:50%;bottom:130px;transform:translateX(-50%);display:none;background:linear-gradient(180deg,rgba(24,14,4,.96),rgba(14,8,2,.96));border:2px solid rgba(255,206,74,.6);border-radius:14px;padding:12px 18px;z-index:50;text-align:center;font-family:'Outfit','Inter',sans-serif}.gs-pop.show{display:block}.gs-pop .who{font-size:11px;color:#ffce4a;margin-bottom:5px;letter-spacing:.4px}.gs-pop .line{font-family:'Bangers',sans-serif;font-size:16px;color:#fff1c2;letter-spacing:.6px;margin-bottom:8px}.gs-pop kbd{background:rgba(255,206,74,.22);border:1px solid rgba(255,206,74,.55);color:#ffce4a;padding:2px 8px;border-radius:6px;font-family:'JetBrains Mono',monospace;font-size:11px;font-weight:700}.gs-pop .btn{background:rgba(255,206,74,.18);border:1px solid rgba(255,206,74,.55);color:#ffce4a;padding:7px 14px;border-radius:8px;font-family:'Outfit',sans-serif;font-weight:700;font-size:12px;cursor:pointer;margin-top:4px}";
    document.head.appendChild(popCss);
    const pop = document.createElement('div');
    pop.className = 'gs-pop';
    pop.innerHTML = '<div class="who">\u{1F52B} Smitty</div><div class="line">Visit the Gunsmith</div><div>Press <kbd>E</kbd> or click below</div><button class="btn" id="gsPopBtn">Browse Weapons</button>';
    document.body.appendChild(pop);
    document.getElementById('gsPopBtn').addEventListener('click', openShop);

    let nearShop = false;
    setInterval(() => {
      const d = Math.hypot(Player.pos.x - SHOP_POS.x, Player.pos.z - SHOP_POS.z);
      nearShop = d < SHOP_R;
      pop.classList.toggle('show', nearShop);
      projectTag();
    }, 250);

    window.addEventListener('keydown', (e) => {
      if(e.code !== 'KeyE') return;
      const a = document.activeElement;
      if(a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA')) return;
      if(!nearShop) return;
      if(document.querySelector('.gs-bg.show, .bank-bg.show, .junk-bg.show, .est-bg.show, .stor-bg.show, .dc-bg.show, .alex-pop.show, .wave-bg.show, .gary-bg.show, #invBg.show, #marketBg.show, #poopBg.show, .fc-bg.show, .carlos-bg.show')) return;
      openShop();
    });

    // Add Gunsmith to minimap as a landmark
    try {
      if(window.MinimapLandmarks){
        window.MinimapLandmarks.push({ x: SHOP_POS.x, z: SHOP_POS.z, label: 'Gunsmith', color: '#ffce4a' });
      }
    } catch(_){}

    // ─────────────────────────────────────────────────────────────
    // SPIDERS
    // ─────────────────────────────────────────────────────────────
    const Spiders = [];
    // Expose for extras-v6ba's bite-damage system — it reads
    // window.Spiders; without this line spider bites never actually
    // damaged the player's HP bar.
    window.Spiders = Spiders;
    const MAX_SPIDERS = 3;
    const SPIDER_SPEED = 1.6;        // m/s
    const SPIDER_KNOCKBACK = 4;      // m/s burst
    const SPIDER_CONTACT_R = 1.2;    // contact radius

    function buildSpider(){
      const grp = new THREE.Group();
      const blackMat = new THREE.MeshStandardMaterial({ color: 0x0a0a0a, roughness: 0.4 });
      const redMat   = new THREE.MeshBasicMaterial({ color: 0xff2a2a });
      // Body (two segments)
      const abdomen = new THREE.Mesh(new THREE.SphereGeometry(0.42, 14, 12), blackMat);
      abdomen.scale.set(1, 0.8, 1.2);
      abdomen.position.set(0, 0.55, -0.25);
      abdomen.castShadow = true;
      grp.add(abdomen);
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.28, 12, 10), blackMat);
      head.position.set(0, 0.55, 0.35);
      head.castShadow = true;
      grp.add(head);
      // Eyes
      const e1 = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 8), redMat);
      e1.position.set(-0.13, 0.65, 0.6); grp.add(e1);
      const e2 = e1.clone(); e2.position.x = 0.13; grp.add(e2);
      // 8 legs as bent cylinders (4 per side)
      const legs = [];
      for(let i = 0; i < 4; i++){
        for(const side of [-1, 1]){
          const upper = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.55, 6), blackMat);
          const ang = (i - 1.5) * 0.55;
          upper.rotation.z = side * (Math.PI/2 - 0.35);
          upper.rotation.x = ang * 0.5;
          upper.position.set(side * 0.28, 0.55, -0.15 + i * 0.20 - 0.30);
          // shift outward
          upper.position.x += side * 0.18;
          grp.add(upper);
          legs.push(upper);
        }
      }
      return { mesh: grp, legs };
    }

    function spiderSpawn(){
      if(Spiders.length >= MAX_SPIDERS) return;
      if(!(State.inventory?.deagle > 0)) return;
      // Spawn at random distance 30-50m from player, near grass.
      for(let tries = 0; tries < 30; tries++){
        const ang = Math.random() * Math.PI * 2;
        const r = 30 + Math.random() * 20;
        const sx = Player.pos.x + Math.cos(ang) * r;
        const sz = Player.pos.z + Math.sin(ang) * r;
        if(Math.hypot(sx, sz) >= ISLAND_R - 4) continue;
        const gh = groundHeightAt(sx, sz);
        if(gh < WATER_L + 0.2) continue;
        const s = buildSpider();
        s.mesh.position.set(sx, gh, sz);
        scene.add(s.mesh);
        Spiders.push({
          mesh: s.mesh,
          legs: s.legs,
          x: sx, z: sz, y: gh,
          yaw: 0,
          legPhase: Math.random() * Math.PI * 2,
          dead: false,
        });
        window.floater?.("\u{1F578}\u{FE0F} A spider appears...", "bad");
        return;
      }
    }

    // ── Spider safe zones ──
    // Buildings the player can hide inside — spiders flee any time they
    // get close. Each entry is { x, z, r } where r is the flee radius.
    // The hotel and every apartment count, so the player can use them
    // as panic rooms.
    const SAFE_ZONES = [
      { x: -64, z: 18,  r: 10 },  // Hotel
      { x: 15,  z: -71, r: 8  },  // Soviet apartment
      { x: -11, z: 37,  r: 8  },  // Middle apartment
      { x: -13, z: 75,  r: 8  },  // Luxury penthouse
    ];
    function nearestSafeZone(x, z){
      let best = null, bestPen = -Infinity;
      for(const zn of SAFE_ZONES){
        const d = Math.hypot(zn.x - x, zn.z - z);
        const pen = zn.r - d;          // positive when inside flee radius
        if(pen > bestPen){ bestPen = pen; best = { zn, d, pen }; }
      }
      return best && best.pen > 0 ? best : null;
    }

    // Spider tick
    let lastT = performance.now();
    function tick(){
      const now = performance.now();
      let dt = (now - lastT) / 1000; if(dt > 0.1) dt = 0.1; lastT = now;
      for(let i = Spiders.length - 1; i >= 0; i--){
        const s = Spiders[i];
        if(s.dead) continue;
        let dx = Player.pos.x - s.x;
        let dz = Player.pos.z - s.z;
        let d  = Math.hypot(dx, dz);
        // If the spider has entered a safe-zone (hotel / apartment),
        // it instantly reverses course and sprints away from the zone
        // centre instead of chasing the player. The flee speed is a
        // little higher than normal chase so it visibly bolts.
        const flee = nearestSafeZone(s.x, s.z);
        if(flee){
          dx = s.x - flee.zn.x;
          dz = s.z - flee.zn.z;
          d  = Math.hypot(dx, dz);
        }
        if(d > 0.0001){
          s.yaw = Math.atan2(dx, dz);
          const speed = flee
            ? SPIDER_SPEED * 1.6
            : (d < SPIDER_CONTACT_R ? 0 : SPIDER_SPEED);
          s.x += (dx / d) * speed * dt;
          s.z += (dz / d) * speed * dt;
        }
        // clamp to island
        if(Math.hypot(s.x, s.z) >= ISLAND_R - 2){
          const a = Math.atan2(s.z, s.x);
          s.x = Math.cos(a) * (ISLAND_R - 2);
          s.z = Math.sin(a) * (ISLAND_R - 2);
        }
        s.y = groundHeightAt(s.x, s.z);
        s.mesh.position.set(s.x, s.y, s.z);
        s.mesh.rotation.y = s.yaw;
        // Leg shuffle
        s.legPhase += dt * 8;
        for(let li = 0; li < s.legs.length; li++){
          s.legs[li].rotation.y = Math.sin(s.legPhase + li * 0.7) * 0.25;
        }
        // Contact knockback — use the real player-to-spider delta, not
        // the flee delta we may have swapped in above. Skip entirely
        // while the spider is in a safe zone so the player can chill.
        if(!flee){
          const pdx = Player.pos.x - s.x;
          const pdz = Player.pos.z - s.z;
          const pd  = Math.hypot(pdx, pdz);
          if(pd < SPIDER_CONTACT_R){
            const k = SPIDER_KNOCKBACK * dt * 8;
            Player.pos.x += (-pdx / Math.max(0.01, pd)) * k;
            Player.pos.z += (-pdz / Math.max(0.01, pd)) * k;
            // Red screen flash instead of the old "Bumped!" floater —
            // throttled so continuous contact doesn't strobe.
            const nowFx = performance.now();
            if(!s._lastBumpFx || nowFx - s._lastBumpFx > 350){
              s._lastBumpFx = nowFx;
              const fl = document.getElementById('flash');
              if(fl){ fl.classList.add('bad'); setTimeout(() => fl.classList.remove('bad'), 90); }
            }
          }
        }
      }
      requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);

    // Periodic spawn — only once the player owns at least 1 Desert Eagle.
    setInterval(() => {
      if(!(State.inventory?.deagle > 0)) return;
      // Don't spawn while inside a vessel or modal — feels unfair.
      if(Player.boat || Player.airborne) return;
      if(document.querySelector('.gs-bg.show, .bank-bg.show, #invBg.show, #marketBg.show, .carlos-bg.show')) return;
      // Random delay (this interval ticks every 5s, only fires ~once per attempt)
      if(Math.random() < 0.18) spiderSpawn();
    }, 5000);

    // ── Held gun model ──
    let heldGun = null;
    function buildHeldGun(){
      const grp = new THREE.Group();
      const metal = new THREE.MeshStandardMaterial({ color: 0xa08060, metalness: 0.8, roughness: 0.35 });
      const grip = new THREE.MeshStandardMaterial({ color: 0x2a1a08, roughness: 0.85 });
      // Slide
      const slide = new THREE.Mesh(new THREE.BoxGeometry(0.10, 0.10, 0.42), metal);
      slide.position.set(0, 0.04, 0.15);
      grp.add(slide);
      // Barrel tip
      const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.10, 10), metal);
      barrel.rotation.x = Math.PI / 2;
      barrel.position.set(0, 0.04, 0.40);
      grp.add(barrel);
      // Grip
      const gripM = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.18, 0.10), grip);
      gripM.position.set(0, -0.10, 0.05);
      grp.add(gripM);
      // Trigger guard
      const tg = new THREE.Mesh(new THREE.TorusGeometry(0.04, 0.012, 6, 10, Math.PI), metal);
      tg.rotation.x = Math.PI / 2;
      tg.position.set(0, -0.04, 0.10);
      grp.add(tg);
      // Swap in the GLB Desert Eagle when it loads (keep procedural as a
      // fallback). The group is re-positioned/rotated each frame in
      // tickHeldGun, so we only need to replace the visual children.
      if(window.FWModels){
        window.FWModels.get('deserteagle').then(model => {
          while(grp.children.length) grp.remove(grp.children[0]);
          grp.add(model);
        }).catch(() => {});
      }
      return grp;
    }
    function tickHeldGun(){
      const have = (State.inventory?.deagle || 0) > 0;
      const printer = window.printer || window.Player?.mesh;
      if(!printer){ requestAnimationFrame(tickHeldGun); return; }
      if(have){
        if(!heldGun){ heldGun = buildHeldGun(); scene.add(heldGun); }
        // Place at right side of printer, slightly forward
        const yaw = printer.rotation.y || 0;
        const off = { x: 0.85, y: 1.10, z: 0.55 };
        const cs = Math.cos(yaw), sn = Math.sin(yaw);
        const wx = off.x * cs + off.z * sn;
        const wz = -off.x * sn + off.z * cs;
        heldGun.position.set(printer.position.x + wx, printer.position.y + off.y, printer.position.z + wz);
        heldGun.rotation.y = yaw;
      } else if(heldGun){
        scene.remove(heldGun);
        heldGun = null;
      }
      requestAnimationFrame(tickHeldGun);
    }
    requestAnimationFrame(tickHeldGun);

    // ── Audio ──
    let audioCtx = null;
    function getCtx(){
      if(!audioCtx){
        try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch(_){ return null; }
      }
      if(audioCtx.state === 'suspended'){ try { audioCtx.resume(); } catch(_){} }
      return audioCtx;
    }
    function gunshotSound(){
      const ctx = getCtx(); if(!ctx) return;
      const now = ctx.currentTime;
      // Sharp transient — noise burst + low thud
      const dur = 0.22;
      const noiseBuf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * dur), ctx.sampleRate);
      const ch = noiseBuf.getChannelData(0);
      for(let i = 0; i < ch.length; i++){
        const t = i / ch.length;
        ch[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, 2.8);
      }
      const noise = ctx.createBufferSource(); noise.buffer = noiseBuf;
      const noiseFilt = ctx.createBiquadFilter();
      noiseFilt.type = 'bandpass'; noiseFilt.frequency.value = 1200; noiseFilt.Q.value = 0.8;
      const noiseGain = ctx.createGain();
      noiseGain.gain.setValueAtTime(0.55, now);
      noiseGain.gain.exponentialRampToValueAtTime(0.0001, now + dur);
      noise.connect(noiseFilt).connect(noiseGain).connect(ctx.destination);
      noise.start(now); noise.stop(now + dur);
      // Sub thud
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(150, now);
      osc.frequency.exponentialRampToValueAtTime(30, now + 0.18);
      const oscG = ctx.createGain();
      oscG.gain.setValueAtTime(0.6, now);
      oscG.gain.exponentialRampToValueAtTime(0.0001, now + 0.20);
      osc.connect(oscG).connect(ctx.destination);
      osc.start(now); osc.stop(now + 0.22);
      // .50AE supersonic CRACK — sharp high-passed snap on top
      const crackDur = 0.06;
      const cBuf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * crackDur), ctx.sampleRate);
      const cch = cBuf.getChannelData(0);
      for(let i = 0; i < cch.length; i++){
        const t = i / cch.length;
        cch[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, 1.6);
      }
      const crack = ctx.createBufferSource(); crack.buffer = cBuf;
      const cFilt = ctx.createBiquadFilter();
      cFilt.type = 'highpass'; cFilt.frequency.value = 2800;
      const cGain = ctx.createGain();
      cGain.gain.setValueAtTime(0.5, now);
      cGain.gain.exponentialRampToValueAtTime(0.0001, now + crackDur);
      crack.connect(cFilt).connect(cGain).connect(ctx.destination);
      crack.start(now); crack.stop(now + crackDur);
      // Distant echo slap (the big-bore "boom rolling over the island")
      const eBuf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.28), ctx.sampleRate);
      const ech = eBuf.getChannelData(0);
      for(let i = 0; i < ech.length; i++){
        const t = i / ech.length;
        ech[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, 3.2);
      }
      const echo = ctx.createBufferSource(); echo.buffer = eBuf;
      const eFilt = ctx.createBiquadFilter();
      eFilt.type = 'lowpass'; eFilt.frequency.value = 900;
      const eGain = ctx.createGain();
      eGain.gain.setValueAtTime(0.16, now + 0.10);
      eGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.38);
      echo.connect(eFilt).connect(eGain).connect(ctx.destination);
      echo.start(now + 0.10); echo.stop(now + 0.38);
    }
    function dryFireSound(){
      const ctx = getCtx(); if(!ctx) return;
      const now = ctx.currentTime;
      // Brief click — short hi-freq tick
      const osc = ctx.createOscillator();
      osc.type = 'square';
      osc.frequency.setValueAtTime(1800, now);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0, now);
      g.gain.linearRampToValueAtTime(0.18, now + 0.005);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.06);
      osc.connect(g).connect(ctx.destination);
      osc.start(now); osc.stop(now + 0.08);
    }

    // ── Crosshair — follows the mouse so the player can aim freely. ──
    let mouseX = window.innerWidth / 2, mouseY = window.innerHeight / 2;
    window.addEventListener('mousemove', (e) => {
      // Under pointer lock the cursor is captive — aim through the
      // virtual aim cursor from controls.js (dynamic in third person,
      // centred in FPS), falling back to screen centre.
      if(document.pointerLockElement){
        const a = window.FWAim;
        mouseX = a ? a.x : window.innerWidth / 2;
        mouseY = a ? a.y : window.innerHeight / 2;
        return;
      }
      mouseX = e.clientX; mouseY = e.clientY;
    });
    document.addEventListener('pointerlockchange', () => {
      if(document.pointerLockElement){
        const a = window.FWAim;
        mouseX = a ? a.x : window.innerWidth / 2;
        mouseY = a ? a.y : window.innerHeight / 2;
      }
    });
    const crosshair = document.createElement('div');
    crosshair.id = 'gsCrosshair';
    crosshair.style.cssText = 'position:fixed;left:0;top:0;width:34px;height:34px;pointer-events:none;z-index:55;display:none;will-change:transform;';
    crosshair.innerHTML =
        '<div style="position:absolute;left:50%;top:0;width:2px;height:10px;background:#ffce4a;transform:translateX(-50%);box-shadow:0 0 4px rgba(0,0,0,.7)"></div>'
      + '<div style="position:absolute;left:50%;bottom:0;width:2px;height:10px;background:#ffce4a;transform:translateX(-50%);box-shadow:0 0 4px rgba(0,0,0,.7)"></div>'
      + '<div style="position:absolute;top:50%;left:0;height:2px;width:10px;background:#ffce4a;transform:translateY(-50%);box-shadow:0 0 4px rgba(0,0,0,.7)"></div>'
      + '<div style="position:absolute;top:50%;right:0;height:2px;width:10px;background:#ffce4a;transform:translateY(-50%);box-shadow:0 0 4px rgba(0,0,0,.7)"></div>'
      + '<div style="position:absolute;left:50%;top:50%;width:4px;height:4px;background:#ff2a2a;border-radius:50%;transform:translate(-50%,-50%);box-shadow:0 0 6px rgba(255,42,42,.8)"></div>';
    document.body.appendChild(crosshair);
    // Known NPC positions — we use these to hide the crosshair (and
    // suppress firing) whenever the player aims at someone. Out of
    // respect for the printers, we don't kill NPCs.
    const NPC_POSITIONS = [
      { x: -22,    z: -33,   r: 60 },  // Carlos
      { x: -22,    z: -7,    r: 60 },  // Moneycaller
      { x:  82,    z:  0,    r: 60 },  // Wave
      { x:  60,    z:  58.6, r: 60 },  // Gary
      { x: -10.5,  z: -45,   r: 60 },  // Alexandre
      { x: -27,    z:  32,   r: 60 },  // Hapu
      { x: -50,    z: -22,   r: 60 },  // Data
      { x:  35 - 1.2, z: -70 - 1.5, r: 60 }, // Smitty
    ];
    const _npcV = new THREE.Vector3();
    function isAimingAtNpc(){
      if(!window.camera) return false;
      const gh = window.groundHeightAt || (() => 0);
      // Also walk the live arrays for moving NPCs (junkies, cats, Roki, etc.)
      const moving = [];
      for(const arr of [window.Junkies, window.Cats, window.Roki]){
        if(Array.isArray(arr)){
          for(const o of arr){ if(o && typeof o.x === 'number') moving.push({ x: o.x, z: o.z, r: 50 }); }
        }
      }
      if(window.Roki && !Array.isArray(window.Roki) && typeof window.Roki.x === 'number'){
        moving.push({ x: window.Roki.x, z: window.Roki.z, r: 60 });
      }
      const all = NPC_POSITIONS.concat(moving);
      for(const p of all){
        try {
          const y = gh(p.x, p.z);
          _npcV.set(p.x, y + 1.5, p.z).project(window.camera);
          if(_npcV.z < 1 && _npcV.z > -1){
            const sx = (_npcV.x * 0.5 + 0.5) * window.innerWidth;
            const sy = (1 - (_npcV.y * 0.5 + 0.5)) * window.innerHeight;
            if(Math.hypot(sx - mouseX, sy - mouseY) < (p.r || 60)) return true;
          }
        } catch(_){}
      }
      return false;
    }
    window._isAimingAtNpc = isAimingAtNpc; // expose so fire() can check
    function crosshairTick(){
      // Hide the gun crosshair while a deathmatch owns the screen (the
      // DM HUD has its own) and while the arena waiting panel is open.
      const dmBusy = window.Dm && (window.Dm.phase === 'active' || window.Dm.phase === 'countdown');
      const _dmw = document.getElementById('dmWaiting');
      const dmPanel = _dmw && _dmw.style.display !== 'none' &&
        document.getElementById('dmOverlay')?.classList.contains('show');
      if(State.inventory?.deagle > 0 && !dmBusy && !dmPanel && !isAimingAtNpc()){
        crosshair.style.display = 'block';
        crosshair.style.transform = 'translate(' + (mouseX - 17) + 'px,' + (mouseY - 17) + 'px)';
      } else {
        crosshair.style.display = 'none';
      }
      requestAnimationFrame(crosshairTick);
    }
    requestAnimationFrame(crosshairTick);

    // ── Firing ──
    let muzzleEl = null;
    function muzzleFlash(){
      if(!muzzleEl){
        muzzleEl = document.createElement('div');
        muzzleEl.style.cssText = 'position:fixed;left:0;top:0;width:120px;height:120px;border-radius:50%;background:radial-gradient(circle,#fff1c2 0%,#ffce4a 35%,transparent 65%);pointer-events:none;z-index:120;opacity:0;mix-blend-mode:screen;transition:opacity .08s ease';
        document.body.appendChild(muzzleEl);
      }
      // Position the flash at the crosshair so it looks like the shot
      // came from where the player was aiming.
      muzzleEl.style.transform = 'translate(' + (mouseX - 60) + 'px,' + (mouseY - 60) + 'px)';
      muzzleEl.style.opacity = '0.85';
      setTimeout(() => { if(muzzleEl) muzzleEl.style.opacity = '0'; }, 90);
    }

    const _raycaster = new THREE.Raycaster();
    function fire(){
      if(!(State.inventory?.deagle > 0)){
        window.floater?.("No weapon equipped", "bad");
        return;
      }
      const ammo = State.inventory?.ammo_deagle || 0;
      if(ammo <= 0){
        dryFireSound();
        window.floater?.("Out of ammo", "bad", { small: true });
        return;
      }
      window.takeItem('ammo_deagle', 1);
      muzzleFlash();
      gunshotSound();
      const cam = window.camera;
      if(!cam) return;
      // ── Primary: raycast from camera through the crosshair pixel ──
      // setFromCamera takes normalised device coordinates (NDC, -1..1)
      // and gives us a ray that perfectly matches what's under the mouse.
      const ndc = new THREE.Vector2(
        (mouseX / window.innerWidth) * 2 - 1,
        -(mouseY / window.innerHeight) * 2 + 1
      );
      let killedI = -1;
      let primaryDist = Infinity;
      let fwd = new THREE.Vector3();
      try {
        _raycaster.setFromCamera(ndc, cam);
        _raycaster.far = 200;
        fwd.copy(_raycaster.ray.direction);
        const objs = Spiders.map(s => s.mesh).filter(Boolean);
        const hits = _raycaster.intersectObjects(objs, true);
        if(hits.length){
          let hitObj = hits[0].object;
          while(hitObj && !Spiders.find(s => s.mesh === hitObj)) hitObj = hitObj.parent;
          if(hitObj){
            killedI = Spiders.findIndex(s => s.mesh === hitObj);
            primaryDist = hits[0].distance;
          }
        }
      } catch(_){
        cam.getWorldDirection(fwd);
      }
      if(killedI < 0){
        const fx = fwd.x, fz = fwd.z;
        const fLen = Math.hypot(fx, fz) || 1;
        const dx = fx / fLen, dz = fz / fLen;
        let bestI = -1, bestT = 1e9;
        for(let i = 0; i < Spiders.length; i++){
          const s = Spiders[i];
          if(s.dead) continue;
          const ddx = s.x - Player.pos.x, ddz = s.z - Player.pos.z;
          const dist = Math.hypot(ddx, ddz);
          if(dist > 50) continue;
          if(dist < 4){ if(dist < bestT){ bestT = dist; bestI = i; } continue; }
          const dot = (ddx * dx + ddz * dz) / Math.max(0.01, dist);
          if(dot < Math.cos(0.70)) continue;
          if(dist < bestT){ bestT = dist; bestI = i; }
        }
        killedI = bestI;
        primaryDist = bestT;
      }
      // ── No shooting through walls — if anything solid sits between the
      // camera and the spider, the shot is blocked.
      if(killedI >= 0 && window.fwShotBlockDist){
        try {
          const ignore = [window.printer].concat(Spiders.map(s => s.mesh).filter(Boolean));
          const blockD = window.fwShotBlockDist(cam.position, fwd, Math.min(primaryDist, 200), ignore);
          if(blockD < primaryDist - 0.1) killedI = -1;
        } catch(_){}
      }
      if(killedI >= 0){
        const s = Spiders[killedI];
        s.dead = true;
        try { scene.remove(s.mesh); } catch(_){}
        Spiders.splice(killedI, 1);
        State.spidersKilled = (State.spidersKilled || 0) + 1;
        State.credits = (State.credits || 0) + 10;
        window.floater?.("\u{1F578}\u{FE0F}\u{1F480} Spider down! +10 \u{1F948}", "good");
        window.saveState?.();
        window.updateHUD?.();
      }
      // (misses are silent — no "miss" text)
    }

    // ── Fart-kill: any spider caught in a fart blast dies ──────────
    // fartworld.html's tryFart() calls window.killSpidersNear(x, z, radius)
    // but nothing defined it, so farts never hurt spiders. Define it here
    // where the Spiders array + scene live. No weapon required — this is
    // the "fart on a spider and it dies" mechanic.
    window.killSpidersNear = function(x, z, radius){
      const r = radius || 4;
      let killed = 0;
      for(let i = Spiders.length - 1; i >= 0; i--){
        const s = Spiders[i];
        if(!s || s.dead) continue;
        const sx = (typeof s.x === 'number') ? s.x : (s.mesh ? s.mesh.position.x : 0);
        const sz = (typeof s.z === 'number') ? s.z : (s.mesh ? s.mesh.position.z : 0);
        if(Math.hypot(sx - x, sz - z) <= r){
          s.dead = true;
          try { scene.remove(s.mesh); } catch(_){}
          Spiders.splice(i, 1);
          killed++;
        }
      }
      if(killed > 0){
        State.spidersKilled = (State.spidersKilled || 0) + killed;
        State.credits = (State.credits || 0) + killed * 5;
        window.floater?.("\u{1F4A8}\u{1F578}\u{FE0F}\u{1F480} Fart wiped out " + killed + " spider" + (killed > 1 ? "s" : "") + "! +" + (killed * 5) + " \u{1F948}", "good");
        window.saveState?.();
        window.updateHUD?.();
      }
      return killed;
    };

    // Right-click to fire — only in world view (ignore clicks over modals/UI).
    // Moved off left-click so left can drive the camera look-drag. The browser
    // context menu is suppressed (here + globally) so no "Save image as…"
    // popup interrupts a shot.
    document.addEventListener('contextmenu', (e) => e.preventDefault());
    document.addEventListener('mousedown', (e) => {
      // Action scheme fires with LEFT click (RMB = aim); classic keeps RMB.
      // Only treat action mode as live when controls.js actually booted
      // (FWControlsActive) — otherwise fall back to classic RMB so the gun
      // can never go dead.
      const actionLive = window.FWControlsActive && window.FWSettings && window.FWSettings.scheme === 'action';
      const fireBtn = actionLive ? 0 : 2;
      if(e.button !== fireBtn) return;
      // In action scheme only shoot while the pointer is locked — a free-
      // cursor left click is for UI / re-grabbing the mouse, not firing.
      if(actionLive && document.pointerLockElement !== document.getElementById('canvas')) return;
      // During a deathmatch the DM weapons own the trigger (unlimited
      // ammo) — never fire/dry-fire the inventory Deagle on top of them.
      if(window.Dm && (window.Dm.phase === 'active' || window.Dm.phase === 'countdown')) return;
      // No shooting while piloting anything (plane / boat / yacht / rocket)
      if(window.Player && window.Player.boat) return;
      // Arena waiting panel open = it's a menu; let its buttons be clicked.
      const _dmw = document.getElementById('dmWaiting');
      if(_dmw && _dmw.style.display !== 'none' &&
         document.getElementById('dmOverlay')?.classList.contains('show')) return;
      e.preventDefault();
      // Block if a modal is open
      if(document.querySelector('.gs-bg.show, .bank-bg.show, .junk-bg.show, .est-bg.show, .stor-bg.show, .dc-bg.show, .alex-pop.show, .wave-bg.show, .gary-bg.show, #invBg.show, #marketBg.show, #poopBg.show, .fc-bg.show, .carlos-bg.show, .roki-bg.show')) return;
      // Block if click is on a button/UI element
      const tgt = e.target;
      if(tgt && tgt.tagName && /^(BUTTON|A|INPUT|TEXTAREA|SELECT|LABEL)$/.test(tgt.tagName)) return;
      if(tgt && tgt.closest && tgt.closest('button, a, input, textarea, select, label, .gs-pop, .alex-pop, .roki-near, .plane-prox, .tut-card, .junk-pop, #npcPop')) return;
      // Must have the gun
      if(!(State.inventory?.deagle > 0)) return;
      fire();
    });

    console.log('[gunsmith] ready at', SHOP_POS);
  }
})();
