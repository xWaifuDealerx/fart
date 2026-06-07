// =================================================================
// tutorial.js — 5-step onboarding for new players. Steers them
// through the core economic loop: steal bike → sell, scoop sand →
// melt → fart → sell to Gary. Self-tracks step completion based on
// inventory + state changes and shows a persistent top-right card.
// =================================================================
(function(){
  'use strict';
  function whenReady(){
    if(!window.State || !window.ITEMS) { setTimeout(whenReady, 300); return; }
    init();
  }
  whenReady();

  function init(){
    const State = window.State;
    // ── State ──
    if(typeof State.tutStep !== "number") State.tutStep = 0;        // 0..5 (5 = complete)
    if(!State.tutFlags || typeof State.tutFlags !== "object") State.tutFlags = {};

    // Persistent snapshots so we can detect transitions
    let snap = {
      hadBike: (State.inventory?.bike || 0) > 0,
      hadPlasticBag: (State.inventory?.plastic_bag || 0) > 0,
      hadSandBag: (State.inventory?.sand_bag || 0) > 0,
      hadJarEmpty: (State.inventory?.jar_empty || 0) > 0,
      hadAnyFartJar: anyFartJar(),
      credits: Number(State.credits) || 0,
      paper: Number(State.paper) || 0,
    };

    function anyFartJar(){
      const inv = State.inventory || {};
      // The FFS yields ids prefixed "fartjar_" (green/blue/purple/orange/rainbow).
      for(const id of Object.keys(inv)){
        if(!id.startsWith("fartjar_")) continue;
        if((inv[id] || 0) > 0) return true;
      }
      return false;
    }
    function fartJarCount(){
      const inv = State.inventory || {};
      let c = 0;
      for(const id of Object.keys(inv)){
        if(!id.startsWith("fartjar_")) continue;
        c += Number(inv[id] || 0);
      }
      return c;
    }

    // ── Steps ──
    // Each step:
    //   title   — bold header
    //   what    — one-line objective
    //   how     — multiline button/spot hints
    //   check() — returns true once done
    const STEPS = [
      {
        title: "1. Steal Gary's bicycle, sell it at Carlos's market",
        what:  "Pinch the bike from behind Gary's pawn tent, then sell it to Carlos.",
        how: [
          "Walk north-east to Gary's tent (around <b>x=60, z=60</b>).",
          "The bike is parked behind him. Press <kbd>B</kbd> nearby to <b>ride it</b>.",
          "Ride to Carlos's marketplace (south of spawn).",
          "Talk to Carlos with <kbd>E</kbd> and <b>SELL</b> the bicycle.",
        ],
        check(){
          // Once you've had the bike (ridden it or in inventory) and
          // it's gone from both inventory AND the on-bike flag, you're
          // done. No need to dismount via the inventory click first —
          // selling to Carlos while riding works fine.
          if(snap.hadBike && (State.inventory?.bike || 0) === 0 && !State.onBike){
            return true;
          }
          return false;
        },
      },
      {
        title: "2. Buy a Plastic Bag, then fill it with sand",
        what:  "Carlos sells plastic bags. Take it to the beach and scoop sand.",
        how: [
          "Open Carlos's market (he's south-west of spawn) — press <kbd>E</kbd> near him.",
          "Buy <b>🛍 Plastic Bag</b> (a few silver).",
          "Walk to the beach — any sandy shore around the island edge works.",
          "Stand on the sand and press <kbd>G</kbd> to scoop. The bag becomes a <b>🏖 Bag of Sand</b>.",
        ],
        check(){
          return (State.inventory?.sand_bag || 0) > 0;
        },
      },
      {
        title: "3. Melt the sand into a Glass Jar at the Glassworks",
        what:  "Drop the sand at the Glassworks furnace and make an empty jar.",
        how: [
          "Walk east to the Glassworks (orange-glow building around <b>x=42, z=0</b>).",
          "Step up to the building. The proximity prompt will show.",
          "Press <kbd>E</kbd> to melt 1 sand bag into a <b>🫙 Empty Jar</b>.",
        ],
        check(){
          return (State.inventory?.jar_empty || 0) > 0;
        },
      },
      {
        title: "4. Bring the Jar to the Fart Filling Station — fart into it",
        what:  "Use the FFS to turn your empty jar into a Fart Jar.",
        how: [
          "Walk to the Fart Filling Station (north-west, around <b>x=-55, z=32</b>).",
          "Stand inside the FFS prompt range — the panel pops up bottom-left.",
          "Click the <b>Fill</b> button on the FFS panel to fart into the jar.",
          "You'll receive one of: green, blue, purple, orange, or rainbow Fart Jar.",
        ],
        check(){
          // Strictly require that the player used the FFS Fill button.
          // crafting.js sets State.tutorialFartedAtFFS on each click.
          return (Number(State.tutorialFartedAtFFS) || 0) > 0;
        },
      },
      {
        title: "5. Sell the Fart Jar to Gary at the Pawn Shop",
        what:  "Gary pays a +25% premium on Fart Jars. Cash out!",
        how: [
          "Walk back to Gary's tent (north-east, <b>x=60, z=60</b>).",
          "Talk to him with <kbd>E</kbd> — his Pawn Shop modal opens.",
          "Find your Fart Jar in his shop and click <b>Sell</b>.",
          "You finish the tutorial when the jar leaves your inventory.",
        ],
        check(){
          // hadAnyFartJar && now has fewer && credits/paper increased
          if(snap.tutorial4Done){
            const nowJars = fartJarCount();
            if(nowJars < (snap.fartJarsAtStep5 || 0)) return true;
          }
          return false;
        },
      },
    ];

    // ── Build the UI panel ──
    const css = document.createElement('style');
    css.textContent = `
.tut-card{position:fixed;top:14px;right:14px;width:min(360px,42vw);background:linear-gradient(180deg,rgba(8,18,11,.96),rgba(5,14,9,.96));border:2px solid rgba(95,240,156,.55);border-radius:14px;padding:14px 16px;z-index:60;font-family:'Outfit','Inter',sans-serif;color:#fff1c2;box-shadow:0 14px 28px rgba(0,0,0,.55);display:none;}
.tut-card.show{display:block;}
.tut-card .hdr{display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;}
.tut-card .pill{font-family:'JetBrains Mono',monospace;font-size:10.5px;color:#5ff09c;background:rgba(95,240,156,.10);border:1px solid rgba(95,240,156,.4);border-radius:100px;padding:3px 9px;letter-spacing:.6px;}
.tut-card .skip{background:transparent;color:rgba(230,255,238,.55);border:0;font-size:11px;cursor:pointer;letter-spacing:.4px;}
.tut-card .skip:hover{color:#ff7a6e;}
.tut-card h3{font-family:'Outfit',sans-serif;font-weight:800;font-size:14.5px;color:#5ff09c;margin-bottom:6px;letter-spacing:.4px;line-height:1.3;}
.tut-card .what{font-size:12px;color:#fff1c2;margin-bottom:10px;line-height:1.45;font-weight:600;}
.tut-card ol{padding-left:18px;margin:0;font-size:11.5px;color:rgba(230,255,238,.85);line-height:1.55;}
.tut-card ol li{margin-bottom:4px;}
.tut-card ol li b{color:#ffd64d;}
.tut-card kbd{background:rgba(95,240,156,.22);border:1px solid rgba(95,240,156,.55);color:#5ff09c;padding:1px 7px;border-radius:5px;font-family:monospace;font-size:11px;font-weight:700;}
.tut-card .done-strip{margin-top:10px;background:linear-gradient(90deg,#5ff09c,#a8ffd0);color:#0a1410;padding:7px 10px;border-radius:8px;font-size:11.5px;font-weight:800;text-align:center;letter-spacing:.6px;text-transform:uppercase;display:none;animation:tutPop .35s cubic-bezier(.2,.7,.4,1);}
.tut-card.done .done-strip{display:block;}
@keyframes tutPop{from{transform:scale(.85);opacity:0}to{transform:scale(1);opacity:1}}
.tut-mini{position:fixed;top:14px;right:14px;z-index:60;background:rgba(8,18,11,.92);border:1px solid rgba(95,240,156,.5);border-radius:100px;padding:6px 14px;color:#5ff09c;font-family:'Outfit','Inter',sans-serif;font-weight:700;font-size:11px;letter-spacing:1px;cursor:pointer;display:none;}
.tut-mini.show{display:block;}
`;
    document.head.appendChild(css);
    const card = document.createElement('div');
    card.className = 'tut-card';
    card.innerHTML = '<div class="hdr"><span class="pill" id="tutPill">Tutorial · 1/5</span><button class="skip" id="tutSkip">Hide</button></div><h3 id="tutTitle">—</h3><div class="what" id="tutWhat">—</div><ol id="tutHow"></ol><div style="font-size:11px;color:#ffd64d;margin-top:8px;font-weight:700;letter-spacing:.5px;">Reward: +50 \u{1F948} per step · +200 \u{1F948} bonus on completion</div><div class="done-strip" id="tutDone">✓ Task complete — next up…</div>';
    document.body.appendChild(card);
    const mini = document.createElement('button');
    mini.className = 'tut-mini';
    mini.textContent = '📖 Tutorial';
    document.body.appendChild(mini);
    let collapsed = false;
    document.getElementById('tutSkip').addEventListener('click', () => {
      collapsed = true;
      card.classList.remove('show');
      if(State.tutStep < 5) mini.classList.add('show');
    });
    mini.addEventListener('click', () => {
      collapsed = false;
      mini.classList.remove('show');
      card.classList.add('show');
    });

    function renderStep(){
      if(State.tutStep >= STEPS.length){
        card.classList.remove('show');
        mini.classList.remove('show');
        return;
      }
      if(collapsed){
        card.classList.remove('show');
        mini.classList.add('show');
      } else {
        card.classList.add('show');
        mini.classList.remove('show');
      }
      const s = STEPS[State.tutStep];
      document.getElementById('tutPill').textContent = "Tutorial · " + (State.tutStep + 1) + "/5";
      document.getElementById('tutTitle').innerHTML = s.title;
      document.getElementById('tutWhat').innerHTML = s.what;
      document.getElementById('tutHow').innerHTML = s.how.map(l => '<li>' + l + '</li>').join('');
      card.classList.remove('done');
    }
    renderStep();

    const STEP_REWARD = 50;          // silver per completed step
    const FINAL_BONUS = 200;         // extra silver on tutorial completion
    function advance(){
      const justFinishedStep = State.tutStep;     // index of the step we just completed
      State.tutStep += 1;
      // Pay the step reward
      State.credits = (Number(State.credits) || 0) + STEP_REWARD;
      window.floater?.("+" + STEP_REWARD + " \u{1F948} · step " + (justFinishedStep + 1) + " complete!", "good");
      window.playPurchaseSound?.();
      // Update the "done" strip with the reward text
      const ds = document.getElementById('tutDone');
      if(ds) ds.textContent = '✓ +' + STEP_REWARD + ' \u{1F948} earned — next up…';
      card.classList.add('done');
      window.updateHUD?.();
      window.saveState?.();
      // Brief celebration, then move on
      setTimeout(() => {
        if(State.tutStep >= STEPS.length){
          // Tutorial fully complete — pay the bonus
          State.credits = (Number(State.credits) || 0) + FINAL_BONUS;
          window.floater?.("\u{1F389} TUTORIAL DONE · +" + FINAL_BONUS + " \u{1F948} BONUS!", "good");
          window.playPurchaseSound?.();
          window.updateHUD?.();
          window.saveState?.();
          // Replace card content with a finale banner instead of hiding,
          // so the player sees the celebration.
          card.classList.remove('done');
          card.classList.add('show');
          mini.classList.remove('show');
          document.getElementById('tutPill').textContent = "Tutorial · 5/5";
          document.getElementById('tutTitle').innerHTML = "\u{1F389} TUTORIAL COMPLETE";
          document.getElementById('tutWhat').innerHTML = "You earned <b>+" + FINAL_BONUS + " \u{1F948} Silver</b> on top of the per-step rewards. Go build your printer empire!";
          document.getElementById('tutHow').innerHTML = "";
          document.getElementById('tutDone').textContent = "Thank you — happy farting";
          card.classList.add('done');
          // Auto-hide after a few seconds
          setTimeout(() => {
            card.classList.remove('show');
            mini.classList.remove('show');
          }, 6000);
        } else {
          // Initialise per-step snapshots when needed
          if(State.tutStep === 4){
            snap.tutorial4Done = true;
            snap.fartJarsAtStep5 = fartJarCount();
          }
          renderStep();
        }
      }, 1100);
    }

    // ── Snapshot updates + completion polling ──
    setInterval(() => {
      try {
        const inv = State.inventory || {};
        if((inv.bike || 0) > 0 || State.onBike) snap.hadBike = true;
        if((inv.plastic_bag || 0) > 0) snap.hadPlasticBag = true;
        if((inv.sand_bag || 0) > 0) snap.hadSandBag = true;
        if((inv.jar_empty || 0) > 0) snap.hadJarEmpty = true;
        if(anyFartJar()) snap.hadAnyFartJar = true;
        if(snap.hadBike && snap.creditsAtSellLatch === undefined){
          snap.creditsAtSellLatch = Number(State.credits) || 0;
        }
        if(State.tutStep < STEPS.length){
          const step = STEPS[State.tutStep];
          if(step.check()) advance();
        }
      } catch(e){ console.error('[tutorial] tick', e); }
    }, 1000);

    window.tutorialReset = function(){
      State.tutStep = 0;
      State.tutFlags = {};
      snap = {
        hadBike: false,
        hadPlasticBag: false,
        hadSandBag: false,
        hadJarEmpty: false,
        hadAnyFartJar: false,
        credits: Number(State.credits) || 0,
        paper: Number(State.paper) || 0,
      };
      window.saveState?.();
      renderStep();
      window.floater?.("Tutorial reset to step 1", "good");
    };

    console.log('[tutorial] ready · step', State.tutStep + 1, 'of 5');
  }
})();
