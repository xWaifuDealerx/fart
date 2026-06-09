// =================================================================
// desktop-only.js — show a "play on desktop" message on mobile.
// =================================================================
// FartWorld's controls (WASD + mouse aim + right/left-click + lots of
// keyboard hotkeys) just don't translate to a touchscreen. Rather than
// half-render the game, we cover the page with a friendly notice.
// =================================================================
(function(){
  'use strict';

  function isMobile(){
    const ua = (navigator.userAgent || '') + ' ' + (navigator.vendor || '');
    // Standard mobile UA patterns
    if(/Mobi|Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|webOS|Windows Phone|Kindle|Silk/i.test(ua)) return true;
    // iPadOS reports as desktop Safari but supports touch — catch via
    // multi-touch + Apple platform.
    if(navigator.maxTouchPoints > 1 && /Macintosh/.test(ua)) return true;
    // Narrow viewport heuristic
    if(window.matchMedia && window.matchMedia('(pointer: coarse) and (max-width: 900px)').matches) return true;
    return false;
  }

  if(!isMobile()) return;

  function render(){
    // Tear down whatever's been rendered and replace with a full-screen
    // notice. We do this even if other side files have already injected
    // their styles — pointer-events:none on the rest of the page makes
    // sure nothing under the overlay can be clicked.
    const css = document.createElement('style');
    css.textContent = `
#fwMobileBlock{position:fixed;inset:0;z-index:10000;background:radial-gradient(circle at 50% 35%,#0a2010 0%,#040c08 70%,#000 100%);display:flex;flex-direction:column;align-items:center;justify-content:center;padding:24px;color:#e6ffee;font-family:'Outfit','Inter',system-ui,sans-serif;text-align:center}
#fwMobileBlock .logo{font-family:'Bangers','Orbitron',sans-serif;font-size:48px;letter-spacing:4px;background:linear-gradient(135deg,#5ff09c 0%,#fff1c2 55%,#ffce4a 100%);-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;margin-bottom:8px;line-height:1}
#fwMobileBlock .tag{font-size:11px;letter-spacing:2.5px;color:rgba(230,255,238,.55);text-transform:uppercase;margin-bottom:36px}
#fwMobileBlock .card{max-width:420px;width:100%;background:linear-gradient(180deg,rgba(15,32,18,.85),rgba(8,18,11,.85));border:1px solid rgba(46,224,107,.30);border-radius:24px;padding:32px 24px;box-shadow:0 30px 80px rgba(0,0,0,.55),0 0 60px rgba(46,224,107,.15)}
#fwMobileBlock .emoji{font-size:54px;line-height:1;margin-bottom:14px}
#fwMobileBlock h2{font-family:'Bangers','Orbitron',sans-serif;font-size:26px;letter-spacing:1.4px;color:#5ff09c;margin-bottom:10px}
#fwMobileBlock p{font-size:13.5px;line-height:1.55;color:rgba(230,255,238,.78);margin-bottom:14px}
#fwMobileBlock p b{color:#fff1c2}
#fwMobileBlock .hint{font-family:'JetBrains Mono',monospace;font-size:11px;letter-spacing:.6px;color:rgba(255,206,74,.85);margin-top:10px}
#fwMobileBlock a.back{margin-top:22px;display:inline-block;color:rgba(95,240,156,.85);font-family:'JetBrains Mono',monospace;font-size:11px;letter-spacing:1.2px;text-transform:uppercase;text-decoration:none;border:1px solid rgba(95,240,156,.45);padding:8px 16px;border-radius:100px}
#fwMobileBlock a.back:hover{background:rgba(95,240,156,.10)}
body > *:not(#fwMobileBlock){pointer-events:none!important}
`;
    document.head.appendChild(css);

    const root = document.createElement('div');
    root.id = 'fwMobileBlock';
    root.innerHTML =
        '<div class="logo">FARTWORLD</div>'
      + '<div class="tag">A Solana Brainrot MMO</div>'
      + '<div class="card">'
      + '  <div class="emoji">🖥️</div>'
      + '  <h2>Play on Desktop</h2>'
      + '  <p>FartWorld is built for keyboard + mouse — WASD to move, click to interact, scroll to zoom. The full 3D world doesn\'t fit on a small screen.</p>'
      + '  <p><b>Open this page on a laptop or desktop computer</b> and you\'ll be printing in no time.</p>'
      + '  <div class="hint">fartprint.fun · best on desktop</div>'
      + '  <a class="back" href="/">← Back to Fartprint</a>'
      + '</div>';
    document.body ? document.body.appendChild(root) : document.documentElement.appendChild(root);
  }

  // Run as soon as body exists.
  if(document.body){
    render();
  } else {
    document.addEventListener('DOMContentLoaded', render, { once: true });
  }
})();
