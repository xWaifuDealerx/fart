// =================================================================
// dropitem.js — drag items out of the inventory, drop them on the
// ground, see them in 3D, walk near to get a "Press G to pick up" pop.
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

    // ── Build a tiny 3D mesh that represents a dropped item ──
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
      // Bobbing animation via userData
      grp.userData = { item, bobT: Math.random() * Math.PI * 2, body };
      return grp;
    }

    const Dropped = [];     // { mesh, x, z, y, id, qty }

    // Spawn a ground item at an exact world position (spider meat
    // drops, vicinity drops, etc.)
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
      // Compute spawn position 1.5m in front of the player
      const yaw = Player.yaw || 0;
      const fx = Math.sin(yaw + Math.PI);
      const fz = Math.cos(yaw + Math.PI);
      dropAt(id, qty, Player.pos.x + fx * 1.6, Player.pos.z + fz * 1.6);
      window.floater?.('Dropped ' + qty + ' ' + (item.name || id), 'good');
    }

    // Pick a ground item up into the inventory
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

    // ── Hook drag events on inventory slots ──
    // The inventory grid is #invGrid; each slot is .inv-slot[data-id].
    // Use HTML5 drag/drop. dragend with no valid drop target → drop on ground.
    let dragging = null;
    function wireInventory(){
      const grid = document.getElementById('invGrid');
      if(!grid){ setTimeout(wireInventory, 600); return; }
      if(grid._dropWired) return;
      grid._dropWired = true;
      // Make existing + future slots draggable
      function makeDraggable(){
        grid.querySelectorAll('.inv-slot[data-id]').forEach(el => {
          if(el._dragWired) return;
          el._dragWired = true;
          el.setAttribute('draggable', 'true');
          el.style.cursor = 'grab';
          el.addEventListener('dragstart', (e) => {
            dragging = el.dataset.id;
            e.dataTransfer.setData('text/plain', dragging);
            e.dataTransfer.effectAllowed = 'move';
            el.style.opacity = '0.5';
          });
          el.addEventListener('dragend', (e) => {
            el.style.opacity = '';
            // Dropping onto the VICINITY panel OR outside the inventory
            // entirely = put the item on the ground.
            const t = document.elementFromPoint(e.clientX, e.clientY);
            const onVicinity = t && t.closest('#fwVicinity');
            const insideInventory = t && (t.closest('#invGrid') || t.closest('.inv-card') || t.closest('#invBg'));
            if((onVicinity || !insideInventory) && dragging){
              dropItem(dragging, 1);
              // Remove from inventory
              if(typeof window.takeItem === 'function') window.takeItem(dragging, 1);
              if(typeof window.updateHUD === 'function') window.updateHUD();
              if(typeof window.renderInventory === 'function') window.renderInventory();
              renderVicinity();
            }
            dragging = null;
          });
        });
      }
      makeDraggable();
      // Re-wire after inventory re-renders
      if(typeof window.renderInventory === 'function' && !window._dropRenderWrapped){
        window._dropRenderWrapped = true;
        const orig = window.renderInventory;
        window.renderInventory = function(){
          const r = orig.apply(this, arguments);
          makeDraggable();
          return r;
        };
      }
      // Prevent default dragover on body so drop fires
      document.body.addEventListener('dragover', (e) => { e.preventDefault(); });
    }
    wireInventory();

    // ──────────────────────────────────────────────────────────────
    // VICINITY (PUBG-style) — a panel docked LEFT of the inventory
    // listing ground items within 6m. Drag a row into the inventory
    // to pick it up (or double-click); drag inventory slots onto the
    // panel to drop them on the ground.
    // ──────────────────────────────────────────────────────────────
    const VICINITY_R = 6;
    const vicCss = document.createElement('style');
    vicCss.textContent = `
#fwVicinity{position:absolute;right:100%;top:0;margin-right:14px;width:215px;max-height:100%;
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
  transition:border-color .15s ease,transform .15s ease;user-select:none}
.fw-vic-row:hover{border-color:#6ed0d6;transform:translateX(2px)}
.fw-vic-row .ic{font-size:18px}
.fw-vic-row .nm{font-size:11.5px;font-weight:700;flex:1;letter-spacing:.2px}
.fw-vic-row .q{font-family:'JetBrains Mono',monospace;font-size:10px;color:rgba(230,255,238,.6)}
.fw-vic-empty{font-size:11px;color:rgba(230,255,238,.4);text-align:center;padding:14px 4px;font-style:italic}
`;
    document.head.appendChild(vicCss);

    let vicPanel = null, vicDragging = null;
    function ensureVicinity(){
      if(vicPanel) return true;
      const card = document.querySelector('#invBg .inv-card');
      if(!card) return false;
      if(getComputedStyle(card).position === 'static') card.style.position = 'relative';
      vicPanel = document.createElement('div');
      vicPanel.id = 'fwVicinity';
      vicPanel.innerHTML = '<h3>📦 VICINITY</h3>'
        + '<div class="hint">Items on the ground near you. Drag into your bag to pick up — drag bag items HERE to drop them.</div>'
        + '<div id="fwVicList"></div>';
      card.appendChild(vicPanel);
      // allow inventory-slot drops to land on us
      vicPanel.addEventListener('dragover', (e) => e.preventDefault());
      return true;
    }
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
        row.setAttribute('draggable', 'true');
        row.innerHTML = '<span class="ic">' + (it.icon || '🎁') + '</span>'
          + '<span class="nm">' + (it.name || d.id) + '</span>'
          + '<span class="q">×' + (d.qty || 1) + '</span>';
        row.addEventListener('dblclick', () => { pickUp(d); window.renderInventory?.(); });
        row.addEventListener('dragstart', (e) => {
          vicDragging = d;
          e.dataTransfer.setData('text/plain', d.id);
          e.dataTransfer.effectAllowed = 'move';
          row.style.opacity = '0.5';
        });
        row.addEventListener('dragend', (e) => {
          row.style.opacity = '';
          const t = document.elementFromPoint(e.clientX, e.clientY);
          // dropped onto the inventory (grid or card, but NOT back on
          // the vicinity panel) → pick it up
          if(vicDragging && t && !t.closest('#fwVicinity') &&
             (t.closest('#invGrid') || t.closest('.inv-card'))){
            pickUp(vicDragging);
            window.renderInventory?.();
          }
          vicDragging = null;
        });
        list.appendChild(row);
      });
    }
    // keep the list fresh while the inventory is open (pause mid-drag)
    setInterval(() => {
      const bgOpen = document.getElementById('invBg')?.classList.contains('show');
      if(!bgOpen || dragging || vicDragging) return;
      renderVicinity();
    }, 700);

    // ── Proximity popup ──
    const css = document.createElement('style');
    css.textContent = `
.drop-pop{position:fixed;left:50%;bottom:200px;transform:translateX(-50%);display:none;background:linear-gradient(180deg,rgba(8,18,11,.96),rgba(5,14,9,.96));border:2px solid rgba(95,240,156,.55);border-radius:14px;padding:10px 18px;z-index:55;text-align:center;color:#fff1c2;font-family:'Outfit','Inter',sans-serif;box-shadow:0 14px 26px rgba(0,0,0,.55)}
.drop-pop.show{display:block}
.drop-pop .ic{font-size:22px;margin-bottom:3px;display:block}
.drop-pop .nm{font-family:'Outfit','Inter',sans-serif;font-size:14px;font-weight:700;color:#fff1c2;letter-spacing:.3px;margin-bottom:3px}
.drop-pop .hint{font-size:11px;color:rgba(230,255,238,.7)}
.drop-pop kbd{background:rgba(95,240,156,.22);border:1px solid rgba(95,240,156,.55);color:#5ff09c;padding:2px 8px;border-radius:6px;font-family:monospace;font-size:11px;font-weight:700}
`;
    document.head.appendChild(css);
    const pop = document.createElement('div');
    pop.className = 'drop-pop';
    pop.innerHTML = '<span class="ic" id="dropIc">\u{1F381}</span><div class="nm" id="dropNm">Item</div><div class="hint">Press <kbd>G</kbd> to pick up</div>';
    document.body.appendChild(pop);

    // ── Per-frame: bob the dropped items + check proximity ──
    let nearest = null;
    function tick(t){
      let closest = null, closestD = 2.4;
      for(const d of Dropped){
        // Bob
        d.mesh.userData.bobT += 0.04;
        d.mesh.userData.body.position.y = 0.42 + Math.sin(d.mesh.userData.bobT) * 0.07;
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

    // ── G key to pick up the nearest dropped item ──
    window.addEventListener('keydown', (e) => {
      if(e.code !== 'KeyG' || !nearest) return;
      const a = document.activeElement;
      if(a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA')) return;
      const it = ITEMS[nearest.id];
      if(it){
        window.addItem?.(nearest.id, nearest.qty || 1);
        window.floater?.('+' + (nearest.qty || 1) + ' ' + (it.name || nearest.id), 'good');
      }
      scene.remove(nearest.mesh);
      const idx = Dropped.indexOf(nearest);
      if(idx >= 0) Dropped.splice(idx, 1);
      nearest = null;
      pop.classList.remove('show');
      window.saveState?.();
      window.updateHUD?.();
    });

    // Also handle touch tap on the popup (mobile) as pickup
    pop.addEventListener('click', () => {
      if(!nearest) return;
      const it = ITEMS[nearest.id];
      if(it){
        window.addItem?.(nearest.id, nearest.qty || 1);
        window.floater?.('+' + (nearest.qty || 1) + ' ' + (it.name || nearest.id), 'good');
      }
      scene.remove(nearest.mesh);
      const idx = Dropped.indexOf(nearest);
      if(idx >= 0) Dropped.splice(idx, 1);
      nearest = null;
      pop.classList.remove('show');
    });

    console.log('[dropitem] drag items out of inventory; press G to pick up dropped items');
  }
})();
