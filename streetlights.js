// =================================================================
// streetlights.js — tall lamp posts along walkable paths that come on
// at dusk and glow through the night. Reads window.Sky.phase from the
// main module's day/night cycle.
// =================================================================
(function(){
  'use strict';
  function whenReady(){
    if(!window.THREE || !window.scene || !window.groundHeightAt || !window.Sky){
      setTimeout(whenReady, 300); return;
    }
    init();
  }
  whenReady();

  function init(){
    const THREE = window.THREE;
    const scene = window.scene;
    const groundHeightAt = window.groundHeightAt;
    const Sky = window.Sky;

    // Lamp positions placed around well-trafficked walkable areas:
    // near the dock, around market square, by the house, near refinery,
    // near the new Tool Service / Miner's Exchange row, and along the
    // road to the rocket pad.
    const SPOTS = [
      { x:  82, z:  -6 }, // dock left
      { x:  82, z:   6 }, // dock right
      { x:  60, z:   0 }, // road to dock
      { x:  40, z:  10 }, // refinery edge
      { x:  18, z:   0 }, // between Tool Service and main square
      { x: -18, z:   0 }, // Miner's Exchange side
      { x:  -6, z: -18 }, // sign road
      { x:   8, z: -32 }, // approach to house front
      { x:  -8, z: -32 }, // approach to house front (other side)
      { x:  24, z: -10 }, // rocket pad approach
      { x: -22, z: -22 }, // Carlos/market
      { x: -22, z:   4 }, // Bank front
      { x:  36, z:  24 }, // arena entrance
      { x:  -8, z: -52 }, // house porch lamp
      { x:   8, z: -52 }, // house porch lamp
    ];

    // Materials
    const poleMat = new THREE.MeshStandardMaterial({ color: 0x1c2128, roughness: 0.6, metalness: 0.4 });
    const headMat = new THREE.MeshStandardMaterial({ color: 0x101418, roughness: 0.55, metalness: 0.55 });
    // Glass: lit at night via emissive intensity tween
    const glassMat = new THREE.MeshStandardMaterial({
      color: 0xfff1a8, emissive: 0xffe07a, emissiveIntensity: 0.0,
      roughness: 0.25, metalness: 0.0, transparent: true, opacity: 0.95,
    });

    const Lamps = [];

    function buildLamp(x, z){
      const baseY = groundHeightAt(x, z);
      const grp = new THREE.Group();
      grp.position.set(x, baseY, z);

      // Concrete-ish base
      const base = new THREE.Mesh(
        new THREE.CylinderGeometry(0.36, 0.42, 0.36, 14),
        new THREE.MeshStandardMaterial({ color: 0x3a3a3a, roughness: 0.85 })
      );
      base.position.y = 0.18;
      grp.add(base);

      // Pole
      const poleH = 4.6;
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.10, 0.13, poleH, 10), poleMat);
      pole.position.y = 0.36 + poleH / 2;
      pole.castShadow = false;
      grp.add(pole);

      // Top arm
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.10, 0.10), poleMat);
      arm.position.set(0.45, 0.36 + poleH - 0.05, 0);
      grp.add(arm);

      // Lamp head shroud
      const shroud = new THREE.Mesh(
        new THREE.ConeGeometry(0.42, 0.36, 12, 1, true),
        headMat
      );
      shroud.position.set(0.85, 0.36 + poleH - 0.18, 0);
      shroud.rotation.x = Math.PI; // open downward
      grp.add(shroud);

      // Glass bulb hanging beneath the shroud — this is the one that
      // glows. We instance the material per-lamp so they can flicker
      // independently if we want to later.
      const glass = new THREE.Mesh(
        new THREE.SphereGeometry(0.30, 14, 12),
        glassMat.clone()
      );
      glass.position.set(0.85, 0.36 + poleH - 0.42, 0);
      grp.add(glass);

      // Actual scene point light. Distance keeps the perf cost local.
      const light = new THREE.PointLight(0xffe48a, 0, 18, 1.8);
      light.position.copy(glass.position);
      light.castShadow = false;
      grp.add(light);

      scene.add(grp);
      Lamps.push({ grp, glass, light });
    }

    SPOTS.forEach(s => buildLamp(s.x, s.z));

    // Per-frame tween: night = on, day = off, with smooth dusk/dawn.
    // We sample the same sunY from Sky.phase.
    function tick(){
      const angle = (Sky.phase - 0.25) * Math.PI * 2;
      const sunY  = Math.sin(angle);
      // 1 at full night, 0 at full day, smooth around dusk/dawn
      let lit;
      if(sunY > 0.20)       lit = 0;
      else if(sunY < -0.05) lit = 1;
      else                  lit = THREE.MathUtils.smoothstep(0.20 - sunY, 0, 0.25);
      // Subtle flicker for warmth
      const flicker = 1 + Math.sin(performance.now() * 0.006) * 0.04;
      for(const L of Lamps){
        L.glass.material.emissiveIntensity = lit * 1.6 * flicker;
        L.light.intensity = lit * 1.2 * flicker;
      }
      requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);

    console.log('[streetlights] ' + Lamps.length + ' lamps placed; glow tied to Sky.phase');
  }
})();
