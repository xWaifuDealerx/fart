// =================================================================
// extras-v6bi.js — Apartments, referral-button restyle to match
//                   the existing inv-toggle buttons exactly.
// =================================================================
(function(){
  'use strict';

  // 1) BUTTON BLEND — match .inv-toggle styling exactly so the
  //    🤝 button feels like a sibling of 🎒 / 💼 / 🏆.
  const css = document.createElement('style');
  css.textContent = `
.fw-ref-btn{
  position: fixed !important;
  top: 188px !important;
  right: 14px !important;
  width: 44px !important;
  height: 44px !important;
  border-radius: 12px !important;
  background: rgba(8,18,11,0.65) !important;
  -webkit-backdrop-filter: blur(10px) !important;
  backdrop-filter: blur(10px) !important;
  border: 1px solid rgba(46,224,107,0.20) !important;
  color: #5ff09c !important;
  font-size: 22px !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  cursor: pointer !important;
  pointer-events: auto !important;
  transition: all 0.15s !important;
  z-index: 14 !important;
  box-shadow: none !important;
  padding: 0 !important;
}
.fw-ref-btn:hover{
  border-color: #5ff09c !important;
  box-shadow: 0 0 16px rgba(46,224,107,0.30) !important;
  transform: none !important;
  background: rgba(8,18,11,0.65) !important;
}
`;
  document.head.appendChild(css);

  function whenReady(){
    if(!window.State || !window.Player || !window.THREE || !window.scene){
      setTimeout(whenReady, 300); return;
    }
    init();
  }
  whenReady();

  function init(){
    const State = window.State;
    const Player = window.Player;
    const THREE = window.THREE;
    const scene = window.scene;
    const gh = window.groundHeightAt || (() => 0);

    // ──────────────────────────────────────────────────────────────
    // APARTMENTS
    //   Two buildings shipped:
    //     • Shabby Soviet at (15, -71) — 1,000,000 silver
    //     • Middle-class at (-11, 37) — 3,000,000 silver
    //   Owning an apartment means: no daily fee, sleep in it
    //   (E to enter "sleeping" mode like the hotel) and you can
    //   rent it out for 1–365 days, collecting silver per day in
    //   passive income while rented.
    // ──────────────────────────────────────────────────────────────
    const APARTMENTS = [
      {
        id:    'apt_soviet',
        name:  'Soviet Block Apartment',
        kind:  'shabby',
        pos:   { x: 15, z: -71 },
        price: 1000000,
        rentPerDay: 800,
        color: { wall: 0x9a8d7a, trim: 0x4a4035, sign: '#d04040' },
      },
      {
        id:    'apt_middle',
        name:  'Middle-Class Apartment',
        kind:  'middle',
        pos:   { x: -11, z: 37 },
        price: 3000000,
        rentPerDay: 2400,
        color: { wall: 0xd0c0a0, trim: 0x6a5a3a, sign: '#5ff09c' },
      },
      {
        id:    'apt_luxury',
        name:  'Luxury Penthouse',
        kind:  'luxury',
        pos:   { x: 12, z: 69 },
        price: 10000000,
        rentPerDay: 12000,    // 12k/day — better return than the middle class
        color: { wall: 0xf0e6c8, trim: 0xffd64d, sign: '#ffd64d' },
      },
    ];

    if(!State.apartments) State.apartments = {};

    // ── Build the meshes ──
    function buildApartment(apt){
      const grp = new THREE.Group();
      const y0 = gh(apt.pos.x, apt.pos.z);
      grp.position.set(apt.pos.x, y0, apt.pos.z);
      const wallMat = new THREE.MeshStandardMaterial({ color: apt.color.wall, roughness: 0.75 });
      const trimMat = new THREE.MeshStandardMaterial({ color: apt.color.trim, roughness: 0.65 });
      const windMat = new THREE.MeshStandardMaterial({ color: 0xa8c8e0, transparent: true, opacity: 0.45, emissive: 0x4060a0, emissiveIntensity: 0.18, roughness: 0.2 });
      const roofMat = new THREE.MeshStandardMaterial({ color: 0x2a2a2a, roughness: 0.6 });

      // Floor pad
      const base = new THREE.Mesh(new THREE.BoxGeometry(8.0, 0.3, 7.0), trimMat);
      base.position.y = 0.15; base.receiveShadow = true;
      grp.add(base);
      window.WalkableSurfaces?.push(base);

      // Two-story body
      const story1 = new THREE.Mesh(new THREE.BoxGeometry(7.4, 3.0, 6.4), wallMat);
      story1.position.y = 1.8; story1.castShadow = true; grp.add(story1);
      const story2 = new THREE.Mesh(new THREE.BoxGeometry(7.0, 2.8, 6.0), wallMat);
      story2.position.y = 4.6; story2.castShadow = true; grp.add(story2);
      const roof = new THREE.Mesh(new THREE.BoxGeometry(7.6, 0.3, 6.4), roofMat);
      roof.position.y = 6.15; grp.add(roof);

      // Windows
      for(const fy of [1.7, 4.5]){
        for(const fx of [-2.4, -0.8, 0.8, 2.4]){
          const w = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.75, 0.05), windMat);
          w.position.set(fx, fy, 3.21); grp.add(w);
        }
      }

      // Soviet flavor: cracked panel marks + grime
      if(apt.kind === 'shabby'){
        for(let i = 0; i < 6; i++){
          const crack = new THREE.Mesh(
            new THREE.BoxGeometry(0.04, 0.4 + Math.random()*0.5, 0.05),
            new THREE.MeshStandardMaterial({ color: 0x2a2a25, roughness: 0.95 })
          );
          crack.position.set(-3 + Math.random()*6, 1.5 + Math.random()*3, 3.22);
          crack.rotation.z = (Math.random()-0.5) * 0.6;
          grp.add(crack);
        }
      }

      // Door
      const door = new THREE.Mesh(new THREE.BoxGeometry(1.4, 2.3, 0.05),
        new THREE.MeshStandardMaterial({ color: apt.kind === 'shabby' ? 0x4a3a2a : 0x6a3a18, roughness: 0.7 }));
      door.position.set(0, 1.35, 3.22); grp.add(door);

      // Sign on front
      const cvs = document.createElement('canvas');
      cvs.width = 540; cvs.height = 130;
      const ctx = cvs.getContext('2d');
      ctx.fillStyle = '#1a0e0a'; ctx.fillRect(0, 0, 540, 130);
      ctx.strokeStyle = apt.color.sign; ctx.lineWidth = 4;
      ctx.strokeRect(4, 4, 532, 122);
      ctx.fillStyle = apt.color.sign;
      ctx.font = "900 44px 'Bangers','Orbitron',sans-serif";
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText((apt.kind === 'shabby' ? '🏚 ' : '🏢 ') + apt.name.toUpperCase(), 270, 56);
      ctx.fillStyle = '#fff1c2';
      ctx.font = "700 20px 'Orbitron',sans-serif";
      ctx.fillText('· ' + apt.price.toLocaleString() + ' 🥈 ·', 270, 100);
      const tex = new THREE.CanvasTexture(cvs); tex.anisotropy = 4;
      const sign = new THREE.Mesh(new THREE.PlaneGeometry(4.4, 1.05),
        new THREE.MeshStandardMaterial({ map: tex, emissive: 0x404040, emissiveIntensity: 0.25, roughness: 0.55, side: THREE.DoubleSide }));
      sign.position.set(0, 6.7, 3.22); grp.add(sign);

      // Soft glow at night
      const lt = new THREE.PointLight(apt.kind === 'shabby' ? 0xffa050 : 0xffce8a, 0.9, 16);
      lt.position.set(0, 5.5, 0); grp.add(lt);

      scene.add(grp);
    }
    for(const a of APARTMENTS){ try { buildApartment(a); } catch(e){ console.error('[v6bi] build', a.id, e); } }

    // ── Proximity prompt + booking modal ──
    const promptCss = document.createElement('style');
    promptCss.textContent = `
.apt-pop{position:fixed;left:50%;bottom:130px;transform:translateX(-50%);display:none;
  background:linear-gradient(180deg,rgba(28,14,40,.96),rgba(14,8,22,.96));
  border:2px solid rgba(255,206,74,.6);border-radius:14px;padding:12px 18px;
  z-index:50;text-align:center;font-family:'Outfit','Inter',sans-serif;color:#fff1c2}
.apt-pop.show{display:block}
.apt-pop .who{font-size:11px;color:#ffd64d;margin-bottom:5px;letter-spacing:.4px}
.apt-pop .line{font-family:'Bangers',sans-serif;font-size:16px;color:#fff1c2;letter-spacing:.6px;margin-bottom:8px}
.apt-pop kbd{background:rgba(255,206,74,.22);border:1px solid rgba(255,206,74,.55);color:#ffd64d;padding:2px 8px;border-radius:6px;font-family:'JetBrains Mono',monospace;font-size:11px;font-weight:700}
.apt-pop .btn{background:rgba(255,206,74,.18);border:1px solid rgba(255,206,74,.55);color:#ffd64d;padding:7px 14px;border-radius:8px;font-family:'Outfit',sans-serif;font-weight:700;font-size:12px;cursor:pointer;margin-top:6px}

.apt-bg{position:fixed;inset:0;display:none;align-items:center;justify-content:center;
  background:rgba(0,0,0,.78);backdrop-filter:blur(10px);z-index:200;padding:18px}
.apt-bg.show{display:flex}
.apt-card{background:linear-gradient(180deg,rgba(28,14,40,.97),rgba(14,8,22,.97));border:2px solid rgba(255,206,74,.55);border-radius:18px;max-width:460px;width:100%;color:#fff1c2;font-family:'Outfit','Inter',sans-serif}
.apt-card .hd{display:flex;justify-content:space-between;align-items:center;padding:16px 22px;border-bottom:1px solid rgba(255,206,74,.18)}
.apt-card .hd h2{font-family:'Bangers','Orbitron',sans-serif;font-size:23px;color:#ffd64d;letter-spacing:1.6px;margin:0}
.apt-card .hd .x{background:transparent;border:0;color:rgba(255,241,194,.55);font-size:22px;cursor:pointer}
.apt-card .bd{padding:16px 22px}
.apt-card .row{display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;font-size:13px}
.apt-card .row input{background:rgba(255,206,74,.10);border:1px solid rgba(255,206,74,.4);color:#fff1c2;padding:7px 10px;border-radius:8px;font-family:'JetBrains Mono',monospace;font-size:14px;width:90px;text-align:center}
.apt-card .stat{background:rgba(95,240,156,.10);border:1px solid rgba(95,240,156,.4);border-radius:10px;padding:10px 12px;margin-bottom:12px;font-size:12.5px;color:#a8ffd0}
.apt-card .stat b{color:#5ff09c}
.apt-card .btn{width:100%;background:linear-gradient(135deg,#ffd64d,#fff1c2);color:#1a1408;border:0;padding:11px 16px;border-radius:100px;font-family:'Orbitron',sans-serif;font-weight:900;font-size:12px;cursor:pointer;letter-spacing:.6px;margin-top:6px;text-transform:uppercase}
.apt-card .btn:disabled{opacity:.5;cursor:not-allowed}
.apt-card .btn.green{background:linear-gradient(135deg,#5ff09c,#a8ffd0);color:#0a1410}
.apt-card .btn.red{background:rgba(255,90,77,.20);color:#ff7a6e;border:1px solid rgba(255,90,77,.55)}

.apt-sleep-bg{position:fixed;inset:0;display:none;align-items:center;justify-content:center;
  background:radial-gradient(circle at 50% 35%,rgba(28,14,40,.85),rgba(8,4,14,.92) 70%);
  z-index:180;backdrop-filter:blur(4px);pointer-events:none;font-family:'Outfit','Inter',sans-serif}
.apt-sleep-bg.show{display:flex}
.apt-sleep-card{pointer-events:auto;background:linear-gradient(180deg,rgba(28,14,40,.97),rgba(14,8,22,.97));border:2px solid rgba(255,206,74,.6);border-radius:18px;padding:22px 26px;text-align:center;max-width:420px;width:92vw;box-shadow:0 24px 50px rgba(0,0,0,.55),0 0 60px rgba(255,206,74,.18);color:#fff1c2}
.apt-sleep-card h2{font-family:'Bangers','Orbitron',sans-serif;font-size:28px;color:#ffd64d;letter-spacing:1.6px;margin-bottom:6px}
.apt-sleep-card .sub{font-size:11.5px;color:rgba(230,255,238,.65);letter-spacing:.4px;margin-bottom:14px}
.apt-sleep-card .hint{font-family:'JetBrains Mono',monospace;font-size:10.5px;color:rgba(230,255,238,.4);margin-top:8px;letter-spacing:.4px}
`;
    document.head.appendChild(promptCss);

    const pop = document.createElement('div');
    pop.className = 'apt-pop';
    pop.innerHTML = '<div class="who">🏢 Apartment</div><div class="line" id="aptPopLine">—</div><div>Press <kbd>E</kbd> or click below</div><button class="btn" id="aptPopBtn">Open</button>';
    document.body.appendChild(pop);

    const bg = document.createElement('div');
    bg.className = 'apt-bg';
    bg.innerHTML = '<div class="apt-card"><div class="hd"><h2 id="aptTtl">APARTMENT</h2><button class="x" id="aptX">×</button></div><div class="bd" id="aptBd"></div></div>';
    document.body.appendChild(bg);
    document.getElementById('aptX').addEventListener('click', () => bg.classList.remove('show'));
    bg.addEventListener('click', (e) => { if(e.target === bg) bg.classList.remove('show'); });

    const sleepBg = document.createElement('div');
    sleepBg.className = 'apt-sleep-bg';
    sleepBg.innerHTML = '<div class="apt-sleep-card"><h2>🛌 SLEEPING IN YOUR APARTMENT</h2><div class="sub">Spiders and other creatures can\'t reach you here.</div><div class="hint">Press <b>E</b> to wake up and leave</div></div>';
    document.body.appendChild(sleepBg);

    function nowDay(){ return Math.floor(Date.now() / 86400000); } // calendar day index (UTC-ish)
    function rentedUntilDay(apt){
      const s = State.apartments[apt.id] || {};
      return Number(s.rentedUntilDay) || 0;
    }
    function isOwned(apt){ return !!(State.apartments[apt.id]?.owned); }
    function isRentedOut(apt){ return rentedUntilDay(apt) > nowDay(); }

    function renderModal(apt){
      document.getElementById('aptTtl').textContent = (apt.kind === 'shabby' ? '🏚 ' : '🏢 ') + apt.name.toUpperCase();
      const bd = document.getElementById('aptBd');
      const owned = isOwned(apt);
      const rentedUntil = rentedUntilDay(apt);
      const rentDaysLeft = Math.max(0, rentedUntil - nowDay());
      if(!owned){
        bd.innerHTML = ''
          + '<p style="font-size:12.5px;color:rgba(230,255,238,.7);margin-bottom:12px;line-height:1.55;">A one-time purchase. Once you own it you can sleep here for free or rent it out for passive silver.</p>'
          + '<div class="row"><div>Buy price</div><div><b>' + apt.price.toLocaleString() + ' 🥈</b></div></div>'
          + '<div class="row"><div>Rent-out rate</div><div><b>' + apt.rentPerDay.toLocaleString() + ' 🥈 / day</b></div></div>'
          + '<button class="btn" id="aptBuy">Buy Apartment</button>';
        document.getElementById('aptBuy').addEventListener('click', () => {
          const have = Number(State.credits) || 0;
          if(have < apt.price){ window.floater?.('Need ' + apt.price.toLocaleString() + ' 🥈', 'bad'); return; }
          State.credits = +(have - apt.price).toFixed(2);
          State.apartments[apt.id] = { owned: true, rentedUntilDay: 0, lastPayoutDay: nowDay() };
          window.floater?.('🏢 Apartment purchased!', 'good');
          window.playPurchaseSound?.();
          window.saveState?.(); window.updateHUD?.();
          renderModal(apt);
        });
        return;
      }
      // Owned
      let html = '<div class="stat">You own this apartment.</div>';
      if(rentDaysLeft > 0){
        html += '<div class="stat">Currently rented out · <b>' + rentDaysLeft + ' day' + (rentDaysLeft===1?'':'s') + ' left</b><br>Tenant pays ' + apt.rentPerDay.toLocaleString() + ' 🥈/day. While rented, you can\'t sleep here.</div>';
        html += '<button class="btn red" id="aptCancel">Cancel Rental (refund prorated)</button>';
      } else {
        html += '<p style="font-size:12.5px;color:rgba(230,255,238,.7);margin-bottom:10px;line-height:1.55;">Rent it out for 1 to 365 days. Tenant pays <b>' + apt.rentPerDay.toLocaleString() + ' 🥈/day</b> straight into your account.</p>';
        html += '<div class="row"><div>Days</div><input type="number" id="aptDays" value="7" min="1" max="365"/></div>';
        html += '<div class="row"><div>Total income</div><div id="aptTotal"><b>' + (7*apt.rentPerDay).toLocaleString() + ' 🥈</b></div></div>';
        html += '<button class="btn green" id="aptRent">Rent it Out</button>';
        html += '<button class="btn" id="aptSleep" style="margin-top:8px">Sleep here (E)</button>';
      }
      bd.innerHTML = html;
      if(rentDaysLeft <= 0){
        const inp = document.getElementById('aptDays');
        const total = document.getElementById('aptTotal');
        function refresh(){
          const d = Math.max(1, Math.min(365, Number(inp.value) || 1));
          total.innerHTML = '<b>' + (d * apt.rentPerDay).toLocaleString() + ' 🥈</b>';
        }
        inp.addEventListener('input', refresh);
        refresh();
        document.getElementById('aptRent').addEventListener('click', () => {
          const d = Math.max(1, Math.min(365, Number(inp.value) || 1));
          State.apartments[apt.id].rentedUntilDay = nowDay() + d;
          State.apartments[apt.id].lastPayoutDay = nowDay();
          window.floater?.('🤝 Rented for ' + d + ' day' + (d===1?'':'s') + '! You\'ll earn ' + apt.rentPerDay.toLocaleString() + ' 🥈/day', 'good');
          window.saveState?.();
          renderModal(apt);
        });
        document.getElementById('aptSleep').addEventListener('click', () => {
          bg.classList.remove('show');
          enterSleep(apt);
        });
      } else {
        document.getElementById('aptCancel').addEventListener('click', () => {
          State.apartments[apt.id].rentedUntilDay = nowDay();
          window.floater?.('Rental cancelled', 'good');
          window.saveState?.();
          renderModal(apt);
        });
      }
    }

    function openApt(apt){
      renderModal(apt);
      bg.classList.add('show');
    }

    // Sleep mode
    let sleeping = false, sleepApt = null;
    function enterSleep(apt){
      if(isRentedOut(apt)){
        window.floater?.('Can\'t sleep — apartment is rented out', 'bad');
        return;
      }
      sleeping = true;
      sleepApt = apt;
      sleepBg.classList.add('show');
    }
    function exitSleep(){
      sleeping = false;
      sleepApt = null;
      sleepBg.classList.remove('show');
    }
    setInterval(() => {
      if(!sleeping || !sleepApt) return;
      Player.pos.x = sleepApt.pos.x;
      Player.pos.z = sleepApt.pos.z;
      if(Player.vel) Player.vel.set(0, 0, 0);
    }, 50);

    // Daily passive income
    setInterval(() => {
      const today = nowDay();
      let payout = 0;
      for(const apt of APARTMENTS){
        const s = State.apartments[apt.id];
        if(!s || !s.owned) continue;
        if(s.rentedUntilDay > today){
          const daysElapsed = today - (s.lastPayoutDay || today);
          if(daysElapsed > 0){
            const pay = daysElapsed * apt.rentPerDay;
            payout += pay;
            s.lastPayoutDay = today;
          }
        } else if((s.lastPayoutDay || 0) < s.rentedUntilDay){
          // Rental just ended — pay out the remainder
          const daysElapsed = s.rentedUntilDay - (s.lastPayoutDay || s.rentedUntilDay);
          if(daysElapsed > 0){
            payout += daysElapsed * apt.rentPerDay;
            s.lastPayoutDay = s.rentedUntilDay;
          }
        }
      }
      if(payout > 0){
        State.credits = (Number(State.credits) || 0) + payout;
        window.floater?.('+' + payout.toLocaleString() + ' 🥈 rental income', 'good');
        window.updateHUD?.(); window.saveState?.();
      }
    }, 60000);

    // Proximity loop
    let activeApt = null;
    setInterval(() => {
      let near = null, bestD = 6.0;
      for(const apt of APARTMENTS){
        const d = Math.hypot(Player.pos.x - apt.pos.x, Player.pos.z - apt.pos.z);
        if(d < bestD){ bestD = d; near = apt; }
      }
      activeApt = near;
      if(near){
        const owned = isOwned(near);
        const rented = isRentedOut(near);
        let line;
        if(!owned) line = 'Buy this Apartment (' + near.price.toLocaleString() + ' 🥈)';
        else if(rented) line = 'Rented · ' + (rentedUntilDay(near) - nowDay()) + ' day(s) left';
        else line = 'Your Apartment · Sleep / Rent';
        document.getElementById('aptPopLine').textContent = line;
        pop.classList.add('show');
      } else pop.classList.remove('show');
    }, 250);

    document.getElementById('aptPopBtn').addEventListener('click', () => { if(activeApt) openApt(activeApt); });

    window.addEventListener('keydown', (e) => {
      if(e.code !== 'KeyE') return;
      const a = document.activeElement;
      if(a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA')) return;
      // If sleeping → wake up
      if(sleeping){ exitSleep(); e.stopImmediatePropagation(); return; }
      if(!activeApt) return;
      // Don't open if a modal is already up
      if(document.querySelector('.apt-bg.show, .hot-bg.show, .bank-bg.show, .gary-bg.show, .gs-bg.show')) return;
      const owned = isOwned(activeApt);
      const rented = isRentedOut(activeApt);
      if(!owned){
        openApt(activeApt);
      } else if(rented){
        openApt(activeApt);
      } else {
        // Owned + not rented → instant sleep
        enterSleep(activeApt);
      }
      e.stopImmediatePropagation();
    }, true);


    // Minimap landmarks
    try {
      if(window.MinimapLandmarks){
        for(const apt of APARTMENTS){
          window.MinimapLandmarks.push({ x: apt.pos.x, z: apt.pos.z, label: apt.name, color: apt.color.sign });
        }
      }
    } catch(_){}

    console.log('[extras-v6bi] ready · apartments built');
  }
})();
