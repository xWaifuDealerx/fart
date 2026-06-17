// =================================================================
// missions.js — MISSIONS panel (📜 button below the 🌳 skill tree).
//
// Two mission types:
//  • GENESIS MISSIONS — recommended for every player; teach the game.
//    #1 "Welcome to Fartprint" = the old tutorial (its top-right card
//    no longer auto-shows — it appears when you START this mission).
//  • EVENT MISSIONS — limited time, they EXPIRE.
//    #1 "Gold Rush": convert ALL your silver into gold in ONE bank
//    transaction. Ends January 1st, 2027.
//
// Completed missions can never be started again.
// =================================================================
(function(){
  'use strict';

  const MISSIONS = [
    {
      id: 'welcome', type: 'genesis', icon: '🎓',
      name: 'Welcome to Fartprint',
      desc: 'Learn the island’s core hustle — steal, scoop, melt, fart, profit. The classic five-step onboarding, now as your first mission.',
      steps: [
        'Steal Gary’s bicycle and sell it to Carlos',
        'Scoop sand at the beach',
        'Melt jars at the Glassworks',
        'Fill a jar at the Fart Filling Station',
        'Sell your Fart Jar to Gary',
      ],
      reward: { xp: 150, label: '+150 XP' },
      expires: null,
    },
    // ── Follow-up genesis missions (numbered after Welcome). No prose
    //    description — the step checklist says it all. ──
    {
      id: 'rock_bottom', type: 'genesis', icon: '⛏️', name: 'Rock Bottom', desc: '',
      steps: [
        'Buy a pickaxe from Carlos',
        'Mine any ore (Copper, Iron, Tin)',
        'Sell it to Traech',
      ],
      reward: { xp: 160, label: '+160 XP' }, expires: null,
    },
    {
      id: 'green_thumb', type: 'genesis', icon: '🌿', name: 'Green Thumb', desc: '',
      steps: [
        'Buy Weed Seeds from Carlos',
        'Rent a plot and plant your seeds',
        'Wait 10 minutes for it to grow',
        'Harvest your weed',
        'Sell it to Zoomkins, Mastrprintr or Printrn',
      ],
      reward: { xp: 180, label: '+180 XP' }, expires: null,
    },
    {
      id: 'pest_control', type: 'genesis', icon: '🕷️', name: 'Pest Control', desc: '',
      steps: [
        'Buy a gun and ammo at the Gunsmith',
        'Kill 10 spiders or rats',
      ],
      reward: { xp: 160, label: '+160 XP' }, expires: null,
    },
    {
      id: 'dirty_printing', type: 'genesis', icon: '🖨️', name: 'Dirty Printing', desc: '',
      steps: [
        'Buy ink and paper at Carlos’ market',
        'Go to a printer and print fake money (Shift+E)',
        'Launder the fake cash into real cash',
      ],
      reward: { xp: 200, label: '+200 XP' }, expires: null,
    },
    {
      id: 'toilet_warrior', type: 'genesis', icon: '🚽', name: 'Toilet Warrior', desc: '',
      steps: [
        'Rent a brainrot base',
        'Steal or grab a brainrot',
        'Plant it in one of your toilets',
      ],
      reward: { xp: 220, label: '+220 XP' }, expires: null,
    },
    {
      id: 'quick_nap', type: 'genesis', icon: '😴', name: 'Quick Nap', desc: '',
      steps: [
        'Check into a hotel',
        'Stay inside your room for 10 minutes',
      ],
      reward: { xp: 180, label: '+180 XP' }, expires: null,
    },
    {
      id: 'the_degen', type: 'genesis', icon: '🎰', name: 'The Degen', desc: '',
      steps: [
        'Trade some silver to cash with Moneycaller',
        'Win a round of any game at the Casino',
      ],
      reward: { xp: 200, label: '+200 XP' }, expires: null,
    },
    {
      id: 'the_investor', type: 'genesis', icon: '⛪', name: 'The Investor', desc: '',
      steps: [
        'Invest into the Fartology Church',
        'Claim a payout',
      ],
      reward: { xp: 220, label: '+220 XP' }, expires: null,
    },
    {
      id: 'the_tycoon', type: 'genesis', icon: '🏠', name: 'The Tycoon', desc: '',
      steps: [
        'Buy any apartment',
        'Sleep in it for 10 minutes',
      ],
      reward: { xp: 260, label: '+260 XP' }, expires: null,
    },
    {
      id: 'goldrush', type: 'event', icon: '🪙',
      name: 'Gold Rush',
      desc: 'The vaults are open and the rate won’t wait. Prove your faith in gold: dump your ENTIRE silver stack into 🪙 in a single transaction.',
      steps: [
        'Go to the Bank → Silver → Gold, type your FULL silver balance, and convert it all in ONE transaction',
      ],
      reward: { xp: 200, label: '+200 XP' },
      expires: Date.UTC(2027, 0, 1, 0, 0, 0),   // ends January 1st, 2027
    },
  ];

  // ── persisted state ──
  const KEY = 'fw.missions.v1';
  let M = { started: {}, done: {}, doneAt: {} };
  try { M = Object.assign(M, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch(_){}
  function save(){ try { localStorage.setItem(KEY, JSON.stringify(M)); } catch(_){} }

  function whenReady(){
    if(!window.State || !document.body){ setTimeout(whenReady, 400); return; }
    init();
  }
  whenReady();

  function init(){
    const State = window.State;

    function isExpired(ms){ return !!(ms.expires && Date.now() >= ms.expires); }
    // ONE MISSION AT A TIME — any type.
    function inProgress(){
      return MISSIONS.find(m => M.started[m.id] && !M.done[m.id] && !isExpired(m)) || null;
    }
    function complete(id){
      if(M.done[id]) return;
      const ms = MISSIONS.find(m => m.id === id);
      if(!ms) return;
      M.done[id] = true;
      M.doneAt[id] = Date.now();
      save();
      if(ms.reward?.xp){
        State.xp = (State.xp || 0) + ms.reward.xp;
        try { window.checkLevelUp?.(); window.saveState?.(); window.updateHUD?.(); } catch(_){}
      }
      window.floater?.('🏆 MISSION COMPLETE · ' + ms.name + ' · ' + (ms.reward?.label || ''), 'good');
      // green "task done" popup (Welcome already has its own done strip)
      if(id !== 'welcome'){ try { window.fwMissionTaskPop?.('🏆 ' + ms.name + ' complete!  ' + (ms.reward?.label || '')); } catch(_){} }
      try { window.playPurchaseSound?.(); } catch(_){}
      if(id === 'goldrush') hideGoldCard();
      try { updateTracker(); } catch(_){}
      renderIfOpen();
    }

    // ── Mission triggers ──
    // Welcome: the tutorial self-tracks State.tutStep (5 = finished)
    setInterval(() => {
      if(M.done.welcome) return;
      if((Number(State.tutStep) || 0) >= 5){
        // veterans who already finished the tutorial get it auto-completed
        if(!M.started.welcome){ M.started.welcome = true; }
        complete('welcome');
      }
    }, 2500);
    // Gold Rush: bank dispatches fw:goldConvert {spent, before}
    window.addEventListener('fw:goldConvert', (e) => {
      const ms = MISSIONS.find(m => m.id === 'goldrush');
      if(M.done.goldrush || !M.started.goldrush || isExpired(ms)) return;
      const d = e?.detail || {};
      if(d.before > 0 && d.spent >= d.before){
        complete('goldrush');
      } else if(d.spent > 0){
        window.floater?.('🪙 Gold Rush: that wasn’t ALL your silver — one full-balance transaction!', 'bad');
      }
    });
    // Fallback detector — works even if the deployed bank build doesn't
    // dispatch fw:goldConvert: silver dropped to exactly 0 while gold
    // grew between two checks = the full-balance conversion happened.
    let _grPrevSilver = null, _grPrevGold = 0;
    setInterval(() => {
      const ms = MISSIONS.find(m => m.id === 'goldrush');
      if(M.done.goldrush || !M.started.goldrush || isExpired(ms)){ _grPrevSilver = null; return; }
      const s = Number(State.credits) || 0;
      const g = Number(State.gold) || 0;
      if(_grPrevSilver !== null && _grPrevSilver > 0 && s === 0 && g > _grPrevGold){
        complete('goldrush');
      }
      _grPrevSilver = s; _grPrevGold = g;
    }, 2000);

    // ════════════════════════════════════════════════════════════════
    //  FOLLOW-UP MISSION DETECTORS (self-contained — no edits to other
    //  systems). We watch State deltas, inventory changes, open modals,
    //  and wrap window.fwSkillXp to count kills.
    // ════════════════════════════════════════════════════════════════
    function active(id){ return !!(M.started[id] && !M.done[id]); }

    // persistent progress (survives reloads)
    M.prog = M.prog || {};
    const PG = M.prog;
    function setProg(k, v){ PG[k] = v; save(); }

    const isOre = (id) => /_ore$/.test(id) || ['copper','tin','coal','gold_ore','iron_ore','copper_ore','tin_ore'].includes(id);
    function snapInv(){ const o = {}, inv = State.inventory || {}; for(const k in inv) o[k] = inv[k]; return o; }
    let _invSnap = snapInv();
    let _pCred = Number(State.credits) || 0;
    let _pPaper = Number(State.paper) || 0;
    let _pFake = Number(State.fakeMoney) || 0;
    const open = (sel) => !!document.querySelector(sel);

    setInterval(() => {
      const cred = Number(State.credits) || 0;
      const paper = Number(State.paper) || 0;
      const fake = Number(State.fakeMoney) || 0;
      const dC = cred - _pCred, dP = paper - _pPaper, dF = fake - _pFake;

      // inventory deltas
      const cur = State.inventory || {};
      let oreGained = false, oreLost = false, weedGained = false, weedLost = false;
      for(const k in cur){ const d = (cur[k] || 0) - (_invSnap[k] || 0);
        if(d > 0){ if(isOre(k)) oreGained = true; if(k === 'weed') weedGained = true; } }
      for(const k in _invSnap){ const d = (_invSnap[k] || 0) - (cur[k] || 0);
        if(d > 0){ if(isOre(k)) oreLost = true; if(k === 'weed') weedLost = true; } }
      _invSnap = snapInv();

      // Rock Bottom — mine an ore then sell it (silver goes up as ore leaves)
      if(active('rock_bottom')){
        if(oreGained && !PG.minedOre){ setProg('minedOre', true); flashTask('✓ Ore mined — now sell it to Traech!'); }
        if(PG.minedOre && oreLost && dC > 0) complete('rock_bottom');
      }
      // Green Thumb — harvest weed then sell it
      if(active('green_thumb')){
        if(weedGained && !PG.weedGot){ setProg('weedGot', true); flashTask('✓ Weed harvested — now go sell it!'); }
        if(PG.weedGot && weedLost && dC > 0) complete('green_thumb');
      }
      // Dirty Printing — print fake (fake goes up) then launder (fake goes down)
      if(active('dirty_printing')){
        if(dF > 0 && !PG.printed){ setProg('printed', true); flashTask('✓ Fake money printed — now launder it!'); }
        if(PG.printed && dF < 0) complete('dirty_printing');
      }
      // Toilet Warrior — a brainrot planted in one of your base toilets
      if(active('toilet_warrior')){
        const br = State.br;
        if(br && Array.isArray(br.toilets) && br.toilets.some(Boolean)) complete('toilet_warrior');
      }
      // The Degen — cash increases while the Casino is open = you won a round
      if(active('the_degen') && dP > 0 && open('.cas-bg.show')) complete('the_degen');
      // The Investor — silver increases while the Church is open = claimed payout
      if(active('the_investor') && dC > 0 && open('.church-bg.show')) complete('the_investor');
      // Quick Nap — 10 cumulative minutes inside a HOTEL room
      if(active('quick_nap')){
        if(open('.hot-sleep-bg.show')){ PG.hotelMs = (PG.hotelMs || 0) + 1000; save(); }
        if((PG.hotelMs || 0) >= 600000) complete('quick_nap');
      }
      // The Tycoon — 10 cumulative minutes inside your APARTMENT
      if(active('the_tycoon')){
        if(open('.apt-sleep-bg.show')){ PG.aptMs = (PG.aptMs || 0) + 1000; save(); }
        if((PG.aptMs || 0) >= 600000) complete('the_tycoon');
      }

      _pCred = cred; _pPaper = paper; _pFake = fake;
    }, 1000);

    // Pest Control — every spider/rat/pig kill grants 'weapon' XP (only kills
    // do), so wrap fwSkillXp and count them. Wrapped lazily + once.
    function wrapXp(){
      if(window.__msnXpWrap) return;
      if(typeof window.fwSkillXp !== 'function'){ setTimeout(wrapXp, 800); return; }
      const orig = window.fwSkillXp;
      window.fwSkillXp = function(skill, amt, node){
        try {
          if(skill === 'weapon' && active('pest_control')){
            PG.kills = (PG.kills || 0) + 1; save();
            const left = Math.max(0, 10 - PG.kills);
            if(PG.kills >= 10) complete('pest_control');
            else window.floater?.('🔫 Pest Control: ' + PG.kills + '/10 killed', 'good');
          }
        } catch(_){}
        return orig.apply(this, arguments);
      };
      window.__msnXpWrap = true;
    }
    wrapXp();

    // ════════════════════════════════════════════════════════════════
    //  ACTIVE-MISSION TRACKER CARD (top-right) — tells you what to do for
    //  the current mission, the same way the tutorial card does for Welcome.
    // ════════════════════════════════════════════════════════════════
    const trackCss = document.createElement('style');
    trackCss.textContent = `
.fw-msn-track{position:fixed;top:14px;right:14px;width:min(320px,42vw);z-index:59;
  background:linear-gradient(180deg,rgba(8,18,11,.96),rgba(5,14,9,.96));border:2px solid rgba(255,206,74,.55);
  border-radius:14px;padding:13px 15px;font-family:'Outfit','Inter',sans-serif;color:#fff1c2;
  box-shadow:0 14px 28px rgba(0,0,0,.55);display:none}
.fw-msn-track .hd{display:flex;align-items:center;gap:9px;margin-bottom:8px}
.fw-msn-track .hd .ic{font-size:22px}
.fw-msn-track .hd .nm{font-weight:800;font-size:14.5px;color:#ffd64d;flex:1;letter-spacing:.3px}
.fw-msn-track .hd .pill{font-family:'JetBrains Mono',monospace;font-size:9px;color:#ffd64d;
  background:rgba(255,206,74,.10);border:1px solid rgba(255,206,74,.4);border-radius:100px;padding:3px 8px;letter-spacing:.6px}
.fw-msn-track ol{padding-left:18px;margin:0;font-size:11.5px;color:rgba(230,255,238,.85);line-height:1.55}
.fw-msn-track ol li{margin-bottom:3px}
.fw-msn-track ol li.dn{color:#5ff09c;text-decoration:line-through;opacity:.8}
.fw-msn-track .prog{margin-top:9px;background:rgba(255,206,74,.10);border:1px solid rgba(255,206,74,.3);
  border-radius:8px;padding:6px 10px;font-family:'JetBrains Mono',monospace;font-size:11px;color:#ffe9b0;text-align:center;display:none}
.fw-msn-track .rw{margin-top:8px;font-size:10.5px;color:rgba(230,255,238,.55);text-align:right}
.fw-msn-pop{position:fixed;top:74px;left:50%;transform:translateX(-50%) translateY(-14px);opacity:0;z-index:61;
  background:linear-gradient(90deg,#5ff09c,#a8ffd0);color:#0a1410;padding:10px 18px;border-radius:10px;
  font-family:'Outfit','Inter',sans-serif;font-weight:800;font-size:13px;letter-spacing:.5px;text-align:center;
  box-shadow:0 10px 24px rgba(0,0,0,.45);pointer-events:none;
  transition:transform .35s cubic-bezier(.2,.7,.4,1),opacity .35s}
.fw-msn-pop.show{transform:translateX(-50%) translateY(0);opacity:1}

/* COMPACT one-row mission list so every mission fits without scrolling.
   Higher specificity (.fw-msn-card .fw-msn) so it wins over the base rules. */
.fw-msn-card .bd{padding:10px 16px 14px}
.fw-msn-card .fw-msn{display:flex;align-items:center;gap:9px;padding:7px 12px;margin-bottom:5px;border-radius:10px}
.fw-msn-card .fw-msn .ico{font-size:19px;flex:0 0 auto}
.fw-msn-card .fw-msn .nm{font-weight:800;font-size:13px;flex:1;min-width:0;letter-spacing:.2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.fw-msn-card .fw-msn .rew{font-family:'JetBrains Mono',monospace;font-size:9.5px;color:#ffe9b0;background:rgba(255,206,74,.08);border:1px solid rgba(255,206,74,.3);border-radius:7px;padding:3px 8px;white-space:nowrap;flex:0 0 auto}
.fw-msn-card .fw-msn .chip{padding:3px 8px;font-size:8.5px;flex:0 0 auto}
.fw-msn-card .fw-msn .go{margin:0;padding:6px 14px;font-size:9.5px;flex:0 0 auto}
.fw-msn-card .fw-msn .timer{margin:0;font-size:9px;flex:0 0 auto}
.fw-msn-card .fw-msn .locked{opacity:.5;font-size:15px;flex:0 0 auto;cursor:default}
.fw-msn-card .fw-msn-sec{margin:9px 4px 5px;font-size:10px}
.fw-msn-card .fw-msn-sec:first-child{margin-top:2px}
.fw-msn-card .fw-msn-sec small{display:none}
`;
    document.head.appendChild(trackCss);
    const trackCard = document.createElement('div');
    trackCard.className = 'fw-msn-track';
    trackCard.innerHTML = '<div class="hd"><span class="ic"></span><span class="nm"></span><span class="pill">MISSION</span></div>'
      + '<ol class="ol"></ol><div class="prog"></div><div class="rw"></div>';
    document.body.appendChild(trackCard);

    // green "task done" popup — same colours as the Welcome tutorial strip
    const taskPop = document.createElement('div');
    taskPop.className = 'fw-msn-pop';
    document.body.appendChild(taskPop);
    let _popTimer = null;
    function flashTask(text){
      taskPop.textContent = text;
      taskPop.classList.remove('show'); void taskPop.offsetWidth; taskPop.classList.add('show');
      try { window.floater?.(text, 'good'); } catch(_){}
      clearTimeout(_popTimer);
      _popTimer = setTimeout(() => taskPop.classList.remove('show'), 2800);
    }
    window.fwMissionTaskPop = flashTask;   // exposed for the detectors below

    function fmtMin(ms){ const s = Math.max(0, Math.floor(ms / 1000)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); }
    // which steps to show ticked, and an optional live status line, per mission
    function stepTicks(m){
      const p = M.prog || {};
      switch(m.id){
        case 'rock_bottom':   return [false, !!p.minedOre, false];
        case 'green_thumb':   return [false, false, false, !!p.weedGot, false];
        case 'dirty_printing':return [false, !!p.printed, false];
        default: return m.steps.map(() => false);
      }
    }
    function progLine(m){
      const p = M.prog || {};
      switch(m.id){
        case 'pest_control': return '🔫 Kills: ' + (p.kills || 0) + ' / 10';
        case 'quick_nap':    return '😴 In room: ' + fmtMin(p.hotelMs || 0) + ' / 10:00';
        case 'the_tycoon':   return '🛌 Sleeping: ' + fmtMin(p.aptMs || 0) + ' / 10:00';
        default: return '';
      }
    }
    function updateTracker(){
      const m = inProgress();
      // Welcome has its own tutorial card; everything else uses this tracker.
      if(!m || m.id === 'welcome'){ trackCard.style.display = 'none'; return; }
      const ticks = stepTicks(m);
      trackCard.querySelector('.ic').textContent = m.icon;
      trackCard.querySelector('.nm').textContent = m.name;
      trackCard.querySelector('.ol').innerHTML = m.steps
        .map((s, i) => '<li class="' + (ticks[i] ? 'dn' : '') + '">' + esc(s) + '</li>').join('');
      const status = progLine(m);
      const ps = trackCard.querySelector('.prog');
      ps.textContent = status; ps.style.display = status ? 'block' : 'none';
      trackCard.querySelector('.rw').textContent = '🎁 ' + (m.reward ? m.reward.label : '');
      trackCard.style.display = 'block';
    }
    // keep it synced every second (covers kill counts + sleep timers)
    setInterval(updateTracker, 1000);
    setTimeout(updateTracker, 600);

    // ── UI ──
    const css = document.createElement('style');
    css.textContent = `
.fw-msn-btn{position:fixed;top:404px;right:14px;width:42px;height:42px;border-radius:12px;
  background:rgba(8,18,11,.85);border:2px solid rgba(255,206,74,.45);color:#ffd64d;font-size:20px;
  cursor:pointer;z-index:33;display:flex;align-items:center;justify-content:center;padding:0;
  transition:transform .15s ease,border-color .15s ease,box-shadow .15s ease;box-shadow:0 6px 14px rgba(0,0,0,.35)}
.fw-msn-btn:hover{background:rgba(255,206,74,.18);border-color:#ffd64d;box-shadow:0 0 16px rgba(255,214,77,.30);transform:scale(1.05)}
.fw-msn-btn .ping{position:absolute;top:-3px;right:-3px;width:12px;height:12px;border-radius:50%;
  background:#ff5a4d;box-shadow:0 0 8px #ff5a4d;animation:fwMsnPing 1.6s ease-in-out infinite}
@keyframes fwMsnPing{0%,100%{transform:scale(1)}50%{transform:scale(1.35)}}
.fw-msn-bg{position:fixed;inset:0;display:none;align-items:center;justify-content:center;background:rgba(0,0,0,.8);
  -webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px);z-index:206;padding:18px}
.fw-msn-bg.show{display:flex}
.fw-msn-card{background:linear-gradient(180deg,rgba(10,22,14,.97),rgba(5,11,7,.98));border:2px solid rgba(255,206,74,.45);
  border-radius:18px;max-width:600px;width:100%;max-height:86vh;color:#e6ffee;font-family:'Outfit','Inter',sans-serif;
  display:flex;flex-direction:column;overflow:hidden}
.fw-msn-card .hd{display:flex;justify-content:space-between;align-items:center;padding:16px 22px;border-bottom:1px solid rgba(255,206,74,.18)}
.fw-msn-card .hd h2{font-family:'Bangers','Orbitron',sans-serif;font-size:24px;color:#ffd64d;letter-spacing:2px;margin:0}
.fw-msn-card .hd .x{background:transparent;border:0;color:rgba(230,255,238,.55);font-size:22px;cursor:pointer}
.fw-msn-card .bd{padding:14px 18px 20px;overflow-y:auto}
.fw-msn-sec{font-family:'Orbitron',sans-serif;font-weight:900;font-size:11px;letter-spacing:1.6px;margin:14px 4px 8px}
.fw-msn-sec:first-child{margin-top:2px}
.fw-msn-sec small{display:block;font-family:'Outfit',sans-serif;font-weight:500;font-size:10px;
  color:rgba(230,255,238,.45);letter-spacing:.4px;margin-top:2px;text-transform:none}
.fw-msn{background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.10);border-radius:14px;
  padding:14px 16px;margin-bottom:10px;transition:border-color .15s ease}
.fw-msn:hover{border-color:rgba(255,206,74,.4)}
.fw-msn .top{display:flex;align-items:center;gap:12px;margin-bottom:6px}
.fw-msn .ico{font-size:28px}
.fw-msn .nm{font-weight:800;font-size:15px;letter-spacing:.4px;flex:1}
.fw-msn .chip{font-family:'JetBrains Mono',monospace;font-size:9.5px;font-weight:700;letter-spacing:.8px;
  padding:4px 10px;border-radius:100px;white-space:nowrap}
.fw-msn .chip.new{background:rgba(95,240,156,.15);border:1px solid rgba(95,240,156,.5);color:#5ff09c}
.fw-msn .chip.prog{background:rgba(110,208,214,.15);border:1px solid rgba(110,208,214,.5);color:#6ed0d6}
.fw-msn .chip.done{background:rgba(255,206,74,.15);border:1px solid rgba(255,206,74,.55);color:#ffd64d}
.fw-msn .chip.exp{background:rgba(255,90,77,.12);border:1px solid rgba(255,90,77,.4);color:#ff7a6e}
.fw-msn .ds{font-size:12px;color:rgba(230,255,238,.7);line-height:1.5;margin-bottom:9px;font-style:italic}
.fw-msn .steps{margin-bottom:10px}
.fw-msn .step{display:flex;gap:8px;align-items:flex-start;font-size:11.5px;color:rgba(230,255,238,.8);
  padding:3px 0;line-height:1.45}
.fw-msn .step .tick{flex:0 0 16px;text-align:center}
.fw-msn .foot{display:flex;align-items:center;gap:10px}
.fw-msn .rew{font-family:'JetBrains Mono',monospace;font-size:10.5px;color:#ffe9b0;
  background:rgba(255,206,74,.08);border:1px solid rgba(255,206,74,.3);border-radius:8px;padding:4px 10px}
.fw-msn .timer{font-family:'JetBrains Mono',monospace;font-size:10px;color:#ff9a8e;margin-left:auto}
.fw-msn .go{background:linear-gradient(135deg,#5ff09c,#2ee06b);color:#04140a;border:0;padding:8px 18px;
  border-radius:100px;font-family:'Orbitron',sans-serif;font-weight:900;font-size:10.5px;text-transform:uppercase;
  letter-spacing:.7px;cursor:pointer;margin-left:auto;box-shadow:0 4px 14px rgba(46,224,107,.3);
  transition:transform .15s ease,box-shadow .15s ease}
.fw-msn .go:hover{transform:translateY(-1px);box-shadow:0 7px 18px rgba(46,224,107,.45)}
.fw-msn.is-done{opacity:.85;border-color:rgba(255,206,74,.35)}
.fw-msn.is-exp{opacity:.55}
.fw-msn .go.abort{background:linear-gradient(135deg,#ff7a6e,#ff5a4d);color:#1c0604;
  box-shadow:0 4px 14px rgba(255,90,77,.3)}
.fw-msn .go.abort:hover{box-shadow:0 7px 18px rgba(255,90,77,.45)}
.fw-msn-tip{position:fixed;z-index:320;pointer-events:none;display:none;max-width:280px;
  background:linear-gradient(165deg,rgba(24,20,8,.97),rgba(12,9,4,.98));
  border:1px solid rgba(255,206,74,.5);border-radius:12px;padding:11px 15px;
  font-family:'Outfit','Inter',sans-serif;color:#fff1c2;
  box-shadow:0 16px 40px rgba(0,0,0,.65),0 0 26px rgba(255,206,74,.12)}
.fw-msn-tip .tnm{font-family:'Bangers','Orbitron',sans-serif;font-size:16px;letter-spacing:1.2px;color:#ffd64d;margin-bottom:5px}
.fw-msn-tip .tds{font-size:11.5px;font-style:italic;color:rgba(255,241,194,.85);line-height:1.5}
`;
    document.head.appendChild(css);

    const btn = document.createElement('button');
    btn.className = 'fw-msn-btn';
    btn.title = 'Missions';
    btn.innerHTML = '📜' + (M.done.welcome && M.done.goldrush ? '' : '<span class="ping"></span>');
    document.body.appendChild(btn);

    const bg = document.createElement('div');
    bg.className = 'fw-msn-bg';
    bg.innerHTML = '<div class="fw-msn-card">'
      + '<div class="hd"><h2>📜 MISSIONS</h2><button class="x" id="fwMsnX">×</button></div>'
      + '<div class="bd" id="fwMsnBody"></div>'
      + '</div>';
    document.body.appendChild(bg);
    btn.addEventListener('click', () => { render(); bg.classList.add('show'); window.fwPanels?.closeOthers('missions'); });
    bg.querySelector('#fwMsnX').addEventListener('click', () => bg.classList.remove('show'));
    bg.addEventListener('click', (e) => { if(e.target === bg) bg.classList.remove('show'); });

    function fmtLeft(ms){
      const left = ms - Date.now();
      if(left <= 0) return 'EXPIRED';
      const d = Math.floor(left / 86400000);
      const h = Math.floor((left % 86400000) / 3600000);
      return d > 0 ? ('ends in ' + d + 'd ' + h + 'h') : ('ends in ' + h + 'h');
    }
    function esc(s){ return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;'); }

    function missionHtml(ms, num){
      const done = !!M.done[ms.id];
      const started = !!M.started[ms.id];
      const expired = !done && isExpired(ms);
      const chip = done ? '<span class="chip done">✓ COMPLETED</span>'
        : expired ? '<span class="chip exp">EXPIRED</span>'
        : started ? '<span class="chip prog">IN PROGRESS</span>'
        : '<span class="chip new">NEW</span>';
      // Steps are intentionally NOT listed here — you discover what to do once
      // you START the mission (the objective card guides you live). Compact
      // SINGLE-ROW layout so every mission fits on screen without scrolling.
      const timer = (ms.expires && !done) ? '<span class="timer">⏳ ' + fmtLeft(ms.expires) + '</span>' : '';
      let act = '';
      if(started && !done && !expired){
        act = '<button class="go abort" data-abort="' + ms.id + '">Abort</button>';
      } else if(!done && !expired && !started){
        // One mission at a time: a lock when another mission is running
        act = inProgress()
          ? '<span class="locked" title="Finish your current mission first">🔒</span>'
          : '<button class="go" data-start="' + ms.id + '">Start</button>';
      }
      const title = (num ? num + '. ' : '') + ms.name;
      return '<div class="fw-msn' + (done ? ' is-done' : '') + (expired ? ' is-exp' : '')
        + '" data-name="' + esc(title) + '" data-desc="' + esc(ms.desc) + '">'
        + '<span class="ico">' + ms.icon + '</span>'
        + '<span class="nm">' + esc(title) + '</span>'
        + '<span class="rew">🎁 ' + esc(ms.reward.label) + '</span>'
        + timer + chip + act
        + '</div>';
    }

    function render(){
      const host = document.getElementById('fwMsnBody');
      const gen = MISSIONS.filter(m => m.type === 'genesis')
        .map((m, i) => missionHtml(m, i + 1)).join('');
      const evt = MISSIONS.filter(m => m.type === 'event')
        .map(m => missionHtml(m, 0)).join('');
      host.innerHTML =
        '<div class="fw-msn-sec" style="color:#5ff09c">🧬 GENESIS MISSIONS'
        + '<small>Recommended for every printer — these teach you the game.</small></div>' + gen
        + '<div class="fw-msn-sec" style="color:#ff9a8e">⏳ EVENT MISSIONS'
        + '<small>Limited time only — complete them before they expire forever!</small></div>' + evt;
      host.querySelectorAll('[data-start]').forEach(b => {
        b.addEventListener('click', () => start(b.dataset.start));
      });
      host.querySelectorAll('[data-abort]').forEach(b => {
        b.addEventListener('click', () => abort(b.dataset.abort));
      });
    }

    // ── hover tooltip: mission descriptions only appear here ──
    const msnTip = document.createElement('div');
    msnTip.className = 'fw-msn-tip';
    document.body.appendChild(msnTip);
    bg.addEventListener('mousemove', (e) => {
      const card = e.target.closest?.('.fw-msn');
      if(!card || !card.dataset.desc){ msnTip.style.display = 'none'; return; }
      msnTip.innerHTML = '<div class="tnm">' + card.dataset.name + '</div>'
        + '<div class="tds">“' + card.dataset.desc + '”</div>';
      msnTip.style.display = 'block';
      const tw = msnTip.offsetWidth, th = msnTip.offsetHeight;
      let tx = e.clientX + 16, ty = e.clientY + 14;
      if(tx + tw > innerWidth - 8) tx = e.clientX - tw - 16;
      if(ty + th > innerHeight - 8) ty = e.clientY - th - 14;
      msnTip.style.left = tx + 'px';
      msnTip.style.top = ty + 'px';
    });
    bg.addEventListener('mouseleave', () => { msnTip.style.display = 'none'; });

    // ── abort: clears the in-progress mission + its explainer popup ──
    function abort(id){
      const ms = MISSIONS.find(m => m.id === id);
      if(!ms || !M.started[id] || M.done[id]) return;
      M.started[id] = false;
      save();
      if(id === 'goldrush') hideGoldCard();
      if(id === 'welcome'){
        // hide the tutorial card + mini pill and put the tutorial to sleep
        try {
          document.querySelectorAll('.tut-card, .tut-mini').forEach(el => { el.style.display = 'none'; });
          State.tutDismissed = true;
          window.saveState?.();
        } catch(_){}
      }
      window.floater?.('🚫 Mission aborted — ' + ms.name, 'bad');
      try { updateTracker(); } catch(_){}
      render();
    }
    function renderIfOpen(){ if(bg.classList.contains('show')) render(); }

    function start(id){
      const ms = MISSIONS.find(m => m.id === id);
      if(!ms || M.done[id] || isExpired(ms)) return;
      const busy = inProgress();
      if(busy){
        window.floater?.('📜 Finish “' + busy.name + '” first — one mission at a time!', 'bad');
        return;
      }
      M.started[id] = true;
      // reset any tracked progress for this mission so a fresh attempt starts
      // from zero (and a stale flag can't auto-complete it)
      if(M.prog){
        const reset = {
          rock_bottom: ['minedOre'], green_thumb: ['weedGot'],
          dirty_printing: ['printed'], pest_control: ['kills'],
          quick_nap: ['hotelMs'], the_tycoon: ['aptMs'],
        }[id];
        if(reset) reset.forEach(k => { delete M.prog[k]; });
      }
      // re-baseline the inventory snapshot so pre-start items aren't counted
      try { _invSnap = snapInv(); } catch(_){}
      save();
      try { updateTracker(); } catch(_){}
      window.floater?.(ms.icon + ' Mission started — ' + ms.name + '!', 'good');
      if(id === 'welcome'){
        if(window._fwTutBooted){
          // tutorial already booted this session (restart after an
          // abort): wake the card back up in place
          try {
            State.tutDismissed = false;
            window.saveState?.();
            document.querySelectorAll('.tut-card, .tut-mini').forEach(el => { el.style.display = ''; });
          } catch(_){}
        } else if(typeof window.fwStartTutorialNow === 'function'){
          // Boot the tutorial card on the spot — NO page reload.
          try { window.fwStartTutorialNow(); } catch(_){}
        } else {
          // old tutorial.js cached: fall back to the reload path
          setTimeout(() => { try { window.startTutorial?.(); } catch(_){} }, 400);
        }
      }
      if(id === 'goldrush') showGoldCard();
      render();
      bg.classList.remove('show');   // close the panel — go play!
    }

    // ── GOLD RUSH HUD card — tutorial-style, but gold ──
    let goldCard = null;
    function showGoldCard(){
      const ms = MISSIONS.find(m => m.id === 'goldrush');
      if(!ms || M.done.goldrush || isExpired(ms)) return;
      if(!goldCard){
        const gc = document.createElement('style');
        gc.textContent = `
.fw-gold-card{position:fixed;top:14px;right:14px;width:min(360px,42vw);
  background:linear-gradient(180deg,rgba(26,20,6,.96),rgba(16,12,4,.96));
  border:2px solid rgba(255,206,74,.65);border-radius:14px;padding:14px 16px;z-index:60;
  font-family:'Outfit','Inter',sans-serif;color:#fff1c2;
  box-shadow:0 14px 28px rgba(0,0,0,.55),0 0 34px rgba(255,206,74,.15)}
.fw-gold-card .hdr{display:flex;justify-content:space-between;align-items:center;margin-bottom:8px}
.fw-gold-card .pill{font-family:'JetBrains Mono',monospace;font-size:10.5px;color:#ffd64d;
  background:rgba(255,206,74,.12);border:1px solid rgba(255,206,74,.45);border-radius:100px;padding:3px 9px;letter-spacing:.6px}
.fw-gold-card .timer{font-family:'JetBrains Mono',monospace;font-size:10px;color:#ff9a8e}
.fw-gold-card h3{font-family:'Outfit',sans-serif;font-weight:800;font-size:14.5px;color:#ffd64d;margin-bottom:6px;letter-spacing:.4px;line-height:1.3}
.fw-gold-card .what{font-size:12px;color:#fff1c2;margin-bottom:8px;line-height:1.45;font-weight:600}
.fw-gold-card .how{font-size:11.5px;color:rgba(255,241,194,.8);line-height:1.55}
.fw-gold-card .how b{color:#ffd64d}
.fw-gold-card kbd{background:rgba(255,206,74,.18);border:1px solid rgba(255,206,74,.5);color:#ffd64d;
  padding:1px 6px;border-radius:5px;font-family:'JetBrains Mono',monospace;font-size:10px;font-weight:700}
`;
        document.head.appendChild(gc);
        goldCard = document.createElement('div');
        goldCard.className = 'fw-gold-card';
        document.body.appendChild(goldCard);
      }
      goldCard.innerHTML =
        '<div class="hdr"><span class="pill">⏳ EVENT MISSION</span><span class="timer" id="fwGoldLeft">' + fmtLeft(ms.expires) + '</span></div>'
        + '<h3>🪙 GOLD RUSH</h3>'
        + '<div class="what">Convert <b>ALL your silver</b> into Gold — in <b>ONE</b> transaction.</div>'
        + '<div class="how">Head to the <b>🏦 Bank</b> (west of the market) → <b>Silver → Gold</b> → type your <b>full silver balance</b> → convert. Partial swaps don’t count!</div>';
      goldCard.style.display = '';
    }
    function hideGoldCard(){ if(goldCard) goldCard.style.display = 'none'; }
    // restore card on load if the mission is live; keep countdown fresh
    // and GUARANTEE the card disappears once done/expired (5s sweep).
    if(M.started.goldrush && !M.done.goldrush) showGoldCard();
    setInterval(() => {
      const ms = MISSIONS.find(m => m.id === 'goldrush');
      if(M.done.goldrush || isExpired(ms)){ hideGoldCard(); return; }
      if(M.started.goldrush){
        const el = document.getElementById('fwGoldLeft');
        if(el) el.textContent = fmtLeft(ms.expires);
      }
    }, 5000);

    console.log('[missions] ready');
  }
})();
