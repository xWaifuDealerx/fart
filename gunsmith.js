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
    if(!ITEMS.spider_meat){
      ITEMS.spider_meat = {
        id: 'spider_meat',
        name: 'Spider Meat',
        icon: '⚫',
        color: '#111111',
        type: 'material',
        isNFT: false,
        suggestedPrice: 12,
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

    // ─────────────────────────────────────────────────────────────
    // WEAPONS — AK-47 (assault) & M40 (sniper) + magazines / reload.
    // Each weapon draws from its own ammo type and has a magazine that
    // must be reloaded (R) from your reserve ammo. Switch with 1/2/3.
    // ─────────────────────────────────────────────────────────────
    if(!ITEMS.ak47){ ITEMS.ak47 = { id:'ak47', name:'AK-47', icon:'\u{1F52B}', color:'#6a5a3a', type:'weapon', isNFT:false, marketPrice:2000, suggestedPrice:1800 }; }
    if(!ITEMS.m40){ ITEMS.m40 = { id:'m40', name:'M40 Sniper', icon:'\u{1F3AF}', color:'#3a4a3a', type:'weapon', isNFT:false, marketPrice:3500, suggestedPrice:3200 }; }
    if(!ITEMS.ammo_ak){ ITEMS.ammo_ak = { id:'ammo_ak', name:'7.62 Ammo (30)', icon:'\u{1F4A5}', color:'#9a7a4a', type:'ammo', isNFT:false, marketPrice:90, suggestedPrice:80, stackBundle:30 }; }
    if(!ITEMS.ammo_m40){ ITEMS.ammo_m40 = { id:'ammo_m40', name:'.308 Ammo (10)', icon:'\u{1F4A5}', color:'#7a8a6a', type:'ammo', isNFT:false, marketPrice:150, suggestedPrice:130, stackBundle:10 }; }

    const WEAPONS = {
      deagle: { id:'deagle', name:'Desert Eagle .50AE', ammoId:'ammo_deagle', mag:7,  price:500,  ammoPrice:50,  ammoQty:12, icon:'\u{1F52B}', scope:false, auto:false, rof:0,   recoil:0.012, desc:'Hand cannon · one-shot kill' },
      ak47:   { id:'ak47',   name:'AK-47',              ammoId:'ammo_ak',     mag:30, price:2000, ammoPrice:90,  ammoQty:30, icon:'\u{1F52B}', scope:false, auto:true,  rof:95,  recoil:0.017, desc:'Assault rifle · full-auto · hold to spray' },
      m40:    { id:'m40',    name:'M40 Sniper',         ammoId:'ammo_m40',    mag:5,  price:3500, ammoPrice:150, ammoQty:10, icon:'\u{1F3AF}', scope:true,  auto:false, rof:0,   recoil:0.034, desc:'Sniper · scope when you aim (FPS)' },
    };
    const WORDER = ['deagle', 'ak47', 'm40'];
    const MAGKEY = 'fw.weap.v1';
    let MAG = { deagle:0, ak47:0, m40:0 };
    let ACTIVE = 'deagle';
    try { const o = JSON.parse(localStorage.getItem(MAGKEY)); if(o){ if(o.mag) MAG = Object.assign(MAG, o.mag); if(o.active) ACTIVE = o.active; } } catch(_){}
    function saveMag(){ try { localStorage.setItem(MAGKEY, JSON.stringify({ mag: MAG, active: ACTIVE })); } catch(_){} }
    // ── gunshot .mp3s via the shared POOLED player (sfx.js): a small reused
    //    element pool, so rapid AK fire never exhausts media elements and the
    //    audio never dies. Short filenames survive Git 8.3 truncation. ──
    const WEAP_SND = { deagle: 'deagle', ak47: 'ak47', m40: 'm40' };
    function playWeaponSound(){
      const f = WEAP_SND[ACTIVE];
      if(f && window.fwSfx) window.fwSfx(f, 0.5);
    }
    function owned(id){ return (State.inventory?.[id] || 0) > 0; }
    function reserve(id){ const w = WEAPONS[id]; return w ? (State.inventory?.[w.ammoId] || 0) : 0; }
    function anyWeapon(){ return WORDER.some(owned); }
    function ensureActive(){ if(!owned(ACTIVE)){ ACTIVE = WORDER.find(owned) || 'deagle'; saveMag(); } }
    window.fwActiveWeapon = () => ACTIVE;
    window.fwHasActiveWeapon = () => owned(ACTIVE);
    window.fwAnyWeapon = anyWeapon;

    function reloadSound(){
      const ctx = getCtx(); if(!ctx) return; const now = ctx.currentTime;
      for(const [t, f] of [[0, 1500], [0.12, 850], [0.24, 1900]]){
        const o = ctx.createOscillator(); o.type = 'square'; o.frequency.setValueAtTime(f, now + t);
        const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, now + t); g.gain.linearRampToValueAtTime(0.1, now + t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, now + t + 0.08);
        o.connect(g).connect(ctx.destination); o.start(now + t); o.stop(now + t + 0.1);
      }
    }
    function dmActive(){ return !!(window.Dm && (window.Dm.phase === 'active' || window.Dm.phase === 'countdown')); }
    function reload(){
      ensureActive();
      const w = WEAPONS[ACTIVE]; if(!w || !owned(ACTIVE)) return;
      const need = w.mag - (MAG[ACTIVE] || 0);
      if(need <= 0){ window.floater?.('Magazine full', 'bad'); return; }
      // In a deathmatch you have UNLIMITED reserve ammo — reload always tops
      // the mag to full (no reserve needed), but you still have to reload.
      if(dmActive()){
        MAG[ACTIVE] = w.mag; saveMag(); reloadSound(); updateAmmoHud();
        window.floater?.('\u{1F504} Reloaded — ' + MAG[ACTIVE] + '/' + w.mag, 'good');
        return;
      }
      const have = reserve(ACTIVE);
      if(have <= 0){ window.floater?.('No ' + (ITEMS[w.ammoId]?.name || 'ammo') + ' — buy some at the Gunsmith', 'bad'); return; }
      const take = Math.min(need, have);
      window.takeItem?.(w.ammoId, take);
      MAG[ACTIVE] = (MAG[ACTIVE] || 0) + take;
      saveMag(); reloadSound(); updateAmmoHud();
      window.floater?.('\u{1F504} Reloaded — ' + MAG[ACTIVE] + '/' + w.mag, 'good');
      window.saveState?.(); window.updateHUD?.();
    }
    function switchWeapon(id){
      if(!owned(id)){ window.floater?.("You don't own that weapon", 'bad'); return; }
      ACTIVE = id; saveMag();
      if(id === 'deagle'){ try { window.fwEquipGun?.(true); } catch(_){} }
      else { window.fwGunHolstered = false; }
      updateAmmoHud();
      window.floater?.(WEAPONS[id].icon + ' ' + WEAPONS[id].name + ' equipped', 'good');
    }
    window.fwSwitchWeapon = switchWeapon;
    window.addEventListener('keydown', (e) => {
      const a = document.activeElement;
      if(a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA')) return;
      // During a match only RELOAD is allowed (R) — weapon switching is the
      // arena's job. Without this, R never reached reload() in deathmatch.
      if(window.Dm && (window.Dm.phase === 'active' || window.Dm.phase === 'countdown')){
        if(e.code === 'KeyR') reload();
        return;
      }
      if(e.code === 'KeyR'){ reload(); }
      else if((e.code === 'Digit1' || e.code === 'Numpad1') && owned('deagle')){ switchWeapon('deagle'); }
      else if((e.code === 'Digit2' || e.code === 'Numpad2') && owned('ak47')){ switchWeapon('ak47'); }
      else if((e.code === 'Digit3' || e.code === 'Numpad3') && owned('m40')){ switchWeapon('m40'); }
    });

    // ── Ammo HUD ──
    const ammoCss = document.createElement('style');
    ammoCss.textContent = "#fwAmmoHud{position:fixed;right:262px;bottom:18px;z-index:46;display:none;background:rgba(8,18,11,.82);border:1px solid rgba(255,206,74,.4);border-radius:12px;padding:8px 13px;color:#fff1c2;font-family:'Outfit','Inter',sans-serif;text-align:right;box-shadow:0 6px 16px rgba(0,0,0,.4)}#fwAmmoHud .wn{font-size:11px;color:#ffce4a;font-weight:700}#fwAmmoHud .am{font-family:'JetBrains Mono',monospace;font-size:17px;font-weight:800}#fwAmmoHud .am b{color:#fff}#fwAmmoHud .am span{font-size:10px;color:rgba(230,255,238,.55)}#fwAmmoHud .hint{font-size:9px;color:rgba(230,255,238,.4);margin-top:2px}";
    document.head.appendChild(ammoCss);
    const ammoHud = document.createElement('div'); ammoHud.id = 'fwAmmoHud'; document.body.appendChild(ammoHud);
    function updateAmmoHud(){
      ensureActive();
      const drawn = owned(ACTIVE) && !window.fwGunHolstered && !window.fwSleeping && !(window.Player && window.Player.boat) && !(window.Dm && window.Dm.phase === 'active');
      if(!anyWeapon() || !drawn){ ammoHud.style.display = 'none'; return; }
      const w = WEAPONS[ACTIVE];
      ammoHud.style.display = 'block';
      ammoHud.innerHTML = '<div class="wn">' + w.icon + ' ' + w.name + '</div>'
        + '<div class="am"><b>' + (MAG[ACTIVE] || 0) + '</b>/' + w.mag + ' <span>· ' + reserve(ACTIVE) + ' left</span></div>'
        + '<div class="hint">R reload · 1/2/3 switch</div>';
    }
    setInterval(updateAmmoHud, 400);

    // ── M40 sniper scope (shown when you aim down sights in FPS mode) ──
    const scopeCss = document.createElement('style');
    scopeCss.textContent = "#fwScope{position:fixed;inset:0;z-index:90;display:none;pointer-events:none;background:radial-gradient(circle at 50% 50%, rgba(0,0,0,0) 0 35vh, rgba(0,0,0,.5) 35vh 37vh, rgba(0,0,0,.98) 40vh)}#fwScope .ring{position:absolute;left:50%;top:50%;width:74vh;height:74vh;transform:translate(-50%,-50%);border:3px solid rgba(0,0,0,.9);border-radius:50%;box-shadow:inset 0 0 0 2px rgba(70,70,70,.5)}#fwScope .v{position:absolute;left:50%;top:50%;width:1px;height:74vh;transform:translate(-50%,-50%);background:rgba(15,15,15,.85)}#fwScope .h{position:absolute;left:50%;top:50%;height:1px;width:74vh;transform:translate(-50%,-50%);background:rgba(15,15,15,.85)}#fwScope .dot{position:absolute;left:50%;top:50%;width:6px;height:6px;border-radius:50%;background:#ff2a2a;transform:translate(-50%,-50%);box-shadow:0 0 5px rgba(255,42,42,.9)}";
    document.head.appendChild(scopeCss);
    const scope = document.createElement('div'); scope.id = 'fwScope';
    scope.innerHTML = '<div class="ring"></div><div class="v"></div><div class="h"></div><div class="dot"></div>';
    document.body.appendChild(scope);
    function scopedNow(){
      const fps = window.Cam && typeof window.Cam.curDistance === 'number' && window.Cam.curDistance < 2.1;
      return ACTIVE === 'm40' && owned('m40') && !!window.fwAiming && fps && !window.fwGunHolstered && !window.fwSleeping && !(window.Player && window.Player.boat);
    }
    window.fwScoped = scopedNow;   // controls.js reads this for the zoom FOV
    function scopeTick(){
      scope.style.display = scopedNow() ? 'block' : 'none';
      requestAnimationFrame(scopeTick);
    }
    requestAnimationFrame(scopeTick);

    // ── DEATHMATCH bridge ─────────────────────────────────────────────
    // The arena drives shooting through these so your REAL weapon (with its
    // magazine/reload and recoil) is what fires in PvP — not a separate set.
    const DM_STATS = {
      deagle: { dmg: 48,  cooldown: 0.30, spread: 0.005 },
      ak47:   { dmg: 19,  cooldown: 0.11, spread: 0.022 },
      m40:    { dmg: 100, cooldown: 1.10, spread: 0.0008 },
    };
    // top the active weapon's mag to full (called when a match starts)
    window.fwDmRefill = function(){ const w = WEAPONS[ACTIVE]; if(w && owned(ACTIVE)){ MAG[ACTIVE] = w.mag; saveMag(); updateAmmoHud(); } };
    window.fwDmWeaponCooldown = function(){ const s = DM_STATS[ACTIVE]; return s ? s.cooldown : 0.3; };
    window.fwDmWeaponAuto = function(){ return !!(WEAPONS[ACTIVE] && WEAPONS[ACTIVE].auto); };
    // Fire the active weapon for the arena: consumes a round (so reload
    // matters), applies recoil + viewmodel kick. Returns combat stats, or
    // { ok:false, empty:true } when the mag is empty (prompting a reload).
    window.fwDmShot = function(){
      const id = ACTIVE, w = WEAPONS[id];
      if(!w || !owned(id)) return { ok:false };
      if((MAG[id] || 0) <= 0) return { ok:false, empty:true };
      MAG[id]--; saveMag(); updateAmmoHud();
      try { if(window.Cam) window.Cam.pitch = Math.max(-1.05, Math.min(1.2, window.Cam.pitch - w.recoil)); } catch(_){}
      try { window.fwGunKick && window.fwGunKick(); } catch(_){}
      playWeaponSound();   // real gun .mp3 in the arena too
      const s = DM_STATS[id] || DM_STATS.deagle;
      return { ok:true, id, dmg:s.dmg, cooldown:s.cooldown, spread:s.spread, auto:!!w.auto,
               soundId: w.auto ? 'smg' : 'pistol', color: 0xffe066 };
    };

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
      let html = '';
      for(const id of WORDER){
        const w = WEAPONS[id];
        const have = owned(id);
        html += '<div class="gs-row"><div class="ico">' + w.icon + '</div>'
          + '<div><div class="nm">' + w.name + (have ? ' <span style="color:#5ff09c">✓</span>' : '') + '</div><div class="sub">' + w.price + ' \u{1F948} · ' + w.desc + '</div></div>'
          + '<button class="btn" data-buy-weapon="' + id + '">Buy</button>'
          + '</div>'
          + '<div class="gs-row"><div class="ico">\u{1F4A5}</div>'
          + '<div><div class="nm">' + (ITEMS[w.ammoId]?.name || 'Ammo') + '</div><div class="sub">' + w.ammoPrice + ' \u{1F948} · ' + w.ammoQty + ' rounds · you have ' + reserve(id) + '</div></div>'
          + '<button class="btn" data-buy-ammo="' + id + '">Buy</button></div>';
      }
      body.innerHTML = html;
      body.querySelectorAll('[data-buy-weapon]').forEach(b => b.addEventListener('click', () => buyWeapon(b.getAttribute('data-buy-weapon'))));
      body.querySelectorAll('[data-buy-ammo]').forEach(b => b.addEventListener('click', () => buyAmmo(b.getAttribute('data-buy-ammo'))));
    }
    function buyWeapon(id){
      const w = WEAPONS[id]; if(!w) return;   // re-buying allowed
      if((State.credits || 0) < w.price){ window.floater?.('Need ' + w.price + ' \u{1F948}', 'bad'); return; }
      State.credits -= w.price;
      window.addItem?.(id, 1);
      window.addItem?.(w.ammoId, w.ammoQty);   // starter reserve
      MAG[id] = w.mag; saveMag();               // comes loaded
      State.gunsmithUnlocked = true;
      setTimeout(() => { try { switchWeapon(id); } catch(_){} }, 40);
      window.floater?.(w.icon + ' ' + w.name + ' acquired', 'good');
      window.playPurchaseSound?.(); window.saveState?.(); window.updateHUD?.();
      render();
    }
    function buyAmmo(id){
      const w = WEAPONS[id]; if(!w) return;
      if((State.credits || 0) < w.ammoPrice){ window.floater?.('Need ' + w.ammoPrice + ' \u{1F948}', 'bad'); return; }
      State.credits -= w.ammoPrice;
      window.addItem?.(w.ammoId, w.ammoQty);
      window.floater?.('+' + w.ammoQty + ' rounds', 'good');
      window.playPurchaseSound?.(); window.saveState?.(); window.updateHUD?.();
      render();
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

    // Give a spider a roam target that heads AWAY from the nearest
    // building (well past its flee radius) with a little random spread.
    // Used when the player is unreachable so the spider leaves the wall
    // instead of pacing back and forth against it.
    function pickWander(s){
      let zn = SAFE_ZONES[0], best = Infinity;
      for(const z of SAFE_ZONES){
        const dd = Math.hypot(z.x - s.x, z.z - s.z);
        if(dd < best){ best = dd; zn = z; }
      }
      const ang = Math.atan2(s.z - zn.z, s.x - zn.x) + (Math.random() - 0.5) * 1.4;
      const dist = (zn.r || 8) + 8 + Math.random() * 10;
      let tx = s.x + Math.cos(ang) * dist;
      let tz = s.z + Math.sin(ang) * dist;
      const rr = Math.hypot(tx, tz);
      if(rr > ISLAND_R - 3){ tx = tx / rr * (ISLAND_R - 3); tz = tz / rr * (ISLAND_R - 3); }
      s._wander = { x: tx, z: tz };
    }

    // Spider tick
    let lastT = performance.now();
    function tick(){
      const now = performance.now();
      let dt = (now - lastT) / 1000; if(dt > 0.1) dt = 0.1; lastT = now;
      for(let i = Spiders.length - 1; i >= 0; i--){
        const s = Spiders[i];
        if(s.dead) continue;
        // Decide this spider's movement intent:
        //   flee         → inside a building's flee radius: bolt straight out
        //   playerHidden → player is asleep / in a panic room / on a boat:
        //                  give up the chase and roam AWAY, so it doesn't
        //                  pace back and forth against the wall
        //   otherwise    → chase the player
        const flee = nearestSafeZone(s.x, s.z);
        const playerHidden = !!window.fwSleeping || !!Player.boat
          || !!nearestSafeZone(Player.pos.x, Player.pos.z);
        let mvx, mvz, speed = SPIDER_SPEED;
        if(flee){
          mvx = s.x - flee.zn.x;
          mvz = s.z - flee.zn.z;
          speed = SPIDER_SPEED * 1.6;   // visibly bolt out of the zone
          s._wander = null;             // re-roll a roam point once it's clear
        } else if(playerHidden){
          if(!s._wander) pickWander(s);
          mvx = s._wander.x - s.x;
          mvz = s._wander.z - s.z;
          if(Math.hypot(mvx, mvz) < 2){ // reached the roam point — pick another
            pickWander(s);
            mvx = s._wander.x - s.x;
            mvz = s._wander.z - s.z;
          }
          speed = SPIDER_SPEED * 0.8;   // a calm amble while you're safe
        } else {
          s._wander = null;
          mvx = Player.pos.x - s.x;
          mvz = Player.pos.z - s.z;
          const dpd = Math.hypot(mvx, mvz);
          speed = dpd < SPIDER_CONTACT_R ? 0 : SPIDER_SPEED;
        }
        const md = Math.hypot(mvx, mvz);
        if(md > 0.0001 && speed > 0){
          s.yaw = Math.atan2(mvx, mvz);
          s.x += (mvx / md) * speed * dt;
          s.z += (mvz / md) * speed * dt;
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
        // while the spider is fleeing or the player is hidden/asleep.
        if(!flee && !playerHidden){
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
    let heldGun = null, heldGunFor = null;
    function buildHeldGun(id){
      id = id || ACTIVE;
      if(id === 'ak47') return buildAKHeld();
      if(id === 'm40') return buildM40Held();
      return buildDeagleHeld();
    }
    function buildAKHeld(){
      const g = new THREE.Group();
      const wood = new THREE.MeshStandardMaterial({ color: 0x6a4528, roughness: 0.7 });
      const metal = new THREE.MeshStandardMaterial({ color: 0x2a2a2e, metalness: 0.7, roughness: 0.4 });
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.13, 0.46), metal); body.position.set(0, 0.04, 0.12); g.add(body);
      const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.024, 0.5, 8), metal); barrel.rotation.x = Math.PI / 2; barrel.position.set(0, 0.06, 0.5); g.add(barrel);
      const hg = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.08, 0.26), wood); hg.position.set(0, 0.04, 0.34); g.add(hg);
      const mag = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.22, 0.1), metal); mag.position.set(0, -0.12, 0.16); mag.rotation.x = 0.4; g.add(mag);
      const stock = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.1, 0.38), wood); stock.position.set(0, 0.01, -0.22); g.add(stock);
      const grip = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.16, 0.07), metal); grip.position.set(0, -0.1, 0.02); grip.rotation.x = 0.3; g.add(grip);
      return g;
    }
    function buildM40Held(){
      const g = new THREE.Group();
      const wood = new THREE.MeshStandardMaterial({ color: 0x3a2a1a, roughness: 0.7 });
      const metal = new THREE.MeshStandardMaterial({ color: 0x23231f, metalness: 0.6, roughness: 0.4 });
      const glass = new THREE.MeshStandardMaterial({ color: 0x88bbff, metalness: 0.3, roughness: 0.1, emissive: 0x113355, emissiveIntensity: 0.3 });
      const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.019, 0.022, 0.78, 8), metal); barrel.rotation.x = Math.PI / 2; barrel.position.set(0, 0.05, 0.5); g.add(barrel);
      const stock = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.12, 0.66), wood); stock.position.set(0, 0.0, -0.04); g.add(stock);
      const scopeT = new THREE.Mesh(new THREE.CylinderGeometry(0.034, 0.034, 0.3, 10), metal); scopeT.rotation.x = Math.PI / 2; scopeT.position.set(0, 0.15, 0.14); g.add(scopeT);
      const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.02, 10), glass); lens.rotation.x = Math.PI / 2; lens.position.set(0, 0.15, 0.29); g.add(lens);
      for(const z of [0.04, 0.24]){ const mnt = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.08, 0.02), metal); mnt.position.set(0, 0.1, z); g.add(mnt); }
      const grip = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.15, 0.07), wood); grip.position.set(0, -0.09, 0.0); grip.rotation.x = 0.3; g.add(grip);
      return g;
    }
    function buildDeagleHeld(){
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
    // ── FPS viewmodels for AK / M40 (camera-attached). The deagle keeps
    //    its GLB viewmodel from controls.js; controls.js hides that GLB
    //    whenever a non-deagle weapon is active, and these show instead. ──
    let fpsAK = null, fpsM40 = null, fpsAttached = false;
    function ensureFpsModels(){
      const cam = window.camera; if(!cam) return;
      if(!fpsAttached){ try { window.scene?.add(cam); } catch(_){} fpsAttached = true; }
      if(!fpsAK){
        fpsAK = buildAKHeld(); fpsAK.scale.set(1.55, 1.55, 1.55);
        fpsAK.position.set(0.34, -0.42, -0.75); fpsAK.rotation.set(0.04, Math.PI, 0); fpsAK.visible = false;
        fpsAK.traverse(o => { if(o.isMesh){ o.castShadow = false; o.receiveShadow = false; } });
        cam.add(fpsAK);
      }
      if(!fpsM40){
        fpsM40 = buildM40Held(); fpsM40.scale.set(1.4, 1.4, 1.4);
        fpsM40.position.set(0.32, -0.44, -0.78); fpsM40.rotation.set(0.04, Math.PI, 0); fpsM40.visible = false;
        fpsM40.traverse(o => { if(o.isMesh){ o.castShadow = false; o.receiveShadow = false; } });
        cam.add(fpsM40);
      }
    }
    function tickFpsModels(){
      ensureFpsModels();
      const fps = window.Cam && typeof window.Cam.curDistance === 'number' && window.Cam.curDistance < 2.1;
      const armed = owned(ACTIVE) && !window.fwGunHolstered && !window.fwSleeping && !(window.Player && window.Player.boat);
      const scoped = !!(window.fwScoped && window.fwScoped());
      if(fpsAK) fpsAK.visible = !!(fps && armed && ACTIVE === 'ak47');
      if(fpsM40) fpsM40.visible = !!(fps && armed && ACTIVE === 'm40' && !scoped);
      requestAnimationFrame(tickFpsModels);
    }
    requestAnimationFrame(tickFpsModels);

    function tickHeldGun(){
      const have = owned(ACTIVE);
      const printer = window.printer || window.Player?.mesh;
      if(!printer){ requestAnimationFrame(tickHeldGun); return; }
      const showGun = have && printer.visible && !window.fwSleeping && !window.fwGunHolstered;
      // animatePrinter raises the RIGHT arm while this flag is set
      window.fwHoldGun = showGun && !window.Player?.boat;
      if(showGun){
        if(!heldGun || heldGunFor !== ACTIVE){
          if(heldGun){ try { scene.remove(heldGun); } catch(_){} }
          heldGun = buildHeldGun(ACTIVE); heldGunFor = ACTIVE; scene.add(heldGun);
        }
        // Place in the printer's RIGHT hand (facing +Z, right = −X),
        // lifted to match the raised carrying arm.
        const yaw = printer.rotation.y || 0;
        const off = { x: -0.85, y: 0.95, z: 0.72 };   // lowered to sit at the printer's hands
        const cs = Math.cos(yaw), sn = Math.sin(yaw);
        const wx = off.x * cs + off.z * sn;
        const wz = -off.x * sn + off.z * cs;
        heldGun.position.set(printer.position.x + wx, printer.position.y + off.y, printer.position.z + wz);
        heldGun.rotation.y = yaw;
        heldGun.rotation.x = -0.06;     // slight ready tilt
      } else if(heldGun){
        scene.remove(heldGun);
        heldGun = null;
        window.fwHoldGun = false;
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
      noiseFilt.type = 'bandpass'; noiseFilt.frequency.value = 650; noiseFilt.Q.value = 0.6;
      const noiseGain = ctx.createGain();
      noiseGain.gain.setValueAtTime(0.85, now);
      noiseGain.gain.exponentialRampToValueAtTime(0.0001, now + dur);
      noise.connect(noiseFilt).connect(noiseGain).connect(ctx.destination);
      noise.start(now); noise.stop(now + dur);
      // Sub BOOM — the .50AE chest-thump
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(110, now);
      osc.frequency.exponentialRampToValueAtTime(28, now + 0.22);
      const oscG = ctx.createGain();
      oscG.gain.setValueAtTime(0.9, now);
      oscG.gain.exponentialRampToValueAtTime(0.0001, now + 0.26);
      osc.connect(oscG).connect(ctx.destination);
      osc.start(now); osc.stop(now + 0.28);
      // Mechanical slide CLACK ~80ms after the shot (action cycling)
      const clack = ctx.createOscillator();
      clack.type = 'square';
      clack.frequency.setValueAtTime(2400, now + 0.08);
      clack.frequency.exponentialRampToValueAtTime(900, now + 0.13);
      const clackG = ctx.createGain();
      clackG.gain.setValueAtTime(0.0001, now);
      clackG.gain.setValueAtTime(0.12, now + 0.08);
      clackG.gain.exponentialRampToValueAtTime(0.0001, now + 0.14);
      clack.connect(clackG).connect(ctx.destination);
      clack.start(now + 0.08); clack.stop(now + 0.15);
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
      cFilt.type = 'highpass'; cFilt.frequency.value = 2100;
      const cGain = ctx.createGain();
      cGain.gain.setValueAtTime(0.9, now);
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
      eGain.gain.setValueAtTime(0.24, now + 0.10);
      eGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.42);
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
      const inVehicle = !!(window.Player && window.Player.boat);   // seaplane/boat/yacht: no aim
      const invOpen = document.getElementById('invBg')?.classList.contains('show');
      if(owned(ACTIVE) && !dmBusy && !dmPanel && !window.fwSleeping &&
         !inVehicle && !invOpen && !window.fwGunHolstered && !isAimingAtNpc() && !window.fwScoped?.()){
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
    // Aim-assist cone. A target must be IN FRONT of where you're aiming to be
    // hit — never behind or beside you. Tight at range, a little forgiving at
    // point-blank (but still in front). cos() of the half-angle in radians.
    const AIM_COS      = Math.cos(0.42);   // ~24° half-angle at normal range
    const AIM_COS_NEAR = Math.cos(0.78);   // ~45° at point-blank (< 6 m)
    function aimNeed(dist){ return dist < 6 ? AIM_COS_NEAR : AIM_COS; }
    function fire(){
      ensureActive();
      if(!owned(ACTIVE)){
        window.floater?.("No weapon equipped", "bad");
        return;
      }
      if((MAG[ACTIVE] || 0) <= 0){
        dryFireSound();
        window.floater?.("\u{1F504} Empty — press R to reload", "bad", { small: true });
        return;
      }
      MAG[ACTIVE]--; saveMag(); updateAmmoHud();
      // recoil — kick the view upward a touch (stronger for the AK / M40),
      // plus the FPS viewmodel kick. The AK climbs as you spray.
      try {
        const kick = WEAPONS[ACTIVE].recoil || 0.012;
        if(window.Cam && typeof window.Cam.pitch === 'number'){
          window.Cam.pitch = Math.max(-1.05, Math.min(1.2, window.Cam.pitch - kick));
        }
        window.fwGunKick?.();
      } catch(_){}
      muzzleFlash();
      playWeaponSound();
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
          const dot = (ddx * dx + ddz * dz) / Math.max(0.01, dist);
          if(dot < aimNeed(dist)) continue;   // must be in front of your aim
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
        // Drop Spider Meat where it died — pick it up via Vicinity / G
        try { window.fwDropAt?.('spider_meat', 1, s.x, s.z); } catch(_){}
        State.spidersKilled = (State.spidersKilled || 0) + 1;
        State.credits = (State.credits || 0) + 10;
        window.fwSkillXp?.('weapon', 10);
        window.floater?.("\u{1F578}\u{FE0F}\u{1F480} Spider down! +10 \u{1F948}", "good");
        window.saveState?.();
        window.updateHUD?.();
      }
      // ── Also let the shot kill huntable animals (rats / pigs) ──
      // Only if the bullet didn't already drop a spider this shot.
      if(killedI < 0 && Array.isArray(window.fwHuntables) && window.fwHuntables.length){
        const H = window.fwHuntables;
        let hi = -1;
        try {
          const objs = H.map(a => a.mesh).filter(Boolean);
          const hits = _raycaster.intersectObjects(objs, true);
          if(hits.length){
            let o = hits[0].object;
            while(o && !H.find(a => a.mesh === o)) o = o.parent;
            if(o) hi = H.findIndex(a => a.mesh === o);
          }
        } catch(_){}
        if(hi < 0){
          // aim-assist cone (same as spiders) so you don't need pixel-perfect aim
          const fLen = Math.hypot(fwd.x, fwd.z) || 1;
          const dx = fwd.x / fLen, dz = fwd.z / fLen;
          let bestT = 1e9;
          for(let i = 0; i < H.length; i++){
            const a = H[i]; if(!a || a.dead) continue;
            const ddx = a.x - Player.pos.x, ddz = a.z - Player.pos.z;
            const dist = Math.hypot(ddx, ddz);
            if(dist > 50) continue;
            const dot = (ddx * dx + ddz * dz) / Math.max(0.01, dist);
            if(dot < aimNeed(dist)) continue;   // must be in front of your aim
            if(dist < bestT){ bestT = dist; hi = i; }
          }
        }
        if(hi >= 0 && typeof H[hi].onKill === 'function'){ try { H[hi].onKill(); } catch(_){} }
      }
      // ── Shoot a thief: a printer-bot raiding your base or fleeing with a
      //    brainrot stolen from you can be gunned down with ANY weapon. ──
      if(typeof window.fwShootableBots === 'function'){
        const tb = window.fwShootableBots();
        if(tb && tb.length){
          let hit = null;
          try {
            const objs = tb.map(b => b.mesh).filter(Boolean);
            const hits = _raycaster.intersectObjects(objs, true);
            if(hits.length){
              let o = hits[0].object;
              while(o && !tb.find(b => b.mesh === o)) o = o.parent;
              if(o) hit = tb.find(b => b.mesh === o);
            }
          } catch(_){}
          if(!hit){
            // aim-assist cone (same as spiders) so you don't need pixel-perfect aim
            const fLen = Math.hypot(fwd.x, fwd.z) || 1;
            const dx = fwd.x / fLen, dz = fwd.z / fLen;
            let bestT = 1e9;
            for(const b of tb){
              const ddx = b.x - Player.pos.x, ddz = b.z - Player.pos.z;
              const dist = Math.hypot(ddx, ddz);
              if(dist > 60) continue;
              const dot = (ddx * dx + ddz * dz) / Math.max(0.01, dist);
              if(dot < aimNeed(dist)) continue;   // must be in front of your aim
              if(dist < bestT){ bestT = dist; hit = b; }
            }
          }
          if(hit){ try { window.fwKillThief(hit); window.fwSkillXp?.('weapon', 0); } catch(_){} }
        }
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
          // Fart kills drop Spider Meat too
          try { window.fwDropAt?.('spider_meat', 1, sx, sz); } catch(_){}
          killed++;
        }
      }
      if(killed > 0){
        State.spidersKilled = (State.spidersKilled || 0) + killed;
        State.credits = (State.credits || 0) + killed * 5;
        window.fwSkillXp?.('fart', killed * 8);
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
    // ── Full-auto fire (AK-47): hold the trigger to spray ──
    let autoTimer = null;
    function autoBlocked(){
      return !owned(ACTIVE) || window.fwGunHolstered || window.fwSleeping
        || (window.Player && window.Player.boat)
        || (window.Dm && (window.Dm.phase === 'active' || window.Dm.phase === 'countdown'))
        || document.getElementById('invBg')?.classList.contains('show');
    }
    function startAuto(){
      stopAuto();
      const w = WEAPONS[ACTIVE]; if(!w || !w.auto) return;
      autoTimer = setInterval(() => {
        if(autoBlocked() || (MAG[ACTIVE] || 0) <= 0){ stopAuto(); return; }
        fire();
      }, w.rof || 100);
    }
    function stopAuto(){ if(autoTimer){ clearInterval(autoTimer); autoTimer = null; } }
    window.addEventListener('mouseup', (e) => { if(e.button === 0) stopAuto(); });
    window.addEventListener('blur', stopAuto);

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
      // (Gamepad shots carry _fwPad and skip the lock requirement.)
      if(actionLive && !e._fwPad && document.pointerLockElement !== document.getElementById('canvas')) return;
      // During a deathmatch the DM weapons own the trigger (unlimited
      // ammo) — never fire/dry-fire the inventory Deagle on top of them.
      if(window.Dm && (window.Dm.phase === 'active' || window.Dm.phase === 'countdown')) return;
      // No shooting while piloting anything (plane / boat / yacht / rocket)
      if(window.Player && window.Player.boat) return;
      // No shooting in your sleep
      if(window.fwSleeping) return;
      // No shooting while the inventory is open
      if(document.getElementById('invBg')?.classList.contains('show')) return;
      // Weapon holstered (EQUIPMENT panel) → no firing
      if(window.fwGunHolstered){
        window.floater?.('🔫 Weapon holstered — draw it in your inventory’s EQUIPMENT panel', 'bad');
        return;
      }
      // Arena waiting panel open = it's a menu; let its buttons be clicked.
      const _dmw = document.getElementById('dmWaiting');
      if(_dmw && _dmw.style.display !== 'none' &&
         document.getElementById('dmOverlay')?.classList.contains('show')) return;
      // Mouse is over a HUD button (right-side rail etc.) → it's a UI click,
      // never a shot. Let the button receive it.
      if(window.fwUiHover) return;
      e.preventDefault();
      // Block if a modal is open
      if(document.querySelector('.gs-bg.show, .bank-bg.show, .junk-bg.show, .est-bg.show, .stor-bg.show, .dc-bg.show, .alex-pop.show, .wave-bg.show, .gary-bg.show, #invBg.show, #marketBg.show, #poopBg.show, .fc-bg.show, .carlos-bg.show, .roki-bg.show, .fw-rank-bg.show, .fw-warn-bg.show')) return;
      // Block if click is on a button/UI element
      const tgt = e.target;
      if(tgt && tgt.tagName && /^(BUTTON|A|INPUT|TEXTAREA|SELECT|LABEL)$/.test(tgt.tagName)) return;
      if(tgt && tgt.closest && tgt.closest('button, a, input, textarea, select, label, .gs-pop, .alex-pop, .roki-near, .plane-prox, .tut-card, .junk-pop, #npcPop')) return;
      // Must own the active weapon
      if(!owned(ACTIVE)) return;
      fire();
      if(WEAPONS[ACTIVE] && WEAPONS[ACTIVE].auto) startAuto();   // hold to spray
    });

    console.log('[gunsmith] ready at', SHOP_POS);
  }
})();
