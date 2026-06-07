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

    function dropItem(id, qty){
      const item = ITEMS[id];
      if(!item) return;
      qty = qty || 1;
      // Compute spawn position 1.5m in front of the player
      const yaw = Player.yaw || 0;
      const fx = Math.sin(yaw + Math.PI);
      const fz = Math.cos(yaw + Math.PI);
      const dx = Player.pos.x + fx * 1.6;
      const dz = Player.pos.z + fz * 1.6;
      const y = (groundHeightAt ? groundHeightAt(dx, dz) : 0) + 0.05;
      const mesh = buildDroppedMesh(item);
      mesh.position.set(dx, y, dz);
      scene.add(mesh);
      Dropped.push({ mesh, x: dx, z: dz, y, id, qty });
      window.floater?.('Dropped ' + qty + ' ' + (item.name || id), 'good');
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
            // If the drop target is outside the inventory grid AND outside
            // any other modal, treat it as "drop on the ground".
            const t = document.elementFromPoint(e.clientX, e.clientY);
            const insideInventory = t && (t.closest('#invGrid') || t.closest('.inv-card') || t.closest('#invBg'));
            if(!insideInventory && dragging){
              dropItem(dragging, 1);
              // Remove from inventory
              if(typeof window.takeItem === 'function') window.takeItem(dragging, 1);
              if(typeof window.updateHUD === 'function') window.updateHUD();
              if(typeof window.renderInventory === 'function') window.renderInventory();
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
