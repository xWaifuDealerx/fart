// =================================================================
// loading.js — full-screen loading overlay with progress bar.
// =================================================================
// Shows immediately on page parse, advances based on:
//   • DOMContentLoaded
//   • window.load
//   • THREE.scene readiness
//   • Player + Plots + Cats globals appearing
//   • a soft 800ms hold so people see the bar finish
// Fades out + removes itself when the game is ready.
// =================================================================
(function(){
  'use strict';
  if(document.getElementById('fwLoading')) return;

  const root = document.createElement('div');
  root.id = 'fwLoading';
  root.innerHTML = ''
    + '<style>'
    + '#fwLoading{position:fixed;inset:0;z-index:9999;background:radial-gradient(circle at 50% 35%,#0a2010 0%,#040c08 70%,#000 100%);display:flex;flex-direction:column;align-items:center;justify-content:center;font-family:Outfit,Inter,sans-serif;color:#e6ffee;transition:opacity .6s ease}'
    + '#fwLoading.hide{opacity:0;pointer-events:none}'
    + '#fwLoading .logo{font-family:Bangers,Orbitron,sans-serif;font-size:62px;letter-spacing:5px;background:linear-gradient(135deg,#5ff09c 0%,#fff1c2 55%,#ffce4a 100%);-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;filter:drop-shadow(0 4px 20px rgba(95,240,156,.3));margin-bottom:8px;text-align:center}'
    + '#fwLoading .tag{font-size:13px;letter-spacing:2px;color:rgba(230,255,238,.55);text-transform:uppercase;margin-bottom:36px}'
    + '#fwLoading .bar-wrap{width:min(440px,72vw);height:14px;background:rgba(95,240,156,.10);border:1.5px solid rgba(95,240,156,.4);border-radius:100px;overflow:hidden;position:relative;box-shadow:0 0 24px rgba(95,240,156,.25),inset 0 1px 0 rgba(255,255,255,.06)}'
    + '#fwLoading .bar{position:absolute;left:0;top:0;bottom:0;width:5%;background:linear-gradient(90deg,#2eea7a,#5ff09c 40%,#fff1c2);box-shadow:0 0 16px rgba(95,240,156,.7);transition:width .35s cubic-bezier(.2,.7,.4,1);border-radius:100px}'
    + '#fwLoading .bar::after{content:"";position:absolute;inset:0;background:linear-gradient(120deg,transparent 25%,rgba(255,255,255,.5) 45%,transparent 55%);background-size:220% 100%;animation:fwShine 1.4s linear infinite;mix-blend-mode:overlay}'
    + '@keyframes fwShine{0%{background-position:220% 0}100%{background-position:-220% 0}}'
    + '#fwLoading .pct{font-family:JetBrains Mono,monospace;font-size:13px;color:#5ff09c;margin-top:14px;letter-spacing:1.2px;text-shadow:0 0 12px rgba(95,240,156,.4)}'
    + '#fwLoading .step{font-size:11px;color:rgba(230,255,238,.55);margin-top:6px;font-family:JetBrains Mono,monospace;letter-spacing:.4px;min-height:16px}'
    + '#fwLoading .tips{position:absolute;bottom:36px;left:50%;transform:translateX(-50%);font-size:11px;color:rgba(230,255,238,.4);letter-spacing:.4px;max-width:80vw;text-align:center}'
    + '#fwLoading .tips b{color:#ffce4a}'
    + '</style>'
    + '<div class="logo">FARTWORLD</div>'
    + '<div class="tag">A Solana Brainrot MMO</div>'
    + '<div class="bar-wrap"><div class="bar" id="fwLoadingBar"></div></div>'
    + '<div class="pct" id="fwLoadingPct">0%</div>'
    + '<div class="step" id="fwLoadingStep">Booting up the printers…</div>'
    + '<div class="tips" id="fwLoadingTip">Tip: Press <b>F</b> with a tool equipped to use it</div>';
  document.documentElement.appendChild(root);

  const TIPS = [
    'Tip: Press <b>F</b> with a tool equipped to use it',
    'Tip: Buy a Sea Plane from Wave to fly the skies',
    'Tip: Carlos sells everything you need to start',
    'Tip: Trade Fart Cup tokens at Alexandre’s stand',
    'Tip: Watch out for the cats — don’t fart on them',
    'Tip: Press <b>M</b> to fullscreen the mini-map',
    'Tip: Plant weed seeds for a chance at rainbow buds',
    'Tip: Hold <b>Shift</b> to throttle up the plane',
    'Tip: Hold <b>E</b> at a print station to make paper from cash',
  ];
  const tipEl = document.getElementById('fwLoadingTip');
  setInterval(() => { tipEl.innerHTML = TIPS[Math.floor(Math.random() * TIPS.length)]; }, 2200);

  const STEPS = [
    { p: 8,  msg: 'Booting up the printers…' },
    { p: 18, msg: 'Generating the island…' },
    { p: 30, msg: 'Filling the sea…' },
    { p: 42, msg: 'Planting trees and flowers…' },
    { p: 55, msg: 'Spawning cats and rabbits…' },
    { p: 68, msg: 'Building the marketplace…' },
    { p: 80, msg: 'Calibrating the rocketship…' },
    { p: 92, msg: 'Loading multiplayer…' },
    { p: 100, msg: 'Ready to print!' },
  ];
  let pct = 0;
  function setPct(p, msg){
    pct = Math.max(pct, Math.min(100, p));
    document.getElementById('fwLoadingBar').style.width = pct + '%';
    document.getElementById('fwLoadingPct').textContent = Math.round(pct) + '%';
    if(msg) document.getElementById('fwLoadingStep').textContent = msg;
  }

  // Smooth progression — advance one step every ~280ms while we're
  // also probing the actual game state.
  let stepIdx = 0;
  const progress = setInterval(() => {
    if(stepIdx < STEPS.length - 1){
      const s = STEPS[stepIdx];
      setPct(s.p, s.msg);
      stepIdx++;
    }
  }, 280);

  // Hard signals
  document.addEventListener('DOMContentLoaded', () => setPct(40));
  window.addEventListener('load', () => setPct(80));

  function ready(){
    return !!(window.scene && window.Player && Array.isArray(window.Cats) && Array.isArray(window.Plots));
  }
  const probe = setInterval(() => {
    if(ready()){
      clearInterval(probe);
      clearInterval(progress);
      setPct(100, 'Ready to print!');
      setTimeout(() => {
        root.classList.add('hide');
        setTimeout(() => { try { root.remove(); } catch(e){} }, 900);
      }, 700);
    }
  }, 200);

  // Safety: kill the overlay after 25s no matter what so it can't trap users
  setTimeout(() => {
    if(document.getElementById('fwLoading')){
      root.classList.add('hide');
      setTimeout(() => { try { root.remove(); } catch(e){} }, 900);
    }
  }, 25000);
})();
