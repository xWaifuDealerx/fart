// =================================================================
// junkies.js — 3 drugged-out printer NPCs that buy fake weed
// =================================================================
// Zoomkins, Printrn, Mastrprintr roam the island farting, eyes
// rolling. Get near one → it stops. Press E to sell weed:
//   • Base price: 100 cash per 1 weed.
//   • If the player has ≥100 fake cash, the junkie hands over a
//     200-cash bill and the player gives 100 fake "change" back.
//     The junkie's too zooted to notice — net effect: +100 real
//     cash, −100 fake cash. Laundering with no jail risk.
//   • No fake on hand → flat 100 cash for the weed.
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
    const ISLAND_R = (window.ISLAND_RADIUS || 90) - 6;
    const WATER_L  = window.WATER_LEVEL || 0;

    const Junkies = [];
    const JUNKIE_NEAR     = 4.0;
    const PRICE           = 100;     // base cash per weed
    const LAUNDER_BILL    = 200;     // cash bill the junkie hands over when fake is in play

    function buildJunkie(name, tint){
      const grp = new THREE.Group();
      const bodyMat = new THREE.MeshStandardMaterial({ color: tint, roughness: 0.7 });
      const darkMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.7 });
      const eyeWMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3 });
      const eyeBMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
      const limbMat = new THREE.MeshStandardMaterial({ color: 0x3a3a3a, roughness: 0.55 });
      const body = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.95, 1.15), bodyMat);
      body.position.y = 0.85; body.castShadow = true; grp.add(body);
      const bezel = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.07, 1.0), darkMat);
      bezel.position.y = 1.36; grp.add(bezel);
      // Crooked paper sticking out
      const paper = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.7),
        new THREE.MeshStandardMaterial({ color: 0xeae8d2, side: THREE.DoubleSide, roughness: 0.95 }));
      paper.position.set(0.1, 1.45, -0.05);
      paper.rotation.x = -Math.PI / 2 + 0.35;
      paper.rotation.z = 0.15;
      grp.add(paper);
      // Big eyes
      const eyeR = 0.22;
      const eyeL = new THREE.Mesh(new THREE.SphereGeometry(eyeR, 14, 14), eyeWMat);
      eyeL.position.set(-0.32, 1.1, 0.6); grp.add(eyeL);
      const eyeRight = eyeL.clone();
      eyeRight.position.x = 0.32; grp.add(eyeRight);
      // Pupils as separate meshes so they can roll independently
      const pupilL = new THREE.Mesh(new THREE.SphereGeometry(eyeR * 0.45, 10, 10), eyeBMat);
      pupilL.position.set(-0.32, 1.1, 0.78); grp.add(pupilL);
      const pupilR = pupilL.clone(); pupilR.position.x = 0.32; grp.add(pupilR);
      // Crooked antenna with green glow ball
      const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.35, 6), limbMat);
      ant.position.set(0.55, 1.55, 0); ant.rotation.z = 0.5; grp.add(ant);
      const ball = new THREE.Mesh(
        new THREE.SphereGeometry(0.08, 10, 10),
        new THREE.MeshStandardMaterial({ color: 0x46f08a, emissive: 0x46f08a, emissiveIntensity: 1.4, roughness: 0.4 })
      );
      ball.position.set(0.72, 1.74, 0); grp.add(ball);
      // Stubby legs
      const legL = new THREE.Mesh(new THREE.CylinderGeometry(0.10, 0.10, 0.5, 6), limbMat);
      legL.position.set(-0.35, 0.25, 0); grp.add(legL);
      const legR = legL.clone(); legR.position.x = 0.35; grp.add(legR);
      // Joint — hidden by default, shown for 10 min after a sale. Tiny
      // tan cylinder hanging out of the right side of the "mouth".
      const joint = new THREE.Mesh(
        new THREE.CylinderGeometry(0.025, 0.025, 0.22, 6),
        new THREE.MeshStandardMaterial({ color: 0xe8d99a, roughness: 0.95 })
      );
      joint.position.set(0.12, 0.95, 0.6);
      joint.rotation.z = Math.PI / 2 + 0.2;
      joint.visible = false;
      grp.add(joint);
      // Glowing tip of the joint (orange ember)
      const ember = new THREE.Mesh(
        new THREE.SphereGeometry(0.035, 8, 8),
        new THREE.MeshStandardMaterial({ color: 0xff7a1f, emissive: 0xff5a1f, emissiveIntensity: 1.6, roughness: 0.4 })
      );
      ember.position.set(0.25, 0.95, 0.6);
      ember.visible = false;
      grp.add(ember);
      // Floating name tag
      const tag = document.createElement('div');
      tag.style.cssText = `position: absolute; transform: translate(-50%, -100%);
        background: rgba(8,18,11,.86); color: #c0e02a;
        padding: 4px 10px; border: 1px solid rgba(192,224,42,.50);
        border-radius: 8px; font-family: 'JetBrains Mono',monospace;
        font-size: 10.5px; pointer-events: none; z-index: 9; white-space: nowrap;`;
      tag.textContent = name + " 🖨";
      (document.getElementById('chatBubbles')?.parentElement || document.body).appendChild(tag);
      grp.rotation.z = -0.05;
      scene.add(grp);
      return { mesh: grp, eyeL, eyeR: eyeRight, pupilL, pupilR, legL, legR, ball, tag, joint, ember };
    }

    const SPECS = [
      { name: "Zoomkins",   tint: 0x9bc55a, start: [-25, 30] },
      { name: "Printrn",    tint: 0x8c9ec0, start: [ 15, 55] },
      { name: "Mastrprintr",tint: 0xc9a96b, start: [ 40,-10] },
    ];
    for(const spec of SPECS){
      const parts = buildJunkie(spec.name, spec.tint);
      parts.mesh.position.set(spec.start[0], groundHeightAt(spec.start[0], spec.start[1]), spec.start[1]);
      Junkies.push({
        name:  spec.name,
        x:     spec.start[0], z: spec.start[1],
        yaw:   Math.random() * Math.PI * 2,
        goalX: spec.start[0], goalZ: spec.start[1],
        speed: 0.0,
        animT: Math.random() * 10,
        fartT: 4 + Math.random() * 4,    // longer interval — visual fart cue, sound only if close
        jointUntil: 0,                   // ms epoch; joint visible while > now
        ...parts,
      });
    }

    // Forbidden NPC zones — keeps junkies (and cats once we share this)
    // out of places where they'd fall into a pit, get stuck on a mesh,
    // or block the player's view. Listed as { x, z, r } circles.
    const NPC_AVOID = [
      { x:  36, z:  36, r: 14 }, // Deathmatch arena platform (NPCs were
                                  //   falling off the elevated base)
      { x: -15, z: -45, r: 4.5 }, // Fart Cup trophy / football statue
      { x: -22, z:  -8, r: 5 },   // Bank pillars
      { x: -22, z: -32, r: 5 },   // Marketplace
      { x: -48, z:  28, r: 5 },   // Fart Lab
      { x:  42, z:   0, r: 5 },   // Refinery
      { x:  50, z: -36, r: 5 },   // Poop House
      { x:   0, z: -55, r: 6 },   // 3-floor House
      { x:  84, z:   0, r: 5 },   // Dock
      { x: -38, z: -16, r: 6 },   // Bowling alley
      { x: -45, z:   8, r: 4 },   // Paper Mill
      { x:  -8, z: -16, r: 3 },   // Stats billboard
      { x:  55, z:  50, r: 3 },   // Jail cell
    ];
    function _forbidden(gx, gz){
      for(const a of NPC_AVOID){
        if(Math.hypot(gx - a.x, gz - a.z) < a.r) return true;
      }
      return false;
    }
    function pickGoal(j){
      for(let i = 0; i < 20; i++){
        const ang = Math.random() * Math.PI * 2;
        const r   = 6 + Math.random() * 18;
        const gx  = j.x + Math.cos(ang) * r;
        const gz  = j.z + Math.sin(ang) * r;
        if(Math.hypot(gx, gz) >= ISLAND_R) continue;
        if(groundHeightAt(gx, gz) <= WATER_L + 0.1) continue;
        if(_forbidden(gx, gz)) continue;
        j.goalX = gx; j.goalZ = gz; return;
      }
    }

    let nearJ = null;
    const projV = new THREE.Vector3();

    function tick(dt){
      const camera = window.camera;
      nearJ = null;
      let bestD = JUNKIE_NEAR;
      for(const j of Junkies){
        j.animT += dt;
        j.fartT -= dt;
        const dToPlayer = Math.hypot(j.x - Player.pos.x, j.z - Player.pos.z);
        const stop = dToPlayer < JUNKIE_NEAR + 0.5;
        if(stop && dToPlayer < bestD){ bestD = dToPlayer; nearJ = j; }
        if(!stop){
          const dx = j.goalX - j.x, dz = j.goalZ - j.z;
          const d = Math.hypot(dx, dz);
          if(d < 0.6){ pickGoal(j); continue; }
          const nx = dx / d, nz = dz / d;
          // Junkie's body model has its eyes/paper at LOCAL +Z, so setting
          // yaw = atan2(nx, nz) aligns the face with the goal direction —
          // i.e. they walk forward. The previous build had +Math.PI here
          // which flipped them around and made them moonwalk.
          const yawT = Math.atan2(nx, nz);
          let dy = yawT - j.yaw;
          while(dy >  Math.PI) dy -= Math.PI * 2;
          while(dy < -Math.PI) dy += Math.PI * 2;
          j.yaw += dy * Math.min(1, 4 * dt);
          j.speed = 0.7;
          j.x += nx * j.speed * dt;
          j.z += nz * j.speed * dt;
          // Hard clamp: never let a junkie drift past the island. If
          // they somehow ended up over water or past the radius, snap
          // them back to a safe spot inland and pick a new goal.
          const rNow = Math.hypot(j.x, j.z);
          if(rNow > ISLAND_R - 2){
            const k = (ISLAND_R - 4) / Math.max(0.01, rNow);
            j.x *= k; j.z *= k;
            pickGoal(j);
          } else if(groundHeightAt(j.x, j.z) <= WATER_L + 0.1){
            // In water — push back toward origin
            const k = 0.9;
            j.x *= k; j.z *= k;
            pickGoal(j);
          }
        } else {
          j.speed *= 0.9;
        }
        // Lift 0.05 so the printer legs sit on the grass instead of
        // sinking into it (the box body's local y starts at 0).
        const y = groundHeightAt(j.x, j.z) + 0.05;
        j.mesh.position.set(j.x, y, j.z);
        j.mesh.rotation.y = j.yaw;
        j.mesh.rotation.z = -0.05 + Math.sin(j.animT * 0.9) * 0.04;
        // Eye-roll
        const a1 = j.animT * 2.4;
        const a2 = j.animT * 2.4 + Math.PI * 0.7;
        const r = 0.10;
        j.pupilL.position.x = -0.32 + Math.cos(a1) * r;
        j.pupilL.position.y = 1.1   + Math.sin(a1) * r;
        j.pupilR.position.x =  0.32 + Math.cos(a2) * r;
        j.pupilR.position.y = 1.1   + Math.sin(a2) * r;
        const sw = j.speed > 0.05 ? Math.sin(j.animT * 6) * 0.4 : 0;
        j.legL.rotation.x =  sw;
        j.legR.rotation.x = -sw;
        j.ball.material.emissiveIntensity = 1.2 + Math.sin(j.animT * 6) * 0.5;
        // Random fart timer — VISUAL ONLY for now (the constant audio
        // was driving the user up the wall). If you're close enough to
        // see the junkie's eyes, play a very soft toot via Web Audio.
        if(j.fartT <= 0){
          j.fartT = 6 + Math.random() * 6;
          if(dToPlayer < 6){
            try {
              const ctx = window.ensureAudio?.();
              if(ctx){
                const o = ctx.createOscillator();
                o.type = "sawtooth";
                o.frequency.value = 70 + Math.random() * 50;
                const g = ctx.createGain();
                // Very quiet — much lower than the playFartSound default
                g.gain.setValueAtTime(0.02, ctx.currentTime);
                g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.18);
                o.connect(g); g.connect(ctx.destination);
                o.start(); o.stop(ctx.currentTime + 0.20);
              }
            } catch(_){}
          }
        }
        // Joint visibility — stays visible for 10 minutes after a sale.
        const smoking = j.jointUntil && Date.now() < j.jointUntil;
        if(j.joint) j.joint.visible = smoking;
        if(j.ember) j.ember.visible = smoking;
        // Name tag projection
        if(camera && j.tag){
          projV.set(j.x, y + 2.5, j.z);
          projV.project(camera);
          if(projV.z < 1 && projV.z > -1){
            const sx = (projV.x * 0.5 + 0.5) * innerWidth;
            const sy = (-projV.y * 0.5 + 0.5) * innerHeight;
            j.tag.style.left = sx + "px";
            j.tag.style.top  = sy + "px";
            j.tag.style.display = "";
          } else {
            j.tag.style.display = "none";
          }
        }
      }
    }
    let last = performance.now();
    function loop(t){
      const dt = Math.min(0.05, (t - last) / 1000);
      last = t;
      try { tick(dt); } catch(_){}
      requestAnimationFrame(loop);
    }
    requestAnimationFrame(loop);

    // ── "Do Business" floating popup ──
    // Shows when the player is near any junkie. Click the button (or
    // press E) to open the trade modal. Hides the moment the player
    // walks away.
    const popStyle = document.createElement('style');
    popStyle.textContent = `
.junk-pop { position: fixed; left: 50%; bottom: 130px; transform: translateX(-50%); display: none; background: linear-gradient(180deg, rgba(20,32,12,.96), rgba(8,18,6,.96)); border: 2px solid rgba(155,197,90,.55); border-radius: 14px; padding: 12px 18px; box-shadow: 0 14px 36px rgba(0,0,0,.6), 0 0 38px rgba(155,197,90,.30); z-index: 50; text-align: center; }
.junk-pop.show { display: block; }
.junk-pop .who { font-family: 'JetBrains Mono',monospace; font-size: 10.5px; color: rgba(230,255,238,.65); letter-spacing: 1.2px; text-transform: uppercase; margin-bottom: 6px; }
.junk-pop .who b { color: #c0e02a; }
.junk-pop .line { font-family: 'Bangers','Orbitron',sans-serif; font-size: 18px; letter-spacing: 1.6px; color: #fff1c2; margin-bottom: 8px; }
.junk-pop .btn { background: linear-gradient(135deg, #9bc55a, #c0e02a); color: #112000; border: 0; padding: 9px 18px; border-radius: 100px; font-family: 'Orbitron',sans-serif; font-weight: 900; font-size: 12px; letter-spacing: 1.4px; text-transform: uppercase; cursor: pointer; box-shadow: 0 6px 14px rgba(155,197,90,.34); }
.junk-pop .btn:hover { transform: translateY(-1px); filter: brightness(1.08); }
`;
    document.head.appendChild(popStyle);
    const pop = document.createElement('div');
    pop.className = 'junk-pop';
    pop.innerHTML = '<div class="who"><b id="junkPopName">—</b> \u{1F5A8}</div><div class="line">Do business…</div><div style="font-size:11px;color:rgba(230,255,238,.7);margin-bottom:8px;letter-spacing:.4px;">Press <kbd style="background:rgba(192,224,42,.22);border:1px solid rgba(192,224,42,.6);color:#c0e02a;padding:2px 8px;border-radius:6px;font-family:\'JetBrains Mono\',monospace;font-size:11px;font-weight:700;">E</kbd> or click below</div><button class="btn" id="junkPopBtn">Do Business</button>';
    document.body.appendChild(pop);
    // Choice modal — opened by Do Business; offers Sell Weed / Ask Wisdom.
    const chooseStyle = document.createElement('style');
    chooseStyle.textContent = '.junk-choose-bg{position:fixed;inset:0;display:none;align-items:center;justify-content:center;background:rgba(0,0,0,.7);z-index:200;padding:18px;}.junk-choose-bg.show{display:flex;}.junk-choose{background:linear-gradient(180deg,rgba(20,32,12,.97),rgba(8,18,6,.97));border:2px solid rgba(155,197,90,.55);border-radius:18px;padding:24px;max-width:380px;width:100%;color:#fff1c2;font-family:Outfit,Inter,sans-serif;text-align:center;}.junk-choose h3{font-family:Bangers,Orbitron,sans-serif;font-size:22px;color:#c0e02a;letter-spacing:1.6px;margin-bottom:8px;}.junk-choose p{font-size:12px;color:rgba(230,255,238,.7);margin-bottom:18px;line-height:1.5;}.junk-choose .row{display:flex;gap:10px;justify-content:center;flex-wrap:wrap;}.junk-choose .btn{background:linear-gradient(135deg,#9bc55a,#c0e02a);color:#112000;border:0;padding:11px 20px;border-radius:10px;font-family:Outfit,sans-serif;font-weight:800;font-size:11.5px;letter-spacing:1px;cursor:pointer;text-transform:uppercase;flex:1;min-width:130px;}.junk-choose .btn.wisdom{background:linear-gradient(135deg,#9b6ac5,#c08ae0);color:#0a0418;}.junk-choose .cancel{background:transparent;color:rgba(230,255,238,.6);border:0;padding:8px 14px;font-family:Outfit,sans-serif;font-size:10.5px;letter-spacing:.7px;text-transform:uppercase;cursor:pointer;margin-top:8px;}';
    document.head.appendChild(chooseStyle);
    const chooseBg = document.createElement('div');
    chooseBg.className = 'junk-choose-bg';
    chooseBg.innerHTML = '<div class="junk-choose"><h3 id="junkChooseName">Junkie</h3><p>What do you want to do?</p><div class="row"><button class="btn" id="junkChooseSell">\u{1F33F} Sell Weed</button><button class="btn wisdom" id="junkChooseWisdom">\u{1F52E} Ask for Wisdom · 10 \u{1F948}</button></div><div><button class="cancel" id="junkChooseClose">Cancel</button></div></div>';
    document.body.appendChild(chooseBg);
    function openChoose(j){
      document.getElementById('junkChooseName').textContent = j.name + " \u{1F5A8}";
      chooseBg.classList.add('show');
    }
    chooseBg.addEventListener('click', (e) => { if(e.target === chooseBg) chooseBg.classList.remove('show'); });
    document.getElementById('junkChooseClose').addEventListener('click', () => chooseBg.classList.remove('show'));
    document.getElementById('junkChooseSell').addEventListener('click', () => { chooseBg.classList.remove('show'); if(nearJ) openTrade(nearJ); });
    document.getElementById('junkChooseWisdom').addEventListener('click', () => { chooseBg.classList.remove('show'); if(nearJ) openWisdom(nearJ); });
    document.getElementById('junkPopBtn').addEventListener('click', () => { if(nearJ) openChoose(nearJ); });
    // Poll every 160ms to show/hide the popup based on nearJ
    let _lastPopName = null;
    setInterval(() => {
      if(nearJ){
        if(nearJ.name !== _lastPopName){
          document.getElementById('junkPopName').textContent = nearJ.name;
          _lastPopName = nearJ.name;
        }
        pop.classList.add('show');
      } else {
        pop.classList.remove('show');
        _lastPopName = null;
      }
    }, 160);

    // ── Trade modal (sell weed) ──
    const tradeStyle = document.createElement('style');
    tradeStyle.textContent = '.junk-bg{position:fixed;inset:0;display:none;align-items:center;justify-content:center;background:rgba(0,0,0,.7);z-index:200;padding:18px;}.junk-bg.show{display:flex;}.junk-card{background:linear-gradient(180deg,rgba(20,32,12,.97),rgba(8,18,6,.97));border:2px solid rgba(155,197,90,.55);border-radius:18px;padding:22px;max-width:460px;width:100%;color:#fff1c2;font-family:Outfit,Inter,sans-serif;position:relative;box-shadow:0 24px 60px rgba(0,0,0,.6);}.junk-card h2{font-family:Bangers,Orbitron,sans-serif;font-size:24px;color:#c0e02a;letter-spacing:1.5px;margin-bottom:8px;text-align:center;}.junk-offer{font-size:12px;line-height:1.5;color:rgba(230,255,238,.75);margin-bottom:12px;text-align:center;}.junk-offer b{color:#c0e02a;}.junk-row{font-size:12px;display:flex;justify-content:space-between;margin-bottom:8px;color:rgba(230,255,238,.8);font-family:JetBrains Mono,monospace;}.junk-row b{color:#fff1c2;}.junk-slider-wrap{margin:12px 0;}.junk-slider-wrap input[type="range"]{width:100%;}.junk-mood{font-size:12px;color:#c0e02a;text-align:center;margin-top:6px;min-height:18px;}.junk-mood.angry{color:#ff7a6e;}.junk-mood.greedy{color:#ffd64d;}.junk-result{font-size:13px;color:#fff1c2;text-align:center;margin:10px 0;min-height:18px;font-weight:700;}.junk-result.win{color:#5ff09c;}.junk-result.lose{color:#ff7a6e;}.junk-btns{display:flex;gap:8px;justify-content:center;}.junk-btn{background:linear-gradient(135deg,#9bc55a,#c0e02a);color:#112000;border:0;padding:10px 22px;border-radius:10px;font-family:Outfit,sans-serif;font-weight:800;font-size:11.5px;letter-spacing:1.1px;cursor:pointer;text-transform:uppercase;}.junk-btn.cancel{background:transparent;color:rgba(230,255,238,.7);border:1px solid rgba(230,255,238,.25);}';
    document.head.appendChild(tradeStyle);
    const tradeBg = document.createElement('div');
    tradeBg.className = 'junk-bg';
    tradeBg.id = 'junkBg';
    tradeBg.innerHTML = '<div class="junk-card"><h2 id="junkName">Junkie</h2><div class="junk-offer" id="junkOffer">—</div><div class="junk-row"><span>Your \u{1F33F} Weed</span><b id="junkWeed">0</b></div><div class="junk-row"><span>Your \u{1F4B5} Cash</span><b id="junkCash">0</b></div><div class="junk-slider-wrap"><div class="junk-row"><span>Ask price (1 \u{1F33F})</span><b id="junkAsk">100</b> \u{1F4B5}</div><input id="junkSlider" type="range" min="50" max="200" step="5" value="100"><div class="junk-mood" id="junkMood">—</div></div><div class="junk-result" id="junkResult">—</div><div class="junk-btns"><button class="junk-btn cancel" id="junkCancel">Leave</button><button class="junk-btn" id="junkGo">Try to sell 1 \u{1F33F}</button></div></div>';
    document.body.appendChild(tradeBg);
    const PRICE_FAIR = 100;
    function rollMax(j){
      j._maxMult = 0.6 + Math.random() * 0.8;
      j._dealVibe = 0.85 + Math.random() * 0.30;
    }
    function moodFor(mult){
      if(mult <= 0.85) return { txt: '\u{1F60D} "Yesss, take my money!"', cls: '' };
      if(mult <= 1.05) return { txt: '\u{1F914} "Hmm... maybe."', cls: 'greedy' };
      if(mult <= 1.30) return { txt: '\u{1F62C} "Pricey..."', cls: 'greedy' };
      return { txt: '\u{1F620} "No way, scram!"', cls: 'angry' };
    }
    function openTrade(j){
      rollMax(j);
      document.getElementById('junkName').textContent = j.name + " \u{1F5A8}";
      document.getElementById('junkOffer').innerHTML = 'Heyy man, gimme some o\' that <b>weed</b>. Fair price is <b>' + PRICE_FAIR + ' \u{1F4B5}</b>... try me.';
      document.getElementById('junkWeed').textContent = State.inventory?.weed || 0;
      document.getElementById('junkCash').textContent = State.paper || 0;
      const slider = document.getElementById('junkSlider');
      const askEl  = document.getElementById('junkAsk');
      const moodEl = document.getElementById('junkMood');
      slider.value = String(PRICE_FAIR);
      askEl.textContent = String(PRICE_FAIR);
      function updateMood(){
        const v = Number(slider.value);
        askEl.textContent = String(v);
        const m = moodFor(v / PRICE_FAIR);
        moodEl.textContent = m.txt;
        moodEl.className = 'junk-mood ' + m.cls;
      }
      slider.oninput = updateMood;
      updateMood();
      const res = document.getElementById('junkResult');
      res.classList.remove('win', 'lose'); res.textContent = '';
      const btn = document.getElementById('junkGo');
      const have = (State.inventory?.weed || 0) > 0;
      btn.disabled = !have;
      btn.textContent = have ? 'Try to sell 1 \u{1F33F}' : 'No \u{1F33F}';
      tradeBg.classList.add('show');
    }
    document.getElementById('junkCancel').addEventListener('click', () => tradeBg.classList.remove('show'));
    tradeBg.addEventListener('click', (e) => { if(e.target === tradeBg) tradeBg.classList.remove('show'); });
    document.getElementById('junkGo').addEventListener('click', () => {
      const j = nearJ; if(!j) return;
      const have = (State.inventory?.weed || 0) > 0;
      if(!have) return;
      const ask = Number(document.getElementById('junkSlider').value);
      const maxHePays = Math.floor(PRICE_FAIR * (j._maxMult || 1));
      const res = document.getElementById('junkResult');
      const vibeOk = Math.random() <= (j._dealVibe || 0.9);
      if(ask <= maxHePays && vibeOk){
        window.takeItem?.("weed", 1);
        State.paper = (State.paper || 0) + ask;
        State.xp = (State.xp || 0) + 6 + Math.max(0, ask - PRICE_FAIR);
        j.jointUntil = Date.now() + 10 * 60 * 1000;
        res.textContent = 'SOLD! +' + ask + ' \u{1F4B5}';
        res.classList.add('win');
        window.playPurchaseSound?.();
        window.checkLevelUp?.();
        setTimeout(() => tradeBg.classList.remove('show'), 1100);
      } else {
        const lines = ask > maxHePays
          ? ['"Nahh too much. ' + maxHePays + ' \u{1F4B5} max."', '"You crazy man?!"']
          : ['"...Eh nah, not today."', '"Bzzt, deal fell through."'];
        res.textContent = lines[Math.floor(Math.random() * lines.length)];
        res.classList.add('lose');
        rollMax(j);
      }
      window.saveState?.();
      window.updateHUD?.();
    });
    window.addEventListener('keydown', (e) => {
      if(e.code !== "KeyE" || !nearJ) return;
      const a = document.activeElement;
      if(a && (a.tagName === "INPUT" || a.tagName === "TEXTAREA")) return;
      openChoose(nearJ);
    });

    // ── WISDOM dictionary keyed by NPC name ──
    const WISDOM = {
      "Zoomkins": [
        'Always count your silver before sleep, mi amigo. Trust nobody, not even the cats.',
        'В жизни... life is one big roulette. Bet on yourself, comrade printer.',
        'I once lost a yacht in Vegas. Now I have three. Take the L, build back stronger, ese.',
        'The house always wins. Unless YOU are the house. Be the house, hermano.',
        'A man who fears the table will never eat. Sit. Play. Win or lose with dignity.',
        "I knew El Chapo's printer. Big guy. Big mistakes. Always have an exit plan, primo.",
        'Money is loud. Wisdom is louder, my young friend.',
        'Cash burns, silver tarnishes, but a friend who covers your tab? Puro oro.',
        'Never run from sirens. Run TOWARD them. Confidence is a weapon, papi.',
        'I trust nobody, but love everybody. That is the Zoomkins way.',
        'Tequila is for celebrating. Vodka is for surviving. Know the difference.',
        'If you can lose 50 million in a night and still order another drink, you have arrived.',
        'The blackjack table teaches you more than university, hermanito.',
        'Two rules: pay your debts. And never snitch.',
        'I have been shot at twice. Both times I was holding a winning hand. Stay calm.',
        'The dealer is not your friend. The drinks are not free. Wake up, brother.',
        'A man with no enemies has never done anything important, mi rey.',
        'I retired here because the sea is quieter than Sinaloa. But louder than New York. Perfect.',
        'Never date someone who orders water at the casino. They are undercover.',
        "Real fartillionaires don't post their meals. They eat them.",
        'The cartel taught me numbers. The casino taught me odds. The printer life taught me peace.',
        'Always tip the valet. Always tip the bartender. Always tip the sicario.',
        'Если хочешь жить — give before you take, joven.',
        'A pearl-handled .45 never solved nothing. But it looks good in a photo.',
        'I have buried two best friends. I am still the best friend they ever had.',
        "Never bet a dollar you can't afford to lose. Always bet a million you absolutely cannot.",
        'Discipline beats motivation. Routine beats passion. Boring beats broke.',
        'I came to Fartworld with a duffel bag and a Glock. The Glock stayed in customs. The duffel made me a king.',
        'Listen to old men in casinos. They have stories. The young ones just have debt.',
        'Silence is gold. Gold is silence. The loud man is the broke man.',
        "I once said no to a deal. Three weeks later, three coffins. Sometimes 'no' is the best yes.",
        'Eat well. Sleep deep. Print farts. ¡Eso es la vida buena!',
        'Family is everything. Even chosen family. Even printer family. Especially printer family.',
      ],
      "Mastrprintr": [
        'I built PRINTR. PRINTR built me. Then PRINTR almost killed me. Such is the founder journey.',
        'The first million is the hardest. The second million is the loneliest.',
        'Hire slow. Fire faster. Apologize never.',
        'If your runway is shorter than your stress is long, you do not have a startup — you have a hostage situation.',
        'Equity is fake until you sell. Vest before you trust.',
        'Pump.fun mafia chased me across two countries. Stay liquid. Stay mobile. Stay paranoid.',
        "Customers don't read your roadmap. They read your downtime.",
        'Failure teaches twice as much as success — at half the price.',
        'A bad co-founder will cost you more than a bad market.',
        'Burn rate is a feeling. Profitability is a decision.',
        'If you cannot explain your business to your printer-mom in 30 seconds, you do not have a business.',
        'I closed three companies before I built one that mattered. Persistence is a moat.',
        'Series A is a celebration. Series B is when the real questions begin.',
        'Founders romanticize the grind. Investors romanticize the multiples. Both lie.',
        "Cash is oxygen. Profit is muscle. Don't confuse the two.",
        'There is no MVP for trust. You build it brick by brick.',
        'The market is a wave. You are the surfer. Stop trying to be the ocean.',
        'I once turned down a $50M acquisition. Then I lost the company entirely. Take. The. Offer.',
        'Always have a will, a Plan B, and a lawyer on retainer.',
        'PR is what you say. Marketing is what they say. Brand is what they think when nobody is talking.',
        "Most pitches die on slide three. Open with the problem, not your team's pedigree.",
        'Talent is overrated. Showing up at 6am for 10 years is underrated.',
        'Every founder I admire has at least one scar and one therapist.',
        'If your TAM slide makes you nervous, it should make investors nervous too.',
        'The exit is not the goal. The exit is the deadline.',
        'Surround yourself with builders. Avoid the loudest LinkedIn posters — usually empty boxes.',
        'I lost my house in 2022. I bought three in 2024. The cycle is real. Stay patient.',
        'When the pump.fun mafia knocks, you do not open. You move.',
        'Your worst employee teaches you more about hiring than your best employee.',        'A good board protects you. A great board challenges you. A bad board destroys you.',
        'Do not fall in love with your product. Fall in love with the problem.',
        'Capital is cheaper than execution. Time is cheaper than capital. Use them in that order.',
        'The grind ends. The legend continues. Build something worth a chapter.',
      ],
      "Printrn": [
        'Bro... what if your printer was also a hat? Just throwing it out there.',
        "I read on Reddit that water is wet. So like, maybe don't drink water? Idk.",
        "My uncle's friend's neighbor said NFTs are coming back. He has a Lamborghini. Probably.",
        "If you stare at the moon long enough you become the moon. I tried it once. I'm fine.",
        'Real talk: I think gravity is just a social construct.',
        "Don't tell my boss but I use ChatGPT to write all my emails. And my journal. And my texts.",
        'I think therefore I am... too lazy to think. So am I even a printer?',
        "Tinder bio tip: just put 'entrepreneur' even if you're an unpaid intern. Trust.",
        "I lost 80% on a meme coin last week. My therapist said it's about the journey.",
        "Big brain take: what if we just printed our way out of the recession? Just spitballin'.",
        "I haven't slept in 36 hours. I think I invented a new color — like mauve but ANGRY.",
        "Pro tip: if you don't go to a meeting, the meeting doesn't exist.",
        "I tell my dates I'm 6'2. I'm 5'4. They show up anyway. Wisdom.",
        'Honestly? Coffee is a scam. Just stare at the sun. Same energy.',
        'I think I can outrun a bear. I have not researched this. I just feel it.',
        "Confidence is everything. I failed three classes but I list 'Harvard' on LinkedIn.",
        'Started a podcast yesterday. Zero downloads. Mainstream success awaits.',
        "Heard about 'compound interest.' Sounds boring. Skipped it.",
        'My investment strategy is YOLO into the green candle. Not great. Will report back.',
        "Pretty sure my landlord is also my Uber driver but I can't prove it.",
        'Started intermittent fasting. By intermittent I mean I forgot to eat.',
        'Hot take: maybe the LinkedIn cringe posts ARE the algorithm.',
        "I once made eye contact with a CEO. He nodded. Putting it on my resume as 'mentor.'",
        'Read a book once. Too many words. The movie was better.',
        "If you don't reply to emails, eventually they go away. Wisdom of the ancients.",
        'Been to the gym twice this year. Forgot my gym bag both times. Building lore.',
        'Asked AI to write my will. It told me to seek therapy. Brutal.',
        "Big things coming. Can't say what. Or when. But like, BIG.",
        'The secret to wealth is being born wealthy. Hot take but undeniable.',
        "Does a metaverse fart stink IRL? Need an answer for my pitch deck.",
        "Networking tip: walk up and say 'I'm building something.' Works sometimes.",
        'Mental note: stop signing things without reading them. (Has not stopped.)',
        'My productivity hack is having NO meetings. My calendar is so clean my boss thinks I quit.',
        'Morning routine: 4 alarms, 0 answered, 1 panic attack at noon. CEO mindset.',
      ],
    };

    const wisStyle2 = document.createElement('style');
    wisStyle2.textContent = '.wis-bg{position:fixed;inset:0;display:none;align-items:center;justify-content:center;background:rgba(0,0,0,.7);z-index:200;padding:18px;}.wis-bg.show{display:flex;}.wis-card{background:linear-gradient(180deg,rgba(20,8,30,.97),rgba(8,4,18,.97));border:2px solid rgba(155,106,197,.55);border-radius:18px;padding:24px;max-width:480px;width:100%;color:#fff1c2;font-family:Outfit,Inter,sans-serif;}.wis-card h3{font-family:Outfit,sans-serif;font-weight:800;font-size:14px;letter-spacing:1.2px;color:#c08ae0;text-transform:uppercase;margin-bottom:12px;text-align:center;}.wis-quote{font-size:17px;line-height:1.6;color:#fff1c2;background:rgba(155,106,197,.08);border:1px solid rgba(155,106,197,.3);border-radius:12px;padding:18px 22px;margin-bottom:16px;font-style:italic;}.wis-pay{text-align:center;font-size:12px;color:rgba(230,255,238,.6);margin-bottom:14px;font-family:JetBrains Mono,monospace;}.wis-btns{display:flex;gap:8px;justify-content:center;}.wis-btn{background:linear-gradient(135deg,#9b6ac5,#c08ae0);color:#0a0418;border:0;padding:10px 22px;border-radius:10px;font-family:Outfit,sans-serif;font-weight:800;font-size:11.5px;letter-spacing:1.1px;cursor:pointer;text-transform:uppercase;}.wis-btn.cancel{background:transparent;color:rgba(230,255,238,.7);border:1px solid rgba(230,255,238,.25);}';
    document.head.appendChild(wisStyle2);
    const wisBg = document.createElement('div');
    wisBg.className = 'wis-bg';
    wisBg.innerHTML = '<div class="wis-card"><h3 id="wisHead">Word of Wisdom</h3><div class="wis-quote" id="wisQuote">—</div><div class="wis-pay" id="wisPay">Cost: 10 \u{1F948} Silver</div><div class="wis-btns"><button class="wis-btn cancel" id="wisCancel">Leave</button><button class="wis-btn" id="wisPay10">Pay 10 \u{1F948}</button></div></div>';
    document.body.appendChild(wisBg);
    let wisJunkie = null;
    function openWisdom(j){
      wisJunkie = j;
      document.getElementById('wisHead').textContent = j.name + " · Word of Wisdom";
      document.getElementById('wisQuote').textContent = "Pay 10 silver and I'll drop something on you, printer...";
      document.getElementById('wisPay').textContent = "Cost: 10 \u{1F948} Silver";
      document.getElementById('wisPay10').textContent = "Pay 10 \u{1F948}";
      wisBg.classList.add('show');
    }
    document.getElementById('wisCancel').addEventListener('click', () => wisBg.classList.remove('show'));
    wisBg.addEventListener('click', (e) => { if(e.target === wisBg) wisBg.classList.remove('show'); });
    document.getElementById('wisPay10').addEventListener('click', () => {
      if(!wisJunkie) return;
      if((State.credits || 0) < 10){ window.floater?.("Need 10 \u{1F948}", "bad"); return; }
      const pool = WISDOM[wisJunkie.name] || WISDOM.Printrn;
      const line = pool[Math.floor(Math.random() * pool.length)];
      State.credits -= 10;
      document.getElementById('wisQuote').textContent = line;
      document.getElementById('wisPay').textContent = "-10 \u{1F948} paid · close when ready";
      document.getElementById('wisPay10').textContent = "Another (10 \u{1F948})";
      window.playPurchaseSound?.();
      window.saveState?.();
      window.updateHUD?.();
    });

    console.log("[junkies] ready");
  }
})();
