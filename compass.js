// =================================================================
// compass.js — narrow, crisp compass over the XP bar.
// =================================================================
(function(){
  'use strict';
  function whenReady(){
    if(!window.Player || !window.camera){ setTimeout(whenReady, 250); return; }
    init();
  }
  whenReady();

  function init(){
    const Player = window.Player;
    const camera = window.camera;

    const css = document.createElement('style');
    css.textContent = `
#fwCompass{
  position:fixed;
  top:8px;
  left:50%;
  transform:translateX(-50%);
  width:180px;
  height:30px;
  background:rgba(8,18,11,.94);
  border:1.5px solid rgba(95,240,156,.55);
  border-radius:14px;
  overflow:hidden;
  z-index:35;
  pointer-events:none;
  box-shadow:0 6px 14px rgba(0,0,0,.5), 0 0 0 1px rgba(255,255,255,.05) inset;
}
#fwCompass canvas{display:block;width:100%;height:100%}
#fwCompass .needle{
  position:absolute;
  left:50%;
  top:1px;
  width:2px;
  height:18px;
  background:#5ff09c;
  transform:translateX(-50%);
  box-shadow:0 0 6px #5ff09c;
}
#fwCompass .needle::after{
  content:"";
  position:absolute;
  top:18px;
  left:50%;
  transform:translateX(-50%);
  border-left:5px solid transparent;
  border-right:5px solid transparent;
  border-top:6px solid #5ff09c;
  filter:drop-shadow(0 0 4px #5ff09c);
}
#fwCompass .hud-deg{
  position:absolute;
  bottom:1px;
  left:50%;
  transform:translateX(-50%);
  color:#5ff09c;
  font:bold 9px 'Outfit','JetBrains Mono',monospace;
  letter-spacing:.5px;
  text-shadow:0 1px 2px rgba(0,0,0,.9);
  pointer-events:none;
}
`;
    document.head.appendChild(css);
    const root = document.createElement('div');
    root.id = 'fwCompass';
    root.innerHTML = `<canvas width="360" height="60"></canvas><div class="needle"></div><div class="hud-deg" id="cmpDeg">0°</div>`;
    document.body.appendChild(root);
    const cvs = root.querySelector('canvas');
    const ctx = cvs.getContext('2d');

    function getFacing(){
      if(typeof window.Cam !== 'undefined' && window.Cam && typeof window.Cam.yaw === 'number') return window.Cam.yaw;
      const dir = new window.THREE.Vector3();
      camera.getWorldDirection(dir);
      return Math.atan2(dir.x, dir.z);
    }

    function draw(){
      const w = cvs.width, h = cvs.height;
      ctx.clearRect(0, 0, w, h);
      // Show ±50° around facing (narrower window — easier to read)
      const facing = getFacing();
      const halfSpan = 50;
      const pxPerDeg = w / (halfSpan * 2);
      const facingDeg = facing * 180 / Math.PI;
      const cards = [
        { deg: 0,    lbl: 'N',  prim: true },
        { deg: 45,   lbl: 'NE', prim: false },
        { deg: 90,   lbl: 'E',  prim: true },
        { deg: 135,  lbl: 'SE', prim: false },
        { deg: 180,  lbl: 'S',  prim: true },
        { deg: -135, lbl: 'SW', prim: false },
        { deg: -90,  lbl: 'W',  prim: true },
        { deg: -45,  lbl: 'NW', prim: false },
      ];
      function wrap180(d){
        while(d > 180) d -= 360;
        while(d < -180) d += 360;
        return d;
      }
      // Tick marks every 15°
      ctx.strokeStyle = 'rgba(230,255,238,0.45)';
      ctx.lineWidth = 1.4;
      for(let d = -180; d <= 180; d += 15){
        const offset = wrap180(d - facingDeg);
        if(Math.abs(offset) > halfSpan) continue;
        const x = w / 2 + offset * pxPerDeg;
        ctx.beginPath();
        ctx.moveTo(x, h * 0.55);
        ctx.lineTo(x, h * 0.85);
        ctx.stroke();
      }
      // Cardinal labels — bigger, bolder, outlined for readability
      ctx.font = 'bold 22px Outfit, Inter, sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      for(const c of cards){
        const offset = wrap180(c.deg - facingDeg);
        if(Math.abs(offset) > halfSpan) continue;
        const x = w / 2 + offset * pxPerDeg;
        // Outline
        ctx.lineWidth = 4;
        ctx.strokeStyle = 'rgba(0,0,0,.95)';
        ctx.strokeText(c.lbl, x, h * 0.40);
        // Fill
        ctx.fillStyle = c.prim ? '#5ff09c' : 'rgba(230,255,238,.95)';
        ctx.fillText(c.lbl, x, h * 0.40);
      }
      // Heading number (separate DOM element so it's sharp)
      const deg = Math.round((facingDeg + 360) % 360);
      const dEl = document.getElementById('cmpDeg');
      if(dEl) dEl.textContent = deg + '°';
      requestAnimationFrame(draw);
    }
    requestAnimationFrame(draw);

    // Make sure the HUD sits below the compass without overlap. The
    // compass is 30px tall + 8px top; nudge HUD to start at 46px so
    // there's a clean gap.
    try{
      const hud = document.getElementById('hud');
      if(hud){ hud.style.paddingTop = '46px'; }
    }catch(e){}

    console.log('[compass] ready');
  }
})();
