// =================================================================
// extras-v6bb.js — Hotel sleep mode, HP bar above minimap,
//                   bulletproof right-click block.
// =================================================================
(function(){
  'use strict';

  // ─────────────────────────────────────────────────────────────────
  // 1) BULLETPROOF RIGHT-CLICK BLOCK
  //    Add the same handler four different ways (document capture,
  //    window capture, body capture, body bubble) so no event path
  //    can leak through. Also runs immediately, not gated by
  //    whenReady, because the user can right-click at any time.
  // ─────────────────────────────────────────────────────────────────
  function killContextMenu(e){ e.preventDefault(); e.stopPropagation(); return false; }
  document.addEventListener('contextmenu', killContextMenu, true);
  document.addEventListener('contextmenu', killContextMenu, false);
  window.addEventListener('contextmenu', killContextMenu, true);
  // Also rebind when DOM ready in case <body> wasn't there yet.
  function bindBody(){
    if(document.body){
      document.body.addEventListener('contextmenu', killContextMenu, true);
      document.body.addEventListener('contextmenu', killContextMenu, false);
      document.body.oncontextmenu = killContextMenu;
    }
  }
  bindBody();
  document.addEventListener('DOMContentLoaded', bindBody, { once: true });

  function whenReady(){
    if(!window.THREE || !window.scene || !window.Player || !window.State){
      setTimeout(whenReady, 300); return;
    }
    init();
  }
  whenReady();

  function init(){
    const Player = window.Player;
    const State = window.State;

    // ─────────────────────────────────────────────────────────────
    // 2) HP BAR ABOVE MINIMAP
    //    The minimap lives bottom-right (or top-left on touch). We
    //    measure its bounding rect and dock the HP pill just above
    //    it, with matching width.
    // ─────────────────────────────────────────────────────────────
    const oldHp = document.querySelector('.hp-pill');
    if(oldHp){
      // Strip the top-centered styling and reposition above the minimap.
      const css = document.createElement('style');
      css.textContent = `
.hp-pill{position:fixed!important;top:auto!important;left:auto!important;transform:none!important;
  background:rgba(8,18,11,.94)!important;border:2px solid rgba(255,90,90,.55)!important;
  border-radius:12px!important;padding:6px 10px!important;
  display:flex!important;align-items:center!important;gap:8px!important}
.hp-pill .bar{flex:1 1 auto;width:auto!important;height:12px!important}
.hp-pill .icon{font-size:14px}
.hp-pill .num{min-width:62px!important;font-size:11.5px!important}
`;
      document.head.appendChild(css);
    }
    let _lastSmallRect = null;
    function dockHp(){
      const pill = document.querySelector('.hp-pill');
      if(!pill) return;
      const mm = document.querySelector('.mm-root');
      if(!mm){ return; }
      let r;
      if(mm.classList.contains('full')){
        // Fullscreen map (M key): do NOT follow the centred map — keep
        // the pill (and the compass docked above it) where the small
        // minimap normally sits, bottom-right.
        r = _lastSmallRect || {
          width: 240,
          left: window.innerWidth - 14 - 240,
          top: window.innerHeight - 14 - 240,
        };
      } else {
        r = mm.getBoundingClientRect();
        if(r.width < 40 || r.height < 40) return;
        _lastSmallRect = { width: r.width, left: r.left, top: r.top };
      }
      // Use !important so the existing top:14px;left:50% inline rules
      // and the .hp-pill stylesheet rules can't override us.
      pill.style.setProperty('width', r.width + 'px', 'important');
      pill.style.setProperty('left', r.left + 'px', 'important');
      pill.style.setProperty('right', 'auto', 'important');
      pill.style.setProperty('top', Math.max(8, r.top - 42) + 'px', 'important');
      pill.style.setProperty('bottom', 'auto', 'important');
      pill.style.setProperty('transform', 'none', 'important');
    }
    setInterval(dockHp, 600);
    setTimeout(dockHp, 300);

    // ─────────────────────────────────────────────────────────────
    // 3) HOTEL SLEEP MODE
    //    Override pressing E near the hotel to put the player into
    //    "sleep" mode if they already have a booking:
    //      - Freeze WASD movement (we just zero Player.vel each tick)
    //      - Show the timer popup in the centre of the screen with
    //        a +1 hour Extend button.
    //      - Press E again to wake up.
    //    The old timer pill at bottom-left + booking modal stay
    //    available for buying the booking before sleeping.
    // ─────────────────────────────────────────────────────────────
    const HOTEL_POS = window.HOTEL_POS || { x: -64, z: 18 };
    const HOTEL_R = 6;
    const HOTEL_RATE = 25;
    const HOTEL_MAX_HOURS = 72;

    const css2 = document.createElement('style');
    css2.textContent = `
.hot-sleep-bg{position:fixed;inset:0;display:none;z-index:180;pointer-events:none;
  font-family:'Outfit','Inter',sans-serif;
  /* See the world while you sleep — just a soft dusk tint at the edges */
  background:radial-gradient(ellipse at 50% 42%, transparent 48%, rgba(4,10,8,.55) 100%);
  align-items:flex-end;justify-content:center}
.hot-sleep-bg.show{display:flex}
.hot-sleep-card{pointer-events:auto;margin-bottom:11vh;
  background:linear-gradient(165deg,rgba(10,24,16,.78),rgba(5,13,9,.90));
  -webkit-backdrop-filter:blur(12px) saturate(1.2);backdrop-filter:blur(12px) saturate(1.2);
  border:1px solid rgba(255,206,74,.45);border-radius:20px;padding:14px 22px 16px;text-align:center;
  max-width:360px;width:88vw;color:#fff1c2;
  box-shadow:0 18px 40px rgba(0,0,0,.45),inset 0 1px 0 rgba(255,255,255,.08),0 0 36px rgba(255,206,74,.10)}
.hot-sleep-card h2{font-family:'Bangers','Orbitron',sans-serif;font-size:22px;color:#ffd64d;letter-spacing:1.6px;margin-bottom:2px;text-shadow:0 0 18px rgba(255,206,74,.35)}
.hot-sleep-card .sub{font-size:11px;color:rgba(230,255,238,.6);letter-spacing:.4px;margin-bottom:10px}
.hot-sleep-card .bar{height:10px;background:rgba(255,206,74,.12);border:1px solid rgba(255,206,74,.4);border-radius:100px;overflow:hidden;position:relative;box-shadow:inset 0 1px 2px rgba(0,0,0,.4);margin-bottom:6px}
.hot-sleep-card .bf{position:absolute;left:0;top:0;bottom:0;background:linear-gradient(90deg,#ffd64d,#ffe9a8);border-radius:100px;transition:width 1s linear;box-shadow:0 0 10px rgba(255,214,77,.5)}
.hot-sleep-card .t{font-family:'JetBrains Mono',monospace;font-size:13px;color:#ffd64d;letter-spacing:1px;margin-bottom:10px}
.hot-sleep-card .ext{background:linear-gradient(135deg,#ffd64d 0%,#ffb938 55%,#ffd64d 100%);color:#241a05;border:0;
  padding:10px 22px;border-radius:100px;font-family:'Orbitron',sans-serif;font-weight:900;font-size:11.5px;
  text-transform:uppercase;cursor:pointer;letter-spacing:.7px;margin:0 4px;
  box-shadow:0 5px 16px rgba(255,185,56,.35),inset 0 1px 0 rgba(255,255,255,.5);
  transition:transform .15s ease, box-shadow .15s ease, filter .15s ease}
.hot-sleep-card .ext:hover:not(:disabled){transform:translateY(-1px);box-shadow:0 8px 22px rgba(255,185,56,.5),inset 0 1px 0 rgba(255,255,255,.5);filter:brightness(1.07)}
.hot-sleep-card .ext:active:not(:disabled){transform:translateY(0)}
.hot-sleep-card .ext:disabled{opacity:.45;cursor:not-allowed;box-shadow:none}
.hot-sleep-card .leave{background:transparent;border:1px solid rgba(230,255,238,.35);color:rgba(230,255,238,.7);padding:8px 14px;border-radius:100px;font-family:'JetBrains Mono',monospace;font-size:10.5px;text-transform:uppercase;cursor:pointer;letter-spacing:.6px;margin-top:14px;display:inline-block}
.hot-sleep-card .hint{font-family:'JetBrains Mono',monospace;font-size:10.5px;color:rgba(230,255,238,.4);margin-top:8px;letter-spacing:.4px}
`;
    document.head.appendChild(css2);
    const sleepBg = document.createElement('div');
    sleepBg.className = 'hot-sleep-bg';
    sleepBg.innerHTML = '<div class="hot-sleep-card">'
      + '<h2>🏨 SLEEPING</h2>'
      + '<div class="sub">Safe zone. Spiders can\'t reach you here.</div>'
      + '<div class="bar"><div class="bf" id="hotSleepBf"></div></div>'
      + '<div class="t" id="hotSleepT">—</div>'
      + '<button class="ext" id="hotExt">+1 HOUR · ' + HOTEL_RATE + ' 🥈</button>'
      + '<div class="hint">Press <b>E</b> to wake up &amp; leave</div>'
      + '</div>';
    document.body.appendChild(sleepBg);

    let sleeping = false;
    function bookedRemainingMs(){ return Math.max(0, (State.hotelBookedUntil || 0) - Date.now()); }

    function enterSleep(){
      if(bookedRemainingMs() <= 0){
        window.floater?.('Book a room first', 'bad');
        return;
      }
      sleeping = true;
      sleepBg.classList.add('show');
      // Hide the bottom-left mini timer when the central card is up.
      const t = document.querySelector('.hot-timer');
      if(t) t.classList.remove('show');
    }
    function exitSleep(){
      sleeping = false;
      sleepBg.classList.remove('show');
    }
    window.exitHotelSleep = exitSleep;

    function renderTimer(){
      const rem = bookedRemainingMs();
      const totalHrs = Math.min(HOTEL_MAX_HOURS, rem / 3600000);
      document.getElementById('hotSleepBf').style.width =
        Math.max(0, Math.min(100, totalHrs / HOTEL_MAX_HOURS * 100)) + '%';
      const s = Math.floor(rem / 1000);
      const h = Math.floor(s / 3600);
      const m = Math.floor((s % 3600) / 60);
      const ss = s % 60;
      document.getElementById('hotSleepT').textContent =
        h + 'h ' + String(m).padStart(2, '0') + 'm ' + String(ss).padStart(2, '0') + 's';
      const ext = document.getElementById('hotExt');
      const remHrs = rem / 3600000;
      ext.disabled = (remHrs + 1 > HOTEL_MAX_HOURS) || (State.credits || 0) < HOTEL_RATE;
    }
    document.getElementById('hotExt').addEventListener('click', () => {
      if((State.credits || 0) < HOTEL_RATE){ window.floater?.('Need ' + HOTEL_RATE + ' 🥈', 'bad'); return; }
      const remHrs = bookedRemainingMs() / 3600000;
      if(remHrs + 1 > HOTEL_MAX_HOURS){ window.floater?.('72 h max', 'bad'); return; }
      State.credits -= HOTEL_RATE;
      const base = Math.max(Date.now(), State.hotelBookedUntil || 0);
      State.hotelBookedUntil = base + 3600000;
      window.floater?.('+1 h booked', 'good');
      window.playPurchaseSound?.();
      window.saveState?.();
      window.updateHUD?.();
      renderTimer();
    });

    // Wake button (or click outside text area)
    sleepBg.addEventListener('click', (e) => {
      if(e.target === sleepBg) exitSleep();
    });

    // Tick: keep the timer fresh AND freeze movement while sleeping.
    setInterval(() => {
      if(!sleeping) return;
      renderTimer();
      // Booking expired? Wake them up.
      if(bookedRemainingMs() <= 0){
        window.floater?.('🏨 Booking expired — checked out', 'bad');
        exitSleep();
        return;
      }
    }, 500);
    // Freeze movement: zero Player velocity + clamp to hotel centre
    function freezeTick(){
      if(sleeping){
        Player.pos.x = HOTEL_POS.x;
        Player.pos.z = HOTEL_POS.z;
        if(Player.vel){ Player.vel.set(0, 0, 0); }
      }
      requestAnimationFrame(freezeTick);
    }
    requestAnimationFrame(freezeTick);

    // E-key handling near hotel: toggle sleep
    window.addEventListener('keydown', (e) => {
      if(e.code !== 'KeyE') return;
      const a = document.activeElement;
      if(a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA')) return;
      // Toggle sleep first if currently sleeping.
      if(sleeping){
        exitSleep();
        e.stopImmediatePropagation();
        return;
      }
      const d = Math.hypot(Player.pos.x - HOTEL_POS.x, Player.pos.z - HOTEL_POS.z);
      if(d > HOTEL_R) return;
      if(document.querySelector('.hot-bg.show, .gary-bg.show, .gs-bg.show, .bank-bg.show, .stor-bg.show, .dc-bg.show, .alex-pop.show, .wave-bg.show, #invBg.show, #marketBg.show, #poopBg.show, .carlos-bg.show, .fc-bg.show, .junk-bg.show, .est-bg.show')) return;
      if(bookedRemainingMs() > 0){
        enterSleep();
        e.stopImmediatePropagation();
      }
    }, true);

    console.log('[extras-v6bb] ready · HP docked, hotel sleep, contextmenu killed');
  }
})();
