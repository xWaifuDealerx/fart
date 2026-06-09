// =================================================================
// extras-v6b.js — Logout, crafting items, weed/jar tiers, Pawn Shop
// =================================================================
// What ships here:
//   - Logout button (disconnects Phantom + clears wallet + reload)
//   - 5-tier weed items registered into window.ITEMS, plus a rarity
//     roll inside the existing harvest pathway
//   - Plastic Bag / Shovel / Sand Bag / Empty Jar crafting items
//   - 5-tier FartJar items
//   - Pawn Shop NPC counter (Gary) that buys FartJars at +25% vs market
// All globals come from window — the main module has exposed
// State, ITEMS, addItem, takeItem, floater, etc. before this loads.
// =================================================================
(function(){
  'use strict';

  function whenReady(){
    if(!window.State || !window.ITEMS || !window.addItem || !window.THREE || !window.scene){
      setTimeout(whenReady, 250);
      return;
    }
    init();
  }
  whenReady();

  function init(){
    const State = window.State;
    const ITEMS = window.ITEMS;

    // ──────────────────────────────────────────────────────────────
    // 1) NEW CRAFTING ITEMS — add to the global catalog
    // ──────────────────────────────────────────────────────────────
    Object.assign(ITEMS, {
      // Weed tiers — sorted from common to legendary. Sale price scales
      // ~3× per tier so harvesting a high-tier batch is a real windfall.
      weed_dirt: {
        id: "weed_dirt", name: "Dirt Weed",
        icon: "🌱", color: "#7a8a4a",
        type: "crop", isNFT: false,
        suggestedPrice: 50, tier: 1,
      },
      weed_pineapple: {
        id: "weed_pineapple", name: "Pineapple Express",
        icon: "🍍", color: "#ffd64d",
        type: "crop", isNFT: false,
        suggestedPrice: 120, tier: 2,
      },
      weed_diesel: {
        id: "weed_diesel", name: "Sour Diesel",
        icon: "⛽", color: "#9bdcff",
        type: "crop", isNFT: false,
        suggestedPrice: 250, tier: 3,
      },
      weed_cosmic: {
        id: "weed_cosmic", name: "Cosmic Kush",
        icon: "🌌", color: "#c084fc",
        type: "crop", isNFT: false,
        suggestedPrice: 600, tier: 4,
      },
      weed_unicorn: {
        id: "weed_unicorn", name: "Unicorn Poop",
        icon: "🦄", color: "#ff5ad6",
        type: "crop", isNFT: false,
        suggestedPrice: 1500, tier: 5,
      },
      // Crafting materials for the jar/fart-jar economy
      plastic_bag: {
        id: "plastic_bag", name: "Plastic Bag",
        icon: "🛍", color: "#a8c8ff",
        type: "material", isNFT: false,
        marketPrice: 8, suggestedPrice: 6,
      },
      shovel: {
        id: "shovel", name: "Shovel",
        icon: "🪏", color: "#a87338",
        type: "tool", isNFT: false,
        marketPrice: 40, suggestedPrice: 30,
      },
      sand_bag: {
        id: "sand_bag", name: "Bag of Sand",
        icon: "🏖", color: "#e8d99a",
        type: "material", isNFT: false,
        suggestedPrice: 14,
      },
      jar_empty: {
        id: "jar_empty", name: "Empty Jar",
        icon: "🫙", color: "#c8e0ff",
        type: "material", isNFT: false,
        suggestedPrice: 28,
      },
      // FartJar rarity tiers — Gary buys these at premium prices.
      fartjar_green: {
        id: "fartjar_green", name: "Green Fart Jar",
        icon: "🟢", color: "#5ff09c",
        type: "fartjar", isNFT: false,
        suggestedPrice: 30, tier: 1,
      },
      fartjar_blue: {
        id: "fartjar_blue", name: "Blue Fart Jar",
        icon: "🔵", color: "#5fc5ff",
        type: "fartjar", isNFT: false,
        suggestedPrice: 80, tier: 2,
      },
      fartjar_purple: {
        id: "fartjar_purple", name: "Purple Fart Jar",
        icon: "🟣", color: "#c084fc",
        type: "fartjar", isNFT: false,
        suggestedPrice: 250, tier: 3,
      },
      fartjar_orange: {
        id: "fartjar_orange", name: "Orange Fart Jar",
        icon: "🟠", color: "#ff9d3d",
        type: "fartjar", isNFT: false,
        suggestedPrice: 800, tier: 4,
      },
      fartjar_rainbow: {
        id: "fartjar_rainbow", name: "Rainbow Fart Jar",
        icon: "🌈", color: "#ff5ad6",
        type: "fartjar", isNFT: false,
        suggestedPrice: 5000, tier: 5,
      },
    });

    // One-time migration: older saves (and any harvest before the strain
    // fix) stored weed under the generic "weed" id, which displays as just
    // "Weed". Fold it into Dirt Weed so the inventory always names a strain.
    try {
      if(window.State && State.inventory && (State.inventory.weed || 0) > 0){
        State.inventory.weed_dirt = (State.inventory.weed_dirt || 0) + State.inventory.weed;
        delete State.inventory.weed;
        window.saveState?.();
        window.renderInventory?.();
      }
    } catch(_){}

    // ──────────────────────────────────────────────────────────────
    // 2) WEED HARVEST → random tier
    // ──────────────────────────────────────────────────────────────
    // The main module's harvest code calls addItem(plot.crop, qty).
    // We monkey-patch addItem so when the crop is the generic "weed"
    // id, we re-roll the bud to a tiered weed item and pass that on.
    // Falls through cleanly for every other addItem call.
    const WEED_TIERS = [
      { id: "weed_dirt",      weight: 60 },
      { id: "weed_pineapple", weight: 25 },
      { id: "weed_diesel",    weight: 10 },
      { id: "weed_cosmic",    weight: 4 },
      { id: "weed_unicorn",   weight: 1 },
    ];
    function rollWeedTier(){
      const total = WEED_TIERS.reduce((s, t) => s + t.weight, 0);
      let r = Math.random() * total;
      for(const t of WEED_TIERS){ r -= t.weight; if(r <= 0) return t.id; }
      return "weed_dirt";
    }
    // Rarity ranking (rarest first) so we can report the best bud of a run.
    const RARITY_ORDER = ["weed_unicorn", "weed_cosmic", "weed_diesel", "weed_pineapple", "weed_dirt"];
    const _origAddItem = window.addItem;
    window.addItem = function(id, qty){
      if(id === "weed"){
        // Re-roll each bud individually so a harvest of 10 can include
        // a mix of tiers (with a chance for that one Unicorn Poop).
        const ITEMS_ = window.ITEMS;
        let rarestThisRun = null, rarestRank = 999;
        for(let i = 0; i < (qty || 1); i++){
          const tierId = rollWeedTier();
          _origAddItem(tierId, 1);
          const rank = RARITY_ORDER.indexOf(tierId);
          if(rank !== -1 && rank < rarestRank){ rarestRank = rank; rarestThisRun = tierId; }
          // Log the rarest of the run — keeps the floater interesting.
          if(i === 0 && tierId !== "weed_dirt"){
            window.floater?.(`+1 ${ITEMS_[tierId].name}`, "good");
          }
        }
        // Stash the rarest strain ACTUALLY rolled this harvest so the reveal
        // carousel lands on what the player really got — not the rarest bud
        // they happen to already own (the old bug: own one unicorn and every
        // future carousel falsely landed on unicorn).
        window._lastWeedRollRarest = rarestThisRun || "weed_dirt";
        return;
      }
      return _origAddItem(id, qty);
    };

    // ──────────────────────────────────────────────────────────────
    // 3) LOGOUT BUTTON — top-right corner under the leaderboard btn
    // ──────────────────────────────────────────────────────────────
    const lbStyle = document.createElement('style');
    lbStyle.textContent = `
.logout-btn { position: absolute; top: 188px; right: 14px; width: 44px; height: 44px; border-radius: 12px; background: rgba(40,8,8,.72); backdrop-filter: blur(10px); border: 1px solid rgba(255,90,77,.35); color: #ff7a6e; font-size: 20px; display: flex; align-items: center; justify-content: center; cursor: pointer; pointer-events: auto; transition: all .15s; z-index: 12; }
.logout-btn:hover { border-color: #ff5a4d; box-shadow: 0 0 16px rgba(255,90,77,.30); }
`;
    document.head.appendChild(lbStyle);
    const logoutBtn = document.createElement('button');
    logoutBtn.className = 'logout-btn';
    logoutBtn.id = 'logoutBtn';
    logoutBtn.title = 'Logout';
    logoutBtn.textContent = '\u{23FB}';
    document.body.appendChild(logoutBtn);
    logoutBtn.addEventListener('click', async () => {
      if(!confirm("Log out?\n\nThis disconnects your wallet and brings you back to the login screen. Your game progress stays saved.")) return;
      // Disconnect Phantom if we have it
      try {
        const phantom = window.phantom?.solana || window.solana;
        if(phantom?.disconnect) await phantom.disconnect();
      } catch(_){}
      // Clear wallet/session bits but keep username, XP, inventory, etc.
      State.wallet = null;
      State.fartprintBalance = null;
      window.saveState?.();
      // Hard reload so the login screen reappears fresh
      location.reload();
    });

    // ──────────────────────────────────────────────────────────────
    // 4) PAWN SHOP NPC — Gary buys FartJars at +25%
    // ──────────────────────────────────────────────────────────────
    // Reuses the Carlos-style modal pattern. Gary's premium kicks in
    // because FartJars are NFT-feel items and his shop is the only
    // outlet that pays above market for them.
    const PAWN_PREMIUM = 1.25;
    const style = document.createElement('style');
    style.textContent = `
.gary-bg { position: fixed; inset: 0; background: rgba(0,0,0,.78); backdrop-filter: blur(10px); display: none; align-items: center; justify-content: center; z-index: 66; padding: 20px; }
.gary-bg.show { display: flex; }
.gary-card { max-width: 480px; width: 100%; max-height: 90vh; background: linear-gradient(180deg, rgba(36,22,10,.97), rgba(20,12,4,.97)); border: 2px solid rgba(200,152,88,.55); border-radius: 18px; overflow: hidden; display: flex; flex-direction: column; }
.gary-head { display: flex; align-items: center; justify-content: space-between; padding: 14px 20px; border-bottom: 1px solid rgba(200,152,88,.25); background: linear-gradient(90deg, rgba(200,152,88,.10), transparent); }
.gary-head h2 { font-family: 'Bangers','Orbitron',sans-serif; font-size: 26px; letter-spacing: 2.2px; color: #fff1c2; }
.gary-head .close { background: transparent; border: 0; color: rgba(230,255,238,.55); font-size: 22px; cursor: pointer; }
.gary-body { overflow-y: auto; padding: 14px 18px 18px; }
.gary-intro { color: rgba(230,255,238,.7); font-size: 12.5px; line-height: 1.55; margin-bottom: 12px; }
.gary-intro b { color: #ffd64d; }
.gary-row { display: grid; grid-template-columns: 36px 1fr auto auto; gap: 10px; align-items: center; padding: 8px 12px; background: rgba(200,152,88,.06); border: 1px solid rgba(200,152,88,.20); border-radius: 10px; margin-bottom: 6px; }
.gary-row .ico { font-size: 22px; text-align: center; }
.gary-row .nm { font-family: 'Orbitron',sans-serif; font-weight: 800; font-size: 13px; color: #fff1c2; }
.gary-row .sub { font-family: 'JetBrains Mono',monospace; font-size: 10px; color: rgba(230,255,238,.5); margin-top: 2px; }
.gary-row .qty { font-family: 'Orbitron',sans-serif; font-weight: 900; font-size: 13px; color: #ffd64d; }
.gary-row .btn { background: linear-gradient(135deg, #c89858, #fff1c2); color: #2a1408; border: 0; padding: 7px 14px; border-radius: 100px; font-family: 'Orbitron',sans-serif; font-weight: 900; font-size: 11px; cursor: pointer; }
.gary-empty { color: rgba(230,255,238,.45); font-family: 'JetBrains Mono',monospace; font-size: 11px; text-align: center; padding: 14px 0; }
.gary-pop { position: sticky; top: 0; background: linear-gradient(135deg, #c89858, #fff1c2); color: #2a1408; font-family: 'Orbitron',sans-serif; font-weight: 900; font-size: 13px; letter-spacing: 1.2px; text-align: center; padding: 10px 14px; border-radius: 12px; margin-bottom: 10px; opacity: 0; transition: opacity .2s; }
.gary-pop.show { opacity: 1; }
`;
    document.head.appendChild(style);
    const garyEl = document.createElement('div');
    garyEl.innerHTML = '<div class="gary-bg" id="garyBg"><div class="gary-card"><div class="gary-head"><h2>\u{1F5A8} Gary\'s Pawn Shop</h2><button class="close" id="garyClose">×</button></div><div class="gary-body"><div class="gary-pop" id="garyPop">+0 \u{1F948}</div><p class="gary-intro">Gary specialises in <b>Fart Jars</b>. Pays <b style="color:#ffd64d;">125%</b> of market price (no listings, no waiting). Bring \'em rare.</p><div id="garyList"></div></div></div></div>';
    document.body.appendChild(garyEl.firstElementChild);
    document.getElementById('garyClose').addEventListener('click', () => document.getElementById('garyBg').classList.remove('show'));
    document.getElementById('garyBg').addEventListener('click', (e) => { if(e.target.id === "garyBg") document.getElementById('garyBg').classList.remove('show'); });

    function renderGary(){
      const ITEMS_ = window.ITEMS;
      const host = document.getElementById('garyList');
      const lines = [];
      for(const id of Object.keys(State.inventory || {})){
        const item = ITEMS_[id]; if(!item) continue;
        if(item.type !== "fartjar") continue;
        const qty = State.inventory[id] || 0;
        if(qty <= 0) continue;
        const ref = item.suggestedPrice || item.marketPrice || 0;
        const sellAt = Math.max(1, Math.floor(ref * PAWN_PREMIUM));
        lines.push(`<div class="gary-row">
          <div class="ico" style="color:${item.color};">${item.icon}</div>
          <div><div class="nm">${item.name}</div><div class="sub">market ${ref}\u{1F948} · Gary pays ${sellAt}\u{1F948}</div></div>
          <div class="qty">×${qty}</div>
          <button class="btn" data-id="${id}" data-price="${sellAt}">SELL 1</button>
        </div>`);
      }
      host.innerHTML = lines.length ? lines.join("") : '<div class="gary-empty">Nothin\' rare on you right now. Bring me a Fart Jar.</div>';
      host.querySelectorAll('.btn').forEach(b => {
        b.addEventListener('click', () => {
          const id = b.dataset.id;
          const price = Number(b.dataset.price) || 0;
          window.takeItem(id, 1);
          State.credits = (State.credits || 0) + price;
          State.xp += 4;
          const pop = document.getElementById('garyPop');
          pop.textContent = `+${price} \u{1F948}  ·  sold ${ITEMS[id].name}`;
          pop.classList.remove('show'); void pop.offsetWidth; pop.classList.add('show');
          clearTimeout(window._garyPopT);
          window._garyPopT = setTimeout(() => pop.classList.remove('show'), 2200);
          window.playPurchaseSound?.();
          window.checkLevelUp?.();
          window.saveState?.();
          window.updateHUD?.();
          renderGary();
        });
      });
    }
    function openGary(){
      const pop = document.getElementById('garyPop'); if(pop) pop.classList.remove('show');
      renderGary();
      document.getElementById('garyBg').classList.add('show');
    }
    window.openGary = openGary;

    console.log("[extras-v6b] crafting items, weed tiers, logout, Gary's pawn shop ready");
  }
})();
