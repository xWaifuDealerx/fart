# 🛝 FART SLIDE — asset prompts, audio, and how it all hooks up

`slide.js` ships with **fully procedural** geometry, so the level works the
moment you drop the file in. Everything below is **optional polish**: swap the
procedural meshes for real `.glb` models and add music whenever you want.

---

## 1. How the module is wired (already done)

* `fartworld.html` now loads `slide.js?v=1` alongside the other side files.
* The main render loop got one tiny guard:
  `if (window.fwSlideActive){ requestAnimationFrame(loop); return; }`
  — while the slide runs, the main game parks itself and the slide draws on its
  own canvas/scene/renderer on top. Nothing else in the game is touched.
* The portal auto-spawns on the **beach shoreline** of the main island.
* Walk into it → green fart-cloud + screen-shake + whoosh → slide level.
* Finish → fireworks + multiplier → green return portal → back to the beach
  with a victory fart explosion + **Silver & XP** rewarded.
* Bail any time with **Esc**. Debug-enter from the console with
  `window.fwEnterSlide()`.

**Controls:** `A`/`D` or `←`/`→` steer · hold `Space` to boost · `Esc` exits.

---

## 2. Where to plug real `.glb` models in

Each builder in `slide.js` is isolated so you can replace its body with a
`GLTFLoader` load and keep the rest of the physics/camera identical:

| Builder function | Replace with GLB | Notes for the modeller |
|---|---|---|
| `buildSled()` | `sled.glb` | Origin at the seat; +Z = forward, +Y = up. ~3 m long. |
| `buildSlideRibbon()` | keep procedural **or** tile `slide_segment.glb` along the spline | Model should be a **1-unit-long road tile** so it can be instanced per spline sample. |
| `portal` group (Part 1) + `buildFinish()` return portal | `portal.glb` | Ring ~5 m across, flat membrane in the XY plane, +Z faces the player. |
| `buildBaldurStatue()` | `baldur_statue.glb` | Big hero-pose statue on a rock island; glowing green eyes. |
| central log in `buildSlideWorld()` | `giant_log.glb` | Tall tapered trunk, ~240 m, green veins, leafy crown. |

To load one, add near the top of `init()`:

```js
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'; // if you make slide.js a module
// or load the UMD loader via a <script> and use new THREE.GLTFLoader()
const loader = new THREE.GLTFLoader();
loader.load('assets/sled.glb', g => { /* g.scene → use instead of buildSled() */ });
```

---

## 3. EXACT prompts for generating the `.glb` assets

Paste these into a text-to-3D tool (Meshy, Luma Genie, Tripo, Rodin, etc.).
All are written for a **low-poly cartoon** look with vibrant colors.

### 🛝 Slide track segment — `slide_segment.glb`
> Low-poly cartoon wooden slide track segment, a smooth curved half-pipe chute
> made of glossy honey-brown wooden planks, with raised side rails glowing
> bright toxic-green, thin glowing green energy veins running along the inner
> surface, vibrant saturated colors, stylized Mario-64-meets-Fortnite art style,
> clean topology, seamless tileable ends so segments connect, no background,
> centered, +Z forward. PBR, game-ready, under 3k triangles.

### 🫛 Fart-bean sled — `sled.glb`
> Low-poly cartoon rideable sled shaped like a giant glowing green jelly bean,
> glossy lime-green translucent surface with a bright emissive core, a small
> saddle seat on top, little fart-jet nozzles at the back, cute and bouncy,
> vibrant saturated colors, stylized meme game art, seat origin at center, +Z
> forward, +Y up, about 3 meters long. PBR, game-ready, under 4k triangles.

### 🌀 Green fart portal — `portal.glb`
> Low-poly cartoon magic portal, a thick circular stone-and-wood ring about 5
> meters across glowing intense toxic-green, swirling translucent green energy
> membrane filling the center, floating green spark particles, dramatic emissive
> glow, vibrant cartoon style, ring stands upright, membrane in the XY plane,
> +Z faces viewer, no background. PBR, game-ready, under 3k triangles.

### 🗿 Fart Fart Baldur statue — `baldur_statue.glb`
> Low-poly cartoon colossal hero statue standing on a floating chunk of grassy
> rock, carved weathered grey stone, heroic pose with one arm raised to the sky,
> oversized round head, glowing bright-green eyes, moss and green energy veins on
> the stone, epic and imposing, vibrant stylized game art, statue centered and
> upright, no background. PBR, game-ready, under 6k triangles.

### 🌳 Giant floating log / tree — `giant_log.glb`
> Low-poly cartoon colossal floating tree, a massive tapered wooden trunk roughly
> 240 meters tall with chunky bark, thick glowing toxic-green energy veins
> climbing up the trunk, gnarled root ball at the base, big fluffy stylized
> green leaf-clusters crowning the top, dreamy fantasy game art, vibrant
> saturated colors, vertical, base at origin, no background. Game-ready, LOD-friendly.

### (Bonus) Collectibles — `fartcoin.glb`, `skibidi_orb.glb`, `gyatt_gem.glb`
> Low-poly cartoon collectible coin, glossy gold disc stamped with a tiny green
> fart-cloud emboss, bright emissive rim, vibrant, spinning game pickup, centered,
> no background. (Repeat with: glowing cyan toilet-shaped Skibidi orb; faceted
> hot-pink crystal Gyatt gem.) Game-ready, under 1k triangles each.

---

## 4. Background music — upbeat chaotic brainrot remix

The slide already synthesizes a **whoosh** on entry via WebAudio (no asset). For
the looping track, add an `<audio>` element and start it when the slide opens.

**Step 1 — drop a file** (e.g. `assets/brainrot_loop.mp3`). A good prompt for an
AI music tool (Suno / Udio):

> Upbeat chaotic hyperpop brainrot remix, 160 BPM, glitchy phonk bass, sped-up
> meme vocal chops, airhorns, "skibidi" stutters, cartoonish fart bass drops,
> euphoric arcade racing energy, seamless loop, instrumental-leaning, high energy.

**Step 2 — wire it up.** Add this to the `startSlide()` / `exitSlide()` flow
(or just paste the snippet below into the console to test):

```js
// once, e.g. in init():
const slideMusic = new Audio('assets/brainrot_loop.mp3');
slideMusic.loop = true;
slideMusic.volume = 0.5;

// in startSlide():  slideMusic.currentTime = 0; slideMusic.play().catch(()=>{});
// in exitSlide():   slideMusic.pause();
```

> ⚠️ Browsers block autoplay until a user gesture. Since the player **walks into
> the portal** (a keypress/click happened), `play()` will be allowed. If you ever
> trigger the slide without a gesture, call `slideMusic.play()` from the first
> keydown instead.

**Optional dynamic mix:** raise `slideMusic.playbackRate` slightly with speed for
extra chaos — `slideMusic.playbackRate = 1 + (RUN.v / CFG.maxSpeed) * 0.15;`

---

## 5. Tuning cheat-sheet (top of `slide.js`, the `CFG` object)

| Knob | Effect |
|---|---|
| `gravity` | how hard downhills accelerate you |
| `boostAccel` | Space-boost strength |
| `maxSpeed` / `minSpeed` | speed clamp |
| `steerRate` / `steerReturn` | steering responsiveness / auto-centering |
| `trackHalfWidth` / `fallLimit` | track width and how far you can drift before falling |
| `silverReward` / `distanceScore` | payout + scoring rate |

Make the slide longer by raising `TURNS` / `TOP_Y` in `buildSlideWorld()`.
