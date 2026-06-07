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
      { x:  70, z:  70, r: 3 },   // Jail cell
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
    pop.innerHTML = `<div class="who"><b id="junkPopName">—</b> 🖨</div><div class="line">Do business…</div><button class="btn" id="junkPopBtn">Open Trade</button>`;
    document.body.appendChild(pop);
    document.getElementById('junkPopBtn').addEventListener('click', () => {
      if(nearJ) openTrade(nearJ);
    });
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

    // ── Trade modal ──
    const style = document.createElement('style');
    style.textContent = `
.junk-bg { position: fixed; inset: 0; background: rgba(0,0,0,.78); backdrop-filter: blur(10px); display: none; align-items: center; justify-content: center; z-index: 65; padding: 20px; }
.junk-bg.show { display: flex; }
.junk-card { max-width: 440px; width: 100%; background: linear-gradient(180deg, rgba(20,32,12,.97), rgba(8,18,6,.97)); border: 2px solid rgba(155,197,90,.55); border-radius: 18px; padding: 20px 24px; }
.junk-card h2 { font-family: 'Bangers','Orbitron',sans-serif; font-size: 28px; letter-spacing: 2.2px; color: #c0e02a; margin-bottom: 4px; }
.junk-card .vibe { font-family: 'JetBrains Mono',monospace; font-size: 11px; color: rgba(230,255,238,.55); margin-bottom: 14px; font-style: italic; }
.junk-card p { color: rgba(230,255,238,.72); font-size: 13px; line-height: 1.5; margin-bottom: 14px; }
.junk-card p b { color: #c0e02a; }
.junk-stats { display: grid; grid-template-columns: repeat(3,1fr); gap: 8px; margin-bottom: 12px; }
.junk-stat { background: rgba(155,197,90,.06); border: 1px solid rgba(155,197,90,.20); border-radius: 10px; padding: 8px 10px; text-align: center; }
.junk-stat .lbl { font-family: 'JetBrains Mono',monospace; font-size: 9px; color: rgba(230,255,238,.5); text-transform: uppercase; }
.junk-stat .val { font-family: 'Orbitron',sans-serif; font-weight: 900; font-size: 16px; color: #ffd64d; margin-top: 2px; }
.junk-go { width: 100%; background: linear-gradient(135deg, #9bc55a, #c0e02a); color: #112000; border: 0; padding: 13px; border-radius: 100px; font-family: 'Orbitron',sans-serif; font-weight: 900; font-size: 12px; letter-spacing: 1.4px; text-transform: uppercase; cursor: pointer; }
.junk-go:disabled { opacity: .4; cursor: not-allowed; }
.junk-cancel { width: 100%; background: transparent; border: 1px solid rgba(230,255,238,.25); color: rgba(230,255,238,.6); padding: 8px; border-radius: 100px; font-family: 'JetBrains Mono',monospace; font-size: 11px; cursor: pointer; margin-top: 8px; }
`;
    document.head.appendChild(style);
    const negCSS = document.createElement('style');
    negCSS.textContent = `.junk-neg{margin:14px 0;padding:10px;background:rgba(95,240,156,.06);border:1px solid rgba(95,240,156,.25);border-radius:10px}.junk-neg .ask{font-size:11.5px;color:rgba(230,255,238,.7);margin-bottom:8px;text-align:center}.junk-neg .ask b{color:#5ff09c}.junk-neg input[type=range]{width:100%;accent-color:#5ff09c}.junk-neg .row{display:flex;justify-content:space-between;align-items:center;font-size:11px;color:rgba(230,255,238,.7);margin-top:6px}.junk-neg .row b{color:#ffd64d;font-size:13px}.junk-mood{font-size:11px;margin-top:6px;text-align:center}.junk-mood.happy{color:#5ff09c}.junk-mood.greedy{color:#ff9a3a}.junk-mood.angry{color:#ff5060}.junk-result{margin-top:10px;text-align:center;font-family:'Bangers','Orbitron',sans-serif;font-size:18px;letter-spacing:1px;display:none}.junk-result.show{display:block}.junk-result.win{color:#5ff09c}.junk-result.lose{color:#ff5060}`;
    document.head.appendChild(negCSS);
    const el = document.createElement('div');
    el.innerHTML = '<div class="junk-bg" id="junkBg"><div class="junk-card"><h2 id="junkName">Junkie</h2><div class="vibe">eyes rolling, smells like burnt toast</div><p id="junkOffer">Heyy man... gimme some o that <b>weed</b>.</p><div class="junk-stats"><div class="junk-stat"><div class="lbl">Your \u{1F33F}</div><div class="val" id="junkWeed">0</div></div><div class="junk-stat"><div class="lbl">Your \u{1F4B5}</div><div class="val" id="junkCash">0</div></div><div class="junk-stat"><div class="lbl">Your \u{1FA99}</div><div class="val" id="junkFake">0</div></div></div><div class="junk-neg"><div class="ask">Ask price per bud: <b id="junkAsk">5</b> \u{1F4B5}</div><input type="range" id="junkSlider" min="50" max="200" step="5" value="100"><div class="row"><span>fair = <b id="junkFair">5</b>\u{1F4B5}</span><span id="junkMood" class="junk-mood">type a price to test his mood</span></div></div><div class="junk-result" id="junkResult">—</div><button class="junk-go" id="junkGo">Try to sell 1 \u{1F33F}</button><button class="junk-cancel" id="junkCancel">Leave</button></div></div>';
    document.body.appendChild(el.firstElementChild);
    document.getElementById('junkCancel').addEventListener('click', () => document.getElementById('junkBg').classList.remove('show'));
    document.getElementById('junkBg').addEventListener('click', (e) => { if(e.target.id === "junkBg") document.getElementById('junkBg').classList.remove('show'); });

    // Each junkie has a hidden "max willing" multiplier — re-rolled per
    // visit so the player can't always know it.
    function rollMax(j){
      // Junkie pays 0.6x – 1.4x the fair PRICE. Mood is set each open.
      j._maxMult = 0.6 + Math.random() * 0.8;
      // Extra failure chance even if user underbids — they might just be
      // too high to count.
      j._dealVibe = 0.85 + Math.random() * 0.30;
    }
    function moodFor(askMult){
      if(askMult <= 0.85) return { txt: '\u{1F60D} "Yesss, take my money!"', cls: 'happy' };
      if(askMult <= 1.05) return { txt: '\u{1F914} "Hmm... maybe."', cls: 'greedy' };
      if(askMult <= 1.30) return { txt: '\u{1F62C} "That\'s pricey..."', cls: 'greedy' };
      return { txt: '\u{1F620} "No way man, scram!"', cls: 'angry' };
    }
    function openTrade(j){
      rollMax(j);
      document.getElementById('junkName').textContent = j.name + " \u{1F5A8}";
      document.getElementById('junkOffer').innerHTML = `Heyy man, gimme some o that <b>weed</b>. Fair street price is around <b>${PRICE}\u{1F4B5}</b>... but try me. ${j._maxMult > 1.1 ? "I'm feelin' generous today." : "I'm broke."}`;
      document.getElementById('junkWeed').textContent = State.inventory?.weed || 0;
      document.getElementById('junkCash').textContent = State.paper      || 0;
      document.getElementById('junkFake').textContent = State.fakeMoney  || 0;
      document.getElementById('junkFair').textContent = PRICE;
      const slider = document.getElementById('junkSlider');
      const askLbl = document.getElementById('junkAsk');
      const moodEl = document.getElementById('junkMood');
      slider.value = String(PRICE);
      askLbl.textContent = String(PRICE);
      const updateMood = () => {
        const v = Number(slider.value);
        askLbl.textContent = String(v);
        const mult = v / PRICE;
        const m = moodFor(mult);
        moodEl.textContent = m.txt;
        moodEl.className = 'junk-mood ' + m.cls;
      };
      slider.oninput = updateMood;
      updateMood();
      const res = document.getElementById('junkResult');
      res.classList.remove('show', 'win', 'lose'); res.textContent = '';
      const btn = document.getElementById('junkGo');
      const have = (State.inventory?.weed || 0) > 0;
      btn.disabled = !have;
      btn.textContent = have ? `Try to sell 1 \u{1F33F}` : "No \u{1F33F}";
      document.getElementById('junkBg').classList.add('show');
    }
    document.getElementById('junkGo').addEventListener('click', () => {
      const have = (State.inventory?.weed || 0) > 0;
      if(!have) return;
      const j = nearJ; if(!j) return;
      const ask = Number(document.getElementById('junkSlider').value);
      const maxHePays = Math.floor(PRICE * j._maxMult);
      const res = document.getElementById('junkResult');
      const vibeGate = Math.random() <= j._dealVibe;
      if(ask <= maxHePays && vibeGate){
        window.takeItem("weed", 1);
        State.paper = (State.paper || 0) + ask;
        State.xp = (State.xp || 0) + 6 + Math.max(0, ask - PRICE);
        j.jointUntil = Date.now() + 10*60*1000;
        res.textContent = `SOLD! +${ask} \u{1F4B5}`;
        res.classList.add('show', 'win');
        window.playPurchaseSound?.();
        window.checkLevelUp?.();
        setTimeout(() => document.getElementById('junkBg').classList.remove('show'), 1100);
      } else {
        const lines = ask > maxHePays
          ? [`"Nahh too much. ${maxHePays}\u{1F4B5} max."`, `"Get out of my face!"`, `"You crazy man??"`]
          : [`"...Eh actually nah, not today."`, `"My guy let me up, I'll think it over."`, `"Bzzt, deal fell through."`];
        res.textContent = lines[Math.floor(Math.random() * lines.length)];
        res.classList.add('show', 'lose');
        rollMax(j);
        document.getElementById('junkOffer').innerHTML = `Heyy man, gimme some o that <b>weed</b>. Fair street price is around <b>${PRICE}\u{1F4B5}</b>... I changed my mind on the offer.`;
      }
      window.saveState?.();
      window.updateHUD?.();
    });
    window.addEventListener('keydown', (e) => {
      if(e.code !== "KeyE" || !nearJ) return;
      const a = document.activeElement;
      if(a && (a.tagName === "INPUT" || a.tagName === "TEXTAREA")) return;
      openTrade(nearJ);
    });
    console.log("[junkies] 3 NPCs ready");
  }
})();
