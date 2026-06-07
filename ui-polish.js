// =================================================================
// ui-polish.js — global typography + UI glow pass.
// =================================================================
// Injects a high-specificity stylesheet that improves readability,
// adds smoother gradient/shadow treatments, animates the XP bar,
// gives the player HUD a soft glow, polishes modal cards, and tightens
// scrollbars + buttons.
// =================================================================
(function(){
  'use strict';
  function whenReady(){
    if(!document.body){ setTimeout(whenReady, 80); return; }
    init();
  }
  whenReady();

  function init(){
    // Pull in a nicer pair of webfonts (Outfit for body, Bangers for big
    // headings — we already use Bangers in several places).
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;700;800&family=Inter:wght@400;500;700&display=swap';
    document.head.appendChild(link);

    const css = document.createElement('style');
    css.id = 'fw-ui-polish';
    css.textContent = `
:root{
  --ink:#e6ffee;
  --ink-soft:rgba(230,255,238,.72);
  --ink-mute:rgba(230,255,238,.45);
  --acc:#5ff09c;
  --acc-warm:#ffce4a;
  --acc-water:#6ed0d6;
  --bg-glass:linear-gradient(180deg,rgba(8,18,11,.86),rgba(5,14,9,.86));
  --card:linear-gradient(180deg,rgba(14,28,18,.96),rgba(8,18,12,.96));
}
html, body { -webkit-font-smoothing: antialiased; text-rendering: optimizeLegibility; }
body { font-family: 'Outfit','Inter','Segoe UI','JetBrains Mono',sans-serif; }

/* Modal cards — applies to every shop modal in the game */
.market-card, .bank-card, .carlos-card, .alex-card, .roki-card, .junk-card,
.wave-card, .gary-card, .lab-card, .fc-card, .swap-card, .portfolio-card,
.house-card, .poop-card {
  background: var(--card) !important;
  box-shadow: 0 24px 60px rgba(0,0,0,.55), 0 0 0 1px rgba(255,255,255,.05) inset !important;
  border-radius: 18px !important;
  /* backdrop-filter removed — was making everything fuzzy */
}
.market-bg, .bank-bg, .carlos-bg, .alex-bg, .roki-bg, .junk-bg, .wave-bg,
.gary-bg, .lab-bg, .fc-bg, .swap-bg, .portfolio-bg, .house-bg, .poop-bg {
  /* no blur */
  background: radial-gradient(circle at 50% 35%, rgba(15,25,18,.4), rgba(0,0,0,.7)) !important;
}

/* Headings: warm gradient text */
.market-card h2, .bank-card h2, .carlos-card h2, .alex-card h2, .roki-card h2,
.junk-card h2, .wave-card h2, .gary-card h2, .lab-card h2, .fc-card h2,
.swap-card h2, .portfolio-card h2, .house-card h2 {
  background: linear-gradient(135deg, var(--acc) 0%, #b6ffd0 55%, var(--acc-warm) 100%);
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
  letter-spacing: 1.4px !important;
  text-shadow: 0 4px 12px rgba(95,240,156,.18);
  filter: drop-shadow(0 1px 0 rgba(0,0,0,.45));
}

/* All "primary" buttons */
.market-card .btn, .market-card button.buy, .carlos-card .btn,
.alex-card .btn, .roki-card .act, .junk-card .junk-go, .wave-card .btn,
.gary-card .btn, .lab-card .btn, .bank-card .btn, .swap-card .btn,
.portfolio-card .btn {
  position: relative;
  overflow: hidden;
  transition: transform .12s ease, filter .12s ease, box-shadow .12s ease;
  box-shadow: 0 6px 16px rgba(0,0,0,.4), 0 0 0 1px rgba(255,255,255,.06) inset;
  text-shadow: 0 1px 0 rgba(0,0,0,.18);
}
.market-card .btn:hover, .carlos-card .btn:hover, .alex-card .btn:hover,
.roki-card .act:hover, .junk-card .junk-go:hover, .wave-card .btn:hover,
.gary-card .btn:hover, .lab-card .btn:hover, .swap-card .btn:hover {
  transform: translateY(-1px);
  filter: brightness(1.07) saturate(1.05);
  box-shadow: 0 10px 22px rgba(0,0,0,.5), 0 0 0 1px rgba(255,255,255,.10) inset;
}
.market-card .btn:active, .carlos-card .btn:active { transform: translateY(0); filter: brightness(.95); }

/* HUD top-left card */
#hud { /* no blur */ }
.hud-player, .hud-card {
  border-radius: 14px !important;
  box-shadow: 0 10px 24px rgba(0,0,0,.42), 0 0 0 1px rgba(255,255,255,.05) inset !important;
}
.hud-card { transition: transform .15s ease, filter .15s ease; }
.hud-card:hover { transform: translateY(-1px); filter: brightness(1.05); }

/* XP bar — give it a glow + a moving sheen */
.hud-player .xp-bar {
  position: relative;
  overflow: hidden;
  background: rgba(95,240,156,.10) !important;
  box-shadow: inset 0 1px 0 rgba(255,255,255,.06), inset 0 -1px 0 rgba(0,0,0,.4);
}
.hud-player .xp-fill {
  background: linear-gradient(90deg, #2eea7a, #5ff09c 35%, #fff1c2) !important;
  box-shadow: 0 0 14px rgba(95,240,156,.6);
  transition: width .35s cubic-bezier(.2,.7,.4,1) !important;
}
.hud-player .xp-bar::after{
  content:""; position:absolute; inset:0;
  background: linear-gradient(120deg, transparent 25%, rgba(255,255,255,.35) 45%, transparent 55%);
  background-size: 220% 100%;
  animation: xpSheen 3.6s linear infinite;
  pointer-events:none; mix-blend-mode: overlay;
}
@keyframes xpSheen { 0% { background-position: 220% 0; } 100% { background-position: -220% 0; } }

/* Floating "+10 XP" floaters */
.floater {
  font-family: 'Bangers','Outfit',sans-serif !important;
  text-shadow: 0 3px 10px rgba(0,0,0,.6), 0 0 12px rgba(255,255,255,.25) !important;
  letter-spacing: 1px !important;
}

/* Tag bubbles over NPCs */
[style*="position:absolute"][style*="translate(-50%,-100%)"] {
  font-family: 'Outfit','Inter','JetBrains Mono',monospace !important;
  letter-spacing: .25px !important;
  box-shadow: 0 6px 14px rgba(0,0,0,.45) !important;
}

/* Mini-map polish */
.minimap {
  box-shadow: 0 16px 36px rgba(0,0,0,.55), 0 0 0 1px rgba(255,255,255,.06) inset !important;
  background: linear-gradient(180deg, rgba(10,28,18,.84), rgba(4,14,10,.84)) !important;
}

/* Compass strip */
#fwCompass {
  box-shadow: 0 12px 28px rgba(0,0,0,.42), 0 0 0 1px rgba(255,255,255,.06) inset !important;
  background: linear-gradient(180deg, rgba(10,28,18,.88), rgba(4,14,10,.88)) !important;
}

/* All inputs and sliders */
input[type="text"], input[type="number"], textarea {
  background: rgba(255,255,255,.06) !important;
  border: 1px solid rgba(95,240,156,.25) !important;
  color: var(--ink) !important;
  font-family: 'Outfit','Inter',sans-serif !important;
  border-radius: 10px !important;
  outline: none;
  transition: border-color .15s ease, box-shadow .15s ease;
}
input[type="text"]:focus, input[type="number"]:focus, textarea:focus {
  border-color: rgba(95,240,156,.6) !important;
  box-shadow: 0 0 0 3px rgba(95,240,156,.18);
}

/* Sleeker scrollbars */
::-webkit-scrollbar { width: 8px; height: 8px; }
::-webkit-scrollbar-track { background: rgba(0,0,0,.2); border-radius: 8px; }
::-webkit-scrollbar-thumb { background: rgba(95,240,156,.38); border-radius: 8px; }
::-webkit-scrollbar-thumb:hover { background: rgba(95,240,156,.6); }

/* Proximity popups (alex-pop, npc-pop, roki-near, wt-pop, plane-ctrls) */
.alex-pop, .npc-pop, .roki-near, .wt-pop, .plane-ctrls, .junkie-pop {
  box-shadow: 0 16px 30px rgba(0,0,0,.5), 0 0 0 1px rgba(255,255,255,.06) inset !important;
  animation: popIn .28s cubic-bezier(.2,.7,.4,1);
}
@keyframes popIn {
  from { transform: translateX(-50%) translateY(8px); opacity: 0; }
  to   { transform: translateX(-50%) translateY(0);   opacity: 1; }
}

/* Chat bubbles + system toasts */
#chatBubbles div, .chat-bubble {
  border-radius: 12px !important;
  /* no blur */
  box-shadow: 0 6px 18px rgba(0,0,0,.4) !important;
}

/* Inventory grid + slots */
.inv-slot {
  border-radius: 11px !important;
  transition: transform .12s ease, box-shadow .12s ease, background .15s ease;
}
.inv-slot:hover { transform: translateY(-2px); box-shadow: 0 8px 18px rgba(0,0,0,.45); }
.inv-slot.worn { box-shadow: 0 0 0 2px var(--acc-warm), 0 8px 22px rgba(255,206,74,.4) !important; }

/* "Press E" prompt — make it a glowing pill */
#interactPrompt, .prompt {
  letter-spacing: .8px !important;
  font-family: 'Outfit','Inter',sans-serif !important;
  box-shadow: 0 14px 26px rgba(0,0,0,.42), 0 0 0 1px rgba(255,255,255,.06) inset !important;
}
#interactPrompt kbd, .prompt kbd {
  background: rgba(95,240,156,.18) !important;
  border: 1px solid rgba(95,240,156,.5) !important;
  border-radius: 6px !important;
  padding: 2px 7px !important;
  font-family: 'JetBrains Mono',monospace !important;
  color: var(--acc) !important;
  box-shadow: 0 2px 0 rgba(0,0,0,.3);
}

/* Make selection nicer everywhere */
::selection { background: rgba(95,240,156,.35); color: #fff; }
`;
    document.head.appendChild(css);

    // Subtle "pop" anim on stat-counter changes (xp / silver / gold)
    const watchers = [
      { id: 'hudXp',       cls: 'pulse-warm' },
      { id: 'hudCredits',  cls: 'pulse-silver' },
      { id: 'hudGold',     cls: 'pulse-gold' },
      { id: 'hudPaper',    cls: 'pulse-cash' },
    ];
    const pulseCss = document.createElement('style');
    pulseCss.textContent = `
@keyframes pulseScale { 0% { transform: scale(1); } 30% { transform: scale(1.18); } 100% { transform: scale(1); } }
.pulse-warm   { animation: pulseScale .42s ease; color: var(--acc-warm) !important; }
.pulse-silver { animation: pulseScale .42s ease; color: #c8d8e0 !important; }
.pulse-gold   { animation: pulseScale .42s ease; color: var(--acc-warm) !important; }
.pulse-cash   { animation: pulseScale .42s ease; color: #98e8a0 !important; }
.pulse-warm, .pulse-silver, .pulse-gold, .pulse-cash {
  display:inline-block;
  text-shadow: 0 0 18px currentColor;
}
`;
    document.head.appendChild(pulseCss);
    function watchEl(w){
      const el = document.getElementById(w.id);
      if(!el) return setTimeout(() => watchEl(w), 600);
      let last = el.textContent;
      setInterval(() => {
        if(el.textContent !== last){
          last = el.textContent;
          el.classList.remove(w.cls); void el.offsetWidth; el.classList.add(w.cls);
        }
      }, 250);
    }
    watchers.forEach(watchEl);

    console.log('[ui-polish] ready');
  }
})();
