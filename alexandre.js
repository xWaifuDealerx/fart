// =================================================================
// alexandre.js — bald guy beside the football trophy.
// =================================================================
// He pitches the existing Fart Cup tokens (real pump.fun coins on
// Solana). Trading + holding them qualifies you for the airdropped
// collectibles during the World Cup, and every trade fee goes to the
// $FARTPRINT buyback & burn. His "Trade" button just opens the same
// Fart Cup modal the football statue opens.
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
    const State  = window.State;
    const groundHeightAt = window.groundHeightAt;
    const ALEX_POS = { x: -10.5, z: -45 };

    // ── Wooden kiosk stand ──
    const stand = new THREE.Group();
    const y0 = groundHeightAt(ALEX_POS.x, ALEX_POS.z);
    stand.position.set(ALEX_POS.x, y0, ALEX_POS.z);
    stand.rotation.y = -Math.PI / 2;
    const woodMat = new THREE.MeshStandardMaterial({ color: 0x6b4a25, roughness: 0.85 });
    const darkMat = new THREE.MeshStandardMaterial({ color: 0x2a1408, roughness: 0.9 });
    const top = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.16, 1.1), woodMat);
    top.position.set(0, 1.10, 0); top.castShadow = true; stand.add(top);
    const front = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.0, 0.12), darkMat);
    front.position.set(0, 0.55, 0.55); stand.add(front);
    for(const sx of [-1.2, 1.2]){
      const side = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.0, 1.1), darkMat);
      side.position.set(sx, 0.55, 0); stand.add(side);
    }
    const awnMat1 = new THREE.MeshStandardMaterial({ color: 0xff7a2a, roughness: 0.85, side: THREE.DoubleSide });
    const awnMat2 = new THREE.MeshStandardMaterial({ color: 0xfff1c2, roughness: 0.85, side: THREE.DoubleSide });
    for(let i = 0; i < 6; i++){
      const s = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.06, 1.2), i % 2 ? awnMat2 : awnMat1);
      s.position.set(-1.05 + i * 0.42, 2.7, 0); stand.add(s);
    }
    for(const px of [-1.05, 1.05]){
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.7, 6), woodMat);
      pole.position.set(px, 1.35, 0.55); stand.add(pole);
    }
    const goldMat = new THREE.MeshStandardMaterial({ color: 0xffce4a, roughness: 0.4, metalness: 0.7, emissive: 0x553500, emissiveIntensity: 0.3 });
    for(let i = 0; i < 7; i++){
      const c = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.06, 14), goldMat);
      c.position.set(-0.5, 1.22 + i * 0.065, 0.2); stand.add(c);
    }
    (function(){
      const cvs = document.createElement('canvas');
      cvs.width = 512; cvs.height = 128;
      const ctx = cvs.getContext('2d');
      ctx.fillStyle = '#1c0c04'; ctx.fillRect(0, 0, 512, 128);
      ctx.strokeStyle = '#ff7a2a'; ctx.lineWidth = 5; ctx.strokeRect(8, 8, 496, 112);
      ctx.fillStyle = '#fff1c2';
      ctx.font = "900 50px 'Bangers','Orbitron',sans-serif";
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText("ALEXANDRE — FART CUP DESK", 256, 50);
      ctx.fillStyle = '#ff7a2a';
      ctx.font = "700 20px 'Orbitron',sans-serif";
      ctx.fillText('TRADE → AIRDROPS · FEES → BURN $FARTPRINT', 256, 96);
      const tex = new THREE.CanvasTexture(cvs);
      const m = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 0.6), new THREE.MeshBasicMaterial({ map: tex }));
      m.position.set(0, 2.45, -0.05); m.rotation.x = -0.08;
      stand.add(m);
    })();
    scene.add(stand);

    // ── Alexandre: bald guy printer ──
    const alex = new THREE.Group();
    // Stand behind the desk — pushed further back so his body isn't
    // clipping into the table. The desk + customer face the +x side
    // (stand.rotation.y = -π/2), so "behind" the table is the -x side.
    // Was at ALEX_POS.x - 1.4 which read as "in front" of the table from
    // the user's POV. Flip to the +x side and face him back at the table.
    alex.position.set(ALEX_POS.x + 1.4, y0, ALEX_POS.z);
    alex.rotation.y = -Math.PI / 2;
    const skinMat = new THREE.MeshStandardMaterial({ color: 0xf2d2a8, roughness: 0.55 });
    const shirtMat = new THREE.MeshStandardMaterial({ color: 0x223060, roughness: 0.7 });
    const pantMat = new THREE.MeshStandardMaterial({ color: 0x101a2a, roughness: 0.85 });
    const eyeWMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3 });
    const eyeBMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.85, 0.6), shirtMat);
    torso.position.y = 1.25; torso.castShadow = true; alex.add(torso);
    // Legs (a touch taller so the feet poke out below the desk)
    const lg = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.7, 0.35), pantMat);
    lg.position.set(-0.22, 0.50, 0.15); alex.add(lg);
    const rg = lg.clone(); rg.position.x = 0.22; alex.add(rg);
    // Feet — chunky brown shoes
    const shoeMat = new THREE.MeshStandardMaterial({ color: 0x2a1408, roughness: 0.8 });
    const fL = new THREE.Mesh(new THREE.BoxGeometry(0.30, 0.12, 0.45), shoeMat);
    fL.position.set(-0.22, 0.09, 0.22); alex.add(fL);
    const fR = fL.clone(); fR.position.x = 0.22; alex.add(fR);
    const aL = new THREE.Mesh(new THREE.BoxGeometry(0.20, 0.20, 0.7), shirtMat);
    aL.position.set(-0.50, 1.32, 0.30); alex.add(aL);
    const aR = aL.clone(); aR.position.x = 0.50; alex.add(aR);
    const hMat = new THREE.MeshStandardMaterial({ color: 0xf2d2a8, roughness: 0.55 });
    const hL = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 8), hMat);
    hL.position.set(-0.50, 1.32, 0.68); alex.add(hL);
    const hR = hL.clone(); hR.position.x = 0.50; alex.add(hR);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.34, 18, 14), skinMat);
    head.position.set(0, 2.05, 0); head.scale.set(1, 1.05, 1); head.castShadow = true; alex.add(head);
    const shine = new THREE.Mesh(
      new THREE.SphereGeometry(0.12, 10, 10),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.2 })
    );
    shine.position.set(-0.08, 2.30, 0.05); alex.add(shine);
    const hairMat = new THREE.MeshStandardMaterial({ color: 0x35261b, roughness: 0.9 });
    for(const sx of [-0.32, 0.32]){
      const tuft = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), hairMat);
      tuft.position.set(sx, 1.96, 0); alex.add(tuft);
    }
    const browMat = new THREE.MeshStandardMaterial({ color: 0x2a1a10, roughness: 0.6 });
    const browL = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.025, 0.04), browMat);
    browL.position.set(-0.12, 2.13, 0.28); alex.add(browL);
    const browR = browL.clone(); browR.position.x = 0.12; alex.add(browR);
    const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 10), eyeWMat);
    eyeL.position.set(-0.12, 2.05, 0.32); alex.add(eyeL);
    const eyeR = eyeL.clone(); eyeR.position.x = 0.12; alex.add(eyeR);
    const pupL = new THREE.Mesh(new THREE.SphereGeometry(0.025, 8, 8), eyeBMat);
    pupL.position.set(-0.12, 2.05, 0.37); alex.add(pupL);
    const pupR = pupL.clone(); pupR.position.x = 0.12; alex.add(pupR);
    const mus = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.04, 0.05), browMat);
    mus.position.set(0, 1.93, 0.30); alex.add(mus);
    scene.add(alex);

    // Name tag
    const tag = document.createElement('div');
    tag.style.cssText = `position:absolute;transform:translate(-50%,-100%);background:rgba(8,18,11,.88);color:#ff7a2a;padding:4px 10px;border:1px solid rgba(255,122,42,.55);border-radius:8px;font-family:'Outfit','JetBrains Mono',monospace;font-size:10.5px;pointer-events:none;z-index:9;white-space:nowrap;`;
    tag.textContent = "Alexandre \u{1FAA9}";
    (document.getElementById('chatBubbles')?.parentElement || document.body).appendChild(tag);

    // ── Pitch popup that opens the real Fart Cup modal ──
    const css = document.createElement('style');
    css.textContent = `
.alex-pop{position:fixed;left:50%;bottom:130px;transform:translateX(-50%);display:none;background:linear-gradient(180deg,rgba(28,14,8,.96),rgba(20,10,6,.96));border:2px solid rgba(255,122,42,.6);border-radius:14px;padding:14px 22px;z-index:50;text-align:center;max-width:360px;box-shadow:0 14px 26px rgba(0,0,0,.55)}
.alex-pop.show{display:block}
.alex-pop .who{font-family:'Outfit','JetBrains Mono',monospace;font-size:10.5px;color:rgba(255,241,194,.7);margin-bottom:6px;letter-spacing:.5px}
.alex-pop .who b{color:#ff7a2a}
.alex-pop .line{font-family:'Bangers','Orbitron',sans-serif;font-size:18px;color:#fff1c2;margin-bottom:10px;letter-spacing:.8px}
.alex-pop .quip{font-size:11px;color:rgba(255,241,194,.78);margin-bottom:12px;line-height:1.5}
.alex-pop .quip b{color:#ffd64d}
.alex-pop .btn{background:linear-gradient(135deg,#ff7a2a,#ffce4a);color:#2a1408;border:0;padding:9px 18px;border-radius:100px;font-family:'Orbitron',sans-serif;font-weight:900;font-size:12px;text-transform:uppercase;cursor:pointer;letter-spacing:.6px;box-shadow:0 6px 14px rgba(255,122,42,.35)}
.alex-pop .btn:hover{filter:brightness(1.07)}
`;
    document.head.appendChild(css);
    const pop = document.createElement('div');
    pop.className = 'alex-pop';
    pop.innerHTML = `<div class="who"><b>Alexandre</b> \u{1FAA9}</div>
      <div class="line">Trade Fart Cup tokens with me!</div>
      <div class="quip">Pump.fun coins on Solana. <b>Hold</b> them through the event for collectible airdrops. Every trade fee goes to <b>buy &amp; burn $FARTPRINT</b> — you're supporting the ecosystem.</div>
      <button class="btn" id="alexOpenFC">Open Fart Cup</button>`;
    document.body.appendChild(pop);
    document.getElementById('alexOpenFC').addEventListener('click', () => {
      if(typeof window.openFartCup === 'function'){ window.openFartCup(); }
      else { document.getElementById('fcBg')?.classList.add('show'); }
    });
    // Popup disabled — the in-game green sign in front of the stand
    // already explains the offer. Just track proximity for E key.
    let near = false;
    setInterval(() => {
      const d = Math.hypot(Player.pos.x - ALEX_POS.x, Player.pos.z - ALEX_POS.z);
      near = d < 4.5;
    }, 200);
    if(pop && pop.parentNode) pop.parentNode.removeChild(pop);
    window.addEventListener('keydown', e => {
      if(e.code !== 'KeyE' || !near) return;
      const a = document.activeElement;
      if(a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA')) return;
      if(typeof window.openFartCup === 'function'){ window.openFartCup(); }
    });
    console.log('[alexandre] ready');
  }
})();
