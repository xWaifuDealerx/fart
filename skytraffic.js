// =================================================================
// skytraffic.js — ambient aircraft circling the island, forever.
//
// Cosmetic GLBs from assets/models/: airplane.glb, airship.glb,
// spaceship.glb, hotairballoon.glb. Each follows its own orbit at
// its own altitude/speed — something to watch (and dodge!) while
// flying. They are SOLID to the player's seaplane: fly into one and
// you CRASH — boom, damage, and your plane drops out of the sky.
// =================================================================
(function(){
  'use strict';

  function whenReady(){
    if(!window.THREE || !window.scene || !window.Player || !window.FWModels || !window.groundHeightAt){
      setTimeout(whenReady, 400);
      return;
    }
    init();
  }
  whenReady();

  function init(){
    const THREE  = window.THREE;
    const scene  = window.scene;
    const Player = window.Player;

    // Register the new models with the shared loader (CFG is live)
    const cfg = window.FWModels.cfg;
    if(!cfg.airplane)      cfg.airplane      = { url: 'airplane.glb',      fit: 12, rotYdeg: 0, rotXdeg: 0, anchor: 'center' };
    if(!cfg.airship)       cfg.airship       = { url: 'airship.glb',       fit: 24, rotYdeg: 0, rotXdeg: 0, anchor: 'center' };
    if(!cfg.spaceship)     cfg.spaceship     = { url: 'spaceship.glb',     fit: 12, rotYdeg: 0, rotXdeg: 0, anchor: 'center' };
    if(!cfg.hotairballoon) cfg.hotairballoon = { url: 'hotairballoon.glb', fit: 12, rotYdeg: 0, rotXdeg: 0, anchor: 'center' };

    // Orbit definitions — radius/altitude/speed all differ so the sky
    // feels alive. dir flips a couple to orbit the other way.
    // hitR = collision radius (m). yawOff lets us fix a model that
    // faces the wrong way (radians, tweak per model if needed).
    const CRAFT = [
      { key: 'airplane',      label: 'airplane ✈️',        r: 150, alt: 46, speed: 0.050, dir:  1, bob: 0.6, bobSpd: 0.9, hitR: 6,  yawOff: 0, phase: 0.3 },
      { key: 'airship',       label: 'airship 🛸',          r: 105, alt: 36, speed: 0.011, dir: -1, bob: 1.2, bobSpd: 0.4, hitR: 11, yawOff: 0, phase: 2.4 },
      { key: 'spaceship',     label: 'spaceship 🛸',        r: 205, alt: 66, speed: 0.085, dir: -1, bob: 0.8, bobSpd: 1.6, hitR: 6,  yawOff: 0, phase: 4.1 },
      { key: 'hotairballoon', label: 'hot air balloon 🎈',  r: 70,  alt: 30, speed: 0.008, dir:  1, bob: 2.2, bobSpd: 0.3, hitR: 6,  yawOff: 0, phase: 5.5 },
    ];
    const live = [];

    for(const c of CRAFT){
      window.FWModels.get(c.key).then(model => {
        model.traverse(o => { if(o.isMesh){ o.castShadow = false; o.receiveShadow = false; } });
        model.userData.fwDynamic = true;     // never a collide.js wall
        scene.add(model);
        live.push(Object.assign({ mesh: model, a: c.phase, lastCrash: 0 }, c));
        console.log('[skytraffic] ' + c.key + ' airborne');
      }).catch(err => console.warn('[skytraffic] ' + c.key + '.glb failed to load — check assets/models/', err));
    }

    // ── crash FX ──
    function boomSound(){
      try {
        const ctx = window.ensureAudio?.();
        if(!ctx) return;
        const now = ctx.currentTime;
        const dur = 0.5;
        const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * dur), ctx.sampleRate);
        const ch = buf.getChannelData(0);
        for(let i = 0; i < ch.length; i++){
          const t = i / ch.length;
          ch[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, 2.2);
        }
        const src = ctx.createBufferSource(); src.buffer = buf;
        const filt = ctx.createBiquadFilter();
        filt.type = 'lowpass'; filt.frequency.setValueAtTime(900, now);
        filt.frequency.exponentialRampToValueAtTime(120, now + dur);
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.7, now);
        g.gain.exponentialRampToValueAtTime(0.001, now + dur);
        src.connect(filt); filt.connect(g); g.connect(ctx.destination);
        src.start(now); src.stop(now + dur);
      } catch(_){}
    }
    function shake(){
      const cv = document.getElementById('canvas');
      if(!cv) return;
      let i = 0;
      const iv = setInterval(() => {
        const amp = 10 * (1 - i / 6);
        cv.style.transform = 'translate(' + ((Math.random() - 0.5) * amp) + 'px,' + ((Math.random() - 0.5) * amp) + 'px)';
        if(++i >= 6){ clearInterval(iv); cv.style.transform = ''; }
      }, 40);
    }

    function crash(craft){
      const b = Player.boat;
      if(!b || !b.isPlane || !b.plane) return;
      const p = b.plane;
      // Bounce the plane back out of the obstacle so it can't tunnel
      const dx = p.x - craft.mesh.position.x;
      const dz = p.z - craft.mesh.position.z;
      const d = Math.hypot(dx, dz) || 1;
      p.x += (dx / d) * 5;
      p.z += (dz / d) * 5;
      // Kill the engine — the existing physics drops it out of the sky
      p.speed = 0;
      p.vy = -3.5;
      boomSound();
      shake();
      const fl = document.getElementById('flash');
      if(fl){ fl.classList.add('bad'); setTimeout(() => fl.classList.remove('bad'), 200); }
      window.floater?.('💥 You crashed into the ' + craft.label + '!', 'bad');
      try { window.damagePlayer?.(30, '✈️ mid-air collision'); } catch(_){}
    }

    // ── per-frame orbits + collision ──
    const _next = new THREE.Vector3();
    let last = performance.now();
    function tick(t){
      requestAnimationFrame(tick);
      const dt = Math.min(0.06, (t - last) / 1000) || 0.016;
      last = t;
      const flying = Player.boat && Player.boat.isPlane;
      for(const c of live){
        c.a += c.speed * c.dir * dt;
        const x = Math.cos(c.a) * c.r;
        const z = Math.sin(c.a) * c.r;
        const y = c.alt + Math.sin(t / 1000 * c.bobSpd + c.phase) * c.bob;
        c.mesh.position.set(x, y, z);
        // face along the direction of travel
        const a2 = c.a + c.speed * c.dir * 0.5;
        _next.set(Math.cos(a2) * c.r, y, Math.sin(a2) * c.r);
        c.mesh.lookAt(_next);
        if(c.yawOff) c.mesh.rotation.y += c.yawOff;
        // SOLID to the seaplane — fly into it and you crash
        if(flying && t - c.lastCrash > 3000){
          const dx = Player.pos.x - x;
          const dy = Player.pos.y - y;
          const dz = Player.pos.z - z;
          if(dx * dx + dy * dy + dz * dz < (c.hitR + 2.2) * (c.hitR + 2.2)){
            c.lastCrash = t;
            crash(c);
          }
        }
      }
    }
    requestAnimationFrame(tick);

    console.log('[skytraffic] ready — watch the skies');
  }
})();
