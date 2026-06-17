// ============================================================================
// dailyhub.js — two retention features, fully self-contained:
//   1) DAILY STREAK + CRATE  — a once-per-day login reward. Escalating silver,
//      a Trucker Cap on every 7-day milestone. The popup is DELAYED and only
//      shows when no other modal/lobby is open, so it never collides with the
//      tutorial, username prompt, shops, missions, etc.
//   2) TOWN LEADERBOARD BOARD — a physical board in town. Walk up, press E,
//      and see the live rankings of you vs the printer-bots and rival names.
//
//   Everything here uses unique  fw-daily-* / fw-board-*  class names and its
//   own z-index band so it can't clash with existing UI.
// ============================================================================
(function () {
  'use strict';

  function whenReady() {
    if (!window.THREE || !window.scene || !window.camera || !window.Player ||
        !window.State || !window.groundHeightAt) {
      setTimeout(whenReady, 600);
      return;
    }
    try { init(); } catch (e) { console.error('[dailyhub] init failed', e); }
  }
  whenReady();

  function init() {
    const THREE = window.THREE;
    const scene = window.scene;
    const Player = window.Player;
    const State = window.State;
    const gH = window.groundHeightAt;

    // ── shared CSS (unique class names + own z-index band) ──
    const css = document.createElement('style');
    css.textContent = `
.fw-daily-bg{position:fixed;inset:0;display:none;align-items:center;justify-content:center;z-index:300;
  background:rgba(0,0,0,.72);-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px);padding:18px}
.fw-daily-bg.show{display:flex}
.fw-daily{width:min(360px,92vw);background:linear-gradient(180deg,rgba(12,24,14,.98),rgba(6,14,8,.98));
  border:2px solid rgba(255,206,74,.55);border-radius:18px;padding:22px 22px 18px;color:#fff1c2;
  font-family:'Outfit','Inter',sans-serif;text-align:center;box-shadow:0 20px 50px rgba(0,0,0,.6);
  animation:fwDailyIn .4s cubic-bezier(.2,.7,.4,1)}
@keyframes fwDailyIn{from{transform:scale(.85);opacity:0}to{transform:scale(1);opacity:1}}
.fw-daily h2{font-family:'Bangers','Orbitron',sans-serif;font-size:26px;color:#ffd64d;letter-spacing:1.6px;margin:0 0 4px}
.fw-daily .streak{font-size:13px;color:#5ff09c;font-weight:800;margin-bottom:12px;letter-spacing:.5px}
.fw-daily .dots{display:flex;justify-content:center;gap:6px;margin-bottom:14px}
.fw-daily .dot{width:22px;height:22px;border-radius:50%;display:flex;align-items:center;justify-content:center;
  font-size:11px;font-weight:800;border:1px solid rgba(255,206,74,.35);color:rgba(230,255,238,.5);background:rgba(255,255,255,.03)}
.fw-daily .dot.on{background:linear-gradient(135deg,#5ff09c,#2ee06b);color:#06160b;border-color:#5ff09c}
.fw-daily .dot.mil{border-color:#ffd64d}
.fw-daily .reward{background:rgba(255,206,74,.08);border:1px solid rgba(255,206,74,.32);border-radius:12px;
  padding:12px;margin-bottom:14px;font-size:14px;font-weight:700}
.fw-daily .reward b{color:#ffd64d}
.fw-daily .go{background:linear-gradient(135deg,#5ff09c,#2ee06b);color:#04140a;border:0;padding:11px 26px;
  border-radius:100px;font-family:'Orbitron',sans-serif;font-weight:900;font-size:13px;text-transform:uppercase;
  letter-spacing:.8px;cursor:pointer;box-shadow:0 8px 20px rgba(46,224,107,.35)}
.fw-daily .go:hover{transform:translateY(-1px)}
.fw-daily .later{display:block;margin:10px auto 0;background:none;border:0;color:rgba(230,255,238,.5);font-size:11px;cursor:pointer}

.fw-board-prompt{position:fixed;top:96px;left:50%;transform:translateX(-50%);z-index:53;display:none;
  background:linear-gradient(180deg,rgba(8,18,11,.95),rgba(5,14,9,.95));border:2px solid rgba(255,206,74,.5);
  border-radius:12px;padding:8px 16px;color:#fff1c2;font-family:'Outfit','Inter',sans-serif;font-size:13px;
  text-align:center;pointer-events:none;box-shadow:0 10px 22px rgba(0,0,0,.45)}
.fw-board-prompt .k{background:rgba(255,206,74,.2);border:1px solid rgba(255,206,74,.55);color:#ffd64d;
  padding:1px 8px;border-radius:6px;font-family:monospace;font-weight:700;margin-right:5px}
.fw-board-bg{position:fixed;inset:0;display:none;align-items:center;justify-content:center;z-index:210;
  background:rgba(0,0,0,.7);-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px);padding:18px}
.fw-board-bg.show{display:flex}
.fw-board{width:min(440px,94vw);max-height:84vh;overflow:hidden;display:flex;flex-direction:column;
  background:linear-gradient(180deg,rgba(10,22,14,.98),rgba(6,14,8,.98));border:2px solid rgba(255,206,74,.5);
  border-radius:18px;color:#fff1c2;font-family:'Outfit','Inter',sans-serif}
.fw-board .hd{display:flex;justify-content:space-between;align-items:center;padding:15px 20px;border-bottom:1px solid rgba(255,206,74,.18)}
.fw-board .hd h2{font-family:'Bangers','Orbitron',sans-serif;font-size:22px;color:#ffd64d;letter-spacing:1.6px;margin:0}
.fw-board .hd .x{background:none;border:0;color:rgba(230,255,238,.6);font-size:22px;cursor:pointer}
.fw-board .bd{padding:10px 16px 16px;overflow-y:auto}
.fw-board .row{display:flex;align-items:center;gap:10px;padding:9px 10px;border-top:1px solid rgba(255,255,255,.06);font-size:13px}
.fw-board .row:first-child{border-top:none}
.fw-board .row.you{background:rgba(95,240,156,.10);border-radius:9px}
.fw-board .rk{width:26px;color:#ffd64d;font-weight:800;text-align:center}
.fw-board .nm{flex:1;font-weight:700}
.fw-board .row.you .nm{color:#5ff09c}
.fw-board .br{font-size:11px;color:rgba(230,255,238,.6);font-family:'JetBrains Mono',monospace}
.fw-board .sv{color:#ffe9b0;font-family:'JetBrains Mono',monospace;font-weight:700;white-space:nowrap}
.fw-board .foot{font-size:10.5px;color:rgba(230,255,238,.45);text-align:center;padding:4px 0 2px}
`;
    document.head.appendChild(css);

    // ════════════════════════════════════════════════════════════════
    //  1) DAILY STREAK + CRATE
    // ════════════════════════════════════════════════════════════════
    const DKEY = 'fw.daily.v1';
    let D = { last: '', streak: 0 };
    try { D = Object.assign(D, JSON.parse(localStorage.getItem(DKEY) || '{}')); } catch (_) {}
    function dsave() { try { localStorage.setItem(DKEY, JSON.stringify(D)); } catch (_) {} }
    function dayStr(ms) { const d = new Date(ms == null ? Date.now() : ms); return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); }
    const today = dayStr(), yday = dayStr(Date.now() - 86400000);

    function rewardFor(streak) {
      return Math.min(1500, 150 + streak * 100);
    }

    const dBg = document.createElement('div');
    dBg.className = 'fw-daily-bg';
    document.body.appendChild(dBg);

    let pendingClaim = null;   // {streak, silver, milestone} while the crate is up
    function buildCrate() {
      const nextStreak = (D.last === yday) ? D.streak + 1 : 1;
      const silver = rewardFor(nextStreak);
      const milestone = (nextStreak % 7 === 0);
      // 7-dot streak strip
      let dots = '';
      for (let i = 1; i <= 7; i++) {
        const within = ((nextStreak - 1) % 7) + 1;
        const on = i <= within;
        dots += '<div class="dot' + (on ? ' on' : '') + (i === 7 ? ' mil' : '') + '">' + (i === 7 ? '🎁' : i) + '</div>';
      }
      dBg.innerHTML =
        '<div class="fw-daily">' +
          '<h2>🎁 Daily Crate</h2>' +
          '<div class="streak">🔥 ' + nextStreak + '-DAY STREAK</div>' +
          '<div class="dots">' + dots + '</div>' +
          '<div class="reward">Today\'s reward: <b>+' + silver + ' 🥈 Silver</b>' +
            (milestone ? '<br><b>+ a Trucker Cap 🧢</b> (7-day milestone!)' : '') + '</div>' +
          '<button class="go" id="fwDailyClaim">Claim</button>' +
          '<div style="font-size:11px;color:rgba(230,255,238,.55);margin-top:10px;letter-spacing:.4px">Press <b style="color:#ffd64d">Enter</b> to claim &amp; continue</div>' +
        '</div>';
      pendingClaim = { streak: nextStreak, silver: silver, milestone: milestone };
      dBg.querySelector('#fwDailyClaim').addEventListener('click', () => claimDaily(nextStreak, silver, milestone));
    }
    // Enter claims the daily crate & continues.
    window.addEventListener('keydown', (e) => {
      if (!dBg.classList.contains('show')) return;
      if (e.code === 'Enter' || e.code === 'NumpadEnter') {
        e.preventDefault(); e.stopImmediatePropagation();
        if (pendingClaim) { const p = pendingClaim; pendingClaim = null; claimDaily(p.streak, p.silver, p.milestone); }
      }
    }, true);

    function claimDaily(streak, silver, milestone) {
      D.streak = streak; D.last = today; dsave();
      State.credits = (State.credits || 0) + silver;
      let capMsg = '';
      if (milestone) {
        try {
          if (window.ITEMS && window.ITEMS.cap && window.addItem) { window.addItem('cap', 1); capMsg = ' + 🧢 Cap'; }
        } catch (_) {}
      }
      try { window.updateHUD && window.updateHUD(); window.saveState && window.saveState(); } catch (_) {}
      try { window.playPurchaseSound && window.playPurchaseSound(); } catch (_) {}
      try { window.floater && window.floater('🎁 Daily reward: +' + silver + ' 🥈' + capMsg + '  (🔥 ' + streak + '-day streak)', 'good'); } catch (_) {}
      dBg.classList.remove('show');
    }

    // Show the crate only once it's safe — no lobby and no other modal open.
    const BLOCKERS = '#lobby.show,.uname-bg.show,.market-bg.show,.bank-bg.show,.launder-bg.show,' +
      '.inv-bg.show,.gold-bg.show,.fw-msn-bg.show,.lb-bg.show,.church-bg.show,.seedch-bg.show,' +
      '.pay-sel-bg.show,.lab-bg.show,.poop-bg.show,.fw-share.show';
    function maybeShowCrate(tries) {
      if (D.last === today) return;                 // already claimed today
      // Only after you've actually joined/hosted a server (in the game world).
      if (!window.fwInGame || document.querySelector(BLOCKERS) || window.fwSlideActive) {
        if ((tries || 0) < 120) setTimeout(() => maybeShowCrate((tries || 0) + 1), 2000);
        return;
      }
      buildCrate();
      dBg.classList.add('show');
    }
    // Trigger when the player enters the game (host/join/solo). Falls back to
    // a polling check in case the event fired before this module was ready.
    window.addEventListener('fw:entergame', () => setTimeout(() => maybeShowCrate(0), 1500));
    if (window.fwInGame) setTimeout(() => maybeShowCrate(0), 1500);

    // ════════════════════════════════════════════════════════════════
    //  2) TOWN LEADERBOARD BOARD
    // ════════════════════════════════════════════════════════════════
    const BOARD_POS = { x: 50, z: -61 };            // town leaderboard spot
    const BOARD_R = 3.2;
    const T0 = performance.now();
    const RIVALS = [
      { name: 'PrintGod',     base: 41000, rate: 90,  br: 5 },
      { name: 'GyattKing',    base: 23500, rate: 130, br: 4 },
      { name: 'SkibidiSigma', base: 13200, rate: 160, br: 2 },
      { name: 'Fartholomew',  base: 7600,  rate: 110, br: 1 },
    ];

    // build the physical board
    (function buildBoard() {
      const g = new THREE.Group();
      const wood = new THREE.MeshStandardMaterial({ color: 0x6b4a2a, roughness: 1 });
      for (const sx of [-1, 1]) {
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 3.4, 8), wood);
        post.position.set(sx * 1.4, 1.7, 0); g.add(post);
      }
      const panel = new THREE.Mesh(new THREE.BoxGeometry(3.4, 2.0, 0.18),
        new THREE.MeshStandardMaterial({ color: 0x143a22, roughness: 0.9 }));
      panel.position.set(0, 3.0, 0); g.add(panel);
      // canvas-textured face: "TOWN LEADERBOARD"
      const cv = document.createElement('canvas'); cv.width = 512; cv.height = 300;
      const ctx = cv.getContext('2d');
      ctx.fillStyle = '#0c2415'; ctx.fillRect(0, 0, 512, 300);
      ctx.strokeStyle = '#ffd64d'; ctx.lineWidth = 8; ctx.strokeRect(8, 8, 496, 284);
      ctx.fillStyle = '#ffd64d'; ctx.font = 'bold 70px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText('🏆', 256, 90);
      ctx.font = 'bold 44px sans-serif'; ctx.fillStyle = '#5ff09c';
      ctx.fillText('TOWN', 256, 165);
      ctx.fillText('LEADERBOARD', 256, 220);
      ctx.font = '24px sans-serif'; ctx.fillStyle = '#eaffd6';
      ctx.fillText('press E to view', 256, 265);
      const tex = new THREE.CanvasTexture(cv);
      const face = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 1.86),
        new THREE.MeshBasicMaterial({ map: tex }));
      face.position.set(0, 3.0, 0.10); g.add(face);
      const gy = gH(BOARD_POS.x, BOARD_POS.z);
      g.position.set(BOARD_POS.x, gy, BOARD_POS.z);
      g.rotation.y = Math.atan2(-BOARD_POS.x, -BOARD_POS.z);  // face the island centre
      scene.add(g);
      // register on the minimap if the API exists
      try { window.MinimapLandmarks && window.MinimapLandmarks.push({ x: BOARD_POS.x, z: BOARD_POS.z, label: 'Leaderboard', color: '#ffd64d' }); } catch (_) {}
    })();

    // rankings
    function playerBrCount() {
      try { const br = State.br; return (br && Array.isArray(br.toilets)) ? br.toilets.filter(Boolean).length : 0; } catch (_) { return 0; }
    }
    function rankings() {
      const mins = (performance.now() - T0) / 60000;
      const list = [];
      list.push({ name: (State.username || 'You'), you: true, silver: State.credits || 0, br: playerBrCount() });
      const Bases = (window.fwBrainrots && window.fwBrainrots.Bases) || [];
      (window.fwPrinterBots || []).forEach((b, i) => {
        const brc = (b.baseIdx != null && Bases[b.baseIdx]) ? Bases[b.baseIdx].toilets.filter(Boolean).length : 0;
        list.push({ name: b.name, silver: 6000 + i * 1800 + Math.floor(mins * 220) + brc * 2600, br: brc });
      });
      RIVALS.forEach(r => list.push({ name: r.name, silver: r.base + Math.floor(mins * r.rate), br: r.br }));
      list.sort((a, b) => b.silver - a.silver);
      return list;
    }

    const bBg = document.createElement('div');
    bBg.className = 'fw-board-bg';
    document.body.appendChild(bBg);
    bBg.addEventListener('click', (e) => { if (e.target === bBg) closeBoard(); });

    function openBoard() {
      const rows = rankings().map((r, i) => {
        const medal = i === 0 ? '🪙' : i === 1 ? '🥈' : i === 2 ? '🥉' : (i + 1);
        return '<div class="row' + (r.you ? ' you' : '') + '">' +
          '<span class="rk">' + medal + '</span>' +
          '<span class="nm">' + escapeHtml(r.name) + (r.you ? ' (you)' : '') + '</span>' +
          '<span class="br">🚽 ' + r.br + '</span>' +
          '<span class="sv">' + (r.silver | 0).toLocaleString() + ' 🥈</span>' +
        '</div>';
      }).join('');
      bBg.innerHTML =
        '<div class="fw-board">' +
          '<div class="hd"><h2>🏆 Town Leaderboard</h2><button class="x" id="fwBoardX">✕</button></div>' +
          '<div class="bd">' + rows + '<div class="foot">Ranked by 🥈 Silver · 🚽 = brainrots planted</div></div>' +
        '</div>';
      bBg.querySelector('#fwBoardX').addEventListener('click', closeBoard);
      bBg.classList.add('show');
    }
    function closeBoard() { bBg.classList.remove('show'); }
    function escapeHtml(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;'); }

    // proximity prompt
    const prompt = document.createElement('div');
    prompt.className = 'fw-board-prompt';
    prompt.innerHTML = '<span class="k">E</span> view the 🏆 Town Leaderboard';
    document.body.appendChild(prompt);
    function nearBoard() {
      return Math.hypot(Player.pos.x - BOARD_POS.x, Player.pos.z - BOARD_POS.z) < BOARD_R;
    }
    (function tickPrompt() {
      const show = nearBoard() && !bBg.classList.contains('show') &&
        !document.querySelector(BLOCKERS) && !window.fwSlideActive;
      prompt.style.display = show ? 'block' : 'none';
      requestAnimationFrame(tickPrompt);
    })();

    // E-key hook (consumed by fartworld.html's tryInteract). Returns true only
    // when you're at the board, so it never steals E from anything else.
    window.fwBoardInteract = function () {
      if (window.fwSlideActive) return false;
      if (!nearBoard()) return false;
      if (bBg.classList.contains('show')) closeBoard(); else openBoard();
      return true;
    };
    // Esc closes the board too
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Escape' && bBg.classList.contains('show')) { e.stopPropagation(); closeBoard(); }
    }, true);

    console.log('[dailyhub] daily crate + town leaderboard ready');
  }
})();
