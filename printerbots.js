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
    // Ben's Bakery — the bots head here to eat when their hunger runs low.
    const BAKERY = { name: 'Bakery', x: -35, z: -7 };

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
      const rc = b.raidedSlots || null;
      const now = Date.now();
      for (let i = 0; i < 6; i++) {
        if (b.toilets[i]) continue;
        // A slot the player just raided stays empty until its cooldown ends,
        // so a stolen brainrot isn't instantly replaced by the owner bot.
        if (rc && rc[i] && now < rc[i]) continue;
        return i;
      }
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
    function makeTag(name, iconSVG) {
      const t = document.createElement('div');
      t.className = 'name-tag';
      // Rank/prestige ICON only, in front of the name (like a real player's tag).
      const ico = iconSVG
        ? '<span style="display:inline-flex;vertical-align:middle;margin-right:4px;width:16px;height:16px">' + iconSVG + '</span>'
        : '';
      t.innerHTML = ico + name;
      t.style.display = 'none';
      tagHost.appendChild(t);
      return t;
    }

    // ── build one bot ──
    function makeBot(name, accent, level, prestige) {
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
      const lvl = level || 30, pres = prestige || 0;
      const iconSVG = (window.fwPrestige && window.fwPrestige.iconFor)
        ? window.fwPrestige.iconFor(lvl, pres, 16) : '';
      return {
        name, level: lvl, prestige: pres, mesh, tag: makeTag(name, iconSVG),
        x: sx, z: sz, yaw: Math.random() * Math.PI * 2, speed: 3.0 + Math.random() * 0.8,
        baseIdx: null, carry: null, carryMesh: null,
        task: null, linger: 1 + Math.random() * 2, walking: false, bob: Math.random() * 6.28,
        stealing: false, stealSlot: 0, stealId: null, stealUntil: 0,
        stoleFromPlayer: false,   // carrying a brainrot taken from YOUR base
        dead: false, deadUntil: 0, // shot down — hidden until it respawns
        spawnX: sx, spawnZ: sz,
        hunger: 60 + Math.random() * 40,   // drains over time → triggers a bakery run
        eatingUntil: 0,
      };
    }

    const bots = [
      makeBot('Toiletcarta', 0xff6ad5, 38, 0),
      makeBot('Skibidireaper', 0x9cff5a, 52, 2),
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
    // Brainrot bases are SERVER-OWNED now: the bots' renting/filling/raiding
    // happens on the server so every player sees the same occupancy. The
    // client bots therefore no longer touch local bases — they just wander
    // around town and grab a bite at the bakery when hungry.
    function decide(bot) {
      if (bot.carry == null && ((bot.hunger != null && bot.hunger < 35) || Math.random() < 0.06)) {
        return { kind: 'eat', x: BAKERY.x, z: BAKERY.z };
      }
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
          bot.stoleFromPlayer = false;
        }
        bot.linger = 2 + Math.random() * 2;
      } else if (t.kind === 'steal') {
        // Begin a raid: it takes as long as the brainrot's OWN steal timer
        // (rarer = longer). The countdown runs in the tick while the bot
        // stands at your base.
        const pb = playerBase();
        const slot = pb ? occupiedToilet(pb) : -1;
        if (pb && slot >= 0) {
          bot.stealing = true;
          bot.stealSlot = slot;
          bot.stealId = pb.toilets[slot];
          const dur = (BR.BRAINROTS[bot.stealId] && BR.BRAINROTS[bot.stealId].steal) || 10000;
          bot.stealUntil = performance.now() + dur;
          try { window.floater && window.floater('\u{1F977} ' + bot.name + ' is raiding your base! (' + Math.round(dur / 1000) + 's)', 'bad'); } catch (_) {}
        } else {
          bot.linger = 1 + Math.random();
        }
      } else if (t.kind === 'eat') {
        // At Ben's Bakery — grab a bite and refill the hunger bar.
        bot.hunger = 100;
        bot.eatingUntil = performance.now() + 3500;   // pause to munch
        bot.linger = 3 + Math.random() * 2;
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
        // Hunger slowly drains, which periodically sends the bot to the bakery.
        bot.hunger = Math.max(0, (bot.hunger == null ? 100 : bot.hunger) - dt * 0.4);
        // Shot down — stay hidden until the respawn timer elapses.
        if (bot.dead) {
          bot.tag.style.display = 'none';
          if (now >= bot.deadUntil) respawnBot(bot);
          continue;
        }
        if (!inSlide) {
          if (bot.stealing) {
            // Standing at your base, raiding — takes as long as the brainrot's
            // own steal timer. Cancels if the brainrot is gone (you claimed it).
            bot.walking = false;
            const pb = playerBase();
            const id = (pb && Array.isArray(pb.toilets)) ? pb.toilets[bot.stealSlot] : null;
            if (!pb || id !== bot.stealId) {
              bot.stealing = false; bot.linger = 0.5;
            } else if (now >= bot.stealUntil) {
              pb.toilets[bot.stealSlot] = null;
              try { BR.setToiletHead && BR.setToiletHead(pb, bot.stealSlot, null); } catch (_) {}
              try { BR.paintSign && BR.paintSign(pb); } catch (_) {}
              try { BR.syncStateBase && BR.syncStateBase(pb); } catch (_) {}
              const t2 = BR.BRAINROTS[bot.stealId];
              attachCarry(bot, t2 || randType());
              bot.stoleFromPlayer = true;   // shoot it to get this back!
              try { window.floater && window.floater('\u{1F977} ' + bot.name + ' stole ' + (t2 ? t2.name : 'a brainrot') + ' from your base! Shoot it to get it back', 'bad'); } catch (_) {}
              bot.stealing = false; bot.linger = 1.5;
            }
          } else if (bot.linger > 0) {
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

    // ── Respawn a downed bot somewhere fresh ──
    function respawnBot(bot) {
      let sx = bot.spawnX, sz = bot.spawnZ;
      for (let i = 0; i < 30; i++) {
        const a = Math.random() * Math.PI * 2, r = 12 + Math.random() * (ISLAND_R - 28);
        const cx = Math.cos(a) * r, cz = Math.sin(a) * r;
        if (landAt(cx, cz)) { sx = cx; sz = cz; break; }
      }
      bot.x = sx; bot.z = sz;
      bot.dead = false; bot.stealing = false; bot.stoleFromPlayer = false;
      detachCarry(bot);
      bot.task = null; bot.linger = 1 + Math.random() * 2; bot.walking = false;
      bot.mesh.position.set(sx, gH(sx, sz), sz);
      try { if (!bot.mesh.parent) scene.add(bot.mesh); bot.mesh.visible = true; } catch (_) {}
    }

    // ── Kill a thief bot (called by gunsmith.js when a shot lands) ──
    // If it had already grabbed YOUR brainrot, return it to your base.
    function killThief(bot) {
      if (!bot || bot.dead) return false;
      const wasRaiding = bot.stealing;
      // Return a stolen brainrot to the player's base if there's room.
      if (bot.stoleFromPlayer && bot.carry) {
        const pb = playerBase();
        const slot = pb ? emptyToilet(pb) : -1;
        if (pb && slot >= 0) {
          pb.toilets[slot] = bot.carry;
          try { BR.setToiletHead && BR.setToiletHead(pb, slot, bot.carry); } catch (_) {}
          try { BR.paintSign && BR.paintSign(pb); } catch (_) {}
          try { BR.syncStateBase && BR.syncStateBase(pb); } catch (_) {}
          const t = BR.BRAINROTS[bot.carry];
          try { window.floater && window.floater('\u{21A9}\u{FE0F} ' + (t ? t.name : 'Your brainrot') + ' recovered and returned to your base!', 'good'); } catch (_) {}
        }
      }
      detachCarry(bot);
      bot.stealing = false; bot.stoleFromPlayer = false;
      bot.dead = true; bot.deadUntil = performance.now() + 35000;   // back in 35s
      bot.tag.style.display = 'none';
      try { scene.remove(bot.mesh); } catch (_) {}
      // Reward the defender — counts as a PVP kill (defending your base).
      try { window.fwProfile && window.fwProfile.addPvpKill(bot.name); } catch (_) {}
      try { window.State.credits = (window.State.credits || 0) + 50; } catch (_) {}
      try { window.fwSkillXp && window.fwSkillXp('weapon', 20); } catch (_) {}
      try { window.fwSfx && window.fwSfx('deagle', 0.4); } catch (_) {}
      try { window.floater && window.floater('\u{1F480} You took down ' + bot.name + (wasRaiding ? ' raiding your base!' : '!') + ' +50 \u{1F948}', 'good'); } catch (_) {}
      try { window.updateHUD && window.updateHUD(); window.saveState && window.saveState(); } catch (_) {}
      return true;
    }
    window.fwKillThief = killThief;
    // Bots that may currently be shot: raiding your base, or fleeing with loot
    // taken from you. (Bots just running errands are not targetable.)
    window.fwShootableBots = function () {
      return bots.filter(b => !b.dead && (b.stealing || (b.carry && b.stoleFromPlayer)));
    };

    window.fwPrinterBots = bots;
    console.log('[printerbots] ' + bots.map(b => b.name).join(' & ') + ' are roaming as fake players');
  }
})();
