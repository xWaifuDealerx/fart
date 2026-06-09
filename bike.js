// =================================================================
// bike.js — rideable bicycle. One parked behind Gary's tent. Player
// can mount/dismount, ride faster, sell/buy the bike at Carlos.
// =================================================================
// A fresh bike is parked behind Gary's tent every time the player logs
// in without one — no per-day cap, no stealing UI.
// =================================================================
(function(){
  'use strict';
  function whenReady(){
    if(!window.THREE || !window.scene || !window.Player || !window.State || !window.ITEMS || !window.groundHeightAt){
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

    // ── Inventory item entry so Carlos can buy/sell it ──
    if(!ITEMS.bike){
      ITEMS.bike = {
        id: 'bike',
        name: 'Bicycle',
        icon: '\u{1F6B2}',
        color: '#c8b78a',
        type: 'vehicle',
        isNFT: false,
        suggestedPrice: 200,
        marketPrice: 200,
      };
    }

    // Build a small 3D bike mesh
    function buildBikeMesh(){
      const grp = new THREE.Group();
      const frameMat = new THREE.MeshStandardMaterial({ color: 0xc8b78a, metalness: 0.55, roughness: 0.45 });
      const tireMat  = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.85 });
      const seatMat  = new THREE.MeshStandardMaterial({ color: 0x402a18, roughness: 0.8 });
      // Wheels (front + back)
      function wheel(x){
        const w = new THREE.Mesh(new THREE.TorusGeometry(0.35, 0.08, 8, 18), tireMat);
        w.rotation.y = Math.PI / 2;
        w.position.set(x, 0.35, 0);
        // Hub
        const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.12, 8), frameMat);
        hub.rotation.z = Math.PI / 2;
        hub.position.copy(w.position);
        grp.add(w); grp.add(hub);
      }
      wheel(-0.55); wheel(0.55);
      // Frame triangle
      const top = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.0, 8), frameMat);
      top.rotation.z = Math.PI / 2;
      top.position.set(0, 0.75, 0);
      grp.add(top);
      const front = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.95, 8), frameMat);
      front.position.set(0.4, 0.55, 0);
      front.rotation.z = -0.35;
      grp.add(front);
      const back = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.85, 8), frameMat);
      back.position.set(-0.30, 0.45, 0);
      back.rotation.z = 0.4;
      grp.add(back);
      // Seat
      const seat = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.06, 0.18), seatMat);
      seat.position.set(-0.50, 0.92, 0);
      grp.add(seat);
      // Handlebars
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.5, 8), frameMat);
      stem.position.set(0.55, 1.0, 0);
      grp.add(stem);
      const bar = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, 0.55), frameMat);
      bar.position.set(0.55, 1.18, 0);
      grp.add(bar);
      // Pedal block
      const pedal = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.10, 0.30), seatMat);
      pedal.position.set(0.05, 0.30, 0);
      grp.add(pedal);
      return grp;
    }

    // Parked spawn = behind Gary's pawn tent. GARY_POS = (60, 60).
    // Bike sits a few meters behind him so it's visible to a player
    // walking around the back of the tent.
    const PARKED_POS = { x: 60, z: 52 };
    let bike = null;
    function spawnParkedBike(){
      if(bike){ return bike; }
      try {
        const m = buildBikeMesh();
        const gy = (typeof groundHeightAt === "function") ? groundHeightAt(PARKED_POS.x, PARKED_POS.z) : 0;
        // Lift 0.05 so wheels don't clip into the terrain
        m.position.set(PARKED_POS.x, (gy || 0) + 0.05, PARKED_POS.z);
        m.rotation.y = Math.PI * 0.4;     // angled, like it was just dropped
        scene.add(m);
        bike = m;
        console.log('[bike] parked at', PARKED_POS, 'ground y=', gy);
        return m;
      } catch(e){
        console.error('[bike] spawn failed', e);
        return null;
      }
    }
    // ALWAYS have a parked bike behind Gary unless we're actively
    // riding it. We forcibly clear any stale State.onBike that survived
    // from a previous broken session so the gate can't lock us out.
    if(State.onBike && !window._bikeMountedThisSession){
      console.log('[bike] clearing stale State.onBike from old session');
      State.onBike = false;
    }
    function refreshSpawn(){
      const mounted = !!State.onBike;
      if(!mounted && !bike){
        spawnParkedBike();
      } else if(mounted && bike){
        scene.remove(bike);
        bike = null;
      }
    }
    function todayKey(){ return ''; }
    function canTakeToday(){ return true; }
    // Spawn IMMEDIATELY on init, no waiting
    spawnParkedBike();
    // And re-check every 5 seconds in case something removed it
    setInterval(refreshSpawn, 5000);

    // ── Mount / dismount ──
    function mountBike(){
      State.onBike = true;
      window._bikeMountedThisSession = true;
      State.bikeMounted = performance.now();
      if(bike){ scene.remove(bike); bike = null; }
      // First mount of the day = mark theft slot
      if(!(State.inventory?.bike > 0) && canTakeToday()){
        State.lastBikeSteal = todayKey();
      }
      // Add to inventory so Carlos can sell it / it's "in your possession"
      if(!State.inventory) State.inventory = {};
      State.inventory.bike = Math.max(1, State.inventory.bike || 0);
      window.floater?.("\u{1F6B2} Hopped on the bike", "good");
      window.playPurchaseSound?.();
      window.saveState?.();
      window.updateHUD?.();
      window.renderInventory?.();
    }
    function dismountBike(){
      if(!State.onBike) return;
      State.onBike = false;
      // Drop a parked bike at the player's location
      const m = buildBikeMesh();
      const gy = groundHeightAt(Player.pos.x, Player.pos.z);
      m.position.set(Player.pos.x, gy, Player.pos.z + 0.4);
      m.rotation.y = Player.yaw || 0;
      scene.add(m);
      bike = m;
      window.floater?.("Parked the bike", "good");
      window.saveState?.();
    }

    // ── Build the held bike that follows the player while mounted ──
    let heldBike = null;
    function tickRide(){
      const hasPrinter = !!window.printer;
      // If the bike just disappeared from inventory (sold to Carlos /
      // Gary), dismount immediately so we're not riding a phantom one.
      if(State.onBike && (State.inventory?.bike || 0) <= 0){
        State.onBike = false;
        if(heldBike){ scene.remove(heldBike); heldBike = null; }
        if(Player.speedMul === 1.85) Player.speedMul = 1.0;
        window.floater?.("\u{1F6B2} You no longer own this bike", "bad");
      }
      if(State.onBike){
        if(!heldBike){
          heldBike = buildBikeMesh();
          scene.add(heldBike);
        }
        if(hasPrinter){
          // Position the bike under the printer
          heldBike.position.copy(window.printer.position);
          heldBike.position.y = (groundHeightAt(window.printer.position.x, window.printer.position.z) || 0);
          heldBike.rotation.y = (window.printer.rotation.y || 0);
          // Lift printer a bit so it sits on the seat
          if(window.printer.userData) window.printer.userData._bikeLift = 1.0;
          window.printer.position.y = (groundHeightAt(window.printer.position.x, window.printer.position.z) || 0) + 1.0;
        }
        // Boost player movement speed (Player.speedMul if available)
        Player.speedMul = 1.85;
      } else {
        if(heldBike){ scene.remove(heldBike); heldBike = null; }
        if(Player.speedMul === 1.85) Player.speedMul = 1.0;
      }
      requestAnimationFrame(tickRide);
    }
    requestAnimationFrame(tickRide);

    // ── Proximity prompt for the parked bike ──
    const pop = document.createElement('div');
    pop.style.cssText = "position:fixed;left:50%;bottom:170px;transform:translateX(-50%);display:none;background:linear-gradient(180deg,rgba(8,18,11,.96),rgba(5,14,9,.96));border:2px solid rgba(95,240,156,.55);border-radius:14px;padding:10px 18px;z-index:55;text-align:center;color:#fff1c2;font-family:'Outfit','Inter',sans-serif;box-shadow:0 14px 26px rgba(0,0,0,.55);";
    pop.innerHTML = '<div style="font-size:13px;font-weight:700;margin-bottom:4px;">\u{1F6B2} Bicycle</div><div style="font-size:11px;color:rgba(230,255,238,.7);">Press <kbd style="background:rgba(95,240,156,.22);border:1px solid rgba(95,240,156,.55);color:#5ff09c;padding:2px 8px;border-radius:6px;font-family:monospace;font-size:11px;font-weight:700;">B</kbd> to ride</div>';
    document.body.appendChild(pop);

    setInterval(() => {
      if(State.onBike){ pop.style.display = 'none'; return; }
      if(!bike){ pop.style.display = 'none'; return; }
      const d = Math.hypot(Player.pos.x - bike.position.x, Player.pos.z - bike.position.z);
      pop.style.display = (d < 2.5) ? 'block' : 'none';
    }, 200);

    // B key — mount/dismount. (Separate from E so it doesn't fight with
    // NPC dialog buttons.)
    window.addEventListener('keydown', (e) => {
      if(e.code !== "KeyB") return;
      const a = document.activeElement;
      if(a && (a.tagName === "INPUT" || a.tagName === "TEXTAREA")) return;
      if(State.onBike){ dismountBike(); refreshSpawn(); return; }
      // Either we already own one (mount instantly from inventory)
      // or there's a parked bike within reach.
      const hasBike = (State.inventory?.bike || 0) > 0;
      if(hasBike){ mountBike(); return; }
      if(bike){
        const d = Math.hypot(Player.pos.x - bike.position.x, Player.pos.z - bike.position.z);
        if(d < 2.5) mountBike();
      }
    });

    // Initial spawn check after a short delay so the world is settled
    const bkCss = document.createElement('style');
    bkCss.textContent = '.bk-bg{position:fixed;inset:0;display:none;align-items:center;justify-content:center;background:rgba(0,0,0,.65);z-index:240;padding:18px;}.bk-bg.show{display:flex;}.bk-card{background:linear-gradient(180deg,rgba(8,18,11,.97),rgba(5,14,9,.97));border:2px solid rgba(95,240,156,.55);border-radius:18px;padding:22px;max-width:380px;width:100%;color:#fff1c2;font-family:Outfit,Inter,sans-serif;text-align:center;}.bk-card h3{font-family:Outfit,sans-serif;font-weight:800;font-size:18px;color:#5ff09c;letter-spacing:1px;margin-bottom:6px;}.bk-card p{font-size:12.5px;color:rgba(230,255,238,.7);margin-bottom:14px;line-height:1.5;}.bk-row{display:flex;gap:8px;justify-content:center;}.bk-btn{background:linear-gradient(135deg,#5ff09c,#a8ffd0);color:#0a1410;border:0;padding:10px 22px;border-radius:10px;font-family:Outfit,sans-serif;font-weight:800;font-size:11.5px;letter-spacing:1px;cursor:pointer;text-transform:uppercase;}.bk-btn.cancel{background:transparent;color:rgba(230,255,238,.7);border:1px solid rgba(230,255,238,.25);}.bk-eject{position:fixed;left:50%;bottom:170px;transform:translateX(-50%);display:none;background:linear-gradient(180deg,rgba(8,18,11,.96),rgba(5,14,9,.96));border:2px solid rgba(255,206,74,.5);border-radius:12px;padding:8px 16px;color:#ffd64d;font-family:Outfit,sans-serif;font-weight:800;font-size:11px;letter-spacing:.8px;cursor:pointer;text-transform:uppercase;z-index:55;}.bk-eject.show{display:block;}';
    document.head.appendChild(bkCss);
    const bkBg = document.createElement('div');
    bkBg.className = 'bk-bg';
    bkBg.innerHTML = '<div class="bk-card"><h3>\u{1F6B2} Hop on the bike?</h3><p>You will ride faster than walking. Click Eject or press B to dismount.</p><div class="bk-row"><button class="bk-btn cancel" id="bkCancel">Cancel</button><button class="bk-btn" id="bkRide">Ride</button></div></div>';
    document.body.appendChild(bkBg);
    document.getElementById('bkCancel').addEventListener('click', () => bkBg.classList.remove('show'));
    bkBg.addEventListener('click', (e) => { if(e.target === bkBg) bkBg.classList.remove('show'); });
    document.getElementById('bkRide').addEventListener('click', () => { bkBg.classList.remove('show'); mountBike(); });
    const ejectBtn = document.createElement('button');
    ejectBtn.className = 'bk-eject';
    ejectBtn.innerHTML = '\u{1F6B2} Eject · <span style="background:rgba(0,0,0,.35);padding:1px 7px;border-radius:5px;font-family:monospace;font-size:10px;margin-left:4px;">B</span>';
    document.body.appendChild(ejectBtn);
    setInterval(() => ejectBtn.classList.toggle('show', !!State.onBike), 200);
    function wireInvClick(){
      const grid = document.getElementById('invGrid');
      if(!grid){ setTimeout(wireInvClick, 600); return; }
      grid.addEventListener('click', (e) => {
        const slot = e.target.closest('.inv-slot[data-id="bike"]');
        if(State.onBike){ window.floater?.("Already riding", "bad"); return; }
        bkBg.classList.add('show');
      });
    }
    wireInvClick();
    console.log('[bike] ready');
  }
})();
