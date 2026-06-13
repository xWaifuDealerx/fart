// =================================================================
// moondc.js — 6 lunar data centers (in the style of Data's Datacenter)
//   arranged in a ring on the moon surface. Each rack is tended by its
//   own printer-NPC: Earl, Tord, Frank, Bismark, Johnny, Kwangu.
//   The NPCs are ambient (you can't interact with them) — they just
//   look like printers working their racks, with a floating name tag.
//   Depends on the moon surface exposed by moon.js (window.fwMoonSurface)
//   and the shared printer builder (window.buildPrinter).
// =================================================================
(function () {
  'use strict';

  function whenReady() {
    if (!window.THREE || !window.scene || !window.camera || !window.Player ||
        !window.buildPrinter || !window.fwMoonSurface) {
      setTimeout(whenReady, 600);
      return;
    }
    try { init(); } catch (e) { console.error('[moondc] init failed', e); }
  }
  whenReady();

  function init() {
    const THREE = window.THREE;
    const scene = window.scene;
    const Player = window.Player;
    const SURF = window.fwMoonSurface;            // { x, y, z, r }

    const NAMES = ['Earl', 'Tord', 'Frank', 'Bismark', 'Johnny', 'Kwangu'];
    const TINTS = [0x8fd1ff, 0xff9ad5, 0x9cff7a, 0xffd76a, 0xc6a8ff, 0x7af0d0];
    const RING_R = Math.max(34, (SURF.r || 90) * 0.52);   // ring radius on the surface

    // ── one lunar data center building (compact take on Data's) ──
    function buildDatacenter(cx, cz, faceYaw, name) {
      const grp = new THREE.Group();
      grp.position.set(cx, SURF.y, cz);
      grp.rotation.y = faceYaw;

      const wallMat  = new THREE.MeshStandardMaterial({ color: 0x2a3038, roughness: 0.85 });
      const floorMat = new THREE.MeshStandardMaterial({ color: 0x1a1d22, roughness: 0.9 });
      const trimMat  = new THREE.MeshStandardMaterial({ color: 0x101418, roughness: 0.55, metalness: 0.55 });

      const slab = new THREE.Mesh(new THREE.BoxGeometry(7, 0.3, 6), floorMat);
      slab.position.y = 0.15; grp.add(slab);
      const back = new THREE.Mesh(new THREE.BoxGeometry(7, 3.4, 0.3), wallMat);
      back.position.set(0, 1.8, 2.85); grp.add(back);
      for (const sx of [-3.35, 3.35]) {
        const side = new THREE.Mesh(new THREE.BoxGeometry(0.3, 3.4, 6), wallMat);
        side.position.set(sx, 1.8, 0); grp.add(side);
      }
      const roof = new THREE.Mesh(new THREE.BoxGeometry(7.3, 0.3, 6.3), trimMat);
      roof.position.set(0, 3.55, 0); grp.add(roof);

      // server racks lining the inside walls, with blinking LEDs
      const leds = [];
      for (const side of [-1, 1]) {
        for (let i = 0; i < 3; i++) {
          const rack = new THREE.Mesh(new THREE.BoxGeometry(0.5, 2.2, 1.2),
            new THREE.MeshStandardMaterial({ color: 0x111519, roughness: 0.7, metalness: 0.4 }));
          rack.position.set(side * 2.6, 1.3, -1.6 + i * 1.4); grp.add(rack);
          for (let j = 0; j < 4; j++) {
            const col = [0x39d7ff, 0x5ff09c, 0xffd23f, 0xff5a5a][(i + j) % 4];
            const led = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.08, 0.08),
              new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: 1.5 }));
            led.position.set(side * 2.6 - side * 0.28, 0.55 + j * 0.42, -1.6 + i * 1.4 + 0.35);
            grp.add(led); leds.push(led);
          }
        }
      }

      // glowing name sign on the back wall
      const cv = document.createElement('canvas'); cv.width = 256; cv.height = 80;
      const ctx = cv.getContext('2d');
      ctx.fillStyle = '#0a0d12'; ctx.fillRect(0, 0, 256, 80);
      ctx.strokeStyle = '#5ff09c'; ctx.lineWidth = 4; ctx.strokeRect(6, 6, 244, 68);
      ctx.fillStyle = '#5ff09c'; ctx.font = "900 30px 'Bangers',sans-serif";
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('\u{1F5A5} ' + name.toUpperCase(), 128, 42);
      const sign = new THREE.Mesh(new THREE.PlaneGeometry(4.4, 1.1),
        new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(cv), transparent: true }));
      sign.position.set(0, 4.2, 2.7); sign.rotation.set(0.08, 0, 0); grp.add(sign);

      scene.add(grp);
      return { grp, leds };
    }

    // ── the rack-tender printer NPC ──
    const tagHost = document.getElementById('nameTags') || document.body;
    function makeNpc(name, tint, x, z, faceYaw) {
      let mesh;
      try { mesh = window.buildPrinter(); } catch (_) { mesh = new THREE.Group(); }
      try { if (mesh.userData && mesh.userData.screen) mesh.userData.screen.material.color.setHex(tint); } catch (_) {}
      mesh.position.set(x, SURF.y, z);
      mesh.rotation.y = faceYaw;
      scene.add(mesh);
      const tag = document.createElement('div');
      tag.className = 'name-tag';
      tag.textContent = name;
      tag.style.display = 'none';
      tagHost.appendChild(tag);
      return { name, mesh, tag, bob: Math.random() * 6.28 };
    }

    // ── place 6 datacenters + NPCs in a ring, facing the centre ──
    const centers = [];
    const npcs = [];
    for (let i = 0; i < 6; i++) {
      const ang = (i / 6) * Math.PI * 2;
      const cx = SURF.x + Math.cos(ang) * RING_R;
      const cz = SURF.z + Math.sin(ang) * RING_R;
      const faceYaw = Math.atan2(SURF.x - cx, SURF.z - cz);   // face the moon centre
      const dc = buildDatacenter(cx, cz, faceYaw, NAMES[i]);
      centers.push(dc);
      // NPC stands just inside, in front of the racks, facing the back wall
      const nx = cx + Math.sin(faceYaw) * 1.4;
      const nz = cz + Math.cos(faceYaw) * 1.4;
      npcs.push(makeNpc(NAMES[i], TINTS[i], nx, nz, faceYaw + Math.PI));
    }

    // ── per-frame: blink LEDs, idle the NPCs, project name tags ──
    const _proj = new THREE.Vector3();
    let t0 = performance.now();
    function tick() {
      const now = performance.now();
      const t = now / 1000;
      // blink a few LEDs
      for (const dc of centers) {
        for (let k = 0; k < dc.leds.length; k++) {
          if (((Math.sin(t * 3 + k * 1.7) > 0.6) ? 1 : 0)) dc.leds[k].material.emissiveIntensity = 1.8;
          else dc.leds[k].material.emissiveIntensity = 0.5;
        }
      }
      const onMoon = !!(Player.onMoon);
      for (const n of npcs) {
        // gentle "working" idle: bob + a tapping right arm
        n.bob += 0.05;
        const ud = n.mesh.userData;
        n.mesh.position.y = SURF.y + Math.abs(Math.sin(n.bob)) * 0.04;
        if (ud && ud.armR) ud.armR.rotation.x = -0.6 + Math.sin(n.bob * 2) * 0.35;
        // name tag only while you're actually on the moon and nearby
        const tag = n.tag;
        if (!onMoon) { tag.style.display = 'none'; continue; }
        const dx = n.mesh.position.x - Player.pos.x, dz = n.mesh.position.z - Player.pos.z;
        if (dx * dx + dz * dz > 60 * 60) { tag.style.display = 'none'; continue; }
        _proj.set(n.mesh.position.x, n.mesh.position.y + 2.6, n.mesh.position.z); _proj.project(window.camera);
        if (_proj.z > -1 && _proj.z < 1) {
          tag.style.left = ((_proj.x * 0.5 + 0.5) * window.innerWidth) + 'px';
          tag.style.top = ((-_proj.y * 0.5 + 0.5) * window.innerHeight) + 'px';
          tag.style.display = '';
        } else {
          tag.style.display = 'none';
        }
      }
      requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);

    window.fwMoonDatacenters = { centers, npcs };
    console.log('[moondc] 6 lunar data centers staffed by ' + NAMES.join(', '));
  }
})();
