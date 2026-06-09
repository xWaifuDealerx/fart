// =================================================================
// weed-reveal.js — CSGO-style strain reveal for weed harvests.
// Listens for the `fw:weedRoll` CustomEvent dispatched by the
// harvest code in fartworld.html and shows the spinning carousel
// landing on the strain the player rolled.
// =================================================================
(function(){
  'use strict';

  function whenReady(){
    if(!window.State){ setTimeout(whenReady, 300); return; }
    init();
  }
  whenReady();

  function init(){
    // Strain tiers — must mirror the weights in extras-v6b.js so the
    // carousel feels weighted right (lots of dirt, very rare unicorn).
    const TIERS = [
      { id: 'weed_dirt',      cls: 'green',   emoji: '🌱', name: 'Dirt Weed',         weight: 60 },
      { id: 'weed_pineapple', cls: 'blue',    emoji: '🍍', name: 'Pineapple Express', weight: 25 },
      { id: 'weed_diesel',    cls: 'purple',  emoji: '⛽', name: 'Sour Diesel',       weight: 10 },
      { id: 'weed_cosmic',    cls: 'orange',  emoji: '🌌', name: 'Cosmic Kush',       weight: 4  },
      { id: 'weed_unicorn',   cls: 'rainbow', emoji: '🦄', name: 'Unicorn Poop',      weight: 1  },
    ];

    const css = document.createElement('style');
    css.textContent = `
.wr-bg{position:fixed;inset:0;display:none;align-items:center;justify-content:center;background:rgba(0,0,0,.86);backdrop-filter:blur(8px);z-index:250}
.wr-bg.show{display:flex}
.wr-card{background:linear-gradient(180deg,rgba(12,38,18,.97),rgba(4,18,8,.97));border:2px solid rgba(95,240,156,.6);border-radius:20px;padding:24px 28px;max-width:640px;width:94vw;text-align:center;color:#fff1c2;font-family:'Outfit',sans-serif;box-shadow:0 24px 60px rgba(0,0,0,.6),0 0 60px rgba(95,240,156,.18)}
.wr-card h2{font-family:'Bangers','Orbitron',sans-serif;font-size:30px;color:#5ff09c;letter-spacing:2px;margin-bottom:10px}
.wr-sub{font-size:12.5px;color:rgba(230,255,238,.65);margin-bottom:14px;letter-spacing:.4px}
.wr-strip{position:relative;height:120px;overflow:hidden;background:rgba(95,240,156,.06);border:2px solid rgba(95,240,156,.4);border-radius:14px}
.wr-strip .pin{position:absolute;left:50%;top:-6px;bottom:-6px;width:3px;background:#ff5050;box-shadow:0 0 14px #ff5050;z-index:2;transform:translateX(-50%)}
.wr-track{position:absolute;left:0;top:0;bottom:0;display:flex;align-items:center;will-change:transform;padding:0 12px}
.wr-track .item{flex:0 0 110px;height:96px;margin:0 4px;border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:54px;border:2px solid rgba(255,255,255,.12)}
.wr-track .item.green  {background:rgba(122,138,74,.20);border-color:rgba(122,138,74,.65)}
.wr-track .item.blue   {background:rgba(255,214,77,.18);border-color:rgba(255,214,77,.55)}
.wr-track .item.purple {background:rgba(155,220,255,.18);border-color:rgba(155,220,255,.55)}
.wr-track .item.orange {background:rgba(192,132,252,.18);border-color:rgba(192,132,252,.55)}
.wr-track .item.rainbow{background:conic-gradient(from 0deg,#ff5ad6,#ffce4a,#5ff09c,#6ed0d6,#a06aff,#ff5ad6);border-color:#fff}
.wr-result{margin-top:16px;font-family:'Bangers',sans-serif;font-size:24px;color:#ffd64d;letter-spacing:1.4px;opacity:0;transition:opacity .4s ease;min-height:30px}
.wr-result.show{opacity:1}
.wr-close{margin-top:14px;background:rgba(95,240,156,.18);border:1px solid rgba(95,240,156,.5);color:#5ff09c;padding:9px 18px;border-radius:100px;font-family:'Orbitron',sans-serif;font-weight:900;font-size:11px;cursor:pointer;letter-spacing:.8px;display:none}
.wr-close.show{display:inline-block}
`;
    document.head.appendChild(css);

    const bg = document.createElement('div');
    bg.className = 'wr-bg';
    bg.innerHTML = ''
      + '<div class="wr-card">'
      + '<h2>🌿 HARVESTING YOUR PLOT</h2>'
      + '<div class="wr-sub">Rolling for strain rarity… Junkies pay big for the rare stuff.</div>'
      + '<div class="wr-strip"><div class="pin"></div><div class="wr-track" id="wrTrack"></div></div>'
      + '<div class="wr-result" id="wrResult">—</div>'
      + '<button class="wr-close" id="wrClose">Continue</button>'
      + '</div>';
    document.body.appendChild(bg);
    document.getElementById('wrClose').addEventListener('click', () => bg.classList.remove('show'));

    function rndTier(){
      const total = TIERS.reduce((s, t) => s + t.weight, 0);
      let r = Math.random() * total;
      for(const t of TIERS){ r -= t.weight; if(r <= 0) return t; }
      return TIERS[0];
    }

    function show(tierId){
      const tier = TIERS.find(t => t.id === tierId) || TIERS[0];
      // Build a 60-item strip ending in the winner exactly at index 50.
      const items = [];
      for(let i = 0; i < 60; i++){
        items.push(i === 50 ? tier : rndTier());
      }
      const track = document.getElementById('wrTrack');
      track.innerHTML = items.map(t => '<div class="item ' + t.cls + '">' + t.emoji + '</div>').join('');
      track.style.transition = 'none';
      track.style.transform = 'translateX(0px)';
      bg.classList.add('show');
      const res = document.getElementById('wrResult');
      res.classList.remove('show');
      res.textContent = '—';
      document.getElementById('wrClose').classList.remove('show');
      // Force reflow, then measure the winner's real centre so it lands
      // exactly under the pin (the track's 12px padding made the old
      // width-assumption math point ~12px off, onto the neighbour tier).
      void track.offsetWidth;
      const winnerEl = track.children[50];
      const stripW = track.parentElement.clientWidth;
      const finalOffset = winnerEl
        ? (stripW / 2) - (winnerEl.offsetLeft + winnerEl.offsetWidth / 2)
        : -(50 * 118) + (stripW / 2) - 59;
      track.style.transition = 'transform 4.2s cubic-bezier(.13,.84,.18,1)';
      track.style.transform = 'translateX(' + finalOffset + 'px)';
      setTimeout(() => {
        res.textContent = '✨ ' + tier.name;
        res.classList.add('show');
        document.getElementById('wrClose').classList.add('show');
        try { window.playPurchaseSound?.(); } catch(_){}
      }, 4400);
    }

    window.showWeedReveal = show;
    window.addEventListener('fw:weedRoll', (e) => {
      try { show(e.detail?.tierId); } catch(_){}
    });

    console.log('[weed-reveal] ready');
  }
})();
