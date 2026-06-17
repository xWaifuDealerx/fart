// =================================================================
// dropitem.js — ★ v13 PUBG-STYLE INVENTORY ★
// Full rebuild of the Inventory / Vicinity / Equipped window with ONE
// robust mouse-drag engine. Drag freely between:
//   Vicinity (ground)  ⇄  Inventory (bag)  ⇄  Equipped (weapon + hat)
// Plus right-click options menu, double-click quick-action, G pickup.
//
// Ground-item meshes, equip meshes and the public fw* API
// (fwDropAt / fwDropped / fwEquipGun / fwEquipHat / fwGunHolstered)
// are preserved exactly so gunsmith.js / controls.js keep working.
//
// NOTE: dragging is NOT native HTML5 drag (that was unreliable here) —
// it is a self-contained pointer engine: mousedown on a source →
// floating ghost follows the cursor → mouseup resolves the drop zone
// with elementFromPoint. Nothing is marked draggable.
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
    const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g,
      c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' }[c]));

    // ── Cleanup: shovel doesn't exist anymore ──
    try {
      delete ITEMS.shovel;
      if(State.inventory && State.inventory.shovel !== undefined){ delete State.inventory.shovel; window.saveState?.(); }
      if(State.equipped === 'shovel'){ State.equipped = null; window.saveState?.(); }
    } catch(e){}

    // ──────────────────────────────────────────────────────────────
    // GROUND ITEMS (3D meshes)
    // ──────────────────────────────────────────────────────────────
    function buildDroppedMesh(item){
      const grp = new THREE.Group();
      if(item.id === 'spider_meat'){
        const blob = new THREE.Mesh(
          new THREE.SphereGeometry(0.28, 10, 8),
          new THREE.MeshStandardMaterial({ color: 0x0a0a0a, roughness: 0.95 })
        );
        blob.scale.y = 0.5; blob.position.y = 0.16; blob.castShadow = true;
        grp.add(blob);
        const ring = new THREE.Mesh(
          new THREE.CylinderGeometry(0.34, 0.34, 0.03, 12),
          new THREE.MeshStandardMaterial({ color: 0x303038, emissive: 0x202028, emissiveIntensity: 0.4, roughness: 0.8 })
        );
        ring.position.y = 0.015; grp.add(ring);
        grp.userData = { item, bobT: Math.random() * Math.PI * 2, body: blob };
        return grp;
      }
      const ring = new THREE.Mesh(
        new THREE.CylinderGeometry(0.32, 0.32, 0.04, 14),
        new THREE.MeshStandardMaterial({ color: 0xffce4a, emissive: 0xffce4a, emissiveIntensity: 0.5, roughness: 0.6 })
      );
      ring.position.y = 0.02; grp.add(ring);
      const colorHex = parseInt((item.color || '#e6ffee').replace('#', ''), 16);
      const body = new THREE.Mesh(
        new THREE.BoxGeometry(0.32, 0.32, 0.32),
        new THREE.MeshStandardMaterial({ color: colorHex, emissive: colorHex, emissiveIntensity: 0.15, roughness: 0.55 })
      );
      body.position.y = 0.42; body.castShadow = true; grp.add(body);
      grp.userData = { item, bobT: Math.random() * Math.PI * 2, body };
      return grp;
    }

    const Dropped = [];     // { mesh, x, z, y, id, qty }

    function genDropId(){ return 'd_' + Math.random().toString(36).slice(2, 10); }
    // Spawn a drop mesh locally (shared by local drops AND server-relayed ones).
    function spawnDrop(id, qty, x, z, dropId){
      const item = ITEMS[id];
      if(!item) return null;
      const y = (groundHeightAt ? groundHeightAt(x, z) : 0) + 0.05;
      const mesh = buildDroppedMesh(item);
      mesh.position.set(x, y, z);
      scene.add(mesh);
      const d = { mesh, x, z, y, id, qty: qty || 1, dropId: dropId || genDropId() };
      Dropped.push(d);
      return d;
    }
    function dropAt(id, qty, x, z){
      const d = spawnDrop(id, qty, x, z, null);
      // Tell the server so this drop appears on the ground for everyone.
      if(d){ try { window.fwDropSyncAdd && window.fwDropSyncAdd(d); } catch(_){} }
      return d;
    }
    window.fwDropAt = dropAt;
    window.fwDropped = Dropped;
    // Server → client: a drop another player created / the world snapshot.
    window.fwApplyDrop = function(e){
      if(!e || !e.dropId) return;
      if(Dropped.some(d => d.dropId === e.dropId)) return;   // already have it
      spawnDrop(e.id, e.qty, e.x, e.z, e.dropId);
    };
    window.fwApplyDropList = function(list){ for(const e of (list || [])) window.fwApplyDrop(e); };
    window.fwRemoveDrop = function(dropId){
      const i = Dropped.findIndex(d => d.dropId === dropId);
      if(i < 0) return;
      try { scene.remove(Dropped[i].mesh); } catch(_){}
      Dropped.splice(i, 1);
      try { refreshUI(); } catch(_){}
    };

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
      // Tell the server so this drop is removed for every player.
      try { if(d.dropId && window.fwDropSyncPick) window.fwDropSyncPick(d.dropId); } catch(_){}
      try { scene.remove(d.mesh); } catch(_){}
      const idx = Dropped.indexOf(d);
      if(idx >= 0) Dropped.splice(idx, 1);
      window.saveState?.();
      window.updateHUD?.();
      refreshUI();
    }

    // ──────────────────────────────────────────────────────────────
    // EQUIPPED state (hat + weapon) + character meshes
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
      brim.position.set(0, 0.04, 0.5); grp.add(brim);
      const btn = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 8),
        new THREE.MeshStandardMaterial({ color: 0xffd64d, roughness: 0.5 }));
      btn.position.y = 0.42; grp.add(btn);
      grp.position.set(0, 1.52, 0);   // rests on the printer's head
      printer.add(grp);
      capMesh = grp;
      return grp;
    }
    function applyEquip(){
      // Only the deagle's draw state is driven by EQ.gun here. When an
      // AK/M40 is the active weapon, the gunsmith weapon system owns
      // fwGunHolstered — don't override it (it would holster the rifle).
      const activeIsDeagle = (typeof window.fwActiveWeapon !== 'function') || window.fwActiveWeapon() === 'deagle';
      if(activeIsDeagle) window.fwGunHolstered = !EQ.gun;
      const wearCap = EQ.hat === 'cap' && (State.inventory?.cap || 0) > 0;
      const m = wearCap ? ensureCapMesh() : capMesh;
      if(m) m.visible = wearCap;
      // Hide the white paper sheet on top of the printer while the cap is on.
      try { const pg = window.printer?.userData?.paperGrp; if(pg) pg.visible = !wearCap; } catch(_){}
    }
    function equipGun(on){
      if(on && !(State.inventory?.deagle > 0)){
        window.floater?.('No weapon to equip — buy a Desert Eagle at the Gunsmith', 'bad');
        return;
      }
      EQ.gun = !!on;
      saveEq(); applyEquip(); refreshUI();
      window.floater?.(EQ.gun ? '🔫 Desert Eagle equipped' : '🔫 Weapon unequipped — back in your bag', 'good');
    }
    function equipHat(on){
      if(on && !((State.inventory?.cap || 0) > 0)){
        window.floater?.('No headwear owned — Carlos sells Trucker Caps 🧢', 'bad');
        return;
      }
      EQ.hat = on ? 'cap' : null;
      saveEq(); applyEquip(); refreshUI();
      window.floater?.(EQ.hat ? '🧢 Cap equipped' : '🧢 Cap off — back in your bag', 'good');
    }
    const eqBoot = setInterval(() => {
      if(window.printer || Player.mesh){ applyEquip(); clearInterval(eqBoot); }
    }, 800);
    window.fwEquipGun = equipGun;
    window.fwEquipHat = equipHat;

    const WEAPON_IDS = ['deagle', 'ak47', 'm40'];
    function equipKind(id){
      if(WEAPON_IDS.indexOf(id) >= 0) return 'gun';
      if(id === 'cap') return 'hat';
      return null;
    }
    function itemMeta(id){
      const it = ITEMS[id] || {};
      let icon = it.icon, name = it.name, color = it.color;
      if(id === 'deagle'){ icon = icon || '🔫'; name = name || 'Desert Eagle .50AE'; color = color || '#d6b35a'; }
      if(id === 'ak47'){ icon = icon || '🔫'; name = name || 'AK-47'; color = color || '#6a5a3a'; }
      if(id === 'm40'){ icon = icon || '🎯'; name = name || 'M40 Sniper'; color = color || '#3a4a3a'; }
      if(id === 'cap'){ icon = icon || '🧢'; name = name || 'Trucker Cap'; color = color || '#3a78c2'; }
      return { icon: icon || '🎁', name: name || id, color: color || '#cfe' };
    }
    // ── Weapons unify with gunsmith.js's weapon system ──
    // The active drawn weapon (deagle/ak47/m40), or null when holstered.
    function activeWeapon(){
      const id = (typeof window.fwActiveWeapon === 'function') ? window.fwActiveWeapon() : 'deagle';
      const owned = (State.inventory?.[id] || 0) > 0;
      return (owned && !window.fwGunHolstered) ? id : null;
    }
    function ownsAnyWeapon(){ return WEAPON_IDS.some(id => (State.inventory?.[id] || 0) > 0); }
    function equipWeapon(id){
      if(typeof window.fwSwitchWeapon === 'function') window.fwSwitchWeapon(id);
      else equipGun(true);   // fallback (deagle only)
    }
    function holsterWeapon(id){
      if(id === 'deagle') equipGun(false);
      else window.fwGunHolstered = true;
    }

    // ──────────────────────────────────────────────────────────────
    // STYLES (PUBG-inspired, dark with the game's green accent)
    // ──────────────────────────────────────────────────────────────
    const css = document.createElement('style');
    css.textContent = `
/* #invBg lives inside #hud, which is pointer-events:none — so we MUST
   re-enable pointer-events here or nothing in the panel is clickable
   (it renders fine but eats no clicks/drags). Children inherit auto. */
#fwInv2{width:min(1180px,95vw);height:min(780px,90vh);display:flex;flex-direction:column;
  pointer-events:auto;
  background:linear-gradient(180deg,rgba(10,16,13,.97),rgba(6,10,8,.98));
  border:1px solid rgba(120,140,128,.35);border-radius:10px;overflow:hidden;
  color:#e6efe9;font-family:'Outfit','Inter',sans-serif;
  box-shadow:0 30px 90px rgba(0,0,0,.7);user-select:none;-webkit-user-select:none}
#fwInv2 .fw2-head{display:flex;align-items:center;gap:14px;padding:13px 18px;
  background:linear-gradient(180deg,rgba(255,255,255,.05),rgba(255,255,255,0));
  border-bottom:1px solid rgba(120,140,128,.22)}
#fwInv2 .fw2-title{font-family:'Bangers','Orbitron',sans-serif;font-size:22px;letter-spacing:2px;color:#f3f7f4}
#fwInv2 .fw2-sub{font-size:11px;color:rgba(230,239,233,.45);letter-spacing:.5px;flex:1}
#fwInv2 .fw2-close{margin-left:auto;width:30px;height:30px;border-radius:6px;border:1px solid rgba(160,175,165,.3);
  background:rgba(255,255,255,.04);color:#cfe0d6;font-size:15px;cursor:pointer;line-height:1;transition:.15s}
#fwInv2 .fw2-close:hover{background:rgba(255,90,77,.18);border-color:#ff7a6e;color:#ffd4cf}
#fwInv2 .fw2-body{flex:1;display:flex;gap:0;min-height:0}
.fw2-col{flex:1;min-width:0;display:flex;flex-direction:column;padding:14px 14px 16px;min-height:0}
.fw2-col + .fw2-col{border-left:1px solid rgba(120,140,128,.18)}
.fw2-eqcol{flex:1.15}
.fw2-coltitle{font-size:13px;font-weight:800;letter-spacing:2px;color:#9fb0a6;margin-bottom:10px;text-transform:uppercase}
.fw2-coltitle .fw2-tag{font-size:9px;font-weight:700;letter-spacing:1px;color:rgba(159,176,166,.6);margin-left:6px;
  border:1px solid rgba(159,176,166,.3);border-radius:20px;padding:1px 7px}
.fw2-collabels{display:flex;justify-content:space-between;font-size:9.5px;letter-spacing:1px;color:rgba(159,176,166,.5);
  padding:0 8px 6px;border-bottom:1px solid rgba(120,140,128,.14);margin-bottom:6px;text-transform:uppercase}
.fw2-list{flex:1;overflow-y:auto;display:flex;flex-direction:column;gap:4px;padding-right:3px}
.fw2-list::-webkit-scrollbar{width:7px}
.fw2-list::-webkit-scrollbar-thumb{background:rgba(120,140,128,.3);border-radius:4px}
.fw2-row{display:flex;align-items:center;gap:10px;padding:8px 10px;border-radius:7px;cursor:grab;
  background:rgba(255,255,255,.025);border:1px solid rgba(120,140,128,.18);transition:background .12s,border-color .12s,transform .12s}
.fw2-row:hover{background:rgba(95,240,156,.08);border-color:rgba(95,240,156,.4)}
.fw2-row.dragging{opacity:.35}
.fw2-row .ic{font-size:20px;width:24px;text-align:center;flex:0 0 auto}
.fw2-row .nm{font-size:12.5px;font-weight:600;flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.fw2-row .qt{font-family:'JetBrains Mono',monospace;font-size:11px;color:rgba(230,239,233,.6);flex:0 0 auto}
.fw2-empty{font-size:11.5px;color:rgba(230,239,233,.35);text-align:center;padding:18px 4px;font-style:italic}
.fw2-col.dropglow{background:rgba(95,240,156,.06);border-radius:8px}
/* EQUIPPED column */
.fw2-figwrap{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:flex-start;gap:8px;min-height:0;position:relative}
.fw2-fig{width:120px;height:auto;max-height:46%;opacity:.85;flex:0 1 auto}
.fw2-fighost{flex:1 1 auto;width:100%;min-height:130px;display:flex;align-items:center;justify-content:center;position:relative}
.fw2-figcanvas{width:100%;height:100%;display:block}
.fw2-slot{width:88%;max-width:320px;min-height:46px;flex:0 0 auto;border-radius:9px;padding:7px 12px;cursor:pointer;
  border:1.5px dashed rgba(160,175,165,.35);background:rgba(255,255,255,.03);
  display:flex;flex-direction:column;justify-content:center;gap:2px;transition:border-color .12s,background .12s}
.fw2-slot:hover{border-color:rgba(95,240,156,.5);background:rgba(95,240,156,.05)}
.fw2-slot.filled{border-style:solid;border-color:rgba(255,206,74,.55);background:rgba(255,206,74,.06);cursor:grab}
.fw2-slot.dropglow{border-color:#5ff09c !important;background:rgba(95,240,156,.14) !important}
.fw2-slotlb{font-size:9px;font-weight:800;letter-spacing:1.5px;color:rgba(159,176,166,.6)}
.fw2-slotitem{display:flex;align-items:center;gap:9px}
.fw2-slotitem .ic{font-size:22px}
.fw2-slotitem .nm{font-size:13px;font-weight:700;color:#fff1c2}
.fw2-slotempty{font-size:24px;opacity:.3;line-height:1}
.fw2-slothint{font-size:9.5px;color:rgba(230,239,233,.4)}
.fw2-eqhint{font-size:9.5px;color:rgba(230,239,233,.35);text-align:center;line-height:1.5;margin-top:8px;padding:0 8px}
/* floating drag ghost */
#fw2Ghost{position:fixed;z-index:99999;pointer-events:none;transform:translate(-50%,-120%);
  background:rgba(8,16,11,.96);border:2px solid #5ff09c;border-radius:10px;padding:7px 12px;
  display:flex;align-items:center;gap:9px;font-size:13px;font-weight:800;color:#e6ffee;
  box-shadow:0 16px 34px rgba(0,0,0,.6)}
#fw2Ghost .ic{font-size:18px}
/* right-click options menu */
#fw2Menu{position:fixed;z-index:100000;display:none;min-width:182px;
  background:linear-gradient(165deg,rgba(14,24,17,.99),rgba(7,12,9,.99));
  border:1.5px solid rgba(95,240,156,.5);border-radius:11px;padding:7px;
  font-family:'Outfit','Inter',sans-serif;color:#e6ffee;box-shadow:0 18px 44px rgba(0,0,0,.75)}
#fw2Menu .ttl{display:flex;align-items:center;gap:8px;font-size:12px;font-weight:800;color:#fff1c2;
  padding:4px 8px 8px;border-bottom:1px solid rgba(95,240,156,.18);margin-bottom:6px}
#fw2Menu .ttl .i{font-size:17px}
#fw2Menu button{display:flex;align-items:center;gap:8px;width:100%;text-align:left;
  background:rgba(95,240,156,.07);border:1px solid rgba(95,240,156,.22);color:#e6ffee;border-radius:8px;
  padding:8px 11px;margin-bottom:4px;cursor:pointer;font-family:'Outfit',sans-serif;font-weight:700;font-size:12px;transition:.12s}
#fw2Menu button:hover{background:rgba(95,240,156,.2);border-color:#5ff09c;transform:translateX(2px)}
#fw2Menu button.warn{background:rgba(255,90,77,.08);border-color:rgba(255,122,110,.35);color:#ffb4ab}
#fw2Menu button.warn:hover{background:rgba(255,90,77,.18);border-color:#ff7a6e}
#fw2Menu button:last-child{margin-bottom:0}
`;
    document.head.appendChild(css);

    // ──────────────────────────────────────────────────────────────
    // UI BUILD
    // ──────────────────────────────────────────────────────────────
    const VICINITY_R = 6;
    function nearbyDrops(){
      const out = [];
      for(const d of Dropped){
        if(Math.hypot(Player.pos.x - d.x, Player.pos.z - d.z) <= VICINITY_R) out.push(d);
      }
      return out;
    }
    // The bag, minus whatever is currently equipped (so equipped items
    // visually "move" into the EQUIPPED slots, PUBG-style).
    function bagItems(){
      const out = [];
      const aw = activeWeapon();
      for(const id of Object.keys(State.inventory || {})){
        let qty = State.inventory[id] || 0;
        if(qty <= 0) continue;
        if(id === aw) qty -= 1;
        if(id === 'cap' && EQ.hat === 'cap') qty -= 1;
        if(qty <= 0) continue;
        out.push({ id, qty });
      }
      return out;
    }

    const FIG_SVG = '<svg class="fw2-fig" viewBox="0 0 120 250" xmlns="http://www.w3.org/2000/svg">'
      + '<g fill="rgba(150,165,156,.22)" stroke="rgba(170,185,176,.45)" stroke-width="2">'
      + '<circle cx="60" cy="32" r="21"/>'
      + '<rect x="37" y="56" width="46" height="88" rx="20"/>'
      + '<rect x="18" y="62" width="16" height="72" rx="8"/>'
      + '<rect x="86" y="62" width="16" height="72" rx="8"/>'
      + '<rect x="41" y="140" width="17" height="92" rx="8"/>'
      + '<rect x="62" y="140" width="17" height="92" rx="8"/>'
      + '</g></svg>';

    let root = null;
    function isOpen(){ return document.getElementById('invBg')?.classList.contains('show'); }

    function ensureUI(){
      if(root && document.body.contains(root)) return true;
      const invBg = document.getElementById('invBg');
      if(!invBg) return false;
      // Hide the legacy card; we render our own panel into the same overlay
      const oldCard = invBg.querySelector('.inv-card');
      if(oldCard) oldCard.style.display = 'none';
      root = document.createElement('div');
      root.id = 'fwInv2';
      root.innerHTML =
        '<div class="fw2-head">'
        +   '<div class="fw2-title">INVENTORY</div>'
        +   '<div class="fw2-sub" id="fw2Count"></div>'
        +   '<button class="fw2-close" id="fw2Close" title="Close (I / Esc)">✕</button>'
        + '</div>'
        + '<div class="fw2-body">'
        +   '<div class="fw2-col" data-zone="vicinity">'
        +     '<div class="fw2-coltitle">Vicinity <span class="fw2-tag">ground</span></div>'
        +     '<div class="fw2-list" id="fw2VicList"></div>'
        +   '</div>'
        +   '<div class="fw2-col" data-zone="inventory">'
        +     '<div class="fw2-coltitle">Inventory</div>'
        +     '<div class="fw2-collabels"><span>Type</span><span>Qty</span></div>'
        +     '<div class="fw2-list" id="fw2BagList"></div>'
        +   '</div>'
        +   '<div class="fw2-col fw2-eqcol">'
        +     '<div class="fw2-coltitle">Equipped</div>'
        +     '<div class="fw2-figwrap">'
        +       '<div class="fw2-fighost" id="fw2FigHost"></div>'
        +       '<div class="fw2-slot" id="fw2Edible" data-zone="edible"></div>'
        +       '<div class="fw2-slot" id="fw2Hat" data-zone="hat"></div>'
        +       '<div class="fw2-slot" id="fw2Weap" data-zone="weapon"></div>'
        +     '</div>'
        +     '<div class="fw2-eqhint">Drag a weapon or hat here to equip · drag it back to your bag to remove · drag to Vicinity to drop</div>'
        +   '</div>'
        + '</div>';
      invBg.appendChild(root);
      root.querySelector('#fw2Close').addEventListener('click', () => invBg.classList.remove('show'));
      return true;
    }

    function renderBag(){
      const list = root.querySelector('#fw2BagList');
      const b = bagItems();
      const cnt = root.querySelector('#fw2Count');
      if(cnt) cnt.textContent = b.length ? (b.length + ' item type' + (b.length === 1 ? '' : 's')) : '';
      if(!b.length){ list.innerHTML = '<div class="fw2-empty">Your bag is empty.</div>'; return; }
      list.innerHTML = b.map(({ id, qty }) => {
        const m = itemMeta(id);
        return '<div class="fw2-row" data-src="inv" data-id="' + esc(id) + '">'
          + '<span class="ic" style="color:' + esc(m.color) + '">' + m.icon + '</span>'
          + '<span class="nm">' + esc(m.name) + '</span>'
          + '<span class="qt">×' + qty + '</span></div>';
      }).join('');
    }

    function renderVic(){
      const list = root.querySelector('#fw2VicList');
      const near = nearbyDrops();
      if(!near.length){ list.innerHTML = '<div class="fw2-empty">Nothing on the ground nearby…</div>'; return; }
      list.innerHTML = '';
      near.forEach(d => {
        const m = itemMeta(d.id);
        const row = document.createElement('div');
        row.className = 'fw2-row';
        row.dataset.src = 'vic';
        row._drop = d;
        row.innerHTML = '<span class="ic" style="color:' + esc(m.color) + '">' + m.icon + '</span>'
          + '<span class="nm">' + esc(m.name) + '</span>'
          + '<span class="qt">×' + (d.qty || 1) + '</span>';
        list.appendChild(row);
      });
    }

    function renderEq(){
      const aw = activeWeapon();
      const hasCap = (State.inventory?.cap || 0) > 0, hatOn = EQ.hat === 'cap' && hasCap;
      const w = root.querySelector('#fw2Weap'), h = root.querySelector('#fw2Hat');
      w.classList.toggle('filled', !!aw);
      w.dataset.filled = aw ? '1' : '';
      w.dataset.wid = aw || '';
      const wm = aw ? itemMeta(aw) : null;
      w.innerHTML = aw
        ? '<div class="fw2-slotlb">WEAPON</div><div class="fw2-slotitem"><span class="ic">' + wm.icon + '</span><span class="nm">' + wm.name + '</span></div><div class="fw2-slothint">drag to bag to holster</div>'
        : '<div class="fw2-slotlb">WEAPON</div><div class="fw2-slotempty">🔫</div><div class="fw2-slothint">' + (ownsAnyWeapon() ? 'drag a gun here to equip' : 'buy one at the Gunsmith') + '</div>';
      h.classList.toggle('filled', hatOn);
      h.dataset.filled = hatOn ? '1' : '';
      h.innerHTML = hatOn
        ? '<div class="fw2-slotlb">HAT</div><div class="fw2-slotitem"><span class="ic">🧢</span><span class="nm">Trucker Cap</span></div><div class="fw2-slothint">drag to bag to take off</div>'
        : '<div class="fw2-slotlb">HAT</div><div class="fw2-slotempty">🧢</div><div class="fw2-slothint">' + (hasCap ? 'drag a hat here to wear' : 'Carlos sells Trucker Caps') + '</div>';
      // EDIBLE box — a single-item slot (like HAT/WEAPON). Drag ONE food in,
      // drag it back out, or click/press H to eat from it.
      // The slot holds exactly ONE unit, moved OUT of the bag — so we don't
      // validate against inventory count (that single unit lives in the slot).
      const ed = root.querySelector('#fw2Edible');
      if(ed){
        const E = window.fwHungerEnergy || {};
        let sid = State.edibleSlot;
        if(sid && !E[sid]) sid = State.edibleSlot = null;
        ed.classList.toggle('filled', !!sid);
        ed.dataset.filled = sid ? '1' : '';
        ed.dataset.eid = sid || '';
        if(sid){
          const m = itemMeta(sid);
          ed.innerHTML = '<div class="fw2-slotlb">EDIBLE · press H to eat</div>'
            + '<div class="fw2-slotitem"><span class="ic">' + m.icon + '</span><span class="nm">' + esc(m.name) + '</span></div>'
            + '<div class="fw2-slothint">click to eat · drag to bag to remove</div>';
        } else {
          ed.innerHTML = '<div class="fw2-slotlb">EDIBLE · press H to eat</div><div class="fw2-slotempty">🍏</div>'
            + '<div class="fw2-slothint">drag one food here</div>';
        }
        ed.style.cursor = sid ? 'grab' : 'pointer';
        ed.onclick = () => { if(State.edibleSlot) consumeOne(); };
      }
    }
    function isEdible(id){ return !!((window.fwHungerEnergy || {})[id]); }
    function consumeOne(){
      const id = State.edibleSlot;
      if(!id){ window.floater?.('🍏 No food in the Edible slot — drag some in', 'bad'); return; }
      // The single held unit isn't in the bag, so eat its energy directly.
      if(typeof window.fwEatEnergy === 'function') window.fwEatEnergy(id);
      State.edibleSlot = null;
      try { window.saveState?.(); } catch(_){}
      refreshUI();
    }
    window.fwConsumeOne = consumeOne;
    // Move exactly ONE unit of `id` from the bag into the edible slot. Any item
    // already slotted is returned to the bag first (only one fits).
    function slotEdible(id){
      if(!isEdible(id)){ window.floater?.('Only food fits the EDIBLE slot', 'bad'); return; }
      if((State.inventory[id] || 0) < 1){ window.floater?.('None left to slot', 'bad'); return; }
      if(State.edibleSlot) window.addItem?.(State.edibleSlot, 1);
      window.takeItem?.(id, 1);
      State.edibleSlot = id;
    }

    function refreshUI(){
      if(!ensureUI()) return;
      try { renderBag(); renderVic(); renderEq(); } catch(err){ console.error('[dropitem] refreshUI', err); }
    }
    // Legacy alias — older code paths called this name
    window.renderVicinity = refreshUI;

    // ── Live printer preview in the Equipped column ──
    // Renders a clone of the player's actual printer model
    // (window.printer) — including whatever it's wearing (the cap is a
    // child of the printer) — into a tiny WebGL canvas. It does NOT spin
    // on its own — drag it to turn it, and it stays where you leave it.
    // A single self-sustaining rAF loop renders it continuously while the
    // inventory is open, so it can't flicker in and out.
    const _pv = { renderer: null, scene: null, cam: null, model: null, canvas: null,
                  sig: '', ref: null, w: 0, h: 0,
                  yaw: -0.5, pitch: 0.05, dist: 4, height: 0, drag: null };
    function previewSig(){ return (EQ.gun ? '1' : '0') + (EQ.hat === 'cap' ? '1' : '0'); }
    function ensurePreviewRenderer(){
      if(_pv.renderer || !root) return;
      const host = root.querySelector('#fw2FigHost');
      if(!host) return;
      if(!window.printer){ if(!host.querySelector('.fw2-fig')) host.innerHTML = FIG_SVG; return; }
      host.innerHTML = '';
      const canvas = document.createElement('canvas');
      canvas.className = 'fw2-figcanvas';
      canvas.style.cursor = 'grab';
      host.appendChild(canvas);
      try {
        const r = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
        r.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
        r.setClearColor(0x000000, 0);
        const sc = new THREE.Scene();
        sc.add(new THREE.AmbientLight(0xffffff, 1.0));
        const d1 = new THREE.DirectionalLight(0xffffff, 0.9); d1.position.set(2, 4, 3); sc.add(d1);
        const d2 = new THREE.DirectionalLight(0x9fc0ff, 0.4); d2.position.set(-3, 2, -2); sc.add(d2);
        _pv.renderer = r; _pv.scene = sc; _pv.cam = new THREE.PerspectiveCamera(32, 1, 0.1, 200); _pv.canvas = canvas;
        // Drag the character to turn it (and it stays put — no auto-spin).
        canvas.addEventListener('mousedown', (e) => {
          e.preventDefault(); e.stopPropagation();
          _pv.drag = { x: e.clientX, y: e.clientY, yaw: _pv.yaw, pitch: _pv.pitch };
          canvas.style.cursor = 'grabbing';
        });
        window.addEventListener('mousemove', (e) => {
          if(!_pv.drag) return;
          _pv.yaw = _pv.drag.yaw + (e.clientX - _pv.drag.x) * 0.01;
          _pv.pitch = Math.max(-0.7, Math.min(0.7, _pv.drag.pitch + (e.clientY - _pv.drag.y) * 0.01));
        });
        window.addEventListener('mouseup', () => {
          if(_pv.drag){ _pv.drag = null; canvas.style.cursor = 'grab'; }
        });
      } catch(e){ console.error('[dropitem] preview renderer', e); host.innerHTML = FIG_SVG; }
    }
    function syncPreviewModel(){
      if(!_pv.scene || !window.printer) return;
      if(_pv.model){ _pv.scene.remove(_pv.model); _pv.model = null; }   // shared geo/mats — don't dispose
      try {
        const clone = window.printer.clone(true);
        clone.visible = true;   // live root may be hidden in FPS; show the clone (children keep their worn/unworn visibility)
        clone.scale.copy(window.printer.scale);
        const box = new THREE.Box3().setFromObject(clone);
        const size = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());
        clone.position.set(-center.x, -center.y, -center.z);   // center at origin
        const wrap = new THREE.Group();
        wrap.add(clone);
        _pv.scene.add(wrap);
        _pv.model = wrap;
        const maxDim = Math.max(size.x, size.y, size.z) || 2;
        _pv.dist = maxDim * 2.6;   // zoomed out enough to show the whole body
        _pv.ref = window.printer;
      } catch(e){ console.error('[dropitem] preview clone', e); }
    }
    function previewLoop(){
      requestAnimationFrame(previewLoop);   // always reschedule — self-sustaining
      if(!isOpen()) return;                 // but only render while the inventory is open
      ensurePreviewRenderer();
      if(!_pv.renderer || !_pv.canvas) return;
      // (Re)build the clone when the printer first appears, the reference
      // changes, or what it's wearing changes — otherwise keep it.
      const sig = previewSig();
      if(window.printer && (!_pv.model || sig !== _pv.sig || _pv.ref !== window.printer)){
        _pv.sig = sig; syncPreviewModel();
      }
      if(!_pv.model) return;
      const w = Math.max(40, _pv.canvas.clientWidth || 220);
      const h = Math.max(40, _pv.canvas.clientHeight || 280);
      if(w !== _pv.w || h !== _pv.h){
        _pv.w = w; _pv.h = h;
        _pv.renderer.setSize(w, h, false);
        _pv.cam.aspect = w / h; _pv.cam.updateProjectionMatrix();
      }
      // Orbit the camera by the user-controlled yaw/pitch (no auto-spin), aimed
      // dead-centre on the model (centred at the origin) so the whole body shows.
      const cp = Math.cos(_pv.pitch);
      _pv.cam.position.set(
        Math.sin(_pv.yaw) * cp * _pv.dist,
        Math.sin(_pv.pitch) * _pv.dist,
        Math.cos(_pv.yaw) * cp * _pv.dist
      );
      _pv.cam.lookAt(0, 0, 0);
      _pv.renderer.render(_pv.scene, _pv.cam);
    }
    requestAnimationFrame(previewLoop);

    // ──────────────────────────────────────────────────────────────
    // DRAG ENGINE (mouse-based — no native HTML5 drag)
    // ──────────────────────────────────────────────────────────────
    let dragCand = null;        // pressed on a source, not yet dragging
    let dragState = null;       // active drag { src, id?, drop?, ghost }
    let suppressClickUntil = 0;

    function itemSourceAt(t){
      if(!t || !t.closest) return null;
      const inv = t.closest('.fw2-row[data-src="inv"]');
      if(inv){ const m = itemMeta(inv.dataset.id); return { src: 'inv', id: inv.dataset.id, el: inv, icon: m.icon, name: m.name }; }
      const vic = t.closest('.fw2-row[data-src="vic"]');
      if(vic && vic._drop){ const m = itemMeta(vic._drop.id); return { src: 'vic', drop: vic._drop, el: vic, icon: m.icon, name: m.name }; }
      const w = t.closest('#fw2Weap');
      if(w && w.dataset.filled === '1'){ const id = w.dataset.wid || 'deagle'; const m = itemMeta(id); return { src: 'weapon', id, el: w, icon: m.icon, name: m.name }; }
      const h = t.closest('#fw2Hat');
      if(h && h.dataset.filled === '1') return { src: 'hat', id: 'cap', el: h, icon: '🧢', name: 'Trucker Cap' };
      const ed = t.closest('#fw2Edible');
      if(ed && ed.dataset.filled === '1'){ const id = ed.dataset.eid; const m = itemMeta(id); return { src: 'edible', id, el: ed, icon: m.icon, name: m.name }; }
      return null;
    }
    function zoneAt(x, y){
      const el = document.elementFromPoint(x, y);
      const z = el && el.closest && el.closest('[data-zone]');
      return z ? { name: z.dataset.zone, el: z } : null;
    }
    function clearGlow(){
      if(!root) return;
      root.querySelectorAll('.dropglow').forEach(e => e.classList.remove('dropglow'));
    }
    function makeGhost(icon, name, x, y){
      const g = document.createElement('div');
      g.id = 'fw2Ghost';
      g.innerHTML = '<span class="ic">' + icon + '</span><span>' + esc(name) + '</span>';
      g.style.left = x + 'px'; g.style.top = y + 'px';
      document.body.appendChild(g);
      return g;
    }
    function cancelDrag(){
      dragCand = null;
      if(dragState){ try { dragState.ghost.remove(); } catch(_){} dragState = null; }
      clearGlow();
      if(root){ root.querySelectorAll('.fw2-row.dragging').forEach(e => e.classList.remove('dragging')); }
    }

    document.addEventListener('mousedown', (e) => {
      if(e.button !== 0 || !isOpen()) return;
      const s = itemSourceAt(e.target);
      if(!s) return;
      e.preventDefault();   // stop text-selection so the drag is clean
      dragCand = { ...s, x: e.clientX, y: e.clientY };
    });
    document.addEventListener('mousemove', (e) => {
      if(dragState){
        dragState.ghost.style.left = e.clientX + 'px';
        dragState.ghost.style.top  = e.clientY + 'px';
        clearGlow();
        const z = zoneAt(e.clientX, e.clientY);
        if(z) z.el.classList.add('dropglow');
        return;
      }
      if(!dragCand) return;
      if(Math.hypot(e.clientX - dragCand.x, e.clientY - dragCand.y) < 6) return;
      const c = dragCand; dragCand = null;
      dragState = { src: c.src, id: c.id, drop: c.drop, ghost: makeGhost(c.icon, c.name, e.clientX, e.clientY) };
      if(c.el && c.el.classList.contains('fw2-row')) c.el.classList.add('dragging');
    });
    document.addEventListener('mouseup', (e) => {
      dragCand = null;
      if(!dragState) return;
      const ds = dragState;
      try { ds.ghost.remove(); } catch(_){}
      dragState = null;
      clearGlow();
      if(root){ root.querySelectorAll('.fw2-row.dragging').forEach(el => el.classList.remove('dragging')); }
      suppressClickUntil = performance.now() + 280;   // swallow the trailing click
      const z = zoneAt(e.clientX, e.clientY);
      try { handleDrop(ds, z ? z.name : null); } catch(err){ console.error('[dropitem] drop', err); }
    });
    document.addEventListener('mouseleave', cancelDrag);
    window.addEventListener('blur', cancelDrag);

    // Swallow the click that fires right after a drag (prevents the
    // overlay backdrop from closing and stray menus from opening).
    document.addEventListener('click', (e) => {
      if(performance.now() < suppressClickUntil){ e.stopPropagation(); e.preventDefault(); }
    }, true);

    function dropToGround(id, qty){
      // A trampoline isn't a generic ground pickup — drop it as a real,
      // bounceable trampoline a few metres in front of you.
      if(id === 'trampoline' && typeof window.fwPlaceTrampolineAt === 'function'){
        const Pl = window.Player, yaw = (Pl && Pl.yaw) || 0;
        const fx = Math.sin(yaw + Math.PI), fz = Math.cos(yaw + Math.PI);
        window.fwPlaceTrampolineAt((Pl ? Pl.pos.x : 0) + fx * 2.4, (Pl ? Pl.pos.z : 0) + fz * 2.4);
        window.takeItem?.(id, 1);
        window.floater?.('🤸 Trampoline set down — jump on it!', 'good');
        return;
      }
      // A bike isn't a generic ground pickup — drop it as a real,
      // mountable bike (the same one you ride near Gary, press B).
      if(id === 'bike' && typeof window.fwParkBikeAt === 'function'){
        const yaw = Player.yaw || 0;
        const fx = Math.sin(yaw + Math.PI), fz = Math.cos(yaw + Math.PI);
        window.fwParkBikeAt(Player.pos.x + fx * 1.6, Player.pos.z + fz * 1.6, yaw);
        window.takeItem?.(id, 1);
        window.floater?.('🚲 Parked the bike — press B to ride', 'good');
        return;
      }
      dropItem(id, qty || 1);
      window.takeItem?.(id, qty || 1);
    }

    function handleDrop(ds, zone){
      const EDI = window.fwHungerEnergy || {};
      if(ds.src === 'inv'){
        if(zone === 'vicinity') dropToGround(ds.id, 1);
        else if(zone === 'weapon'){ if(equipKind(ds.id) === 'gun') equipWeapon(ds.id); else window.floater?.('Only a weapon fits the WEAPON slot', 'bad'); }
        else if(zone === 'hat'){ if(ds.id === 'cap') equipHat(true); else window.floater?.('Only headwear fits the HAT slot', 'bad'); }
        else if(zone === 'edible'){ slotEdible(ds.id); }
        // 'inventory' or null = no-op
      } else if(ds.src === 'vic'){
        if(zone === 'inventory') pickUp(ds.drop);
        else if(zone === 'weapon'){ if(equipKind(ds.drop.id) === 'gun'){ pickUp(ds.drop); equipWeapon(ds.drop.id); } else window.floater?.('Only a weapon fits the WEAPON slot', 'bad'); }
        else if(zone === 'hat'){ if(ds.drop.id === 'cap'){ pickUp(ds.drop); equipHat(true); } else window.floater?.('Only headwear fits the HAT slot', 'bad'); }
        else if(zone === 'edible'){ if(EDI[ds.drop.id]){ pickUp(ds.drop); slotEdible(ds.drop.id); } else window.floater?.('Only food fits the EDIBLE slot', 'bad'); }
        // 'vicinity' or null = leave it on the ground
      } else if(ds.src === 'weapon'){
        if(zone === 'inventory') holsterWeapon(ds.id);
        else if(zone === 'vicinity'){ holsterWeapon(ds.id); dropToGround(ds.id, 1); }
        // null / 'weapon' / 'hat' = cancel
      } else if(ds.src === 'hat'){
        if(zone === 'inventory') equipHat(false);
        else if(zone === 'vicinity'){ equipHat(false); dropToGround('cap', 1); }
      } else if(ds.src === 'edible'){
        // Slot holds one unit removed from the bag — return/drop that unit.
        if(zone === 'inventory'){ window.addItem?.(ds.id, 1); State.edibleSlot = null; }
        else if(zone === 'vicinity'){ window.addItem?.(ds.id, 1); dropToGround(ds.id, 1); State.edibleSlot = null; }
        // null / 'weapon' / 'hat' / 'edible' = cancel (keep it slotted)
      }
      window.updateHUD?.();
      window.saveState?.();
      refreshUI();
    }

    // ──────────────────────────────────────────────────────────────
    // RIGHT-CLICK OPTIONS MENU (RuneScape-style) + double-click
    // ──────────────────────────────────────────────────────────────
    const menu = document.createElement('div');
    menu.id = 'fw2Menu';
    document.body.appendChild(menu);
    function closeMenu(){ menu.style.display = 'none'; }
    document.addEventListener('mousedown', (e) => {
      if(menu.style.display !== 'none' && !e.target.closest('#fw2Menu')) closeMenu();
    }, true);
    window.addEventListener('keydown', (e) => { if(e.code === 'Escape') closeMenu(); });
    // H — eat one edible from your bag (works anytime while playing).
    window.addEventListener('keydown', (e) => {
      if(e.code !== 'KeyH') return;
      const a = document.activeElement;
      if(a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA')) return;
      consumeOne();
    });

    function openMenu(x, y, icon, name, actions){
      menu.innerHTML = '<div class="ttl"><span class="i">' + icon + '</span><span>' + esc(name) + '</span></div>'
        + actions.map((a, i) => '<button data-i="' + i + '" class="' + (a.warn ? 'warn' : '') + '">' + a.label + '</button>').join('');
      menu.style.display = 'block';
      const mw = menu.offsetWidth, mh = menu.offsetHeight;
      menu.style.left = Math.min(x + 6, innerWidth - mw - 10) + 'px';
      menu.style.top  = Math.min(y + 6, innerHeight - mh - 10) + 'px';
      menu.querySelectorAll('button').forEach(btn => {
        btn.addEventListener('click', (ev) => {
          ev.stopPropagation();
          closeMenu();
          try { actions[Number(btn.dataset.i)].run(); } catch(err){ console.error('[dropitem] action', err); }
        });
      });
    }
    function examine(id){
      const it = ITEMS[id] || {}, m = itemMeta(id);
      const d = it.desc || it.description
        || (it.marketPrice ? (m.name + ' — worth about ' + it.marketPrice + ' credits.') : ('A ' + m.name + '.'));
      window.floater?.(d, 'good');
    }
    function afterAction(){ window.updateHUD?.(); window.saveState?.(); refreshUI(); }
    function openMenuFor(s, x, y){
      const m = s.src === 'vic' ? itemMeta(s.drop.id) : itemMeta(s.id);
      const actions = [];
      if(s.src === 'inv'){
        const k = equipKind(s.id);
        if(k === 'gun') actions.push({ label: '🔫 Equip weapon', run: () => equipWeapon(s.id) });
        if(k === 'hat') actions.push({ label: '🧢 Wear it', run: () => equipHat(true) });
        actions.push({ label: '📦 Drop to vicinity', warn: true, run: () => { dropToGround(s.id, 1); afterAction(); } });
        actions.push({ label: '🔍 Examine', run: () => examine(s.id) });
      } else if(s.src === 'vic'){
        actions.push({ label: '🎒 Pick up', run: () => pickUp(s.drop) });
        const k = equipKind(s.drop.id);
        if(k === 'gun') actions.push({ label: '🔫 Pick up & equip', run: () => { pickUp(s.drop); equipWeapon(s.drop.id); } });
        if(k === 'hat') actions.push({ label: '🧢 Pick up & wear', run: () => { pickUp(s.drop); equipHat(true); } });
        actions.push({ label: '🔍 Examine', run: () => examine(s.drop.id) });
      } else if(s.src === 'weapon'){
        actions.push({ label: '🎒 Holster (to bag)', run: () => holsterWeapon(s.id) });
        actions.push({ label: '📦 Drop to vicinity', warn: true, run: () => { holsterWeapon(s.id); dropToGround(s.id, 1); afterAction(); } });
      } else if(s.src === 'hat'){
        actions.push({ label: '🎒 Unequip (to bag)', run: () => equipHat(false) });
        actions.push({ label: '📦 Drop to vicinity', warn: true, run: () => { equipHat(false); dropToGround('cap', 1); afterAction(); } });
      }
      actions.push({ label: '✖ Cancel', run: closeMenu });
      openMenu(x, y, m.icon, m.name, actions);
    }

    document.addEventListener('contextmenu', (e) => {
      if(!isOpen()) return;
      if(!e.target.closest || !e.target.closest('#fwInv2')) return;
      e.preventDefault();   // no browser menu inside our panel
      e.stopPropagation();
      const s = itemSourceAt(e.target);
      if(s) openMenuFor(s, e.clientX, e.clientY);
    });
    document.addEventListener('dblclick', (e) => {
      if(!isOpen()) return;
      const s = itemSourceAt(e.target);
      if(!s) return;
      if(s.src === 'vic') pickUp(s.drop);
      else if(s.src === 'inv'){ const k = equipKind(s.id); if(k === 'gun') equipWeapon(s.id); else if(k === 'hat') equipHat(true); }
      else if(s.src === 'weapon') holsterWeapon(s.id);
      else if(s.src === 'hat') equipHat(false);
    });

    // ──────────────────────────────────────────────────────────────
    // OPEN / REFRESH HOOKS — react to the game showing/hiding #invBg
    // ──────────────────────────────────────────────────────────────
    const invBg = document.getElementById('invBg');
    if(invBg){
      const mo = new MutationObserver(() => {
        if(isOpen()){
          ensureUI();
          try { document.exitPointerLock?.(); } catch(_){}
          refreshUI();
        } else {
          cancelDrag();
          closeMenu();
        }
      });
      mo.observe(invBg, { attributes: true, attributeFilter: ['class'] });
      if(isOpen()){ ensureUI(); refreshUI(); }
    }
    // keep the panel fresh while open (vicinity changes as you move, etc.)
    setInterval(() => {
      if(isOpen() && !dragState && !dragCand) refreshUI();
    }, 500);

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

    console.log('[dropitem] ★ v13 PUBG-style inventory ready (single mouse-drag engine: vicinity ⇄ bag ⇄ equipped)');
  }
})();
