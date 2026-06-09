// =================================================================
// equip.js — equip tools from inventory, hold them in hand, play tool
// sounds when in use. Self-contained side file.
// =================================================================
(function(){
  'use strict';
  function whenReady(){
    if(!window.State || !window.Player || !window.THREE || !window.scene || !window.ITEMS || !window.printer){
      setTimeout(whenReady, 300); return;
    }
    init();
  }
  whenReady();

  function init(){
    const State = window.State;
    const Player = window.Player;
    const THREE = window.THREE;
    const scene = window.scene;

    // ── Tools the system supports ──
    const TOOLS = {
      saw:     { name: 'Saw',     icon: '\u{1FA9A}', color: '#cccccc', accent: '#7a4a25' },
      /* shovel removed — no longer in the game */
      pickaxe: { name: 'Pickaxe', icon: '\u{26CF}',  color: '#bbbbbb', accent: '#7a4a25' },
    };

    // Equipped tool stored on State for persistence
    if(!State.equipped) State.equipped = null;

    // ── Build tool model attached to player (shows in hand) ──
    function buildToolMesh(id){
      const grp = new THREE.Group();
      if(id === 'saw'){
        // Handle
        const handle = new THREE.Mesh(
          new THREE.BoxGeometry(0.06, 0.06, 0.30),
          new THREE.MeshStandardMaterial({ color: 0x7a4a25, roughness: 0.85 })
        );
        handle.position.z = 0.0;
        grp.add(handle);
        // Blade (long thin plate)
        const blade = new THREE.Mesh(
          new THREE.BoxGeometry(0.60, 0.012, 0.10),
          new THREE.MeshStandardMaterial({ color: 0xdddddd, roughness: 0.35, metalness: 0.7 })
        );
        blade.position.set(0.35, 0, 0.0);
        grp.add(blade);
        // Teeth (small triangles)
        for(let i = 0; i < 12; i++){
          const tooth = new THREE.Mesh(
            new THREE.ConeGeometry(0.02, 0.04, 4),
            new THREE.MeshStandardMaterial({ color: 0xeeeeee, roughness: 0.3, metalness: 0.8 })
          );
          tooth.position.set(0.10 + i * 0.045, -0.04, 0);
          tooth.rotation.x = Math.PI;
          grp.add(tooth);
        }
      } else if(id === 'shovel'){
        // Handle
        const handle = new THREE.Mesh(
          new THREE.CylinderGeometry(0.025, 0.025, 0.60, 8),
          new THREE.MeshStandardMaterial({ color: 0x5a3a18, roughness: 0.9 })
        );
        handle.position.y = 0.0;
        grp.add(handle);
        // Grip at top
        const grip = new THREE.Mesh(
          new THREE.TorusGeometry(0.06, 0.02, 8, 14),
          new THREE.MeshStandardMaterial({ color: 0x3a2a18, roughness: 0.85 })
        );
        grip.position.y = 0.30;
        grip.rotation.x = Math.PI / 2;
        grp.add(grip);
        // Blade — flat scoop
        const blade = new THREE.Mesh(
          new THREE.BoxGeometry(0.14, 0.18, 0.02),
          new THREE.MeshStandardMaterial({ color: 0xa8a8a8, roughness: 0.45, metalness: 0.6 })
        );
        blade.position.y = -0.40;
        grp.add(blade);
        // Pointed tip
        const tip = new THREE.Mesh(
          new THREE.ConeGeometry(0.08, 0.08, 4),
          new THREE.MeshStandardMaterial({ color: 0x999999, roughness: 0.45, metalness: 0.6 })
        );
        tip.position.y = -0.53;
        tip.rotation.x = Math.PI;
        grp.add(tip);
      } else if(id === 'pickaxe'){
        // Handle
        const handle = new THREE.Mesh(
          new THREE.CylinderGeometry(0.028, 0.028, 0.55, 8),
          new THREE.MeshStandardMaterial({ color: 0x7a4a25, roughness: 0.85 })
        );
        handle.position.y = 0;
        grp.add(handle);
        // Cross-head
        const head = new THREE.Mesh(
          new THREE.BoxGeometry(0.40, 0.06, 0.08),
          new THREE.MeshStandardMaterial({ color: 0x8a8a8a, roughness: 0.45, metalness: 0.7 })
        );
        head.position.y = 0.28;
        grp.add(head);
        // Pointed tips on both ends
        for(const sx of [-1, 1]){
          const tip = new THREE.Mesh(
            new THREE.ConeGeometry(0.04, 0.10, 4),
            new THREE.MeshStandardMaterial({ color: 0xaaaaaa, roughness: 0.3, metalness: 0.85 })
          );
          tip.position.set(sx * 0.24, 0.28, 0);
          tip.rotation.z = sx * Math.PI / 2;
          grp.add(tip);
        }
      } else {
        return null;
      }
      // Default tool position (right hand, slight tilt) used for saw + shovel.
      if(id === 'pickaxe'){
        // Pickaxe held with the printer's FINGERTIPS — the printer's
        // body has no visible arm, so the handle's grip end is shifted
        // OUTWARD (further from the body) and DOWN (level with the
        // printer's lower edge) so the wood butt of the handle reads
        // as if it's being clamped between fingertips at the body's
        // bottom-left corner. Long axis still points forward toward
        // the mineral so the head leads the swing.
        grp.position.set(-0.95, 0.85, 0.95);
        grp.rotation.set(-Math.PI / 2, 0, 0);
      } else {
        grp.position.set(0.55, 1.1, 0.4);
        grp.rotation.set(0.25, -0.5, -0.3);
      }
      return grp;
    }

    // Find the player's 3D mesh. The main module exposes window.printer
    // as the player's rendered printer group. Falls back to Player.mesh
    // for backward compatibility.
    function playerMesh(){ return window.printer || Player.mesh || null; }
    let attachedTool = null;
    function attachToolToPlayer(id){
      detachTool();
      if(!id) return;
      const mesh = buildToolMesh(id);
      const host = playerMesh();
      if(!mesh || !host) return;
      host.add(mesh);
      // Pickaxe stays hidden until the player is actually mining — no
      // permanent floating tool in the printer's hand otherwise.
      if(id === 'pickaxe') mesh.visible = false;
      attachedTool = { mesh, id, swing: 0 };
    }
    function detachTool(){
      if(!attachedTool) return;
      const host = playerMesh();
      try { if(host) host.remove(attachedTool.mesh); } catch(e){}
      attachedTool = null;
    }

    // ── Tool sound synthesizer ──
    function getAudio(){
      try { return window.ensureAudio?.() || null; } catch(e){ return null; }
    }
    function playSawSound(){
      const ctx = getAudio(); if(!ctx) return;
      const o1 = ctx.createOscillator();
      const o2 = ctx.createOscillator();
      const g = ctx.createGain();
      o1.type = 'sawtooth'; o2.type = 'sawtooth';
      // Sliding back-and-forth pitch for sawing
      const t = ctx.currentTime;
      o1.frequency.setValueAtTime(180, t);
      o1.frequency.linearRampToValueAtTime(280, t + 0.20);
      o1.frequency.linearRampToValueAtTime(180, t + 0.40);
      o2.frequency.setValueAtTime(220, t);
      o2.frequency.linearRampToValueAtTime(320, t + 0.20);
      o2.frequency.linearRampToValueAtTime(220, t + 0.40);
      g.gain.setValueAtTime(0.001, t);
      g.gain.linearRampToValueAtTime(0.12, t + 0.05);
      g.gain.linearRampToValueAtTime(0.08, t + 0.30);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.42);
      o1.connect(g); o2.connect(g); g.connect(ctx.destination);
      o1.start(t); o2.start(t);
      o1.stop(t + 0.45); o2.stop(t + 0.45);
    }
    function playShovelSound(){
      const ctx = getAudio(); if(!ctx) return;
      const t = ctx.currentTime;
      // Whoosh: noise-band synthesis with filter sweep
      const bufSize = ctx.sampleRate * 0.4;
      const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for(let i = 0; i < bufSize; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / bufSize);
      const noise = ctx.createBufferSource();
      noise.buffer = buf;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(2500, t);
      filter.frequency.exponentialRampToValueAtTime(400, t + 0.35);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.18, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.40);
      noise.connect(filter); filter.connect(g); g.connect(ctx.destination);
      noise.start(t); noise.stop(t + 0.42);
      // Thud at the end
      const o = ctx.createOscillator();
      const og = ctx.createGain();
      o.type = 'sine';
      o.frequency.setValueAtTime(80, t + 0.30);
      o.frequency.exponentialRampToValueAtTime(35, t + 0.45);
      og.gain.setValueAtTime(0.001, t + 0.30);
      og.gain.linearRampToValueAtTime(0.18, t + 0.31);
      og.gain.exponentialRampToValueAtTime(0.001, t + 0.45);
      o.connect(og); og.connect(ctx.destination);
      o.start(t + 0.30); o.stop(t + 0.47);
    }
    function playPickaxeSound(){
      const ctx = getAudio(); if(!ctx) return;
      const t = ctx.currentTime;
      // Sharp metallic clink: high-freq oscillator burst + short noise
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'square';
      o.frequency.setValueAtTime(1200, t);
      o.frequency.exponentialRampToValueAtTime(400, t + 0.12);
      g.gain.setValueAtTime(0.15, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
      o.connect(g); g.connect(ctx.destination);
      o.start(t); o.stop(t + 0.16);
      // Ringing tail
      const o2 = ctx.createOscillator();
      const g2 = ctx.createGain();
      o2.type = 'triangle';
      o2.frequency.setValueAtTime(2400, t + 0.02);
      g2.gain.setValueAtTime(0.06, t + 0.02);
      g2.gain.exponentialRampToValueAtTime(0.001, t + 0.30);
      o2.connect(g2); g2.connect(ctx.destination);
      o2.start(t + 0.02); o2.stop(t + 0.32);
    }
    function playToolSound(id){
      if(id === 'saw') playSawSound();
      else if(id === 'shovel') playShovelSound();
      else if(id === 'pickaxe') playPickaxeSound();
    }

    // ── Equipped HUD card ──
    const css = document.createElement('style');
    css.textContent = `
.eq-hud{position:fixed;bottom:14px;left:14px;display:none !important;align-items:center;gap:10px;background:rgba(8,18,11,.94);border:2px solid rgba(255,206,74,.6);border-radius:14px;padding:10px 14px;z-index:31;font-family:'Outfit','Inter',sans-serif;box-shadow:0 14px 28px rgba(0,0,0,.55)}
.eq-hud.show{display:none !important}
.eq-hud .ic{font-size:24px;line-height:1}
.eq-hud .lab{font-weight:700;color:#ffd64d;font-size:12px;letter-spacing:.8px;text-transform:uppercase}
.eq-hud .nm{color:#fff1c2;font-family:'Bangers','Orbitron',sans-serif;font-size:18px;letter-spacing:1px}
.eq-hud .un{background:transparent;border:1px solid rgba(230,255,238,.3);color:rgba(230,255,238,.7);font-size:10.5px;padding:4px 8px;border-radius:8px;cursor:pointer;letter-spacing:.4px;font-family:'JetBrains Mono',monospace;margin-left:6px}
.eq-hud .un:hover{background:rgba(255,90,90,.18);color:#fff}
@keyframes eqPop{from{transform:translateY(8px);opacity:0}to{transform:translateY(0);opacity:1}}
/* Inventory slot — show "EQUIPPED" badge */
.inv-slot.equipped{box-shadow:0 0 0 2px #ffd64d,0 8px 22px rgba(255,206,74,.4) !important}
.inv-slot.equipped::after{content:"EQUIPPED";position:absolute;top:2px;left:2px;background:#ffd64d;color:#2a1408;font-family:'Orbitron',monospace;font-size:9px;font-weight:900;padding:1px 5px;border-radius:4px;letter-spacing:.5px}
`;
    document.head.appendChild(css);
    const hud = document.createElement('div');
    hud.className = 'eq-hud';
    hud.innerHTML = '<div class="ic" id="eqIc">\u{1F9F0}</div><div><div class="lab">Equipped</div><div class="nm" id="eqNm">—</div></div><button class="un" id="eqUn">Unequip</button>';
    document.body.appendChild(hud);
    document.getElementById('eqUn').addEventListener('click', () => equip(null));

    function refreshHUD(){
      const id = State.equipped;
      if(id && TOOLS[id]){
        hud.classList.add('show');
        document.getElementById('eqIc').textContent = TOOLS[id].icon;
        document.getElementById('eqNm').textContent = TOOLS[id].name;
      } else {
        hud.classList.remove('show');
      }
      // Update inventory slot badge
      const grid = document.getElementById('invGrid');
      if(grid){
        grid.querySelectorAll('.inv-slot[data-id]').forEach(el => {
          el.classList.toggle('equipped', el.dataset.id === id);
        });
      }
    }
    function equip(id){
      if(id && !TOOLS[id]){
        window.floater?.("Can't equip that", "bad");
        return;
      }
      if(id && (State.inventory?.[id] || 0) <= 0){
        window.floater?.("You don't have one to equip", "bad");
        return;
      }
      const wasSame = State.equipped === id;
      State.equipped = wasSame ? null : id;
      attachToolToPlayer(State.equipped);
      window.saveState?.();
      refreshHUD();
      if(State.equipped){
        window.floater?.("Equipped " + TOOLS[State.equipped].name, "good");
        playToolSound(State.equipped);
      } else {
        window.floater?.("Unequipped", "good");
      }
    }
    window.equipTool = equip;

    // ── Hook into inventory clicks ──
    // The inventory render is dynamic. Use a delegated click handler on the
    // grid that fires on any tool-slot click.
    function wireInventory(){
      const grid = document.getElementById('invGrid');
      if(!grid){ setTimeout(wireInventory, 500); return; }
      if(grid._eqWired) return;
      grid._eqWired = true;
      grid.addEventListener('click', (e) => {
        const slot = e.target.closest('.inv-slot[data-id]');
        if(!slot) return;
        const id = slot.dataset.id;
        if(!TOOLS[id]) return;       // not a tool — let other handlers run
        equip(id);
      });
      refreshHUD();
    }
    wireInventory();
    // Re-apply badge on every inventory re-render
    if(typeof window.renderInventory === 'function' && !window._eqRenderWrapped){
      window._eqRenderWrapped = true;
      const orig = window.renderInventory;
      window.renderInventory = function(){
        const r = orig.apply(this, arguments);
        wireInventory();
        refreshHUD();
        return r;
      };
    }

    // Restore on load — re-attach the visible tool model
    setTimeout(() => {
      if(State.equipped && TOOLS[State.equipped]) attachToolToPlayer(State.equipped);
      refreshHUD();
    }, 400);

    // ── Tool swing animation + use detection ──
    // Each frame, if the player is walking + has a tool equipped, gently
    // bob it. Press F to "use" the equipped tool — plays the sound and
    // does a bigger swing.
    let last = performance.now();
    function tick(t){
      const dt = (t - last) / 1000; last = t;
      if(attachedTool){
        // Decay swing
        attachedTool.swing = Math.max(0, attachedTool.swing - dt * 3);
        const swing = attachedTool.swing * Math.sin(t / 60);
        const bob = Player.walking ? Math.sin(t / 110) * 0.08 : 0;
        if(attachedTool.id === 'pickaxe'){
          // Pickaxe is gripped at the printer's lower-left fingertip.
          // Swing arcs the long handle down toward the mineral, and a
          // small bob rides on the resting height (0.85, matching the
          // initial Y in buildToolMesh).
          attachedTool.mesh.rotation.x = -Math.PI / 2 + 0.4 + swing * 1.6;
          attachedTool.mesh.position.y = 0.85 + bob;
        } else {
          // Saw + other tools keep the original wrist-swing animation.
          attachedTool.mesh.rotation.z = -0.3 + swing;
          attachedTool.mesh.position.y = 1.1 + bob;
        }
      }
      requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);

    let lastUse = 0;
    window.addEventListener('keydown', (e) => {
      // ONLY fire on the dedicated "use tool" key (F). Earlier this
      // listener fired on every keydown, which meant walking with the
      // pickaxe equipped (after mining) re-triggered the metallic clink
      // on each WASD press. Strange, persistent sounds while moving!
      if(e.code !== 'KeyF') return;
      const a = document.activeElement;
      if(a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA')) return;
      if(!State.equipped || !attachedTool) return;
      const now = performance.now();
      if(now - lastUse < 350) return;
      lastUse = now;
      attachedTool.swing = 0.8;
      playToolSound(State.equipped);
    });

    window.equipSwing = function(amount){
      if(!attachedTool) return;
      attachedTool.swing = Math.max(attachedTool.swing, amount || 0.8);
    };
    window.equipToolVisible = function(id, visible){
      if(!attachedTool || attachedTool.id !== id) return;
      attachedTool.mesh.visible = !!visible;
    };
    window.autoEquipPickaxe = function(){
      if(!(State.inventory && State.inventory.pickaxe > 0)) return false;
      State.equipped = 'pickaxe';
      attachToolToPlayer('pickaxe');
      try { window.saveState?.(); } catch(_){}
      refreshHUD();
      return true;
    };

    console.log('[equip] ready');
  }
})();
