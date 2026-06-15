// =================================================================
// profile.js — Player Profile window + lifetime stat tracking + Motto.
//   • Open it by clicking your NAME (top-right wallet chip) or your
//     LEVEL (top-left HUD card).
//   • Tracks: PVP Kills, Mob Kills (spiders), Deaths, XP, Level/
//     Prestige, Time Played, and Brainrot Earnings (silver).
//   • A custom MOTTO floats above your character whenever you get a
//     PVP kill (deathmatch, base-steal defense, or PVP-zone kill).
//
//   Other systems feed the counters through window.fwProfile:
//     addPvpKill(victimName) · addBrainrotSilver(n) · addDeath()
//   Mob kills read State.spidersKilled (already maintained by the gun).
//   Persisted via the main saveState whitelist (State.profile, deaths).
// =================================================================
(function () {
  'use strict';

  function whenReady() {
    if (!window.State || !document.body) { setTimeout(whenReady, 400); return; }
    init();
  }
  whenReady();

  function init() {
    const State = window.State;
    if (!State.profile || typeof State.profile !== 'object') State.profile = {};
    const P = State.profile;
    if (typeof P.pvpKills === 'number')  {} else P.pvpKills = 0;
    if (typeof P.brainrotSilver !== 'number') P.brainrotSilver = 0;
    if (typeof P.playMs !== 'number') P.playMs = 0;
    if (typeof P.motto !== 'string') P.motto = '';
    if (typeof P.joinTs !== 'number') P.joinTs = Date.now();
    if (typeof State.deaths !== 'number') State.deaths = 0;
    if (typeof State.spidersKilled !== 'number') State.spidersKilled = 0;

    // ── public API used by the gun / deathmatch / brainrot / death code ──
    window.fwProfile = {
      addPvpKill(victimName) {
        P.pvpKills = (P.pvpKills || 0) + 1;
        try { showMotto(); } catch (_) {}
        try { window.saveState && window.saveState(); } catch (_) {}
      },
      addBrainrotSilver(n) {
        n = Math.max(0, Math.floor(Number(n) || 0));
        if (!n) return;
        P.brainrotSilver = (P.brainrotSilver || 0) + n;
        try { window.saveState && window.saveState(); } catch (_) {}
      },
      addDeath() {
        State.deaths = (State.deaths || 0) + 1;
        try { window.saveState && window.saveState(); } catch (_) {}
      },
      open() { openPanel(); },
      stats() { return collect(); },
    };

    // ── lifetime play-time accumulator ──
    let lastTs = Date.now(), saveAcc = 0;
    setInterval(() => {
      const now = Date.now();
      let dt = now - lastTs; lastTs = now;
      if (dt < 0 || dt > 5000) dt = 1000;             // clamp tab-sleep gaps
      if (window.fwInGame === false) return;
      if (document.hidden) return;
      P.playMs = (P.playMs || 0) + dt;
      saveAcc += dt;
      if (saveAcc >= 30000) { saveAcc = 0; try { window.saveState && window.saveState(); } catch (_) {} }
    }, 1000);

    // ── styles ──
    const css = document.createElement('style');
    css.textContent = `
.fwp-bg{position:fixed;inset:0;display:none;align-items:center;justify-content:center;
  background:rgba(0,0,0,.78);-webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px);z-index:215;padding:18px}
.fwp-bg.show{display:flex}
.fwp-card{width:min(560px,96vw);max-height:90vh;overflow:auto;background:linear-gradient(180deg,rgba(10,16,22,.98),rgba(5,9,14,.98));
  border:2px solid rgba(95,240,156,.5);border-radius:18px;color:#eef3f8;font-family:'Outfit','Inter',sans-serif;
  box-shadow:0 24px 60px rgba(0,0,0,.6)}
.fwp-hd{display:flex;align-items:center;gap:14px;padding:18px 20px;border-bottom:1px solid rgba(95,240,156,.18)}
.fwp-hd .badge{width:56px;height:56px;flex:0 0 auto;filter:drop-shadow(0 2px 6px rgba(0,0,0,.5))}
.fwp-hd .badge svg{width:100%;height:100%;display:block}
.fwp-hd .who{flex:1;min-width:0}
.fwp-hd .nm{font-family:'Bangers','Orbitron',sans-serif;font-size:24px;letter-spacing:1px;color:#5ff09c;line-height:1.05;
  white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.fwp-hd .rk{font-size:12px;color:rgba(230,255,238,.7);margin-top:2px}
.fwp-hd .rk b{color:#ffd64d}
.fwp-hd .x{background:transparent;border:0;color:rgba(230,238,248,.55);font-size:26px;cursor:pointer;align-self:flex-start;line-height:1}
.fwp-bd{padding:16px 20px 20px}
.fwp-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}
.fwp-stat{background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);border-radius:12px;padding:12px 10px;text-align:center}
.fwp-stat .v{font-family:'Orbitron',sans-serif;font-weight:900;font-size:20px;color:#fff1c2;line-height:1.1}
.fwp-stat .v.kills{color:#ff7a6e}
.fwp-stat .v.mob{color:#9cff5a}
.fwp-stat .v.silver{color:#ffd64d;font-size:16px}
.fwp-stat .l{font-size:10px;font-weight:800;letter-spacing:.8px;text-transform:uppercase;color:rgba(230,238,248,.55);margin-top:5px}
.fwp-motto{margin-top:16px;background:rgba(95,240,156,.06);border:1px solid rgba(95,240,156,.25);border-radius:12px;padding:13px 14px}
.fwp-motto .ttl{font-size:11px;font-weight:800;letter-spacing:1.2px;text-transform:uppercase;color:#5ff09c;margin-bottom:8px}
.fwp-motto .row{display:flex;gap:8px}
.fwp-motto input{flex:1;min-width:0;background:rgba(0,0,0,.35);border:1px solid rgba(95,240,156,.3);border-radius:9px;
  color:#eaffef;font-family:'Outfit','Inter',sans-serif;font-size:13px;padding:9px 11px;outline:none}
.fwp-motto input:focus{border-color:rgba(95,240,156,.7)}
.fwp-motto button{background:linear-gradient(135deg,#2ee06b,#5ff09c);color:#06220f;border:0;border-radius:9px;
  font-family:'Orbitron',sans-serif;font-weight:900;font-size:11px;letter-spacing:.5px;padding:0 16px;cursor:pointer}
.fwp-motto .hint{font-size:10.5px;color:rgba(230,255,238,.45);margin-top:7px;line-height:1.5}
/* Motto banner that floats over your character on a PVP kill */
.fwp-mottobanner{position:fixed;z-index:120;transform:translate(-50%,-50%);pointer-events:none;display:none}
.fwp-mottobanner.show{display:block}
.fwp-motto-inner{display:inline-flex;align-items:center;gap:8px;white-space:nowrap;
  padding:9px 22px;border-radius:13px;
  background:linear-gradient(135deg,rgba(22,2,2,.94),rgba(64,8,8,.94));
  color:#fff;font-family:'Bangers','Orbitron',sans-serif;font-size:23px;letter-spacing:1.6px;
  border:2px solid #ff5a4d;
  box-shadow:0 8px 26px rgba(0,0,0,.6),0 0 30px rgba(255,90,77,.6),inset 0 0 18px rgba(255,90,77,.25);
  text-shadow:0 0 10px rgba(255,90,77,.9),0 2px 4px rgba(0,0,0,.7);
  transform-origin:center;animation:fwpMottoIn .42s cubic-bezier(.2,1.5,.4,1),fwpMottoGlow 1.5s ease-in-out infinite .42s}
.fwp-motto-inner .sk{font-size:19px;filter:drop-shadow(0 0 6px rgba(255,90,77,.8))}
@keyframes fwpMottoIn{0%{opacity:0;transform:scale(.3) rotate(-10deg)}60%{opacity:1;transform:scale(1.12) rotate(2deg)}100%{transform:scale(1) rotate(-2deg)}}
@keyframes fwpMottoGlow{0%,100%{box-shadow:0 8px 26px rgba(0,0,0,.6),0 0 26px rgba(255,90,77,.5),inset 0 0 18px rgba(255,90,77,.25)}50%{box-shadow:0 8px 26px rgba(0,0,0,.6),0 0 46px rgba(255,150,90,.9),inset 0 0 22px rgba(255,90,77,.45)}}
`;
    document.head.appendChild(css);

    // ── helpers ──
    function playerName() {
      const w = document.getElementById('hudWallet');
      const t = w && w.textContent ? w.textContent.trim() : '';
      if (t && t.toLowerCase() !== 'guest') return t;
      if (window.Net && window.Net.handle) return window.Net.handle;
      return State.username || t || 'Printer';
    }
    function fmtTime(ms) {
      const s = Math.floor((ms || 0) / 1000);
      const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
      if (h > 0) return h + 'h ' + m + 'm';
      if (m > 0) return m + 'm';
      return s + 's';
    }
    function xpForLevel(lv) { return (typeof window.xpForLevel === 'function') ? window.xpForLevel(lv) : 100 * lv; }
    function collect() {
      const lv = State.level || 1;
      const pres = (window.fwPrestige && window.fwPrestige.count) ? window.fwPrestige.count() : (State.prestige || 0);
      const rank = (window.fwPrestige && window.fwPrestige.rankName) ? window.fwPrestige.rankName() : '';
      const pvp = P.pvpKills || 0, deaths = State.deaths || 0;
      return {
        name: playerName(),
        pvpKills: pvp,
        mobKills: State.spidersKilled || 0,
        deaths: deaths,
        kd: deaths > 0 ? (pvp / deaths).toFixed(2) : (pvp > 0 ? pvp.toFixed(2) : '0.00'),
        xp: State.xp || 0,
        xpMax: xpForLevel(lv),
        level: lv,
        prestige: pres,
        rank: rank,
        time: fmtTime(P.playMs),
        brainrotSilver: P.brainrotSilver || 0,
        motto: P.motto || '',
      };
    }

    // ── window ──
    const bg = document.createElement('div');
    bg.className = 'fwp-bg';
    document.body.appendChild(bg);
    bg.addEventListener('click', (e) => { if (e.target === bg) bg.classList.remove('show'); });

    function statCell(value, label, cls) {
      return '<div class="fwp-stat"><div class="v ' + (cls || '') + '">' + value + '</div><div class="l">' + label + '</div></div>';
    }
    function render() {
      const s = collect();
      const badge = (window.fwPrestige && window.fwPrestige.iconFor)
        ? window.fwPrestige.iconFor(s.level, s.prestige, 56) : '';
      const rankLine = (s.rank ? '<b>' + s.rank + '</b>' : '') +
        ' · Lv ' + s.level + (s.prestige > 0 ? ' · ★' + s.prestige + ' Prestige' : '');
      bg.innerHTML =
        '<div class="fwp-card">' +
          '<div class="fwp-hd">' +
            '<div class="badge">' + badge + '</div>' +
            '<div class="who"><div class="nm">' + escapeHtml(s.name) + '</div><div class="rk">' + rankLine + '</div></div>' +
            '<button class="x" id="fwpX">×</button>' +
          '</div>' +
          '<div class="fwp-bd">' +
            '<div class="fwp-grid">' +
              statCell(s.pvpKills, 'PVP Kills', 'kills') +
              statCell(s.mobKills, 'Mob Kills', 'mob') +
              statCell(s.deaths, 'Deaths') +
              statCell(s.kd, 'K / D') +
              statCell(s.xp.toLocaleString() + '<span style="font-size:11px;opacity:.6"> / ' + s.xpMax.toLocaleString() + '</span>', 'XP') +
              statCell(s.time, 'Time Played') +
            '</div>' +
            '<div class="fwp-grid" style="margin-top:10px;grid-template-columns:1fr">' +
              statCell(s.brainrotSilver.toLocaleString() + ' 🥈', 'Brainrot Earnings', 'silver') +
            '</div>' +
            '<div class="fwp-motto">' +
              '<div class="ttl">⚔️ Kill Motto</div>' +
              '<div class="row"><input id="fwpMotto" maxlength="42" placeholder="e.g. Get printed, scrub." value="' + escapeAttr(s.motto) + '"/>' +
              '<button id="fwpMottoSave">SAVE</button></div>' +
              '<div class="hint">Shown floating above your character whenever you take down another player — in a deathmatch, the PVP zone, or while defending your base from a thief.</div>' +
            '</div>' +
          '</div>' +
        '</div>';
      document.getElementById('fwpX').addEventListener('click', () => bg.classList.remove('show'));
      const save = document.getElementById('fwpMottoSave');
      const inp = document.getElementById('fwpMotto');
      save.addEventListener('click', () => {
        P.motto = (inp.value || '').slice(0, 42);
        try { window.saveState && window.saveState(); } catch (_) {}
        try { window.floater && window.floater('⚔️ Motto saved', 'good'); } catch (_) {}
      });
      inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') save.click(); });
    }
    function openPanel() { render(); bg.classList.add('show'); }

    function escapeHtml(s) { return String(s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c])); }
    function escapeAttr(s) { return escapeHtml(s).replace(/"/g, '&quot;'); }

    // ── click triggers: top-right name + top-left level ──
    function wireTriggers() {
      const wallet = document.querySelector('.hud-wallet');
      if (wallet && !wallet._fwpWired) {
        wallet._fwpWired = true; wallet.style.cursor = 'pointer'; wallet.title = 'View your profile';
        wallet.addEventListener('click', openPanel);
      }
      const hp = document.querySelector('.hud-player');
      if (hp && !hp._fwpWired) {
        hp._fwpWired = true;
        const lv = hp.querySelector('.lv'); if (lv) { lv.style.cursor = 'pointer'; lv.title = 'View your profile'; }
        hp.addEventListener('click', (e) => {
          // Don't hijack the prestige medal badge (it opens the ranks panel).
          if (e.target && e.target.closest && e.target.closest('#fwRankBadge')) return;
          openPanel();
        });
      }
      if (!wallet || !hp) setTimeout(wireTriggers, 700);
    }
    wireTriggers();

    // ── floating motto banner over the player on a PVP kill ──
    const banner = document.createElement('div');
    banner.className = 'fwp-mottobanner';
    document.body.appendChild(banner);
    let bannerUntil = 0, bannerRAF = false;
    function showMotto() {
      const motto = (P.motto || '').trim();
      if (!motto) return;                       // no motto set → nothing to show
      banner.innerHTML = '<span class="fwp-motto-inner"><span class="sk">☠</span>' + escapeHtml(motto) + '</span>';
      banner.classList.add('show');
      bannerUntil = performance.now() + 10000;  // visible for 10 seconds
      if (!bannerRAF) { bannerRAF = true; requestAnimationFrame(trackBanner); }
    }
    const _v = (window.THREE ? new window.THREE.Vector3() : null);
    function trackBanner() {
      if (performance.now() > bannerUntil) { banner.classList.remove('show'); bannerRAF = false; return; }
      try {
        const cam = window.camera, Pl = window.Player;
        if (cam && Pl && Pl.pos && _v) {
          _v.set(Pl.pos.x, Pl.pos.y + 3.0, Pl.pos.z);
          _v.project(cam);
          if (_v.z > -1 && _v.z < 1) {
            banner.style.left = ((_v.x * 0.5 + 0.5) * window.innerWidth) + 'px';
            banner.style.top = ((-_v.y * 0.5 + 0.5) * window.innerHeight) + 'px';
            banner.style.transform = 'translate(-50%,-50%)';
            banner.style.display = 'block';
          } else { banner.style.display = 'none'; }
        }
      } catch (_) {}
      requestAnimationFrame(trackBanner);
    }
    window.fwShowMotto = showMotto;   // pvpzone.js triggers this for zone kills

    console.log('[profile] ready — click your name or level to open');
  }
})();
