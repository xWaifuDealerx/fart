// =================================================================
// pvpzone.js — The PVP ISLAND. A second, smaller landmass to the east
// (nearest edge at 276,18; half the mainland's radius). Sail there with
// any boat. Inside it everyone is fair game — players AND NPCs — so any
// printer-bot you catch on the island can be gunned down. A red
// [PVP ZONE] warning shows above the compass while you're on it.
//
//   Terrain height is supplied by the mainland's groundHeightAt(), which
//   already blends this island in (see FW_PVP_ISLAND in fartworld.html),
//   so the player walks on it normally.
// =================================================================
(function () {
  'use strict';

  function whenReady() {
    if (!window.THREE || !window.scene || !window.Player || !window.camera ||
        typeof window.groundHeightAt !== 'function' || !window.FW_PVP_ISLAND) {
      setTimeout(whenReady, 500); return;
    }
    try { init(); } catch (e) { console.error('[pvpzone] init failed', e); }
  }
  whenReady();

  function init() {
    const THREE = window.THREE;
    const scene = window.scene;
    const Player = window.Player;
    const gH = window.groundHeightAt;
    const C = window.FW_PVP_ISLAND;                 // { x, z, r, falloff }
    const WATER = (typeof window.WATER_LEVEL === 'number') ? window.WATER_LEVEL : 0;
    const REACH = C.r + 5;                           // "on the island" radius

    function inZone(x, z) { return Math.hypot(x - C.x, z - C.z) <= REACH; }

    // ── 1) Island terrain mesh (samples the same height function) ──
    (function buildTerrain() {
      const span = (C.r + C.falloff) + 6;
      const size = span * 2, segs = 72;
      const geo = new THREE.PlaneGeometry(size, size, segs, segs);
      geo.rotateX(-Math.PI / 2);

      const colDeep   = new THREE.Color(0x102026);
      const colShoreW = new THREE.Color(0x2a4540);
      const colSand   = new THREE.Color(0xe6d2a0);
      const colSandWet= new THREE.Color(0xc8b282);
      const colGrass  = new THREE.Color(0x24402a);   // a touch darker/duskier than home
      const colGrassH = new THREE.Color(0x33543a);

      const pos = geo.attributes.position;
      const colors = new Float32Array(pos.count * 3);
      for (let i = 0; i < pos.count; i++) {
        const wx = C.x + pos.getX(i), wz = C.z + pos.getZ(i);
        const y = gH(wx, wz);
        pos.setY(i, y);
        let c;
        if (y < -3.5) c = colDeep;
        else if (y < -0.3) c = colDeep.clone().lerp(colShoreW, THREE.MathUtils.smoothstep(y, -3.5, -0.3));
        else if (y < 0.4)  c = colShoreW.clone().lerp(colSandWet, THREE.MathUtils.smoothstep(y, -0.3, 0.4));
        else if (y < 1.1)  c = colSandWet.clone().lerp(colSand, THREE.MathUtils.smoothstep(y, 0.4, 1.1));
        else if (y < 1.7)  c = colSand.clone().lerp(colGrass, THREE.MathUtils.smoothstep(y, 1.1, 1.7));
        else               c = colGrass.clone().lerp(colGrassH, THREE.MathUtils.smoothstep(y, 1.7, 2.4));
        colors[i*3] = c.r; colors[i*3+1] = c.g; colors[i*3+2] = c.b;
      }
      geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
      geo.computeVertexNormals();
      const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0.0 });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(C.x, 0, C.z);
      mesh.receiveShadow = true;
      scene.add(mesh);
    })();

    // ── 2) Red glowing boundary ring + warning beacons on the shore ──
    (function buildBorder() {
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(C.r - 1.2, C.r, 96),
        new THREE.MeshBasicMaterial({ color: 0xff3b3b, transparent: true, opacity: 0.6, side: THREE.DoubleSide })
      );
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(C.x, WATER + 0.12, C.z);
      scene.add(ring);
      // A couple of tall red light columns so it reads as a danger zone.
      for (let k = 0; k < 6; k++) {
        const a = (k / 6) * Math.PI * 2;
        const bx = C.x + Math.cos(a) * (C.r - 3), bz = C.z + Math.sin(a) * (C.r - 3);
        const gy = gH(bx, bz);
        if (gy <= WATER) continue;
        const col = new THREE.Mesh(
          new THREE.CylinderGeometry(0.5, 0.5, 26, 8, 1, true),
          new THREE.MeshBasicMaterial({ color: 0xff3b3b, transparent: true, opacity: 0.16, side: THREE.DoubleSide })
        );
        col.position.set(bx, gy + 13, bz);
        scene.add(col);
      }
    })();

    // ── 3) Boarding dock at the nearest edge (276, 18), out over water ──
    (function buildDock() {
      const woodMat  = new THREE.MeshStandardMaterial({ color: 0x6b4623, roughness: 0.88 });
      const woodMat2 = new THREE.MeshStandardMaterial({ color: 0x55351a, roughness: 0.85 });
      const signMat  = new THREE.MeshStandardMaterial({ color: 0xff3b3b, emissive: 0xff3b3b, emissiveIntensity: 0.7, roughness: 0.45 });
      const grp = new THREE.Group();
      // The island's near edge is at x = C.x - C.r = 276. Dock runs west
      // from the beach out over the water toward the mainland.
      const edgeX = C.x - C.r;                  // 276
      const dock = new THREE.Mesh(new THREE.BoxGeometry(14, 0.25, 4), woodMat);
      dock.position.set(edgeX - 6, WATER + 0.18, C.z);
      dock.castShadow = true; dock.receiveShadow = true;
      grp.add(dock);
      try { if (Array.isArray(window.WalkableSurfaces)) window.WalkableSurfaces.push(dock); } catch (_) {}
      for (let i = 0; i <= 5; i++) {
        for (let s = -1; s <= 1; s += 2) {
          const post = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 2.6, 6), woodMat2);
          post.position.set(edgeX - i * 2.6, WATER - 1.0, C.z + s * 1.8);
          grp.add(post);
        }
      }
      // Red "PVP ISLAND" sign post at the head of the dock.
      const postY = gH(edgeX + 1, C.z);
      const signPost = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 4, 6), woodMat2);
      signPost.position.set(edgeX + 1, postY + 2, C.z + 2.4);
      grp.add(signPost);
      const sign = new THREE.Mesh(new THREE.BoxGeometry(4.2, 1.1, 0.16), signMat);
      sign.position.set(edgeX + 1, postY + 3.4, C.z + 2.4);
      grp.add(sign);
      // Label canvas on the sign
      try {
        const cv = document.createElement('canvas'); cv.width = 256; cv.height = 64;
        const ctx = cv.getContext('2d');
        ctx.fillStyle = '#ff3b3b'; ctx.fillRect(0, 0, 256, 64);
        ctx.fillStyle = '#fff'; ctx.font = 'bold 30px Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('☠ PVP ISLAND', 128, 34);
        const tex = new THREE.CanvasTexture(cv);
        const lbl = new THREE.Mesh(new THREE.PlaneGeometry(4.0, 1.0),
          new THREE.MeshBasicMaterial({ map: tex, transparent: true }));
        lbl.position.set(edgeX + 1 - 0.1, postY + 3.4, C.z + 2.49);
        lbl.rotation.y = Math.PI;     // face the incoming boats (west)
        const lbl2 = lbl.clone(); lbl2.rotation.y = 0; lbl2.position.z = C.z + 2.31;
        grp.add(lbl); grp.add(lbl2);
      } catch (_) {}
      // Red beacon light
      const lamp = new THREE.PointLight(0xff3b3b, 1.6, 22);
      lamp.position.set(edgeX - 4, WATER + 2.4, C.z);
      grp.add(lamp);
      scene.add(grp);
    })();

    // ── 4) [PVP ZONE] warning above the compass ──
    const css = document.createElement('style');
    css.textContent = `
.fw-pvp-warn{position:fixed;z-index:47;display:none;align-items:center;gap:7px;
  background:rgba(40,6,6,.92);border:2px solid rgba(255,59,59,.85);border-radius:10px;
  padding:5px 12px;font-family:'Orbitron','Outfit',sans-serif;font-weight:900;font-size:12px;
  letter-spacing:1.2px;color:#ff6a5a;box-shadow:0 4px 14px rgba(0,0,0,.5),0 0 18px rgba(255,59,59,.4);
  text-shadow:0 0 8px rgba(255,59,59,.6);white-space:nowrap;animation:fwPvpPulse 1.1s ease infinite}
.fw-pvp-warn.show{display:flex}
.fw-pvp-warn .sym{font-size:14px}
@keyframes fwPvpPulse{0%,100%{opacity:1}50%{opacity:.55}}
`;
    document.head.appendChild(css);
    const warn = document.createElement('div');
    warn.className = 'fw-pvp-warn';
    warn.innerHTML = '<span class="sym">⚠</span><span>[ PVP ZONE ]</span>';
    document.body.appendChild(warn);

    // Dock the warning directly ABOVE the compass widget.
    function dockWarn() {
      const cmp = document.getElementById('fwCompass');
      if (!cmp) return;
      const r = cmp.getBoundingClientRect();
      if (r.width < 10) return;
      const wr = warn.getBoundingClientRect();
      const w = wr.width || 120;
      warn.style.left = (r.left + r.width / 2 - w / 2) + 'px';
      warn.style.top = Math.max(6, r.top - (wr.height || 26) - 6) + 'px';
      warn.style.right = 'auto';
    }
    setInterval(dockWarn, 500);

    // ── 5) zone tick: flag + warning + make on-island bots shootable ──
    setInterval(() => {
      const here = !!(Player && Player.pos) && inZone(Player.pos.x, Player.pos.z);
      window.fwInPvpZone = here;
      if (here) { dockWarn(); warn.classList.add('show'); }
      else warn.classList.remove('show');
    }, 300);

    // Wrap fwShootableBots so EVERY printer-bot standing on the PVP island
    // becomes a valid target (not just thieves). Kills route through
    // fwKillThief → fwProfile.addPvpKill, so they count + fire your motto.
    (function installShootableWrap() {
      const orig = window.fwShootableBots;
      if (typeof orig !== 'function') { setTimeout(installShootableWrap, 800); return; }
      if (orig._pvpWrapped) return;
      const wrapped = function () {
        let base = [];
        try { base = orig() || []; } catch (_) {}
        if (window.fwInPvpZone && Array.isArray(window.fwPrinterBots)) {
          const set = new Set(base);
          for (const b of window.fwPrinterBots) {
            if (b && !b.dead && inZone(b.x, b.z)) set.add(b);
          }
          return Array.from(set);
        }
        return base;
      };
      wrapped._pvpWrapped = true;
      window.fwShootableBots = wrapped;
    })();

    console.log('[pvpzone] PVP island ready at edge (276,18), center', C.x, C.z, 'r', C.r);
  }
})();
