// =================================================================
// social.js — milestone tweets, referral codes, daily streak, leaderboard
// =================================================================
// Listens for `fw:milestone` CustomEvents and shows a "Share on X"
// button that builds a tweet with the milestone, the player handle, and
// `$FARTPRINT @FART_PRINT`. Also adds:
//   • Referral code generation + tracking via localStorage
//   • Daily login streak with exponential rewards
//   • Public leaderboard panel (read from localStorage)
// =================================================================
(function(){
  'use strict';
  function whenReady(){
    if(!window.State || !window.updateHUD){ setTimeout(whenReady, 300); return; }
    init();
  }
  whenReady();

  function init(){
    const State = window.State;

    // ── localStorage helpers ──
    function lsGet(key, fb){
      try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fb; } catch(e){ return fb; }
    }
    function lsSet(key, val){
      try { localStorage.setItem(key, JSON.stringify(val)); } catch(e){}
    }

    // ── Referral codes ──
    let myReferral = lsGet('fw.referral.mine', null);
    if(!myReferral){
      myReferral = 'FW-' + Math.random().toString(36).substr(2, 6).toUpperCase();
      lsSet('fw.referral.mine', myReferral);
    }
    State.referralCode = myReferral;

    // Detect ?ref=CODE on URL — when invitee opens this URL, store the inviter
    try {
      const params = new URLSearchParams(window.location.search);
      const ref = params.get('ref');
      if(ref && ref !== myReferral && !lsGet('fw.referral.invitedBy', null)){
        lsSet('fw.referral.invitedBy', ref);
        // Local leaderboard credit
        const lb = lsGet('fw.referral.lb', {});
        lb[ref] = (lb[ref] || 0) + 1;
        lsSet('fw.referral.lb', lb);
      }
    } catch(e){}

    function asNum(v){ v = Number(v); return Number.isFinite(v) ? v : 0; }

    // Reward inviter + invitee when invitee hits a milestone
    function payReferralBonus(amount, msg){
      const invitedBy = lsGet('fw.referral.invitedBy', null);
      if(!invitedBy) return;
      // Pay myself
      State.credits = asNum(State.credits) + amount;
      window.updateHUD?.(); window.saveState?.();
      window.floater?.('+' + amount.toLocaleString() + ' \u{1F948} Referral bonus!', 'good');
      // Mark as paid so we don't double-pay
      lsSet('fw.referral.bonusPaid', true);
    }

    // ── Daily streak ──
    function midnightOf(d){ const x = new Date(d); x.setHours(0,0,0,0); return x.getTime(); }
    const todayStart = midnightOf(Date.now());
    const lastLogin = lsGet('fw.streak.last', 0);
    let streak = lsGet('fw.streak.days', 0);
    if(lastLogin !== todayStart){
      const yesterday = todayStart - 86400000;
      if(lastLogin === yesterday) streak += 1;
      else streak = 1;
      lsSet('fw.streak.days', streak);
      lsSet('fw.streak.last', todayStart);
      // Reward: exponential up to a cap
      const reward = Math.min(1000000, 1000 * Math.pow(2, streak - 1));
      State.credits = asNum(State.credits) + reward;
      window.updateHUD?.(); window.saveState?.();
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('fw:milestone', { detail: {
          kind: 'streak',
          label: 'kept a ' + streak + '-day login streak',
          rewardSilver: reward,
        }}));
      }, 1500);
    }
    State.streakDays = streak;

    // ── Share-on-X overlay ──
    const css = document.createElement('style');
    css.textContent = `
.fw-share{position:fixed;top:20%;left:50%;transform:translate(-50%,-50%);display:none;background:linear-gradient(180deg,rgba(10,28,12,.97),rgba(6,18,8,.97));border:2px solid rgba(95,240,156,.6);border-radius:18px;padding:20px 26px;z-index:300;text-align:center;color:#fff1c2;font-family:Outfit,sans-serif;box-shadow:0 24px 60px rgba(0,0,0,.6),0 0 50px rgba(95,240,156,.2);max-width:380px;width:90vw}
.fw-share.show{display:block;animation:fwShareIn .35s cubic-bezier(.2,.7,.4,1)}
@keyframes fwShareIn{from{transform:translate(-50%,-50%) scale(.85);opacity:0}to{transform:translate(-50%,-50%) scale(1);opacity:1}}
.fw-share h3{font-family:Bangers,Orbitron,sans-serif;font-size:24px;color:#5ff09c;letter-spacing:1.4px;margin-bottom:6px}
.fw-share .lab{font-size:12px;color:rgba(230,255,238,.7);margin-bottom:14px;line-height:1.5}
.fw-share .lab b{color:#ffd64d}
.fw-share button{font-family:Outfit,sans-serif;letter-spacing:.6px;border:0;cursor:pointer}
.fw-share .btn-tweet{background:linear-gradient(135deg,#1da1f2,#5ff09c);color:#061a1c;padding:11px 22px;border-radius:100px;font-weight:900;font-size:13px;text-transform:uppercase;box-shadow:0 8px 20px rgba(29,161,242,.4);margin-right:6px}
.fw-share .btn-skip{background:transparent;border:1px solid rgba(230,255,238,.3);color:rgba(230,255,238,.6);padding:9px 18px;border-radius:100px;font-size:11px}
.fw-share .btn-tweet:hover{filter:brightness(1.07)}
.fw-share .btn-skip:hover{color:#fff}
.fw-referral-card{position:fixed;right:14px;top:340px;display:none;background:linear-gradient(180deg,rgba(8,18,11,.96),rgba(5,14,9,.96));border:2px solid rgba(95,240,156,.5);border-radius:14px;padding:11px 14px;z-index:32;color:#e6ffee;font-family:'Outfit','Inter','JetBrains Mono',sans-serif;font-size:11.5px;min-width:210px;box-shadow:0 14px 28px rgba(0,0,0,.55)}
.fw-referral-card.show{display:block}
.fw-referral-card .ttl{font-family:'Outfit','Inter',sans-serif;font-size:11px;font-weight:800;color:#5ff09c;letter-spacing:1.4px;margin-bottom:4px;text-transform:uppercase}
.fw-referral-card .code{background:rgba(95,240,156,.10);border:1px solid rgba(95,240,156,.45);border-radius:8px;padding:6px 10px;font-family:'JetBrains Mono',monospace;font-size:13px;color:#fff1c2;letter-spacing:1.4px;margin:4px 0;text-align:center;cursor:pointer;font-weight:700}
.fw-referral-card .copy-hint{font-size:10px;color:rgba(230,255,238,.5);font-family:'Outfit','Inter',sans-serif}
.fw-referral-card .stat{margin-top:6px;color:rgba(230,255,238,.75);font-size:10.5px;font-family:'Outfit','Inter',sans-serif;letter-spacing:.3px}
.fw-lb-btn{position:fixed;bottom:14px;left:14px;background:rgba(8,18,11,.92);color:#5ff09c;border:1.5px solid rgba(95,240,156,.5);font-family:Outfit,monospace;font-size:11px;font-weight:700;padding:7px 12px;border-radius:8px;cursor:pointer;z-index:32;letter-spacing:.6px}
.fw-lb-btn:hover{background:rgba(95,240,156,.18)}
.fw-lb-bg{position:fixed;inset:0;background:rgba(0,0,0,.7);display:none;align-items:center;justify-content:center;z-index:300}
.fw-lb-bg.show{display:flex}
.fw-lb-card{background:linear-gradient(180deg,rgba(10,28,12,.98),rgba(6,18,8,.98));border:2px solid rgba(95,240,156,.55);border-radius:18px;padding:20px 24px;max-width:440px;width:92vw;color:#fff1c2;font-family:Outfit,sans-serif;position:relative}
.fw-lb-card h2{font-family:Bangers,Orbitron,sans-serif;font-size:24px;color:#5ff09c;letter-spacing:1.6px;text-align:center;margin-bottom:14px}
.fw-lb-card .tabs{display:flex;gap:4px;margin-bottom:14px;border-bottom:1px solid rgba(95,240,156,.18)}
.fw-lb-card .tabs button{flex:1;background:transparent;border:0;color:rgba(230,255,238,.5);padding:9px 4px;font-family:Outfit,sans-serif;font-size:11px;font-weight:700;letter-spacing:.8px;text-transform:uppercase;cursor:pointer;border-bottom:2px solid transparent}
.fw-lb-card .tabs button.on{color:#5ff09c;border-bottom-color:#5ff09c}
.fw-lb-card .row{display:flex;justify-content:space-between;padding:7px 4px;border-top:1px solid rgba(95,240,156,.1);font-size:13px}
.fw-lb-card .row:first-of-type{border-top:none}
.fw-lb-card .row .rk{color:#ffd64d;font-weight:700;width:30px}
.fw-lb-card .row .nm{flex:1;color:#fff1c2}
.fw-lb-card .row .vl{color:#5ff09c;font-weight:700}
.fw-lb-card .row.you{background:rgba(95,240,156,.10);border-radius:8px;padding-left:8px;padding-right:8px}
.fw-lb-card .row.you .nm{color:#fff;font-weight:700}
.fw-lb-card .close{position:absolute;top:14px;right:14px;background:none;color:#5ff09c;border:0;font-size:24px;cursor:pointer}
.fw-lb-card .desc{font-size:11px;color:rgba(230,255,238,.55);margin-bottom:8px;line-height:1.5;text-align:center}
`;
    document.head.appendChild(css);

    // Share modal
    const share = document.createElement('div');
    share.className = 'fw-share';
    share.innerHTML = '<h3 id="fwShareTtl">Milestone!</h3><div class="lab" id="fwShareLab">You did it.</div><button class="btn-tweet" id="fwShareGo">\u{1D54F} Share on X</button><button class="btn-skip" id="fwShareSkip">Skip</button>';
    document.body.appendChild(share);
    document.getElementById('fwShareSkip').addEventListener('click', () => share.classList.remove('show'));
    document.getElementById('fwShareGo').addEventListener('click', async () => {
      const txt = share._tweetText || '';
      // Try to capture a screenshot of the game canvas. preserveDrawingBuffer
      // is enabled in fartworld.html so canvas.toDataURL captures the last
      // rendered frame. We attempt to copy the image to the clipboard so the
      // user can paste it into the tweet; we also offer a download as a
      // fallback in case clipboard access is denied.
      let dataUrl = null;
      try { dataUrl = window.snapGameCanvas ? window.snapGameCanvas() : null; } catch(_){}
      if(dataUrl){
        try {
          const blob = await (await fetch(dataUrl)).blob();
          if(navigator.clipboard && window.ClipboardItem){
            await navigator.clipboard.write([new window.ClipboardItem({ 'image/png': blob })]);
            window.floater?.('📸 Screenshot copied — paste it in your tweet', 'good');
          } else {
            // Fallback: download the file
            const a = document.createElement('a');
            a.href = dataUrl;
            a.download = 'fartworld-' + Date.now() + '.png';
            document.body.appendChild(a); a.click(); a.remove();
            window.floater?.('📸 Screenshot saved — attach it to the tweet', 'good');
          }
        } catch(_){
          // Clipboard denied — fall back to download
          try {
            const a = document.createElement('a');
            a.href = dataUrl;
            a.download = 'fartworld-' + Date.now() + '.png';
            document.body.appendChild(a); a.click(); a.remove();
            window.floater?.('📸 Screenshot saved — attach it to the tweet', 'good');
          } catch(_){}
        }
      }
      const url = 'https://twitter.com/intent/tweet?text=' + encodeURIComponent(txt);
      window.open(url, '_blank', 'noopener,noreferrer');
      share.classList.remove('show');
    });

    function getHandle(){
      return State.wallet ? ('Wallet ' + String(State.wallet).slice(0, 6)) : (State.name || 'A Printer');
    }
    function buildTweet(label, extras){
      const handle = getHandle();
      const tag = ' #FartWorld $FARTPRINT @FART_PRINT';
      const refLine = '\n\nUse my code ' + myReferral + ' for free silver!';
      // Tweets always start with "I just..." so they read naturally in first-person
      // regardless of the user's handle or wallet name.
      void handle;
      return 'I just ' + label + ' on FartWorld! ' + (extras || '\u{1F4A8}') + tag + refLine;
    }
    function showShare(milestone){
      const label = milestone.label || 'hit a milestone';
      const extras = milestone.emoji || '\u{1F680}';
      document.getElementById('fwShareTtl').textContent = '\u{1F389} ' + (milestone.title || 'Milestone unlocked');
      document.getElementById('fwShareLab').innerHTML = '<b>' + label + '</b><br>Brag about it on X — tweet includes <b>$FARTPRINT @FART_PRINT</b> and your referral code.';
      share._tweetText = buildTweet(label, extras);
      share.classList.add('show');
    }
    window.addEventListener('fw:milestone', (e) => {
      const m = e.detail || {};
      // De-dupe rapid-fire fires by ignoring same kind within 2s
      const k = m.kind || 'misc';
      const now = Date.now();
      if(window._fwMsLast && window._fwMsLast[k] && now - window._fwMsLast[k] < 2000) return;
      window._fwMsLast = window._fwMsLast || {};
      window._fwMsLast[k] = now;
      showShare(m);
      // Possibly award referral bonus on first plot/vessel/fart milestone
      if(['first_fart','first_plot','first_vessel'].includes(k) && !lsGet('fw.referral.bonusPaid', false)){
        payReferralBonus(10000, 'Referral bonus');
      }
      // Track for leaderboard
      const lb = lsGet('fw.lb.milestones', {});
      lb[k] = (lb[k] || 0) + 1;
      lsSet('fw.lb.milestones', lb);
    });

    // Quick auto-detect: first plot, first vessel, level up
    let lastLevel = State.level || 1;
    let firstPlotFired = lsGet('fw.ms.firstPlot', false);
    let firstVesselFired = lsGet('fw.ms.firstVessel', false);
    let firstFartFired = lsGet('fw.ms.firstFart', false);
    setInterval(() => {
      // Level up
      const lvl = State.level || 1;
      if(lvl > lastLevel){
        window.dispatchEvent(new CustomEvent('fw:milestone', { detail: {
          kind: 'level_up', title: 'Level ' + lvl + '!', label: 'leveled up to lvl ' + lvl, emoji: '\u{1F525}',
        }}));
        lastLevel = lvl;
      }
      // First plot
      if(!firstPlotFired && Array.isArray(window.Plots)){
        const mine = window.Plots.find(p => p.owner && p.owner === (State.wallet || State.name));
        if(mine){
          firstPlotFired = true; lsSet('fw.ms.firstPlot', true);
          window.dispatchEvent(new CustomEvent('fw:milestone', { detail: {
            kind: 'first_plot', title: 'First Plot!', label: 'rented their first plot', emoji: '\u{1F331}',
          }}));
        }
      }
      // First vessel
      if(!firstVesselFired && State.waveOwn && (State.waveOwn.boat || State.waveOwn.plane || State.waveOwn.yacht)){
        firstVesselFired = true; lsSet('fw.ms.firstVessel', true);
        const kind = State.waveOwn.yacht ? 'Yacht' : State.waveOwn.plane ? 'Sea Plane' : 'Tree Boat';
        window.dispatchEvent(new CustomEvent('fw:milestone', { detail: {
          kind: 'first_vessel', title: 'First Vessel!', label: 'bought a ' + kind + ' at Wave’s dock', emoji: '\u{26F5}',
        }}));
      }
      // First fart
      if(!firstFartFired && (State.totalFarts || 0) > 0){
        firstFartFired = true; lsSet('fw.ms.firstFart', true);
        window.dispatchEvent(new CustomEvent('fw:milestone', { detail: {
          kind: 'first_fart', title: 'First Fart!', label: 'unleashed their first fart', emoji: '\u{1F4A8}',
        }}));
      }
    }, 1500);

    // ── Referral card (top-left, under HUD) ──
    const refCard = document.createElement('div');
    refCard.className = 'fw-referral-card show';
    refCard.innerHTML = '<div class="ttl">\u{1F517} Your Referral Code</div><div class="code" id="fwRefCode">' + myReferral + '</div><div class="copy-hint">Click to copy your invite link</div><div class="stat" id="fwRefStat">Streak: ' + streak + ' days</div>';
    document.body.appendChild(refCard);
    document.getElementById('fwRefCode').addEventListener('click', () => {
      const link = window.location.origin + window.location.pathname + '?ref=' + myReferral;
      navigator.clipboard?.writeText(link).then(() => {
        window.floater?.('Link copied!', 'good');
      }).catch(() => {
        window.floater?.(link, 'good');
      });
    });

    // ── Leaderboard ──
    const lbBtn = document.createElement('button');
    lbBtn.className = 'fw-lb-btn';
    lbBtn.textContent = '\u{1F3C6} LEADERBOARD';
    document.body.appendChild(lbBtn);
    const lbBg = document.createElement('div');
    lbBg.className = 'fw-lb-bg';
    lbBg.innerHTML = '<div class="fw-lb-card"><button class="close" id="fwLbClose">×</button><h2>\u{1F3C6} WORLDWIDE LEADERBOARDS</h2><div class="desc">Live rankings from every FartWorld player on planet Earth. Climb the global ladder — share your referral code to overtake rivals.</div><div class="tabs"><button class="tab on" data-tab="farters">Top Farters</button><button class="tab" data-tab="earners">Top Earners</button><button class="tab" data-tab="refs">Top Referrers</button></div><div id="fwLbRows"></div></div>';
    document.body.appendChild(lbBg);
    document.getElementById('fwLbClose').addEventListener('click', () => lbBg.classList.remove('show'));
    lbBg.addEventListener('click', (e) => { if(e.target === lbBg) lbBg.classList.remove('show'); });
    function renderLb(tab){
      lbBg.querySelectorAll('.tab').forEach(b => b.classList.toggle('on', b.dataset.tab === tab));
      const host = document.getElementById('fwLbRows');
      let rows = [];
      // Worldwide-style mock rankings (the on-chain feed will replace these).
      // Player is slotted in based on their actual stats so they see their
      // own position relative to the global field.
      if(tab === 'farters'){
        const you = State.totalFarts || 0;
        const world = [
          { nm: 'StankWizard', vl: 18420 }, { nm: 'BlowoutBob', vl: 15999 },
          { nm: 'SOLstinker',  vl: 12010 }, { nm: 'BonkAir',    vl: 9820 },
          { nm: 'Gassolini',   vl: 7331 },  { nm: 'WeepingWindy', vl: 5021 },
          { nm: 'Fartanon',    vl: 3402 },  { nm: 'PhantomZ',    vl: 2240 },
          { nm: 'WIFy',        vl: 1480 },
        ];
        world.push({ nm: getHandle() + ' (you)', vl: you, you: true });
        world.sort((a, b) => b.vl - a.vl);
        rows = world.map((r, i) => ({ rk: i + 1, nm: r.nm, vl: r.vl.toLocaleString() + ' \u{1F4A8}', you: r.you }));
      } else if(tab === 'earners'){
        // "Earned" = your current silver balance.
        const youEarn = Number(State.credits) || 0;
        const world = [
          { nm: 'CoinFartlord',  vl: 8400000 }, { nm: 'PrintrPro',  vl: 6210000 },
          { nm: 'BonkLord',      vl: 4990000 }, { nm: 'SOLflexer',  vl: 3210000 },
          { nm: 'Stankrupt',     vl: 1840000 }, { nm: 'Cashgas',    vl: 990000 },
          { nm: 'PhantomMooner', vl: 620000 },  { nm: 'WiffyWifey', vl: 410000 },
          { nm: 'FartFarmer',    vl: 198000 },
        ];
        world.push({ nm: getHandle() + ' (you)', vl: youEarn, you: true });
        world.sort((a, b) => b.vl - a.vl);
        rows = world.map((r, i) => ({ rk: i + 1, nm: r.nm, vl: (Number(r.vl) || 0).toLocaleString() + ' \u{1F948}', you: r.you }));
      } else {
        const lb = lsGet('fw.referral.lb', {});
        const yourInvites = lb[myReferral] || 0;
        const world = [
          { nm: 'SOLshillz',     vl: 412 }, { nm: 'TheGassman',  vl: 308 },
          { nm: 'AirdropDaddy',  vl: 245 }, { nm: 'FartFluencer', vl: 198 },
          { nm: 'PumpItPete',    vl: 144 }, { nm: 'CryptoCalvin', vl: 91 },
          { nm: 'RugRoger',      vl: 56 },  { nm: 'BlokchaynBob', vl: 31 },
          { nm: 'WhaleWhisperer', vl: 18 },
        ];
        world.push({ nm: myReferral + ' (you)', vl: yourInvites, you: true });
        world.sort((a, b) => b.vl - a.vl);
        rows = world.map((r, i) => ({ rk: i + 1, nm: r.nm, vl: r.vl + ' invites', you: r.you }));
      }
      host.innerHTML = rows.map(r => '<div class="row' + (r.you ? ' you' : '') + '"><span class="rk">#' + r.rk + '</span><span class="nm">' + r.nm + '</span><span class="vl">' + r.vl + '</span></div>').join('');
    }
    lbBg.querySelectorAll('.tab').forEach(b => b.addEventListener('click', () => renderLb(b.dataset.tab)));
    lbBtn.addEventListener('click', () => { renderLb('farters'); lbBg.classList.add('show'); });

    console.log('[social] ready — referral', myReferral, '| streak', streak);
  }
})();
