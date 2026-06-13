// ============================================================================
// printerbots.js — "fake player" printer NPCs that simulate real players.
//   Toiletcarta & Skibidireaper roam the island like other printers: they
//   wander between the Bank, Market, Hotel and Laundry, rent a brainrot base,
//   pick up roaming brainrots and carry them home to plant in their toilets,
//   and OCCASIONALLY try to steal a brainrot from YOUR base.
//
//   • They look like the default printer character (built with buildPrinter).
//   • They have a floating name tag like a real remote player.
//   • You CANNOT interact with them (no E prompt) — they just live their lives.
//
//   Depends on the brainrot.js API exposed at window.fwBrainrots:
//     { Bases, Roamers, BRAINROTS, paintSign, setToiletHead, makeBody,
//       occupiedYps, meId, syncStateBase }
// ============================================================================
(function () {
  'use strict';

  function whenReady() {
    if (!window.THREE || !window.scene || !window.camera || !window.Player ||
        !window.State || !window.groundHeightAt || !window.buildPrinter ||
        !window.fwBrainrots || !window.fwBrainrots.Bases) {
      setTimeout(whenReady, 600);
      return;
    }
    try { init(); } catch (e) { console.error('[printerbots] init failed', e); }
  }
  whenReady();

  function init() {
    const THREE = window.THREE;
    const scene = window.scene;
    const Player = window.Player;
    const State = window.State;
    const gH = window.groundHeightAt;
    const BR = window.fwBrainrots;
    const ISLAND_R = (typeof window.ISLAND_RADIUS === 'number') ? window.ISLAND_RADIUS : 90;
    const WATER = (typeof window.WATER_LEVEL === 'number') ? window.WATER_LEVEL : 0;

    // ── town points of interest the bots like to visit ──
    const POIS = [
      { name: 'Bank',    x: -22, z: -8 },
      { name: 'Market',  x: -22, z: -32 },
      { name: 'Hotel',   x: -64, z: 18 },
      { name: 'Laundry', x: 0,   z: -55 },
    ];

    const BASES = BR.Bases;
    const ROAMERS = BR.Roamers || [];

    function landAt(x, z) { return gH(x, z) > WATER + 0.3; }
    function baseCentre(b) { return { x: b.x, z: b.z }; }
    function playerBase() {
      const br = State.br;
      if (br && br.idx >= 0 && BASES[br.idx]) return BASES[br.idx];
      return null;
    }
    function emptyToilet(b) {
      if (!b || !Array.isArray(b.toilets)) return -1;
      for (let i = 0; i < 6; i++) if (!b.toilets[i]) return i;
      return -1;
    }
    function occupiedToilet(b) {
      if (!b || !Array.isArray(b.toilets)) return -1;
      for (let i = 0; i < 6; i++) if (b.toilets[i]) return i;
      return -1;
    }
    function randType() {
      const ids = Object.keys(BR.BRAINROTS || {});
      return ids.length ? BR.BRAINROTS[ids[(Math.random() * ids.length) | 0]] : null;
    }

    // ── name tags (same container the multiplayer peers use) ──
    const tagHost = document.getElementById('nameTags') || document.body;
    function makeTag(name) {
      const t = document.createElement('div');
      t.className = 'name-tag';
      t.textContent = name;
      t.style.display = 'none';
      tagHost.appendChild(t);
      return t;
    }

    // ── build one bot ──
    function makeBot(name, accent) {
      const mesh = window.buildPrinter();
      // a subtle accent so the two are distinguishable but still "default-ish"
      try {
        if (accent && mesh.userData && mesh.userData.screen)
          mesh.userData.screen.material.color.setHex(accent);
      } catch (_) {}
      // spawn at a random land point
      let sx = 0, sz = 0;
      for (let i = 0; i < 30; i++) {
        const a = Math.random() * Math.PI * 2, r = 12 + Math.random() * (ISLAND_R - 28);
        sx = Math.cos(a) * r; sz = Math.sin(a) * r;
        if (landAt(sx, sz)) break;
      }
      mesh.position.set(sx, gH(sx, sz), sz);
      scene.add(mesh);
      return {
        name, mesh, tag: makeTag(name),
        x: sx, z: sz, yaw: Math.random() * Math.PI * 2, speed: 3.0 + Math.random() * 0.8,
        baseIdx: null, carry: null, carryMesh: null,
        task: null, linger: 1 + Math.random() * 2, stealT: 0, walking: false, bob: Math.random() * 6.28,
      };
    }

    const bots = [
      makeBot('Toiletcarta', 0xff6ad5),
      makeBot('Skibidireaper', 0x9cff5a),
    ];

    // ── carry visuals (a small brainrot on the raised right arm) ──
    function attachCarry(bot, type) {
      detachCarry(bot);
      bot.carry = type.id;
      try {
        const m = BR.makeBody ? BR.makeBody(type) : null;
        if (m) {
          m.scale.set(0.45, 0.45, 0.45);
          m.rotation.set(1.25, 0, 0);
          m.position.set(0, -0.55, 0.12);
          const arm = bot.mesh.userData && bot.mesh.userData.armR;
          if (arm) { arm.add(m); bot.carryMesh = m; }
        }
      } catch (_) {}
    }
    function detachCarry(bot) {
      if (bot.carryMesh) { try { bot.carryMesh.parent && bot.carryMesh.parent.remove(bot.carryMesh); } catch (_) {} }
      bot.carryMesh = null; bot.carry = null;
    }

    // ── pick the bot's next goal ──
    function decide(bot) {
      // 1) no base yet → go rent a free one
      if (bot.baseIdx == null) {
        const free = BASES.filter(b => !b.owner);
        if (free.length) {
          const b = free[(Math.random() * free.length) | 0];
          return { kind: 'rent', idx: b.idx, x: b.x, z: b.z };
        }
      }
      // 2) carrying a brainrot → take it home and plant it
      if (bot.carry && bot.baseIdx != null) {
        const b = BASES[bot.baseIdx];
        return { kind: 'plant', idx: bot.baseIdx, x: b.x, z: b.z };
      }
      // 3) otherwise roll the dice
      const roll = Math.random();
      // try to steal from the player (only if your base has a brainrot to take)
      const pb = playerBase();
      if (roll < 0.20 && pb && occupiedToilet(pb) >= 0 && bot.carry == null) {
        return { kind: 'steal', x: pb.x, z: pb.z };
      }
      // grab a roaming brainrot to bring home
      if (roll < 0.55 && bot.baseIdx != null && emptyToilet(BASES[bot.baseIdx]) >= 0 && ROAMERS.length) {
        const r = ROAMERS[(Math.random() * ROAMERS.length) | 0];
        if (r) return { kind: 'grab', roamer: r, x: r.x, z: r.z };
      }
      // else just run errands in town
      const p = POIS[(Math.random() * POIS.length) | 0];
      return { kind: 'wander', x: p.x, z: p.z, name: p.name };
    }

    // ── act on arrival at the task target ──
    function performTask(bot, t) {
      if (t.kind === 'rent') {
        const b = BASES[t.idx];
        if (b && !b.owner) {
          b.owner = 'bot_' + bot.name.toLowerCase();
          b.ownerName = bot.name;
          b.until = Date.now() + 6 * 60 * 60 * 1000;   // long lease
          b.lastTick = Date.now(); b.pending = 0;
          bot.baseIdx = t.idx;
          try { BR.paintSign && BR.paintSign(b); } catch (_) {}
        } else if (b && b.owner === 'bot_' + bot.name.toLowerCase()) {
          bot.baseIdx = t.idx;
        }
        bot.linger = 2 + Math.random() * 2;
      } else if (t.kind === 'grab') {
        const r = t.roamer, i = ROAMERS.indexOf(r);
        if (i >= 0 && r && !r.dead) {
          r.dead = true;
          try { scene.remove(r.mesh); } catch (_) {}
          ROAMERS.splice(i, 1);
          attachCarry(bot, r.t || randType());
        }
        bot.linger = 1.5 + Math.random();
      } else if (t.kind === 'plant') {
        const b = BASES[bot.baseIdx];
        const slot = emptyToilet(b);
        if (b && slot >= 0 && bot.carry) {
          b.toilets[slot] = bot.carry;
          try { BR.setToiletHead && BR.setToiletHead(b, slot, bot.carry); } catch (_) {}
          try { BR.paintSign && BR.paintSign(b); } catch (_) {}
          detachCarry(bot);
        }
        bot.linger = 2 + Math.random() * 2;
      } else if (t.kind === 'steal') {
        // stand at the player's base for a few seconds, then snatch one
        bot.stealT += 0.2;   // accumulates while we keep returning here
        const pb = playerBase();
        if (pb) {
          const slot = occupiedToilet(pb);
          if (slot >= 0) {
            const stolen = pb.toilets[slot];
            pb.toilets[slot] = null;
            try { BR.setToiletHead && BR.setToiletHead(pb, slot, null); } catch (_) {}
            try { BR.paintSign && BR.paintSign(pb); } catch (_) {}
            try { BR.syncStateBase && BR.syncStateBase(pb); } catch (_) {}
            const t2 = BR.BRAINROTS[stolen];
            attachCarry(bot, t2 || randType());
            try { window.floater && window.floater('🥷 ' + bot.name + ' stole ' + (t2 ? t2.name : 'a brainrot') + ' from your base!', 'bad'); } catch (_) {}
            try { window.playFartSound && window.playFartSound(0.5, true); } catch (_) {}
          }
        }
        bot.linger = 1 + Math.random();
      } else {
        // wander — just hang out a moment
        bot.linger = 2 + Math.random() * 3;
      }
      bot.task = null;
    }

    // ── per-frame update ──
    const _proj = new THREE.Vector3();
    let last = performance.now();
    function tick() {
      const now = performance.now();
      let dt = (now - last) / 1000; if (dt > 0.1) dt = 0.1; last = now;
      const inSlide = !!window.fwSlideActive;

      for (const bot of bots) {
        if (!inSlide) {
          if (bot.linger > 0) {
            bot.linger -= dt; bot.walking = false;
          } else {
            if (!bot.task) bot.task = decide(bot);
            const t = bot.task;
            const dx = t.x - bot.x, dz = t.z - bot.z, d = Math.hypot(dx, dz);
            if (d < 2.0) {
              bot.walking = false;
              performTask(bot, t);
            } else {
              bot.walking = true;
              bot.x += (dx / d) * bot.speed * dt;
              bot.z += (dz / d) * bot.speed * dt;
              bot.yaw = Math.atan2(dx, dz);
            }
          }
          // place on the ground
          const gy = gH(bot.x, bot.z);
          bot.mesh.position.set(bot.x, gy, bot.z);
          bot.mesh.rotation.y = bot.yaw;
          // walk animation + raised arm when carrying
          bot.bob += dt * 12;
          const ud = bot.mesh.userData;
          if (ud && ud.legL) {
            const sw = bot.walking ? Math.sin(bot.bob) * 0.5 : 0;
            ud.legL.rotation.x = sw; ud.legR.rotation.x = -sw;
            if (ud.armL) ud.armL.rotation.x = -sw * 0.5;
            if (ud.armR) ud.armR.rotation.x = bot.carry ? -1.25 : (sw * 0.5);
          }
        }

        // name tag projection (skip while in the slide level)
        const tag = bot.tag;
        if (inSlide) { tag.style.display = 'none'; continue; }
        const ddx = bot.x - Player.pos.x, ddz = bot.z - Player.pos.z;
        if (ddx * ddx + ddz * ddz > 45 * 45) { tag.style.display = 'none'; continue; }
        _proj.set(bot.x, bot.mesh.position.y + 2.6, bot.z); _proj.project(window.camera);
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

    window.fwPrinterBots = bots;
    console.log('[printerbots] ' + bots.map(b => b.name).join(' & ') + ' are roaming as fake players');
  }
})();
