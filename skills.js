// =================================================================
// skills.js — ALBION-STYLE SKILL TREE for FartWorld (v2).
//
// A radial "destiny board": central mastery hub, 9 glowing branches,
// specialization child-nodes for every ore type and weed strain.
// Lv 1→100 per node, milestone payout EVERY 5 LEVELS, weeks-long
// grind. Hover any node for a rich tooltip. Drag to pan, wheel to
// zoom — built to be fun to explore.
//
// XP intake: window.fwSkillXp(skillId, amount, subId?) — calls made
// before boot are buffered. Also hosts the panel-exclusivity manager
// (map / lb / settings / inv / pf / skills — only one open at once).
// =================================================================
(function(){
  'use strict';

  // ── Tree definition ──
  const SKILLS = [
    { id: 'mining',  name: 'Ore Mining',     icon: '⛏️', color: '#d9a85a', desc: 'The island’s rocks hide riches.', how: 'Mine ore deposits with your pickaxe (F near a deposit).' },
    { id: 'weapon',  name: 'Weapon Skills',  icon: '🔫', color: '#ff7a6e', desc: 'A printer with a Deagle fears nothing.', how: 'Kill spiders, score deathmatch kills, win matches.' },
    { id: 'weed',    name: 'Weed Skills',    icon: '🌿', color: '#5ff09c', desc: 'From seed to sale — the green economy.', how: 'Harvest weed plots and sell strains to the junkies.' },
    { id: 'fart',    name: 'Farting Skills', icon: '💨', color: '#ffd64d', desc: 'The art form this island is named after.', how: 'Fart (Space), gas spiders, fill jars at the FFS, sell jars to Gary.' },
    { id: 'data',    name: 'Data Skills',    icon: '💻', color: '#6ed0d6', desc: 'Shady ops in the Data Center.', how: 'Run and claim Data Center operations.' },
    { id: 'gamba',   name: 'Gamba Skills',   icon: '🎰', color: '#ff5ad6', desc: 'The reels remember your devotion.', how: 'Place cash bets at the Casino — bigger bets, more XP.' },
    { id: 'flying',  name: 'Flying Skills',  icon: '🛩️', color: '#a8e0ff', desc: 'Sky time makes the pilot.', how: 'Fly the Sea Plane — XP ticks while you’re moving in the air.' },
    { id: 'boating', name: 'Boating Skills', icon: '⛵', color: '#7ec8e3', desc: 'Salt, spray and throttle.', how: 'Drive the Tree Boat or Yacht — XP ticks while moving at sea.' },
    { id: 'petting', name: 'Petting Skills', icon: '🐈', color: '#ffae5a', desc: 'The cats know who you are.', how: 'Feed cats with cat food (G near a cat).' },
  ];
  const SUBS = {
    mining: [
      { id: 'copper', name: 'Copper Mining', icon: '🟠', color: '#d9885a', how: 'Mine Copper deposits (fast, common).' },
      { id: 'tin',    name: 'Tin Mining',    icon: '⬜', color: '#9fbcc0', how: 'Mine Tin deposits (medium).' },
      { id: 'iron',   name: 'Iron Mining',   icon: '🪨', color: '#b0b0bf', how: 'Mine Iron deposits (slow, valuable).' },
    ],
    weed: [
      { id: 'weed_dirt',      name: 'Dirt Weed',         icon: '🌱', color: '#7a8a4a', how: 'Harvest & sell Dirt Weed.' },
      { id: 'weed_pineapple', name: 'Pineapple Express', icon: '🍍', color: '#ffd64d', how: 'Harvest & sell Pineapple Express.' },
      { id: 'weed_diesel',    name: 'Sour Diesel',       icon: '⛽', color: '#9bdcff', how: 'Harvest & sell Sour Diesel.' },
      { id: 'weed_cosmic',    name: 'Cosmic Kush',       icon: '🌌', color: '#c084fc', how: 'Harvest & sell Cosmic Kush.' },
      { id: 'weed_unicorn',   name: 'Unicorn Poop',      icon: '🦄', color: '#ff5ad6', how: 'Harvest & sell the legendary Unicorn Poop.' },
    ],
  };
  const MAX_LVL = 100;

  // XP curve: total to Lv100 ≈ 449k per node → weeks of play.
  function needFor(l){ return Math.round(60 + l * l * 1.35); }
  // MILESTONE EVERY 5 LEVELS. Mains pay level×15 🥈, subs level×8 🥈.
  function milestoneBonus(l, isSub){ return l * (isSub ? 8 : 15); }

  // ── persisted state ──
  const KEY = 'fw.skills.v1';
  let S = {};
  try { S = JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch(_){}
  function ensure(map, id){ if(!map[id]) map[id] = { lvl: 1, xp: 0, paid: 0 }; return map[id]; }
  for(const sk of SKILLS) ensure(S, sk.id);
  if(!S.__subs) S.__subs = {};
  for(const k of Object.keys(SUBS)) for(const sub of SUBS[k]) ensure(S.__subs, sub.id);

  let saveT = null;
  function save(){
    if(saveT) return;
    saveT = setTimeout(() => {
      saveT = null;
      try { localStorage.setItem(KEY, JSON.stringify(S)); } catch(_){}
    }, 1200);
  }

  // ── XP intake ──
  let ready = false;
  const buffer = [];
  window.fwSkillXp = function(id, amount, sub){
    if(!ready){ buffer.push([id, amount, sub]); return; }
    grant(id, amount, sub);
  };

  function levelNode(st, def, amount, isSub){
    if(!st || st.lvl >= MAX_LVL || !amount || amount <= 0) return;
    // Prestige grants +10% skill XP per prestige (prestige.js).
    amount *= (window.fwPrestige ? window.fwPrestige.xpMult() : 1);
    st.xp += amount;
    let leveled = false;
    while(st.lvl < MAX_LVL && st.xp >= needFor(st.lvl)){
      st.xp -= needFor(st.lvl);
      st.lvl++;
      leveled = true;
    }
    if(leveled){
      window.floater?.(def.icon + ' ' + def.name + ' → Lv ' + st.lvl, 'good');
      try { window.playPurchaseSound?.(); } catch(_){}
      // milestone payouts every 5 levels (handles multi-jumps)
      let m = Math.floor(st.lvl / 5) * 5;
      while(m > st.paid && st.paid + 5 >= 5){
        const lvl = st.paid + 5;
        const bonus = Math.round(milestoneBonus(lvl, isSub) * (window.fwPrestige ? window.fwPrestige.silverMult() : 1));
        st.paid = lvl;
        const State = window.State;
        if(State){ State.credits = (State.credits || 0) + bonus; }
        window.floater?.('🏅 ' + def.name + ' Lv ' + lvl + ' milestone · +' + bonus + ' 🥈', 'good');
        try { window.updateHUD?.(); window.saveState?.(); } catch(_){}
      }
      try { window._fwSkillRenderIfOpen?.(); } catch(_){}
    }
  }

  // Full reset of the skill tree — called by prestige.js when you prestige.
  window.fwResetSkills = function(){
    S = {};
    for(const sk of SKILLS) ensure(S, sk.id);
    S.__subs = {};
    for(const k of Object.keys(SUBS)) for(const sub of SUBS[k]) ensure(S.__subs, sub.id);
    try { localStorage.setItem(KEY, JSON.stringify(S)); } catch(_){}
    try { window._fwSkillRenderIfOpen?.(); } catch(_){}
  };

  function grant(id, amount, sub){
    const def = SKILLS.find(s => s.id === id);
    if(def) levelNode(S[id], def, amount, false);
    if(sub){
      const subDef = (SUBS[id] || []).find(s => s.id === sub);
      if(subDef) levelNode(ensure(S.__subs, sub), subDef, amount, true);
    }
    save();
  }

  function whenReady(){
    if(!window.State || !document.body){ setTimeout(whenReady, 400); return; }
    init();
  }
  whenReady();

  function init(){
    // ──────────────────────────────────────────────────────────────
    // PANEL EXCLUSIVITY — only one big panel open at a time
    // ──────────────────────────────────────────────────────────────
    const PANELS = [
      { id: 'lb',       el: () => document.getElementById('lbBg') },
      { id: 'inv',      el: () => document.getElementById('invBg') },
      { id: 'pf',       el: () => document.getElementById('pfBg') },
      { id: 'settings', el: () => document.querySelector('.fw-set-bg') },
      { id: 'skills',   el: () => document.querySelector('.fw-skill-bg') },
      { id: 'missions', el: () => document.querySelector('.fw-msn-bg') },
    ];
    function closeOthers(except){
      if(except !== 'map'){ try { window.fwCloseMapFull?.(); } catch(_){} }
      for(const p of PANELS){
        if(p.id === except) continue;
        try { p.el()?.classList.remove('show'); } catch(_){}
      }
    }
    window.fwPanels = { closeOthers };
    const obs = new MutationObserver(muts => {
      for(const m of muts){
        const t = m.target;
        if(t.classList && t.classList.contains('show')){
          const p = PANELS.find(p => p.el() === t);
          if(p) closeOthers(p.id);
        }
      }
    });
    function arm(){
      for(const p of PANELS){
        const el = p.el();
        if(el && !el._fwArmed){
          el._fwArmed = true;
          obs.observe(el, { attributes: true, attributeFilter: ['class'] });
        }
      }
    }
    arm();
    setInterval(arm, 2000);

    // ──────────────────────────────────────────────────────────────
    // UI — destiny-board modal
    // ──────────────────────────────────────────────────────────────
    const css = document.createElement('style');
    css.textContent = `
.fw-skill-btn{position:fixed;top:350px;right:14px;width:42px;height:42px;border-radius:12px;
  background:rgba(8,18,11,.85);border:2px solid rgba(95,240,156,.45);color:#5ff09c;font-size:20px;
  cursor:pointer;z-index:33;display:flex;align-items:center;justify-content:center;padding:0;
  transition:transform .15s ease,border-color .15s ease,box-shadow .15s ease;box-shadow:0 6px 14px rgba(0,0,0,.35)}
.fw-skill-btn:hover{background:rgba(95,240,156,.18);border-color:#5ff09c;box-shadow:0 0 16px rgba(95,240,156,.30);transform:scale(1.05)}
.fw-skill-bg{position:fixed;inset:0;display:none;align-items:center;justify-content:center;background:rgba(2,5,3,.88);
  -webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px);z-index:205}
.fw-skill-bg.show{display:flex}
.fw-skill-board{position:relative;width:94vw;height:92vh;border-radius:20px;overflow:hidden;
  border:2px solid rgba(95,240,156,.35);
  background:
    radial-gradient(ellipse at 50% 50%, rgba(38,48,40,.9), rgba(12,16,12,.97) 75%),
    repeating-radial-gradient(circle at 50% 50%, transparent 0 90px, rgba(255,255,255,.018) 90px 92px);
  box-shadow:0 30px 80px rgba(0,0,0,.7), inset 0 0 120px rgba(0,0,0,.6)}
.fw-skill-board svg{width:100%;height:100%;display:block;cursor:grab;touch-action:none}
.fw-skill-board svg.panning{cursor:grabbing}
.fw-skill-hd{position:absolute;top:14px;left:20px;z-index:3;pointer-events:none}
.fw-skill-hd h2{font-family:'Bangers','Orbitron',sans-serif;font-size:26px;color:#5ff09c;letter-spacing:2.5px;margin:0;
  text-shadow:0 0 24px rgba(95,240,156,.45),0 2px 0 rgba(0,0,0,.8)}
.fw-skill-hd .sub{font-family:'Outfit',sans-serif;font-size:11px;color:rgba(230,255,238,.55);letter-spacing:1px}
.fw-skill-x{position:absolute;top:12px;right:14px;z-index:3;background:rgba(8,18,11,.8);border:1px solid rgba(255,90,77,.5);
  color:#ff7a6e;width:36px;height:36px;border-radius:10px;font-size:18px;cursor:pointer;transition:all .15s}
.fw-skill-x:hover{background:rgba(255,90,77,.2);box-shadow:0 0 14px rgba(255,90,77,.4)}
.fw-skill-hint{position:absolute;bottom:12px;left:0;right:0;text-align:center;z-index:3;pointer-events:none;
  font:600 10.5px 'Outfit',sans-serif;letter-spacing:1.2px;color:rgba(230,255,238,.4)}
/* node animations */
@keyframes fwNodeIn{from{opacity:0;transform:scale(.3)}to{opacity:1;transform:scale(1)}}
.fw-sk-node{animation:fwNodeIn .5s cubic-bezier(.34,1.56,.64,1) backwards;cursor:pointer}
.fw-sk-node:hover .fw-sk-medal{filter:brightness(1.5) drop-shadow(0 0 14px rgba(255,255,255,.55))}
.fw-sk-medal{transition:filter .15s ease}
/* tooltip */
.fw-sk-tip{position:fixed;z-index:300;pointer-events:none;display:none;max-width:280px;
  background:linear-gradient(165deg,rgba(14,28,18,.97),rgba(6,14,9,.98));
  border:1px solid rgba(95,240,156,.5);border-radius:14px;padding:12px 16px;
  font-family:'Outfit','Inter',sans-serif;color:#e6ffee;
  box-shadow:0 16px 40px rgba(0,0,0,.65),0 0 30px rgba(95,240,156,.12),inset 0 1px 0 rgba(255,255,255,.07)}
.fw-sk-tip .tnm{font-family:'Bangers','Orbitron',sans-serif;font-size:18px;letter-spacing:1.4px;margin-bottom:1px}
.fw-sk-tip .tlv{font-family:'Orbitron',sans-serif;font-weight:900;font-size:11px;color:#ffd64d;margin-bottom:7px}
.fw-sk-tip .tbar{height:8px;background:rgba(255,255,255,.08);border-radius:100px;overflow:hidden;margin-bottom:4px}
.fw-sk-tip .tbf{height:100%;border-radius:100px;box-shadow:0 0 8px currentColor}
.fw-sk-tip .txp{font-family:'JetBrains Mono',monospace;font-size:9.5px;color:rgba(230,255,238,.55);margin-bottom:8px}
.fw-sk-tip .tds{font-size:11.5px;font-style:italic;color:rgba(230,255,238,.75);margin-bottom:7px;line-height:1.45}
.fw-sk-tip .thow{font-size:10.5px;color:rgba(168,224,255,.85);line-height:1.45;margin-bottom:7px}
.fw-sk-tip .thow b{color:#a8e0ff}
.fw-sk-tip .tms{font-size:10.5px;background:rgba(255,206,74,.10);border:1px solid rgba(255,206,74,.35);
  border-radius:8px;padding:5px 9px;color:#ffe9b0}
.fw-sk-tip .tms b{color:#ffd64d}
`;
    document.head.appendChild(css);

    const btn = document.createElement('button');
    btn.className = 'fw-skill-btn';
    btn.title = 'Skill Tree';
    btn.textContent = '🌳';
    document.body.appendChild(btn);

    const bg = document.createElement('div');
    bg.className = 'fw-skill-bg';
    bg.innerHTML = '<div class="fw-skill-board">'
      + '<div class="fw-skill-hd"><h2>🌳 DESTINY BOARD</h2><div class="sub" id="fwSkillTotals"></div></div>'
      + '<button class="fw-skill-x" id="fwSkillX">✕</button>'
      + '<svg id="fwSkillSvg" xmlns="http://www.w3.org/2000/svg"></svg>'
      + '<div class="fw-skill-hint">DRAG TO EXPLORE · SCROLL TO ZOOM · HOVER A NODE FOR DETAILS</div>'
      + '</div>';
    document.body.appendChild(bg);
    const tip = document.createElement('div');
    tip.className = 'fw-sk-tip';
    document.body.appendChild(tip);

    btn.addEventListener('click', () => { render(); bg.classList.add('show'); });
    bg.querySelector('#fwSkillX').addEventListener('click', () => { bg.classList.remove('show'); tip.style.display = 'none'; });
    bg.addEventListener('click', (e) => { if(e.target === bg){ bg.classList.remove('show'); tip.style.display = 'none'; } });
    arm();

    // ── layout math ──
    const svg = bg.querySelector('#fwSkillSvg');
    const W = 2000, H = 2000, CX = 1000, CY = 1000;
    const R_MAIN = 330, R_SUB = 620;
    const view = { x: 0, y: 0, k: 1 };
    function applyView(){
      const vw = W / view.k, vh = H / view.k;
      svg.setAttribute('viewBox', (CX - vw / 2 + view.x) + ' ' + (CY - vh / 2 + view.y) + ' ' + vw + ' ' + vh);
    }

    function nodePos(i, total, radius, baseA, spread){
      // place i of total within [baseA-spread/2, baseA+spread/2]
      const a = total <= 1 ? baseA : baseA - spread / 2 + (i / (total - 1)) * spread;
      return { x: CX + Math.cos(a) * radius, y: CY + Math.sin(a) * radius, a };
    }

    function esc(s){ return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;'); }

    function render(){
      // header totals
      let lvls = 0, maxed = 0, nodes = 0;
      const every = [];
      for(const sk of SKILLS){ every.push([S[sk.id], sk, false]); }
      for(const k of Object.keys(SUBS)) for(const sub of SUBS[k]) every.push([S.__subs[sub.id], sub, true]);
      for(const [st] of every){ lvls += st.lvl; nodes++; if(st.lvl >= MAX_LVL) maxed++; }
      document.getElementById('fwSkillTotals').textContent =
        'TOTAL MASTERY ' + lvls + ' / ' + (nodes * MAX_LVL) + (maxed ? ' · ' + maxed + ' MAXED 🏆' : '');

      let lines = '', nodesSvg = '', delay = 0;

      function lineWithProgress(x0, y0, x1, y1, color, frac, width){
        const len = Math.hypot(x1 - x0, y1 - y0);
        let s = '<line x1="' + x0 + '" y1="' + y0 + '" x2="' + x1 + '" y2="' + y1
          + '" stroke="rgba(120,130,125,.30)" stroke-width="' + (width + 3) + '" stroke-linecap="round"/>';
        if(frac > 0.005){
          s += '<line x1="' + x0 + '" y1="' + y0 + '" x2="' + x1 + '" y2="' + y1
            + '" stroke="' + color + '" stroke-width="' + width + '" stroke-linecap="round"'
            + ' stroke-dasharray="' + (len * frac).toFixed(1) + ' ' + len.toFixed(1) + '"'
            + ' style="filter:drop-shadow(0 0 5px ' + color + ')" opacity=".9"/>';
        }
        return s;
      }
      function studs(x0, y0, x1, y1, lvl, color){
        // 9 studs along the spoke = Lv 10,20,…,90; lit when reached
        let s = '';
        for(let i = 1; i <= 9; i++){
          const t = 0.18 + (i / 10) * 0.74;
          const sx = x0 + (x1 - x0) * t, sy = y0 + (y1 - y0) * t;
          const lit = lvl >= i * 10;
          s += '<circle cx="' + sx + '" cy="' + sy + '" r="' + (lit ? 5 : 3.5) + '" fill="'
            + (lit ? color : 'rgba(70,78,72,.8)') + '"'
            + (lit ? ' style="filter:drop-shadow(0 0 5px ' + color + ')"' : '') + '/>';
        }
        return s;
      }
      function medal(x, y, r, def, st, isSub, isHub){
        const lit = st ? (st.lvl > 1 || st.xp > 0) : true;
        const ring = lit ? def.color : 'rgba(120,130,125,.55)';
        const maxedN = st && st.lvl >= MAX_LVL;
        delay += 0.03;
        return '<g class="fw-sk-node" data-id="' + (def.id || 'hub') + '" data-sub="' + (isSub ? 1 : 0)
          + '" style="animation-delay:' + delay.toFixed(2) + 's">'
          + '<g class="fw-sk-medal">'
          + '<circle cx="' + x + '" cy="' + y + '" r="' + (r + 7) + '" fill="rgba(0,0,0,.45)"/>'
          + '<circle cx="' + x + '" cy="' + y + '" r="' + r + '" fill="rgba(10,18,13,.96)" stroke="' + ring
          + '" stroke-width="' + (isHub ? 5 : 3.5) + '"'
          + (lit ? ' style="filter:drop-shadow(0 0 ' + (maxedN ? 18 : 9) + 'px ' + ring + ')"' : '') + '/>'
          + (maxedN ? '<circle cx="' + x + '" cy="' + y + '" r="' + (r + 12) + '" fill="none" stroke="#ffd64d" stroke-width="2" stroke-dasharray="6 7" opacity=".85"/>' : '')
          + '<text x="' + x + '" y="' + (y + r * 0.12) + '" text-anchor="middle" font-size="' + Math.round(r * 0.95)
          + '" dominant-baseline="middle">' + def.icon + '</text>'
          + (st
            ? '<rect x="' + (x - 26) + '" y="' + (y + r + 4) + '" width="52" height="21" rx="10" fill="rgba(5,10,7,.92)" stroke="' + ring + '" stroke-width="1.4"/>'
              + '<text x="' + x + '" y="' + (y + r + 19) + '" text-anchor="middle" font-size="13" font-weight="800" fill="'
              + (maxedN ? '#ffd64d' : '#e6ffee') + '" font-family="Outfit,sans-serif">' + st.lvl + '</text>'
            : '')
          + '</g></g>';
      }

      for(let i = 0; i < SKILLS.length; i++){
        const def = SKILLS[i];
        const st = S[def.id];
        const baseA = -Math.PI / 2 + (i / SKILLS.length) * Math.PI * 2;
        const p = nodePos(0, 1, R_MAIN, baseA, 0);
        lines += lineWithProgress(CX, CY, p.x, p.y, def.color, st.lvl / MAX_LVL, 5);
        lines += studs(CX, CY, p.x, p.y, st.lvl, def.color);
        // children fan out beyond the parent
        const kids = SUBS[def.id] || [];
        for(let j = 0; j < kids.length; j++){
          const sub = kids[j];
          const sst = S.__subs[sub.id];
          const spread = (kids.length - 1) * 0.30;
          const cp = nodePos(j, kids.length, R_SUB, baseA, spread);
          lines += lineWithProgress(p.x, p.y, cp.x, cp.y, sub.color, sst.lvl / MAX_LVL, 3.5);
          nodesSvg += medal(cp.x, cp.y, 34, sub, sst, true, false);
        }
        nodesSvg += medal(p.x, p.y, 46, def, st, false, false);
      }
      // hub last (on top)
      nodesSvg += medal(CX, CY, 60, { id: 'hub', icon: '💨', name: 'Printr Mastery', color: '#5ff09c' }, null, false, true);

      svg.innerHTML = '<g>' + lines + nodesSvg + '</g>';
      applyView();
    }
    window._fwSkillRenderIfOpen = () => { if(bg.classList.contains('show')) render(); };

    // ── tooltip ──
    function findDef(id, isSub){
      if(id === 'hub') return null;
      if(isSub){
        for(const k of Object.keys(SUBS)){
          const d = SUBS[k].find(s => s.id === id);
          if(d) return { def: d, st: S.__subs[id], isSub: true };
        }
        return null;
      }
      const d = SKILLS.find(s => s.id === id);
      return d ? { def: d, st: S[d.id], isSub: false } : null;
    }
    svg.addEventListener('mousemove', (e) => {
      const g = e.target.closest?.('.fw-sk-node');
      if(!g){ tip.style.display = 'none'; return; }
      const id = g.dataset.id, isSub = g.dataset.sub === '1';
      let html = '';
      if(id === 'hub'){
        let lvls = 0, n = 0;
        for(const sk of SKILLS){ lvls += S[sk.id].lvl; n++; }
        for(const k of Object.keys(SUBS)) for(const s2 of SUBS[k]){ lvls += S.__subs[s2.id].lvl; n++; }
        html = '<div class="tnm" style="color:#5ff09c">💨 PRINTR MASTERY</div>'
          + '<div class="tlv">TOTAL LEVEL ' + lvls + ' / ' + (n * MAX_LVL) + '</div>'
          + '<div class="tds">Every fart, every swing of the pickaxe, every bet — it all flows back here. Max the board and become a legend of the island.</div>';
      } else {
        const f = findDef(id, isSub);
        if(!f){ tip.style.display = 'none'; return; }
        const { def, st } = f;
        const maxed = st.lvl >= MAX_LVL;
        const need = maxed ? 1 : needFor(st.lvl);
        const pct = maxed ? 100 : Math.min(100, st.xp / need * 100);
        const nextMs = Math.min(MAX_LVL, (Math.floor(st.lvl / 5) + 1) * 5);
        html = '<div class="tnm" style="color:' + def.color + '">' + def.icon + ' ' + esc(def.name).toUpperCase() + '</div>'
          + '<div class="tlv">LEVEL ' + st.lvl + ' / ' + MAX_LVL + (maxed ? ' · MASTERED 🏆' : '') + '</div>'
          + '<div class="tbar"><div class="tbf" style="width:' + pct.toFixed(1) + '%;background:' + def.color + ';color:' + def.color + '"></div></div>'
          + (maxed ? '' : '<div class="txp">' + Math.round(st.xp) + ' / ' + need + ' XP to next level</div>')
          + (def.desc ? '<div class="tds">“' + esc(def.desc) + '”</div>' : '')
          + '<div class="thow"><b>HOW TO TRAIN:</b> ' + esc(def.how) + '</div>'
          + (maxed
              ? '<div class="tms"><b>Board complete.</b> Total milestones collected: ' + (st.paid / 5) + '</div>'
              : '<div class="tms">Next milestone <b>Lv ' + nextMs + '</b> → <b>+' + milestoneBonus(nextMs, isSub) + ' 🥈</b> (every 5 levels)</div>');
      }
      tip.innerHTML = html;
      tip.style.display = 'block';
      const tw = tip.offsetWidth, th = tip.offsetHeight;
      let tx = e.clientX + 18, ty = e.clientY + 14;
      if(tx + tw > innerWidth - 8) tx = e.clientX - tw - 18;
      if(ty + th > innerHeight - 8) ty = e.clientY - th - 14;
      tip.style.left = tx + 'px';
      tip.style.top = ty + 'px';
    });
    svg.addEventListener('mouseleave', () => { tip.style.display = 'none'; });

    // ── pan + zoom ──
    let panning = false, px0 = 0, py0 = 0;
    svg.addEventListener('pointerdown', (e) => {
      panning = true; px0 = e.clientX; py0 = e.clientY;
      svg.classList.add('panning');
      svg.setPointerCapture?.(e.pointerId);
    });
    window.addEventListener('pointerup', () => { panning = false; svg.classList.remove('panning'); });
    svg.addEventListener('pointermove', (e) => {
      if(!panning) return;
      const scale = (W / view.k) / svg.clientWidth;
      view.x -= (e.clientX - px0) * scale;
      view.y -= (e.clientY - py0) * scale;
      px0 = e.clientX; py0 = e.clientY;
      applyView();
    });
    svg.addEventListener('wheel', (e) => {
      e.preventDefault();
      view.k = Math.max(0.55, Math.min(3, view.k * Math.pow(1.0015, -e.deltaY)));
      applyView();
    }, { passive: false });

    // ──────────────────────────────────────────────────────────────
    // PASSIVE XP — flying & boating (10s ticks while moving)
    // ──────────────────────────────────────────────────────────────
    let lastPX = 0, lastPZ = 0;
    setInterval(() => {
      const P = window.Player;
      if(!P || !P.pos || !P.boat){ if(P && P.pos){ lastPX = P.pos.x; lastPZ = P.pos.z; } return; }
      const moved = Math.hypot(P.pos.x - lastPX, P.pos.z - lastPZ);
      lastPX = P.pos.x; lastPZ = P.pos.z;
      if(moved < 2) return;
      if(P.boat.isRocket) return;
      if(P.boat.isPlane) grant('flying', 3);
      else grant('boating', 3);
    }, 10000);

    // Event XP from the reveal carousels (with strain specialization)
    window.addEventListener('fw:weedRoll', (e) => {
      grant('weed', 12, e?.detail?.tierId || null);
    });
    window.addEventListener('fw:jarRoll', () => grant('fart', 6));

    // flush pre-boot XP
    ready = true;
    while(buffer.length){
      const [id, amount, sub] = buffer.shift();
      grant(id, amount, sub);
    }

    console.log('[skills] destiny board ready');
  }
})();
