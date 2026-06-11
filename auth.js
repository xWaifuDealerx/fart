// =================================================================
// auth.js — Google sign-in + Phantom wallet linking.
//
//  • Login screen gains "Sign in with Google" below Connect Phantom.
//  • Google players CANNOT use Fart Cup or Fart&Poop500 until they
//    link a Phantom wallet in ⚙ Settings → ACCOUNT.
//  • Players already logged in with Phantom don't see the link option.
//  • Linked players can later log in with Phantom directly and keep
//    their progress (progress is stored in this browser).
//  • Wallets can be unlinked any time.
//
// ⚠ CONFIG — paste your Google OAuth Client ID below (Google Cloud
//    Console → Credentials → OAuth 2.0 Client ID (Web); add your
//    domain to the authorized JavaScript origins). The Client ID is
//    public — never put the client SECRET anywhere in the game.
// =================================================================
(function(){
  'use strict';

  const GOOGLE_CLIENT_ID = '203645688403-t69tofobuvq12membv5n1mf3jenugvir.apps.googleusercontent.com';   // fartprint.art

  // ── persisted auth state ──
  const KEY = 'fw.auth.v1';
  let A = { provider: null, providerId: null, email: null, name: null, linkedWallet: null };
  try { A = Object.assign(A, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch(_){}
  function save(){ try { localStorage.setItem(KEY, JSON.stringify(A)); } catch(_){} }
  window.FWAuth = A;

  function shortAddr(a){ return a ? (a.slice(0, 4) + '…' + a.slice(-4)) : ''; }
  function loadScript(src){
    return new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = src; s.async = true;
      s.onload = res; s.onerror = rej;
      document.head.appendChild(s);
    });
  }
  function decodeJwt(tok){
    try {
      const p = tok.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
      return JSON.parse(atob(p));
    } catch(_){ return {}; }
  }

  // Is this player locked out of the trading venues?
  function tradeGated(){
    if(!A.provider || A.provider === 'phantom') return false;
    if(A.linkedWallet) return false;
    if(window.State && window.State.wallet) return false;
    return true;
  }
  const GATE_MSG = '🔒 Link your Phantom wallet first — ⚙ Settings → ACCOUNT';

  function whenReady(){
    if(!document.body){ setTimeout(whenReady, 300); return; }
    init();
  }
  whenReady();

  function init(){
    // ──────────────────────────────────────────────────────────────
    // 1) LOGIN BUTTONS — below "Connect Phantom"
    // ──────────────────────────────────────────────────────────────
    const css = document.createElement('style');
    css.textContent = `
.fw-oauth{display:flex;flex-direction:column;gap:8px;margin-top:10px}
.fw-oauth button{display:flex;align-items:center;justify-content:center;gap:9px;width:100%;
  padding:11px 16px;border-radius:100px;font-family:'Outfit','Inter',sans-serif;font-weight:700;
  font-size:13px;cursor:pointer;letter-spacing:.3px;transition:transform .15s ease,box-shadow .15s ease}
.fw-oauth button:hover{transform:translateY(-1px)}
.fw-oauth .g{background:#fff;color:#1a1a1a;border:1px solid rgba(0,0,0,.15);box-shadow:0 4px 14px rgba(255,255,255,.12)}
.fw-oauth .a{background:#000;color:#fff;border:1px solid rgba(255,255,255,.25);box-shadow:0 4px 14px rgba(0,0,0,.4)}
.fw-oauth .signed{font-family:'JetBrains Mono',monospace;font-size:10.5px;color:rgba(230,255,238,.6);text-align:center}
/* settings account section */
.fw-acct{margin-top:14px;border-top:1px solid rgba(110,208,214,.18);padding-top:12px}
.fw-acct .row{display:flex;align-items:center;gap:10px;background:rgba(110,208,214,.06);
  border:1px solid rgba(110,208,214,.25);border-radius:10px;padding:9px 12px;margin-bottom:8px;
  font-size:12px;color:rgba(230,255,238,.85)}
.fw-acct .row b{color:#fff}
.fw-acct .btn{margin-left:auto;border:0;padding:7px 14px;border-radius:100px;cursor:pointer;
  font-family:'Orbitron',sans-serif;font-weight:900;font-size:10px;letter-spacing:.6px;text-transform:uppercase;
  transition:transform .15s ease}
.fw-acct .btn:hover{transform:translateY(-1px)}
.fw-acct .btn.link{background:linear-gradient(135deg,#a06aff,#7a3ae0);color:#fff;box-shadow:0 4px 12px rgba(160,106,255,.35)}
.fw-acct .btn.unlink{background:rgba(255,90,77,.15);border:1px solid rgba(255,122,110,.5);color:#ff7a6e}
`;
    document.head.appendChild(css);

    function injectLoginButtons(){
      const card = document.querySelector('#login .login-card');
      const connectBtn = document.getElementById('connectBtn');
      if(!card || !connectBtn || document.getElementById('fwOauth')) return;
      const wrap = document.createElement('div');
      wrap.className = 'fw-oauth';
      wrap.id = 'fwOauth';
      wrap.innerHTML =
        '<button class="g" id="fwGoogleBtn" type="button">'
        + '<svg width="17" height="17" viewBox="0 0 48 48"><path fill="#FFC107" d="M43.6 20.1H42V20H24v8h11.3C33.7 32.7 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3l5.7-5.7C34.3 6.1 29.4 4 24 4 13 4 4 13 4 24s9 20 20 20 20-9 20-20c0-1.3-.1-2.6-.4-3.9z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.9 1.2 8 3l5.7-5.7C34.3 6.1 29.4 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.3 0-9.7-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.1H42V20H24v8h11.3c-.8 2.2-2.2 4.1-4.1 5.6l6.2 5.2C41 35.4 44 30.2 44 24c0-1.3-.1-2.6-.4-3.9z"/></svg>'
        + 'Sign in with Google</button>'
        + (A.provider && A.provider !== 'phantom'
            ? '<div class="signed">last signed in: ' + (A.email || A.provider) + '</div>' : '');
      connectBtn.insertAdjacentElement('afterend', wrap);
      document.getElementById('fwGoogleBtn').addEventListener('click', googleSignIn);
    }
    injectLoginButtons();
    setTimeout(injectLoginButtons, 1500);   // in case the login card builds late

    function enterGameAs(provider, providerId, email, name){
      A.provider = provider;
      A.providerId = providerId;
      A.email = email || null;
      A.name = name || null;
      save();
      window.floater?.('✅ Signed in' + (email ? ' as ' + email : '') + ' — welcome!', 'good');
      // proceed into the game like the guest flow
      try { window.enterLobby?.(); } catch(_){}
    }

    async function googleSignIn(){
      if(!GOOGLE_CLIENT_ID){
        alert('Google sign-in is not configured yet.\n\nAdd your Google OAuth Client ID at the top of auth.js (GOOGLE_CLIENT_ID).');
        return;
      }
      try {
        if(!window.google?.accounts) await loadScript('https://accounts.google.com/gsi/client');
        const tc = google.accounts.oauth2.initTokenClient({
          client_id: GOOGLE_CLIENT_ID,
          scope: 'openid email profile',
          callback: async (resp) => {
            if(!resp || !resp.access_token) return;
            try {
              const r = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
                headers: { Authorization: 'Bearer ' + resp.access_token },
              });
              const u = await r.json();
              enterGameAs('google', u.sub, u.email, u.name);
            } catch(_){
              enterGameAs('google', 'google-user', null, null);
            }
          },
        });
        tc.requestAccessToken();
      } catch(err){
        console.error('[auth] google', err);
        alert('Google sign-in failed to load — check your connection and client ID.');
      }
    }

    // Detect a direct Phantom login (the Connect Phantom flow sets
    // State.wallet) — only claims the provider slot if nobody has it.
    setInterval(() => {
      const w = window.State?.wallet;
      if(w && !A.provider){
        A.provider = 'phantom';
        A.providerId = w;
        save();
        refreshAcct();
      }
    }, 3000);

    // ──────────────────────────────────────────────────────────────
    // 2) TRADING GATE — Fart Cup + Fart&Poop500 need a wallet
    // ──────────────────────────────────────────────────────────────
    // Fart Cup: wrap window.openFartCup (fartcup.js installs it late
    // and may replace it — re-wrap whenever we see an unwrapped one).
    setInterval(() => {
      const f = window.openFartCup;
      if(typeof f === 'function' && !f._fwAuthWrap){
        const orig = f;
        const wrapped = function(){
          if(tradeGated()){ window.floater?.(GATE_MSG, 'bad'); return; }
          return orig.apply(this, arguments);
        };
        wrapped._fwAuthWrap = true;
        window.openFartCup = wrapped;
      }
    }, 1500);
    // Poop500 lives inside the Poop House modal (#poopBg) — bounce it
    // shut if a gated player opens it.
    function armPoopGate(){
      const el = document.getElementById('poopBg');
      if(!el || el._fwAuthArmed) { if(!el) setTimeout(armPoopGate, 1500); return; }
      el._fwAuthArmed = true;
      new MutationObserver(() => {
        if(el.classList.contains('show') && tradeGated()){
          el.classList.remove('show');
          window.floater?.(GATE_MSG, 'bad');
        }
      }).observe(el, { attributes: true, attributeFilter: ['class'] });
    }
    armPoopGate();

    // ──────────────────────────────────────────────────────────────
    // 3) SETTINGS → ACCOUNT section (inside the ⚙ modal)
    // ──────────────────────────────────────────────────────────────
    let acctHost = null;
    function ensureAcct(){
      if(acctHost) return true;
      const bd = document.querySelector('.fw-set-card .bd');
      if(!bd) return false;
      acctHost = document.createElement('div');
      acctHost.className = 'fw-acct';
      bd.appendChild(acctHost);
      return true;
    }
    function refreshAcct(){
      if(!ensureAcct()) return;
      const wallet = A.linkedWallet || (A.provider === 'phantom' ? A.providerId : null) || window.State?.wallet || null;
      let who;
      if(A.provider === 'google')      who = '🟢 Google · <b>' + (A.email || 'signed in') + '</b>';
      else if(A.provider === 'apple')  who = '🍎 Apple · <b>' + (A.email || 'signed in') + '</b>';
      else if(A.provider === 'phantom') who = '👻 Phantom · <b>' + shortAddr(wallet) + '</b>';
      else who = '👤 Guest — sign in from the title screen';
      let html = '<div class="lbl" style="font-size:11px;font-weight:800;letter-spacing:1.2px;color:#6ed0d6;margin:0 0 8px">ACCOUNT</div>'
        + '<div class="row">' + who + '</div>';
      if(A.provider === 'google' || A.provider === 'apple'){
        if(wallet){
          html += '<div class="row">🔗 Wallet <b>' + shortAddr(wallet) + '</b>'
            + '<button class="btn unlink" id="fwAcctUnlink">Unlink</button></div>';
        } else {
          html += '<div class="row">🚫 No wallet — Fart Cup &amp; Poop500 locked'
            + '<button class="btn link" id="fwAcctLink">Connect Phantom</button></div>';
        }
      } else if(A.provider === 'phantom' && wallet){
        // Phantom-logged players never see a "connect" option — only unlink.
        html += '<div class="row">🔗 This wallet is your login'
          + '<button class="btn unlink" id="fwAcctUnlink">Unlink &amp; sign out</button></div>';
      }
      acctHost.innerHTML = html;
      acctHost.querySelector('#fwAcctLink')?.addEventListener('click', linkWallet);
      acctHost.querySelector('#fwAcctUnlink')?.addEventListener('click', unlinkWallet);
    }
    async function linkWallet(){
      const ph = window.solana || window.phantom?.solana;
      if(!ph || !ph.isPhantom){
        alert('Phantom wallet not found — install the Phantom extension first.');
        return;
      }
      try {
        const res = await ph.connect();
        const addr = res?.publicKey?.toString?.() || ph.publicKey?.toString?.();
        if(!addr) return;
        A.linkedWallet = addr;
        save();
        if(window.State){ window.State.wallet = addr; }
        try { window.saveState?.(); window.refreshFartprintBalance?.(); } catch(_){}
        window.floater?.('🔗 Phantom linked · ' + shortAddr(addr) + ' — Fart Cup & Poop500 unlocked!', 'good');
        refreshAcct();
      } catch(err){
        console.warn('[auth] link cancelled', err);
      }
    }
    function unlinkWallet(){
      if(!confirm('Unlink this wallet? Trading venues will lock again until you re-link.')) return;
      const wasPhantomLogin = A.provider === 'phantom';
      A.linkedWallet = null;
      if(wasPhantomLogin){ A.provider = null; A.providerId = null; }
      save();
      if(window.State){ window.State.wallet = null; }
      try { window.saveState?.(); } catch(_){}
      try { (window.solana || window.phantom?.solana)?.disconnect?.(); } catch(_){}
      window.floater?.('🔓 Wallet unlinked' + (wasPhantomLogin ? ' — signed out' : ''), 'good');
      refreshAcct();
    }
    // (Re)build the section whenever the settings modal opens
    function armSettings(){
      const el = document.querySelector('.fw-set-bg');
      if(!el){ setTimeout(armSettings, 1500); return; }
      if(el._fwAcctArmed) return;
      el._fwAcctArmed = true;
      new MutationObserver(() => {
        if(el.classList.contains('show')) refreshAcct();
      }).observe(el, { attributes: true, attributeFilter: ['class'] });
      refreshAcct();
    }
    armSettings();

    console.log('[auth] ready · provider=' + (A.provider || 'guest'));
  }
})();
