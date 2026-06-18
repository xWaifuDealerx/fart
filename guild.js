// =================================================================
// guild.js — GUILDS (client-side foundation).
//   • Right-side 🛡 Guild button.
//   • Create a guild: name, tag, logo upload. Costs 100,000 🥈 (or the
//     gold equivalent). Max 100 members.
//   • Guild XP: earned passively while your guild HOLDS a Post — the flag
//     at the centre of a PVP island (window.fwGuildPosts). Walk onto an
//     enemy/unclaimed Post to capture it for your guild.
//   • Leaderboard tab ranks guilds by season XP (rivals are demo data
//     until the guild backend is online).
//
//   BACKEND TODO (needs a server / shared DB — not possible client-only):
//     · real cross-player membership + rosters
//     · seasonal GOLD prize payouts split by member XP
//     · referral-link auto-join (owner invites → friend joins if room)
//   These are stubbed where they'd plug in (see fwGuild.* hooks below).
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
    const CREATE_COST_SILVER = 100000;
    const MAX_MEMBERS = 100;
    const PALETTE = [0xff5a8a, 0x5fa8ff, 0x5ff09c, 0xffd64d, 0xc77dff, 0xff8a3d, 0x4dd0e1, 0xff6ad5];

    // guild shape (client): { name, tag, logo, color, ownerName, members, xp, myXp, season, founded }
    function season() { return Math.floor((Date.now() - Date.UTC(2024, 0, 1)) / (7 * 86400000)); } // weekly
    function full(n) { return Math.max(0, Math.floor(n)).toLocaleString('en-US'); }
    function goldCost() {
      const rate = (typeof window.silverPerGold === 'function') ? window.silverPerGold() : 100000;
      return CREATE_COST_SILVER / rate;
    }
    const myName = () => State.username || (window.Net && window.Net.handle) || 'You';

    // ── styles ──
    const css = document.createElement('style');
    css.textContent = `
#fwGuildBtn{position:fixed;top:512px;right:14px;width:42px;height:42px;border-radius:12px;
  background:rgba(8,18,11,.85);border:2px solid rgba(124,170,255,.5);color:#a8c8ff;font-size:20px;
  cursor:pointer;z-index:33;display:flex;align-items:center;justify-content:center;padding:0;pointer-events:auto;
  transition:transform .15s ease,border-color .15s ease,box-shadow .15s ease;box-shadow:0 6px 14px rgba(0,0,0,.35)}
#fwGuildBtn:hover{background:rgba(124,170,255,.16);border-color:#a8c8ff;box-shadow:0 0 16px rgba(124,170,255,.35);transform:scale(1.05)}
.gd-bg{position:fixed;inset:0;display:none;align-items:center;justify-content:center;background:rgba(0,0,0,.78);
  -webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px);z-index:216;padding:18px}
.gd-bg.show{display:flex}
.gd-card{width:min(560px,96vw);max-height:90vh;overflow:auto;background:linear-gradient(180deg,rgba(10,16,26,.98),rgba(5,9,16,.98));
  border:2px solid rgba(124,170,255,.5);border-radius:18px;color:#eaf1ff;font-family:'Outfit','Inter',sans-serif;box-shadow:0 24px 60px rgba(0,0,0,.6)}
.gd-hd{display:flex;align-items:center;gap:13px;padding:16px 20px;border-bottom:1px solid rgba(124,170,255,.18)}
.gd-hd .logo{width:54px;height:54px;flex:0 0 auto;border-radius:12px;background:rgba(124,170,255,.1);border:1px solid rgba(124,170,255,.35);
  display:flex;align-items:center;justify-content:center;font-size:26px;overflow:hidden}
.gd-hd .logo img{width:100%;height:100%;object-fit:cover}
.gd-hd .nm{flex:1;min-width:0}
.gd-hd .nm .t{font-family:'Bangers','Orbitron',sans-serif;font-size:23px;letter-spacing:1px;color:#a8c8ff;line-height:1.05}
.gd-hd .nm .s{font-size:12px;color:rgba(220,235,255,.7);margin-top:2px}
.gd-hd .x{background:transparent;border:0;color:rgba(220,235,255,.55);font-size:26px;cursor:pointer;align-self:flex-start;line-height:1}
.gd-tabs{display:flex;gap:8px;padding:12px 20px 0}
.gd-tab{flex:1;background:rgba(255,255,255,.05);border:1px solid rgba(124,170,255,.3);color:#cfe0ff;border-radius:9px;
  padding:8px 0;font-family:'Outfit',sans-serif;font-weight:800;font-size:12px;cursor:pointer}
.gd-tab.on{background:linear-gradient(135deg,#5fa8ff,#a8c8ff);color:#06122a;border-color:transparent}
.gd-bd{padding:14px 20px 20px}
.gd-pane{display:none}.gd-pane.on{display:block}
.gd-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:6px}
.gd-stat{background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);border-radius:12px;padding:11px 8px;text-align:center}
.gd-stat .v{font-family:'Orbitron',sans-serif;font-weight:900;font-size:18px;color:#fff}
.gd-stat .l{font-size:10px;letter-spacing:.6px;text-transform:uppercase;color:rgba(220,235,255,.55);margin-top:4px}
.gd-field{margin:11px 0}
.gd-field label{display:block;font-size:11px;font-weight:800;letter-spacing:.8px;text-transform:uppercase;color:#a8c8ff;margin-bottom:5px}
.gd-field input[type=text]{width:100%;box-sizing:border-box;background:rgba(0,0,0,.35);border:1px solid rgba(124,170,255,.4);
  border-radius:9px;padding:10px 12px;color:#eaf1ff;font-family:'Outfit',sans-serif;font-size:13px;outline:none}
.gd-logo-pick{display:flex;align-items:center;gap:12px}
.gd-logo-prev{width:56px;height:56px;border-radius:12px;border:1px dashed rgba(124,170,255,.5);display:flex;align-items:center;justify-content:center;font-size:24px;overflow:hidden;background:rgba(124,170,255,.08)}
.gd-logo-prev img{width:100%;height:100%;object-fit:cover}
.gd-btn{background:linear-gradient(135deg,#5fa8ff,#a8c8ff);border:0;border-radius:10px;padding:11px 16px;color:#06122a;
  font-family:'Orbitron',sans-serif;font-weight:900;font-size:12px;letter-spacing:.5px;cursor:pointer}
.gd-btn.ghost{background:rgba(255,255,255,.06);color:#eaf1ff;border:1px solid rgba(124,170,255,.35)}
.gd-row{display:flex;gap:8px;margin-top:10px}
.gd-cost{font-size:12px;color:rgba(220,235,255,.7);margin-top:10px}
.gd-cost b{color:#ffd64d}
.gd-lb-row{display:flex;align-items:center;gap:10px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.07);
  border-radius:10px;padding:8px 11px;margin-bottom:6px;font-size:13px}
.gd-lb-row .rk{font-family:'Orbitron',sans-serif;font-weight:900;color:#ffd64d;width:24px;text-align:center}
.gd-lb-row .nm{flex:1;font-weight:700}.gd-lb-row .nm .tag{color:#a8c8ff;font-family:'JetBrains Mono',monospace;font-size:11px}
.gd-lb-row .xp{font-family:'JetBrains Mono',monospace;color:#5ff09c;font-weight:700}
.gd-lb-row.me{border-color:rgba(95,240,156,.55);box-shadow:0 0 12px rgba(95,240,156,.18)}
.gd-note{font-size:11px;color:rgba(220,235,255,.45);margin-top:10px;line-height:1.5}
.gd-posts .pp{display:flex;align-items:center;gap:8px;font-size:12.5px;margin:5px 0}
.gd-posts .pp .d{width:22px;height:22px;border-radius:6px;display:flex;align-items:center;justify-content:center;background:rgba(124,170,255,.12);font-weight:800;font-size:11px}
.gd-posts .pp .hold{margin-left:auto;font-family:'JetBrains Mono',monospace;font-size:11px}
.gd-territory{background:rgba(95,240,156,.08);border:1px solid rgba(95,240,156,.35);border-radius:10px;padding:10px 12px;margin-bottom:10px;font-size:13px;color:#eafff1}
.gd-territory b{color:#5ff09c}
.gd-territory .t2{font-size:11px;color:rgba(220,235,255,.6);margin-top:4px;line-height:1.5}
`;
    document.head.appendChild(css);

    const btn = document.createElement('button');
    btn.id = 'fwGuildBtn'; btn.title = 'Guild'; btn.textContent = '🛡️';
    (document.getElementById('hud') || document.body).appendChild(btn);

    const bg = document.createElement('div');
    bg.className = 'gd-bg';
    document.body.appendChild(bg);
    bg.addEventListener('click', (e) => { if (e.target === bg) close(); });

    function close() { bg.classList.remove('show'); }
    function open() { render(); bg.classList.add('show'); try { document.exitPointerLock?.(); } catch (_) {} }
    btn.addEventListener('click', open);

    // Guild rankings are now REAL-ONLY — fed by the server's shared guild
    // table (via window.fwApplyServerGuilds) plus your own guild. No demo
    // rivals; an empty board just means no guilds have formed yet.
    const RIVALS = [];
    const SEASON_POOL_GOLD = 100;   // total GOLD split among the top 10 guilds by season XP

    // pending invites you've received (real invites land here)
    if (!Array.isArray(State.guildInvites)) State.guildInvites = [];

    let pendingLogo = null;     // dataURL chosen in the create form
    let createPublic = true;    // public vs invite-only toggle in the create form

    // ── server-synced guilds (authoritative, pushed from the game server via
    // window.fwApplyServerGuilds). Real guilds override the demo RIVALS. ──
    let SERVER_GUILDS = [];
    window.fwApplyServerGuilds = function (list) {
      SERVER_GUILDS = Array.isArray(list) ? list.map(g => ({
        name: g.name, tag: g.tag, xp: g.xp || 0, season: g.season || 0,
        members: Array.isArray(g.members) ? g.members.length : (g.members || 1),
        public: !!g.public, logo: g.logo || null, color: g.color || 0, owner: g.owner || null,
      })) : [];
      // Keep my own guild's live numbers in sync with the authoritative record.
      const G = State.guild;
      if (G) {
        const mine = SERVER_GUILDS.find(s => s.tag === G.tag);
        if (mine) { G.xp = mine.xp; G._memberCount = mine.members; }
      }
      if (bg.classList.contains('show')) render();
    };

    function allGuilds() {
      const G = State.guild;
      // Real (server) guilds take precedence; demo rivals only fill tags the
      // server hasn't got yet, so the board isn't empty before launch.
      const byTag = new Map();
      for (const r of RIVALS) byTag.set(r.tag, Object.assign({}, r));
      for (const s of SERVER_GUILDS) byTag.set(s.tag, Object.assign({}, s));
      const list = [...byTag.values()];
      if (G) {
        const ex = list.find(x => x.tag === G.tag);
        if (ex) { ex.me = true; ex.xp = G.xp || ex.xp || 0; ex.name = G.name; ex.public = !!G.public; ex.members = (G.members || []).length || G._memberCount || ex.members; }
        else list.push({ name: G.name, tag: G.tag, xp: G.xp || 0, members: (G.members || []).length || 1, public: !!G.public, me: true });
      }
      return list.sort((a, b) => (b.xp || 0) - (a.xp || 0));
    }
    function withGold(list) {
      const sum = list.slice(0, 10).reduce((a, g) => a + Math.max(0, g.xp || 0), 0) || 1;
      list.forEach((g, i) => { g.gold = i < 10 ? (SEASON_POOL_GOLD * (Math.max(0, g.xp || 0) / sum)) : 0; });
      return list;
    }

    function render() {
      const G = State.guild;
      const tabs = G
        ? [['home', 'Overview'], ['rank', 'Rankings'], ['posts', 'Posts'], ['invites', 'Invites']]
        : [['browse', 'Guilds'], ['create', 'Create'], ['invites', 'Invites']];
      let cur = (render._tab && tabs.some(t => t[0] === render._tab)) ? render._tab : tabs[0][0];
      render._tab = cur;
      let pane = '';
      if (cur === 'home') pane = paneHome(G);
      else if (cur === 'rank' || cur === 'browse') pane = paneRankings(G);
      else if (cur === 'posts') pane = panePosts(G);
      else if (cur === 'create') pane = paneCreate();
      else if (cur === 'invites') pane = paneInvites();
      const invN = State.guildInvites.length;
      bg.innerHTML =
        '<div class="gd-card">' +
          '<div class="gd-hd">' +
            '<div class="logo">' + (G && G.logo ? '<img src="' + G.logo + '"/>' : '🛡️') + '</div>' +
            '<div class="nm"><div class="t">' + (G ? esc(G.name) : 'Guilds') + '</div>' +
              '<div class="s">' + (G ? '[' + esc(G.tag) + '] · ' + (G.public ? '🌐 Public' : '🔒 Invite-only') + ' · Season ' + season() : 'Join or found a guild · climb the season board') + '</div></div>' +
            '<button class="x" id="gdX">×</button>' +
          '</div>' +
          '<div class="gd-tabs">' + tabs.map(t => '<button class="gd-tab' + (t[0] === cur ? ' on' : '') + '" data-t="' + t[0] + '">' + t[1] + (t[0] === 'invites' && invN ? ' (' + invN + ')' : '') + '</button>').join('') + '</div>' +
          '<div class="gd-bd">' + pane + '</div>' +
        '</div>';
      wireAll(G);
    }

    // ── panes ──
    function paneHome(G) {
      if (G.season !== season()) { G.season = season(); G.xp = 0; G.myXp = 0; }
      const held = heldPosts(G);
      const owner = G.ownerName === myName();
      return '<div class="gd-grid">' +
          '<div class="gd-stat"><div class="v">' + full(G.xp) + '</div><div class="l">Season XP</div></div>' +
          '<div class="gd-stat"><div class="v">' + (G.members || []).length + '/' + MAX_MEMBERS + '</div><div class="l">Members</div></div>' +
          '<div class="gd-stat"><div class="v">' + held + '</div><div class="l">Posts Held</div></div>' +
        '</div>' +
        '<div class="gd-note">Owner: <b>' + esc(G.ownerName) + '</b> · Your season contribution: <b>' + full(G.myXp) + ' XP</b>.<br>' +
        'Hold Guild Posts on the PVP islands for <b>+' + POST_XP_MIN + ' guild XP / min</b> each. Top 10 guilds split <b>' + SEASON_POOL_GOLD + ' 🪙</b> at season end, by share of XP.</div>' +
        (owner ? ('<div class="gd-field" style="margin-top:6px"><label>Invite a member (username or Solana address)</label>' +
          '<div class="gd-row" style="margin-top:0"><input type="text" id="gdInviteTarget" placeholder="username or So1ana…addr"/>' +
          '<button class="gd-btn" id="gdInviteSend">Invite</button></div></div>') : '') +
        '<div class="gd-row"><button class="gd-btn ghost" id="gdLink" style="flex:1">📨 Copy invite link</button>' +
        '<button class="gd-btn ghost" id="gdLeave" style="flex:1">Leave guild</button></div>';
    }

    function paneRankings(G) {
      const list = withGold(allGuilds());
      const rows = list.map((g, i) =>
        '<div class="gd-lb-row' + (g.me ? ' me' : '') + '"><span class="rk">' + (i + 1) + '</span>' +
        '<span class="nm">' + esc(g.name) + ' <span class="tag">[' + esc(g.tag) + ']</span>' +
          '<div style="font-size:10.5px;color:rgba(220,235,255,.55)">' + (g.public ? '🌐 public' : '🔒 invite-only') + ' · ' + (g.members || 1) + ' members</div></span>' +
        '<span class="xp">' + full(g.xp) + ' XP<div style="font-size:10.5px;color:#ffd64d;text-align:right">' + (g.gold > 0 ? '~' + g.gold.toFixed(2) + ' 🪙' : '—') + '</div></span>' +
        (!G && g.public ? '<button class="gd-btn" data-join="' + esc(g.tag) + '" style="margin-left:8px;padding:6px 12px">Join</button>'
          : (!G && !g.public ? '<span style="margin-left:8px;font-size:16px" title="invite-only">🔒</span>' : '')) +
        '</div>').join('');
      const emptyNote = list.length ? '' : '<div class="gd-note">No guilds yet — found the first one and top the board!</div>';
      return rows + emptyNote + '<div class="gd-note">Season prize: top 10 guilds share <b>' + SEASON_POOL_GOLD + ' 🪙</b> in proportion to season XP. Public guilds can be joined here; invite-only ones need an invite.</div>';
    }

    function panePosts(G) {
      const postRows = (window.fwGuildPosts || []).map(p =>
        '<div class="pp"><span class="d">' + p.dir + '</span><span>' + p.dir + ' Island Post</span>' +
        '<span class="hold">' + (p.heldByTag ? (p.heldByTag === G.tag ? '✓ yours' : 'rival: ' + esc(p.heldByTag)) : 'unclaimed') + '</span></div>'
      ).join('');
      const held = heldPosts(G);
      const bonusPct = Math.round(held * TERRITORY_BONUS_PER_POST * 100);
      const banner = '<div class="gd-territory">⚑ Territory bonus: <b>+' + bonusPct + '% brainrot silver</b>' +
        '<div class="t2">' + held + ' / ' + (window.fwGuildPosts || []).length + ' posts held · each Post you hold gives <b>+' + Math.round(TERRITORY_BONUS_PER_POST * 100) + '%</b> to your brainrot base earnings</div></div>';
      return '<div class="gd-posts">' + banner + (postRows || '<div class="gd-note">No posts found.</div>') +
        '<div class="gd-note">Capture a Post by standing at the flag at a PVP-island centre for 30s. While your guild holds it you earn <b>+' + POST_XP_MIN + ' guild XP/min</b> AND the territory yield bonus above — so Posts pay off in silver, not just XP.</div></div>';
    }

    function paneCreate() {
      return '<div class="gd-field"><label>Guild Name</label><input type="text" id="gdName" maxlength="24" placeholder="e.g. Fart Lords"/></div>' +
        '<div class="gd-field"><label>Tag (2–5 chars)</label><input type="text" id="gdTag" maxlength="5" placeholder="e.g. FART"/></div>' +
        '<div class="gd-field"><label>Logo</label><div class="gd-logo-pick"><div class="gd-logo-prev" id="gdLogoPrev">' + (pendingLogo ? '<img src="' + pendingLogo + '"/>' : '🖼️') + '</div>' +
          '<button class="gd-btn ghost" id="gdLogoBtn">Upload logo</button><input type="file" id="gdLogoFile" accept="image/*" style="display:none"/></div></div>' +
        '<div class="gd-field"><label>Membership</label><div class="gd-row" style="margin-top:0">' +
          '<button class="gd-btn' + (createPublic ? '' : ' ghost') + '" id="gdPubOn" style="flex:1">🌐 Public</button>' +
          '<button class="gd-btn' + (createPublic ? ' ghost' : '') + '" id="gdPubOff" style="flex:1">🔒 Invite-only</button></div>' +
          '<div class="gd-note" style="margin-top:6px">' + (createPublic ? 'Anyone can join from the rankings.' : 'Only invited players can join.') + '</div></div>' +
        '<div class="gd-cost">Cost to found: <b>' + full(CREATE_COST_SILVER) + ' 🥈</b> or <b>' + goldCost().toFixed(3) + ' 🪙</b> · max ' + MAX_MEMBERS + ' members</div>' +
        '<div class="gd-row"><button class="gd-btn" id="gdCreateS" style="flex:1">Found · 100,000 🥈</button>' +
          '<button class="gd-btn ghost" id="gdCreateG" style="flex:1">Found · ' + goldCost().toFixed(3) + ' 🪙</button></div>';
    }

    function paneInvites() {
      if (!State.guildInvites.length) return '<div class="gd-note">No pending invites. A guild owner can invite you by your username or Solana address.</div>';
      return State.guildInvites.map((inv, i) =>
        '<div class="gd-lb-row"><span class="nm">' + esc(inv.name) + ' <span class="tag">[' + esc(inv.tag) + ']</span></span>' +
        '<button class="gd-btn" data-acc="' + i + '" style="padding:6px 12px">Accept</button>' +
        '<button class="gd-btn ghost" data-dec="' + i + '" style="padding:6px 10px;margin-left:6px">✕</button></div>'
      ).join('') + '<div class="gd-note">You can only be in one guild at a time — accepting leaves your current guild.</div>';
    }

    // ── wiring (single delegated pass after each render) ──
    function wireAll(G) {
      document.getElementById('gdX').addEventListener('click', close);
      bg.querySelectorAll('.gd-tab').forEach(t => t.addEventListener('click', () => { render._tab = t.dataset.t; render(); }));
      const fileInput = document.getElementById('gdLogoFile');
      if (fileInput) {
        document.getElementById('gdLogoBtn').addEventListener('click', () => fileInput.click());
        fileInput.addEventListener('change', () => {
          const f = fileInput.files && fileInput.files[0]; if (!f) return;
          const rd = new FileReader();
          rd.onload = () => { pendingLogo = rd.result; const pv = document.getElementById('gdLogoPrev'); if (pv) pv.innerHTML = '<img src="' + pendingLogo + '"/>'; };
          rd.readAsDataURL(f);
        });
      }
      const pubOn = document.getElementById('gdPubOn'); if (pubOn) pubOn.addEventListener('click', () => { createPublic = true; render(); });
      const pubOff = document.getElementById('gdPubOff'); if (pubOff) pubOff.addEventListener('click', () => { createPublic = false; render(); });
      const cs = document.getElementById('gdCreateS'); if (cs) cs.addEventListener('click', () => create('silver'));
      const cg = document.getElementById('gdCreateG'); if (cg) cg.addEventListener('click', () => create('gold'));
      bg.querySelectorAll('[data-join]').forEach(b => b.addEventListener('click', () => joinByTag(b.getAttribute('data-join'))));
      bg.querySelectorAll('[data-acc]').forEach(b => b.addEventListener('click', () => acceptInvite(+b.getAttribute('data-acc'))));
      bg.querySelectorAll('[data-dec]').forEach(b => b.addEventListener('click', () => { State.guildInvites.splice(+b.getAttribute('data-dec'), 1); render(); }));
      const link = document.getElementById('gdLink');
      if (link && G) link.addEventListener('click', () => {
        const code = State.referralCode || (G.tag + '-' + (G.ownerName || ''));
        const url = location.origin + location.pathname + '?guild=' + encodeURIComponent(G.tag) + '&ref=' + encodeURIComponent(code);
        try { navigator.clipboard.writeText(url); window.floater?.('📨 Invite link copied', 'good'); } catch (_) { window.floater?.(url, 'good'); }
      });
      const sendInv = document.getElementById('gdInviteSend');
      if (sendInv) sendInv.addEventListener('click', () => {
        const tgt = (document.getElementById('gdInviteTarget').value || '').trim();
        if (!tgt) { window.floater?.('Enter a username or Solana address', 'bad'); return; }
        document.getElementById('gdInviteTarget').value = '';
        // BACKEND TODO: deliver the invite to that player's account when guilds sync online.
        window.floater?.('📨 Invite sent to ' + tgt + ' (delivered when guilds sync online)', 'good');
      });
      const lv = document.getElementById('gdLeave');
      if (lv && G) lv.addEventListener('click', () => {
        if (!confirm('Leave your guild?')) return;
        (window.fwGuildPosts || []).forEach(p => { if (p.heldByTag === G.tag) { p.heldByTag = null; p.setHolder(null, null); } });
        window.fwServerGuild?.('leave', { tag: G.tag });
        State.guild = null; window.saveState?.(); render._tab = 'browse'; render();
      });
    }

    function create(pay) {
      const name = (document.getElementById('gdName').value || '').trim().slice(0, 24);
      const tag = (document.getElementById('gdTag').value || '').trim().toUpperCase().slice(0, 5);
      if (name.length < 3) { window.floater?.('Guild name too short', 'bad'); return; }
      if (tag.length < 2) { window.floater?.('Tag needs 2–5 characters', 'bad'); return; }
      if (pay === 'silver') {
        if ((State.credits || 0) < CREATE_COST_SILVER) { window.floater?.('Need 100,000 🥈', 'bad'); return; }
        State.credits -= CREATE_COST_SILVER;
      } else {
        const g = goldCost();
        if ((State.gold || 0) < g) { window.floater?.('Need ' + g.toFixed(3) + ' 🪙', 'bad'); return; }
        State.gold = +(((State.gold || 0) - g).toFixed(6));
        try { window.fwGoldSpendServer && window.fwGoldSpendServer(g); } catch (_) {}   // sync ledger
      }
      State.guild = {
        name, tag, logo: pendingLogo || null, public: createPublic,
        color: PALETTE[Math.floor(Math.random() * PALETTE.length)],
        ownerName: myName(), members: [myName()], xp: 0, myXp: 0,
        season: season(), founded: Date.now(),
      };
      // Register the guild on the authoritative server (cross-player table).
      window.fwServerGuild?.('create', {
        tag: State.guild.tag, name: State.guild.name, public: State.guild.public,
        logo: State.guild.logo, color: State.guild.color, season: State.guild.season,
      });
      pendingLogo = null;
      window.updateHUD?.(); window.saveState?.();
      window.floater?.('🛡️ Guild "' + name + '" founded!', 'good');
      render._tab = 'home'; render();
    }

    function joinByTag(tag) {
      if (State.guild) { window.floater?.('Leave your current guild first', 'bad'); return; }
      const g = allGuilds().find(r => r.tag === tag);
      if (!g) return;
      if (!g.public) { window.floater?.('That guild is invite-only', 'bad'); return; }
      if ((g.members || 0) >= MAX_MEMBERS) { window.floater?.('That guild is full (100/100)', 'bad'); return; }
      // Tell the server to add us to this guild's roster (public guilds only).
      window.fwServerGuild?.('join', { tag: g.tag });
      joinGuildObj(g);
    }

    function acceptInvite(i) {
      const inv = State.guildInvites[i]; if (!inv) return;
      const g = RIVALS.find(r => r.tag === inv.tag) || { name: inv.name, tag: inv.tag, members: 1, xp: 0, public: false };
      State.guildInvites.splice(i, 1);
      joinGuildObj(g, true);
    }

    function joinGuildObj(g, viaInvite) {
      State.guild = {
        name: g.name, tag: g.tag, logo: null, public: !!g.public,
        color: PALETTE[Math.floor(Math.random() * PALETTE.length)],
        ownerName: g.name + ' (owner)', members: new Array((g.members || 1) + 1).fill('m'),
        xp: g.xp || 0, myXp: 0, season: season(), founded: Date.now(), joined: true,
      };
      window.saveState?.();
      window.floater?.('🛡️ Joined ' + g.name + (viaInvite ? ' via invite' : '') + '!', 'good');
      render._tab = 'home'; render();
    }

    function heldPosts(G) {
      return (window.fwGuildPosts || []).filter(p => p.heldByTag === G.tag).length;
    }

    function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

    // ── Post capture + guild-XP accrual ──
    const POST_XP_MIN = 15;          // guild XP per minute per held post
    const TERRITORY_BONUS_PER_POST = 0.05;   // +5% brainrot silver per Post your guild holds
    const CAPTURE_MS = 30000;        // stand next to a post 30s to capture it
    const NEAR = 6;                  // capture radius
    let captureProg = new WeakMap();
    let xpAcc = 0;

    // on-screen capture prompt
    const capCss = document.createElement('style');
    capCss.textContent = `
#gdCapPrompt{position:fixed;left:50%;bottom:240px;transform:translateX(-50%);display:none;z-index:55;min-width:220px;
  background:rgba(8,14,26,.93);border:2px solid rgba(124,170,255,.6);border-radius:12px;padding:9px 16px;
  color:#eaf1ff;font-family:'Outfit','Inter',sans-serif;font-weight:700;font-size:13px;text-align:center;pointer-events:none;
  box-shadow:0 8px 20px rgba(0,0,0,.5)}
#gdCapPrompt.show{display:block}
#gdCapPrompt.warn{border-color:rgba(255,206,74,.7);color:#ffd64d}
#gdCapPrompt .bar{height:6px;background:rgba(124,170,255,.2);border-radius:4px;margin-top:7px;overflow:hidden}
#gdCapPrompt .bar i{display:block;height:100%;background:linear-gradient(90deg,#5fa8ff,#a8c8ff)}
`;
    document.head.appendChild(capCss);
    const capPrompt = document.createElement('div');
    capPrompt.id = 'gdCapPrompt';
    document.body.appendChild(capPrompt);

    setInterval(() => {
      const G = State.guild;
      const posts = window.fwGuildPosts || [];
      const Pl = window.Player;
      if (!Pl || !Pl.pos) { capPrompt.classList.remove('show'); return; }

      // nearest post within range
      let near = null, nd = 1e9;
      for (const p of posts) {
        const d = Math.hypot(Pl.pos.x - p.x, Pl.pos.z - p.z);
        if (d < NEAR && d < nd) { nd = d; near = p; }
      }
      // reset progress on any post you're not standing at
      for (const p of posts) if (p !== near) captureProg.set(p, 0);

      if (near) {
        if (!G) {
          capPrompt.className = 'warn show';
          capPrompt.innerHTML = '🛡️ Join a guild to capture this flag';
        } else if (near.heldByTag === G.tag) {
          capPrompt.className = 'show';
          capPrompt.innerHTML = '⚑ Your guild holds the ' + near.dir + ' Post';
        } else {
          const t = (captureProg.get(near) || 0) + 1000;
          captureProg.set(near, t);
          if (t >= CAPTURE_MS) {
            near.heldByTag = G.tag;
            near.setHolder(G.tag, G.color, G.logo);
            captureProg.set(near, 0);
            capPrompt.classList.remove('show');
            // Sync the capture so every player sees this guild hold the flag.
            try { window.fwFlagCapture && window.fwFlagCapture(near.dir, G.tag, G.color || 0, G.logo || null); } catch (_) {}
            window.floater?.('⚑ Captured the ' + near.dir + ' Guild Post for [' + G.tag + ']!', 'good');
          } else {
            const rem = Math.ceil((CAPTURE_MS - t) / 1000);
            capPrompt.className = 'show';
            capPrompt.innerHTML = '⚑ Capturing ' + near.dir + ' Post… ' + rem + 's' +
              '<div class="bar"><i style="width:' + Math.round(t / CAPTURE_MS * 100) + '%"></i></div>';
          }
        }
      } else {
        capPrompt.classList.remove('show');
      }

      // accrue guild XP for held posts
      if (G) {
        const held = heldPosts(G);
        if (held > 0) {
          xpAcc += 1000;
          if (xpAcc >= 60000) {
            xpAcc = 0;
            const gain = POST_XP_MIN * held;
            G.xp = (G.xp || 0) + gain;
            G.myXp = (G.myXp || 0) + gain;
            window.fwServerGuild?.('addxp', { tag: G.tag, xp: gain });
            window.saveState?.();
          }
        }
      }
    }, 1000);

    // public hooks (backend wiring points)
    window.fwGuild = {
      get() { return State.guild; },
      addXp(n) { if (State.guild) { State.guild.xp = (State.guild.xp || 0) + n; State.guild.myXp = (State.guild.myXp || 0) + n; window.fwServerGuild?.('addxp', { tag: State.guild.tag, xp: n }); } },
      open,
    };
    // Territory yield bonus — fraction added to your brainrot silver while your
    // guild holds Posts (brainrot.js multiplies its yield by 1 + this).
    window.fwGuildTerritoryBonus = function () {
      const G = State.guild;
      return G ? heldPosts(G) * TERRITORY_BONUS_PER_POST : 0;
    };

    // Server-authoritative flag holders: apply who holds each PVP-island Post
    // so every player sees the same flags (fed by the server 'flags' broadcast).
    window.fwApplyFlags = function (list) {
      const posts = window.fwGuildPosts || [];
      // Posts (pvpzone.js) may not be built yet when the welcome snapshot lands —
      // stash and retry shortly so initial flag ownership isn't lost.
      if (!posts.length) {
        window._fwPendingFlags = list || [];
        setTimeout(() => { if ((window.fwGuildPosts || []).length) window.fwApplyFlags(window._fwPendingFlags || []); }, 1500);
        return;
      }
      const byDir = {};
      for (const e of (list || [])) if (e && e.dir) byDir[e.dir] = e;
      for (const p of posts) {
        const e = byDir[p.dir];
        if (e && e.tag) { p.heldByTag = e.tag; try { p.setHolder(e.tag, e.color || 0, e.logo || null); } catch (_) {} }
        else if (p.heldByTag) { p.heldByTag = null; try { p.setHolder(null, null); } catch (_) {} }
      }
      try { if (bg.classList.contains('show')) render(); } catch (_) {}
    };

    // Referral link: ?guild=TAG drops a pending invite into the Invites tab.
    // (True auto-join on referral needs the backend; this lets you accept it.)
    try {
      const q = new URLSearchParams(location.search);
      const gt = q.get('guild');
      if (gt && !State.guild && !State.guildInvites.some(iv => iv.tag === gt)) {
        const r = RIVALS.find(x => x.tag === gt);
        State.guildInvites.push({ name: r ? r.name : ('Guild ' + gt), tag: gt });
        setTimeout(() => window.floater?.('🛡️ Guild invite from [' + gt + '] — accept it in the Guild ▸ Invites tab', 'good'), 4000);
      }
    } catch (_) {}

    console.log('[guild] ready — 🛡 button installed');
  }
})();
