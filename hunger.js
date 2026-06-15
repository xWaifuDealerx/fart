// =================================================================
// hunger.js — Hunger meter. A 🍎 apple pill docked between the compass
// and the health bar (compass → hunger → health → minimap).
//   • Hunger slowly drains over time while you play.
//   • Right-click a consumable in your inventory to eat it (restores
//     energy). Meats give a little; bakery goods give various amounts.
//   • While sleeping at the Hotel or an apartment you own
//     (window.fwSleeping), hunger slowly recovers.
//   • At 0 hunger you start to starve (slow HP loss, never fatal).
//   State.hunger (0–100) persists via the main save.
// =================================================================
(function () {
  'use strict';

  // energy each consumable restores when eaten (item id → energy)
  const ENERGY = {
    rat_meat: 8, pork_meat: 12, spider_meat: 1,         // spider meat is tiny — +1 only
    bake_sourdough: 24, bake_bun: 14, bake_whip: 6, bake_butter: 6,
    bake_wsugar: 5, bake_bsugar: 5, bake_donut: 18,
    bake_cinnamon: 22, bake_cupcake: 16, bake_cookie: 8, // bakery — various
  };
  window.fwHungerEnergy = ENERGY;

  const MAX = 100;
  const DECAY_S   = 16;   // -1 hunger every 16s of play
  const RECOVER_S = 3;    // +1 hunger every 3s while sleeping
  const STARVE_S  = 10;   // at 0 hunger, lose HP every 10s

  function whenReady() {
    if (!window.State || !document.body) { setTimeout(whenReady, 400); return; }
    init();
  }
  whenReady();

  function init() {
    const State = window.State;
    if (typeof State.hunger !== 'number') State.hunger = 100;

    const css = document.createElement('style');
    css.textContent = `
.hunger-pill{position:fixed;z-index:46;background:rgba(8,18,11,.94);border:2px solid rgba(95,240,156,.55);
  border-radius:12px;padding:6px 10px;display:none;align-items:center;gap:8px;
  font-family:'Outfit','Inter',sans-serif;color:#fff1c2;box-shadow:0 6px 16px rgba(0,0,0,.4)}
.hunger-pill .icon{font-size:14px;line-height:1}
.hunger-pill .bar{flex:1 1 auto;width:auto;height:12px;background:rgba(95,240,156,.18);border:1px solid rgba(95,240,156,.45);
  border-radius:100px;overflow:hidden;position:relative}
.hunger-pill .fill{position:absolute;left:0;top:0;bottom:0;width:100%;
  background:linear-gradient(90deg,#2ee06b,#5ff09c);transition:width .3s ease;border-radius:100px}
.hunger-pill .num{font-family:'JetBrains Mono',monospace;font-size:11.5px;font-weight:700;color:#5ff09c;min-width:62px;text-align:right}
.hunger-pill.crit{border-color:rgba(95,240,156,.9)}
.hunger-pill.crit .fill{background:linear-gradient(90deg,#1fbf57,#3fe07f)}
.hgr-confirm-bg{position:fixed;inset:0;display:none;align-items:center;justify-content:center;background:rgba(0,0,0,.6);z-index:260;padding:18px}
.hgr-confirm-bg.show{display:flex}
.hgr-confirm{width:min(300px,92vw);background:linear-gradient(180deg,rgba(10,20,14,.98),rgba(5,12,8,.98));
  border:2px solid rgba(95,240,156,.55);border-radius:16px;padding:20px;text-align:center;color:#eaffef;
  font-family:'Outfit','Inter',sans-serif;box-shadow:0 20px 50px rgba(0,0,0,.6)}
.hgr-confirm .ic{font-size:34px;line-height:1;margin-bottom:6px}
.hgr-confirm .ttl{font-family:'Bangers','Orbitron',sans-serif;font-size:20px;color:#5ff09c;letter-spacing:1px;margin-bottom:4px}
.hgr-confirm .nm{font-size:12px;color:rgba(230,255,238,.7);margin-bottom:16px}
.hgr-confirm .btns{display:flex;gap:10px}
.hgr-confirm .btns button{flex:1;padding:11px;border:0;border-radius:10px;font-family:'Orbitron',sans-serif;font-weight:800;font-size:12px;cursor:pointer}
.hgr-confirm .yes{background:linear-gradient(135deg,#2ee06b,#5ff09c);color:#06220f}
.hgr-confirm .no{background:rgba(255,255,255,.1);color:rgba(255,255,255,.7)}
`;
    document.head.appendChild(css);

    const pill = document.createElement('div');
    pill.className = 'hunger-pill';
    pill.innerHTML = '<span class="icon">\u{1F34F}</span><div class="bar"><div class="fill" id="hungerFill"></div></div><span class="num" id="hungerNum">100/100</span>';
    document.body.appendChild(pill);
    const fill = pill.querySelector('#hungerFill');
    const num = pill.querySelector('#hungerNum');

    function paint() {
      const h = Math.max(0, Math.min(MAX, Math.round(State.hunger)));
      fill.style.width = (h / MAX * 100) + '%';
      num.textContent = h + '/' + MAX;
      pill.classList.toggle('crit', h <= 20);
    }

    // Dock just ABOVE the health pill, matching the health pill's exact width
    // (the minimap width) so the apple bar and heart bar are identical size.
    // Column reads: compass → hunger → health → minimap.
    function dock() {
      const hp = document.querySelector('.hp-pill');
      const mm = document.querySelector('.mm-root');
      // Width anchor: the minimap (same as the hp pill uses), unless the map
      // is fullscreen — then fall back to the hp pill's current rect.
      let width = null, left = null;
      if (mm && !mm.classList.contains('full')) {
        const r = mm.getBoundingClientRect();
        if (r.width > 40) { width = r.width; left = r.left; }
      }
      if (width == null && hp) {
        const r = hp.getBoundingClientRect();
        if (r.width > 30) { width = r.width; left = r.left; }
      }
      if (width == null) return;
      pill.style.display = 'flex';
      pill.style.setProperty('width', width + 'px', 'important');
      pill.style.setProperty('left', left + 'px', 'important');
      pill.style.setProperty('right', 'auto', 'important');
      const ph = pill.getBoundingClientRect().height || 28;
      const hpTop = hp ? hp.getBoundingClientRect().top : null;
      const top = (hpTop != null && hpTop > 0) ? (hpTop - ph - 6) : ((mm ? mm.getBoundingClientRect().top : 0) - 80);
      pill.style.setProperty('top', Math.max(8, top) + 'px', 'important');
      pill.style.setProperty('bottom', 'auto', 'important');
    }
    setInterval(dock, 500); setTimeout(dock, 400);
    paint();

    // ── drain / recover / starve tick ──
    let decAcc = 0, recAcc = 0, starveAcc = 0, warned = false;
    setInterval(() => {
      if (window.fwInGame === false) { paint(); return; }
      const sleeping = !!window.fwSleeping;
      const slide = !!window.fwSlideActive;
      if (sleeping) {
        decAcc = 0; starveAcc = 0; warned = false;
        recAcc++; if (recAcc >= RECOVER_S) { recAcc = 0; State.hunger = Math.min(MAX, State.hunger + 1); }
      } else if (!slide) {
        recAcc = 0;
        decAcc++; if (decAcc >= DECAY_S) { decAcc = 0; State.hunger = Math.max(0, State.hunger - 1); }
        if (State.hunger <= 0) {
          if (!warned) { warned = true; try { window.floater && window.floater('\u{1F34F} Starving! Right-click food in your inventory to eat', 'bad'); } catch (_) {} }
          starveAcc++;
          if (starveAcc >= STARVE_S) {
            starveAcc = 0;
            if (typeof State.hp === 'number') State.hp = Math.max(5, State.hp - 2);  // never fatal
          }
        } else { starveAcc = 0; warned = false; }
      }
      paint();
    }, 1000);

    // ── eat: RIGHT-CLICK a consumable in the inventory ──
    function eat(id) {
      const energy = ENERGY[id];
      if (!energy) return;
      const have = (State.inventory && State.inventory[id]) || 0;
      if (have <= 0) return;
      if (State.hunger >= MAX) { try { window.floater && window.floater('\u{1F34F} You\'re already full', 'bad'); } catch (_) {} return; }
      try { window.takeItem ? window.takeItem(id, 1) : (State.inventory[id] = have - 1); } catch (_) {}
      State.hunger = Math.min(MAX, State.hunger + energy);
      const it = window.ITEMS && window.ITEMS[id];
      const icon = (it && it.icon) || '\u{1F34F}';
      const nm = (it && it.name) || id;
      try { window.floater && window.floater(icon + ' Ate ' + nm + ' · +' + energy + ' energy', 'good'); } catch (_) {}
      try { window.renderInventory && window.renderInventory(); } catch (_) {}
      try { window.saveState && window.saveState(); } catch (_) {}
      paint();
    }
    // Eat ONE unit that's already been removed from the bag (the Edible slot
    // holds it). Adds energy + an item-icon popup, but does NOT touch the bag.
    function eatEnergy(id){
      const energy = ENERGY[id];
      if (!energy) return false;
      if (State.hunger >= MAX) { try { window.floater && window.floater('\u{1F34F} You\'re already full', 'bad'); } catch (_) {} return false; }
      State.hunger = Math.min(MAX, State.hunger + energy);
      const it = window.ITEMS && window.ITEMS[id];
      const icon = (it && it.icon) || '\u{1F34F}';
      const nm = (it && it.name) || id;
      try { window.floater && window.floater(icon + ' Ate ' + nm + ' · +' + energy + ' energy', 'good'); } catch (_) {}
      try { window.saveState && window.saveState(); } catch (_) {}
      paint();
      return true;
    }
    // Exposed so the real inventory (dropitem.js — Edible box + H key) eats food.
    window.fwConsume = eat;
    window.fwEatEnergy = eatEnergy;
    // ── confirmation dialog ("Consume this item?") ──
    const confirmBg = document.createElement('div');
    confirmBg.className = 'hgr-confirm-bg';
    document.body.appendChild(confirmBg);
    let openedAt = 0;
    // Backdrop click closes — but never within 250ms of opening (so the click
    // that opened it can't also dismiss it).
    confirmBg.addEventListener('click', (e) => {
      if (e.target === confirmBg && performance.now() - openedAt > 250) confirmBg.classList.remove('show');
    });
    let pendingId = null;
    function openConfirm(id) {
      const item = window.ITEMS && window.ITEMS[id];
      const nm = (item && item.name) || id;
      const ic = (item && item.icon) || '\u{1F34F}';
      pendingId = id;
      openedAt = performance.now();
      confirmBg.innerHTML = '<div class="hgr-confirm"><div class="ic">' + ic + '</div>' +
        '<div class="ttl">Consume this item?</div>' +
        '<div class="nm">' + nm + ' · +' + (ENERGY[id] || 0) + ' energy</div>' +
        '<div class="btns"><button class="no" id="hgrNo">No</button><button class="yes" id="hgrYes">Yes</button></div></div>';
      confirmBg.classList.add('show');
      confirmBg.querySelector('#hgrNo').addEventListener('click', () => { confirmBg.classList.remove('show'); pendingId = null; });
      confirmBg.querySelector('#hgrYes').addEventListener('click', () => { confirmBg.classList.remove('show'); const i = pendingId; pendingId = null; if (i) eat(i); });
    }

    // Click a consumable slot → open the confirm dialog. Delegated DIRECTLY on
    // the persistent #invGrid element (this is exactly how equip.js wires tool
    // clicks, and it works), so global capture/contextmenu blockers and the
    // grid's innerHTML re-renders can't interfere. Triggered on mousedown so a
    // re-render between press and release can never swallow the interaction.
    function tryOpen(e) {
      if (confirmBg.classList.contains('show')) return;          // dialog already open
      const slot = e.target && e.target.closest ? e.target.closest('.inv-slot[data-id]') : null;
      if (!slot) return;
      const id = slot.getAttribute('data-id');
      if (!ENERGY[id]) return;                                   // not edible
      e.preventDefault(); e.stopPropagation();
      openConfirm(id);
    }
    function wireConsume() {
      const grid = document.getElementById('invGrid');
      if (!grid) { setTimeout(wireConsume, 600); return; }
      if (grid._hgrWired) return;
      grid._hgrWired = true;
      // Open on a full CLICK only. (Opening on mousedown made the dialog's
      // backdrop appear under the cursor, so the same click's mouseup closed
      // it again — that was the "flicker".)
      grid.addEventListener('click', tryOpen);
    }
    wireConsume();

    // Belt-and-suspenders: also attach a DIRECT handler to each consumable slot
    // every time the inventory re-renders (mirrors how equip.js re-wires).
    function tagSlots() {
      const grid = document.getElementById('invGrid');
      if (!grid) return;
      grid.querySelectorAll('.inv-slot[data-id]').forEach(s => {
        const id = s.getAttribute('data-id');
        if (!ENERGY[id]) return;
        s.style.cursor = 'pointer';
        s.title = (window.ITEMS && window.ITEMS[id] ? window.ITEMS[id].name : id) + ' · click to consume';
        s.onclick = (e) => {
          e.preventDefault(); e.stopPropagation();
          if (!confirmBg.classList.contains('show')) openConfirm(id);
        };
      });
    }
    if (typeof window.renderInventory === 'function' && !window._hgrRenderWrapped) {
      window._hgrRenderWrapped = true;
      const orig = window.renderInventory;
      window.renderInventory = function () {
        const r = orig.apply(this, arguments);
        try { tagSlots(); } catch (_) {}
        return r;
      };
    }
    setTimeout(tagSlots, 600);   // tag whatever is already rendered

    console.log('[hunger] ready — click food in your inventory to consume (confirm dialog)');
  }
})();
