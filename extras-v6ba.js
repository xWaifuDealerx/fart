// =================================================================
// extras-v6ba.js — Hotel, Health bar, Gary fallback, global right-click block
// =================================================================
(function(){
  'use strict';

  // ─────────────────────────────────────────────────────────────────
  // 1) GLOBAL RIGHT-CLICK BLOCK — fires on capture so it beats every
  //    other contextmenu listener (and also covers all modal panels).
  // ─────────────────────────────────────────────────────────────────
  document.addEventListener('contextmenu', (e) => e.preventDefault(), true);

  function whenReady(){
    if(!window.THREE || !window.scene || !window.Player || !window.State || !window.groundHeightAt){
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
    const groundHeightAt = window.groundHeightAt;

    // ─────────────────────────────────────────────────────────────
    // 2) HEALTH BAR + DAMAGE MODEL
    //    State.hp / State.maxHp persisted via main module's saveState.
    //    Slow passive regen (1 hp / 30s). Fall damage when vy spikes
    //    downward into ground. Spider contact does small damage.
    // ─────────────────────────────────────────────────────────────
    if(typeof State.maxHp !== 'number') State.maxHp = 100;
    if(typeof State.hp !== 'number') State.hp = State.maxHp;
    // HUD pill (top-left under the silver/gold widgets)
    const hpStyle = document.createElement('style');
    hpStyle.textContent = `
.hp-pill{position:fixed;top:14px;left:50%;transform:translateX(-50%);z-index:46;background:rgba(8,18,11,.86);border:1px solid rgba(255,90,90,.5);border-radius:100px;padding:5px 14px 5px 8px;display:flex;align-items:center;gap:10px;font-family:'Outfit','Inter',sans-serif;color:#fff1c2;box-shadow:0 6px 16px rgba(0,0,0,.4)}
.hp-pill .icon{font-size:16px;line-height:1}
.hp-pill .bar{width:130px;height:10px;background:rgba(255,90,90,.18);border:1px solid rgba(255,90,90,.45);border-radius:100px;overflow:hidden;position:relative}
.hp-pill .fill{position:absolute;left:0;top:0;bottom:0;width:100%;background:linear-gradient(90deg,#ff5a5a,#ff9a9a);transition:width .3s ease;border-radius:100px}
.hp-pill .num{font-family:'JetBrains Mono',monospace;font-size:11px;font-weight:700;color:#ff9a9a;min-width:54px;text-align:right}
.hp-pill.crit .fill{background:linear-gradient(90deg,#ff3030,#ff7070);animation:hpPulse 0.8s ease infinite}
@keyframes hpPulse{0%,100%{opacity:1}50%{opacity:.55}}
`;
    document.head.appendChild(hpStyle);
    const hpPill = document.createElement('div');
    hpPill.className = 'hp-pill';
    hpPill.innerHTML = '<span class="icon">❤️</span><div class="bar"><div class="fill" id="hpFill"></div></div><span class="num" id="hpNum">100/100</span>';
    document.body.appendChild(hpPill);
    function renderHp(){
      const max = Math.max(1, State.maxHp);
      const hp  = Math.max(0, Math.min(max, State.hp));
      document.getElementById('hpFill').style.width = (hp / max * 100) + '%';
      document.getElementById('hpNum').textContent = Math.round(hp) + '/' + max;
      hpPill.classList.toggle('crit', hp / max < 0.25);
    }
    renderHp();
    setInterval(renderHp, 500);

    // Damage API
    window.damagePlayer = function(amount, reason){
      if(!amount || amount <= 0) return;
      State.hp = Math.max(0, (State.hp || 0) - amount);
      window.floater?.('-' + Math.round(amount) + ' HP' + (reason ? ' · ' + reason : ''), 'bad');
      renderHp();
      window.saveState?.();
      if(State.hp <= 0){ try { onDeath(); } catch(_){} }
    };
    function onDeath(){
      // Reset HP, ship to hospital, no inventory wipe (gunshot != bust).
      State.hp = State.maxHp;
      if(typeof window.respawnAtHospital === 'function') window.respawnAtHospital();
      window.floater?.('💀 You died — patched up at the hospital', 'bad');
      renderHp();
      window.saveState?.();
    }
    // Heal API — Hospital uses this
    window.healPlayer = function(amount){
      State.hp = Math.min(State.maxHp, (State.hp || 0) + Math.max(0, amount));
      renderHp();
      window.saveState?.();
    };

    // Passive regen — 1 hp per 30s
    setInterval(() => {
      if(State.hp < State.maxHp){
        State.hp = Math.min(State.maxHp, State.hp + 1);
        renderHp();
      }
    }, 30000);

    // Fall damage — watch vertical landing impact
    let lastY = Player.pos.y, falling = false, fallStart = 0;
    setInterval(() => {
      const y = Player.pos.y;
      if(!falling && y < lastY - 0.4){
        falling = true; fallStart = lastY;
      }
      if(falling && Player.airborne === false){
        const dropped = fallStart - y;
        falling = false;
        if(dropped > 4){
          const dmg = Math.min(60, (dropped - 4) * 5);
          window.damagePlayer(dmg, '💥 fall');
        }
      }
      lastY = y;
    }, 200);

    // Spider damage — patch the existing knockback in gunsmith.js by
    // checking each spider every tick.
    function spiderTick(){
      // Find spiders via window — gunsmith.js doesn't expose them so
      // we just check if any are very close to the player by reading
      // group children near the player position.
      const Spiders = window.Spiders || [];
      let bit = false;
      for(const s of Spiders){
        if(!s || s.dead) continue;
        const d = Math.hypot(s.x - Player.pos.x, s.z - Player.pos.z);
        if(d < 1.4 && !s._lastBite){
          s._lastBite = performance.now();
        }
        if(s._lastBite && performance.now() - s._lastBite > 1500){
          s._lastBite = performance.now();
          bit = true;
        }
      }
      if(bit) window.damagePlayer(8, '🕷️ spider bite');
      requestAnimationFrame(spiderTick);
    }
    requestAnimationFrame(spiderTick);

    // ─────────────────────────────────────────────────────────────
    // 3) GARY PAWN SHOP FALLBACK — opens a small modal selling
    //    fartjars at 125% of market price. Static-npcs.js's npcPop
    //    will call window.openGary when the user clicks Open or
    //    presses E near Gary.
    // ─────────────────────────────────────────────────────────────
    const gStyle = document.createElement('style');
    gStyle.textContent = `
.gary-bg{position:fixed;inset:0;display:none;align-items:center;justify-content:center;background:rgba(0,0,0,.78);backdrop-filter:blur(10px);z-index:200;padding:18px}
.gary-bg.show{display:flex}
.gary-card{background:linear-gradient(180deg,rgba(28,18,8,.97),rgba(18,10,4,.97));border:2px solid rgba(255,206,74,.55);border-radius:18px;max-width:420px;width:100%;color:#fff1c2;font-family:'Outfit','Inter',sans-serif}
.gary-card .hd{display:flex;justify-content:space-between;align-items:center;padding:18px 22px;border-bottom:1px solid rgba(255,206,74,.18)}
.gary-card .hd h2{font-family:'Bangers','Orbitron',sans-serif;font-size:24px;color:#ffd64d;letter-spacing:1.8px;margin:0}
.gary-card .hd .x{background:transparent;border:0;color:rgba(255,241,194,.55);font-size:22px;cursor:pointer}
.gary-card .bd{padding:16px 22px}
.gary-row{display:flex;justify-content:space-between;align-items:center;padding:10px 12px;background:rgba(255,206,74,.07);border:1px solid rgba(255,206,74,.25);border-radius:10px;margin-bottom:8px;font-size:13px}
.gary-row b{color:#ffd64d}
.gary-sell{background:linear-gradient(135deg,#ffd64d,#fff1c2);color:#1a1408;border:0;padding:7px 14px;border-radius:100px;font-family:'Orbitron',sans-serif;font-weight:900;font-size:11px;cursor:pointer;letter-spacing:.6px}
`;
    document.head.appendChild(gStyle);
    const garyBg = document.createElement('div');
    garyBg.className = 'gary-bg';
    garyBg.innerHTML = '<div class="gary-card"><div class="hd"><h2>🏚 GARY\'S PAWN</h2><button class="x" id="garyX">×</button></div><div class="bd" id="garyBd"></div></div>';
    document.body.appendChild(garyBg);
    document.getElementById('garyX').addEventListener('click', () => garyBg.classList.remove('show'));
    garyBg.addEventListener('click', (e) => { if(e.target === garyBg) garyBg.classList.remove('show'); });
    function renderGary(){
      const body = document.getElementById('garyBd');
      const ITEMS = window.ITEMS || {};
      // Find every fartjar* in inventory and offer to sell @ 125% market.
      const rows = [];
      for(const id of Object.keys(State.inventory || {})){
        if(!id.startsWith('fartjar_')) continue;
        const count = State.inventory[id] || 0;
        if(count <= 0) continue;
        const item = ITEMS[id] || {};
        const price = Math.round((item.marketPrice || item.suggestedPrice || 50) * 1.25);
        rows.push('<div class="gary-row"><div><b>' + (item.name || id) + '</b> · ×' + count + '</div><button class="gary-sell" data-id="' + id + '" data-p="' + price + '">Sell 1 · ' + price + ' 🥈</button></div>');
      }
      if(!rows.length){
        body.innerHTML = '<p style="font-size:12.5px;line-height:1.55;color:rgba(230,255,238,.7);">No Fart Jars in your inventory. Gary pays a +25% premium on jars from the Fart Filling Station — bring some back.</p>';
      } else {
        body.innerHTML = '<p style="font-size:11.5px;color:rgba(230,255,238,.65);margin-bottom:10px;">Gary buys Fart Jars at a <b>+25% premium</b> in 🥈 silver.</p>' + rows.join('');
        body.querySelectorAll('.gary-sell').forEach(b => {
          b.addEventListener('click', () => {
            const id = b.dataset.id, price = Number(b.dataset.p);
            if((State.inventory[id] || 0) <= 0) return;
            window.takeItem?.(id, 1);
            State.credits = (State.credits || 0) + price;
            window.floater?.('+' + price + ' 🥈 · sold 1 ' + (ITEMS[id]?.name || id), 'good');
            window.playPurchaseSound?.();
            window.saveState?.();
            window.updateHUD?.();
            renderGary();
          });
        });
      }
    }
    window.openGary = function(){ renderGary(); garyBg.classList.add('show'); };

    // ─────────────────────────────────────────────────────────────
    // 4) HOTEL — building + booking modal + idle safe zone + timer
    // ─────────────────────────────────────────────────────────────
    const HOTEL_POS = { x: -64, z: 18 };
    const HOTEL_R = 6;
    const HOTEL_RATE = 25; // silver per hour
    const HOTEL_MAX_HOURS = 72;
    if(typeof State.hotelBookedUntil !== 'number') State.hotelBookedUntil = 0;
    function buildHotel(){
      const grp = new THREE.Group();
      const y0 = groundHeightAt(HOTEL_POS.x, HOTEL_POS.z);
      grp.position.set(HOTEL_POS.x, y0, HOTEL_POS.z);
      const wallMat = new THREE.MeshStandardMaterial({ color: 0x6a4a8a, roughness: 0.55 });
      const trimMat = new THREE.MeshStandardMaterial({ color: 0xffd64d, roughness: 0.4 });
      const glassMat = new THREE.MeshStandardMaterial({ color: 0xc8e0ff, transparent: true, opacity: 0.45, roughness: 0.2, emissive: 0x6090c0, emissiveIntensity: 0.25 });
      const roofMat = new THREE.MeshStandardMaterial({ color: 0x402a60, roughness: 0.6 });
      // Floor pad
      const base = new THREE.Mesh(new THREE.BoxGeometry(8.0, 0.3, 7.0), trimMat);
      base.position.y = 0.15; base.receiveShadow = true; grp.add(base);
      window.WalkableSurfaces?.push(base);
      // Two-story body
      const story1 = new THREE.Mesh(new THREE.BoxGeometry(7.4, 3.0, 6.4), wallMat);
      story1.position.y = 1.8; story1.castShadow = true; grp.add(story1);
      const story2 = new THREE.Mesh(new THREE.BoxGeometry(7.0, 2.8, 6.0), wallMat);
      story2.position.y = 4.6; story2.castShadow = true; grp.add(story2);
      // Roof
      const roof = new THREE.Mesh(new THREE.BoxGeometry(7.6, 0.3, 6.4), roofMat);
      roof.position.y = 6.15; grp.add(roof);
      // Windows (4 per side, lit at night)
      for(const fy of [1.7, 4.5]){
        for(const fx of [-2.4, -0.8, 0.8, 2.4]){
          const w = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.8, 0.05), glassMat);
          w.position.set(fx, fy, 3.21); grp.add(w);
        }
      }
      // Door + steps
      const door = new THREE.Mesh(new THREE.BoxGeometry(1.4, 2.3, 0.05), new THREE.MeshStandardMaterial({ color: 0x402a60, roughness: 0.7 }));
      door.position.set(0, 1.35, 3.22); grp.add(door);
      // Awning
      const awn = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.15, 1.4), trimMat);
      awn.position.set(0, 2.7, 3.9); grp.add(awn);
      // Sign canvas
      const cvs = document.createElement('canvas');
      cvs.width = 600; cvs.height = 140;
      const ctx = cvs.getContext('2d');
      ctx.fillStyle = '#1c0e2a'; ctx.fillRect(0, 0, 600, 140);
      ctx.strokeStyle = '#ffd64d'; ctx.lineWidth = 5;
      ctx.strokeRect(5, 5, 590, 130);
      ctx.fillStyle = '#ffd64d';
      ctx.font = "900 64px 'Bangers','Orbitron',sans-serif";
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('🏨 HOTEL', 300, 60);
      ctx.fillStyle = '#fff1c2';
      ctx.font = "700 22px 'Orbitron',sans-serif";
      ctx.fillText('· SAFE ZONE · ' + HOTEL_RATE + ' 🥈/HR ·', 300, 105);
      const tex = new THREE.CanvasTexture(cvs); tex.anisotropy = 4;
      const sign = new THREE.Mesh(new THREE.PlaneGeometry(5.0, 1.2),
        new THREE.MeshStandardMaterial({ map: tex, emissive: 0xffd64d, emissiveIntensity: 0.4, roughness: 0.55, side: THREE.DoubleSide }));
      sign.position.set(0, 6.6, 3.22); grp.add(sign);
      // Soft glow at night
      const lt = new THREE.PointLight(0xffce8a, 1.2, 18);
      lt.position.set(0, 5.8, 0); grp.add(lt);
      scene.add(grp);
    }
    try { buildHotel(); } catch(e){ console.error('[hotel] build', e); }

    // Proximity prompt + booking modal
    const hStyle = document.createElement('style');
    hStyle.textContent = `
.hot-pop{position:fixed;left:50%;bottom:130px;transform:translateX(-50%);display:none;background:linear-gradient(180deg,rgba(28,14,40,.96),rgba(14,8,22,.96));border:2px solid rgba(255,206,74,.6);border-radius:14px;padding:12px 18px;z-index:50;text-align:center;font-family:'Outfit','Inter',sans-serif}
.hot-pop.show{display:block}
.hot-pop .who{font-size:11px;color:#ffd64d;margin-bottom:5px;letter-spacing:.4px}
.hot-pop .line{font-family:'Bangers',sans-serif;font-size:16px;color:#fff1c2;letter-spacing:.6px;margin-bottom:8px}
.hot-pop kbd{background:rgba(255,206,74,.22);border:1px solid rgba(255,206,74,.55);color:#ffd64d;padding:2px 8px;border-radius:6px;font-family:'JetBrains Mono',monospace;font-size:11px;font-weight:700}
.hot-pop .btn{background:rgba(255,206,74,.18);border:1px solid rgba(255,206,74,.55);color:#ffd64d;padding:7px 14px;border-radius:8px;font-family:'Outfit',sans-serif;font-weight:700;font-size:12px;cursor:pointer;margin-top:6px}
.hot-bg{position:fixed;inset:0;display:none;align-items:center;justify-content:center;background:rgba(0,0,0,.78);backdrop-filter:blur(10px);z-index:200;padding:18px}
.hot-bg.show{display:flex}
.hot-card{background:linear-gradient(180deg,rgba(28,14,40,.97),rgba(14,8,22,.97));border:2px solid rgba(255,206,74,.55);border-radius:18px;max-width:420px;width:100%;color:#fff1c2;font-family:'Outfit','Inter',sans-serif}
.hot-card .hd{display:flex;justify-content:space-between;align-items:center;padding:18px 22px;border-bottom:1px solid rgba(255,206,74,.18)}
.hot-card .hd h2{font-family:'Bangers','Orbitron',sans-serif;font-size:24px;color:#ffd64d;letter-spacing:1.8px;margin:0}
.hot-card .hd .x{background:transparent;border:0;color:rgba(255,241,194,.55);font-size:22px;cursor:pointer}
.hot-card .bd{padding:18px 22px}
.hot-card .row{display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;font-size:13px}
.hot-card .row input{background:rgba(255,206,74,.10);border:1px solid rgba(255,206,74,.4);color:#fff1c2;padding:7px 10px;border-radius:8px;font-family:'JetBrains Mono',monospace;font-size:14px;width:80px;text-align:center}
.hot-card .pay{width:100%;background:linear-gradient(135deg,#ffd64d,#fff1c2);color:#1a1408;border:0;padding:11px 16px;border-radius:100px;font-family:'Orbitron',sans-serif;font-weight:900;font-size:12px;cursor:pointer;letter-spacing:.6px;margin-top:8px;text-transform:uppercase}
.hot-card .pay:disabled{opacity:.5;cursor:not-allowed}
.hot-card .status{background:rgba(95,240,156,.10);border:1px solid rgba(95,240,156,.4);border-radius:10px;padding:10px 12px;margin-bottom:12px;font-size:12.5px;color:#a8ffd0}
.hot-card .status b{color:#5ff09c}
.hot-timer{position:fixed;left:14px;bottom:14px;z-index:46;background:rgba(28,14,40,.92);border:2px solid rgba(255,206,74,.55);border-radius:12px;padding:8px 12px;display:none;font-family:'Outfit','Inter',sans-serif;color:#fff1c2;box-shadow:0 6px 16px rgba(0,0,0,.4)}
.hot-timer.show{display:block}
.hot-timer .l{font-size:10px;color:#ffd64d;letter-spacing:.4px;margin-bottom:3px}
.hot-timer .bar{width:160px;height:8px;background:rgba(255,206,74,.18);border:1px solid rgba(255,206,74,.4);border-radius:100px;overflow:hidden;position:relative;margin-bottom:2px}
.hot-timer .bf{position:absolute;left:0;top:0;bottom:0;background:linear-gradient(90deg,#ffd64d,#fff1c2);border-radius:100px;transition:width 1s linear}
.hot-timer .t{font-family:'JetBrains Mono',monospace;font-size:11px;color:#ffd64d}
`;
    document.head.appendChild(hStyle);
    const hPop = document.createElement('div');
    hPop.className = 'hot-pop';
    hPop.innerHTML = '<div class="who">🏨 Hotel</div><div class="line">Check in & idle in peace</div><div>Press <kbd>E</kbd> or click below</div><button class="btn" id="hotPopBtn">Book a Room</button>';
    document.body.appendChild(hPop);
    const hBg = document.createElement('div');
    hBg.className = 'hot-bg';
    hBg.innerHTML = '<div class="hot-card"><div class="hd"><h2>🏨 HOTEL</h2><button class="x" id="hotX">×</button></div><div class="bd" id="hotBd"></div></div>';
    document.body.appendChild(hBg);
    document.getElementById('hotX').addEventListener('click', () => hBg.classList.remove('show'));
    hBg.addEventListener('click', (e) => { if(e.target === hBg) hBg.classList.remove('show'); });
    const hTimer = document.createElement('div');
    hTimer.className = 'hot-timer';
    hTimer.innerHTML = '<div class="l">🏨 HOTEL</div><div class="bar"><div class="bf" id="hotBf"></div></div><div class="t" id="hotT">—</div>';
    document.body.appendChild(hTimer);

    function bookedRemainingMs(){ return Math.max(0, (State.hotelBookedUntil || 0) - Date.now()); }
    function bookedRemainingHrs(){ return bookedRemainingMs() / 3600000; }
    function renderBook(){
      const bd = document.getElementById('hotBd');
      const remHrs = bookedRemainingHrs();
      const remHdr = remHrs > 0
        ? '<div class="status">You currently have <b>' + remHrs.toFixed(2) + ' hours</b> booked.</div>'
        : '';
      const maxExtra = Math.max(0, HOTEL_MAX_HOURS - remHrs);
      bd.innerHTML = remHdr
        + '<div class="row"><div>Rate</div><div><b>' + HOTEL_RATE + ' 🥈 / hour</b></div></div>'
        + '<div class="row"><div>Hours</div><input type="number" id="hotHrs" value="1" min="1" max="' + Math.floor(Math.max(1, maxExtra)) + '"/></div>'
        + '<div class="row"><div>Total</div><div id="hotTotal"><b>' + HOTEL_RATE + ' 🥈</b></div></div>'
        + '<div class="row"><div>Max remaining</div><div>' + maxExtra.toFixed(1) + ' h</div></div>'
        + '<button class="pay" id="hotPay">Check in / extend booking</button>';
      const inp = document.getElementById('hotHrs');
      const total = document.getElementById('hotTotal');
      function refresh(){
        const h = Math.max(1, Math.min(Math.floor(maxExtra) || 1, Number(inp.value) || 1));
        total.innerHTML = '<b>' + (h * HOTEL_RATE) + ' 🥈</b>';
      }
      inp.addEventListener('input', refresh);
      refresh();
      document.getElementById('hotPay').addEventListener('click', () => {
        const h = Math.max(1, Math.min(Math.floor(maxExtra) || 1, Number(inp.value) || 1));
        const cost = h * HOTEL_RATE;
        if((State.credits || 0) < cost){ window.floater?.('Need ' + cost + ' 🥈', 'bad'); return; }
        State.credits -= cost;
        const base = Math.max(Date.now(), State.hotelBookedUntil || 0);
        State.hotelBookedUntil = base + h * 3600000;
        window.floater?.('🏨 +' + h + ' h booked', 'good');
        window.playPurchaseSound?.();
        window.saveState?.();
        window.updateHUD?.();
        renderBook();
      });
    }
    function openHotel(){ renderBook(); hBg.classList.add('show'); }
    window.openHotel = openHotel;
    document.getElementById('hotPopBtn').addEventListener('click', openHotel);

    function isInsideHotel(){
      return Math.hypot(Player.pos.x - HOTEL_POS.x, Player.pos.z - HOTEL_POS.z) < 4.5;
    }

    let nearHotel = false;
    setInterval(() => {
      nearHotel = Math.hypot(Player.pos.x - HOTEL_POS.x, Player.pos.z - HOTEL_POS.z) < HOTEL_R;
      hPop.classList.toggle('show', nearHotel);
      // Timer: show only when player is INSIDE and has booking
      const rem = bookedRemainingMs();
      if(isInsideHotel() && rem > 0){
        hTimer.classList.add('show');
        const totalHrs = Math.max(0.001, Math.min(HOTEL_MAX_HOURS, rem / 3600000));
        document.getElementById('hotBf').style.width = Math.min(100, totalHrs / HOTEL_MAX_HOURS * 100) + '%';
        const s = Math.floor(rem / 1000);
        const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), ss = s % 60;
        document.getElementById('hotT').textContent = h + 'h ' + String(m).padStart(2, '0') + 'm ' + String(ss).padStart(2, '0') + 's';
      } else {
        hTimer.classList.remove('show');
      }
    }, 500);

    // E key opens the hotel modal when near
    window.addEventListener('keydown', (e) => {
      if(e.code !== 'KeyE') return;
      const a = document.activeElement;
      if(a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA')) return;
      if(!nearHotel) return;
      if(document.querySelector('.hot-bg.show, .gary-bg.show, .gs-bg.show, .bank-bg.show, .stor-bg.show, .dc-bg.show, .alex-pop.show, .wave-bg.show, #invBg.show, #marketBg.show, #poopBg.show, .carlos-bg.show, .fc-bg.show, .junk-bg.show, .est-bg.show')) return;
      openHotel();
    });

    // Safe zone — inside hotel WITH active booking: kill nearby spiders
    setInterval(() => {
      if(!isInsideHotel()) return;
      if(bookedRemainingMs() <= 0) return;
      if(typeof window.killSpidersNear === 'function'){
        // Push them out without giving credit for the kill (radius=8)
        try { window.killSpidersNear(Player.pos.x, Player.pos.z, 8); } catch(_){}
      }
    }, 2000);

    // Add Hotel landmark to minimap
    try {
      if(window.MinimapLandmarks){
        window.MinimapLandmarks.push({ x: HOTEL_POS.x, z: HOTEL_POS.z, label: 'Hotel', color: '#ffd64d' });
      }
    } catch(_){}

    // ─────────────────────────────────────────────────────────────
    // 5) HOSPITAL HEAL BUTTON — when near the hospital, press E or
    //    click a small popup to fully heal for 30 silver.
    // ─────────────────────────────────────────────────────────────
    const HOSPITAL_POS = window.HOSPITAL_POS || { x: -64, z: -8 };
    const HOSP_R = 5;
    const HEAL_PRICE = 30;
    const hospPop = document.createElement('div');
    hospPop.className = 'hot-pop';
    hospPop.innerHTML = '<div class="who">🏥 Hospital</div><div class="line">Full HP heal</div><div>Press <kbd>E</kbd> or click below</div><button class="btn" id="hospPopBtn">Heal · ' + HEAL_PRICE + ' 🥈</button>';
    document.body.appendChild(hospPop);
    function tryHeal(){
      if(State.hp >= State.maxHp){ window.floater?.('Already full HP', 'bad'); return; }
      if((State.credits || 0) < HEAL_PRICE){ window.floater?.('Need ' + HEAL_PRICE + ' 🥈', 'bad'); return; }
      State.credits -= HEAL_PRICE;
      window.healPlayer(State.maxHp);
      window.floater?.('🏥 +' + (State.maxHp) + ' HP', 'good');
      window.playPurchaseSound?.();
      window.updateHUD?.();
    }
    document.getElementById('hospPopBtn').addEventListener('click', tryHeal);
    let nearHosp = false;
    setInterval(() => {
      nearHosp = Math.hypot(Player.pos.x - HOSPITAL_POS.x, Player.pos.z - HOSPITAL_POS.z) < HOSP_R;
      hospPop.classList.toggle('show', nearHosp);
    }, 500);
    window.addEventListener('keydown', (e) => {
      if(e.code !== 'KeyE') return;
      const a = document.activeElement;
      if(a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA')) return;
      if(!nearHosp) return;
      if(document.querySelector('.hot-bg.show, .gary-bg.show, .gs-bg.show, .bank-bg.show, .stor-bg.show')) return;
      tryHeal();
    });

    console.log('[extras-v6ba] ready · Hotel, HP, Gary, Hospital heal');
  }
})();
