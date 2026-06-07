// =================================================================
// datacenter.js — rent a data center for 1 hour, run morally-grey
// AI hustles for random silver payouts. Hosted by NPC "Data".
// =================================================================
(function(){
  'use strict';
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
    // STATE
    // ─────────────────────────────────────────────────────────────
    if(typeof State.dcRentedUntil !== "number") State.dcRentedUntil = 0;
    if(!State.dcJobs || typeof State.dcJobs !== "object") State.dcJobs = {};
    // dcJobs[jobId] = { startTs, duration, done }
    const RENT_MS    = 60 * 60 * 1000;   // 1 hour real time
    const RENT_PRICE = 500;              // 500 silver per hour

    const ACTIVITIES = [
      { id: "aigf",        emoji: "\u{1F496}", title: "Bae.GPT Training Camp",
        desc: "Fine-tune sycophantic girlfriend bots that whisper \"you're so smart, king\" for $9.99/mo. Lonely men pay subscription.",
        durMin: 7, min: 200, max: 1500 },
      { id: "slop",        emoji: "\u{1F4FA}", title: "Brainrot Reel Factory",
        desc: "Crank out 10-second AI slop: Skibidi vs Sigma vs Gyatt. Watch engagement metrics melt teen brains.",
        durMin: 3, min: 50,  max: 400 },
      { id: "rugbot",      emoji: "\u{1FA99}", title: "Quant Rugpull HQ",
        desc: "Deploy meme tokens, pump the chart with bots, vanish the liquidity. High risk, high reward, low ethics.",
        durMin: 5, min: -400, max: 3000 },
      { id: "smm",         emoji: "\u{1F465}", title: "Influence Forge",
        desc: "Sell 10K followers for $5. Accounts named 'profile_18402' but the dashboards look real.",
        durMin: 4, min: 100, max: 800 },
      { id: "pirate",      emoji: "\u{26BD}",  title: "Pirate Sports Streamer",
        desc: "1080p Champions League stream with only 47 ad pop-ups before each goal. Servers always melting.",
        durMin: 6, min: 100, max: 1200 },
      { id: "broker",      emoji: "\u{1F4C2}", title: "Data Hoarder Exchange",
        desc: "Buy email lists, sell them three times over. Wholesale identity, retail anxiety.",
        durMin: 7, min: 200, max: 1800 },
      { id: "propaganda",  emoji: "\u{1F4E2}", title: "Astroturf Operations",
        desc: "10,000 bots posting the same talking point from 'concerned voters in Ohio' at 3am.",
        durMin: 9, min: 300, max: 2500 },
      { id: "spotify",     emoji: "\u{1F3B6}", title: "Spotify Slop Mill",
        desc: "Generate 800 lo-fi study beats overnight. The algorithm hands you out as 'discover weekly'. Royalties drip.",
        durMin: 5, min: 100, max: 900 },
      { id: "vpn",         emoji: "\u{1F510}", title: "DefinitelyNotLogging VPN",
        desc: "Sell 'military-grade encryption' while quietly logging everything to sell to advertisers (and three governments).",
        durMin: 4, min: 80,  max: 600 },
      { id: "essays",      emoji: "\u{1F393}", title: "Diploma Mill GPT",
        desc: "Pump out 12,000-word essays on 'birds in The Great Gatsby' for desperate undergrads at 3am.",
        durMin: 3, min: 50,  max: 500 },
      { id: "fakenews",    emoji: "\u{1F4F0}", title: "Truth-Adjacent News",
        desc: "Headlines that are technically not lies. 'Local Man Found Dead in Kitchen' — he was napping. Ad revenue go brrr.",
        durMin: 6, min: 150, max: 1100 },
      { id: "tarot",       emoji: "\u{1F52E}", title: "Cosmic Slop Oracle",
        desc: "AI Mercury is in retrograde. Your career is doomed. SUBSCRIBE for the full reading at $19.99/mo.",
        durMin: 4, min: 80,  max: 700 },
    ];

    // ─────────────────────────────────────────────────────────────
    // BUILD THE DATA CENTER + NPC
    // ─────────────────────────────────────────────────────────────
    const DC_POS = { x: -50, z: -22 };
    function buildBuilding(){
      const grp = new THREE.Group();
      grp.position.set(DC_POS.x, groundHeightAt(DC_POS.x, DC_POS.z), DC_POS.z);
      // Concrete bunker
      const wallMat  = new THREE.MeshStandardMaterial({ color: 0x2a3038, roughness: 0.85 });
      const floorMat = new THREE.MeshStandardMaterial({ color: 0x1a1d22, roughness: 0.9 });
      const trimMat  = new THREE.MeshStandardMaterial({ color: 0x101418, roughness: 0.55, metalness: 0.55 });
      const slab = new THREE.Mesh(new THREE.BoxGeometry(8, 0.3, 7), floorMat);
      slab.position.y = 0.15;
      slab.receiveShadow = true;
      grp.add(slab);
      // Back wall
      const back = new THREE.Mesh(new THREE.BoxGeometry(8, 3.6, 0.3), wallMat);
      back.position.set(0, 1.9, 3.35);
      grp.add(back);
      // Side walls
      for(const sx of [-4, 4]){
        const side = new THREE.Mesh(new THREE.BoxGeometry(0.3, 3.6, 7), wallMat);
        side.position.set(sx, 1.9, 0);
        grp.add(side);
      }
      // Front (open with door frame)
      for(const fx of [-3, 3]){
        const post = new THREE.Mesh(new THREE.BoxGeometry(2, 3.6, 0.3), wallMat);
        post.position.set(fx, 1.9, -3.35);
        grp.add(post);
      }
      // Roof
      const roof = new THREE.Mesh(new THREE.BoxGeometry(8.3, 0.3, 7.3), trimMat);
      roof.position.y = 3.85;
      roof.castShadow = true;
      grp.add(roof);
      // Server racks lining the inside walls
      for(let side = -1; side <= 1; side += 2){
        for(let i = 0; i < 4; i++){
          const rack = new THREE.Mesh(new THREE.BoxGeometry(0.55, 2.4, 1.3),
            new THREE.MeshStandardMaterial({ color: 0x111519, roughness: 0.7, metalness: 0.4 }));
          rack.position.set(side * 3.0, 1.45, -2 + i * 1.4);
          grp.add(rack);
          // Status LEDs
          for(let j = 0; j < 4; j++){
            const color = [0x5ff09c, 0xff5a4a, 0xffd64d, 0x6ed0d6][(i + j) % 4];
            const led = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 8),
              new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 1.5 }));
            led.position.set(side * 3.0 - side * 0.32, 0.6 + j * 0.4, -2 + i * 1.4 + 0.4);
            grp.add(led);
          }
          // Front panel
          const panel = new THREE.Mesh(new THREE.BoxGeometry(0.06, 2.0, 1.1),
            new THREE.MeshStandardMaterial({ color: 0x0a0d10, roughness: 0.5, metalness: 0.6, emissive: 0x113321, emissiveIntensity: 0.4 }));
          panel.position.set(side * 3.0 - side * 0.30, 1.45, -2 + i * 1.4);
          grp.add(panel);
        }
      }
      // Glow inside
      const lt = new THREE.PointLight(0x5ff09c, 1.6, 16);
      lt.position.set(0, 2.6, 0);
      grp.add(lt);
      // Sign
      const cvs = document.createElement('canvas');
      cvs.width = 512; cvs.height = 128;
      const ctx = cvs.getContext('2d');
      ctx.fillStyle = '#0a1410'; ctx.fillRect(0, 0, 512, 128);
      ctx.strokeStyle = '#5ff09c'; ctx.lineWidth = 6;
      ctx.strokeRect(8, 8, 496, 112);
      ctx.fillStyle = '#5ff09c';
      ctx.font = "900 56px 'Bangers','Orbitron',sans-serif";
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('DATA CENTER', 256, 55);
      ctx.fillStyle = '#fff1c2';
      ctx.font = "700 22px 'Orbitron',sans-serif";
      ctx.fillText('RENT · COMPUTE · CASH OUT', 256, 100);
      const tex = new THREE.CanvasTexture(cvs);
      const sign = new THREE.Mesh(new THREE.PlaneGeometry(4.6, 1.15),
        new THREE.MeshBasicMaterial({ map: tex }));
      sign.position.set(0, 4.4, -3.45);
      // Face the open front of the building (player approaches from -z).
      sign.rotation.set(0.1, Math.PI, 0);
      grp.add(sign);
      scene.add(grp);
    }
    try { buildBuilding(); console.log('[datacenter] building rendered at', DC_POS); }
    catch(e){ console.error('[datacenter] buildBuilding error', e); }

    // NPC "Data"
    function buildNpc(name, tint, x, z, facing){
      const grp = new THREE.Group();
      const baseY = groundHeightAt(x, z);
      grp.position.set(x, baseY, z);
      grp.rotation.y = facing;
      const bodyMat = new THREE.MeshStandardMaterial({ color: tint, roughness: 0.55 });
      const dark    = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.6 });
      const eyeW    = new THREE.MeshStandardMaterial({ color: 0xffffff });
      const eyeB    = new THREE.MeshBasicMaterial({ color: 0x000000 });
      const body = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.95, 1.1), bodyMat);
      body.position.y = 1.4; body.castShadow = true;
      grp.add(body);
      const bezel = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.07, 0.95), dark);
      bezel.position.y = 1.91; grp.add(bezel);
      const paper = new THREE.Mesh(new THREE.PlaneGeometry(0.85, 0.7),
        new THREE.MeshStandardMaterial({ color: 0xffffff, side: THREE.DoubleSide, roughness: 0.95 }));
      paper.position.set(0, 1.97, -0.05);
      paper.rotation.x = -Math.PI / 2 + 0.35;
      grp.add(paper);
      const eyeR = 0.18;
      const eyeL = new THREE.Mesh(new THREE.SphereGeometry(eyeR, 14, 14), eyeW);
      eyeL.position.set(-0.28, 1.6, 0.55); grp.add(eyeL);
      const eyeRight = eyeL.clone(); eyeRight.position.x = 0.28; grp.add(eyeRight);
      const pupL = new THREE.Mesh(new THREE.SphereGeometry(eyeR * 0.4, 10, 10), eyeB);
      pupL.position.set(-0.28, 1.6, 0.72); grp.add(pupL);
      const pupR = pupL.clone(); pupR.position.x = 0.28; grp.add(pupR);
      // Antenna w/ green glow (data theme)
      const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.3, 6), dark);
      ant.position.set(0.55, 2.1, 0); grp.add(ant);
      const orb = new THREE.Mesh(new THREE.SphereGeometry(0.075, 10, 10),
        new THREE.MeshStandardMaterial({ color: 0x5ff09c, emissive: 0x5ff09c, emissiveIntensity: 1.4 }));
      orb.position.set(0.55, 2.25, 0); grp.add(orb);
      // Floating tag
      const tag = document.createElement('div');
      tag.style.cssText = "position:absolute;transform:translate(-50%,-100%);background:rgba(8,18,11,.88);color:#5ff09c;padding:4px 10px;border:1px solid rgba(95,240,156,.55);border-radius:8px;font-family:'Outfit','JetBrains Mono',monospace;font-size:10.5px;pointer-events:none;z-index:9;white-space:nowrap;";
      tag.textContent = name + " \u{1F5A8}";
      (document.getElementById('chatBubbles')?.parentElement || document.body).appendChild(tag);
      scene.add(grp);
      return { x, z, y: baseY + 2.6, tag };
    }
    let DATA = null;
    try {
      DATA = buildNpc("Data", 0xa8b5ff, DC_POS.x, DC_POS.z - 2.5, 0);
      console.log('[datacenter] NPC Data spawned');
    } catch(e){ console.error('[datacenter] buildNpc error', e); }

    // ─────────────────────────────────────────────────────────────
    // MODAL UI
    // ─────────────────────────────────────────────────────────────
    const css = document.createElement('style');
    css.textContent = `
.dc-bg{position:fixed;inset:0;display:none;align-items:center;justify-content:center;background:rgba(0,0,0,.7);z-index:200;padding:18px;}
.dc-bg.show{display:flex;}
.dc-card{background:linear-gradient(180deg,rgba(8,18,11,.97),rgba(5,14,9,.97));border:2px solid rgba(95,240,156,.55);border-radius:18px;padding:22px;max-width:720px;width:100%;max-height:90vh;overflow:auto;color:#fff1c2;font-family:'Outfit','Inter',sans-serif;position:relative;box-shadow:0 24px 60px rgba(0,0,0,.6);}
.dc-card h2{font-family:'Bangers','Orbitron',sans-serif;font-size:26px;color:#5ff09c;letter-spacing:1.8px;margin-bottom:4px;text-align:center;}
.dc-card .sub{font-size:11.5px;color:rgba(230,255,238,.7);margin-bottom:14px;text-align:center;line-height:1.5;}
.dc-close{position:absolute;top:14px;right:14px;background:none;color:#5ff09c;border:0;font-size:26px;cursor:pointer;}
.dc-rent{background:linear-gradient(135deg,rgba(95,240,156,.16),rgba(95,240,156,.05));border:1px solid rgba(95,240,156,.5);border-radius:14px;padding:12px 16px;display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;}
.dc-rent .info{font-size:12.5px;color:#fff1c2;}
.dc-rent .info b{color:#5ff09c;}
.dc-rent button{background:linear-gradient(135deg,#5ff09c,#a8ffd0);color:#0a1410;border:0;padding:10px 22px;border-radius:10px;font-family:'Outfit',sans-serif;font-weight:800;font-size:11.5px;letter-spacing:1.1px;cursor:pointer;text-transform:uppercase;box-shadow:0 6px 18px rgba(95,240,156,.28),inset 0 1px 0 rgba(255,255,255,.45);transition:transform .12s, box-shadow .12s;}
.dc-rent button:hover{transform:translateY(-1px);box-shadow:0 10px 22px rgba(95,240,156,.42),inset 0 1px 0 rgba(255,255,255,.5);}
.dc-rent button:disabled{opacity:.4;cursor:not-allowed;background:#3a4040;color:#888;box-shadow:none;}
.dc-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:10px;}
.dc-tile{background:rgba(95,240,156,.04);border:1px solid rgba(95,240,156,.18);border-radius:12px;padding:11px;display:flex;flex-direction:column;}
.dc-tile.run{border-color:rgba(255,206,74,.5);background:rgba(255,206,74,.06);}
.dc-tile.done{border-color:rgba(95,240,156,.7);background:rgba(95,240,156,.10);}
.dc-tile .hd{display:flex;align-items:center;gap:8px;margin-bottom:4px;}
.dc-tile .hd .ic{font-size:20px;}
.dc-tile .hd .nm{font-weight:800;font-size:13px;color:#fff1c2;letter-spacing:.3px;line-height:1.15;}
.dc-tile .desc{font-size:10.5px;color:rgba(230,255,238,.65);line-height:1.42;margin-bottom:8px;flex:1;}
.dc-tile .meta{font-size:10.5px;color:rgba(230,255,238,.5);margin-bottom:6px;font-family:'JetBrains Mono',monospace;}
.dc-tile .bar{height:8px;background:rgba(8,18,11,.7);border:1px solid rgba(95,240,156,.3);border-radius:5px;overflow:hidden;margin-bottom:6px;display:none;}
.dc-tile.run .bar{display:block;}
.dc-tile .bar .fill{height:100%;background:linear-gradient(90deg,#5ff09c,#fff1c2);transition:width 1s linear;width:0%;}
.dc-tile button{background:rgba(95,240,156,.16);border:1px solid rgba(95,240,156,.5);color:#5ff09c;padding:6px 10px;border-radius:8px;font-family:'Outfit',sans-serif;font-weight:700;font-size:11px;cursor:pointer;letter-spacing:.4px;text-transform:uppercase;}
.dc-tile button.claim{background:linear-gradient(135deg,#ffd64d,#fff1c2);border-color:#ffd64d;color:#0a1410;}
.dc-tile button:disabled{opacity:.45;cursor:not-allowed;}
.dc-pop{position:fixed;left:50%;bottom:130px;transform:translateX(-50%);display:none;background:linear-gradient(180deg,rgba(8,18,11,.96),rgba(5,14,9,.96));border:2px solid rgba(95,240,156,.55);border-radius:14px;padding:12px 18px;z-index:50;text-align:center;font-family:'Outfit','Inter',sans-serif;}
.dc-pop.show{display:block;}
.dc-pop .who{font-size:11px;color:rgba(230,255,238,.7);margin-bottom:5px;}
.dc-pop .who b{color:#5ff09c;}
.dc-pop .line{font-size:14px;font-weight:700;color:#fff1c2;margin-bottom:6px;}
.dc-pop kbd{background:rgba(95,240,156,.22);border:1px solid rgba(95,240,156,.55);color:#5ff09c;padding:2px 8px;border-radius:6px;font-family:monospace;font-size:11px;font-weight:700;}
`;
    document.head.appendChild(css);

    const bg = document.createElement('div');
    bg.className = 'dc-bg';
    bg.id = 'dcBg';
    bg.innerHTML = '<div class="dc-card"><button class="dc-close" id="dcClose">×</button><h2>\u{1F5A5} DATA CENTER · DATA</h2><div class="sub">Rent a rack for an hour. Run shady AI hustles. Cash out in silver.</div><div id="dcRent"></div><div class="dc-grid" id="dcGrid"></div></div>';
    document.body.appendChild(bg);
    document.getElementById('dcClose').addEventListener('click', () => bg.classList.remove('show'));
    bg.addEventListener('click', (e) => { if(e.target === bg) bg.classList.remove('show'); });

    function isRented(){ return Date.now() < (State.dcRentedUntil || 0); }
    function fmtMs(ms){
      if(ms <= 0) return "0s";
      const s = Math.ceil(ms / 1000);
      if(s < 60) return s + "s";
      const m = Math.floor(s / 60);
      return m + "m " + (s % 60) + "s";
    }
    function renderRent(){
      const host = document.getElementById('dcRent');
      if(isRented()){
        const left = State.dcRentedUntil - Date.now();
        host.innerHTML = '<div class="info">Rack online — <b>' + fmtMs(left) + '</b> remaining</div><button id="dcExtend">Extend +1h · ' + RENT_PRICE.toLocaleString() + ' \u{1F948}</button>';
        document.getElementById('dcExtend').addEventListener('click', () => {
          if((State.credits || 0) < RENT_PRICE){ window.floater?.("Need " + RENT_PRICE + " \u{1F948}", "bad"); return; }
          State.credits -= RENT_PRICE;
          State.dcRentedUntil = State.dcRentedUntil + RENT_MS;
          window.playPurchaseSound?.();
          window.floater?.("+1h rack time", "good");
          window.saveState?.(); window.updateHUD?.();
          renderAll();
        });
      } else {
        host.innerHTML = '<div class="info">No active rental. <b>1 hour</b> of compute time for <b>' + RENT_PRICE.toLocaleString() + ' \u{1F948} Silver</b>.</div><button id="dcRentBtn">Rent for 1 hour</button>';
        document.getElementById('dcRentBtn').addEventListener('click', () => {
          if((State.credits || 0) < RENT_PRICE){ window.floater?.("Need " + RENT_PRICE + " \u{1F948}", "bad"); return; }
          State.credits -= RENT_PRICE;
          State.dcRentedUntil = Date.now() + RENT_MS;
          window.playPurchaseSound?.();
          window.floater?.("\u{1F5A5} Data center rented · 1h", "good");
          window.saveState?.(); window.updateHUD?.();
          renderAll();
        });
      }
    }
    function jobState(act){
      const j = State.dcJobs[act.id];
      if(!j) return null;
      const t = (Date.now() - j.startTs) / j.duration;
      if(t >= 1) return { ...j, status: "done", t: 1 };
      return { ...j, status: "running", t };
    }
    function anyJobRunning(){
      for(const id of Object.keys(State.dcJobs || {})){
        const j = State.dcJobs[id];
        if(!j) continue;
        const t = (Date.now() - j.startTs) / j.duration;
        if(t < 1) return true;
      }
      return false;
    }
    function startJob(act){
      if(!isRented()){ window.floater?.("Rent the rack first", "bad"); return; }
      // Only one job at a time — rack can only crunch one workload
      if(anyJobRunning()){ window.floater?.("One job at a time — wait or claim the running one", "bad"); return; }
      const dur = act.durMin * 60 * 1000;
      // Job can't finish AFTER rental expires
      const remaining = State.dcRentedUntil - Date.now();
      if(dur > remaining){ window.floater?.("Not enough rack time left for this job", "bad"); return; }
      State.dcJobs[act.id] = { startTs: Date.now(), duration: dur };
      window.saveState?.();
      renderAll();
    }
    function claimJob(act){
      const j = State.dcJobs[act.id];
      if(!j) return;
      const reward = Math.round(act.min + Math.random() * (act.max - act.min));
      delete State.dcJobs[act.id];
      State.credits = (State.credits || 0) + reward;
      const sign = reward >= 0 ? "+" : "";
      if(reward >= 0){
        window.floater?.(sign + reward.toLocaleString() + " \u{1F948} · " + act.title, "good");
      } else {
        window.floater?.(reward.toLocaleString() + " \u{1F948} · " + act.title + " went bust!", "bad");
      }
      window.playPurchaseSound?.();
      window.saveState?.(); window.updateHUD?.();
      renderAll();
    }

    function renderGrid(){
      const host = document.getElementById('dcGrid');
      const cards = ACTIVITIES.map(act => {
        const js = jobState(act);
        const tileClass = js?.status === "done" ? "done" : js?.status === "running" ? "run" : "";
        const pct = js ? Math.round(js.t * 100) : 0;
        let btn = "";
        if(!isRented()){
          btn = '<button disabled>Rent rack first</button>';
        } else if(js?.status === "done"){
          btn = '<button class="claim" data-claim="' + act.id + '">Claim payout</button>';
        } else if(js?.status === "running"){
          const ms = (1 - js.t) * js.duration;
          btn = '<button disabled>Running · ' + fmtMs(ms) + '</button>';
        } else if(anyJobRunning()){
          btn = '<button disabled>Rack busy</button>';
        } else {
          btn = '<button data-start="' + act.id + '">Start</button>';
        }
        const rangeStr = (act.min < 0 ? act.min : ("+" + act.min)) + " to +" + act.max + " \u{1F948}";
        return '<div class="dc-tile ' + tileClass + '">'
          + '<div class="hd"><span class="ic">' + act.emoji + '</span><span class="nm">' + act.title + '</span></div>'
          + '<div class="desc">' + act.desc + '</div>'
          + '<div class="meta">' + act.durMin + 'm · payout ' + rangeStr + '</div>'
          + '<div class="bar"><div class="fill" style="width:' + pct + '%;"></div></div>'
          + btn
          + '</div>';
      }).join("");
      host.innerHTML = cards;
      host.querySelectorAll('[data-start]').forEach(b => b.addEventListener('click', () => {
        const a = ACTIVITIES.find(x => x.id === b.dataset.start); if(a) startJob(a);
      }));
      host.querySelectorAll('[data-claim]').forEach(b => b.addEventListener('click', () => {
        const a = ACTIVITIES.find(x => x.id === b.dataset.claim); if(a) claimJob(a);
      }));
    }
    function renderAll(){ renderRent(); renderGrid(); }
    window.openDataCenter = () => { renderAll(); bg.classList.add('show'); };

    // Update only the bar widths while open (cheap, no innerHTML churn)
    setInterval(() => {
      if(!bg.classList.contains('show')) return;
      // If rental expires while open, re-render the rent block
      if(State.dcRentedUntil && Date.now() > State.dcRentedUntil && State._dcWasRented !== false){
        State._dcWasRented = false;
        renderRent();
      } else if(isRented() && State._dcWasRented === false){
        State._dcWasRented = true;
      }
      const fills = bg.querySelectorAll('.dc-tile.run');
      fills.forEach(tile => {
        const startBtn = tile.querySelector('[data-start]');
        const _id = (startBtn?.dataset.start) || (tile.querySelector('[data-claim]')?.dataset.claim);
      });
      // Re-render grid every 2 seconds while open to update timers
      renderGrid();
    }, 2000);

    // Proximity popup
    const pop = document.createElement('div');
    pop.className = 'dc-pop';
    pop.innerHTML = '<div class="who"><b>Data</b> \u{1F5A8}</div><div class="line">Rent compute time</div><div>Press <kbd>E</kbd> or click</div><button class="claim" id="dcPopBtn" style="margin-top:7px;background:rgba(95,240,156,.18);border:1px solid rgba(95,240,156,.55);color:#5ff09c;padding:6px 11px;border-radius:8px;font-weight:700;font-size:11px;cursor:pointer;text-transform:uppercase;">Open Data Center</button>';
    document.body.appendChild(pop);
    document.getElementById('dcPopBtn').addEventListener('click', () => window.openDataCenter());

    let near = false;
    setInterval(() => {
      const d = Math.hypot(Player.pos.x - DC_POS.x, Player.pos.z - DC_POS.z);
      near = d < 6.5;
      pop.classList.toggle('show', near);
    }, 250);

    window.addEventListener('keydown', (e) => {
      if(e.code !== "KeyE" || !near) return;
      const a = document.activeElement;
      if(a && (a.tagName === "INPUT" || a.tagName === "TEXTAREA")) return;
      window.openDataCenter();
    });

    // Project tag for Data NPC (guarded if buildNpc failed)
    function tagTick(){
      if(!DATA || !window.camera){ requestAnimationFrame(tagTick); return; }
      _v.set(DATA.x, DATA.y, DATA.z).project(window.camera);
      if(_v.z < 1){
        DATA.tag.style.left = ((_v.x * 0.5 + 0.5) * window.innerWidth) + 'px';
        DATA.tag.style.top  = ((1 - (_v.y * 0.5 + 0.5)) * window.innerHeight) + 'px';
        DATA.tag.style.display = 'block';
      } else { DATA.tag.style.display = 'none'; }
      requestAnimationFrame(tagTick);
    }
    requestAnimationFrame(tagTick);
    console.log('[datacenter] ready');
  }
})();
