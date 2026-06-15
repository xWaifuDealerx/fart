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

    // ── demo rival guilds for the leaderboard (until backend) ──
    const RIVALS = [
      { name: 'Skibidi Syndicate', tag: 'SKBD', xp: 18400 },
      { name: 'Gyatt Goblins', tag: 'GYAT', xp: 12750 },
      { name: 'Rizz Republic', tag: 'RIZZ', xp: 9100 },
      { name: 'Sigma Cartel', tag: 'SIGM', xp: 6400 },
    ];

    let pendingLogo = null;   // dataURL chosen in the create form

    function render() {
      const G = State.guild;
      bg.innerHTML =
        '<div class="gd-card">' +
          '<div class="gd-hd">' +
            '<div class="logo" id="gdLogo">' + (G && G.logo ? '<img src="' + G.logo + '"/>' : '🛡️') + '</div>' +
            '<div class="nm"><div class="t">' + (G ? esc(G.name) : 'Guilds') + '</div>' +
              '<div class="s">' + (G ? '[' + esc(G.tag) + '] · Season ' + season() : 'Band together · climb the season board') + '</div></div>' +
            '<button class="x" id="gdX">×</button>' +
          '</div>' +
          (G ? renderMember(G) : renderCreate()) +
        '</div>';
      document.getElementById('gdX').addEventListener('click', close);
      if (G) wireMember(G); else wireCreate();
    }

    function renderCreate() {
      return '<div class="gd-bd">' +
        '<div class="gd-field"><label>Guild Name</label><input type="text" id="gdName" maxlength="24" placeholder="e.g. Fart Lords"/></div>' +
        '<div class="gd-field"><label>Tag (2–5 chars)</label><input type="text" id="gdTag" maxlength="5" placeholder="e.g. FART"/></div>' +
        '<div class="gd-field"><label>Logo</label><div class="gd-logo-pick"><div class="gd-logo-prev" id="gdLogoPrev">🖼️</div>' +
          '<button class="gd-btn ghost" id="gdLogoBtn">Upload logo</button><input type="file" id="gdLogoFile" accept="image/*" style="display:none"/></div></div>' +
        '<div class="gd-cost">Cost to found: <b>' + full(CREATE_COST_SILVER) + ' 🥈</b> or <b>' + goldCost().toFixed(3) + ' 🥇</b> · max ' + MAX_MEMBERS + ' members</div>' +
        '<div class="gd-row"><button class="gd-btn" id="gdCreateS" style="flex:1">Found · 100,000 🥈</button>' +
          '<button class="gd-btn ghost" id="gdCreateG" style="flex:1">Found · ' + goldCost().toFixed(3) + ' 🥇</button></div>' +
        '<div class="gd-note">Cross-player rosters, seasonal GOLD prizes (split by each member’s season XP), and referral auto-join activate once the guild server is live. Your guild is saved locally until then.</div>' +
      '</div>';
    }

    function wireCreate() {
      const fileInput = document.getElementById('gdLogoFile');
      document.getElementById('gdLogoBtn').addEventListener('click', () => fileInput.click());
      fileInput.addEventListener('change', () => {
        const f = fileInput.files && fileInput.files[0]; if (!f) return;
        const rd = new FileReader();
        rd.onload = () => { pendingLogo = rd.result; document.getElementById('gdLogoPrev').innerHTML = '<img src="' + pendingLogo + '"/>'; };
        rd.readAsDataURL(f);
      });
      document.getElementById('gdCreateS').addEventListener('click', () => create('silver'));
      document.getElementById('gdCreateG').addEventListener('click', () => create('gold'));
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
        if ((State.gold || 0) < g) { window.floater?.('Need ' + g.toFixed(3) + ' 🥇', 'bad'); return; }
        State.gold = +(((State.gold || 0) - g).toFixed(6));
      }
      State.guild = {
        name, tag, logo: pendingLogo || null,
        color: PALETTE[Math.floor(Math.random() * PALETTE.length)],
        ownerName: myName(), members: [myName()], xp: 0, myXp: 0,
        season: season(), founded: Date.now(),
      };
      pendingLogo = null;
      window.updateHUD?.(); window.saveState?.();
      window.floater?.('🛡️ Guild "' + name + '" founded!', 'good');
      render();
    }

    function renderMember(G) {
      // reset season XP if a new season started
      if (G.season !== season()) { G.season = season(); G.xp = 0; G.myXp = 0; }
      const held = heldPosts(G);
      const board = RIVALS.concat([{ name: G.name, tag: G.tag, xp: G.xp, me: true }]).sort((a, b) => b.xp - a.xp);
      const lb = board.map((g, i) =>
        '<div class="gd-lb-row' + (g.me ? ' me' : '') + '"><span class="rk">' + (i + 1) + '</span>' +
        '<span class="nm">' + esc(g.name) + ' <span class="tag">[' + esc(g.tag) + ']</span></span>' +
        '<span class="xp">' + full(g.xp) + ' XP</span></div>').join('');
      const postRows = (window.fwGuildPosts || []).map(p =>
        '<div class="pp"><span class="d">' + p.dir + '</span><span>' + p.dir + ' Island Post</span>' +
        '<span class="hold">' + (p.heldByTag ? (p.heldByTag === G.tag ? '✓ yours' : 'rival: ' + esc(p.heldByTag)) : 'unclaimed') + '</span></div>'
      ).join('');
      return '<div class="gd-tabs"><button class="gd-tab on" data-p="home">Overview</button>' +
        '<button class="gd-tab" data-p="board">Leaderboard</button><button class="gd-tab" data-p="posts">Posts</button></div>' +
        '<div class="gd-bd">' +
          '<div class="gd-pane on" id="gdPaneHome">' +
            '<div class="gd-grid">' +
              '<div class="gd-stat"><div class="v">' + full(G.xp) + '</div><div class="l">Season XP</div></div>' +
              '<div class="gd-stat"><div class="v">' + G.members.length + '/' + MAX_MEMBERS + '</div><div class="l">Members</div></div>' +
              '<div class="gd-stat"><div class="v">' + held + '</div><div class="l">Posts Held</div></div>' +
            '</div>' +
            '<div class="gd-note">Owner: <b>' + esc(G.ownerName) + '</b> · Your contribution this season: <b>' + full(G.myXp) + ' XP</b>.<br>' +
            'Hold Guild Posts on the PVP islands to earn <b>+' + POST_XP_MIN + ' guild XP / min</b> each. Top guilds split a GOLD prize pool each season (live when the guild server is online).</div>' +
            '<div class="gd-row"><button class="gd-btn ghost" id="gdInvite" style="flex:1">📨 Copy invite link</button>' +
            '<button class="gd-btn ghost" id="gdLeave" style="flex:1">Leave guild</button></div>' +
          '</div>' +
          '<div class="gd-pane" id="gdPaneBoard">' + lb + '<div class="gd-note">Rival guilds shown are demo data until the guild server is live.</div></div>' +
          '<div class="gd-pane gd-posts" id="gdPanePosts">' + (postRows || '<div class="gd-note">No posts found.</div>') +
            '<div class="gd-note">Walk onto a Post flag at a PVP-island centre to capture it for your guild.</div></div>' +
        '</div>';
    }

    function wireMember(G) {
      bg.querySelectorAll('.gd-tab').forEach(t => t.addEventListener('click', () => {
        bg.querySelectorAll('.gd-tab').forEach(x => x.classList.remove('on'));
        bg.querySelectorAll('.gd-pane').forEach(x => x.classList.remove('on'));
        t.classList.add('on');
        const map = { home: 'Home', board: 'Board', posts: 'Posts' };
        bg.querySelector('#gdPane' + map[t.dataset.p]).classList.add('on');
      }));
      const inv = document.getElementById('gdInvite');
      if (inv) inv.addEventListener('click', () => {
        const code = State.referralCode || (G.tag + '-' + (G.ownerName || ''));
        const link = location.origin + location.pathname + '?guild=' + encodeURIComponent(G.tag) + '&ref=' + encodeURIComponent(code);
        try { navigator.clipboard.writeText(link); window.floater?.('📨 Invite link copied', 'good'); }
        catch (_) { window.floater?.(link, 'good'); }
        // BACKEND TODO: friends who join via this link auto-enroll in the guild if < 100 members.
      });
      const lv = document.getElementById('gdLeave');
      if (lv) lv.addEventListener('click', () => {
        if (!confirm('Leave (and disband your local) guild?')) return;
        // release any posts we held
        (window.fwGuildPosts || []).forEach(p => { if (p.heldByTag === G.tag) { p.heldByTag = null; p.setHolder(null, null); } });
        State.guild = null; window.saveState?.(); render();
      });
    }

    function heldPosts(G) {
      return (window.fwGuildPosts || []).filter(p => p.heldByTag === G.tag).length;
    }

    function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

    // ── Post capture + guild-XP accrual ──
    const POST_XP_MIN = 15;          // guild XP per minute per held post
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
            window.saveState?.();
          }
        }
      }
    }, 1000);

    // public hooks (backend wiring points)
    window.fwGuild = {
      get() { return State.guild; },
      addXp(n) { if (State.guild) { State.guild.xp = (State.guild.xp || 0) + n; State.guild.myXp = (State.guild.myXp || 0) + n; } },
      open,
    };

    // Referral auto-join stub: if the page was opened with ?guild=TAG and the
    // player has no guild, surface a prompt. Real auto-join needs the backend.
    try {
      const q = new URLSearchParams(location.search);
      const gt = q.get('guild');
      if (gt && !State.guild) {
        setTimeout(() => window.floater?.('🛡️ Invited to guild [' + gt + '] — full join unlocks when guilds sync online', 'good'), 4000);
      }
    } catch (_) {}

    console.log('[guild] ready — 🛡 button installed');
  }
})();
