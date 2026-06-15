// =================================================================
// bakery.js — Ben's Bakery on Earth at (-35, -7). A printer NPC named
// "Ben" sells baked goods, payable in either Silver (🥈 credits) or
// Cash (💵 paper bills). Reuses establishments.js modal styling
// (.est-bg / .est-card / .est-row / .est-btn) so it matches Siim & Traech
// and inherits the pointer-lock release already wired for those modals.
// =================================================================
(function () {
  'use strict';

  function whenReady() {
    if (!window.THREE || !window.scene || !window.Player || !window.State ||
        !window.groundHeightAt || !window.ITEMS || !window.buildPrinter) {
      setTimeout(whenReady, 300); return;
    }
    try { init(); } catch (e) { console.error('[bakery] init failed', e); }
  }
  whenReady();

  function init() {
    const THREE = window.THREE;
    const scene = window.scene;
    const Player = window.Player;
    const State = window.State;
    const gH = window.groundHeightAt;
    const ITEMS = window.ITEMS;

    const BK_POS = { x: -35, z: -7 };

    // ── catalogue: silver price + cash price (cash ≈ 10× since 1🥈 = 10💵) ──
    const GOODS = [
      { id: 'bake_sourdough', name: 'Sourdough Bread', icon: '\u{1F35E}', silver: 25 },
      { id: 'bake_bun',       name: 'Hamburger Bun',   icon: '\u{1F354}', silver: 12 },
      { id: 'bake_whip',      name: 'Whipped Cream',   icon: '\u{1F366}', silver: 18 },
      { id: 'bake_butter',    name: 'Butter',          icon: '\u{1F9C8}', silver: 15 },
      { id: 'bake_wsugar',    name: 'White Sugar',     icon: '\u{1F9C2}', silver: 10 },
      { id: 'bake_bsugar',    name: 'Brown Sugar',     icon: '\u{1F7EB}', silver: 12 },
      { id: 'bake_donut',     name: 'Donut',           icon: '\u{1F369}', silver: 20 },
      { id: 'bake_cinnamon',  name: 'Cinnamon Roll',   icon: '\u{1F950}', silver: 28 },
      { id: 'bake_cupcake',   name: 'Cupcake',         icon: '\u{1F9C1}', silver: 22 },
      { id: 'bake_cookie',    name: 'Cookie',          icon: '\u{1F36A}', silver: 8 },
    ];
    GOODS.forEach(g => {
      g.cash = g.silver * 10;
      if (!ITEMS[g.id]) ITEMS[g.id] = { id: g.id, name: g.name, icon: g.icon, color: '#e8c98f', type: 'food', isNFT: false, marketPrice: g.silver };
    });

    // ── building ──
    (function buildBakery() {
      const grp = new THREE.Group();
      grp.position.set(BK_POS.x, gH(BK_POS.x, BK_POS.z), BK_POS.z);
      const wallMat = new THREE.MeshStandardMaterial({ color: 0xe8d3a8, roughness: 0.9 });
      const roofMat = new THREE.MeshStandardMaterial({ color: 0x8a4a2a, roughness: 0.8 });
      const trimMat = new THREE.MeshStandardMaterial({ color: 0x9a5a35, roughness: 0.75 });
      const slab = new THREE.Mesh(new THREE.BoxGeometry(6, 0.2, 5), new THREE.MeshStandardMaterial({ color: 0x6a5038, roughness: 0.95 }));
      slab.position.y = 0.1; grp.add(slab);
      const back = new THREE.Mesh(new THREE.BoxGeometry(6, 3.2, 0.2), wallMat);
      back.position.set(0, 1.7, 2.4); grp.add(back);
      for (const sx of [-3, 3]) {
        const side = new THREE.Mesh(new THREE.BoxGeometry(0.2, 3.2, 5), wallMat);
        side.position.set(sx, 1.7, 0); grp.add(side);
      }
      const roof = new THREE.Mesh(new THREE.BoxGeometry(6.6, 0.3, 5.6), roofMat);
      roof.position.set(0, 3.45, 0); grp.add(roof);
      // striped awning over the front
      for (let i = 0; i < 6; i++) {
        const stripe = new THREE.Mesh(new THREE.BoxGeometry(1, 0.12, 1.1),
          new THREE.MeshStandardMaterial({ color: (i % 2 ? 0xffffff : 0xd6483b), roughness: 0.7 }));
        stripe.position.set(-2.5 + i * 1.0, 2.5, -2.4);
        stripe.rotation.x = -0.32; grp.add(stripe);
      }
      // display counter at the front
      const counter = new THREE.Mesh(new THREE.BoxGeometry(4.4, 1.0, 1.0), trimMat);
      counter.position.set(0, 0.6, -1.7); grp.add(counter);
      const glass = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.7, 0.9),
        new THREE.MeshStandardMaterial({ color: 0xbfe8ff, transparent: true, opacity: 0.35, roughness: 0.15 }));
      glass.position.set(0, 1.35, -1.7); grp.add(glass);
      // sign
      const cv = document.createElement('canvas'); cv.width = 512; cv.height = 128;
      const ctx = cv.getContext('2d');
      ctx.fillStyle = '#3a2417'; ctx.fillRect(0, 0, 512, 128);
      ctx.strokeStyle = '#ffcf6a'; ctx.lineWidth = 6; ctx.strokeRect(8, 8, 496, 112);
      ctx.fillStyle = '#ffcf6a'; ctx.font = "900 54px 'Bangers','Orbitron',sans-serif";
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText("\u{1F9C1} BEN'S BAKERY", 256, 54);
      ctx.fillStyle = '#fff1d0'; ctx.font = "700 22px 'Orbitron',sans-serif";
      ctx.fillText('FRESH BAKED · SILVER OR CASH', 256, 98);
      const sign = new THREE.Mesh(new THREE.PlaneGeometry(4.8, 1.2), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(cv), transparent: true }));
      sign.position.set(0, 3.9, -2.35); sign.rotation.set(0.12, Math.PI, 0); grp.add(sign);
      scene.add(grp);
    })();

    // ── Ben (printer NPC behind the counter) ──
    const tagHost = document.getElementById('nameTags') || document.body;
    let ben;
    try { ben = window.buildPrinter(); } catch (_) { ben = new THREE.Group(); }
    try { if (ben.userData && ben.userData.screen) ben.userData.screen.material.color.setHex(0xffcf6a); } catch (_) {}
    ben.position.set(BK_POS.x, gH(BK_POS.x, BK_POS.z), BK_POS.z + 1.2);
    ben.rotation.y = Math.PI;
    scene.add(ben);
    const tag = document.createElement('div'); tag.className = 'name-tag'; tag.textContent = 'Ben \u{1F5A8}'; tag.style.display = 'none';
    tagHost.appendChild(tag);

    // ── shop modal (reuses establishments.js .est-* styling) ──
    const bg = document.createElement('div'); bg.className = 'est-bg'; bg.id = 'benBg';
    document.body.appendChild(bg);
    bg.addEventListener('click', (e) => { if (e.target === bg) bg.classList.remove('show'); });

    function render() {
      let rows = '';
      for (const g of GOODS) {
        const owned = (State.inventory && State.inventory[g.id]) || 0;
        rows += '<div class="est-row"><div class="ic">' + g.icon + '</div>' +
          '<div class="meta"><div class="nm">' + g.name + '</div>' +
          '<div class="sub">' + g.silver + ' \u{1F948}  ·  ' + g.cash + ' \u{1F4B5}' + (owned ? '  ·  owned ' + owned : '') + '</div></div>' +
          '<div class="btns"><button class="est-btn" data-buy="' + g.id + '" data-cur="silver">\u{1F948} Silver</button>' +
          '<button class="est-btn sell" data-buy="' + g.id + '" data-cur="cash">\u{1F4B5} Cash</button></div></div>';
      }
      bg.innerHTML = '<div class="est-card"><button class="est-close" id="benX" style="position:absolute;top:12px;right:16px;background:transparent;border:0;color:rgba(230,255,238,.55);font-size:24px;cursor:pointer">×</button>' +
        '<h2>\u{1F9C1} Ben\'s Bakery</h2><p>"Everything\'s baked fresh, friend. Pay in silver or cash — your choice."</p>' +
        rows + '</div>';
      bg.querySelector('#benX').addEventListener('click', () => bg.classList.remove('show'));
    }
    // delegated buy handler
    bg.addEventListener('click', (e) => {
      const b = e.target.closest('.est-btn[data-buy]');
      if (!b) return;
      const g = GOODS.find(x => x.id === b.dataset.buy);
      if (!g) return;
      const cur = b.dataset.cur;
      if (cur === 'silver') {
        if ((State.credits || 0) < g.silver) { window.floater?.('Need ' + g.silver + ' \u{1F948}', 'bad'); return; }
        State.credits -= g.silver;
        window.floater?.('+1 ' + g.name + ' · -' + g.silver + ' \u{1F948}', 'good');
      } else {
        if ((State.paper || 0) < g.cash) { window.floater?.('Need ' + g.cash + ' \u{1F4B5} cash', 'bad'); return; }
        State.paper -= g.cash;
        window.floater?.('+1 ' + g.name + ' · -' + g.cash + ' \u{1F4B5}', 'good');
      }
      try { window.addItem ? window.addItem(g.id, 1) : (State.inventory[g.id] = (State.inventory[g.id] || 0) + 1); } catch (_) {}
      try { window.playPurchaseSound?.(); window.updateHUD?.(); window.saveState?.(); } catch (_) {}
      render();
    });
    window.openBen = () => { render(); bg.classList.add('show'); };

    // ── proximity popup + E to open ──
    const pop = document.createElement('div'); pop.className = 'est-pop';
    pop.innerHTML = '<div class="who"><b>Ben</b> \u{1F9C1}</div><div class="line">Fresh baked goods</div><div>Press <kbd>E</kbd> or click below</div><button class="est-btn" id="benOpen" style="margin-top:7px;">Open Bakery</button>';
    document.body.appendChild(pop);
    let near = false;
    pop.querySelector('#benOpen').addEventListener('click', () => window.openBen());
    setInterval(() => {
      const d = Math.hypot(Player.pos.x - BK_POS.x, Player.pos.z - BK_POS.z);
      near = d < 4.5;
      pop.classList.toggle('show', near && !bg.classList.contains('show'));
    }, 200);
    window.addEventListener('keydown', (e) => {
      if (e.code !== 'KeyE' || !near) return;
      const a = document.activeElement;
      if (a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA')) return;
      if (bg.classList.contains('show')) return;
      window.openBen();
    });

    // ── name tag projection ──
    const _v = new THREE.Vector3();
    (function tagTick() {
      const dx = ben.position.x - Player.pos.x, dz = ben.position.z - Player.pos.z;
      if (dx * dx + dz * dz < 45 * 45 && window.camera) {
        _v.set(ben.position.x, ben.position.y + 2.6, ben.position.z); _v.project(window.camera);
        if (_v.z > -1 && _v.z < 1) {
          tag.style.left = ((_v.x * 0.5 + 0.5) * window.innerWidth) + 'px';
          tag.style.top = ((1 - (_v.y * 0.5 + 0.5)) * window.innerHeight) + 'px';
          tag.style.display = 'block';
        } else { tag.style.display = 'none'; }
      } else { tag.style.display = 'none'; }
      requestAnimationFrame(tagTick);
    })();

    console.log('[bakery] Ben\'s Bakery open at', BK_POS);
  }
})();
