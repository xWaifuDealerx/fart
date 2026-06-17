// =================================================================
// pvpzone.js — The four outer PVP ISLANDS (E/W/N/S), one on each side
// of the mainland at the same distance. Sail there with any boat. Inside
// each, everyone is fair game — players AND NPCs — so any printer-bot you
// catch on an island can be gunned down. A red [PVP ZONE] warning shows
// above the compass while you're on one.
//
// Each island also has a capturable GUILD POST (a flag at its centre).
// guild.js reads window.fwGuildPosts to run capture + bonus-XP logic.
//
// Terrain height comes from the mainland's groundHeightAt(), which blends
// all islands in (FW_PVP_ISLANDS in fartworld.html), so walking works.
// =================================================================
(function () {
  'use strict';

  function whenReady() {
    if (!window.THREE || !window.scene || !window.Player || !window.camera ||
        typeof window.groundHeightAt !== 'function' || !window.FW_PVP_ISLANDS) {
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
    const ISLANDS = window.FW_PVP_ISLANDS;
    const WATER = (typeof window.WATER_LEVEL === 'number') ? window.WATER_LEVEL : 0;

    // PVP zone reaches well out into the sea around each island, so combat
    // is on the moment you approach by boat — not only once you're on land.
    const ZONE_EXTRA = 53;   // sea reach of the PVP zone (≈30% larger than before)
    function reachOf(C) { return C.r + ZONE_EXTRA; }
    function inIsland(C, x, z) { return Math.hypot(x - C.x, z - C.z) <= reachOf(C); }
    function inAnyZone(x, z) { for (const C of ISLANDS) if (inIsland(C, x, z)) return C; return null; }

    const colDeep   = new THREE.Color(0x102026);
    const colShoreW = new THREE.Color(0x2a4540);
    const colSand   = new THREE.Color(0xe6d2a0);
    const colSandWet= new THREE.Color(0xc8b282);
    const colGrass  = new THREE.Color(0x24402a);
    const colGrassH = new THREE.Color(0x33543a);

    const posts = [];   // exposed to guild.js as window.fwGuildPosts

    function buildIsland(C) {
      // ── terrain ──
      const span = (C.r + C.falloff) + 6;
      const size = span * 2, segs = 72;
      const geo = new THREE.PlaneGeometry(size, size, segs, segs);
      geo.rotateX(-Math.PI / 2);
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
      const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 }));
      mesh.position.set(C.x, 0, C.z); mesh.receiveShadow = true;
      scene.add(mesh);

      // ── red boundary ring out at the ZONE edge (on the water) + danger columns ──
      const zr = reachOf(C);
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(zr - 1.6, zr, 120),
        new THREE.MeshBasicMaterial({ color: 0xff3b3b, transparent: true, opacity: 0.5, side: THREE.DoubleSide })
      );
      ring.rotation.x = -Math.PI / 2; ring.position.set(C.x, WATER + 0.12, C.z); scene.add(ring);
      // a fainter inner ring marking the actual shoreline
      const shore = new THREE.Mesh(
        new THREE.RingGeometry(C.r - 1.0, C.r, 96),
        new THREE.MeshBasicMaterial({ color: 0xff3b3b, transparent: true, opacity: 0.28, side: THREE.DoubleSide })
      );
      shore.rotation.x = -Math.PI / 2; shore.position.set(C.x, WATER + 0.12, C.z); scene.add(shore);
      for (let k = 0; k < 6; k++) {
        const a = (k / 6) * Math.PI * 2;
        const bx = C.x + Math.cos(a) * (C.r - 3), bz = C.z + Math.sin(a) * (C.r - 3);
        const gy = gH(bx, bz); if (gy <= WATER) continue;
        const col = new THREE.Mesh(
          new THREE.CylinderGeometry(0.5, 0.5, 26, 8, 1, true),
          new THREE.MeshBasicMaterial({ color: 0xff3b3b, transparent: true, opacity: 0.15, side: THREE.DoubleSide })
        );
        col.position.set(bx, gy + 13, bz); scene.add(col);
      }

      // ── boarding dock on the side facing the mainland ──
      const len = Math.hypot(C.x, C.z) || 1;
      const ix = -C.x / len, iz = -C.z / len;        // unit vector toward origin
      const edgeX = C.x + ix * C.r, edgeZ = C.z + iz * C.r;
      const woodMat  = new THREE.MeshStandardMaterial({ color: 0x6b4623, roughness: 0.88 });
      const woodMat2 = new THREE.MeshStandardMaterial({ color: 0x55351a, roughness: 0.85 });
      const dock = new THREE.Mesh(new THREE.BoxGeometry(4, 0.25, 14), woodMat);
      dock.position.set(edgeX + ix * 6, WATER + 0.18, edgeZ + iz * 6);
      dock.rotation.y = Math.atan2(ix, iz);
      dock.castShadow = dock.receiveShadow = true; scene.add(dock);
      try { if (Array.isArray(window.WalkableSurfaces)) window.WalkableSurfaces.push(dock); } catch (_) {}
      const px = -iz, pz = ix;     // perpendicular unit
      for (let i = 0; i <= 5; i++) {
        for (let s = -1; s <= 1; s += 2) {
          const post = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 2.6, 6), woodMat2);
          const dl = i * 2.6;
          post.position.set(edgeX + ix * dl + px * s * 1.8, WATER - 1.0, edgeZ + iz * dl + pz * s * 1.8);
          scene.add(post);
        }
      }
      const lamp = new THREE.PointLight(0xff3b3b, 1.4, 20);
      lamp.position.set(edgeX + ix * 4, WATER + 2.4, edgeZ + iz * 4); scene.add(lamp);

      // ── GUILD POST flag at the island centre ──
      const cy = gH(C.x, C.z);
      const poleMat = new THREE.MeshStandardMaterial({ color: 0xcfd6de, metalness: 0.5, roughness: 0.4 });
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 8, 8), poleMat);
      pole.position.set(C.x, cy + 4, C.z); scene.add(pole);
      const flagMat = new THREE.MeshStandardMaterial({ color: 0x888888, side: THREE.DoubleSide, roughness: 0.7, emissive: 0x000000 });
      const flag = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 1.6), flagMat);
      flag.position.set(C.x + 1.3, cy + 7, C.z); scene.add(flag);
      // floating label showing who holds the Post
      const lblCanvas = document.createElement('canvas'); lblCanvas.width = 256; lblCanvas.height = 64;
      const lblTex = new THREE.CanvasTexture(lblCanvas);
      const lbl = new THREE.Mesh(new THREE.PlaneGeometry(4.4, 1.1), new THREE.MeshBasicMaterial({ map: lblTex, transparent: true }));
      lbl.position.set(C.x, cy + 9, C.z); scene.add(lbl);
      function setHolder(name, colorHex, logoUrl) {
        // Captured → show the guild's logo on the flag. No logo → solid colour.
        if (logoUrl) {
          try {
            new THREE.TextureLoader().load(logoUrl, (tex) => {
              flagMat.map = tex; flagMat.color.setHex(0xffffff); flagMat.needsUpdate = true;
            });
          } catch (_) { flagMat.map = null; flagMat.color.setHex(colorHex || 0x888888); flagMat.needsUpdate = true; }
        } else {
          if (flagMat.map) { flagMat.map = null; }
          flagMat.color.setHex(colorHex || 0x888888); flagMat.needsUpdate = true;
        }
        flagMat.emissive.setHex((colorHex || logoUrl) ? 0x222222 : 0x000000);
        const ctx = lblCanvas.getContext('2d');
        ctx.clearRect(0, 0, 256, 64);
        ctx.fillStyle = 'rgba(8,10,16,0.82)'; ctx.fillRect(0, 0, 256, 64);
        ctx.strokeStyle = '#ffd64d'; ctx.lineWidth = 3; ctx.strokeRect(2, 2, 252, 60);
        ctx.fillStyle = '#fff1c2'; ctx.font = 'bold 17px Outfit, Arial'; ctx.textAlign = 'center';
        ctx.fillText('⚑ ' + C.dir + ' GUILD POST', 128, 26);
        ctx.font = '14px Outfit, Arial'; ctx.fillStyle = name ? '#5ff09c' : 'rgba(230,255,238,.6)';
        ctx.fillText(name ? 'Held by ' + name : 'Unclaimed', 128, 48);
        lblTex.needsUpdate = true;
      }
      setHolder(null, null);

      posts.push({ dir: C.dir, x: C.x, z: C.z, flag, lbl, setHolder });

      return mesh;
    }

    for (const C of ISLANDS) buildIsland(C);
    window.fwGuildPosts = posts;

    // ── 4 mountains in the sea between the islands (the diagonals) ──
    (function buildMountains() {
      const rockMat = new THREE.MeshStandardMaterial({ color: 0x6b6f78, roughness: 0.96, flatShading: true });
      const snowMat = new THREE.MeshStandardMaterial({ color: 0xeaf2ff, roughness: 0.7, flatShading: true });
      // [x, z, base radius, height, segments] — varied sizes + shapes
      const MTS = [
        [ 230,  230, 34, 70, 7 ],   // NE — tall sharp
        [ 230, -230, 46, 48, 6 ],   // SE — broad squat
        [-230, -230, 28, 58, 5 ],   // SW — jagged pyramid
        [-230,  230, 40, 82, 8 ],   // NW — biggest
      ];
      for (const [x, z, r, h, seg] of MTS) {
        const g = new THREE.Group();
        const peak = new THREE.Mesh(new THREE.ConeGeometry(r, h, seg), rockMat);
        peak.position.y = h / 2 - 3;            // base sunk a little under the sea
        peak.castShadow = true; peak.receiveShadow = true; g.add(peak);
        // a smaller offset secondary peak for a less perfect silhouette
        const sub = new THREE.Mesh(new THREE.ConeGeometry(r * 0.55, h * 0.6, seg), rockMat);
        sub.position.set(r * 0.5, h * 0.3 - 3, r * 0.3); g.add(sub);
        g.position.set(x, 0, z);
        g.rotation.y = Math.random() * Math.PI;
        scene.add(g);
      }
    })();

    // ── [PVP ZONE] warning above the compass ──
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

    setInterval(() => {
      const C = (Player && Player.pos) ? inAnyZone(Player.pos.x, Player.pos.z) : null;
      window.fwInPvpZone = !!C;
      window.fwPvpIslandHere = C || null;
      if (C) { dockWarn(); warn.classList.add('show'); }
      else warn.classList.remove('show');
    }, 300);

    // Every printer-bot standing on ANY PVP island becomes a valid target.
    (function installShootableWrap() {
      const orig = window.fwShootableBots;
      if (typeof orig !== 'function') { setTimeout(installShootableWrap, 800); return; }
      if (orig._pvpWrapped) return;
      const wrapped = function () {
        let base = [];
        try { base = orig() || []; } catch (_) {}
        if (window.fwInPvpZone && Array.isArray(window.fwPrinterBots)) {
          const set = new Set(base);
          for (const b of window.fwPrinterBots) if (b && !b.dead && inAnyZone(b.x, b.z)) set.add(b);
          return Array.from(set);
        }
        return base;
      };
      wrapped._pvpWrapped = true;
      window.fwShootableBots = wrapped;
    })();

    // expose for guild.js
    window.fwInIsland = (x, z) => inAnyZone(x, z);

    console.log('[pvpzone] ' + ISLANDS.length + ' PVP islands ready with guild posts');
  }
})();
