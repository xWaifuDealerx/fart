// =================================================================
// extras-v6be.js — independent NPC proximity prompt, Fart Cup flags
// in card header, paper mill door, referrals tab button, ref-card X,
// hide finished tutorial, jar reveal carousel, crops panel restyle.
// =================================================================
(function(){
  'use strict';
  function whenReady(){
    if(!window.State || !window.Player){ setTimeout(whenReady, 300); return; }
    init();
  }
  whenReady();

  function init(){
    const State = window.State;
    const Player = window.Player;

    // ──────────────────────────────────────────────────────────────
    // 1) INDEPENDENT NPC PROXIMITY PROMPT
    //    Static-npcs.js's npcPop has been unreliable in prod. We
    //    ship a parallel popup that scans known NPC positions every
    //    250 ms and shows a clean "Press E to talk to X" pill at the
    //    bottom-centre of the screen. Clicking the button also
    //    dispatches the same E-key handler.
    // ──────────────────────────────────────────────────────────────
    const NPCS = [
      { x: -22,    z: -33,    name: 'Carlos',      hint: "Open Carlos's Market",   kind: 'market' },
      { x: -22,    z: -8,     name: 'Moneycaller', hint: "Visit the Bank",         kind: 'bank' },
      { x:  82,    z:  0.5,   name: 'Wave',        hint: "Browse Boat Shop",       kind: 'dock' },
      { x:  60,    z:  58.6,  name: 'Gary',        hint: "Pawn Shop · Sell Jars",  kind: 'pawn' },
    ];
    const PROX_R = 6.0;

    const css = document.createElement('style');
    css.textContent = `
.fw-npcprox{position:fixed;left:50%;bottom:120px;transform:translateX(-50%);display:none;
  background:linear-gradient(180deg,rgba(8,18,11,.96),rgba(5,14,9,.96));
  border:2px solid rgba(95,240,156,.55);border-radius:14px;padding:11px 18px 12px;
  z-index:55;text-align:center;font-family:'Outfit','Inter','JetBrains Mono',sans-serif;
  color:#fff1c2;box-shadow:0 14px 28px rgba(0,0,0,.55);min-width:240px}
.fw-npcprox.show{display:block;animation:fwProxIn .25s cubic-bezier(.2,.7,.4,1)}
@keyframes fwProxIn{from{opacity:0;transform:translateX(-50%) translateY(8px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}
.fw-npcprox .who{font-size:11px;color:rgba(230,255,238,.7);margin-bottom:4px;letter-spacing:.4px}
.fw-npcprox .who b{color:#5ff09c}
.fw-npcprox .line{font-family:'Outfit',sans-serif;font-size:14.5px;font-weight:700;color:#fff1c2;letter-spacing:.4px;margin-bottom:7px}
.fw-npcprox .hint{font-size:11px;color:rgba(230,255,238,.6);margin-bottom:8px}
.fw-npcprox .hint kbd{background:rgba(110,208,214,.22);border:1px solid rgba(110,208,214,.6);color:#a8e0ff;padding:2px 8px;border-radius:6px;font-family:'JetBrains Mono',monospace;font-size:11px;font-weight:700}
.fw-npcprox .btn{background:rgba(95,240,156,.18);border:1px solid rgba(95,240,156,.55);color:#5ff09c;padding:7px 16px;border-radius:8px;font-family:'Outfit',sans-serif;font-weight:700;font-size:12px;cursor:pointer;letter-spacing:.6px}
.fw-npcprox .btn:hover{background:rgba(95,240,156,.3)}
`;
    document.head.appendChild(css);
    const prox = document.createElement('div');
    prox.className = 'fw-npcprox';
    prox.innerHTML = '<div class="who"><b id="fwProxName">Carlos</b> 🖨</div><div class="line" id="fwProxLine">Talk</div><div class="hint">Press <kbd>E</kbd> or click below</div><button class="btn" id="fwProxBtn">Open</button>';
    document.body.appendChild(prox);
    let activeNpc = null;
    function openActive(){
      if(!activeNpc) return;
      if(activeNpc.kind === 'market'){
        // static-npcs.js's openCarlos() is private; click the existing
        // Carlos NPC popup's Open button if it's there, otherwise try
        // a few known global hooks.
        const carlosBtn = document.querySelector('#npcPopBtn');
        if(carlosBtn) carlosBtn.click();
        else document.getElementById('carlosBg')?.classList.add('show');
      } else if(activeNpc.kind === 'bank'){
        document.getElementById('bankBg')?.classList.add('show');
      } else if(activeNpc.kind === 'dock'){
        if(typeof window.openWaveShop === 'function') window.openWaveShop();
      } else if(activeNpc.kind === 'pawn'){
        if(typeof window.openGary === 'function') window.openGary();
      }
    }
    document.getElementById('fwProxBtn').addEventListener('click', openActive);
    window.addEventListener('keydown', (e) => {
      if(e.code !== 'KeyE') return;
      const a = document.activeElement;
      if(a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA')) return;
      if(!activeNpc) return;
      // If any modal is already open, leave it alone.
      if(document.querySelector('.bank-bg.show, .carlos-bg.show, .wave-bg.show, .gary-bg.show, #invBg.show, #marketBg.show')) return;
      openActive();
    });
    setInterval(() => {
      let nearest = null, bestD = PROX_R;
      for(const n of NPCS){
        const d = Math.hypot(Player.pos.x - n.x, Player.pos.z - n.z);
        if(d < bestD){ bestD = d; nearest = n; }
      }
      activeNpc = nearest;
      if(nearest){
        document.getElementById('fwProxName').textContent = nearest.name;
        document.getElementById('fwProxLine').textContent = nearest.hint;
        prox.classList.add('show');
      } else prox.classList.remove('show');
    }, 250);

    // ──────────────────────────────────────────────────────────────
    // 2) FART CUP — flag in card header
    //    fartcup.js already renders the flag emoji. We just override
    //    the .fc-name CSS to show the flag prominently above the sym.
    // ──────────────────────────────────────────────────────────────
    const css2 = document.createElement('style');
    css2.textContent = `
.fc-cell .fc-flag{font-size:54px!important;line-height:1!important;margin-bottom:2px!important}
.fc-cell .fc-name{font-family:'JetBrains Mono',monospace!important;font-size:11px!important;color:rgba(230,255,238,.55)!important;letter-spacing:1px!important}
`;
    document.head.appendChild(css2);

    // ──────────────────────────────────────────────────────────────
    // 3) PAPER MILL DOOR — punch a player-sized opening in the front
    //    of the mill so you can walk inside. The existing mill mesh
    //    isn't easy to modify from outside; instead we add a small
    //    open archway in front and a soft glow.
    // ──────────────────────────────────────────────────────────────
    if(window.THREE && window.scene){
      try {
        const THREE = window.THREE;
        const MILL_POS = { x: -45, z: 8 };
        const grp = new THREE.Group();
        const gh = window.groundHeightAt ? window.groundHeightAt(MILL_POS.x, MILL_POS.z + 2.4) : 0;
        grp.position.set(MILL_POS.x, gh, MILL_POS.z + 2.4);
        const woodMat = new THREE.MeshStandardMaterial({ color: 0x6a3a18, roughness: 0.85 });
        const dark = new THREE.MeshStandardMaterial({ color: 0x1a0c08, roughness: 0.9 });
        // Archway frame
        const lj = new THREE.Mesh(new THREE.BoxGeometry(0.20, 2.6, 0.20), woodMat);
        lj.position.set(-0.85, 1.3, 0); grp.add(lj);
        const rj = lj.clone(); rj.position.x = 0.85; grp.add(rj);
        const top = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.20, 0.20), woodMat);
        top.position.set(0, 2.5, 0); grp.add(top);
        // Dark interior to suggest depth
        const inside = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 2.3), dark);
        inside.position.set(0, 1.25, -0.05); grp.add(inside);
        // Warm glow on the threshold
        const lamp = new THREE.PointLight(0xffce8a, 0.8, 8);
        lamp.position.set(0, 2.0, 0.2); grp.add(lamp);
        window.scene.add(grp);
      } catch(e){ console.error('[v6be] mill door', e); }
    }

    // ──────────────────────────────────────────────────────────────
    // 4) REFERRAL OVERVIEW BUTTON + PANEL
    //    Adds a new circular button next to the LB / Inventory /
    //    Portfolio buttons. Click to see your code, total invitees,
    //    earned silver from referrals, and the invited list.
    //    Earnings come from State.refEarned which we increment 1% of
    //    silver each time the invitee gains.
    // ──────────────────────────────────────────────────────────────
    if(typeof State.refEarned !== 'number') State.refEarned = 0;
    if(!Array.isArray(State.refInvitees)) State.refInvitees = [];
    function lsGet(key, fb){ try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fb; } catch(e){ return fb; } }
    const myRef = State.referralCode || lsGet('fw.referral.mine', 'FW-??????');

    const css3 = document.createElement('style');
    css3.textContent = `
/* Top-right circular button next to 🎒 Inventory (top:80), 💼 Portfolio
   (top:134), 🏆 Leaderboard (top:188). Drop our 🤝 Referrals at top:188
   and shift the trophy down 54px so they stack: inv → portfolio → ref → trophy. */
.fw-ref-btn{position:fixed;top:188px;right:14px;width:42px;height:42px;border-radius:50%;
  background:rgba(8,18,11,.92);color:#ffd64d;border:1.5px solid rgba(255,206,74,.55);
  font-size:20px;cursor:pointer;z-index:33;display:flex;align-items:center;justify-content:center;padding:0;
  transition:transform .15s ease,border-color .15s ease}
.fw-ref-btn:hover{background:rgba(255,206,74,.18);border-color:#ffd64d;transform:scale(1.08)}
.fw-ref-bg{position:fixed;inset:0;background:rgba(0,0,0,.78);backdrop-filter:blur(10px);display:none;align-items:center;justify-content:center;z-index:200;padding:18px}
.fw-ref-bg.show{display:flex}
.fw-ref-card{background:linear-gradient(180deg,rgba(28,18,8,.97),rgba(18,10,4,.97));border:2px solid rgba(255,206,74,.55);border-radius:18px;max-width:480px;width:100%;color:#fff1c2;font-family:'Outfit','Inter',sans-serif}
.fw-ref-card .hd{display:flex;justify-content:space-between;align-items:center;padding:18px 22px;border-bottom:1px solid rgba(255,206,74,.18)}
.fw-ref-card .hd h2{font-family:'Bangers','Orbitron',sans-serif;font-size:24px;color:#ffd64d;letter-spacing:1.6px;margin:0}
.fw-ref-card .hd .x{background:transparent;border:0;color:rgba(255,241,194,.55);font-size:24px;cursor:pointer}
.fw-ref-card .bd{padding:18px 22px}
.fw-ref-card .code{background:rgba(255,206,74,.10);border:1px dashed rgba(255,206,74,.55);border-radius:10px;padding:10px 14px;text-align:center;font-family:'JetBrains Mono',monospace;font-size:18px;color:#ffd64d;letter-spacing:2px;margin-bottom:8px;cursor:pointer}
.fw-ref-card .url{font-family:'JetBrains Mono',monospace;font-size:11px;color:rgba(230,255,238,.55);text-align:center;margin-bottom:14px;word-break:break-all;cursor:pointer}
.fw-ref-card .stats{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:14px}
.fw-ref-card .stat{background:rgba(255,206,74,.07);border:1px solid rgba(255,206,74,.25);border-radius:10px;padding:10px}
.fw-ref-card .stat .l{font-size:10px;color:#ffd64d;letter-spacing:.6px;text-transform:uppercase;margin-bottom:3px}
.fw-ref-card .stat .v{font-family:'Orbitron',sans-serif;font-weight:900;font-size:18px;color:#fff1c2}
.fw-ref-card .list{max-height:180px;overflow:auto}
.fw-ref-card .list .row{display:flex;justify-content:space-between;padding:7px 4px;border-bottom:1px solid rgba(255,206,74,.10);font-size:12px}
.fw-ref-card .list .empty{color:rgba(230,255,238,.5);font-size:12px;text-align:center;padding:20px}
.fw-ref-card .share{display:flex;gap:8px;margin-top:14px}
.fw-ref-card .share button{flex:1;background:rgba(255,206,74,.18);border:1px solid rgba(255,206,74,.55);color:#ffd64d;padding:9px;border-radius:8px;font-family:'Outfit',sans-serif;font-weight:700;font-size:12px;cursor:pointer;letter-spacing:.4px}
.fw-ref-card .share button:hover{background:rgba(255,206,74,.3)}
/* X-close on the small right-side referral card. The card itself is
   position:fixed; an absolute child uses it as the containing block,
   so we don't need to touch its sizing. */
.fw-referral-card .x{position:absolute;top:4px;right:6px;background:transparent;border:0;color:rgba(230,255,238,.5);font-size:14px;cursor:pointer;line-height:1;padding:0;width:14px;height:14px;display:flex;align-items:center;justify-content:center}
.fw-referral-card .x:hover{color:#ff7a6e}
`;
    document.head.appendChild(css3);

    const refBtn = document.createElement('button');
    refBtn.className = 'fw-ref-btn';
    refBtn.title = 'Referrals';
    refBtn.textContent = '🤝';
    document.body.appendChild(refBtn);

    // Push the existing 🏆 trophy button down so the new 🤝 fits above it.
    const lbToggle = document.getElementById('lbToggle');
    if(lbToggle){
      lbToggle.style.setProperty('top', '242px', 'important');
      // Route the trophy click to the WORLDWIDE leaderboard from social.js
      // (the dialog with Top Farters / Top Earners / Top Referrers tabs).
      lbToggle.addEventListener('click', (e) => {
        const wlb = document.querySelector('.fw-lb-bg');
        if(wlb){
          e.preventDefault(); e.stopImmediatePropagation();
          wlb.classList.add('show');
          // Default to Top Farters tab
          const farters = wlb.querySelector('.tab[data-tab="farters"]');
          if(farters) farters.click();
        }
      }, true);
    }

    // Hide the bottom-left worldwide-LB button from social.js — the
    // trophy in the top-right now owns that flow.
    function killBottomLeftButtons(){
      const lb = document.querySelector('.fw-lb-btn');
      if(lb) lb.style.setProperty('display', 'none', 'important');
    }
    setInterval(killBottomLeftButtons, 500);
    killBottomLeftButtons();

    const refBg = document.createElement('div');
    refBg.className = 'fw-ref-bg';
    refBg.innerHTML = ''
      + '<div class="fw-ref-card">'
      + '  <div class="hd"><h2>👥 YOUR REFERRALS</h2><button class="x" id="fwRefX">×</button></div>'
      + '  <div class="bd">'
      + '    <p style="font-size:12px;color:rgba(230,255,238,.7);margin-bottom:10px;line-height:1.55;">Share your code or invite link. You earn <b>1% of every silver coin</b> your invitees collect — forever.</p>'
      + '    <div class="code" id="fwRefCode">FW-XXXXXX</div>'
      + '    <div class="url" id="fwRefUrl">https://fartprint.fun/fartworld.html?ref=FW-XXXXXX</div>'
      + '    <div class="stats">'
      + '      <div class="stat"><div class="l">Invitees</div><div class="v" id="fwRefInv">0</div></div>'
      + '      <div class="stat"><div class="l">Total Earned</div><div class="v" id="fwRefEarn">0 🥈</div></div>'
      + '    </div>'
      + '    <div style="font-size:11px;font-weight:700;color:#ffd64d;letter-spacing:.4px;margin-bottom:6px;text-transform:uppercase">Your invitees</div>'
      + '    <div class="list" id="fwRefList"></div>'
      + '    <div class="share">'
      + '      <button id="fwRefCopy">📋 Copy Link</button>'
      + '      <button id="fwRefTweet">𝕏 Tweet it</button>'
      + '    </div>'
      + '  </div>'
      + '</div>';
    document.body.appendChild(refBg);
    document.getElementById('fwRefX').addEventListener('click', () => refBg.classList.remove('show'));
    refBg.addEventListener('click', (e) => { if(e.target === refBg) refBg.classList.remove('show'); });

    function renderRef(){
      document.getElementById('fwRefCode').textContent = myRef;
      const url = 'https://fartprint.fun/fartworld.html?ref=' + encodeURIComponent(myRef);
      document.getElementById('fwRefUrl').textContent = url;
      document.getElementById('fwRefInv').textContent = (State.refInvitees || []).length;
      document.getElementById('fwRefEarn').textContent = Math.floor(State.refEarned || 0).toLocaleString() + ' 🥈';
      const list = document.getElementById('fwRefList');
      const inv = State.refInvitees || [];
      list.innerHTML = inv.length
        ? inv.map(p => '<div class="row"><span>' + (p.name || p.code || 'Unknown') + '</span><span style="color:#5ff09c">+' + Math.floor(p.earned || 0).toLocaleString() + ' 🥈</span></div>').join('')
        : '<div class="empty">No invitees yet. Share your code!</div>';
    }
    refBtn.addEventListener('click', () => { renderRef(); refBg.classList.add('show'); });
    document.getElementById('fwRefCopy').addEventListener('click', () => {
      const url = 'https://fartprint.fun/fartworld.html?ref=' + encodeURIComponent(myRef);
      try { navigator.clipboard.writeText(url); window.floater?.('🔗 Link copied', 'good'); } catch(_){}
    });
    document.getElementById('fwRefTweet').addEventListener('click', () => {
      const text = 'Join me in FartWorld — use my code ' + myRef + ' for a head start! $FARTPRINT @FART_PRINT';
      window.open('https://twitter.com/intent/tweet?text=' + encodeURIComponent(text), '_blank', 'noopener,noreferrer');
    });

    // Track silver gains for referral earnings (1%)
    let lastCredits = Number(State.credits) || 0;
    setInterval(() => {
      const cur = Number(State.credits) || 0;
      const diff = cur - lastCredits;
      if(diff > 0){
        State.refEarned = (State.refEarned || 0) + diff * 0.01;
      }
      lastCredits = cur;
    }, 3000);

    // ──────────────────────────────────────────────────────────────
    // 5) X CLOSE BUTTON ON THE RIGHT-SIDE REFERRAL CARD
    // ──────────────────────────────────────────────────────────────
    function addCloseToRefCard(){
      const card = document.querySelector('.fw-referral-card');
      if(!card || card.querySelector('.x')) return;
      const x = document.createElement('button');
      x.className = 'x';
      x.textContent = '×';
      x.title = 'Hide';
      x.addEventListener('click', (e) => { e.stopPropagation(); card.style.display = 'none'; });
      card.appendChild(x);
    }
    setInterval(addCloseToRefCard, 1000);

    // ──────────────────────────────────────────────────────────────
    // 6) HIDE TUTORIAL CARD WHEN COMPLETE
    // ──────────────────────────────────────────────────────────────
    setInterval(() => {
      if((State.tutStep || 0) >= 5){
        const c = document.querySelector('.tut-card');
        const m = document.querySelector('.tut-mini');
        if(c) c.style.display = 'none';
        if(m) m.style.display = 'none';
      }
    }, 1500);

    // ──────────────────────────────────────────────────────────────
    // 7) FART JAR REVEAL CAROUSEL (CSGO-style case opening)
    //    crafting.js fires window.dispatchEvent('fw:jarRoll', { detail:
    //    { tierId } }) — we listen and play a spinning strip of tier
    //    icons that decelerates onto the winning tier.
    // ──────────────────────────────────────────────────────────────
    const carCss = document.createElement('style');
    carCss.textContent = `
.fw-case-bg{position:fixed;inset:0;display:none;align-items:center;justify-content:center;background:rgba(0,0,0,.86);backdrop-filter:blur(8px);z-index:250}
.fw-case-bg.show{display:flex}
.fw-case-card{background:linear-gradient(180deg,rgba(28,14,40,.97),rgba(8,4,14,.97));border:2px solid rgba(255,206,74,.6);border-radius:20px;padding:24px 28px;max-width:640px;width:94vw;text-align:center;color:#fff1c2;font-family:'Outfit',sans-serif;box-shadow:0 24px 60px rgba(0,0,0,.6),0 0 60px rgba(255,206,74,.18)}
.fw-case-card h2{font-family:'Bangers','Orbitron',sans-serif;font-size:30px;color:#ffd64d;letter-spacing:2px;margin-bottom:10px}
.fw-case-strip{position:relative;height:120px;overflow:hidden;background:rgba(255,206,74,.06);border:2px solid rgba(255,206,74,.4);border-radius:14px}
.fw-case-strip .pin{position:absolute;left:50%;top:-6px;bottom:-6px;width:3px;background:#ff5050;box-shadow:0 0 14px #ff5050;z-index:2;transform:translateX(-50%)}
.fw-case-track{position:absolute;left:0;top:0;bottom:0;display:flex;align-items:center;will-change:transform;padding:0 12px}
.fw-case-track .item{flex:0 0 110px;height:96px;margin:0 4px;border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:54px;border:2px solid rgba(255,255,255,.12)}
.fw-case-track .item.green  {background:rgba(74,255,90,.18);border-color:rgba(74,255,90,.55)}
.fw-case-track .item.blue   {background:rgba(74,128,255,.18);border-color:rgba(74,128,255,.55)}
.fw-case-track .item.purple {background:rgba(180,74,255,.18);border-color:rgba(180,74,255,.55)}
.fw-case-track .item.orange {background:rgba(255,154,74,.18);border-color:rgba(255,154,74,.55)}
.fw-case-track .item.rainbow{background:conic-gradient(from 0deg, #ff5050, #ffce4a, #5ff09c, #6ed0d6, #a06aff, #ff5050);border-color:#fff}
.fw-case-result{margin-top:16px;font-family:'Bangers',sans-serif;font-size:24px;color:#5ff09c;letter-spacing:1.4px;opacity:0;transition:opacity .4s ease}
.fw-case-result.show{opacity:1}
.fw-case-close{margin-top:14px;background:rgba(255,206,74,.18);border:1px solid rgba(255,206,74,.5);color:#ffd64d;padding:9px 18px;border-radius:100px;font-family:'Orbitron',sans-serif;font-weight:900;font-size:11px;cursor:pointer;letter-spacing:.8px;display:none}
.fw-case-close.show{display:inline-block}
`;
    document.head.appendChild(carCss);

    const caseBg = document.createElement('div');
    caseBg.className = 'fw-case-bg';
    caseBg.innerHTML = '<div class="fw-case-card"><h2>💨 FARTING IN YOUR JAR</h2><div class="fw-case-strip"><div class="pin"></div><div class="fw-case-track" id="fwCaseTrack"></div></div><div class="fw-case-result" id="fwCaseResult">—</div><button class="fw-case-close" id="fwCaseClose">Continue</button></div>';
    document.body.appendChild(caseBg);
    document.getElementById('fwCaseClose').addEventListener('click', () => caseBg.classList.remove('show'));

    const TIERS = [
      { id: 'fartjar_green',   cls: 'green',   emoji: '🟢', name: 'Green Fart Jar',   weight: 60 },
      { id: 'fartjar_blue',    cls: 'blue',    emoji: '🔵', name: 'Blue Fart Jar',    weight: 25 },
      { id: 'fartjar_purple',  cls: 'purple',  emoji: '🟣', name: 'Purple Fart Jar',  weight: 10 },
      { id: 'fartjar_orange',  cls: 'orange',  emoji: '🟠', name: 'Orange Fart Jar',  weight: 4 },
      { id: 'fartjar_rainbow', cls: 'rainbow', emoji: '🌈', name: 'Rainbow Fart Jar', weight: 1 },
    ];
    function showJarReveal(tierId){
      const tier = TIERS.find(t => t.id === tierId) || TIERS[0];
      // Build a 60-item strip of weighted random tiers ending in the winner
      // exactly at the centre (item index 50).
      const items = [];
      function rndTier(){
        const total = TIERS.reduce((s, t) => s + t.weight, 0);
        let r = Math.random() * total;
        for(const t of TIERS){ r -= t.weight; if(r <= 0) return t; }
        return TIERS[0];
      }
      for(let i = 0; i < 60; i++){
        const t = (i === 50) ? tier : rndTier();
        items.push(t);
      }
      const track = document.getElementById('fwCaseTrack');
      track.innerHTML = items.map(t => '<div class="item ' + t.cls + '">' + t.emoji + '</div>').join('');
      track.style.transition = 'none';
      track.style.transform = 'translateX(0px)';
      caseBg.classList.add('show');
      document.getElementById('fwCaseResult').classList.remove('show');
      document.getElementById('fwCaseResult').textContent = '—';
      document.getElementById('fwCaseClose').classList.remove('show');
      // Force reflow, THEN measure the winner's real centre (the modal is now
      // visible so offsetLeft is valid). Measuring instead of assuming widths
      // fixes the ~12px misalignment from the track's 12px padding that made
      // the pin look like it landed on the neighbouring tier.
      void track.offsetWidth;
      const winnerEl = track.children[50];
      const stripW = track.parentElement.clientWidth;
      const finalOffset = winnerEl
        ? (stripW / 2) - (winnerEl.offsetLeft + winnerEl.offsetWidth / 2)
        : -(50 * 118) + (stripW / 2) - 59;
      track.style.transition = 'transform 4.2s cubic-bezier(.13,.84,.18,1)';
      track.style.transform = 'translateX(' + finalOffset + 'px)';
      setTimeout(() => {
        const res = document.getElementById('fwCaseResult');
        res.textContent = '✨ ' + tier.name;
        res.classList.add('show');
        document.getElementById('fwCaseClose').classList.add('show');
        try { window.playPurchaseSound?.(); } catch(_){}
      }, 4400);
    }
    window.showJarReveal = showJarReveal;
    window.addEventListener('fw:jarRoll', (e) => {
      try { showJarReveal(e.detail?.tierId); } catch(_){}
    });

    // ──────────────────────────────────────────────────────────────
    // 8) MOVE CROPS PANEL BELOW CHAT + RESTYLE
    // ──────────────────────────────────────────────────────────────
    function relocateCrops(){
      const crops = document.getElementById('cropsPanel') || document.querySelector('.crops-panel');
      const chat  = document.getElementById('chatPanel')  || document.querySelector('.chat-panel') || document.getElementById('chat');
      if(!crops || !chat) return;
      const r = chat.getBoundingClientRect();
      crops.style.setProperty('position', 'fixed', 'important');
      crops.style.setProperty('left', r.left + 'px', 'important');
      crops.style.setProperty('top', (r.bottom + 8) + 'px', 'important');
      crops.style.setProperty('right', 'auto', 'important');
      crops.style.setProperty('width', r.width + 'px', 'important');
      crops.style.setProperty('font-family', "'Outfit','Inter',sans-serif", 'important');
      const ch = window.getComputedStyle(chat).fontSize;
      if(ch) crops.style.setProperty('font-size', ch, 'important');
    }
    setInterval(relocateCrops, 800);

    console.log('[extras-v6be] ready');
  }
})();
