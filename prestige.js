// =================================================================
// prestige.js — Rank + Prestige system (Call of Duty 4 inspired).
//
//  • 55 levels, each mapped to a Fartprint-themed military rank with a
//    CoD4-style SVG insignia (chevrons → bars → leaves → eagle → stars).
//  • The rank insignia is shown in the XP box (top-left HUD), left of "Lv".
//  • A 🎖️ medal button (right rail) opens the RANK panel: your progress,
//    all 55 ranks, the 10 Prestige emblems, and the ENTER PRESTIGE option.
//  • At Level 55 you may PRESTIGE (optional, up to 10×). Prestige:
//      – resets your level to 1 and wipes the skill tree (fwResetSkills),
//      – therefore relocks the rocket (level-gated in rocket.js),
//      – grants a permanent, STACKING +10% silver earnings AND +10% skill
//        XP / skill-tree payouts per prestige,
//      – unlocks a prestige skin.
//
//  Exposes window.fwPrestige = { count, silverMult, xpMult, rank, maxLevel }.
//  State.prestige (0–10) is persisted in the main save.
// =================================================================
(function () {
  'use strict';

  const MAX_LEVEL = 55;
  const MAX_PRESTIGE = 10;
  const ROCKET_MIN_LEVEL = 30;            // rocket relocks below this after prestige
  window.FW_MAX_LEVEL = MAX_LEVEL;
  window.FW_ROCKET_MIN_LEVEL = ROCKET_MIN_LEVEL;

  // ── 19 rank tiers. Tiers 1–18 each span 3 levels (base / I / II);
  //    tier 19 is the single Level-55 capstone. ──
  const TIERS = [
    { name: 'Ink Recruit',          cat: 'enlisted', ins: { chev: 1 } },
    { name: 'Paper Private',        cat: 'enlisted', ins: { chev: 2 } },
    { name: 'Toner Corporal',       cat: 'enlisted', ins: { chev: 3 } },
    { name: 'Fart Sergeant',        cat: 'enlisted', ins: { chev: 3, rock: 1 } },
    { name: 'Staff Sergeant',       cat: 'enlisted', ins: { chev: 3, rock: 2 } },
    { name: 'Gunnery Gasser',       cat: 'enlisted', ins: { chev: 3, rock: 3 } },
    { name: 'Master Sergeant',      cat: 'enlisted', ins: { chev: 3, rock: 3, center: 'diamond' } },
    { name: 'Master Gun. Gasser',   cat: 'enlisted', ins: { chev: 3, rock: 3, center: 'star' } },
    { name: 'Brap Lieutenant',      cat: 'officer',  ins: { bar: 1, metal: 'gold' } },
    { name: 'Prime Lieutenant',     cat: 'officer',  ins: { bar: 1, metal: 'silver' } },
    { name: 'Printer Captain',      cat: 'officer',  ins: { bar: 2, metal: 'silver' } },
    { name: 'Methane Major',        cat: 'officer',  ins: { leaf: 1, metal: 'gold' } },
    { name: 'Sludge Lt. Colonel',   cat: 'officer',  ins: { leaf: 1, metal: 'silver' } },
    { name: 'Cartel Colonel',       cat: 'officer',  ins: { eagle: 1 } },
    { name: 'Brigadier Brainrot',   cat: 'general',  ins: { star: 1 } },
    { name: 'Major Gen. Gasious',   cat: 'general',  ins: { star: 2 } },
    { name: 'Skibidi Lt. General',  cat: 'general',  ins: { star: 3 } },
    { name: 'Fart General',         cat: 'general',  ins: { star: 4 } },
    { name: 'Supreme Brainrot Lord',cat: 'general',  ins: { star: 5 } },
  ];
  const SUFFIX = ['', ' I', ' II'];

  function rankForLevel(lv) {
    lv = Math.max(1, Math.min(MAX_LEVEL, lv | 0));
    if (lv >= MAX_LEVEL) return { tier: TIERS[18], name: TIERS[18].name, idx: 18 };
    const ti = Math.floor((lv - 1) / 3);            // 0..17
    const suf = SUFFIX[(lv - 1) % 3];
    return { tier: TIERS[ti], name: TIERS[ti].name + suf, idx: ti };
  }

  // ── SVG insignia renderer ──────────────────────────────────────
  const FIELD = {
    enlisted: ['#7c1717', '#3a0a0a', 'rgba(255,200,120,.55)'],
    officer:  ['#13283f', '#06121f', 'rgba(150,200,255,.5)'],
    general:  ['#1b1b10', '#080806', 'rgba(240,220,150,.5)'],
  };
  const GOLD = '#f4c430', SILVER = '#dfe6ee';

  function starPath(cx, cy, R) {
    const r = R * 0.45; let d = '';
    for (let i = 0; i < 10; i++) {
      const ang = -Math.PI / 2 + i * Math.PI / 5;
      const rad = (i % 2 === 0) ? R : r;
      const x = cx + Math.cos(ang) * rad, y = cy + Math.sin(ang) * rad;
      d += (i === 0 ? 'M' : 'L') + x.toFixed(1) + ',' + y.toFixed(1);
    }
    return d + 'Z';
  }
  function chevron(yBase) {
    return '<polyline points="22,' + yBase + ' 50,' + (yBase - 17) + ' 78,' + yBase +
      '" fill="none" stroke="' + GOLD + '" stroke-width="9" stroke-linejoin="round" stroke-linecap="round"/>';
  }
  function rocker(y) {
    return '<path d="M20,' + y + ' Q50,' + (y + 15) + ' 80,' + y +
      '" fill="none" stroke="' + GOLD + '" stroke-width="8" stroke-linecap="round"/>';
  }

  // spec → inner SVG markup (devices only), drawn on a 100×100 field
  function devices(ins) {
    let s = '';
    if (ins.chev) {
      const hasLower = ins.rock || ins.center;
      let base = hasLower ? 44 : 64;                 // bottom chevron baseline
      for (let i = 0; i < ins.chev; i++) s += chevron(base - i * 13);
    }
    if (ins.rock) { for (let j = 0; j < ins.rock; j++) s += rocker(54 + j * 12); }
    if (ins.center === 'diamond') s += '<rect x="42" y="42" width="16" height="16" transform="rotate(45 50 50)" fill="' + GOLD + '"/>';
    if (ins.center === 'star') s += '<path d="' + starPath(50, 50, 11) + '" fill="' + GOLD + '"/>';
    if (ins.bar) {
      const m = ins.metal === 'gold' ? GOLD : SILVER;
      if (ins.bar === 1) s += '<rect x="44" y="24" width="12" height="52" rx="3" fill="' + m + '" stroke="rgba(0,0,0,.4)" stroke-width="1.5"/>';
      else s += '<rect x="32" y="24" width="11" height="52" rx="3" fill="' + m + '" stroke="rgba(0,0,0,.4)" stroke-width="1.5"/>' +
                '<rect x="57" y="24" width="11" height="52" rx="3" fill="' + m + '" stroke="rgba(0,0,0,.4)" stroke-width="1.5"/>';
    }
    if (ins.leaf) {
      const m = ins.metal === 'gold' ? GOLD : SILVER;
      s += '<path d="M50,20 C66,32 68,52 50,82 C32,52 34,32 50,20 Z" fill="' + m + '" stroke="rgba(0,0,0,.35)" stroke-width="1.5"/>' +
           '<path d="M50,26 L50,76 M50,40 L40,46 M50,40 L60,46 M50,54 L41,60 M50,54 L59,60" stroke="rgba(0,0,0,.3)" stroke-width="1.6" fill="none"/>';
    }
    if (ins.eagle) {
      s += '<path d="M50,54 C34,34 16,42 8,52 C22,50 32,54 50,64 C68,54 78,50 92,52 C84,42 66,34 50,54 Z" fill="' + SILVER + '" stroke="rgba(0,0,0,.35)" stroke-width="1.2"/>' +
           '<circle cx="50" cy="46" r="6" fill="' + SILVER + '"/><path d="M50,40 L56,36 L50,34 Z" fill="' + GOLD + '"/>';
    }
    if (ins.star) {
      const n = ins.star;
      // Shrink + tighten as the count grows so 4–5 stars stay inside the field.
      const R = n >= 5 ? 8.5 : (n === 4 ? 9.5 : 11);
      const gap = n >= 5 ? 15 : (n === 4 ? 16.5 : 19);
      const total = (n - 1) * gap, x0 = 50 - total / 2;
      for (let i = 0; i < n; i++) s += '<path d="' + starPath(x0 + i * gap, 50, R) + '" fill="' + SILVER + '" stroke="rgba(0,0,0,.3)" stroke-width="1"/>';
    }
    return s;
  }

  function insigniaSVG(rank, size) {
    const cat = rank.tier.cat;
    const f = FIELD[cat];
    const id = 'rg' + Math.random().toString(36).slice(2, 7);
    return '<svg viewBox="0 0 100 100" width="' + size + '" height="' + size + '" xmlns="http://www.w3.org/2000/svg">' +
      '<defs><linearGradient id="' + id + '" x1="0" y1="0" x2="0" y2="1">' +
      '<stop offset="0" stop-color="' + f[0] + '"/><stop offset="1" stop-color="' + f[1] + '"/></linearGradient></defs>' +
      '<rect x="6" y="6" width="88" height="88" rx="20" fill="url(#' + id + ')" stroke="' + f[2] + '" stroke-width="3"/>' +
      devices(rank.tier.ins) + '</svg>';
  }

  // ── Prestige emblems (10 ornate circular badges) ───────────────
  const PRES = [
    { ring: '#b9742e', glyph: 'shield', tint: '#ffd9a0' },
    { ring: '#c9d2dc', glyph: 'star',   tint: '#ffffff' },
    { ring: '#37c06a', glyph: 'diamond',tint: '#c8ffd9' },
    { ring: '#d23b3b', glyph: 'cross',  tint: '#ffd0d0' },
    { ring: '#e0c24a', glyph: 'eye',    tint: '#fff3c0' },
    { ring: '#e08f2e', glyph: 'ring',   tint: '#ffe1b0' },
    { ring: '#cfd6de', glyph: 'wings',  tint: '#ffffff' },
    { ring: '#d23b3b', glyph: 'orb',    tint: '#ffd0d0' },
    { ring: '#e23b5a', glyph: 'star',   tint: '#ffd0da' },
    { ring: '#f4c430', glyph: 'cross',  tint: '#fff3c0' },
  ];
  function presGlyph(g, tint) {
    switch (g) {
      case 'star':    return '<path d="' + starPath(50, 52, 20) + '" fill="' + tint + '"/>';
      case 'diamond': return '<rect x="36" y="38" width="28" height="28" transform="rotate(45 50 52)" fill="' + tint + '"/>';
      case 'cross':   return '<path d="M44,30 H56 V46 H72 V58 H56 V74 H44 V58 H28 V46 H44 Z" fill="' + tint + '"/>';
      case 'eye':     return '<ellipse cx="50" cy="52" rx="22" ry="13" fill="' + tint + '"/><circle cx="50" cy="52" r="6" fill="#1a1a1a"/>';
      case 'ring':    return '<circle cx="50" cy="52" r="17" fill="none" stroke="' + tint + '" stroke-width="7"/>';
      case 'wings':   return '<path d="M50,52 C40,42 26,46 20,52 C30,50 40,54 50,60 C60,54 70,50 80,52 C74,46 60,42 50,52 Z" fill="' + tint + '"/>';
      case 'orb':     return '<circle cx="50" cy="52" r="16" fill="' + tint + '"/><circle cx="44" cy="46" r="5" fill="rgba(255,255,255,.7)"/>';
      default:        return '<path d="M50,30 L64,40 V60 L50,74 L36,60 V40 Z" fill="' + tint + '"/>'; // shield
    }
  }
  function prestigeSVG(n, size) {       // n = 1..10
    const p = PRES[(n - 1) % 10];
    const id = 'pg' + n;
    return '<svg viewBox="0 0 100 100" width="' + size + '" height="' + size + '" xmlns="http://www.w3.org/2000/svg">' +
      '<defs><radialGradient id="' + id + '" cx="0.5" cy="0.4" r="0.7">' +
      '<stop offset="0" stop-color="#23262c"/><stop offset="1" stop-color="#0c0e12"/></radialGradient></defs>' +
      '<circle cx="50" cy="50" r="46" fill="url(#' + id + ')" stroke="' + p.ring + '" stroke-width="6"/>' +
      '<circle cx="50" cy="50" r="46" fill="none" stroke="rgba(255,255,255,.12)" stroke-width="1.5"/>' +
      // Shrink every glyph uniformly + lift it so nothing pokes past the ring.
      '<g transform="translate(50 47) scale(0.74) translate(-50 -52)">' + presGlyph(p.glyph, p.tint) + '</g>' +
      '<text x="50" y="86" text-anchor="middle" font-family="Orbitron,sans-serif" font-weight="900" font-size="12" fill="' + p.ring + '">' + n + '</text>' +
      '</svg>';
  }

  // ── public API ─────────────────────────────────────────────────
  window.fwPrestige = {
    count:      () => (window.State && window.State.prestige) || 0,
    silverMult: () => 1 + 0.10 * (((window.State && window.State.prestige) || 0)),
    xpMult:     () => 1 + 0.10 * (((window.State && window.State.prestige) || 0)),
    rank:       () => rankForLevel((window.State && window.State.level) || 1),
    rankName:   () => rankForLevel((window.State && window.State.level) || 1).name,
    rankFor:    (lv) => rankForLevel(lv || 1).name,   // rank name for any level (NPC tags etc.)
    // Icon-only badge SVG for a level/prestige — prestige emblem if prestiged,
    // otherwise the rank insignia. Used on player/NPC name tags.
    iconFor:    (lv, pres, size) => ((pres || 0) > 0)
                  ? prestigeSVG(pres, size || 20)
                  : insigniaSVG(rankForLevel(lv || 1), size || 20),
    maxLevel:   MAX_LEVEL,
    maxPrestige:MAX_PRESTIGE,
  };

  function whenReady() {
    if (!window.State || !document.body || !document.querySelector('.hud-player')) {
      setTimeout(whenReady, 400); return;
    }
    init();
  }
  whenReady();

  function init() {
    const State = window.State;
    if (typeof State.prestige !== 'number') State.prestige = 0;
    const xpForLvl = (lv) => (typeof window.xpForLevel === 'function' ? window.xpForLevel(lv) : 100 * lv);
    const floater = (m, k) => { try { window.floater && window.floater(m, k || 'good'); } catch (_) {} };

    // ── styles ──
    const css = document.createElement('style');
    css.textContent = `
#fwRankBadge{display:flex;align-items:center;justify-content:center;width:40px;height:40px;flex:0 0 auto;
  margin-right:10px;cursor:pointer;position:relative;filter:drop-shadow(0 2px 4px rgba(0,0,0,.5))}
#fwRankBadge .pp{position:absolute;bottom:-3px;right:-4px;background:#0c0e12;border:1.5px solid #f4c430;color:#f4c430;
  font-family:'Orbitron',sans-serif;font-weight:900;font-size:8px;border-radius:7px;padding:0 3px;line-height:13px}
#fwRankBtn{position:absolute;top:458px;right:14px;width:42px;height:42px;border-radius:12px;
  background:rgba(8,18,11,.85);border:2px solid rgba(244,196,48,.5);color:#f4c430;font-size:20px;
  cursor:pointer;z-index:14;display:flex;align-items:center;justify-content:center;padding:0;pointer-events:auto;
  transition:transform .15s ease,border-color .15s ease,box-shadow .15s ease;box-shadow:0 6px 14px rgba(0,0,0,.35)}
#fwRankBtn:hover{background:rgba(244,196,48,.16);border-color:#f4c430;box-shadow:0 0 16px rgba(244,196,48,.3);transform:scale(1.05)}
.fw-rank-bg{position:fixed;inset:0;display:none;align-items:center;justify-content:center;background:rgba(0,0,0,.78);
  -webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px);z-index:212;padding:18px}
.fw-rank-bg.show{display:flex}
.fw-rank-card{width:min(620px,96vw);max-height:90vh;overflow:hidden;display:flex;flex-direction:column;
  background:linear-gradient(180deg,rgba(10,16,22,.98),rgba(5,9,14,.98));border:2px solid rgba(244,196,48,.5);
  border-radius:18px;color:#eef3f8;font-family:'Outfit','Inter',sans-serif;box-shadow:0 24px 60px rgba(0,0,0,.6)}
.fw-rank-card .hd{display:flex;align-items:center;gap:14px;padding:16px 20px;border-bottom:1px solid rgba(244,196,48,.18)}
.fw-rank-card .hd .now{width:64px;height:64px;flex:0 0 auto}
.fw-rank-card .hd .info{flex:1;min-width:0}
.fw-rank-card .hd .rk{font-family:'Bangers','Orbitron',sans-serif;font-size:22px;color:#f4c430;letter-spacing:1px;line-height:1.05}
.fw-rank-card .hd .lv{font-size:12px;color:rgba(230,238,248,.7);margin-top:2px}
.fw-rank-card .hd .x{background:transparent;border:0;color:rgba(230,238,248,.55);font-size:24px;cursor:pointer;align-self:flex-start}
.fw-rank-card .xpbar{height:8px;background:rgba(244,196,48,.12);border:1px solid rgba(244,196,48,.3);border-radius:5px;overflow:hidden;margin-top:7px}
.fw-rank-card .xpbar i{display:block;height:100%;background:linear-gradient(90deg,#f4c430,#fff1c2)}
.fw-rank-bd{padding:14px 20px 20px;overflow:auto}
.fw-rank-sec{font-size:11px;font-weight:800;letter-spacing:1.4px;text-transform:uppercase;color:#f4c430;margin:6px 0 10px}
.fw-pres-row{display:flex;flex-wrap:nowrap;gap:5px;margin-bottom:8px}
.fw-pres-row .pe{flex:1 1 0;min-width:0;aspect-ratio:1;border-radius:10px;display:flex;align-items:center;justify-content:center;
  background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.08);opacity:.32;filter:grayscale(.7)}
.fw-pres-row .pe.on{opacity:1;filter:none;border-color:rgba(244,196,48,.6);box-shadow:0 0 14px rgba(244,196,48,.25)}
.fw-pres-row .pe svg{width:100%;height:auto;display:block}
.fw-bonus{background:rgba(244,196,48,.07);border:1px solid rgba(244,196,48,.25);border-radius:10px;padding:10px 12px;font-size:12px;margin:10px 0;line-height:1.6}
.fw-bonus b{color:#f4c430}
.fw-pres-btn{width:100%;padding:13px;border:0;border-radius:12px;font-family:'Orbitron',sans-serif;font-weight:900;
  font-size:13px;letter-spacing:1px;text-transform:uppercase;cursor:pointer;background:linear-gradient(135deg,#f4c430,#fff1c2);color:#3a2a00}
.fw-pres-btn:disabled{opacity:.4;cursor:not-allowed;background:rgba(255,255,255,.1);color:rgba(255,255,255,.5)}
.fw-rank-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(54px,1fr));gap:5px;margin-top:6px}
.fw-rank-cell{display:flex;flex-direction:column;align-items:center;gap:2px;background:rgba(255,255,255,.03);
  border:1px solid rgba(255,255,255,.07);border-radius:9px;padding:5px 2px;opacity:.42;cursor:default}
.fw-rank-cell.reached{opacity:1}
.fw-rank-cell.cur{border-color:#f4c430;box-shadow:0 0 10px rgba(244,196,48,.3)}
.fw-rank-cell .lvn{font-size:10px;color:rgba(230,238,248,.7);font-family:'Orbitron',sans-serif;font-weight:700}
.fw-rank-cap{display:flex;flex-direction:column;align-items:center;gap:6px;margin:14px auto 2px;padding:16px 24px;
  max-width:300px;border:2px solid rgba(244,196,48,.55);border-radius:16px;background:rgba(244,196,48,.07);text-align:center;opacity:.5}
.fw-rank-cap.reached{opacity:1;box-shadow:0 0 24px rgba(244,196,48,.3)}
.fw-rank-cap .cap-nm{font-family:'Bangers','Orbitron',sans-serif;font-size:20px;color:#f4c430;letter-spacing:1px;line-height:1.05}
.fw-rank-cap .cap-lv{font-size:10px;font-weight:800;letter-spacing:1.4px;color:rgba(244,196,48,.85);font-family:'Orbitron',sans-serif}
.fw-warn-bg{position:fixed;inset:0;display:none;align-items:center;justify-content:center;background:rgba(0,0,0,.82);z-index:240;padding:20px}
.fw-warn-bg.show{display:flex}
.fw-warn{width:min(380px,94vw);background:linear-gradient(180deg,rgba(28,12,10,.98),rgba(16,6,5,.98));border:2px solid rgba(255,90,77,.6);
  border-radius:16px;padding:22px;text-align:center;color:#ffe4df;font-family:'Outfit','Inter',sans-serif;box-shadow:0 24px 60px rgba(0,0,0,.6)}
.fw-warn h2{font-family:'Bangers','Orbitron',sans-serif;color:#ff7a6e;font-size:24px;letter-spacing:1px;margin:0 0 10px}
.fw-warn p{font-size:13px;line-height:1.6;color:rgba(255,228,223,.85);margin:0 0 16px}
.fw-warn .btns{display:flex;gap:10px}
.fw-warn button{flex:1;padding:11px;border-radius:10px;font-family:'Orbitron',sans-serif;font-weight:800;font-size:12px;cursor:pointer;border:0}
.fw-warn .go{background:linear-gradient(135deg,#ff5a4d,#ffb4ab);color:#3a0a06}
.fw-warn .no{background:rgba(255,255,255,.1);color:rgba(255,255,255,.7)}
`;
    document.head.appendChild(css);

    // ── rank badge inside the XP-box (left of "Lv") ──
    const card = document.querySelector('.hud-player');
    const badge = document.createElement('div');
    badge.id = 'fwRankBadge';
    badge.title = 'Rank';
    card.insertBefore(badge, card.firstChild);
    badge.addEventListener('click', openPanel);

    let lastL = -1, lastP = -1;
    function refreshBadge() {
      const lv = State.level || 1, pr = State.prestige || 0;
      if (lv === lastL && pr === lastP) return;
      lastL = lv; lastP = pr;
      const rk = rankForLevel(lv);
      badge.innerHTML = insigniaSVG(rk, 40) + (pr > 0 ? '<span class="pp">' + pr + '★</span>' : '');
      badge.title = rk.name + (pr > 0 ? '  ·  Prestige ' + pr : '') + '  ·  Level ' + lv;
    }
    refreshBadge();
    setInterval(refreshBadge, 600);

    // ── medal button ──
    const btn = document.createElement('button');
    btn.id = 'fwRankBtn'; btn.className = 'fw-rank-btn'; btn.title = 'Ranks & Prestige'; btn.textContent = '\u{1F396}\u{FE0F}';
    (document.getElementById('hud') || document.body).appendChild(btn);
    btn.addEventListener('click', openPanel);

    // ── panel ──
    const bg = document.createElement('div'); bg.className = 'fw-rank-bg';
    document.body.appendChild(bg);
    bg.addEventListener('click', (e) => { if (e.target === bg) bg.classList.remove('show'); });

    function bonusText() {
      const pr = State.prestige || 0;
      const pct = pr * 10;
      if (pr === 0) return 'No prestige yet. Reach <b>Level 55</b> and prestige to start stacking bonuses.';
      return 'Active Prestige <b>' + pr + '</b> bonuses: <b>+' + pct + '%</b> silver earnings · <b>+' + pct + '%</b> skill-tree XP &amp; milestone payouts.';
    }

    function renderPanel() {
      const lv = State.level || 1, pr = State.prestige || 0;
      const rk = rankForLevel(lv);
      const atMax = lv >= MAX_LEVEL;
      const maxedPres = pr >= MAX_PRESTIGE;
      const need = xpForLvl(lv);
      const xpPct = atMax ? 100 : Math.max(0, Math.min(100, ((State.xp || 0) / need) * 100));

      // prestige emblems row
      let pe = '';
      for (let i = 1; i <= MAX_PRESTIGE; i++) pe += '<div class="pe' + (i <= pr ? ' on' : '') + '" title="Prestige ' + i + '">' + prestigeSVG(i, 46) + '</div>';

      // all 55 ranks
      let grid = '';
      for (let l = 1; l <= MAX_LEVEL - 1; l++) {
        const r = rankForLevel(l);
        const cls = (l === lv ? 'cur reached' : (l <= lv ? 'reached' : ''));
        grid += '<div class="fw-rank-cell ' + cls + '" title="' + r.name + ' · Level ' + l + '">' + insigniaSVG(r, 34) +
          '<span class="lvn">' + l + '</span></div>';
      }
      // Level 55 — the capstone, shown big + centred to make it the goal.
      const r55 = rankForLevel(MAX_LEVEL);
      const capCls = (lv >= MAX_LEVEL ? 'cur reached' : '');
      const cap = '<div class="fw-rank-cap ' + capCls + '" title="' + r55.name + ' · Level ' + MAX_LEVEL + '">' +
        insigniaSVG(r55, 88) +
        '<div class="cap-nm">' + r55.name + '</div>' +
        '<div class="cap-lv">★ Level 55 · Max Rank ★</div></div>';

      let presBtn;
      if (maxedPres) presBtn = '<button class="fw-pres-btn" disabled>★ Max Prestige (10) reached</button>';
      else if (atMax) presBtn = '<button class="fw-pres-btn" id="fwDoPres">\u{1F396}️ Enter Prestige ' + (pr + 1) + '</button>';
      else presBtn = '<button class="fw-pres-btn" disabled>Reach Level 55 to Prestige</button>';

      bg.innerHTML =
        '<div class="fw-rank-card">' +
          '<div class="hd"><div class="now">' + insigniaSVG(rk, 64) + '</div>' +
            '<div class="info"><div class="rk">' + rk.name + '</div>' +
              '<div class="lv">Level ' + lv + ' / ' + MAX_LEVEL + (pr > 0 ? '  ·  ★ Prestige ' + pr : '') + '</div>' +
              '<div class="xpbar"><i style="width:' + xpPct + '%"></i></div></div>' +
            '<button class="x" id="fwRankX">×</button></div>' +
          '<div class="fw-rank-bd">' +
            '<div class="fw-rank-sec">Prestige</div>' +
            '<div class="fw-pres-row">' + pe + '</div>' +
            '<div class="fw-bonus">' + bonusText() + '</div>' +
            presBtn +
            '<div class="fw-rank-sec" style="margin-top:18px">All Ranks</div>' +
            '<div class="fw-rank-grid">' + grid + '</div>' + cap +
          '</div>' +
        '</div>';
      bg.querySelector('#fwRankX').addEventListener('click', () => bg.classList.remove('show'));
      const dp = bg.querySelector('#fwDoPres');
      if (dp) dp.addEventListener('click', showWarn);
    }
    function openPanel() { renderPanel(); bg.classList.add('show'); }
    window.fwOpenRankPanel = openPanel;

    // ── prestige warning + action ──
    const warn = document.createElement('div'); warn.className = 'fw-warn-bg';
    document.body.appendChild(warn);
    warn.addEventListener('click', (e) => { if (e.target === warn) warn.classList.remove('show'); });
    function showWarn() {
      const next = (State.prestige || 0) + 1;
      warn.innerHTML =
        '<div class="fw-warn"><h2>⚠ Enter Prestige ' + next + '?</h2>' +
        '<p>This <b>resets your level to 1</b> and <b>wipes your entire skill tree</b>. You will lose rocket access until you reach Level ' + ROCKET_MIN_LEVEL + ' again.<br><br>' +
        'In return you keep a permanent, stacking <b>+10% silver</b> and <b>+10% skill XP &amp; payouts</b> (now +' + (next * 10) + '% total), plus a Prestige ' + next + ' skin. This cannot be undone.</p>' +
        '<div class="btns"><button class="no" id="fwPresNo">Cancel</button><button class="go" id="fwPresYes">Prestige</button></div></div>';
      warn.classList.add('show');
      warn.querySelector('#fwPresNo').addEventListener('click', () => warn.classList.remove('show'));
      warn.querySelector('#fwPresYes').addEventListener('click', doPrestige);
    }
    function doPrestige() {
      if ((State.level || 1) < MAX_LEVEL || (State.prestige || 0) >= MAX_PRESTIGE) { warn.classList.remove('show'); return; }
      State.prestige = (State.prestige || 0) + 1;
      State.level = 1;
      State.xp = 0;
      try { window.fwResetSkills && window.fwResetSkills(); } catch (_) {}
      State.prestigeSkins = State.prestigeSkins || [];
      if (!State.prestigeSkins.includes('prestige' + State.prestige)) State.prestigeSkins.push('prestige' + State.prestige);
      State.fwSawMaxRank = false;
      try { window.saveState && window.saveState(); window.updateHUD && window.updateHUD(); } catch (_) {}
      try { window.playLevelUpSound && window.playLevelUpSound(); } catch (_) {}
      warn.classList.remove('show');
      lastL = -1; refreshBadge();
      floater('\u{1F396}️ PRESTIGE ' + State.prestige + '! Skill tree reset · +' + (State.prestige * 10) + '% silver & skill XP forever', 'good');
      renderPanel();
    }

    console.log('[prestige] ready — ' + MAX_LEVEL + ' ranks, ' + MAX_PRESTIGE + ' prestiges. Prestige ' + (State.prestige || 0));
  }
})();
