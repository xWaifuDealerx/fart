// =================================================================
// dropitem.js — ground items, PUBG-style Vicinity panel, EQUIPPED
// slots (hat + weapon), and a custom POINTER-BASED drag system.
//
// Why not HTML5 drag&drop? It silently failed to start on the
// rebuilt inventory slots, and the raw mouse events then fell
// through to the game's camera ("it drags me around instead").
// This system owns the pointer from the moment you press on an
// item: a ghost icon follows the cursor, the world never sees the
// events, and the drop target is resolved on release.
//
//   bag → Vicinity / outside   = drop on the ground (visible, re-grabbable)
//   Vicinity → bag             = pick up (double-click works too)
//   bag → EQUIPPED slot        = equip (deagle → WEAPON, cap → HAT)
//   EQUIPPED → bag             = unequip
// =================================================================
(function(){
  'use strict';
  function whenReady(){
    if(!window.THREE || !window.scene || !window.Player || !window.State || !window.ITEMS){
      setTimeout(whenReady, 300); return;
    }
    init();
  }
  whenReady();

  function init(){
    const THREE = window.THREE;
    const scene = window.scene;
    const Player = window.Player;
    const State = window.State;
    const ITEMS = window.ITEMS;
    const groundHeightAt = window.groundHeightAt;

    // ── Cleanup: shovel doesn't exist anymore ──
    try {
      delete ITEMS.shovel;
      if(State.inventory && State.inventory.shovel !== undefined){
        delete State.inventory.shovel;
        window.saveState?.();
      }
      if(State.equipped === 'shovel'){
        State.equipped = null;
        window.saveState?.();
      }
    } catch(e){}

    // ──────────────────────────────────────────────────────────────
    // GROUND ITEMS
    // ──────────────────────────────────────────────────────────────
    function buildDroppedMesh(item){
      const grp = new THREE.Group();
      // Spider Meat: a black blob on the ground (no shiny cube)
      if(item.id === 'spider_meat'){
        const blob = new THREE.Mesh(
          new THREE.SphereGeometry(0.28, 10, 8),
          new THREE.MeshStandardMaterial({ color: 0x0a0a0a, roughness: 0.95 })
        );
        blob.scale.y = 0.5;
        blob.position.y = 0.16;
        blob.castShadow = true;
        grp.add(blob);
        const ring = new THREE.Mesh(
          new THREE.CylinderGeometry(0.34, 0.34, 0.03, 12),
          new THREE.MeshStandardMaterial({ color: 0x303038, emissive: 0x202028, emissiveIntensity: 0.4, roughness: 0.8 })
        );
        ring.position.y = 0.015;
        grp.add(ring);
        grp.userData = { item, bobT: Math.random() * Math.PI * 2, body: blob };
        return grp;
      }
      // Pedestal ring on the ground
      const ring = new THREE.Mesh(
        new THREE.CylinderGeometry(0.32, 0.32, 0.04, 14),
        new THREE.MeshStandardMaterial({ color: 0xffce4a, emissive: 0xffce4a, emissiveIntensity: 0.5, roughness: 0.6 })
      );
      ring.position.y = 0.02;
      grp.add(ring);
      // Visible item body — small floating cube with the item's color
      const colorHex = parseInt((item.color || '#e6ffee').replace('#', ''), 16);
      const body = new THREE.Mesh(
        new THREE.BoxGeometry(0.32, 0.32, 0.32),
        new THREE.MeshStandardMaterial({ color: colorHex, emissive: colorHex, emissiveIntensity: 0.15, roughness: 0.55 })
      );
      body.position.y = 0.42;
      body.castShadow = true;
      grp.add(body);
      grp.userData = { item, bobT: Math.random() * Math.PI * 2, body };
      return grp;
    }

    const Dropped = [];     // { mesh, x, z, y, id, qty }

    function dropAt(id, qty, x, z){
      const item = ITEMS[id];
      if(!item) return null;
      const y = (groundHeightAt ? groundHeightAt(x, z) : 0) + 0.05;
      const mesh = buildDroppedMesh(item);
      mesh.position.set(x, y, z);
      scene.add(mesh);
      const d = { mesh, x, z, y, id, qty: qty || 1 };
      Dropped.push(d);
      return d;
    }
    window.fwDropAt = dropAt;
    window.fwDropped = Dropped;

    function dropItem(id, qty){
      const item = ITEMS[id];
      if(!item) return;
      qty = qty || 1;
      const yaw = Player.yaw || 0;
      const fx = Math.sin(yaw + Math.PI);
      const fz = Math.cos(yaw + Math.PI);
      dropAt(id, qty, Player.pos.x + fx * 1.6, Player.pos.z + fz * 1.6);
      window.floater?.('Dropped ' + qty + ' ' + (item.name || id), 'good');
    }

    function pickUp(d){
      if(!d) return;
      const it = ITEMS[d.id];
      if(it){
        window.addItem?.(d.id, d.qty || 1);
        window.floater?.('+' + (d.qty || 1) + ' ' + (it.name || d.id), 'good');
      }
      try { scene.remove(d.mesh); } catch(_){}
      const idx = Dropped.indexOf(d);
      if(idx >= 0) Dropped.splice(idx, 1);
      window.saveState?.();
      window.updateHUD?.();
      renderVicinity();
    }

    // ──────────────────────────────────────────────────────────────
    // EQUIPPED state (hat + weapon)
    // ──────────────────────────────────────────────────────────────
    let EQ = { gun: false, hat: null };   // gun defaults to NOT equipped
    try { EQ = Object.assign(EQ, JSON.parse(localStorage.getItem('fw.equip.v1') || '{}')); } catch(_){}
    function saveEq(){ try { localStorage.setItem('fw.equip.v1', JSON.stringify(EQ)); } catch(_){} }
    window.fwGunHolstered = !EQ.gun;

    // First wearable: a Trucker Cap (sold at Carlos's)
    if(!ITEMS.cap){
      ITEMS.cap = {
        id: 'cap', name: 'Trucker Cap', icon: '🧢', color: '#3a78c2',
        type: 'wearable', isNFT: false, marketPrice: 120, suggestedPrice: 90,
      };
      try {
        if(Array.isArray(window.SEED_SHOP) && !window.SEED_SHOP.some(s => s.itemId === 'cap')){
          window.SEED_SHOP.push({ itemId: 'cap', desc: 'Headwear. Equip it in your inventory’s EQUIPPED panel — instant +100 style.' });
        }
      } catch(_){}
    }

    let capMesh = null;
    function ensureCapMesh(){
      const printer = window.printer || Player.mesh;
      if(!printer) return null;
      if(capMesh) return capMesh;
      const grp = new THREE.Group();
      const mat = new THREE.MeshStandardMaterial({ color: 0x3a78c2, roughness: 0.7 });
      const dome = new THREE.Mesh(new THREE.SphereGeometry(0.42, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), mat);
      grp.add(dome);
      const brim = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.05, 0.42), mat);
      brim.position.set(0, 0.04, 0.5);
      grp.add(brim);
      const btn = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 8),
        new THREE.MeshStandardMaterial({ color: 0xffd64d, roughness: 0.5 }));
      btn.position.y = 0.42;
      grp.add(btn);
      grp.position.set(0, 2.32, 0);
      printer.add(grp);
      capMesh = grp;
      return grp;
    }
    function applyEquip(){
      window.fwGunHolstered = !EQ.gun;
      const wearCap = EQ.hat === 'cap' && (State.inventory?.cap || 0) > 0;
      const m = wearCap ? ensureCapMesh() : capMesh;
      if(m) m.visible = wearCap;
    }
    function equipGun(on){
      if(on && !(State.inventory?.deagle > 0)){
        window.floater?.('No weapon to equip — buy a Desert Eagle at the Gunsmith', 'bad');
        return;
      }
      EQ.gun = !!on;
      saveEq(); applyEquip(); renderEquip();
      window.floater?.(EQ.gun ? '🔫 Desert Eagle equipped' : '🔫 Weapon unequipped — back in your bag', 'good');
    }
    function equipHat(on){
      if(on && !((State.inventory?.cap || 0) > 0)){
        window.floater?.('No headwear owned — Carlos sells Trucker Caps 🧢', 'bad');
        return;
      }
      EQ.hat = on ? 'cap' : null;
      saveEq(); applyEquip(); renderEquip();
      window.floater?.(EQ.hat ? '🧢 Cap equipped' : '🧢 Cap off — back in your bag', 'good');
    }
    function renderEquip(){
      const hatEl = document.getElementById('fwEqHat');
      const gunSl = document.getElementById('fwEqGun');
      if(!hatEl || !gunSl) return;
      const hasCap = (State.inventory?.cap || 0) > 0;
      const hatOn = EQ.hat === 'cap' && hasCap;
      hatEl.classList.toggle('filled', hatOn);
      hatEl.innerHTML = '<span class="ic">' + (hatOn ? '🧢' : '👤') + '</span><div class="meta">'
        + '<div class="lb">HAT</div>'
        + '<div class="nm">' + (hatOn ? 'Trucker Cap' : (hasCap ? 'Cap in bag' : 'Empty')) + '</div>'
        + '<div class="st">' + (hatOn ? 'drag to bag / click to take off' : (hasCap ? 'drag it here or click to wear' : 'Carlos sells caps 🧢')) + '</div></div>';
      const hasGun = (State.inventory?.deagle || 0) > 0;
      const gunOn = hasGun && EQ.gun;
      gunSl.classList.toggle('filled', gunOn);
      gunSl.innerHTML = '<span class="ic">' + (gunOn ? '🔫' : '⬜') + '</span><div class="meta">'
        + '<div class="lb">WEAPON</div>'
        + '<div class="nm">' + (gunOn ? 'Desert Eagle .50AE' : (hasGun ? 'Deagle in bag' : 'Empty')) + '</div>'
        + '<div class="st">' + (hasGun ? (gunOn ? 'drag to bag / click to unequip' : 'drag it here or click to equip') : 'buy one at the Gunsmith') + '</div></div>';
    }
    const eqBoot = setInterval(() => {
      if(window.printer || Player.mesh){ applyEquip(); clearInterval(eqBoot); }
    }, 800);
    // Public API — the Gunsmith auto-equips freshly bought guns with this
    window.fwEquipGun = equipGun;
    window.fwEquipHat = equipHat;

    // ──────────────────────────────────────────────────────────────
    // PANELS (Vicinity left · Equipped right) + styles
    // ──────────────────────────────────────────────────────────────
    const css = document.createElement('style');
    css.textContent = `
#fwVicinity{width:215px;max-height:80vh;align-self:center;margin-right:14px;flex:0 0 auto;
  background:linear-gradient(180deg,rgba(8,20,13,.97),rgba(4,11,7,.97));
  border:2px solid rgba(110,208,214,.45);border-radius:16px;padding:14px;
  display:flex;flex-direction:column;color:#e6ffee;font-family:'Outfit','Inter',sans-serif;
  box-shadow:0 16px 36px rgba(0,0,0,.5)}
#fwVicinity h3{font-family:'Bangers','Orbitron',sans-serif;font-size:18px;color:#6ed0d6;
  letter-spacing:1.6px;margin:0 0 4px}
#fwVicinity .hint{font-size:9.5px;color:rgba(230,255,238,.45);letter-spacing:.3px;margin-bottom:10px;line-height:1.4}
#fwVicList{overflow-y:auto;flex:1;display:flex;flex-direction:column;gap:6px}
.fw-vic-row{display:flex;align-items:center;gap:8px;background:rgba(110,208,214,.07);
  border:1px solid rgba(110,208,214,.25);border-radius:10px;padding:7px 10px;cursor:grab;
  transition:border-color .15s ease,transform .15s ease;user-select:none;touch-action:none}
.fw-vic-row:hover{border-color:#6ed0d6;transform:translateX(2px)}
.fw-vic-row .ic{font-size:18px}
.fw-vic-row .nm{font-size:11.5px;font-weight:700;flex:1;letter-spacing:.2px}
.fw-vic-row .q{font-family:'JetBrains Mono',monospace;font-size:10px;color:rgba(230,255,238,.6)}
.fw-vic-empty{font-size:11px;color:rgba(230,255,238,.4);text-align:center;padding:14px 4px;font-style:italic}
#fwEquip{width:200px;max-height:80vh;align-self:center;margin-left:14px;flex:0 0 auto;
  background:linear-gradient(180deg,rgba(8,20,13,.97),rgba(4,11,7,.97));
  border:2px solid rgba(255,206,74,.4);border-radius:16px;padding:14px;
  display:flex;flex-direction:column;gap:10px;color:#e6ffee;font-family:'Outfit','Inter',sans-serif;
  box-shadow:0 16px 36px rgba(0,0,0,.5)}
#fwEquip h3{font-family:'Bangers','Orbitron',sans-serif;font-size:18px;color:#ffd64d;letter-spacing:1.6px;margin:0 0 2px}
.fw-eq-slot{background:rgba(255,255,255,.04);border:1.5px dashed rgba(255,206,74,.35);border-radius:12px;
  padding:10px 12px;cursor:pointer;transition:border-color .15s ease,background .15s ease;min-height:58px;
  display:flex;align-items:center;gap:10px;user-select:none;touch-action:none}
.fw-eq-slot:hover{border-color:#ffd64d;background:rgba(255,206,74,.08)}
.fw-eq-slot.filled{border-style:solid;border-color:rgba(255,206,74,.55)}
.fw-eq-slot.dropok{border-color:#5ff09c;background:rgba(95,240,156,.12)}
.fw-eq-slot .ic{font-size:26px}
.fw-eq-slot .meta{flex:1}
.fw-eq-slot .lb{font-size:9px;font-weight:800;letter-spacing:1.2px;color:rgba(230,255,238,.45)}
.fw-eq-slot .nm{font-size:12px;font-weight:700;color:#fff1c2}
.fw-eq-slot .st{font-size:9.5px;color:rgba(230,255,238,.5)}
/* the inventory slots are drag sources now */
#invGrid .inv-slot[data-id]{cursor:grab;user-select:none;-webkit-user-drag:none;touch-action:none}
/* floating drag ghost */
#fwDragGhost{position:fixed;z-index:500;pointer-events:none;transform:translate(-50%,-60%);
  font-size:30px;filter:drop-shadow(0 6px 10px rgba(0,0,0,.65));display:none}
#fwDragGhost .gq{font-family:'Outfit',sans-serif;font-size:10px;font-weight:800;color:#fff;
  background:rgba(5,12,8,.9);border:1px solid rgba(95,240,156,.5);border-radius:100px;
  padding:1px 7px;position:absolute;bottom:-6px;right:-10px}
/* click action menu — the guaranteed way to move items around */
#fwLootMenu{position:fixed;z-index:510;display:none;min-width:170px;
  background:linear-gradient(165deg,rgba(12,26,16,.98),rgba(5,12,8,.99));
  border:1.5px solid rgba(95,240,156,.5);border-radius:13px;padding:8px;
  font-family:'Outfit','Inter',sans-serif;color:#e6ffee;
  box-shadow:0 18px 44px rgba(0,0,0,.7),0 0 26px rgba(95,240,156,.12)}
#fwLootMenu .ttl{display:flex;align-items:center;gap:8px;font-size:12px;font-weight:800;
  letter-spacing:.4px;color:#fff1c2;padding:4px 8px 8px;border-bottom:1px solid rgba(95,240,156,.18);margin-bottom:7px}
#fwLootMenu .ttl .i{font-size:18px}
#fwLootMenu button{display:flex;align-items:center;gap:8px;width:100%;text-align:left;
  background:rgba(95,240,156,.07);border:1px solid rgba(95,240,156,.25);color:#e6ffee;
  border-radius:9px;padding:8px 11px;margin-bottom:5px;cursor:pointer;
  font-family:'Outfit',sans-serif;font-weight:700;font-size:12px;letter-spacing:.3px;
  transition:background .12s ease,border-color .12s ease,transform .12s ease}
#fwLootMenu button:hover{background:rgba(95,240,156,.20);border-color:#5ff09c;transform:translateX(2px)}
#fwLootMenu button.warn{background:rgba(255,90,77,.08);border-color:rgba(255,122,110,.35);color:#ffb4ab}
#fwLootMenu button.warn:hover{background:rgba(255,90,77,.18);border-color:#ff7a6e}
#fwLootMenu button:last-child{margin-bottom:0}
`;
    document.head.appendChild(css);

    let vicPanel = null;
    function ensureVicinity(){
      if(vicPanel) return true;
      const bgEl = document.getElementById('invBg');
      const card = bgEl && bgEl.querySelector('.inv-card');
      if(!bgEl || !card) return false;
      vicPanel = document.createElement('div');
      vicPanel.id = 'fwVicinity';
      vicPanel.innerHTML = '<h3>📦 VICINITY</h3>'
        + '<div class="hint">Items on the ground near you. Drag into your bag to pick up — drag bag items HERE to drop them.</div>'
        + '<div id="fwVicList"></div>';
      bgEl.insertBefore(vicPanel, card);
      // delegation: rows are rebuilt constantly, the list isn't
      const vicList = vicPanel.querySelector('#fwVicList');
      vicList.addEventListener('pointerdown', (e) => {
        if(e.button !== 0) return;
        const row = e.target.closest?.('.fw-vic-row');
        if(!row || !row._drop) return;
        const it = ITEMS[row._drop.id] || {};
        beginDrag(e, { kind: 'vic', d: row._drop, icon: it.icon || '🎁', srcEl: row });
      });
      vicList.addEventListener('click', (e) => {
        if(justDragged()) return;
        const row = e.target.closest?.('.fw-vic-row');
        if(!row || !row._drop) return;
        e.stopPropagation();
        menuForVic(row._drop, e.clientX, e.clientY);
      });
      vicList.addEventListener('dblclick', (e) => {
        const row = e.target.closest?.('.fw-vic-row');
        if(!row || !row._drop) return;
        closeMenu();
        pickUp(row._drop);
        window.renderInventory?.();
      });
      // RIGHT-CLICK = instant pick up to inventory (no menu)
      vicList.addEventListener('contextmenu', (e) => {
        const row = e.target.closest?.('.fw-vic-row');
        if(!row || !row._drop) return;
        e.preventDefault();
        e.stopPropagation();
        closeMenu();
        pickUp(row._drop);
        window.renderInventory?.();
      });
      const eq = document.createElement('div');
      eq.id = 'fwEquip';
      eq.innerHTML = '<h3>🎽 EQUIPPED</h3>'
        + '<div class="fw-eq-slot" id="fwEqHat"></div>'
        + '<div class="fw-eq-slot" id="fwEqGun"></div>';
      card.insertAdjacentElement('afterend', eq);
      const hatSlot = document.getElementById('fwEqHat');
      const gunSlot = document.getElementById('fwEqGun');
      // click = action menu (Hide / Drop) — empty slots quick-equip
      hatSlot.addEventListener('click', (e) => { if(!justDragged()) menuForEq('hat', e.clientX, e.clientY); });
      gunSlot.addEventListener('click', (e) => { if(!justDragged()) menuForEq('gun', e.clientX, e.clientY); });
      // drag FROM an equipped slot = unequip
      hatSlot.addEventListener('pointerdown', (e) => {
        if(e.button !== 0 || EQ.hat !== 'cap') return;
        beginDrag(e, { kind: 'eq', id: 'hat', icon: '🧢', srcEl: hatSlot });
      });
      gunSlot.addEventListener('pointerdown', (e) => {
        if(e.button !== 0 || !EQ.gun) return;
        beginDrag(e, { kind: 'eq', id: 'gun', icon: '🔫', srcEl: gunSlot });
      });
      renderEquip();
      return true;
    }

    const VICINITY_R = 6;
    function nearbyDrops(){
      const out = [];
      for(const d of Dropped){
        if(Math.hypot(Player.pos.x - d.x, Player.pos.z - d.z) <= VICINITY_R) out.push(d);
      }
      return out;
    }
    function renderVicinity(){
      if(!ensureVicinity()) return;
      const list = document.getElementById('fwVicList');
      if(!list) return;
      const near = nearbyDrops();
      if(!near.length){
        list.innerHTML = '<div class="fw-vic-empty">Nothing on the ground nearby…</div>';
        return;
      }
      list.innerHTML = '';
      near.forEach(d => {
        const it = ITEMS[d.id] || {};
        const row = document.createElement('div');
        row.className = 'fw-vic-row';
        row._drop = d;     // delegation reads this
        row.innerHTML = '<span class="ic">' + (it.icon || '🎁') + '</span>'
          + '<span class="nm">' + (it.name || d.id) + '</span>'
          + '<span class="q">×' + (d.qty || 1) + '</span>';
        list.appendChild(row);
      });
    }

    // ──────────────────────────────────────────────────────────────
    // CLICK ACTION MENU — the guaranteed item-management path.
    //   inventory item → Equip (gun/hat) / Drop to vicinity
    //   vicinity item  → Add to inventory / Equip (gun/hat)
    //   equipped item  → Hide (to inventory) / Drop to vicinity
    // ──────────────────────────────────────────────────────────────
    function equipKind(id){
      if(id === 'deagle') return 'gun';
      if(id === 'cap') return 'hat';
      return null;
    }
    const menu = document.createElement('div');
    menu.id = 'fwLootMenu';
    document.body.appendChild(menu);
    function closeMenu(){ menu.style.display = 'none'; }
    document.addEventListener('pointerdown', (e) => {
      if(menu.style.display !== 'none' && !e.target.closest('#fwLootMenu')) closeMenu();
    }, true);
    window.addEventListener('keydown', (e) => { if(e.code === 'Escape') closeMenu(); });

    function openMenu(x, y, icon, name, actions){
      menu.innerHTML = '<div class="ttl"><span class="i">' + icon + '</span><span>' + name + '</span></div>'
        + actions.map((a, i) =>
            '<button data-i="' + i + '" class="' + (a.warn ? 'warn' : '') + '">' + a.label + '</button>'
          ).join('');
      menu.style.display = 'block';
      // position near the click, clamped to the viewport
      const mw = menu.offsetWidth, mh = menu.offsetHeight;
      menu.style.left = Math.min(x + 8, innerWidth - mw - 10) + 'px';
      menu.style.top  = Math.min(y + 8, innerHeight - mh - 10) + 'px';
      menu.querySelectorAll('button').forEach(btn => {
        btn.addEventListener('click', (ev) => {
          ev.stopPropagation();
          closeMenu();
          try { actions[Number(btn.dataset.i)].run(); } catch(err){ console.error('[dropitem] action', err); }
        });
      });
    }

    function menuForInv(id, x, y){
      const it = ITEMS[id] || {};
      const actions = [];
      const kind = equipKind(id);
      if(kind === 'gun') actions.push({ label: '🔫 Equip weapon', run: () => equipGun(true) });
      if(kind === 'hat') actions.push({ label: '🧢 Wear it', run: () => equipHat(true) });
      actions.push({ label: '📦 Drop to vicinity', warn: true, run: () => {
        dropItem(id, 1);
        window.takeItem?.(id, 1);
        window.updateHUD?.();
        window.renderInventory?.();
        renderVicinity();
      }});
      openMenu(x, y, it.icon || '🎁', it.name || id, actions);
    }
    function menuForVic(d, x, y){
      const it = ITEMS[d.id] || {};
      const actions = [{ label: '🎒 Add to inventory', run: () => { pickUp(d); window.renderInventory?.(); } }];
      const kind = equipKind(d.id);
      if(kind === 'gun') actions.push({ label: '🔫 Pick up & equip', run: () => { pickUp(d); equipGun(true); window.renderInventory?.(); } });
      if(kind === 'hat') actions.push({ label: '🧢 Pick up & wear', run: () => { pickUp(d); equipHat(true); window.renderInventory?.(); } });
      openMenu(x, y, it.icon || '🎁', (d.qty > 1 ? d.qty + '× ' : '') + (it.name || d.id), actions);
    }
    function menuForEq(kind, x, y){
      if(kind === 'gun' && !EQ.gun) return equipGun(true);   // empty slot click = quick equip
      if(kind === 'hat' && EQ.hat !== 'cap') return equipHat(true);
      const id = kind === 'gun' ? 'deagle' : 'cap';
      const it = ITEMS[id] || {};
      openMenu(x, y, it.icon || '🎁', it.name || id, [
        { label: '🎒 Hide (to inventory)', run: () => (kind === 'gun' ? equipGun(false) : equipHat(false)) },
        { label: '📦 Drop to vicinity', warn: true, run: () => {
          if(kind === 'gun') equipGun(false); else equipHat(false);
          dropItem(id, 1);
          window.takeItem?.(id, 1);
          window.updateHUD?.();
          window.renderInventory?.();
          renderVicinity();
        }},
      ]);
    }

    // ──────────────────────────────────────────────────────────────
    // POINTER-DRAG ENGINE — owns the pointer completely so the game
    // camera/controls never see drag movements.
    // ──────────────────────────────────────────────────────────────
    let drag = null;            // { kind, id?/d?, icon, sx, sy, active, srcEl }
    let _dragDoneAt = 0;
    function justDragged(){ return performance.now() - _dragDoneAt < 300; }

    const ghost = document.createElement('div');
    ghost.id = 'fwDragGhost';
    document.body.appendChild(ghost);

    function beginDrag(e, info){
      // NOTE: no preventDefault here — plain clicks on slots must keep
      // working (tool equipping etc.). We only swallow events once the
      // pointer actually moves and the drag activates.
      e.stopPropagation();        // the world never hears about this press
      drag = Object.assign({ sx: e.clientX, sy: e.clientY, active: false }, info);
    }
    function activateDrag(e){
      drag.active = true;
      ghost.innerHTML = drag.icon + (drag.qty > 1 ? '<span class="gq">×' + drag.qty + '</span>' : '');
      ghost.style.display = 'block';
      if(drag.srcEl) drag.srcEl.style.opacity = '0.45';
      moveGhost(e);
    }
    function moveGhost(e){
      ghost.style.left = e.clientX + 'px';
      ghost.style.top = e.clientY + 'px';
      // highlight equip slots while hovering with a compatible item
      if(drag.kind === 'inv'){
        const t = document.elementFromPoint(e.clientX, e.clientY);
        document.getElementById('fwEqGun')?.classList.toggle('dropok', !!(t && t.closest('#fwEqGun') && drag.id === 'deagle'));
        document.getElementById('fwEqHat')?.classList.toggle('dropok', !!(t && t.closest('#fwEqHat') && drag.id === 'cap'));
      }
    }
    window.addEventListener('pointermove', (e) => {
      if(!drag) return;
      if(!drag.active){
        if(Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) < 6) return;
        activateDrag(e);
      } else {
        moveGhost(e);
      }
      e.preventDefault();
      e.stopPropagation();
    }, true);
    window.addEventListener('pointerup', (e) => {
      if(!drag) return;
      const d = drag;
      drag = null;
      ghost.style.display = 'none';
      if(d.srcEl) d.srcEl.style.opacity = '';
      document.getElementById('fwEqGun')?.classList.remove('dropok');
      document.getElementById('fwEqHat')?.classList.remove('dropok');
      if(!d.active) return;                 // it was just a click
      _dragDoneAt = performance.now();
      e.preventDefault();
      e.stopPropagation();
      const t = document.elementFromPoint(e.clientX, e.clientY);
      finishDrag(d, t);
    }, true);
    // a real drag never counts as a click anywhere
    document.addEventListener('click', (e) => {
      if(justDragged()){ e.stopPropagation(); e.preventDefault(); }
    }, true);

    function finishDrag(d, t){
      if(d.kind === 'inv'){
        // 1) onto an EQUIPPED slot → equip
        if(t && t.closest('#fwEqGun')){
          if(d.id === 'deagle') equipGun(true);
          else window.floater?.('Only a weapon fits in the WEAPON slot', 'bad');
          return;
        }
        if(t && t.closest('#fwEqHat')){
          if(d.id === 'cap') equipHat(true);
          else window.floater?.('Only headwear fits in the HAT slot', 'bad');
          return;
        }
        // 2) onto Vicinity OR outside the inventory → drop on the ground
        const onVicinity = t && t.closest('#fwVicinity');
        const inside = t && (t.closest('#invGrid') || t.closest('.inv-card') || t.closest('#invBg') || t.closest('#fwEquip'));
        if(onVicinity || !inside){
          dropItem(d.id, 1);
          window.takeItem?.(d.id, 1);
          window.updateHUD?.();
          window.renderInventory?.();
          renderVicinity();
        }
      } else if(d.kind === 'vic'){
        if(t && !t.closest('#fwVicinity') && (t.closest('#invGrid') || t.closest('.inv-card') || t.closest('#fwEquip'))){
          pickUp(d.d);
          window.renderInventory?.();
        }
      } else if(d.kind === 'eq'){
        if(t && !t.closest('#fwEquip') && (t.closest('#invGrid') || t.closest('.inv-card') || t.closest('#fwVicinity'))){
          if(d.id === 'gun') equipGun(false);
          if(d.id === 'hat') equipHat(false);
        }
      }
    }

    // ── Inventory slot wiring — EVENT DELEGATION on the static grid.
    // Per-slot listeners kept missing rebuilt slots; the grid element
    // itself never changes, so one listener here catches every press
    // on every slot, present or future. Cannot race, cannot miss.
    function wireInventory(){
      const grid = document.getElementById('invGrid');
      if(!grid){ setTimeout(wireInventory, 600); return; }
      if(grid._dropWired) return;
      grid._dropWired = true;
      grid.addEventListener('pointerdown', (e) => {
        if(e.button !== 0) return;
        const el = e.target.closest?.('.inv-slot[data-id]');
        if(!el) return;
        const id = el.dataset.id;
        const qty = (State.inventory && State.inventory[id]) || 1;
        beginDrag(e, { kind: 'inv', id, qty, icon: (ITEMS[id]?.icon || '🎁'), srcEl: el });
      });
      // CLICK = action menu (Equip / Drop) — works even where drag won't
      grid.addEventListener('click', (e) => {
        if(justDragged()) return;
        const el = e.target.closest?.('.inv-slot[data-id]');
        if(!el) return;
        e.stopPropagation();
        menuForInv(el.dataset.id, e.clientX, e.clientY);
      });
      // RIGHT-CLICK = instant drop to vicinity (no menu)
      grid.addEventListener('contextmenu', (e) => {
        const el = e.target.closest?.('.inv-slot[data-id]');
        if(!el) return;
        e.preventDefault();
        e.stopPropagation();
        const id = el.dataset.id;
        dropItem(id, 1);
        window.takeItem?.(id, 1);
        window.updateHUD?.();
        window.renderInventory?.();
        renderVicinity();
      });
      console.log('[dropitem] inventory grid delegation armed (drag + click menu + right-click)');
    }
    wireInventory();

    // keep panels fresh while the inventory is open (paused mid-drag)
    setInterval(() => {
      const bgOpen = document.getElementById('invBg')?.classList.contains('show');
      if(!bgOpen || drag) return;
      renderVicinity();
      renderEquip();
    }, 700);

    // ──────────────────────────────────────────────────────────────
    // Proximity popup + G pickup (in-world)
    // ──────────────────────────────────────────────────────────────
    const popCss = document.createElement('style');
    popCss.textContent = `
.drop-pop{position:fixed;left:50%;bottom:200px;transform:translateX(-50%);display:none;background:linear-gradient(180deg,rgba(8,18,11,.96),rgba(5,14,9,.96));border:2px solid rgba(95,240,156,.55);border-radius:14px;padding:10px 18px;z-index:55;text-align:center;color:#fff1c2;font-family:'Outfit','Inter',sans-serif;box-shadow:0 14px 26px rgba(0,0,0,.55)}
.drop-pop.show{display:block}
.drop-pop .ic{font-size:22px;margin-bottom:3px;display:block}
.drop-pop .nm{font-family:'Outfit','Inter',sans-serif;font-size:14px;font-weight:700;color:#fff1c2;letter-spacing:.3px;margin-bottom:3px}
.drop-pop .hint{font-size:11px;color:rgba(230,255,238,.7)}
.drop-pop kbd{background:rgba(95,240,156,.22);border:1px solid rgba(95,240,156,.55);color:#5ff09c;padding:2px 8px;border-radius:6px;font-family:monospace;font-size:11px;font-weight:700}
`;
    document.head.appendChild(popCss);
    const pop = document.createElement('div');
    pop.className = 'drop-pop';
    pop.innerHTML = '<span class="ic" id="dropIc">\u{1F381}</span><div class="nm" id="dropNm">Item</div><div class="hint">Press <kbd>G</kbd> to pick up</div>';
    document.body.appendChild(pop);

    let nearest = null;
    function tick(){
      let closest = null, closestD = 2.4;
      for(const d of Dropped){
        d.mesh.userData.bobT += 0.04;
        d.mesh.userData.body.position.y = (d.id === 'spider_meat' ? 0.16 : 0.42) + Math.sin(d.mesh.userData.bobT) * 0.05;
        d.mesh.userData.body.rotation.y += 0.02;
        const dist = Math.hypot(Player.pos.x - d.x, Player.pos.z - d.z);
        if(dist < closestD){ closestD = dist; closest = d; }
      }
      nearest = closest;
      if(closest){
        const item = ITEMS[closest.id];
        if(item){
          document.getElementById('dropIc').textContent = item.icon || '\u{1F381}';
          document.getElementById('dropNm').textContent = (closest.qty > 1 ? closest.qty + 'x ' : '') + (item.name || closest.id);
        }
        pop.classList.add('show');
      } else {
        pop.classList.remove('show');
      }
      requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);

    window.addEventListener('keydown', (e) => {
      if(e.code !== 'KeyG' || !nearest) return;
      const a = document.activeElement;
      if(a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA')) return;
      pickUp(nearest);
      nearest = null;
      pop.classList.remove('show');
    });
    pop.addEventListener('click', () => {
      if(!nearest) return;
      pickUp(nearest);
      nearest = null;
      pop.classList.remove('show');
    });

    console.log('[dropitem] pointer-drag loot system ready (bag ⇄ vicinity ⇄ equipped)');
  }
})();
