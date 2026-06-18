// =================================================================
// playerlist.js — "Players Online" panel.
//   • Right-side 👥 button (under the Guild button).
//   • Lists everyone currently on the server, served by the game
//     server's {t:'roster'} broadcast (window.FWServer.roster).
//   • Each row: [rank insignia OR prestige emblem] [GUILD] Username.
//     If the player has prestiged, the prestige sign replaces the rank.
// =================================================================
(function () {
  'use strict';
  function whenReady() {
    if (!window.State || !document.body) { setTimeout(whenReady, 400); return; }
    init();
  }
  whenReady();

  function init() {
    const css = document.createElement('style');
    css.textContent = `
#fwPlayersBtn{position:fixed;top:566px;right:14px;width:42px;height:42px;border-radius:12px;
  background:rgba(8,18,11,.85);border:2px solid rgba(124,170,255,.5);color:#a8c8ff;font-size:19px;
  cursor:pointer;z-index:33;display:flex;align-items:center;justify-content:center;padding:0;pointer-events:auto;
  transition:transform .15s ease,border-color .15s ease,box-shadow .15s ease;box-shadow:0 6px 14px rgba(0,0,0,.35)}
#fwPlayersBtn:hover{background:rgba(124,170,255,.16);border-color:#a8c8ff;box-shadow:0 0 16px rgba(124,170,255,.35);transform:scale(1.05)}
#fwPlayersBtn .cnt{position:absolute;top:-5px;right:-5px;min-width:17px;height:17px;border-radius:9px;background:#5ff09c;
  color:#06122a;font-family:'Orbitron',sans-serif;font-weight:900;font-size:10px;line-height:17px;text-align:center;padding:0 3px}
#fwPlayersCard{position:fixed;top:566px;right:64px;width:min(280px,82vw);max-height:60vh;overflow:auto;display:none;
  z-index:34;background:linear-gradient(180deg,rgba(10,16,26,.98),rgba(5,9,16,.98));border:2px solid rgba(124,170,255,.5);
  border-radius:14px;color:#eaf1ff;font-family:'Outfit','Inter',sans-serif;box-shadow:0 18px 44px rgba(0,0,0,.6)}
#fwPlayersCard.show{display:block}
#fwPlayersCard .hd{display:flex;align-items:center;gap:8px;padding:11px 14px;border-bottom:1px solid rgba(124,170,255,.18);
  position:sticky;top:0;background:rgba(8,12,20,.98)}
#fwPlayersCard .hd .t{font-family:'Bangers','Orbitron',sans-serif;font-size:17px;letter-spacing:1px;color:#a8c8ff;flex:1}
#fwPlayersCard .hd .x{background:transparent;border:0;color:rgba(220,235,255,.55);font-size:22px;cursor:pointer;line-height:1}
#fwPlayersCard .bd{padding:8px 10px}
.fw-pl-row{display:flex;align-items:center;gap:7px;padding:6px 8px;border-radius:9px;font-size:13px;margin-bottom:3px;
  background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.06)}
.fw-pl-row.me{border-color:rgba(95,240,156,.5);box-shadow:0 0 10px rgba(95,240,156,.14)}
.fw-pl-row .ico{width:18px;height:18px;flex:0 0 auto;display:inline-flex;align-items:center;justify-content:center}
.fw-pl-row .tag{font-family:'JetBrains Mono',monospace;font-size:11px;color:#a8c8ff;font-weight:700;flex:0 0 auto}
.fw-pl-row .nm{font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;flex:1;min-width:0}
.fw-pl-row .png{margin-left:auto;flex:0 0 auto;font-family:'JetBrains Mono',monospace;font-size:10.5px;font-weight:700}
.fw-pl-empty{padding:14px 10px;text-align:center;color:rgba(220,235,255,.5);font-size:12px}
`;
    document.head.appendChild(css);

    const btn = document.createElement('button');
    btn.id = 'fwPlayersBtn'; btn.title = 'Players online'; btn.innerHTML = '👥<span class="cnt" id="fwPlayersCnt">0</span>';
    (document.getElementById('hud') || document.body).appendChild(btn);

    const card = document.createElement('div');
    card.id = 'fwPlayersCard';
    card.innerHTML = '<div class="hd"><div class="t">Players Online</div><button class="x" id="fwPlX">×</button></div><div class="bd" id="fwPlBody"></div>';
    document.body.appendChild(card);

    function close() { card.classList.remove('show'); }
    function toggle() { card.classList.toggle('show'); if (card.classList.contains('show')) { try { window.fwRosterReq && window.fwRosterReq(); } catch (_) {} render(); } }
    btn.addEventListener('click', toggle);
    card.querySelector('#fwPlX').addEventListener('click', close);

    function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
    function icon(level, prestige) {
      try {
        if (window.fwPrestige && window.fwPrestige.iconFor) return window.fwPrestige.iconFor(level || 1, prestige || 0, 18);
      } catch (_) {}
      return (prestige > 0) ? '⭐' : '🎖️';
    }

    function pingColor(ms){ return ms <= 0 ? '#9fb3c8' : ms < 90 ? '#5ff09c' : ms < 180 ? '#ffd64d' : '#ff6a6a'; }

    function render() {
      const S = window.State || {};
      const me = (window.FWServer && window.FWServer.you) || null;
      // Use the server's id for "me" if we have it, else fall back to wallet/username
      // so YOU always appear in the list even if the roster hasn't synced yet.
      const meId = (me && me.id) || S.wallet || S.username || '__me__';
      let roster = (window.FWServer && Array.isArray(window.FWServer.roster)) ? window.FWServer.roster.slice() : [];
      if (!roster.some(r => r.id === meId)) {
        roster.push({ id: meId, name: S.username || (me && me.name) || 'You', level: S.level || 1,
          prestige: S.prestige || 0, guildTag: (S.guild && S.guild.tag) || null, ping: 0, self: true });
      }
      const cnt = document.getElementById('fwPlayersCnt');
      if (cnt) cnt.textContent = roster.length;
      if (!card.classList.contains('show')) return;
      const body = document.getElementById('fwPlBody');
      if (!roster.length) { body.innerHTML = '<div class="fw-pl-empty">No one online.</div>'; return; }
      // Sort: me first, then by prestige, then level, then name.
      const list = roster.sort((a, b) =>
        (b.id === meId) - (a.id === meId) ||
        (b.prestige || 0) - (a.prestige || 0) ||
        (b.level || 0) - (a.level || 0) ||
        String(a.name).localeCompare(String(b.name)));
      body.innerHTML = list.map(p => {
        const tag = p.guildTag ? '<span class="tag">[' + esc(p.guildTag) + ']</span>' : '';
        const ms = p.ping | 0;
        const png = '<span class="png" style="color:' + pingColor(ms) + '">' + (ms > 0 ? ms + 'ms' : '—') + '</span>';
        return '<div class="fw-pl-row' + (p.id === meId ? ' me' : '') + '" data-pid="' + esc(p.id) + '" data-self="' + (p.self || p.id === meId ? '1' : '') + '" title="View profile">' +
          '<span class="ico">' + icon(p.level, p.prestige) + '</span>' + tag +
          '<span class="nm">' + esc(p.name) + (p.id === meId ? ' (you)' : '') + '</span>' + png + '</div>';
      }).join('');
      // Click a row → open that player's profile.
      body.querySelectorAll('.fw-pl-row').forEach(row => row.addEventListener('click', () => {
        if (row.dataset.self) { try { window.fwProfile && window.fwProfile.open(); } catch (_) {} return; }
        const pid = row.dataset.pid;
        if (pid && window.fwProfileReq) { showProfileLoading(); window.fwProfileReq(pid); }
      }));
    }

    // ── Other-player profile popup ──
    const ppCss = document.createElement('style');
    ppCss.textContent = `
.fw-pl-row{cursor:pointer}
.fw-pl-row:hover{background:rgba(124,170,255,.14)}
#fwPpBg{position:fixed;inset:0;display:none;align-items:center;justify-content:center;background:rgba(0,0,0,.7);z-index:240;padding:18px}
#fwPpBg.show{display:flex}
#fwPpCard{width:min(380px,94vw);background:linear-gradient(180deg,rgba(10,16,26,.99),rgba(5,9,16,.99));border:2px solid rgba(124,170,255,.5);border-radius:16px;color:#eaf1ff;font-family:'Outfit','Inter',sans-serif;box-shadow:0 24px 60px rgba(0,0,0,.6);overflow:hidden}
#fwPpCard .hd{display:flex;align-items:center;gap:10px;padding:14px 16px;border-bottom:1px solid rgba(124,170,255,.18)}
#fwPpCard .hd .ico{width:26px;height:26px;display:inline-flex;align-items:center;justify-content:center}
#fwPpCard .hd .nm{flex:1;min-width:0;font-family:'Bangers','Orbitron',sans-serif;font-size:20px;letter-spacing:1px;color:#a8c8ff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#fwPpCard .hd .x{background:transparent;border:0;color:rgba(220,235,255,.55);font-size:22px;cursor:pointer;line-height:1}
#fwPpCard .motto{font-style:italic;color:#ffd86e;padding:9px 16px 0;font-size:13px}
#fwPpCard .grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;padding:14px 16px}
#fwPpCard .st{background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);border-radius:10px;padding:9px 10px}
#fwPpCard .st .v{font-family:'Orbitron',sans-serif;font-weight:900;font-size:16px;color:#fff}
#fwPpCard .st .l{font-size:10px;letter-spacing:.5px;text-transform:uppercase;color:rgba(220,235,255,.55);margin-top:2px}
#fwPpCard .wal{padding:0 16px 14px;font-size:10.5px;color:rgba(220,235,255,.5);font-family:'JetBrains Mono',monospace;word-break:break-all}
`;
    document.head.appendChild(ppCss);
    const ppBg = document.createElement('div');
    ppBg.id = 'fwPpBg';
    ppBg.innerHTML = '<div id="fwPpCard"></div>';
    document.body.appendChild(ppBg);
    ppBg.addEventListener('click', e => { if (e.target === ppBg) ppBg.classList.remove('show'); });

    function fmtTime(ms){ const s = Math.floor((ms || 0) / 1000); const h = Math.floor(s / 3600), mn = Math.floor((s % 3600) / 60); return h > 0 ? h + 'h ' + mn + 'm' : mn + 'm'; }
    function fmtNum(n){ return Math.round(n || 0).toLocaleString('en-US'); }
    function stat(v, l){ return '<div class="st"><div class="v">' + v + '</div><div class="l">' + l + '</div></div>'; }
    function showProfileLoading(){
      document.getElementById('fwPpCard').innerHTML = '<div class="hd"><div class="nm">Loading…</div><button class="x" id="fwPpXl">×</button></div><div style="padding:24px;text-align:center;color:rgba(220,235,255,.5)">Fetching stats…</div>';
      document.getElementById('fwPpXl').onclick = () => ppBg.classList.remove('show');
      ppBg.classList.add('show');
    }
    window.fwShowPlayerProfile = function(m){
      const c = document.getElementById('fwPpCard');
      if (!m || !m.found){
        c.innerHTML = '<div class="hd"><div class="nm">No data</div><button class="x" id="fwPpX">×</button></div><div style="padding:20px;text-align:center;color:rgba(220,235,255,.5)">This player has no saved stats yet.</div>';
        document.getElementById('fwPpX').onclick = () => ppBg.classList.remove('show'); ppBg.classList.add('show'); return;
      }
      const s = m.stats || {};
      const ic = (window.fwPrestige && window.fwPrestige.iconFor) ? window.fwPrestige.iconFor(s.level || 1, s.prestige || 0, 26) : '🎖️';
      const wal = m.wallet ? '<div class="wal">🔑 ' + esc(m.wallet) + '</div>' : '';
      const motto = s.motto ? '<div class="motto">“' + esc(s.motto) + '”</div>' : '';
      c.innerHTML =
        '<div class="hd"><span class="ico">' + ic + '</span><div class="nm">' + esc(m.name || 'Printer') + '</div><button class="x" id="fwPpX">×</button></div>' + motto +
        '<div class="grid">' +
          stat(fmtNum(s.pvpKills), 'PvP Kills') + stat(fmtNum(s.mobKills), 'Mob Kills') +
          stat(fmtNum(s.deaths), 'Deaths') + stat(fmtTime(s.playMs), 'Time Played') +
          stat(fmtNum(s.xp), 'XP Earned') + stat(fmtNum(s.brainrotSilver) + ' 🥈', 'Silver Earned') +
        '</div>' + wal;
      document.getElementById('fwPpX').onclick = () => ppBg.classList.remove('show');
      ppBg.classList.add('show');
    };

    // Server pushes a fresh roster every ~5s + on join/leave/meta-change.
    window.fwRenderPlayerList = render;

    console.log('[playerlist] ready — 👥 button installed');
  }
})();
