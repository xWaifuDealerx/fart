// =================================================================
// goldmarket.js — GOLD ↔ $FARTPRINT marketplace, a tab inside the Gold
// Vault. Mirrors how Kintara's gold market works:
//   • List your in-game GOLD for $FARTPRINT (your gold is locked while listed).
//   • Browse other players' listings and buy their GOLD — the buyer's wallet
//     signs ONE $FARTPRINT transfer straight to the seller (minus a 5% fee).
//
//   Gold is an OFF-CHAIN balance and $FARTPRINT is an on-chain SPL token, so a
//   trustless contract can't swap them — settlement is custodial:
//     1) seller lists  → backend locks the gold        (WORKS locally here)
//     2) buyer pays    → wallet signs the token transfer (BACKEND/WALLET stub)
//     3) backend confirms the tx → credits the gold     (BACKEND stub)
//   The list/cancel flow runs on real game gold now; the buy flow calls the
//   stub at window.fwGoldMarketSettle where your backend/wallet plugs in.
// =================================================================
(function () {
  'use strict';
  const FEE_PCT = 5;   // marketplace fee skimmed from the seller's proceeds

  function whenReady() {
    if (!window.State || !document.getElementById('goldBg')) { setTimeout(whenReady, 400); return; }
    init();
  }
  whenReady();

  function init() {
    const State = window.State;
    if (!Array.isArray(State.goldListings)) State.goldListings = [];

    // demo listings from "other players" (until the marketplace backend is live)
    const DEMO = [
      { id: 'd1', gold: 10, pricePer: 9800, seller: 'ToiletTycoon' },
      { id: 'd2', gold: 3,  pricePer: 9500, seller: 'SkibidiWhale' },
      { id: 'd3', gold: 25, pricePer: 10200, seller: 'RizzLord' },
      { id: 'd4', gold: 1,  pricePer: 9000, seller: 'gyatt_god' },
    ];

    const fmt = (n) => Math.round(n).toLocaleString('en-US');

    // ── styles ──
    const css = document.createElement('style');
    css.textContent = `
.gold-tabbar{display:flex;gap:8px;margin:4px 0 14px}
.gold-tab{flex:1;background:rgba(255,255,255,.05);border:1px solid rgba(255,206,74,.35);color:#ffe39a;
  border-radius:10px;padding:9px 0;font-family:'Outfit',sans-serif;font-weight:800;font-size:12.5px;cursor:pointer;transition:.12s}
.gold-tab.on{background:linear-gradient(135deg,#ffce4a,#ffd86e);color:#3a2a08;border-color:transparent}
.gm-sub{font-size:12px;color:rgba(255,235,200,.7);margin:0 0 12px;line-height:1.5}
.gm-sub b{color:#ffd64d}
.gm-list-form{background:rgba(255,206,74,.07);border:1px solid rgba(255,206,74,.28);border-radius:12px;padding:12px 13px;margin-bottom:14px}
.gm-list-form .row{display:flex;gap:8px;align-items:center;margin-top:8px}
.gm-list-form input{flex:1;min-width:0;background:rgba(0,0,0,.35);border:1px solid rgba(255,206,74,.4);border-radius:8px;
  padding:9px 11px;color:#fff1c2;font-family:'JetBrains Mono',monospace;font-size:13px;outline:none}
.gm-list-form .lbl{font-size:11px;font-weight:800;letter-spacing:.6px;text-transform:uppercase;color:#ffd64d}
.gm-quote{font-size:11.5px;color:rgba(255,235,200,.7);margin-top:8px}
.gm-quote b{color:#5ff09c}
.gm-btn{background:linear-gradient(135deg,#ffce4a,#ffd86e);border:0;border-radius:9px;padding:10px 16px;color:#3a2a08;
  font-family:'Orbitron',sans-serif;font-weight:900;font-size:11.5px;letter-spacing:.5px;cursor:pointer;white-space:nowrap}
.gm-btn.sm{padding:7px 12px;font-size:10.5px}
.gm-btn.ghost{background:rgba(255,255,255,.06);color:#fff1c2;border:1px solid rgba(255,206,74,.35)}
.gm-sech{font-size:11px;font-weight:800;letter-spacing:1.2px;text-transform:uppercase;color:#ffd64d;margin:14px 0 8px}
.gm-row{display:flex;align-items:center;gap:10px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);
  border-radius:10px;padding:9px 11px;margin-bottom:6px;font-size:13px}
.gm-row.mine{border-color:rgba(95,240,156,.4)}
.gm-row .g{font-family:'Orbitron',sans-serif;font-weight:900;color:#ffd64d;min-width:54px}
.gm-row .who{flex:1;min-width:0;color:rgba(255,235,200,.8);font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.gm-row .pr{font-family:'JetBrains Mono',monospace;font-size:11px;color:rgba(255,235,200,.75);text-align:right}
.gm-row .pr b{color:#fff}
.gm-note{font-size:10.5px;color:rgba(255,235,200,.45);margin-top:10px;line-height:1.5}
`;
    document.head.appendChild(css);

    const goldBg = document.getElementById('goldBg');
    const burnPane = document.getElementById('goldBurnPane');
    const mktPane = document.getElementById('goldMarketPane');
    const tabBurn = document.getElementById('goldTabBurn');
    const tabMkt = document.getElementById('goldTabMarket');

    function showTab(which) {
      const market = which === 'market';
      tabBurn.classList.toggle('on', !market);
      tabMkt.classList.toggle('on', market);
      burnPane.style.display = market ? 'none' : '';
      mktPane.style.display = market ? '' : 'none';
      if (market) renderMarket();
    }
    tabBurn.addEventListener('click', () => showTab('burn'));
    tabMkt.addEventListener('click', () => showTab('market'));
    // every time the vault opens, default back to the Burn tab
    document.getElementById('hudGoldCard').addEventListener('click', () => setTimeout(() => showTab('burn'), 0));

    function renderMarket() {
      const mine = State.goldListings || [];
      const others = DEMO.slice();
      const myRows = mine.length ? mine.map(l =>
        '<div class="gm-row mine"><span class="g">🪙 ' + l.gold + '</span><span class="who">your listing</span>' +
        '<span class="pr">' + fmt(l.pricePer) + ' /g<br><b>' + fmt(l.gold * l.pricePer) + ' $FARTPRINT</b></span>' +
        '<button class="gm-btn sm ghost" data-cancel="' + l.id + '">Cancel</button></div>'
      ).join('') : '<div class="gm-note">You have no active listings.</div>';
      const otherRows = others.map(l =>
        '<div class="gm-row"><span class="g">🪙 ' + l.gold + '</span><span class="who">' + l.seller + '</span>' +
        '<span class="pr">' + fmt(l.pricePer) + ' /g<br><b>' + fmt(l.gold * l.pricePer) + ' $FARTPRINT</b></span>' +
        '<button class="gm-btn sm" data-buy="' + l.id + '">Buy</button></div>'
      ).join('');

      mktPane.innerHTML =
        '<p class="gm-sub">Trade GOLD for <b>$FARTPRINT</b>. List your gold (it’s locked while listed); buyers pay $FARTPRINT straight to your wallet. Marketplace fee: <b>' + FEE_PCT + '%</b>.</p>' +
        '<div class="gm-list-form">' +
          '<div class="lbl">Sell your GOLD · you have 🪙 ' + (State.gold || 0) + '</div>' +
          '<div class="row"><input id="gmGold" type="number" min="1" placeholder="gold to sell"/>' +
            '<input id="gmPrice" type="number" min="1" placeholder="$FARTPRINT per gold"/></div>' +
          '<div class="gm-quote" id="gmQuote">Enter an amount and price.</div>' +
          '<div class="row"><button class="gm-btn" id="gmList" style="flex:1">List for sale</button></div>' +
        '</div>' +
        '<div class="gm-sech">Your listings</div>' + myRows +
        '<div class="gm-sech">Buy GOLD · market listings</div>' + otherRows +
        '<div class="gm-note">Listing locks your gold locally now. Buying another player’s gold requires a wallet $FARTPRINT payment + the marketplace backend to settle — wired at window.fwGoldMarketSettle.</div>';

      const gIn = document.getElementById('gmGold'), pIn = document.getElementById('gmPrice'), q = document.getElementById('gmQuote');
      function quote() {
        const g = Math.max(0, Math.floor(+gIn.value || 0)), p = Math.max(0, Math.floor(+pIn.value || 0));
        if (g > 0 && p > 0) {
          const total = g * p, net = Math.round(total * (1 - FEE_PCT / 100));
          q.innerHTML = 'Total <b>' + fmt(total) + ' $FARTPRINT</b> · after ' + FEE_PCT + '% fee you receive <b>' + fmt(net) + ' $FARTPRINT</b>';
        } else q.textContent = 'Enter an amount and price.';
      }
      gIn.addEventListener('input', quote); pIn.addEventListener('input', quote);
      document.getElementById('gmList').addEventListener('click', listGold);
      mktPane.querySelectorAll('[data-cancel]').forEach(b => b.addEventListener('click', () => cancelListing(b.getAttribute('data-cancel'))));
      mktPane.querySelectorAll('[data-buy]').forEach(b => b.addEventListener('click', () => buyListing(b.getAttribute('data-buy'))));
    }

    function listGold() {
      const g = Math.floor(+document.getElementById('gmGold').value || 0);
      const p = Math.floor(+document.getElementById('gmPrice').value || 0);
      if (g <= 0) { window.floater?.('Enter how much gold to sell', 'bad'); return; }
      if (p <= 0) { window.floater?.('Set a $FARTPRINT price per gold', 'bad'); return; }
      if ((State.gold || 0) < g) { window.floater?.('You only have ' + (State.gold || 0) + ' 🪙', 'bad'); return; }
      State.gold = +(((State.gold || 0) - g).toFixed(6));   // lock the gold into the listing
      State.goldListings.push({ id: 'L' + Date.now(), gold: g, pricePer: p });
      window.updateHUD?.(); window.saveState?.();
      try { document.getElementById('goldBalanceLg').textContent = State.gold; } catch (_) {}
      window.floater?.('📜 Listed ' + g + ' 🪙 for ' + fmt(g * p) + ' $FARTPRINT', 'good');
      renderMarket();
    }

    function cancelListing(id) {
      const i = State.goldListings.findIndex(l => l.id === id);
      if (i < 0) return;
      const l = State.goldListings[i];
      State.gold = +(((State.gold || 0) + l.gold).toFixed(6));   // return the locked gold
      State.goldListings.splice(i, 1);
      window.updateHUD?.(); window.saveState?.();
      try { document.getElementById('goldBalanceLg').textContent = State.gold; } catch (_) {}
      window.floater?.('↩️ Listing cancelled · ' + l.gold + ' 🪙 returned', 'good');
      renderMarket();
    }

    function buyListing(id) {
      const l = DEMO.find(x => x.id === id);
      if (!l) return;
      const total = l.gold * l.pricePer;
      // Integration point: this is where the buyer's wallet signs a single
      // $FARTPRINT transfer to the seller and the backend credits the gold.
      if (typeof window.fwGoldMarketSettle === 'function') {
        window.fwGoldMarketSettle(l);   // backend/wallet handles payment + gold credit
      } else {
        window.floater?.('🔗 Approve ' + fmt(total) + ' $FARTPRINT in your wallet to buy ' + l.gold + ' 🪙 — marketplace settlement goes live with the backend', 'bad');
      }
    }

    console.log('[goldmarket] GOLD ↔ $FARTPRINT marketplace tab ready');
  }
})();
