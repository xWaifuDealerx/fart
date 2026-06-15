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
    const State = window.State;

    // Each NPC runs ONE signature lunar operation: start it, wait, collect.
    // Persisted in State.moonOps so it survives trips back to Earth.
    const OPS = [
      { id: 'earl',    op: 'Lunar Bitcoin Rig',   emoji: '\u{20BF}', durMin: 6, min: 400,  max: 2200 },
      { id: 'tord',    op: 'Zero-G Ad Farm',       emoji: '\u{1F4FA}', durMin: 4, min: 200,  max: 1400 },
      { id: 'frank',   op: 'Crater Crypto Mine',   emoji: '\u{26CF}', durMin: 7, min: 500,  max: 2600 },
      { id: 'bismark', op: 'Moon Slop Reactor',    emoji: '\u{1F916}', durMin: 5, min: 300,  max: 1800 },
      { id: 'johnny',  op: 'Vacuum VPN Nodes',     emoji: '\u{1F510}', durMin: 4, min: 250,  max: 1500 },
      { id: 'kwangu',  op: 'Regolith Render Farm', emoji: '\u{1F5BC}', durMin: 8, min: 700,  max: 3000 },
    ];
    const OP_BY_ID = {}; OPS.forEach((o, i) => { o.idx = i; OP_BY_ID[o.id] = o; });
    if (!State.moonOps || typeof State.moonOps !== 'object') State.moonOps = {};   // id -> { startTs, dur }

    // moon rock as a real inventory item, sellable at the Miner's Exchange
    if (window.ITEMS && !window.ITEMS.moon_rock) {
      window.ITEMS.moon_rock = {
        id: 'moon_rock', name: 'Moon Rock', icon: '\u{1FAA8}', color: '#cfc8ba',
        type: 'ore', isNFT: false, marketPrice: 420, suggestedPrice: 420,
        desc: 'Mined from the lunar surface. Sells for 420 silver at the Miner’s Exchange.',
      };
    }

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
    function makeNpc(id, name, tint, x, z, faceYaw) {
      let mesh;
      try { mesh = window.buildPrinter(); } catch (_) { mesh = new THREE.Group(); }
      try { if (mesh.userData && mesh.userData.screen) mesh.userData.screen.material.color.setHex(tint); } catch (_) {}
      mesh.position.set(x, SURF.y, z);
      mesh.rotation.y = faceYaw;
      scene.add(mesh);
      const tag = document.createElement('div');
      tag.className = 'name-tag';
      tag.textContent = name + ' \u{1F5A8}';
      tag.style.display = 'none';
      tagHost.appendChild(tag);
      return { id, name, mesh, tag, x, z, bob: Math.random() * 6.28 };
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
      npcs.push(makeNpc(OPS[i].id, NAMES[i], TINTS[i], nx, nz, faceYaw + Math.PI));
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

    // ════════════════════════════════════════════════════════════════
    //  OPERATION PANEL (one per NPC) — start / progress / collect
    // ════════════════════════════════════════════════════════════════
    const css = document.createElement('style');
    css.textContent = `
.mdc-bg{position:fixed;inset:0;display:none;align-items:center;justify-content:center;background:rgba(0,0,0,.72);
  -webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px);z-index:205;padding:18px}
.mdc-bg.show{display:flex}
.mdc-card{width:min(480px,95vw);max-height:88vh;display:flex;flex-direction:column;
  background:linear-gradient(180deg,rgba(10,16,26,.98),rgba(6,10,18,.98));
  border:2px solid rgba(143,209,255,.55);border-radius:18px;padding:18px 18px 16px;color:#eaf2ff;
  font-family:'Outfit','Inter',sans-serif;box-shadow:0 20px 50px rgba(0,0,0,.6);position:relative}
.mdc-card h2{font-family:'Bangers','Orbitron',sans-serif;font-size:23px;color:#8fd1ff;letter-spacing:1.2px;margin:0 0 2px;text-align:center}
.mdc-card .who{font-size:12px;color:rgba(220,235,255,.7);margin-bottom:12px;text-align:center}
.mdc-card .x{position:absolute;top:12px;right:14px;background:none;border:0;color:#8fd1ff;font-size:24px;cursor:pointer;z-index:2}
.mdc-list{display:grid;grid-template-columns:1fr 1fr;gap:7px;overflow:auto;padding-right:2px}
.mdc-row{background:rgba(143,209,255,.06);border:1px solid rgba(143,209,255,.22);border-radius:11px;padding:8px 9px;display:flex;flex-direction:column;gap:5px}
.mdc-row .tt{font-weight:700;font-size:11.5px;color:#eaf2ff;line-height:1.2}
.mdc-row .ft{display:flex;align-items:center;justify-content:space-between;gap:6px;margin-top:auto}
.mdc-row .pay{font-size:9.5px;color:rgba(255,214,77,.85);font-family:'JetBrains Mono',monospace;line-height:1.2}
.mdc-row .bar{height:8px;background:rgba(0,0,0,.4);border:1px solid rgba(143,209,255,.4);border-radius:6px;overflow:hidden;margin-top:7px}
.mdc-row .bar .fill{height:100%;background:linear-gradient(90deg,#8fd1ff,#cfeaff);width:0%}
.mdc-card .go{background:linear-gradient(135deg,#8fd1ff,#cfeaff);color:#06122a;border:0;padding:8px 16px;border-radius:100px;
  font-family:'Orbitron',sans-serif;font-weight:900;font-size:11px;text-transform:uppercase;letter-spacing:.6px;cursor:pointer;white-space:nowrap}
.mdc-card .go.collect{background:linear-gradient(135deg,#ffd64d,#fff1c2)}
.mdc-card .go:disabled{opacity:.5;cursor:not-allowed}
.mdc-prompt{position:fixed;top:96px;left:50%;transform:translateX(-50%);z-index:53;display:none;
  background:linear-gradient(180deg,rgba(10,16,26,.95),rgba(6,10,18,.95));border:2px solid rgba(143,209,255,.5);
  border-radius:12px;padding:8px 16px;color:#eaf2ff;font-family:'Outfit','Inter',sans-serif;font-size:13px;text-align:center;pointer-events:none}
.mdc-prompt .k{background:rgba(143,209,255,.2);border:1px solid rgba(143,209,255,.55);color:#8fd1ff;padding:1px 8px;border-radius:6px;font-family:monospace;font-weight:700;margin-right:5px}
`;
    document.head.appendChild(css);

    const mBg = document.createElement('div'); mBg.className = 'mdc-bg';
    document.body.appendChild(mBg);
    mBg.addEventListener('click', (e) => { if (e.target === mBg) mBg.classList.remove('show'); });
    let openId = null;

    function fmtMs(ms) { const s = Math.max(0, Math.ceil(ms / 1000)); return s < 60 ? s + 's' : Math.floor(s / 60) + 'm ' + (s % 60) + 's'; }
    function opSave() { try { window.saveState && window.saveState(); } catch (_) {} }

    // Fallback list in case datacenter.js hasn't exposed its menu yet.
    const FALLBACK_ACTS = OPS.map(o => ({ id: o.id, emoji: o.emoji, title: o.op, desc: 'Lunar AI operation.', durMin: o.durMin, min: o.min, max: o.max }));
    function activities() { return (Array.isArray(window.fwDataActivities) && window.fwDataActivities.length) ? window.fwDataActivities : FALLBACK_ACTS; }
    // Lunar ops run longer at once (and pay proportionally more) than Earth.
    const MOON_DUR_MULT = 3;

    // Per-NPC jobs: State.moonJobs[npcId][actId] = { startTs, dur }.
    if (!State.moonJobs || typeof State.moonJobs !== 'object') State.moonJobs = {};
    function jobsFor(npcId) { if (!State.moonJobs[npcId]) State.moonJobs[npcId] = {}; return State.moonJobs[npcId]; }

    // Build one activity row's button/progress markup.
    function rowState(npcId, act) {
      const job = jobsFor(npcId)[act.id];
      const now = Date.now();
      if (job && job.startTs) {
        const left = (job.startTs + job.dur) - now;
        if (left > 0) {
          const pct = Math.max(0, Math.min(100, 100 * (now - job.startTs) / job.dur));
          return '<div class="ft"><span class="pay">running · ' + fmtMs(left) + ' left</span>' +
            '<button class="go" disabled>Working…</button></div>' +
            '<div class="bar"><div class="fill" style="width:' + pct + '%"></div></div>';
        }
        return '<div class="ft"><span class="pay">\u{2705} complete</span>' +
          '<button class="go collect" data-collect="' + act.id + '">Collect \u{1F948}</button></div>';
      }
      return '<div class="ft"><span class="pay">~' + (act.durMin * MOON_DUR_MULT) + ' min · ' + (act.min * MOON_DUR_MULT) + '–' + (act.max * MOON_DUR_MULT) + ' \u{1F948}</span>' +
        '<button class="go" data-start="' + act.id + '">Run</button></div>';
    }

    function renderOps(npcId) {
      const npc = npcs.find(n => n.id === npcId);
      const name = npc ? npc.name : 'Operator';
      let rows = '';
      for (const act of activities()) {
        rows += '<div class="mdc-row"><div class="tt">' + (act.emoji || '\u{1F5A5}') + ' ' + act.title + '</div>' +
          rowState(npcId, act) + '</div>';
      }
      mBg.innerHTML = '<div class="mdc-card"><button class="x" id="mdcX">×</button>' +
        '<h2>\u{1F5A5} ' + name + '’s Lunar Rack</h2>' +
        '<div class="who">Pick an operation to run — same menu Data offers on Earth</div>' +
        '<div class="mdc-list">' + rows + '</div></div>';
      mBg.querySelector('#mdcX').addEventListener('click', () => mBg.classList.remove('show'));
    }

    // Delegated start / collect for the currently-open NPC's list.
    mBg.addEventListener('click', (e) => {
      if (!openId) return;
      const sb = e.target.closest('[data-start]');
      if (sb) {
        const act = activities().find(a => a.id === sb.getAttribute('data-start'));
        if (act) {
          jobsFor(openId)[act.id] = { startTs: Date.now(), dur: act.durMin * 60 * 1000 * MOON_DUR_MULT };
          opSave();
          try { window.floater && window.floater((act.emoji || '') + ' ' + act.title + ' started — back in ' + (act.durMin * MOON_DUR_MULT) + ' min', 'good'); } catch (_) {}
          renderOps(openId);
        }
        return;
      }
      const cb = e.target.closest('[data-collect]');
      if (cb) {
        const act = activities().find(a => a.id === cb.getAttribute('data-collect'));
        const job = act && jobsFor(openId)[act.id];
        if (act && job) {
          let pay = (act.min + Math.floor(Math.random() * (act.max - act.min + 1))) * MOON_DUR_MULT;
          if (window.fwPrestige) pay = Math.round(pay * window.fwPrestige.silverMult());
          State.credits = (State.credits || 0) + pay;
          delete jobsFor(openId)[act.id];
          opSave();
          try { window.updateHUD && window.updateHUD(); } catch (_) {}
          try { window.playPurchaseSound && window.playPurchaseSound(); } catch (_) {}
          try { window.fwSkillXp && window.fwSkillXp('data', 12); } catch (_) {}
          const msg = pay < 0 ? ('\u{1F4B8} ' + act.title + ' flopped · ' + pay + ' \u{1F948}') : ('\u{1F4B0} ' + act.title + ' paid out +' + pay + ' \u{1F948}');
          try { window.floater && window.floater(msg, pay < 0 ? 'bad' : 'good'); } catch (_) {}
          renderOps(openId);
        }
      }
    });
    function openOp(id) { openId = id; renderOps(id); mBg.classList.add('show'); }
    // keep the open list's countdowns live
    setInterval(() => { if (mBg.classList.contains('show') && openId) renderOps(openId); }, 1000);

    // ════════════════════════════════════════════════════════════════
    //  MOON ROCKS — scattered on the surface, mined with a pickaxe (F)
    // ════════════════════════════════════════════════════════════════
    const rocks = [];
    const rockMat = new THREE.MeshStandardMaterial({ color: 0xbdb6a8, roughness: 1, flatShading: true });
    function farFromBuildings(x, z) {
      // keep clear of the datacenter ring
      for (let i = 0; i < 6; i++) {
        const ang = (i / 6) * Math.PI * 2;
        const cx = SURF.x + Math.cos(ang) * RING_R, cz = SURF.z + Math.sin(ang) * RING_R;
        if (Math.hypot(x - cx, z - cz) < 9) return false;
      }
      return true;
    }
    function spawnRock(at) {
      let x, z, ok = false;
      for (let i = 0; i < 30 && !ok; i++) {
        const ang = Math.random() * Math.PI * 2;
        const r = 8 + Math.random() * ((SURF.r || 90) - 14);
        x = SURF.x + Math.cos(ang) * r; z = SURF.z + Math.sin(ang) * r;
        ok = farFromBuildings(x, z);
      }
      if (at) { x = at.x; z = at.z; }
      const m = new THREE.Mesh(new THREE.DodecahedronGeometry(1.0 + Math.random() * 0.8, 0), rockMat);
      m.position.set(x, SURF.y + 0.6, z);
      m.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3);
      // a faint silver sparkle so they read as mineable
      const glow = new THREE.Mesh(new THREE.SphereGeometry(0.18, 8, 8),
        new THREE.MeshBasicMaterial({ color: 0xdfe8ff }));
      glow.position.set(x, SURF.y + 1.3, z);
      scene.add(m); scene.add(glow);
      rocks.push({ mesh: m, glow, x, z, dead: false });
    }
    for (let i = 0; i < 14; i++) spawnRock();

    function nearestRock() {
      let best = null, bd = 3.2;
      for (const r of rocks) {
        if (r.dead) continue;
        const d = Math.hypot(Player.pos.x - r.x, Player.pos.z - r.z);
        if (d < bd) { bd = d; best = r; }
      }
      return best;
    }
    function tryMineRock() {
      if (!Player.onMoon) return;
      const rock = nearestRock(); if (!rock) return;
      if (!((State.inventory && State.inventory.pickaxe) > 0)) {
        try { window.floater && window.floater('You need a ⛏ pickaxe to mine moon rocks', 'bad'); } catch (_) {}
        return;
      }
      if (State.tools && State.tools.pickaxe && State.tools.pickaxe.durability <= 5) {
        try { window.floater && window.floater('⛏ Pickaxe too dull — sharpen at Tool Service (Siim)', 'bad'); } catch (_) {}
        return;
      }
      if (typeof window.fwStartGenericMine !== 'function') return;
      // Reuse the Earth ore-mining animation + progress bar (timed swing).
      window.fwStartGenericMine({
        emoji: '\u{1FAA8}', name: 'Moon Rock', durationMs: 2400,
        valid: () => !rock.dead,
        onComplete: () => {
          if (rock.dead) return;
          rock.dead = true;
          try { scene.remove(rock.mesh); scene.remove(rock.glow); } catch (_) {}
          try { window.addItem && window.addItem('moon_rock', 1); } catch (_) {}
          // Wear the pickaxe (same as Earth ore) so it can be re-sharpened at Siim.
          try {
            if (!State.tools) State.tools = {};
            if (!State.tools.pickaxe) State.tools.pickaxe = { durability: 100 };
            State.tools.pickaxe.durability = Math.max(0, State.tools.pickaxe.durability - 6);
          } catch (_) {}
          try { window.fwSkillXp && window.fwSkillXp('mining', 16); } catch (_) {}
          try { window.floater && window.floater('\u{1FAA8} +1 Moon Rock', 'good'); } catch (_) {}
          try { window.updateHUD && window.updateHUD(); window.saveState && window.saveState(); } catch (_) {}
          setTimeout(() => spawnRock(), 25000 + Math.random() * 20000);
        }
      });
    }
    // F mines moon rocks (the earth ore miner also listens on F but finds
    // nothing up here, so the two never conflict).
    window.addEventListener('keydown', (e) => {
      if (e.code !== 'KeyF' || !Player.onMoon) return;
      const a = document.activeElement;
      if (a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA')) return;
      tryMineRock();
    });

    // ── proximity prompt (operate / mine) ──
    const prompt = document.createElement('div'); prompt.className = 'mdc-prompt';
    document.body.appendChild(prompt);
    function nearestNpc() {
      let best = null, bd = 4.0;
      for (const n of npcs) {
        const d = Math.hypot(Player.pos.x - n.x, Player.pos.z - n.z);
        if (d < bd) { bd = d; best = n; }
      }
      return best;
    }
    (function tickPrompt() {
      let txt = '';
      if (Player.onMoon && !mBg.classList.contains('show')) {
        const n = nearestNpc();
        if (n) txt = '<span class="k">E</span> operate ' + n.name + '’s lunar data rack';
        else if (nearestRock()) txt = '<span class="k">F</span> mine Moon Rock';
      }
      prompt.innerHTML = txt; prompt.style.display = txt ? 'block' : 'none';
      requestAnimationFrame(tickPrompt);
    })();

    // ── E interaction (consumed by fartworld.html tryInteract) ──
    window.fwMoonDcInteract = function () {
      if (!Player.onMoon) return false;
      const n = nearestNpc();
      if (n) { openOp(n.id); return true; }
      return false;
    };

    window.fwMoonDatacenters = { centers, npcs };
    console.log('[moondc] 6 lunar data centers staffed by ' + NAMES.join(', '));
  }
})();
