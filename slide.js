// ============================================================================
// slide.js — "FART SLIDE" secret level  (Mario 64 Rainbow-Ride / Slide tribute)
// ----------------------------------------------------------------------------
// A fully self-contained side-module. It plugs into the existing FartWorld
// game using the same pattern as every other side file: an IIFE that polls
// for the main module's window globals, then runs init().
//
// WHAT IT DOES
//   1. Spawns a glowing GREEN FART PORTAL on the beach of the main island.
//   2. Walk into it  →  green fart-cloud suck-in + screen-shake + whoosh,
//      then we fade into the secret slide level.
//   3. The slide level is its OWN Three.js scene + renderer + canvas drawn on
//      top of the game. While it is active we set  window.fwSlideActive = true
//      so the main game loop parks itself (one tiny guard added to fartworld's
//      loop()). Nothing else in the main game is touched — fully modular.
//   4. You ride a glowing green fart-bean sled down a long spiralling wooden
//      slide built around a giant floating log, collecting Fartcoins, Skibidi
//      Orbs and Gyatt Gems, boosting with Space, until a finish line with
//      fireworks + a score multiplier and a RETURN PORTAL that drops you back
//      on the beach with a victory fart explosion + Silver & XP rewards.
//
// INTEGRATION CONTRACT (everything it reads from the host game):
//   window.THREE, window.scene, window.camera, window.Player,
//   window.groundHeightAt, window.State, window.updateHUD, window.saveState,
//   window.floater (optional), window.playFartSound (optional),
//   window.fwSkillXp (optional)
//
// It EXPOSES:
//   window.fwSlideActive   — true while the slide level is running (host loop
//                            checks this and skips its own update/render).
//   window.fwEnterSlide()  — force-enter the slide (debug / other triggers).
// ============================================================================
(function () {
  'use strict';

  function whenReady() {
    if (!window.THREE || !window.scene || !window.camera || !window.Player ||
        !window.groundHeightAt || !window.State) {
      setTimeout(whenReady, 400);
      return;
    }
    try { init(); }
    catch (e) { console.error('[slide] init failed', e); }
  }
  whenReady();

  function init() {
    const THREE = window.THREE;

    // Register the Poop Orb as a real inventory item (so addItem works and it
    // shows up in the bag). Brainrot bases spend these for a silver bonus.
    if (window.ITEMS && !window.ITEMS.poop_orb) {
      window.ITEMS.poop_orb = {
        id: 'poop_orb', name: 'Poop Orb', icon: '💩', color: '#7a4a26',
        type: 'consumable', isNFT: false, marketPrice: 0, suggestedPrice: 0,
        desc: 'Won on the Fart Slide. Use one at your brainrot base for +1% silver earnings for 10 minutes.',
      };
    }
    if (window.ITEMS && !window.ITEMS.gyatt_gem) {
      window.ITEMS.gyatt_gem = {
        id: 'gyatt_gem', name: 'Gyatt Gem', icon: '💎', color: '#ff4fd0',
        type: 'collectible', isNFT: false, marketPrice: 120, suggestedPrice: 90,
        desc: 'A rare gem collected on the Fart Slide.',
      };
    }

    // ========================================================================
    //  TUNING — all the knobs that make it feel good live here.
    // ========================================================================
    const CFG = {
      // physics
      gravity: 62,          // how hard slopes accelerate you
      friction: 0.62,       // gentle drag (per second, velocity fraction)
      boostAccel: 48,       // extra forward push while holding Space
      maxSpeed: 78,         // hard cap on along-track speed
      minSpeed: 6,          // you never fully stop on a downhill
      steerRate: 2.7,       // how fast lateral position responds to A/D
      steerReturn: 0.9,     // auto-centering when not steering (lower = harder)
      trackHalfWidth: 4.2,  // playable half-width of the slide
      fallLimit: 1.0,       // |lat| beyond this (fraction of half-width) = fall
      turnForce: 2.6,       // centrifugal strength on bends (higher = harder)
      // rewards
      silverReward: 220,    // base silver for finishing
      // scoring
      distanceScore: 1.6,   // points per metre travelled
    };

    // ========================================================================
    //  PART 1 — THE BEACH PORTAL  (lives in the host scene)
    // ========================================================================
    const scene = window.scene;
    const Player = window.Player;
    const gH = window.groundHeightAt;
    const ISLAND_R = (typeof window.ISLAND_RADIUS === 'number') ? window.ISLAND_RADIUS : 90;
    const WATER = (typeof window.WATER_LEVEL === 'number') ? window.WATER_LEVEL : 0;

    // Find a nice flat-ish shoreline spot on the beach to plant the portal.
    function findBeachSpot() {
      // Scan the south-east shoreline for land just above the water. We keep
      // away from the dock (which sits due-east at angle 0) so the portal and
      // Wave's dock prompt don't fight over the E key.
      let best = null;
      for (let ang = 0.5; ang < 1.45; ang += 0.08) {
        for (let r = ISLAND_R - 4; r > ISLAND_R - 22; r -= 1.5) {
          const x = Math.cos(ang) * r, z = Math.sin(ang) * r;
          const y = gH(x, z);
          if (y > WATER + 0.3 && y < WATER + 2.2) {
            // closest to the waterline wins → genuinely "on the beach"
            const score = Math.abs(y - (WATER + 0.8));
            if (!best || score < best.score) best = { x, z, y, score };
            break;
          }
        }
      }
      return best || { x: ISLAND_R - 14, z: 14, y: gH(ISLAND_R - 14, 14) };
    }

    const beach = findBeachSpot();
    const PORTAL_POS = new THREE.Vector3(beach.x, beach.y, beach.z);

    // ---- Build the portal mesh (a glowing green ring + swirling membrane) ----
    const portal = new THREE.Group();
    portal.position.copy(PORTAL_POS);

    const GREEN = 0x6cff3a, GREEN_DK = 0x2fbf12;

    // Stone-ish base so it reads as a "gate" on the sand.
    const baseMat = new THREE.MeshStandardMaterial({ color: 0x3a4a2a, roughness: 1 });
    const base = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 3, 0.6, 16), baseMat);
    base.position.y = 0.3; portal.add(base);

    // The glowing torus ring.
    const ringMat = new THREE.MeshStandardMaterial({
      color: GREEN, emissive: GREEN, emissiveIntensity: 1.6, roughness: 0.4,
    });
    const ring = new THREE.Mesh(new THREE.TorusGeometry(2.6, 0.34, 16, 40), ringMat);
    ring.position.y = 3.2; portal.add(ring);

    // Inner swirling membrane (additive, double-sided disc).
    const memMat = new THREE.MeshBasicMaterial({
      color: GREEN, transparent: true, opacity: 0.55,
      side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false,
    });
    const membrane = new THREE.Mesh(new THREE.CircleGeometry(2.5, 32), memMat);
    membrane.position.y = 3.2; portal.add(membrane);

    // A second, darker swirl for depth.
    const mem2 = new THREE.Mesh(new THREE.CircleGeometry(2.2, 32),
      new THREE.MeshBasicMaterial({ color: GREEN_DK, transparent: true, opacity: 0.5,
        side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false }));
    mem2.position.y = 3.2; mem2.position.z = 0.02; portal.add(mem2);

    // Floating fart-spark particles around the ring.
    const sparkN = 60;
    const sparkGeo = new THREE.BufferGeometry();
    const sparkPos = new Float32Array(sparkN * 3);
    for (let i = 0; i < sparkN; i++) {
      const a = Math.random() * Math.PI * 2, rr = 2.2 + Math.random() * 0.9;
      sparkPos[i * 3] = Math.cos(a) * rr;
      sparkPos[i * 3 + 1] = 3.2 + (Math.random() - 0.5) * 4;
      sparkPos[i * 3 + 2] = Math.sin(a) * rr;
    }
    sparkGeo.setAttribute('position', new THREE.BufferAttribute(sparkPos, 3));
    const sparks = new THREE.Points(sparkGeo, new THREE.PointsMaterial({
      color: GREEN, size: 0.28, transparent: true, opacity: 0.9,
      blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    sparks.position.y = 0; portal.add(sparks);

    // Floating label.
    const label = makeSprite('💨 FART SLIDE 💨', '#aaff66');
    label.position.set(0, 6.4, 0); label.scale.set(6, 1.5, 1); portal.add(label);

    scene.add(portal);
    portal.rotation.y = Math.atan2(-PORTAL_POS.x, -PORTAL_POS.z); // face inland

    // "Press E" prompt shown when you stand near the portal.
    const ENTER_RANGE = 6;
    const prompt = document.createElement('div');
    prompt.id = 'fwSlidePrompt';
    prompt.innerHTML = 'Press <b>E</b> to ride the 🛝 <b>FART SLIDE</b> 💨';
    prompt.style.cssText =
      'position:fixed;left:50%;bottom:16%;transform:translateX(-50%);z-index:99970;' +
      'pointer-events:none;display:none;font-family:system-ui,sans-serif;font-weight:700;' +
      'font-size:20px;color:#eaffd6;background:rgba(20,60,15,.7);border:2px solid #6cff3a;' +
      'border-radius:14px;padding:10px 18px;text-shadow:0 2px 6px #000;box-shadow:0 0 24px rgba(108,255,58,.5);';
    document.body.appendChild(prompt);

    function nearPortal() {
      return Math.hypot(Player.pos.x - PORTAL_POS.x, Player.pos.z - PORTAL_POS.z) < ENTER_RANGE;
    }

    // Hook into the game's E-key interaction system (registered below).
    // Returns true when it handles the press so tryInteract() stops there.
    window.fwSlideInteract = function () {
      if (window.fwSlideActive || entering) return false;
      if (!nearPortal()) return false;
      beginEnter();
      return true;
    };

    // ---- Portal idle animation + proximity check (own light rAF) -----------
    let portalT = 0, lastP = performance.now(), entering = false;
    function portalTick() {
      const now = performance.now();
      const dt = Math.min(0.05, (now - lastP) / 1000); lastP = now;
      portalT += dt;
      if (!window.fwSlideActive && !entering) {
        ring.rotation.z = portalT * 0.6;
        membrane.rotation.z = -portalT * 1.1;
        mem2.rotation.z = portalT * 1.7;
        membrane.material.opacity = 0.45 + Math.sin(portalT * 3) * 0.12;
        sparks.rotation.y = portalT * 0.5;
        ring.material.emissiveIntensity = 1.4 + Math.sin(portalT * 4) * 0.4;
        // swirl the spark cloud upward
        const p = sparkGeo.attributes.position.array;
        for (let i = 0; i < sparkN; i++) {
          p[i * 3 + 1] += dt * 0.6;
          if (p[i * 3 + 1] > 6) p[i * 3 + 1] = 0.5;
        }
        sparkGeo.attributes.position.needsUpdate = true;

        // show / hide the "Press E" prompt based on proximity
        prompt.style.display = nearPortal() ? 'block' : 'none';
      } else {
        prompt.style.display = 'none';
      }
      requestAnimationFrame(portalTick);
    }
    requestAnimationFrame(portalTick);

    // ========================================================================
    //  PART 2 — TRANSITION  (green cloud + shake + whoosh + fade)
    // ========================================================================
    function beginEnter() {
      if (entering || window.fwSlideActive) return;
      entering = true;

      // snapshot current state (base/plot/hotel rentals etc.) before we hand
      // the screen over to the slide, so nothing is lost while we're away.
      try { window.saveState && window.saveState(); } catch (_) {}

      // whoosh / big fart
      try { window.playFartSound && window.playFartSound(1, false); } catch (_) {}
      whoosh();

      // green cloud overlay that swallows the screen
      const cloud = document.createElement('div');
      cloud.style.cssText =
        'position:fixed;inset:0;z-index:99990;pointer-events:none;opacity:0;' +
        'background:radial-gradient(circle at 50% 60%, rgba(140,255,90,.0) 0%, rgba(70,200,40,.9) 45%, rgba(20,120,10,1) 100%);' +
        'transition:opacity .55s ease-in;';
      document.body.appendChild(cloud);

      // screen shake on the game canvas
      shakeScreen(650);

      requestAnimationFrame(() => { cloud.style.opacity = '1'; });

      setTimeout(() => {
        startSlide();                 // builds + shows the slide level
        setTimeout(() => {            // fade the green cloud back out into the slide
          cloud.style.transition = 'opacity .6s ease-out';
          cloud.style.opacity = '0';
          setTimeout(() => cloud.remove(), 650);
          entering = false;
        }, 120);
      }, 600);
    }

    function shakeScreen(ms) {
      const cv = window.renderer && window.renderer.domElement;
      if (!cv) return;
      const start = performance.now();
      (function s() {
        const k = (performance.now() - start) / ms;
        if (k >= 1) { cv.style.transform = ''; return; }
        const m = (1 - k) * 14;
        cv.style.transform = `translate(${(Math.random() - 0.5) * m}px,${(Math.random() - 0.5) * m}px)`;
        requestAnimationFrame(s);
      })();
    }

    // ========================================================================
    //  PART 3 — THE SLIDE LEVEL
    //    Built lazily the first time you enter, then reused on subsequent runs.
    // ========================================================================
    let SL = null;  // holds the whole slide world once built

    function buildSlideWorld() {
      const world = {};

      // ---- renderer + canvas (drawn on top of the game) --------------------
      const canvas = document.createElement('canvas');
      canvas.id = 'fwSlideCanvas';
      canvas.style.cssText =
        'position:fixed;inset:0;width:100vw;height:100vh;z-index:99980;display:none;';
      document.body.appendChild(canvas);

      const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
      renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
      renderer.setSize(window.innerWidth, window.innerHeight);
      renderer.setClearColor(0x120a2e, 1);
      world.renderer = renderer;
      world.canvas = canvas;

      // ---- scene + dreamy sky void ----------------------------------------
      const s = new THREE.Scene();
      s.fog = new THREE.FogExp2(0x3a2a66, 0.0017);
      world.scene = s;

      // gradient sky dome (2D canvas texture → big inverted sphere)
      s.add(makeSkyDome(THREE));

      // ---- lighting: dramatic, glowing green accents -----------------------
      s.add(new THREE.AmbientLight(0x8888cc, 0.85));
      const sun = new THREE.DirectionalLight(0xfff0c0, 1.4);
      sun.position.set(80, 160, 40); s.add(sun);
      const rim = new THREE.DirectionalLight(GREEN, 0.6);
      rim.position.set(-60, 40, -80); s.add(rim);

      // ---- camera ----------------------------------------------------------
      const cam = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 4000);
      world.camera = cam;

      // ---- the SPLINE TRACK ------------------------------------------------
      // A TALL, LONG spiral descending around a giant central log. Twice the
      // length of the first build, with lots of variation: breathing radius
      // (sharp + gentle turns layered), steep plunges, rising kicks, and a
      // couple of wide sweeping straights. Tuned to be genuinely hard.
      const ctrl = [];
      // Fewer, WIDER turns so the slide sweeps out across the void instead of
      // hugging the log in tight little circles. Radius stays well clear of the
      // central log (radius ~20) and grows outward as you descend.
      const TURNS = 6.0, STEPS = 168, TOP_Y = 360, CX = 0, CZ = 0;
      let ang = 0;
      for (let i = 0; i <= STEPS; i++) {
        const f = i / STEPS;
        ang += (Math.PI * 2 * TURNS) / STEPS;
        // big base radius + outward growth + gentle breathing for variety
        let r = 70 + f * 55                              // sweeps outward as you go
              + 16 * Math.sin(f * Math.PI * 3.0)         // long lazy in/out
              + 10 * Math.sin(f * Math.PI * 6.5);        // smaller wiggle
        r = Math.max(40, r);                             // never closer than the log
        // vertical: eased descent + several bumps/plunges at varied phases
        let y = TOP_Y * Math.pow(1 - f, 1.25);
        y += 14 * Math.max(0, Math.sin((f - 0.18) * Math.PI * 9)) * (f > 0.12 && f < 0.30 ? 1 : 0);
        y += 20 * Math.max(0, Math.sin((f - 0.40) * Math.PI * 7)) * (f > 0.34 && f < 0.50 ? 1 : 0);
        y += 12 * Math.max(0, Math.sin((f - 0.66) * Math.PI * 9)) * (f > 0.60 && f < 0.74 ? 1 : 0);
        y -= 10 * Math.max(0, Math.sin((f - 0.55) * Math.PI * 8)) * (f > 0.52 && f < 0.62 ? 1 : 0); // a dip
        ctrl.push(new THREE.Vector3(CX + Math.cos(ang) * r, y, CZ + Math.sin(ang) * r));
      }
      // long, smooth run-out to the finish line, away from the log
      const last = ctrl[ctrl.length - 1].clone();
      for (let k = 1; k <= 9; k++) {
        ctrl.push(new THREE.Vector3(last.x + k * 16, Math.max(2, last.y - k * 2.0), last.z + k * 7));
      }

      const curve = new THREE.CatmullRomCurve3(ctrl, false, 'catmullrom', 0.5);
      world.curve = curve;
      world.curveLen = curve.getLength();

      // Precompute oriented frames (Frenet) so steering/banking is smooth.
      const FRAMES = 1400;
      world.frames = curve.computeFrenetFrames(FRAMES, false);
      world.frameN = FRAMES;

      // ---- the giant floating log (Fart Fart Baldur tree) ------------------
      const logMat = new THREE.MeshStandardMaterial({ color: 0x6b4a2a, roughness: 1 });
      const log = new THREE.Mesh(new THREE.CylinderGeometry(14, 20, TOP_Y + 30, 18, 1), logMat);
      log.position.set(CX, TOP_Y / 2, CZ); s.add(log);
      // glowing green veins up the log
      for (let v = 0; v < 7; v++) {
        const vein = new THREE.Mesh(
          new THREE.CylinderGeometry(0.5, 0.5, TOP_Y + 20, 6),
          new THREE.MeshBasicMaterial({ color: GREEN }));
        const va = (v / 7) * Math.PI * 2;
        vein.position.set(CX + Math.cos(va) * 15, TOP_Y / 2, CZ + Math.sin(va) * 15);
        vein.rotation.z = (Math.random() - 0.5) * 0.15;
        s.add(vein);
      }
      // gnarled root ball at the bottom
      const root = new THREE.Mesh(new THREE.DodecahedronGeometry(26, 0), logMat);
      root.position.set(CX, -6, CZ); s.add(root);
      // leafy crown on top
      for (let c = 0; c < 14; c++) {
        const leaf = new THREE.Mesh(new THREE.IcosahedronGeometry(7 + Math.random() * 5, 0),
          new THREE.MeshStandardMaterial({ color: 0x4caf50, flatShading: true, roughness: 1 }));
        const la = Math.random() * Math.PI * 2, lr = Math.random() * 16;
        leaf.position.set(CX + Math.cos(la) * lr, TOP_Y + 14 + Math.random() * 18, CZ + Math.sin(la) * lr);
        s.add(leaf);
      }

      // ---- JUMPS: gaps in the track with a boost ramp + landing pad --------
      // Defined BEFORE the ribbon so the ribbon can leave a real hole.
      buildJumps(world, THREE, GREEN);

      // ---- THE SLIDE RIBBON (custom spline geometry) -----------------------
      buildSlideRibbon(world, THREE, GREEN);

      // ---- decor: floating islands, brainrot clouds, Baldur statues, rays --
      decorateVoid(world, THREE, TOP_Y, GREEN);
      addGodRays(world, THREE);

      // ---- the SLED: a big glowing green fart-bean -------------------------
      world.sled = buildSled(THREE, GREEN);
      s.add(world.sled);

      // ---- collectibles + obstacles + checkpoints + finish -----------------
      buildCollectibles(world, THREE, GREEN);
      buildObstacles(world, THREE);
      buildCheckpoints(world, THREE);
      buildFinish(world, THREE, GREEN);

      // ---- particle pools (trail / sparkle / stars) ------------------------
      // Trail = small, faint green fart puffs (kept subtle so they never
      // block the view of the printer / track).
      world.trail = makeParticlePool(THREE, s, 160, 0x8fd14a, 1.3, THREE.NormalBlending);
      world.trail.pts.material.opacity = 0.28;
      world.stars = makeParticlePool(THREE, s, 120, 0xffffff, 0.6, THREE.AdditiveBlending);

      // resize handling
      world.onResize = () => {
        renderer.setSize(window.innerWidth, window.innerHeight);
        cam.aspect = window.innerWidth / window.innerHeight;
        cam.updateProjectionMatrix();
      };

      return world;
    }

    // ========================================================================
    //  SLIDE RIBBON — a flat banked road following the spline + glowing rails
    // ========================================================================
    function buildSlideRibbon(world, THREE, GREEN) {
      const curve = world.curve, N = 940, HW = CFG.trackHalfWidth;
      const jumps = world.jumps || [];
      const inGap = (u) => jumps.some(j => u > j.g0 && u < j.g1);
      const pos = [], norm = [], uv = [], idx = [];
      const railL = [], railR = [];
      for (let i = 0; i <= N; i++) {
        const u = i / N;
        const p = curve.getPointAt(u);
        const t = curve.getTangentAt(u).normalize();
        // right vector = tangent × up, kept horizontal-ish for a rideable road
        const up = new THREE.Vector3(0, 1, 0);
        const right = new THREE.Vector3().crossVectors(t, up).normalize();
        const rn = new THREE.Vector3().crossVectors(right, t).normalize(); // surface normal
        const L = p.clone().addScaledVector(right, -HW);
        const R = p.clone().addScaledVector(right, HW);
        pos.push(L.x, L.y, L.z, R.x, R.y, R.z);
        norm.push(rn.x, rn.y, rn.z, rn.x, rn.y, rn.z);
        uv.push(0, u * 40, 1, u * 40);
        railL.push(L.clone().addScaledVector(rn, 0.6));
        railR.push(R.clone().addScaledVector(rn, 0.6));
        // leave a real hole in the deck across jump gaps
        if (i < N && !inGap((i + 0.5) / N)) {
          const a = i * 2, b = a + 1, c = a + 2, d = a + 3;
          idx.push(a, b, d, a, d, c);
        }
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      geo.setAttribute('normal', new THREE.Float32BufferAttribute(norm, 3));
      geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
      geo.setIndex(idx);
      const deck = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({
        color: 0xb5793f, roughness: 0.85, side: THREE.DoubleSide, flatShading: false,
      }));
      world.scene.add(deck);

      // glowing green vein stripe down the centre + edge rails
      world.scene.add(makeTubeLine(THREE, curve, 0.28, GREEN, 600, 0));
      world.scene.add(railTube(THREE, railL, 0.22, GREEN));
      world.scene.add(railTube(THREE, railR, 0.22, GREEN));

      // wooden support posts dropping toward the log every so often
      const postMat = new THREE.MeshStandardMaterial({ color: 0x5a3c20, roughness: 1 });
      for (let i = 6; i < N; i += 18) {
        const u = i / N, p = curve.getPointAt(u);
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.7, 14, 7), postMat);
        post.position.set(p.x, p.y - 7, p.z);
        world.scene.add(post);
      }
    }

    function railTube(THREE, pts, r, color) {
      const c = new THREE.CatmullRomCurve3(pts);
      const g = new THREE.TubeGeometry(c, pts.length, r, 6, false);
      return new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color }));
    }
    function makeTubeLine(THREE, curve, r, color, seg) {
      const g = new THREE.TubeGeometry(curve, seg, r, 6, false);
      const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color }));
      m.position.y = 0.05;
      return m;
    }

    // ========================================================================
    //  JUMPS — the deck ends at a ramp tip; you launch with a boost, sail an
    //  arc, and use A/D to aim onto where the road resumes. Miss = you fall.
    // ========================================================================
    function buildJumps(world, THREE, GREEN) {
      const curve = world.curve;
      const HW = CFG.trackHalfWidth;
      // a few jumps spread along the middle of the track (not too near ends)
      const spots = [0.30, 0.52, 0.74];
      const GAP = 0.018;                       // u-width of the gap
      world.jumps = [];
      for (const g0 of spots) {
        const g1 = g0 + GAP;
        const drift = (Math.random() < 0.5 ? -1 : 1) * (0.25 + Math.random() * 0.25);
        world.jumps.push({ g0, g1, drift, used: false });

        // launch ramp (kicker) just before the gap, tilted up
        const pL = curve.getPointAt(g0);
        const tL = curve.getTangentAt(g0).normalize();
        const rightL = new THREE.Vector3().crossVectors(tL, new THREE.Vector3(0, 1, 0)).normalize();
        const ramp = new THREE.Mesh(new THREE.BoxGeometry(HW * 2 + 1, 0.5, 6),
          new THREE.MeshStandardMaterial({ color: 0x9cff5a, emissive: 0x3a8f10, emissiveIntensity: 0.7, roughness: 0.5 }));
        ramp.position.copy(pL).add(new THREE.Vector3(0, 0.9, 0)).addScaledVector(tL, -2);
        const m1 = new THREE.Matrix4(); m1.lookAt(pL, pL.clone().add(tL), new THREE.Vector3(0, 1, 0));
        ramp.quaternion.setFromRotationMatrix(m1);
        ramp.rotateX(-0.32);                   // kick upward
        world.scene.add(ramp);

        // glowing landing pad ring at the resume point
        const pR = curve.getPointAt(g1);
        const tR = curve.getTangentAt(g1).normalize();
        const pad = new THREE.Mesh(new THREE.TorusGeometry(HW + 0.4, 0.35, 8, 24),
          new THREE.MeshBasicMaterial({ color: 0x9affff, transparent: true, opacity: 0.8 }));
        pad.position.copy(pR).add(new THREE.Vector3(0, HW * 0.6, 0));
        pad.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), tR);
        world.scene.add(pad);
      }
    }

    // ========================================================================
    //  VOID DECOR — floating islands, brainrot clouds, distant Baldur statues
    // ========================================================================
    function decorateVoid(world, THREE, TOP_Y, GREEN) {
      const s = world.scene;
      // floating low-poly islands
      for (let i = 0; i < 22; i++) {
        const isl = new THREE.Group();
        const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(6 + Math.random() * 8, 0),
          new THREE.MeshStandardMaterial({ color: 0x7a5a3a, flatShading: true, roughness: 1 }));
        rock.scale.y = 0.6 + Math.random() * 0.5; isl.add(rock);
        const grass = new THREE.Mesh(new THREE.SphereGeometry(6 + Math.random() * 6, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2),
          new THREE.MeshStandardMaterial({ color: 0x57c84a, flatShading: true, roughness: 1 }));
        grass.position.y = 1.5; isl.add(grass);
        const a = Math.random() * Math.PI * 2, rr = 120 + Math.random() * 260;
        isl.position.set(Math.cos(a) * rr, 10 + Math.random() * TOP_Y, Math.sin(a) * rr);
        isl.userData.spin = (Math.random() - 0.5) * 0.1;
        isl.userData.bob = Math.random() * 6.28;
        s.add(isl);
        (world.islands = world.islands || []).push(isl);
      }
      // brainrot clouds (puffy additive blobs, vaguely pink/green)
      for (let i = 0; i < 26; i++) {
        const cl = new THREE.Group();
        const col = Math.random() < 0.5 ? 0xff9ad5 : 0xb6ff8a;
        for (let p = 0; p < 5; p++) {
          const puff = new THREE.Mesh(new THREE.SphereGeometry(4 + Math.random() * 4, 8, 6),
            new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.5 }));
          puff.position.set((Math.random() - 0.5) * 10, (Math.random() - 0.5) * 4, (Math.random() - 0.5) * 10);
          cl.add(puff);
        }
        const a = Math.random() * Math.PI * 2, rr = 90 + Math.random() * 320;
        cl.position.set(Math.cos(a) * rr, 20 + Math.random() * TOP_Y, Math.sin(a) * rr);
        cl.userData.drift = (Math.random() - 0.5) * 2;
        s.add(cl);
        (world.clouds = world.clouds || []).push(cl);
      }
      // distant Fart Fart Baldur statues on big far islands
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2 + 0.3, rr = 480 + Math.random() * 220;
        const base = new THREE.Vector3(Math.cos(a) * rr, -40 + Math.random() * 120, Math.sin(a) * rr);
        s.add(buildBaldurStatue(THREE, base, GREEN));
      }
    }

    function buildBaldurStatue(THREE, at, GREEN) {
      const g = new THREE.Group();
      const stone = new THREE.MeshStandardMaterial({ color: 0x8a8f9a, flatShading: true, roughness: 1 });
      const island = new THREE.Mesh(new THREE.DodecahedronGeometry(40, 0), stone);
      island.scale.y = 0.5; g.add(island);
      // body
      const body = new THREE.Mesh(new THREE.CylinderGeometry(14, 18, 50, 8), stone);
      body.position.y = 40; g.add(body);
      // head
      const head = new THREE.Mesh(new THREE.SphereGeometry(12, 10, 8), stone);
      head.position.y = 74; g.add(head);
      // glowing green eyes
      for (const sx of [-1, 1]) {
        const eye = new THREE.Mesh(new THREE.SphereGeometry(2.2, 8, 8),
          new THREE.MeshBasicMaterial({ color: GREEN }));
        eye.position.set(sx * 4, 76, 11); g.add(eye);
      }
      // raised arm
      const arm = new THREE.Mesh(new THREE.CylinderGeometry(4, 4, 34, 7), stone);
      arm.position.set(16, 60, 0); arm.rotation.z = -0.9; g.add(arm);
      g.position.copy(at);
      g.scale.setScalar(1.4);
      return g;
    }

    function addGodRays(world, THREE) {
      // big additive cones beaming down from the sky
      for (let i = 0; i < 4; i++) {
        const ray = new THREE.Mesh(
          new THREE.ConeGeometry(40, 280, 16, 1, true),
          new THREE.MeshBasicMaterial({
            color: 0xffe9a8, transparent: true, opacity: 0.07,
            side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false,
          }));
        const a = Math.random() * Math.PI * 2, rr = 60 + Math.random() * 160;
        ray.position.set(Math.cos(a) * rr, 180, Math.sin(a) * rr);
        ray.rotation.x = Math.PI; // point down
        world.scene.add(ray);
      }
    }

    // ========================================================================
    //  THE SLED — our PRINTER character riding a glowing fart-board
    // ========================================================================
    function buildSled(THREE, GREEN) {
      const g = new THREE.Group();
      // a glowing green fart-board under the printer's feet
      const board = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.3, 3.4),
        new THREE.MeshStandardMaterial({ color: 0x57e021, emissive: 0x2a8f10, emissiveIntensity: 0.7, roughness: 0.4 }));
      board.position.y = 0.25; g.add(board);
      // upturned nose on the board
      const nose = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.3, 0.8),
        new THREE.MeshStandardMaterial({ color: 0x57e021, emissive: 0x2a8f10, emissiveIntensity: 0.7 }));
      nose.position.set(0, 0.45, 1.8); nose.rotation.x = -0.5; g.add(nose);

      // THE PRINTER — built from the exact same model as the player character.
      let printerMesh;
      try { printerMesh = window.buildPrinter ? window.buildPrinter() : null; } catch (_) { printerMesh = null; }
      if (printerMesh) {
        printerMesh.position.set(0, 0.4, -0.2);
        printerMesh.rotation.y = Math.PI;          // face forward (down the slide)
        printerMesh.scale.setScalar(0.85);
        g.add(printerMesh);
      } else {
        // fallback simple printer if the host builder isn't exposed
        const body = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.0, 1.2),
          new THREE.MeshStandardMaterial({ color: 0xf3f3ee, roughness: 0.55 }));
        body.position.y = 1.2; g.add(body);
      }
      g.userData.printer = printerMesh;
      return g;
    }

    // ========================================================================
    //  COLLECTIBLES — Poop Orbs (→ inventory on finish) + rare Gyatt Gems
    // ========================================================================
    const COLLECT = {
      orb: { name: 'Poop Orb', color: 0x9c6b3f, score: 120, emoji: '💩', poop: true },
      gem: { name: 'Gyatt Gem', color: 0xff4fd0, score: 300, emoji: '💎', poop: false },
    };
    function buildCollectibles(world, THREE, GREEN) {
      world.collectibles = [];
      const curve = world.curve, N = 130;      // ~twice as many (track doubled)
      const jumps = world.jumps || [];
      const inGap = (u) => jumps.some(j => u > j.g0 - 0.01 && u < j.g1 + 0.01);
      for (let i = 2; i < N - 2; i++) {
        const u = i / N;
        if (inGap(u)) continue;               // don't float collectibles over the void
        const kind = Math.random() < 0.82 ? 'orb' : 'gem';   // mostly Poop Orbs
        const def = COLLECT[kind];
        const p = curve.getPointAt(u);
        const t = curve.getTangentAt(u).normalize();
        const right = new THREE.Vector3().crossVectors(t, new THREE.Vector3(0, 1, 0)).normalize();
        const lat = (Math.random() - 0.5) * 1.5;
        let mesh;
        if (kind === 'orb') {
          // a little brown poop swirl: stacked shrinking spheres + a glow
          mesh = new THREE.Group();
          const m = new THREE.MeshStandardMaterial({ color: 0x7a4a26, emissive: 0x3a1f10, emissiveIntensity: 0.5, roughness: 0.7 });
          const s0 = new THREE.Mesh(new THREE.SphereGeometry(0.6, 12, 10), m); s0.scale.y = 0.7; s0.position.y = 0; mesh.add(s0);
          const s1 = new THREE.Mesh(new THREE.SphereGeometry(0.42, 12, 10), m); s1.scale.y = 0.7; s1.position.y = 0.5; mesh.add(s1);
          const s2 = new THREE.Mesh(new THREE.SphereGeometry(0.26, 12, 10), m); s2.scale.y = 0.8; s2.position.y = 0.85; mesh.add(s2);
          const halo = new THREE.Mesh(new THREE.SphereGeometry(0.85, 12, 10),
            new THREE.MeshBasicMaterial({ color: 0xbf8a4a, transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false }));
          mesh.add(halo);
        } else {
          mesh = new THREE.Mesh(new THREE.OctahedronGeometry(0.8, 0),
            new THREE.MeshStandardMaterial({ color: def.color, emissive: def.color, emissiveIntensity: 0.7, roughness: 0.3 }));
        }
        // sit them low to the deck so they're always reachable (no jumping needed)
        mesh.position.copy(p).addScaledVector(right, lat * CFG.trackHalfWidth).add(new THREE.Vector3(0, 1.0, 0));
        world.scene.add(mesh);
        world.collectibles.push({ mesh, u, lat, kind, score: def.score, name: def.name, poop: def.poop, taken: false, baseY: mesh.position.y });
      }
    }

    // ========================================================================
    //  OBSTACLES — hit one and you wipe out (it's a fall). Placed across the
    //  track at varied lateral offsets so you must weave around them.
    // ========================================================================
    function buildObstacles(world, THREE) {
      world.obstacles = [];
      const curve = world.curve, N = 46;
      for (let i = 3; i < N - 2; i++) {
        if (Math.random() < 0.42) continue;          // not on every slot
        const u = (i + 0.5) / N;
        const p = curve.getPointAt(u);
        const t = curve.getTangentAt(u).normalize();
        const right = new THREE.Vector3().crossVectors(t, new THREE.Vector3(0, 1, 0)).normalize();
        const lat = (Math.random() - 0.5) * 1.5;
        // a spinning spiky green fart-barrel
        const obs = new THREE.Group();
        const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 1.6, 10),
          new THREE.MeshStandardMaterial({ color: 0x2c6b1a, emissive: 0x1a3a0e, emissiveIntensity: 0.6, roughness: 0.6 }));
        obs.add(barrel);
        for (let k = 0; k < 8; k++) {
          const spike = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.5, 6),
            new THREE.MeshStandardMaterial({ color: 0x9cff5a, emissive: 0x4caf1a, emissiveIntensity: 0.5 }));
          const a = (k / 8) * Math.PI * 2;
          spike.position.set(Math.cos(a) * 0.8, 0, Math.sin(a) * 0.8);
          spike.rotation.z = -Math.PI / 2; spike.rotation.y = -a;
          obs.add(spike);
        }
        obs.position.copy(p).addScaledVector(right, lat * CFG.trackHalfWidth).add(new THREE.Vector3(0, 1.0, 0));
        world.scene.add(obs);
        world.obstacles.push({ mesh: obs, u, lat });
      }
    }

    // ========================================================================
    //  CHECKPOINTS — passing one updates your respawn point
    // ========================================================================
    function buildCheckpoints(world, THREE) {
      world.checkpoints = [];
      const curve = world.curve, n = 6;
      for (let i = 1; i <= n; i++) {
        const u = i / (n + 1);
        const p = curve.getPointAt(u);
        const t = curve.getTangentAt(u).normalize();
        const right = new THREE.Vector3().crossVectors(t, new THREE.Vector3(0, 1, 0)).normalize();
        // a glowing gate-ring you fly through
        const ringMat = new THREE.MeshBasicMaterial({ color: 0x9affff, transparent: true, opacity: 0.7 });
        const ring = new THREE.Mesh(new THREE.TorusGeometry(CFG.trackHalfWidth + 0.6, 0.25, 8, 24), ringMat);
        ring.position.copy(p).add(new THREE.Vector3(0, CFG.trackHalfWidth, 0));
        ring.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), t);
        world.scene.add(ring);
        world.checkpoints.push({ u, ring, passed: false });
      }
    }

    // ========================================================================
    //  FINISH LINE
    // ========================================================================
    function buildFinish(world, THREE, GREEN) {
      const curve = world.curve;
      const p = curve.getPointAt(1);
      const t = curve.getTangentAt(1).normalize();
      world.finishPoint = p.clone();

      // checkered arch
      const arch = new THREE.Group();
      const postMat = new THREE.MeshStandardMaterial({ color: 0xffffff });
      for (const sx of [-1, 1]) {
        const right = new THREE.Vector3().crossVectors(t, new THREE.Vector3(0, 1, 0)).normalize();
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.6, 10, 0.6), postMat);
        post.position.copy(p).addScaledVector(right, sx * (CFG.trackHalfWidth + 1)).add(new THREE.Vector3(0, 5, 0));
        arch.add(post);
      }
      world.scene.add(arch);

      // RETURN PORTAL just past the finish
      const back = new THREE.Group();
      const ring = new THREE.Mesh(new THREE.TorusGeometry(3, 0.4, 16, 36),
        new THREE.MeshStandardMaterial({ color: GREEN, emissive: GREEN, emissiveIntensity: 1.6 }));
      ring.position.y = 3.5; back.add(ring);
      const mem = new THREE.Mesh(new THREE.CircleGeometry(2.8, 32),
        new THREE.MeshBasicMaterial({ color: GREEN, transparent: true, opacity: 0.6, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false }));
      mem.position.y = 3.5; back.add(mem);
      back.position.copy(p).addScaledVector(t, 16);
      back.lookAt(p.x, back.position.y, p.z);
      world.scene.add(back);
      world.returnPortal = back;
      world.returnRing = ring; world.returnMem = mem;
    }

    // ========================================================================
    //  SLIDE STATE + RUN CONTROL
    // ========================================================================
    const RUN = {
      u: 0, v: 14, lat: 0, score: 0, mult: 1, time: 0,
      lastCp: 0, running: false, finished: false, boosting: false,
      spawnGrace: 0, poopSession: 0, gemSession: 0,
      // falling state (a short drop before "YOU GOT FARDED")
      falling: false, fallT: 0, fallVel: new THREE.Vector3(),
      // jump / airborne state
      airborne: false, airT: 0, airDur: 1, airArc: 8, airAimLat: 0, airDrift: 0,
      airLaunch: new THREE.Vector3(), airLand: new THREE.Vector3(),
      airRight: new THREE.Vector3(), airDir: new THREE.Vector3(), airLandU: 0, airSpeed: 20,
      camPos: new THREE.Vector3(), camTilt: 0,
    };
    const sKeys = {};

    function startSlide() {
      if (!SL) SL = buildSlideWorld();
      window.fwSlideActive = true;

      // reset run
      RUN.u = 0; RUN.v = 16; RUN.lat = 0; RUN.score = 0; RUN.mult = 1;
      RUN.time = 0; RUN.lastCp = 0; RUN.running = true; RUN.finished = false;
      RUN.spawnGrace = 0.8; RUN.poopSession = 0; RUN.gemSession = 0;
      RUN.airborne = false; RUN.falling = false;
      SL.collectibles.forEach(c => { c.taken = false; c.mesh.visible = true; });
      SL.checkpoints.forEach(c => { c.passed = false; c.ring.material.color.setHex(0x9affff); });
      (SL.jumps || []).forEach(j => { j.used = false; });

      // show canvas + HUD
      SL.canvas.style.display = 'block';
      SL.onResize();
      buildSlideHud();
      window.addEventListener('resize', SL.onResize);
      window.addEventListener('keydown', onKeyDown, true);
      window.addEventListener('keyup', onKeyUp, true);
      showFx();

      slideLast = performance.now();
      requestAnimationFrame(slideLoop);
      toast('🏄 RIDE THE FART SLIDE! Steer A/D · hold SPACE to boost', '#aaff66', 2600);
    }

    function exitSlide(victory) {
      RUN.running = false;
      window.fwSlideActive = false;
      window.removeEventListener('resize', SL.onResize);
      window.removeEventListener('keydown', onKeyDown, true);
      window.removeEventListener('keyup', onKeyUp, true);
      SL.canvas.style.display = 'none';
      hideFx();
      if (SL.hud) SL.hud.style.display = 'none';

      // reset transient run state so a re-entry is clean
      RUN.falling = false; RUN.airborne = false; RUN.finished = false;

      // pop the player back onto the beach next to the entry portal
      Player.pos.set(PORTAL_POS.x - 4, PORTAL_POS.y, PORTAL_POS.z - 4);
      Player.vel && Player.vel.set(0, 0, 0);

      if (!victory) {
        try { window.floater && window.floater('🛝 Left the Fart Slide — no orbs earned', 'bad'); } catch (_) {}
      }
      if (victory) {
        // victory fart explosion on the beach + rewards
        try { window.playFartSound && window.playFartSound(1, false); } catch (_) {}
        const finalScore = Math.round(RUN.score * RUN.mult);
        const silver = CFG.silverReward + Math.round(finalScore / 12);
        const xp = 40 + Math.round(finalScore / 40);
        window.State.credits = (window.State.credits || 0) + silver;
        // ONLY on a successful finish do the Poop Orbs you collected this run
        // actually land in your inventory.
        const poop = RUN.poopSession, gems = RUN.gemSession;
        if (poop > 0) { try { window.addItem && window.addItem('poop_orb', poop); } catch (_) {} }
        if (gems > 0) { try { window.addItem && window.addItem('gyatt_gem', gems); } catch (_) {} }
        try { window.fwSkillXp && window.fwSkillXp('fart', xp); } catch (_) {}
        try { window.updateHUD && window.updateHUD(); window.saveState && window.saveState(); } catch (_) {}
        try { window.floater && window.floater('🏁 Slide done! +' + silver + ' 🥈  +' + xp + ' XP  ·  💩 ' + poop + '  💎 ' + gems, 'good'); } catch (_) {}
        beachVictoryBurst();
      }
    }

    // ========================================================================
    //  THE SLIDE LOOP  (own rAF; host loop is parked via fwSlideActive)
    // ========================================================================
    let slideLast = 0;
    function slideLoop(now) {
      if (!RUN.running) return;
      let dt = Math.min(0.045, (now - slideLast) / 1000); slideLast = now;
      stepPhysics(dt);
      stepCamera(dt);
      stepCollect();
      stepDecor(dt);
      stepParticles(dt);
      updateSlideHud();
      SL.renderer.render(SL.scene, SL.camera);
      requestAnimationFrame(slideLoop);
    }

    function stepPhysics(dt) {
      // Tumbling off the edge? Play the drop, then respawn.
      if (RUN.falling) { stepFalling(dt); return; }
      // Mid-jump? Run the airborne arc instead of the on-rail physics.
      if (RUN.airborne) { stepAir(dt); return; }

      // After the finish line the curve is done — glide the sled straight to
      // the return portal so the player can ride into it to cash out.
      if (RUN.finished === true && SL.returnPortal) {
        const target = SL.returnPortal.position.clone().add(new THREE.Vector3(0, 1.5, 0));
        SL.sled.position.lerp(target, 1 - Math.pow(0.02, dt));
        const dir = target.clone().sub(SL.sled.position);
        if (dir.lengthSq() > 0.001) {
          const m = new THREE.Matrix4();
          m.lookAt(SL.sled.position, target, new THREE.Vector3(0, 1, 0));
          SL.sled.quaternion.setFromRotationMatrix(m);
        }
        return;
      }
      if (RUN.finished) {
        RUN.v *= 0.96;
      } else {
        // slope-driven acceleration: sample tangent.y at current u
        const tan = SL.curve.getTangentAt(clamp01(RUN.u)).normalize();
        const slope = -tan.y;                  // descending → positive
        RUN.v += slope * CFG.gravity * dt;
        // boost
        RUN.boosting = !!(sKeys[' '] || sKeys['space']);
        if (RUN.boosting) RUN.v += CFG.boostAccel * dt;
        // friction
        RUN.v -= RUN.v * CFG.friction * dt;
        RUN.v = Math.max(CFG.minSpeed, Math.min(CFG.maxSpeed, RUN.v));
      }

      // advance along the curve
      const du = (RUN.v * dt) / SL.curveLen;
      RUN.u += du;
      RUN.score += RUN.v * dt * CFG.distanceScore;
      RUN.time += dt;

      // steering (A/D or arrows) → lateral position
      let steer = 0;
      if (sKeys['a'] || sKeys['arrowleft']) steer -= 1;
      if (sKeys['d'] || sKeys['arrowright']) steer += 1;
      if (steer !== 0) RUN.lat += steer * CFG.steerRate * dt;
      else RUN.lat -= RUN.lat * CFG.steerReturn * dt; // auto-centre

      // centrifugal push on sharp turns (a GENTLE nudge you counter-steer
      // against — not an ejector seat). Scales with how fast you're going.
      const curU = clamp01(RUN.u);
      const ahead = clamp01(RUN.u + 0.004);
      const t0 = SL.curve.getTangentAt(curU);
      const t1 = SL.curve.getTangentAt(ahead);
      const turn = t1.clone().sub(t0);
      const right = new THREE.Vector3().crossVectors(t0, new THREE.Vector3(0, 1, 0)).normalize();
      const speedK = RUN.v / CFG.maxSpeed;
      const sideForce = turn.dot(right) * speedK;
      // clamp the per-frame push so a tight spline sample can never fling you
      // off in a single frame, but it's a real shove you must counter-steer.
      RUN.lat += Math.max(-0.06, Math.min(0.06, sideForce * dt * CFG.turnForce));
      RUN.lat = Math.max(-1.6, Math.min(1.6, RUN.lat)); // hard rail on the value

      // brief grace period after (re)spawning so you never instantly "fall"
      if (RUN.spawnGrace > 0) RUN.spawnGrace -= dt;

      // fall off the edge? (only once past the grace window) — THIS is the
      // only thing that gives you "YOU GOT FARDED".
      if (RUN.spawnGrace <= 0 && Math.abs(RUN.lat) > CFG.fallLimit && !RUN.finished) { fall(); return; }

      // hit a jump ramp? → launch into the air
      if (!RUN.finished) {
        for (const j of (SL.jumps || [])) {
          if (!j.used && RUN.u >= j.g0) { launchJump(j); return; }
        }
      }

      // reached the end?
      if (RUN.u >= 1 && !RUN.finished) finishRun();

      // place the sled on the deck
      placeSled();

      // obstacles — hitting a spiky barrel does NOT fard you. You get BONKED:
      // shoved sideways + slowed (clamped so the bonk alone can't eject you).
      // Uses true 3D distance so it only triggers when you're actually on it.
      if (RUN.spawnGrace <= 0 && !RUN.finished) {
        for (const o of (SL.obstacles || [])) {
          if (o.cool > 0) { o.cool -= dt; continue; }
          if (SL.sled.position.distanceTo(o.mesh.position) < 1.9) {
            const dir = (RUN.lat - o.lat) >= 0 ? 1 : -1;   // shove away from it
            // The faster you're going, the harder you bounce — at speed this
            // can launch you clean off the track.
            const speedK = RUN.v / CFG.maxSpeed;
            const push = 0.45 + speedK * 1.25;
            RUN.lat += dir * push;
            RUN.v *= 0.6;                                   // lose speed
            o.cool = 0.8;
            flash('#ffd23f', 'BONK! 💥');
            toast('💥 Bonked!', '#ffd23f', 700);
            // bounced off the edge? then you fall (with the new fall animation)
            if (Math.abs(RUN.lat) > CFG.fallLimit) { fall(true); return; }
            placeSled();
          }
        }
      }

      // checkpoints
      for (const cp of SL.checkpoints) {
        if (!cp.passed && RUN.u >= cp.u) {
          cp.passed = true; RUN.lastCp = cp.u;
          cp.ring.material.color.setHex(0x6cff3a);
          toast('✅ Checkpoint', '#9affff', 900);
        }
      }
    }

    function placeSled() {
      const u = clamp01(RUN.u);
      const p = SL.curve.getPointAt(u);
      const t = SL.curve.getTangentAt(u).normalize();
      const right = new THREE.Vector3().crossVectors(t, new THREE.Vector3(0, 1, 0)).normalize();
      const up = new THREE.Vector3().crossVectors(right, t).normalize();
      const pos = p.clone()
        .addScaledVector(right, RUN.lat * CFG.trackHalfWidth)
        .addScaledVector(up, 0.2);
      SL.sled.position.copy(pos);
      // orient: face along tangent, bank into the turn
      const m = new THREE.Matrix4();
      const look = pos.clone().add(t);
      m.lookAt(pos, look, up);
      SL.sled.quaternion.setFromRotationMatrix(m);
      SL.sled.rotateZ(-RUN.lat * 0.4);  // visual bank
      // little speed bob on the printer rider
      const pr = SL.sled.userData.printer;
      if (pr) pr.position.y = 0.4 + Math.abs(Math.sin(RUN.time * 16)) * (RUN.v / CFG.maxSpeed) * 0.18;
    }

    // ── launch off a ramp into a ballistic arc ──────────────────────────────
    function launchJump(j) {
      j.used = true;
      RUN.airborne = true;
      RUN.airT = 0;
      RUN.airSpeed = Math.min(CFG.maxSpeed, RUN.v * 1.3 + 8);   // BOOST off the tip
      const p0 = SL.curve.getPointAt(clamp01(j.g0));
      const p1 = SL.curve.getPointAt(clamp01(j.g1));
      RUN.airLaunch.copy(SL.sled.position);
      RUN.airLand.copy(p1);
      RUN.airLandU = j.g1;
      const tR = SL.curve.getTangentAt(clamp01(j.g1)).normalize();
      RUN.airRight.copy(new THREE.Vector3().crossVectors(tR, new THREE.Vector3(0, 1, 0)).normalize());
      RUN.airDir.copy(p1).sub(p0); RUN.airDir.y = 0;
      if (RUN.airDir.lengthSq() < 0.001) RUN.airDir.set(0, 0, 1); else RUN.airDir.normalize();
      const dist = Math.hypot(p1.x - RUN.airLaunch.x, p1.z - RUN.airLaunch.z);
      RUN.airDur = Math.max(0.7, dist / Math.max(14, RUN.airSpeed));
      RUN.airArc = 6 + dist * 0.16;                            // pop height
      RUN.airAimLat = RUN.lat;                                 // carry current lateral
      RUN.airDrift = j.drift;                                  // drift you must counter with A/D
      flash('#aaff66', '🚀 JUMP! Aim with A / D');
    }

    // ── airborne arc; A/D aims the landing, gravity-ish drift you must fight ─
    function stepAir(dt) {
      RUN.airT += dt;
      const f = Math.min(1, RUN.airT / RUN.airDur);
      let steer = 0;
      if (sKeys['a'] || sKeys['arrowleft']) steer -= 1;
      if (sKeys['d'] || sKeys['arrowright']) steer += 1;
      RUN.airAimLat += steer * 2.4 * dt + RUN.airDrift * dt;
      RUN.airAimLat = Math.max(-2.2, Math.min(2.2, RUN.airAimLat));
      const target = RUN.airLand.clone().addScaledVector(RUN.airRight, RUN.airAimLat * CFG.trackHalfWidth);
      const pos = new THREE.Vector3().lerpVectors(RUN.airLaunch, target, f);
      pos.y += RUN.airArc * Math.sin(Math.PI * f);             // up-and-over
      SL.sled.position.copy(pos);
      const vel = target.clone().sub(RUN.airLaunch); vel.y = 0;
      if (vel.lengthSq() > 0.001) {
        vel.normalize();
        const m = new THREE.Matrix4();
        m.lookAt(pos, pos.clone().add(vel), new THREE.Vector3(0, 1, 0));
        SL.sled.quaternion.setFromRotationMatrix(m);
        SL.sled.rotateX(Math.cos(Math.PI * f) * 0.3);          // nose up then down
      }
      RUN.score += RUN.airSpeed * dt * CFG.distanceScore;
      RUN.time += dt;
      // landing
      if (f >= 1) {
        RUN.airborne = false;
        if (Math.abs(RUN.airAimLat) > CFG.fallLimit) { fall(); return; }
        RUN.u = RUN.airLandU + 0.001;
        RUN.lat = Math.max(-1, Math.min(1, RUN.airAimLat));
        RUN.v = RUN.airSpeed * 0.92;
        RUN.spawnGrace = 0.2;
        placeSled();
        toast('🛬 Stuck the landing!', '#9affff', 700);
      }
    }

    function stepCamera(dt) {
      // while tumbling off, just hang back and watch the printer fall
      if (RUN.falling) {
        const want = SL.sled.position.clone().add(new THREE.Vector3(0, 5, 12));
        RUN.camPos.lerp(want, 1 - Math.pow(0.02, dt));
        SL.camera.position.copy(RUN.camPos);
        SL.camera.lookAt(SL.sled.position);
        return;
      }
      // during a jump, chase the sled from behind along the flight direction
      if (RUN.airborne) {
        const want = SL.sled.position.clone()
          .addScaledVector(RUN.airDir, -12)
          .add(new THREE.Vector3(0, 6, 0));
        RUN.camPos.lerp(want, 1 - Math.pow(0.0008, dt));
        SL.camera.position.copy(RUN.camPos);
        SL.camera.lookAt(SL.sled.position.clone().add(new THREE.Vector3(0, 1, 0)));
        return;
      }
      return stepCameraOnRail(dt);
    }
    function stepCameraOnRail(dt) {
      const u = clamp01(RUN.u);
      const p = SL.curve.getPointAt(u);
      const t = SL.curve.getTangentAt(u).normalize();
      const right = new THREE.Vector3().crossVectors(t, new THREE.Vector3(0, 1, 0)).normalize();
      // desired cam = behind + above the sled
      const speedK = RUN.v / CFG.maxSpeed;
      const back = 9 + speedK * 4;
      const want = SL.sled.position.clone()
        .addScaledVector(t, -back)
        .add(new THREE.Vector3(0, 5 + speedK * 1.5, 0))
        .addScaledVector(right, RUN.lat * 1.5);
      RUN.camPos.lerp(want, 1 - Math.pow(0.0001, dt)); // smooth follow
      SL.camera.position.copy(RUN.camPos);
      // look a touch AHEAD and slightly down the slope so the track sits
      // centred in frame (was looking flat, which made the view feel crooked)
      const lookAt = SL.sled.position.clone()
        .addScaledVector(t, 6)
        .add(new THREE.Vector3(0, 0.6, 0));
      SL.camera.lookAt(lookAt);
      // SUBTLE cinematic roll into turns (heavily reduced + clamped so the
      // horizon never looks tilted/crooked like before)
      const ahead = clamp01(u + 0.004);
      const turn = SL.curve.getTangentAt(ahead).clone().sub(t).dot(right);
      let tiltTarget = turn * 1.6 + RUN.lat * 0.08;
      tiltTarget = Math.max(-0.12, Math.min(0.12, tiltTarget));
      RUN.camTilt += (tiltTarget - RUN.camTilt) * 4 * dt;
      SL.camera.rotateZ(RUN.camTilt);
      // FOV punch with speed (and extra on boost)
      const fov = 70 + speedK * 16 + (RUN.boosting ? 8 : 0);
      if (Math.abs(SL.camera.fov - fov) > 0.1) { SL.camera.fov = fov; SL.camera.updateProjectionMatrix(); }
    }

    function stepCollect() {
      const sp = SL.sled.position;
      for (const c of SL.collectibles) {
        if (c.taken) continue;
        c.mesh.rotation.y += 0.06;
        // oscillate around the fixed base height (don't drift upward over time)
        c.mesh.position.y = c.baseY + Math.sin(RUN.time * 3 + c.u * 50) * 0.18;
        if (sp.distanceToSquared(c.mesh.position) < 6.5) {
          c.taken = true; c.mesh.visible = false;
          RUN.score += c.score;
          RUN.mult = Math.min(9.9, RUN.mult + 0.15);
          if (c.poop) {
            RUN.poopSession += 1;
            updatePoopHud();
            toast('💩 +1 Poop Orb  (' + RUN.poopSession + ' this run)', '#caa46a', 700);
          } else {
            RUN.gemSession += 1;
            toast('💎 +1 Gyatt Gem  (+' + c.score + ' score)', '#ff9ae8', 700);
          }
        }
      }
    }

    function stepDecor(dt) {
      (SL.islands || []).forEach(isl => {
        isl.rotation.y += isl.userData.spin * dt;
        isl.userData.bob += dt;
        isl.position.y += Math.sin(isl.userData.bob) * 0.01;
      });
      (SL.clouds || []).forEach(cl => { cl.position.x += cl.userData.drift * dt; });
      (SL.obstacles || []).forEach(o => { o.mesh.rotation.y += dt * 2.4; });
      // animate the return portal
      if (SL.returnRing) { SL.returnRing.rotation.z += dt; SL.returnMem.rotation.z -= dt * 1.6; }
      // detect return-portal entry once finished
      if (RUN.finished && SL.returnPortal) {
        if (SL.sled.position.distanceTo(SL.returnPortal.position) < 5) {
          RUN.finished = 'left';   // guard against double-trigger
          finishFireworks(false);
          setTimeout(() => exitSlide(true), 300);
        }
      }
    }

    // ========================================================================
    //  PARTICLES  (trail / sparkle / stars)
    // ========================================================================
    function stepParticles(dt) {
      const sb = SL.sled.position;
      // green STINKY FART cloud puffing out behind the printer. Spawn a few
      // overlapping low-velocity puffs just behind/below the sled so they
      // billow and linger like gas (denser + faster on boost).
      // emit AWAY from the camera (in front of the sled / under the board) and
      // keep it brief so it puffs out and clears fast, never filling the screen
      const fwd = SL.camera ? SL.sled.position.clone().sub(SL.camera.position).setY(0).normalize() : new THREE.Vector3(0, 0, 1);
      const emit = RUN.boosting ? 3 : 2;
      const origin = sb.clone().addScaledVector(fwd, -0.6).add(new THREE.Vector3(0, -0.1, 0));
      for (let i = 0; i < emit; i++) {
        const vel = rand3(0.8).add(new THREE.Vector3(0, 0.5 + Math.random() * 0.5, 0))
          .addScaledVector(fwd, -(RUN.boosting ? 2 : 0.8));
        spawnParticle(SL.trail, origin.clone().add(rand3(0.4)), vel, 0.55 + Math.random() * 0.4);
      }
      // speed stars when going fast
      if (RUN.v > CFG.maxSpeed * 0.7) {
        spawnParticle(SL.stars, SL.camera.position.clone().add(rand3(12)).add(SL.camera.getWorldDirection(new THREE.Vector3()).multiplyScalar(20)), rand3(1), 0.4);
      }
      updatePool(SL.trail, dt);
      updatePool(SL.stars, dt);
    }

    // ========================================================================
    //  FALL + FINISH
    // ========================================================================
    // Start the fall: the sled actually tumbles off the edge for a beat
    // BEFORE we show "YOU GOT FARDED" and respawn.
    function fall(hitObstacle) {
      if (RUN.falling) return;
      RUN.airborne = false;
      RUN.falling = true;
      RUN.fallT = 0;
      // fling outward in the direction you slid off, carrying some forward speed
      const t = SL.curve.getTangentAt(clamp01(RUN.u)).normalize();
      const right = new THREE.Vector3().crossVectors(t, new THREE.Vector3(0, 1, 0)).normalize();
      const side = RUN.lat >= 0 ? 1 : -1;
      RUN.fallVel.copy(right).multiplyScalar(side * 11).addScaledVector(t, RUN.v * 0.45);
      RUN.fallVel.y = 3;
    }

    // Plays each frame while falling; after the drop, do the real respawn.
    function stepFalling(dt) {
      RUN.fallT += dt;
      RUN.fallVel.y -= 34 * dt;                          // gravity
      SL.sled.position.addScaledVector(RUN.fallVel, dt);
      SL.sled.rotation.x += dt * 4.5;                    // tumble
      SL.sled.rotation.z += dt * 3.2;
      if (RUN.fallT >= 1.05) respawnAfterFall();
    }

    function respawnAfterFall() {
      RUN.falling = false;
      RUN.score = Math.max(0, RUN.score - 150);
      RUN.mult = Math.max(1, RUN.mult - 0.5);
      // Falling WIPES the Poop Orbs AND Gyatt Gems collected THIS RUN. The
      // ones already banked in your inventory are safe.
      const lostP = RUN.poopSession, lostG = RUN.gemSession;
      RUN.poopSession = 0; RUN.gemSession = 0;
      updatePoopHud();
      flash('#ff4040', 'YOU GOT FARDED 💩');
      if (lostP > 0 || lostG > 0)
        toast('Lost ' + lostP + ' 💩' + (lostG ? ' & ' + lostG + ' 💎' : '') + ' from this run!', '#ff7a6e', 1700);
      RUN.u = RUN.lastCp; RUN.v = 14; RUN.lat = 0; RUN.spawnGrace = 0.9;
      (SL.jumps || []).forEach(j => { if (j.g0 >= RUN.u) j.used = false; });
      placeSled();
      RUN.camPos.copy(SL.sled.position).add(new THREE.Vector3(0, 6, 10));
    }

    function finishRun() {
      RUN.finished = true;
      RUN.u = 1;
      const timeBonus = Math.max(0, 600 - Math.round(RUN.time * 4));
      RUN.score += timeBonus;
      RUN.mult = Math.min(9.9, RUN.mult + 2);     // HUGE finish multiplier
      finishFireworks(true);
      flash('#6cff3a', '🏁 FINISH!  ×' + RUN.mult.toFixed(1) + ' MULTIPLIER!');
      toast('Ride into the green portal to cash out →', '#aaff66', 4000);
    }

    // ========================================================================
    //  FIREWORKS (slide scene) + BEACH VICTORY BURST (host scene)
    // ========================================================================
    function finishFireworks(big) {
      const n = big ? 6 : 2;
      for (let f = 0; f < n; f++) {
        setTimeout(() => {
          const c = SL.finishPoint.clone().add(rand3(10)).add(new THREE.Vector3(0, 12, 0));
          for (let i = 0; i < 40; i++) {
            const col = [0xff4fd0, 0xffd23f, 0x39d7ff, 0x6cff3a][i % 4];
            spawnParticle(SL.stars, c.clone(), rand3(14), 1.4, col);
          }
        }, f * 220);
      }
    }

    function beachVictoryBurst() {
      // a quick green particle pop in the HOST scene at the portal
      const geo = new THREE.BufferGeometry();
      const n = 120, pos = new Float32Array(n * 3), vel = [];
      for (let i = 0; i < n; i++) {
        pos[i * 3] = PORTAL_POS.x; pos[i * 3 + 1] = PORTAL_POS.y + 3; pos[i * 3 + 2] = PORTAL_POS.z;
        vel.push(rand3(8).add(new THREE.Vector3(0, 6, 0)));
      }
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      const pts = new THREE.Points(geo, new THREE.PointsMaterial({
        color: GREEN, size: 0.5, transparent: true, opacity: 1,
        blending: THREE.AdditiveBlending, depthWrite: false }));
      scene.add(pts);
      let life = 0;
      (function anim() {
        life += 0.016;
        const p = geo.attributes.position.array;
        for (let i = 0; i < n; i++) {
          p[i * 3] += vel[i].x * 0.016;
          p[i * 3 + 1] += (vel[i].y -= 9.8 * 0.016) * 0.016;
          p[i * 3 + 2] += vel[i].z * 0.016;
        }
        geo.attributes.position.needsUpdate = true;
        pts.material.opacity = Math.max(0, 1 - life / 1.6);
        if (life < 1.6) requestAnimationFrame(anim);
        else { scene.remove(pts); geo.dispose(); pts.material.dispose(); }
      })();
    }

    // ========================================================================
    //  KEYS
    // ========================================================================
    function onKeyDown(e) {
      if (!RUN.running) return;
      const k = e.key.toLowerCase();
      sKeys[k] = true;
      if (k === ' ') sKeys['space'] = true;
      if (k === 'escape') { exitSlide(false); }   // bail out
      // swallow movement keys so the (parked) host game doesn't accumulate them
      if (['w', 'a', 's', 'd', ' ', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) {
        e.preventDefault(); e.stopPropagation();
      }
    }
    function onKeyUp(e) {
      const k = e.key.toLowerCase();
      sKeys[k] = false;
      if (k === ' ') sKeys['space'] = false;
    }

    // ========================================================================
    //  SLIDE HUD  (timer / score / speed / multiplier)
    // ========================================================================
    function buildSlideHud() {
      if (SL.hud) { SL.hud.style.display = 'block'; return; }
      const h = document.createElement('div');
      h.id = 'fwSlideHud';
      h.style.cssText =
        'position:fixed;top:0;left:0;width:100vw;z-index:99985;pointer-events:none;' +
        'font-family:system-ui,sans-serif;color:#eaffd6;text-shadow:0 2px 8px #000;';
      h.innerHTML =
        '<div style="display:flex;justify-content:space-between;padding:18px 26px;font-weight:800;">' +
          '<div style="font-size:30px;">⏱ <span id="slTime">0.0</span>s' +
            '<div style="font-size:24px;color:#caa46a;">💩 <span id="slPoop">0</span> Poop Orbs</div></div>' +
          '<div style="font-size:34px;text-align:center;">🏄 <span id="slScore">0</span>' +
            '<div style="font-size:18px;color:#ffd23f;">×<span id="slMult">1.0</span> MULTIPLIER</div></div>' +
          '<div style="font-size:34px;color:#9affff;">💨 <span id="slSpeed">0</span></div>' +
        '</div>' +
        '<div id="slBoost" style="text-align:center;font-size:16px;color:#aaff66;opacity:.0;">BOOSTING 🔥</div>';
      document.body.appendChild(h);
      SL.hud = h;
    }
    function updatePoopHud() { setTxt('slPoop', RUN.poopSession); }
    function updateSlideHud() {
      setTxt('slTime', RUN.time.toFixed(1));
      setTxt('slScore', Math.round(RUN.score * RUN.mult).toLocaleString());
      setTxt('slMult', RUN.mult.toFixed(1));
      setTxt('slPoop', RUN.poopSession);
      setTxt('slSpeed', Math.round(RUN.v));
      const b = document.getElementById('slBoost'); if (b) b.style.opacity = RUN.boosting ? '1' : '0';
    }

    // ========================================================================
    //  CSS POST-FX  (bloom-ish glow + chromatic aberration + speed lines)
    // ========================================================================
    let fxEl = null, speedEl = null;
    function showFx() {
      if (!fxEl) {
        // speed-lines overlay
        speedEl = document.createElement('div');
        speedEl.style.cssText =
          'position:fixed;inset:0;z-index:99982;pointer-events:none;opacity:0;transition:opacity .2s;' +
          'background:repeating-radial-gradient(circle at 50% 50%, rgba(255,255,255,0) 0 60px, rgba(255,255,255,.05) 61px 62px);' +
          'mix-blend-mode:screen;';
        document.body.appendChild(speedEl);
        // chromatic-aberration / bloom vignette
        fxEl = document.createElement('div');
        fxEl.style.cssText =
          'position:fixed;inset:0;z-index:99983;pointer-events:none;opacity:0;transition:opacity .15s;' +
          'box-shadow:inset 0 0 220px 40px rgba(108,255,58,.25);' +
          'background:linear-gradient(90deg, rgba(255,0,80,.05), transparent 12%, transparent 88%, rgba(0,160,255,.05));';
        document.body.appendChild(fxEl);
        // also softly bloom the slide canvas
        if (SL.canvas) SL.canvas.style.filter = 'saturate(1.25) contrast(1.06) brightness(1.04)';
      }
      tickFx();
    }
    function hideFx() {
      if (fxEl) fxEl.style.opacity = '0';
      if (speedEl) speedEl.style.opacity = '0';
    }
    function tickFx() {
      if (!RUN.running) return;
      const speedK = RUN.v / CFG.maxSpeed;
      if (speedEl) speedEl.style.opacity = String(Math.max(0, (speedK - 0.5) * 1.4));
      if (fxEl) {
        fxEl.style.opacity = RUN.boosting ? '1' : String(speedK * 0.5);
        // chromatic aberration jitter on boost
        if (SL.canvas) SL.canvas.style.filter = RUN.boosting
          ? 'saturate(1.4) contrast(1.1) brightness(1.08) drop-shadow(2px 0 0 rgba(255,0,80,.5)) drop-shadow(-2px 0 0 rgba(0,180,255,.5))'
          : 'saturate(1.25) contrast(1.06) brightness(1.04)';
      }
      requestAnimationFrame(tickFx);
    }

    // ========================================================================
    //  SMALL UI HELPERS  (toast + big flash text + whoosh)
    // ========================================================================
    function toast(msg, color, ms) {
      const t = document.createElement('div');
      t.textContent = msg;
      t.style.cssText =
        'position:fixed;left:50%;top:62%;transform:transl(-50%,0);z-index:99987;pointer-events:none;' +
        'font-family:system-ui,sans-serif;font-weight:800;font-size:22px;color:' + color + ';' +
        'text-shadow:0 2px 10px #000;transition:opacity .4s,transform .4s;left:50%;transform:translateX(-50%);';
      document.body.appendChild(t);
      requestAnimationFrame(() => { t.style.transform = 'translateX(-50%) translateY(-16px)'; });
      setTimeout(() => { t.style.opacity = '0'; }, (ms || 1200) - 400);
      setTimeout(() => t.remove(), ms || 1200);
    }
    function flash(color, msg) {
      const f = document.createElement('div');
      f.textContent = msg;
      f.style.cssText =
        'position:fixed;inset:0;z-index:99988;pointer-events:none;display:flex;align-items:center;justify-content:center;' +
        'font-family:system-ui,sans-serif;font-weight:900;font-size:64px;color:' + color + ';' +
        'text-shadow:0 4px 24px #000;opacity:0;transition:opacity .25s,transform .5s;transform:scale(.6);';
      document.body.appendChild(f);
      requestAnimationFrame(() => { f.style.opacity = '1'; f.style.transform = 'scale(1)'; });
      setTimeout(() => { f.style.opacity = '0'; f.style.transform = 'scale(1.3)'; }, 1100);
      setTimeout(() => f.remove(), 1500);
    }
    function whoosh() {
      // synth whoosh via WebAudio (no asset needed)
      try {
        const Ctx = window.AudioContext || window.webkitAudioContext;
        const ctx = new Ctx();
        const dur = 0.7, buf = ctx.createBuffer(1, ctx.sampleRate * dur, ctx.sampleRate);
        const d = buf.getChannelData(0);
        for (let i = 0; i < d.length; i++) {
          const k = i / d.length;
          d[i] = (Math.random() * 2 - 1) * Math.pow(1 - k, 1.5) * (0.3 + k * 0.7);
        }
        const src = ctx.createBufferSource(); src.buffer = buf;
        const flt = ctx.createBiquadFilter(); flt.type = 'lowpass';
        flt.frequency.setValueAtTime(400, ctx.currentTime);
        flt.frequency.exponentialRampToValueAtTime(2600, ctx.currentTime + dur);
        const g = ctx.createGain(); g.gain.setValueAtTime(0.5, ctx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + dur);
        src.connect(flt); flt.connect(g); g.connect(ctx.destination);
        src.start(); src.stop(ctx.currentTime + dur);
      } catch (_) {}
    }

    // ========================================================================
    //  PARTICLE POOL HELPERS
    // ========================================================================
    function makeParticlePool(THREE, scene, n, color, size, blend) {
      const geo = new THREE.BufferGeometry();
      const pos = new Float32Array(n * 3);
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      const colors = new Float32Array(n * 3);
      geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
      const mat = new THREE.PointsMaterial({
        size, transparent: true, opacity: 0.9, vertexColors: true,
        blending: blend || THREE.NormalBlending, depthWrite: false,
      });
      const pts = new THREE.Points(geo, mat);
      pts.frustumCulled = false;
      scene.add(pts);
      const part = [];
      for (let i = 0; i < n; i++) part.push({ life: 0, max: 1, vel: new THREE.Vector3(), pos: new THREE.Vector3() });
      return { geo, pts, part, n, head: 0, baseColor: new THREE.Color(color) };
    }
    function spawnParticle(pool, p, vel, life, colorHex) {
      const i = pool.head; pool.head = (pool.head + 1) % pool.n;
      const pt = pool.part[i];
      pt.pos.copy(p); pt.vel.copy(vel); pt.life = 0; pt.max = life;
      const col = colorHex != null ? new THREE.Color(colorHex) : pool.baseColor;
      const c = pool.geo.attributes.color.array;
      c[i * 3] = col.r; c[i * 3 + 1] = col.g; c[i * 3 + 2] = col.b;
    }
    function updatePool(pool, dt) {
      const arr = pool.geo.attributes.position.array;
      for (let i = 0; i < pool.n; i++) {
        const pt = pool.part[i];
        if (pt.life < pt.max) {
          pt.life += dt;
          pt.vel.y -= 2 * dt;          // gentle gravity
          pt.pos.addScaledVector(pt.vel, dt);
          arr[i * 3] = pt.pos.x; arr[i * 3 + 1] = pt.pos.y; arr[i * 3 + 2] = pt.pos.z;
        } else {
          arr[i * 3 + 1] = -99999;     // park dead particles off-screen
        }
      }
      pool.geo.attributes.position.needsUpdate = true;
      pool.geo.attributes.color.needsUpdate = true;
    }

    // ========================================================================
    //  MISC HELPERS
    // ========================================================================
    function clamp01(x) { return x < 0 ? 0 : x > 1 ? 1 : x; }
    function rand3(s) {
      return new THREE.Vector3((Math.random() - 0.5) * s, (Math.random() - 0.5) * s, (Math.random() - 0.5) * s);
    }
    function setTxt(id, v) { const e = document.getElementById(id); if (e) e.textContent = v; }

    function makeSprite(text, color) {
      const cv = document.createElement('canvas'); cv.width = 512; cv.height = 128;
      const ctx = cv.getContext('2d');
      ctx.font = 'bold 70px system-ui, sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = color; ctx.strokeStyle = '#000'; ctx.lineWidth = 8;
      ctx.strokeText(text, 256, 64); ctx.fillText(text, 256, 64);
      const tex = new THREE.CanvasTexture(cv);
      // alphaTest discards the fully-transparent canvas pixels so the sprite
      // shows ONLY the text — no white background box around it.
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, alphaTest: 0.4, depthWrite: false }));
      return sp;
    }

    function makeSkyDome(THREE) {
      const cv = document.createElement('canvas'); cv.width = 16; cv.height = 256;
      const ctx = cv.getContext('2d');
      const g = ctx.createLinearGradient(0, 0, 0, 256);
      g.addColorStop(0, '#ff9ad5');   // pink top
      g.addColorStop(0.4, '#9b6cff'); // purple
      g.addColorStop(0.7, '#3a2a66'); // deep violet
      g.addColorStop(1, '#1a3a2a');   // green-ish bottom haze
      ctx.fillStyle = g; ctx.fillRect(0, 0, 16, 256);
      const tex = new THREE.CanvasTexture(cv);
      const dome = new THREE.Mesh(
        new THREE.SphereGeometry(2000, 24, 16),
        new THREE.MeshBasicMaterial({ map: tex, side: THREE.BackSide, fog: false }));
      return dome;
    }

    // expose a manual trigger for debugging / alternate entries
    window.fwEnterSlide = beginEnter;

    console.log('[slide] FART SLIDE ready — portal planted at',
      PORTAL_POS.x.toFixed(1), PORTAL_POS.z.toFixed(1));
  }
})();
