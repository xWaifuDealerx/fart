// =================================================================
// casino.js — Poop Casino at (-67, -27). Walk up, press E, and play a
// 3-reel slot machine. Symbols: 💩 poop, 🚽 toilet, 🧻 toilet paper.
// Match 3 to win. Bets are placed in CASH (💵 State.paper) only — never
// silver. Self-contained side file, mirrors the other building modules.
// =================================================================
(function(){
  'use strict';
  function whenReady(){
    if(!window.THREE || !window.scene || !window.Player || !window.State || !window.groundHeightAt){
      setTimeout(whenReady, 300); return;
    }
    init();
  }
  whenReady();

  function init(){
    const THREE = window.THREE, scene = window.scene, Player = window.Player, State = window.State;
    const groundHeightAt = window.groundHeightAt;
    const POS = { x: -67, z: -27 };
    const RADIUS = 6;

    // ── Cash helpers (CASH = 💵 = State.paper; NOT silver/credits) ──
    function cash(){ return Number(State.paper) || 0; }
    function addCash(n){ State.paper = cash() + n; }

    // ── Building ──
    (function buildCasino(){
      const grp = new THREE.Group();
      grp.position.set(POS.x, groundHeightAt(POS.x, POS.z), POS.z);
      const wallMat = new THREE.MeshStandardMaterial({ color: 0x2a1342, roughness: 0.55, metalness: 0.25 });
      const base = new THREE.Mesh(new THREE.BoxGeometry(8, 5, 7), wallMat);
      base.position.y = 2.5; base.castShadow = true; base.receiveShadow = true; grp.add(base);
      // Gold trim band
      const band = new THREE.Mesh(new THREE.BoxGeometry(8.2, 0.5, 7.2),
        new THREE.MeshStandardMaterial({ color: 0xffd64d, emissive: 0xffae00, emissiveIntensity: 0.5, metalness: 0.6, roughness: 0.3 }));
      band.position.y = 4.2; grp.add(band);
      // Flat roof
      const roof = new THREE.Mesh(new THREE.BoxGeometry(8.4, 0.4, 7.4),
        new THREE.MeshStandardMaterial({ color: 0x1a0c2a, roughness: 0.7 }));
      roof.position.y = 5.0; grp.add(roof);
      // Door
      const door = new THREE.Mesh(new THREE.BoxGeometry(2, 3, 0.2),
        new THREE.MeshStandardMaterial({ color: 0x140a20, emissive: 0xff3cac, emissiveIntensity: 0.25, roughness: 0.4 }));
      door.position.set(0, 1.5, 3.55); grp.add(door);
      // Neon sign (canvas texture)
      const cv = document.createElement('canvas'); cv.width = 512; cv.height = 160;
      const ctx = cv.getContext('2d');
      ctx.fillStyle = '#1a0c2a'; ctx.fillRect(0, 0, 512, 160);
      ctx.font = 'bold 96px Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.shadowColor = '#ff3cac'; ctx.shadowBlur = 28;
      ctx.fillStyle = '#ff6ec7'; ctx.fillText('🎰 CASINO 🎰', 256, 84);
      const tex = new THREE.CanvasTexture(cv);
      const sign = new THREE.Mesh(new THREE.PlaneGeometry(7, 2.2),
        new THREE.MeshBasicMaterial({ map: tex, transparent: true }));
      sign.position.set(0, 3.3, 3.62); grp.add(sign);
      // Glow
      const lt = new THREE.PointLight(0xff3cac, 1.8, 22); lt.position.set(0, 4, 5); grp.add(lt);
      scene.add(grp);
      if(window.MinimapLandmarks){
        try { window.MinimapLandmarks.push({ x: POS.x, z: POS.z, label: 'Casino', color: '#ff3cac' }); } catch(_){}
      }
      console.log('[casino] built at', POS);
    })();

    // ── Styles ──
    const css = document.createElement('style');
    css.textContent = `
.cas-prox{position:fixed;left:50%;bottom:150px;transform:translateX(-50%);display:none;background:linear-gradient(180deg,rgba(42,12,52,.96),rgba(22,6,30,.96));border:2px solid rgba(255,60,172,.6);border-radius:14px;padding:12px 22px;z-index:55;text-align:center;box-shadow:0 14px 26px rgba(0,0,0,.55);font-family:'Outfit','JetBrains Mono',sans-serif}
.cas-prox.show{display:block}
.cas-prox .who{font-size:11px;color:rgba(255,220,245,.8);margin-bottom:5px;letter-spacing:.4px}
.cas-prox .line{font-family:'Bangers','Orbitron',sans-serif;font-size:17px;color:#fff1c2;letter-spacing:.7px}
.cas-prox kbd{display:inline-block;background:rgba(255,60,172,.25);border:1px solid rgba(255,60,172,.7);color:#ff9ad9;padding:2px 9px;border-radius:6px;font-family:'JetBrains Mono',monospace;font-size:13px;font-weight:700}
.cas-bg{position:fixed;inset:0;display:none;align-items:center;justify-content:center;background:rgba(0,0,0,.8);backdrop-filter:blur(7px);z-index:210;padding:18px}
.cas-bg.show{display:flex}
.cas-card{background:linear-gradient(180deg,rgba(40,14,52,.98),rgba(16,6,24,.98));border:2px solid rgba(255,60,172,.6);border-radius:20px;padding:22px 24px;max-width:440px;width:100%;text-align:center;color:#fff1c2;font-family:'Outfit',sans-serif;box-shadow:0 24px 60px rgba(0,0,0,.65),0 0 50px rgba(255,60,172,.18)}
.cas-card h2{font-family:'Bangers','Orbitron',sans-serif;font-size:30px;color:#ff6ec7;letter-spacing:2px;margin-bottom:4px}
.cas-sub{font-size:11.5px;color:rgba(255,220,245,.7);margin-bottom:14px}
.cas-reels{display:flex;gap:10px;justify-content:center;margin:10px 0 6px}
.cas-reel{width:96px;height:110px;border-radius:14px;background:rgba(255,255,255,.06);border:2px solid rgba(255,60,172,.45);display:flex;align-items:center;justify-content:center;font-size:62px;box-shadow:inset 0 0 18px rgba(0,0,0,.5)}
.cas-reel.win{border-color:#ffd64d;box-shadow:0 0 22px rgba(255,214,77,.6),inset 0 0 18px rgba(255,214,77,.25)}
.cas-result{min-height:24px;font-weight:800;font-size:14px;margin:10px 0;letter-spacing:.4px}
.cas-result.win{color:#5ff09c}.cas-result.lose{color:#ff7a9c}
.cas-row{display:flex;justify-content:space-between;font-size:12px;font-family:'JetBrains Mono',monospace;color:rgba(255,220,245,.85);margin:4px 2px}
.cas-row b{color:#fff1c2}
.cas-chips{display:flex;gap:6px;justify-content:center;margin:8px 0}
.cas-chip{flex:1;background:rgba(255,60,172,.12);border:1px solid rgba(255,60,172,.5);color:#ff9ad9;border-radius:9px;padding:8px 0;font-family:'Outfit',sans-serif;font-weight:800;font-size:12px;cursor:pointer;transition:all .12s}
.cas-chip:hover{background:rgba(255,60,172,.25)}
.cas-chip.on{background:rgba(255,60,172,.35);border-color:#ff6ec7;color:#fff}
.cas-btns{display:flex;gap:8px;justify-content:center;margin-top:10px}
.cas-btn{border:0;border-radius:11px;padding:12px 26px;font-family:'Outfit',sans-serif;font-weight:900;font-size:13px;letter-spacing:1.1px;cursor:pointer;text-transform:uppercase}
.cas-btn.spin{background:linear-gradient(135deg,#ff6ec7,#ff3cac);color:#fff}
.cas-btn.spin:disabled{opacity:.5;cursor:not-allowed}
.cas-btn.close{background:transparent;color:rgba(255,220,245,.7);border:1px solid rgba(255,220,245,.25)}
.cas-pay{font-size:10.5px;color:rgba(255,220,245,.6);margin-top:10px;line-height:1.5}
`;
    document.head.appendChild(css);

    // ── Proximity popup ──
    const prox = document.createElement('div');
    prox.className = 'cas-prox';
    prox.innerHTML = '<div class="who">🎰 Poop Casino</div><div class="line">Press <kbd>E</kbd> — Slots · Coinflip · Roulette</div>';
    document.body.appendChild(prox);

    // ── Slot modal ──
    const SYMBOLS = ['💩', '🚽', '🧻'];
    const PAYOUT  = { '💩': 5, '🚽': 8, '🧻': 12 };   // multiplier for 3-of-a-kind
    const CHIPS   = [100, 500, 1000, 5000, 10000];
    let bet = 100;
    let spinning = false;

    // Extra styles for the 3-game casino (tabs, coin, roulette wheel)
    const css2 = document.createElement('style');
    css2.textContent = `
.cas-tabs{display:flex;gap:6px;margin:10px 0 12px}
.cas-tab{flex:1;background:rgba(255,110,199,.08);border:1px solid rgba(255,110,199,.35);color:rgba(255,220,245,.8);
  padding:8px 6px;border-radius:10px;font-family:'Outfit',sans-serif;font-weight:800;font-size:12px;cursor:pointer;
  transition:all .15s ease;letter-spacing:.3px}
.cas-tab.on{background:rgba(255,110,199,.25);border-color:#ff6ec7;color:#fff;box-shadow:0 0 14px rgba(255,110,199,.3)}
.cas-coinwrap{display:flex;justify-content:center;margin:14px 0;perspective:700px;height:96px}
.cas-coin{position:relative;width:92px;height:92px;transform-style:preserve-3d}
.cas-coin .face{position:absolute;inset:0;border-radius:50%;display:flex;align-items:center;justify-content:center;
  font-size:46px;backface-visibility:hidden;-webkit-backface-visibility:hidden;border:3px solid rgba(255,255,255,.35);
  box-shadow:inset 0 -8px 14px rgba(0,0,0,.35)}
.cas-coin .f{background:radial-gradient(circle at 35% 30%,#ffe9a8,#d6a832)}
.cas-coin .b{background:radial-gradient(circle at 35% 30%,#f0f4f8,#9aa6b2);transform:rotateY(180deg)}
.cas-flipbtns,.cas-roulbtns{display:flex;gap:8px;margin-top:10px}
.cas-flipbtns .cas-btn,.cas-roulbtns .cas-btn{flex:1}
.cas-btn.rb.red{background:linear-gradient(135deg,#e74c3c,#c0392b);color:#fff}
.cas-btn.rb.black{background:linear-gradient(135deg,#34343c,#141418);color:#fff;border:1px solid rgba(255,255,255,.25)}
.cas-btn.rb.green{background:linear-gradient(135deg,#2ecc71,#1e8e4e);color:#fff}
.cas-wheelwrap{position:relative;width:240px;margin:8px auto 0}
.cas-wheelwrap canvas{display:block;width:240px;height:240px}
.cas-pin{position:absolute;top:-6px;left:50%;transform:translateX(-50%);font-size:20px;color:#ffd64d;z-index:2;
  text-shadow:0 0 10px rgba(255,214,77,.8),0 2px 2px rgba(0,0,0,.8)}
`;
    document.head.appendChild(css2);

    const bg = document.createElement('div');
    bg.className = 'cas-bg';
    bg.innerHTML = ''
      + '<div class="cas-card">'
      + '  <h2>🎰 POOP CASINO</h2>'
      + '  <div class="cas-tabs">'
      + '    <button class="cas-tab on" data-g="slots">🎰 Slots</button>'
      + '    <button class="cas-tab" data-g="flip">🪙 Coinflip</button>'
      + '    <button class="cas-tab" data-g="roul">🎡 Roulette</button>'
      + '  </div>'
      + '  <div class="cas-pane" id="casPaneSlots">'
      + '    <div class="cas-sub">Match three to win. Cash bets only 💵</div>'
      + '    <div class="cas-reels"><div class="cas-reel" id="casR0">💩</div><div class="cas-reel" id="casR1">🚽</div><div class="cas-reel" id="casR2">🧻</div></div>'
      + '    <div class="cas-pay">3× 🧻 pays 12× · 3× 🚽 pays 8× · 3× 💩 pays 5×</div>'
      + '  </div>'
      + '  <div class="cas-pane" id="casPaneFlip" style="display:none">'
      + '    <div class="cas-sub">Call it in the air — a right call pays 2× 💵</div>'
      + '    <div class="cas-coinwrap"><div class="cas-coin" id="casCoin"><div class="face f">💩</div><div class="face b">🧻</div></div></div>'
      + '    <div class="cas-flipbtns"><button class="cas-btn spin" id="casFlipPoop">💩 POOP</button><button class="cas-btn spin" id="casFlipPaper">🧻 PAPER</button></div>'
      + '  </div>'
      + '  <div class="cas-pane" id="casPaneRoul" style="display:none">'
      + '    <div class="cas-sub">Red / Black pay 2× · Green 0 pays 36× 💵</div>'
      + '    <div class="cas-wheelwrap"><div class="cas-pin">▼</div><canvas id="casWheel" width="480" height="480"></canvas></div>'
      + '    <div class="cas-roulbtns"><button class="cas-btn rb red" id="casBetRed">RED</button><button class="cas-btn rb green" id="casBetGreen">0</button><button class="cas-btn rb black" id="casBetBlack">BLACK</button></div>'
      + '  </div>'
      + '  <div class="cas-result" id="casResult">Place your bet!</div>'
      + '  <div class="cas-row"><span>Your 💵 Cash</span><b id="casCash">0</b></div>'
      + '  <div class="cas-row"><span>Bet (💵)</span><b id="casBet">100</b></div>'
      + '  <div class="cas-chips" id="casChips"></div>'
      + '  <div class="cas-btns"><button class="cas-btn close" id="casClose">Leave</button><button class="cas-btn spin" id="casSpin">Spin</button></div>'
      + '</div>';
    document.body.appendChild(bg);

    const R = [document.getElementById('casR0'), document.getElementById('casR1'), document.getElementById('casR2')];
    const resultEl = document.getElementById('casResult');
    const cashEl   = document.getElementById('casCash');
    const betEl    = document.getElementById('casBet');
    const spinBtn  = document.getElementById('casSpin');

    // Bet chips
    const chipsHost = document.getElementById('casChips');
    chipsHost.innerHTML = CHIPS.map(c => '<button class="cas-chip" data-bet="' + c + '">' + c + '</button>').join('')
                        + '<button class="cas-chip" data-bet="max">MAX</button>';
    function renderChips(){
      chipsHost.querySelectorAll('.cas-chip').forEach(ch => {
        const v = ch.dataset.bet === 'max' ? cash() : Number(ch.dataset.bet);
        ch.classList.toggle('on', v === bet && bet > 0);
      });
      betEl.textContent = bet;
      cashEl.textContent = cash();
    }
    chipsHost.querySelectorAll('.cas-chip').forEach(ch => {
      ch.addEventListener('click', () => {
        if(spinning) return;
        bet = ch.dataset.bet === 'max' ? cash() : Number(ch.dataset.bet);
        bet = Math.max(0, Math.min(bet, cash()));
        renderChips();
      });
    });

    function setResult(txt, cls){
      resultEl.textContent = txt;
      resultEl.className = 'cas-result' + (cls ? ' ' + cls : '');
    }
    function clearWinGlow(){ R.forEach(el => el.classList.remove('win')); }

    function open(){
      bet = Math.min(bet || 100, cash()) || (cash() >= 100 ? 100 : cash());
      clearWinGlow();
      setResult('Place your bet and spin!', '');
      renderChips();
      bg.classList.add('show');
    }
    function close(){ bg.classList.remove('show'); }

    function pick(){ return SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)]; }

    // Shared bet handling for all three games
    function placeBet(){
      if(spinning) return false;
      if(bet <= 0){ setResult('Set a bet first 💵', 'lose'); return false; }
      if(cash() < bet){ setResult('Not enough cash 💵', 'lose'); return false; }
      spinning = true;
      spinBtn.disabled = true;
      addCash(-bet);
      window.fwSkillXp?.('gamba', Math.max(1, Math.round(bet / 5)));
      window.updateHUD?.(); renderChips();
      return true;
    }
    function endRound(){
      spinning = false;
      spinBtn.disabled = false;
      window.updateHUD?.(); window.saveState?.();
      renderChips();
    }

    function spin(){
      if(!placeBet()) return;
      clearWinGlow();
      setResult('Spinning…', '');
      const final = [pick(), pick(), pick()];
      const stopAt = [700, 1050, 1400];
      R.forEach((el, i) => {
        const iv = setInterval(() => { el.textContent = pick(); }, 70);
        setTimeout(() => {
          clearInterval(iv);
          el.textContent = final[i];
          if(i === 2) finish(final);
        }, stopAt[i]);
      });
    }

    function finish(final){
      if(final[0] === final[1] && final[1] === final[2]){
        const mult = PAYOUT[final[0]] || 5;
        const won = bet * mult;
        addCash(won);
        R.forEach(el => el.classList.add('win'));
        setResult('🎉 JACKPOT! ' + final[0] + final[0] + final[0] + ' — won ' + won + ' 💵 (' + mult + '×)', 'win');
        window.playPurchaseSound?.();
      } else {
        setResult('No match — lost ' + bet + ' 💵. Spin again!', 'lose');
      }
      endRound();
    }

    spinBtn.addEventListener('click', spin);
    document.getElementById('casClose').addEventListener('click', close);
    bg.addEventListener('click', (e) => { if(e.target === bg) close(); });

    // ──────────────────────────────────────────────────────────────
    // GAME TABS — Slots / Coinflip / Roulette
    // ──────────────────────────────────────────────────────────────
    let game = 'slots';
    bg.querySelectorAll('.cas-tab').forEach(tb => {
      tb.addEventListener('click', () => {
        if(spinning) return;
        game = tb.dataset.g;
        bg.querySelectorAll('.cas-tab').forEach(b => b.classList.toggle('on', b === tb));
        document.getElementById('casPaneSlots').style.display = game === 'slots' ? '' : 'none';
        document.getElementById('casPaneFlip').style.display  = game === 'flip'  ? '' : 'none';
        document.getElementById('casPaneRoul').style.display  = game === 'roul'  ? '' : 'none';
        spinBtn.style.display = game === 'slots' ? '' : 'none';
        setResult('Place your bet!', '');
        if(game === 'roul') drawWheel(roulAngle);
      });
    });

    // ──────────────────────────────────────────────────────────────
    // COINFLIP — call 💩 or 🧻, right call pays 2×
    // ──────────────────────────────────────────────────────────────
    const coinEl = document.getElementById('casCoin');
    function flip(call){
      if(!placeBet()) return;
      setResult('Flipping…', '');
      const win = Math.random() < 0.49;                       // slight house edge
      const landed = win ? call : (call === 'poop' ? 'paper' : 'poop');
      coinEl.style.transition = 'none';
      coinEl.style.transform = 'rotateY(0deg)';
      void coinEl.offsetWidth;
      coinEl.style.transition = 'transform 1.35s cubic-bezier(.22,.8,.3,1)';
      coinEl.style.transform = 'rotateY(' + (1800 + (landed === 'paper' ? 180 : 0)) + 'deg)';
      setTimeout(() => {
        const em = landed === 'poop' ? '💩' : '🧻';
        if(win){
          const won = bet * 2;
          addCash(won);
          setResult('🎉 ' + em + ' — you called it! +' + won + ' 💵', 'win');
          window.playPurchaseSound?.();
        } else {
          setResult(em + ' — wrong call. Lost ' + bet + ' 💵', 'lose');
        }
        endRound();
      }, 1450);
    }
    document.getElementById('casFlipPoop').addEventListener('click', () => flip('poop'));
    document.getElementById('casFlipPaper').addEventListener('click', () => flip('paper'));

    // ──────────────────────────────────────────────────────────────
    // ROULETTE — real spinning European wheel (37 pockets)
    // ──────────────────────────────────────────────────────────────
    const ORDER = [0,32,15,19,4,21,2,25,17,34,6,27,13,36,11,30,8,23,10,5,24,16,33,1,20,14,31,9,22,18,29,7,28,12,35,3,26];
    const RED = new Set([1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36]);
    const SEG = (Math.PI * 2) / ORDER.length;
    const wheelCvs = document.getElementById('casWheel');
    const wctx = wheelCvs.getContext('2d');
    let roulAngle = 0;
    function drawWheel(angle){
      const S = wheelCvs.width;             // 480 backing (240 css) — crisp
      const c = S / 2, rOut = c - 6, rIn = rOut * 0.62;
      wctx.clearRect(0, 0, S, S);
      wctx.save();
      wctx.translate(c, c);
      wctx.rotate(angle);
      for(let i = 0; i < ORDER.length; i++){
        const n = ORDER[i];
        const a0 = i * SEG, a1 = a0 + SEG;
        wctx.beginPath();
        wctx.moveTo(0, 0);
        wctx.arc(0, 0, rOut, a0, a1);
        wctx.closePath();
        wctx.fillStyle = n === 0 ? '#1e8e4e' : (RED.has(n) ? '#c0392b' : '#17171c');
        wctx.fill();
        wctx.strokeStyle = 'rgba(255,214,77,.35)';
        wctx.lineWidth = 1.5;
        wctx.stroke();
        // number label
        wctx.save();
        wctx.rotate(a0 + SEG / 2);
        wctx.translate(rOut * 0.82, 0);
        wctx.rotate(Math.PI / 2);
        wctx.fillStyle = '#fff';
        wctx.font = '700 ' + Math.round(S * 0.045) + 'px Outfit, sans-serif';
        wctx.textAlign = 'center';
        wctx.textBaseline = 'middle';
        wctx.fillText(String(n), 0, 0);
        wctx.restore();
      }
      // hub + trim
      wctx.beginPath(); wctx.arc(0, 0, rIn, 0, Math.PI * 2);
      wctx.fillStyle = '#241a2e'; wctx.fill();
      wctx.lineWidth = 4; wctx.strokeStyle = '#ffd64d'; wctx.stroke();
      wctx.beginPath(); wctx.arc(0, 0, rOut + 3, 0, Math.PI * 2);
      wctx.lineWidth = 5; wctx.strokeStyle = '#ffd64d'; wctx.stroke();
      wctx.font = Math.round(S * 0.12) + 'px serif';
      wctx.textAlign = 'center'; wctx.textBaseline = 'middle';
      wctx.fillText('💩', 0, 0);
      wctx.restore();
    }
    drawWheel(0);
    function landedIndex(angle){
      let local = (-Math.PI / 2 - angle) % (Math.PI * 2);
      if(local < 0) local += Math.PI * 2;
      return Math.floor(local / SEG) % ORDER.length;
    }
    function spinRoul(betOn){
      if(!placeBet()) return;
      setResult('No more bets — wheel is spinning…', '');
      const ti = Math.floor(Math.random() * ORDER.length);
      // final angle puts pocket ti's centre under the top pin
      const targetLocal = (ti + 0.5) * SEG;
      let delta = ((-Math.PI / 2 - targetLocal) - roulAngle) % (Math.PI * 2);
      if(delta < 0) delta += Math.PI * 2;
      const total = delta + Math.PI * 2 * (6 + Math.floor(Math.random() * 3));
      const start = roulAngle;
      const dur = 4400;
      const t0 = performance.now();
      function anim(t){
        const k = Math.min(1, (t - t0) / dur);
        const ease = 1 - Math.pow(1 - k, 3);     // decelerating, like a real wheel
        roulAngle = start + total * ease;
        drawWheel(roulAngle);
        if(k < 1){ requestAnimationFrame(anim); return; }
        const idx = landedIndex(roulAngle);
        const n = ORDER[idx];
        const color = n === 0 ? 'green' : (RED.has(n) ? 'red' : 'black');
        const em = color === 'green' ? '🟢' : color === 'red' ? '🔴' : '⚫';
        let won = 0;
        if(betOn === color) won = bet * (color === 'green' ? 36 : 2);
        if(won > 0){
          addCash(won);
          setResult('🎉 ' + em + ' ' + n + ' — WIN! +' + won + ' 💵', 'win');
          window.playPurchaseSound?.();
        } else {
          setResult(em + ' ' + n + ' — house takes ' + bet + ' 💵', 'lose');
        }
        endRound();
      }
      requestAnimationFrame(anim);
    }
    document.getElementById('casBetRed').addEventListener('click', () => spinRoul('red'));
    document.getElementById('casBetBlack').addEventListener('click', () => spinRoul('black'));
    document.getElementById('casBetGreen').addEventListener('click', () => spinRoul('green'));

    // ── Proximity + interaction ──
    let near = false;
    setInterval(() => {
      const d = Math.hypot(Player.pos.x - POS.x, Player.pos.z - POS.z);
      near = d < RADIUS;
      if(bg.classList.contains('show')){ prox.classList.remove('show'); return; }
      prox.classList.toggle('show', near);
    }, 200);

    window.addEventListener('keydown', (e) => {
      if(e.code !== 'KeyE' || !near) return;
      const a = document.activeElement;
      if(a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA')) return;
      // Don't hijack E if another modal is already open.
      if(document.querySelector('.cas-bg.show, .junk-bg.show, .gs-bg.show, #invBg.show, #marketBg.show, .fc-bg.show, .bank-bg.show, .gary-bg.show')) {
        if(!bg.classList.contains('show')) return;
      }
      e.preventDefault();
      open();
    });
    prox.addEventListener('click', () => { if(near) open(); });

    window.openCasino = open;
  }
})();
