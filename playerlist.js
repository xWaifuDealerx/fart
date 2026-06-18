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
      const meId = me ? me.id : null;
      let roster = (window.FWServer && Array.isArray(window.FWServer.roster)) ? window.FWServer.roster.slice() : [];
      // Always include yourself, even before the first roster broadcast lands.
      if (meId && !roster.some(r => r.id === meId)) {
        roster.push({ id: meId, name: S.username || (me && me.name) || 'You', level: S.level || 1,
          prestige: S.prestige || 0, guildTag: (S.guild && S.guild.tag) || null, ping: 0 });
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
        return '<div class="fw-pl-row' + (p.id === meId ? ' me' : '') + '">' +
          '<span class="ico">' + icon(p.level, p.prestige) + '</span>' + tag +
          '<span class="nm">' + esc(p.name) + (p.id === meId ? ' (you)' : '') + '</span>' + png + '</div>';
      }).join('');
    }

    // Server pushes a fresh roster every ~5s + on join/leave/meta-change.
    window.fwRenderPlayerList = render;

    console.log('[playerlist] ready — 👥 button installed');
  }
})();
