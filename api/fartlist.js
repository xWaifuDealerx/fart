// ============================================================
// api/fartlist.js — FartList backend (boost-to-rank coin board)
// ============================================================
// Anyone can:
//   • Boost an existing coin by burning ≥100 $FARTPRINT for it.
//   • First-list a brand new coin (pump.fun / bags.fm / custom) by
//     burning ≥1,000 $FARTPRINT for its mint.
//
// Coins are ranked by total $FARTPRINT burned (descending). The
// curated PRINTR_SEEDS list seeds the board with popular Printr
// coins at totalBurned=0 — they show up but sit below boosted coins.
//
//   GET  /api/fartlist
//     → { coins:[...], totalBurned, seeds:N, custom:N, backend }
//   GET  /api/fartlist?mint=X
//     → { coin:{...with full booster list}, totalBurned, backend }
//   POST /api/fartlist?kind=boost
//     body: { mint, sig, author }
//     → { ok, coin, verifiedAmount, backend }
//   POST /api/fartlist?kind=list
//     body: { mint, sig, author, name?, sym?, image?, source? }
//     → { ok, coin, verifiedAmount, backend }
//
// On-chain enforcement:
//   • The burn signature is fetched from RPC, parsed, and the burn
//     amount is extracted server-side — clients cannot inflate it.
//   • Burned mint must be $FARTPRINT (AA1G…MEaY), authority must be
//     the claimed author wallet.
//   • Each burn signature is single-use (SADD set).
// ============================================================

const KV_URL   = process.env.KV_REST_API_URL;
const KV_TOKEN = process.env.KV_REST_API_TOKEN;

const COINS_HASH = "fart_list_coins";   // mint → JSON
const SIGS_SET   = "fart_list_sigs";    // used burn sigs
const NTFY_TOPIC = "fartprint-list-v1-9k3xq";
const NTFY_BASE  = "https://ntfy.sh";

// $FARTPRINT mint — must match burns.js
const MINT = "AA1GFBvxU39PxnrCY5eiQPgsTH5vuA7zGQoxgP6LMEaY";
const MINT_DECIMALS = 6;
const ONE = 10n ** BigInt(MINT_DECIMALS);
const MIN_BOOST_TOKENS = 100;
const MIN_LIST_TOKENS  = 1000;
const MIN_BOOST_RAW = BigInt(MIN_BOOST_TOKENS) * ONE;
const MIN_LIST_RAW  = BigInt(MIN_LIST_TOKENS)  * ONE;

const RPCS = [
  "https://api.mainnet-beta.solana.com",
  "https://solana-rpc.publicnode.com",
  "https://rpc.ankr.com/solana",
];

// Curated fallback seed list of known Printr-launched coins (brrr-suffixed).
// These appear in the board with totalBurned=0 if the Printr API is unreachable.
// On every GET we also try to pull Printr's top-coins endpoint to enrich this.
const PRINTR_SEEDS = [
  { mint: "CsRFu5QCzrKg6eq4WoGMr4dPdAWcM9mB6spfANeGbrrr", sym:"FARTBABA",  name:"Fartbaba" },
  { mint: "BYVmWXkubwRxnZfdM389RtJJajDMh1LULZjXvfonbrrr", sym:"POOL",      name:"FartPool" },
  { mint: "CnJk3UfUsHy5aSx6JBhoogLxmrcFhpsLP6xaUiGJbrrr", sym:"FARTYD",    name:"FartYD" },
  { mint: "BCwvw9XJCzA8WixpMH2tjQxePZRq92vu2PAyo78obrrr", sym:"FARTSUNG",  name:"FartSung" },
  { mint: "4MXy1b8txv4uDY3bCTmtJHJ7gFdZPd9h3oT7CktKbrrr", sym:"FARTMART",  name:"FartMart" },
  { mint: "ANVebgjHnUThghDZMACZtpbeFXDiiXmLwNby6c6Kbrrr", sym:"FARTX",     name:"FartX" },
  { mint: "4A25VeiisiUeBDdYmsxMyM16kQu4EnGkqVESNcHrbrrr", sym:"FARTSFT",   name:"FartSFT" },
  { mint: "7EU2j1pUw97XUwxGYsKueCWDTxX8PtRncvN7xUdhbrrr", sym:"FART",      name:"Printr Mint" },
  { mint: "2iCTndXvsRc5XS4PgoPffg4uxnaftxp3XmsEXYSSbrrr", sym:"FART",      name:"Printr Mint" },
  { mint: "8YWLJnkiggWvuMTViFGtSfMTkRFysUuhvnhz8xJmbrrr", sym:"FART",      name:"Printr Mint" },
  { mint: "DHxKCdydJaHrgnzFJfJo4vNQv5fN8ooQXGTxfs8gbrrr", sym:"FART",      name:"Printr Mint" },
  { mint: "3XTQFSvfBkNZZ5k26xD5nHex5CUtAyC9X5ckjMFHbrrr", sym:"FART",      name:"Printr Mint" },
  { mint: "8Etxo4Z6ixYpu7kh8xgX67M5chwRkqxXwjXRi5rcbrrr", sym:"FART",      name:"Printr Mint" },
  { mint: "12519nzTv29udANTwk1RthGWcjpHaKyYunuPetmqbrrr", sym:"FART",      name:"Printr Mint" },
  { mint: "EoBaF6Kj8jSQQYzE2psw151VTkoEsmtstUQ1xZMtbrrr", sym:"FART",      name:"Printr Mint" },
  { mint: "2mDz9haqq51iFTQnHeVnABGcUCpwdVuivWEdR1SMbrrr", sym:"FART",      name:"Printr Mint" },
  { mint: "3bRN6aEr82qw95P7vVwwyFBPnN5Z3eDu9HMrtk99brrr", sym:"FART",      name:"Printr Mint" },
];

// Printr Partner Preview API (server-side, with auth JWT). Same creds as api/printr.js.
const PRINTR_BASE = "https://api-preview.printr.money/v0";
const PRINTR_JWT  = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJkYWlseSJ9.Ml8JzU5AedtwjRHAy6qZBZB4FEyc9jy5CkXsLv__nRQ";
const SOL_CAIP    = "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp";

// Auto-source detection from mint address suffix.
function inferSource(mint){
  if(typeof mint !== "string") return "custom";
  if(/pump$/i.test(mint))  return "pump";
  if(/brrr$/i.test(mint))  return "printr";
  if(/bags$/i.test(mint))  return "bags";
  if(/BAGS$/.test(mint))   return "bags";
  if(/bonk$/i.test(mint))  return "custom";
  return "custom";
}

// Pull a sane mint string out of arbitrary Printr token records.
function extractPrintrMint(t){
  if(!t || typeof t !== "object") return null;
  // Direct address fields
  const direct = t.contract_address || t.contract || t.mint || t.address || t.solana_address || t.tokenAddress;
  if(typeof direct === "string" && /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(direct)) return direct;
  // CAIP-formatted id: solana:5eykt4UsFv8P…:MINT
  const id = t.id || t.tokenId || t.token_id;
  if(typeof id === "string"){
    const last = id.split(":").pop();
    if(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(last)) return last;
  }
  // deployments[].contract_address
  if(Array.isArray(t.deployments)){
    for(const d of t.deployments){
      const a = d && (d.contract_address || d.address || d.contract);
      if(typeof a === "string" && /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(a)) return a;
    }
  }
  return null;
}

function extractPrintrCoin(t){
  const mint = extractPrintrMint(t);
  if(!mint) return null;
  // Skip the $FARTPRINT mint itself — never boost ourselves
  if(mint === MINT) return null;
  return {
    mint,
    sym: t.symbol || t.ticker || t.sym || "(?)",
    name: t.name || "",
    image: t.image_url || t.image || t.imageUrl || t.logo || null,
    source: inferSource(mint),
  };
}

// Module-level cache of the Printr top-coins fetch (5 min TTL).
// Cold starts will re-fetch; warm starts reuse.
let _printrCache = { coins: [], at: 0 };
const PRINTR_CACHE_TTL = 5 * 60 * 1000;

async function fetchPrintrTopCoins(){
  const candidates = [
    "/tokens?limit=100",
    "/tokens",
    "/tokens/popular?limit=100",
    "/tokens?popular=true&limit=100",
    "/tokens?sort=popular&limit=100",
    "/tokens?sort=mcap&limit=100",
    "/tokens/trending?limit=100",
    "/leaderboard?limit=100",
    "/tokens/leaderboard?limit=100",
    "/projects?limit=100",
  ];
  const headers = { Authorization: "Bearer " + PRINTR_JWT, Accept: "application/json" };
  for(const path of candidates){
    try {
      const ctrl = new AbortController();
      const tt = setTimeout(()=>ctrl.abort(), 4000);
      const r = await fetch(PRINTR_BASE + path, { headers, signal: ctrl.signal });
      clearTimeout(tt);
      if(!r.ok) continue;
      const j = await r.json();
      const arr = Array.isArray(j) ? j : (j.tokens || j.data || j.results || j.items || j.projects || j.coins);
      if(!Array.isArray(arr) || arr.length === 0) continue;
      const coins = arr.map(extractPrintrCoin).filter(Boolean);
      if(coins.length > 0) return coins;
    } catch(_){ /* try next */ }
  }
  return [];
}

async function getPrintrTopCoins(){
  const now = Date.now();
  if(_printrCache.coins.length > 0 && (now - _printrCache.at) < PRINTR_CACHE_TTL){
    return _printrCache.coins;
  }
  try {
    const coins = await fetchPrintrTopCoins();
    if(coins.length > 0){
      _printrCache = { coins, at: now };
    } else if(_printrCache.coins.length === 0){
      // Mark even an empty result so we don't hammer the API on every request
      _printrCache.at = now;
    }
  } catch(_){}
  return _printrCache.coins;
}

// ---- Bags.fm top coins -------------------------------------------------
// Mirrors the Printr fetch pattern — best-effort discovery against a list
// of likely endpoints. The API key + user UUID live in api/bags.js too.
const BAGS_API_KEY    = "bags_prod_4CFspFz1h5xt8jH0jyOJTyu2Dlclu4c1u1Y4CqrmJxw";
const BAGS_USER_UUID  = "2737eeee-d1b1-4caa-a93e-476b97f2619a";
const BAGS_BASES = [
  "https://public-api-v2.bags.fm/api/v1",
  "https://public-api.bags.fm/api/v1",
  "https://api.bags.fm/v1",
  "https://api.bags.fm",
  "https://www.bags.fm/api/v1",
];
let _bagsCache = { coins: [], at: 0 };

function extractBagsCoin(t){
  const mint = extractPrintrMint(t); // same heuristic — mint/address/contract/CAIP
  if(!mint) return null;
  if(mint === MINT) return null;
  return {
    mint,
    sym: t.symbol || t.ticker || t.sym || "(?)",
    name: t.name || t.title || "",
    image: t.image_url || t.image || t.imageUrl || t.logo || t.icon || null,
    source: "bags",
  };
}

async function fetchBagsTopCoins(){
  // UUID-scoped + global endpoints. First successful list wins.
  const paths = [
    "/tokens?limit=100",
    "/tokens",
    "/tokens/popular?limit=100",
    "/tokens/trending?limit=100",
    "/tokens/feed?limit=100",
    "/explore/tokens?limit=100",
    "/explore?limit=100",
    "/leaderboard?limit=100",
    `/users/${BAGS_USER_UUID}/tokens?limit=100`,
    `/users/${BAGS_USER_UUID}/tokens`,
    `/users/${BAGS_USER_UUID}/feed`,
  ];
  const headers = {
    "x-api-key":     BAGS_API_KEY,
    "Authorization": "Bearer " + BAGS_API_KEY,
    "x-user-id":     BAGS_USER_UUID,
    "Accept":        "application/json",
  };
  for(const base of BAGS_BASES){
    for(const path of paths){
      try {
        const ctrl = new AbortController();
        const tt = setTimeout(()=>ctrl.abort(), 4000);
        const r = await fetch(base + path, { headers, signal: ctrl.signal });
        clearTimeout(tt);
        if(!r.ok) continue;
        const j = await r.json();
        const arr = Array.isArray(j) ? j : (j.tokens || j.data || j.results || j.items || j.feed || j.coins);
        if(!Array.isArray(arr) || arr.length === 0) continue;
        const coins = arr.map(extractBagsCoin).filter(Boolean);
        if(coins.length > 0){
          // Stash the winning base+path for diagnostics on cold start logs
          console.log("[fartlist] bags ok:", base + path, "→", coins.length, "coins");
          return coins;
        }
      } catch(_){ /* try next */ }
    }
  }
  return [];
}

async function getBagsTopCoins(){
  const now = Date.now();
  if(_bagsCache.coins.length > 0 && (now - _bagsCache.at) < PRINTR_CACHE_TTL){
    return _bagsCache.coins;
  }
  try {
    const coins = await fetchBagsTopCoins();
    if(coins.length > 0){
      _bagsCache = { coins, at: now };
    } else if(_bagsCache.coins.length === 0){
      _bagsCache.at = now;
    }
  } catch(_){}
  return _bagsCache.coins;
}

const hasKV = () => !!(KV_URL && KV_TOKEN);

// --- KV helper ----------------------------------------------------------
async function kv(command){
  const r = await fetch(KV_URL, {
    method: "POST",
    headers: { Authorization: "Bearer " + KV_TOKEN, "Content-Type": "application/json" },
    body: JSON.stringify(command),
  });
  let j = null;
  try { j = await r.json(); } catch(_){}
  if(!r.ok) throw new Error("KV HTTP " + r.status + (j && j.error ? " — " + j.error : ""));
  if(j && j.error) throw new Error("KV error — " + j.error);
  return j ? j.result : null;
}

// --- read body ----------------------------------------------------------
async function readBody(req){
  if(req.body){
    if(typeof req.body === "object") return req.body;
    if(typeof req.body === "string"){ try { return JSON.parse(req.body); } catch(_){ return null; } }
  }
  try {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const raw = Buffer.concat(chunks).toString("utf8").trim();
    return raw ? JSON.parse(raw) : null;
  } catch(_){ return null; }
}

// --- validation ---------------------------------------------------------
function isSolMint(s){
  if(typeof s !== "string") return false;
  if(s.length < 32 || s.length > 44) return false;
  return /^[1-9A-HJ-NP-Za-km-z]+$/.test(s);
}
const isWallet = isSolMint;
function sanitize(s, max){
  if(typeof s !== "string") return "";
  return s.replace(/[\x00-\x1f<>]/g, "").trim().slice(0, max || 80);
}
function sanitizeUrl(s){
  if(typeof s !== "string") return "";
  s = s.trim();
  if(!/^https?:\/\//i.test(s)) return "";
  if(s.length > 500) return "";
  return s;
}

// --- coin store ---------------------------------------------------------
async function getCoin(mint){
  if(hasKV()){
    const raw = await kv(["HGET", COINS_HASH, mint]);
    if(!raw) return null;
    try { return JSON.parse(raw); } catch(_){ return null; }
  }
  const all = await getAllCoinsNtfy();
  return all.find(c => c.mint === mint) || null;
}
async function setCoin(c){
  if(hasKV()){
    await kv(["HSET", COINS_HASH, c.mint, JSON.stringify(c)]);
    return c;
  }
  await fetch(`${NTFY_BASE}/${NTFY_TOPIC}`, {
    method: "POST",
    body: JSON.stringify(c),
    headers: { "Title": "fartlist", "Tags": "coin" }
  });
  return c;
}
async function getAllCoins(){
  if(hasKV()){
    const vals = await kv(["HVALS", COINS_HASH]) || [];
    const out = [];
    for(const v of vals){ try { const c = JSON.parse(v); if(c && c.mint) out.push(c); } catch(_){} }
    return out;
  }
  return getAllCoinsNtfy();
}
async function getAllCoinsNtfy(){
  try {
    const r = await fetch(`${NTFY_BASE}/${NTFY_TOPIC}/json?poll=1&since=all`);
    const text = await r.text();
    const lines = text.split("\n").filter(Boolean);
    const latest = new Map();
    for(const line of lines){
      try {
        const m = JSON.parse(line);
        const c = m.message ? JSON.parse(m.message) : null;
        if(!c || !c.mint) continue;
        latest.set(c.mint, c); // last write wins
      } catch(_){}
    }
    return Array.from(latest.values());
  } catch(_){ return []; }
}

// --- sig dedupe ---------------------------------------------------------
async function reserveSig(sig){
  if(hasKV()){
    const added = await kv(["SADD", SIGS_SET, sig]);
    return Number(added) === 1;
  }
  // ntfy fallback: scan coins for the sig
  const all = await getAllCoinsNtfy();
  return !all.some(c => c && c.boostSigs && c.boostSigs.includes(sig));
}

// --- on-chain burn verification ----------------------------------------
// Returns:
//   { ok:true,  rawAmount:BigInt, online:true }   ← burn verified
//   { ok:false, online:true,  reason }            ← tx loaded, no qualifying burn
//   { ok:null,  online:false }                    ← RPCs unreachable
async function verifyBurnAmount(sig, author){
  for(const rpc of RPCS){
    try {
      const r = await fetch(rpc, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0", id: 1, method: "getTransaction",
          params: [sig, { encoding: "jsonParsed", maxSupportedTransactionVersion: 0, commitment: "confirmed" }],
        }),
      });
      if(!r.ok) continue;
      const j = await r.json();
      const tx = j && j.result;
      if(!tx) continue;
      const groups = [];
      const msg = tx.transaction && tx.transaction.message;
      if(msg && Array.isArray(msg.instructions)) groups.push(msg.instructions);
      const inner = tx.meta && tx.meta.innerInstructions;
      if(Array.isArray(inner)) for(const ig of inner) if(Array.isArray(ig.instructions)) groups.push(ig.instructions);
      let bestRaw = 0n;
      for(const ixs of groups){
        for(const ix of ixs){
          const p = ix && ix.parsed;
          if(!p) continue;
          if((p.type === "burn" || p.type === "burnChecked") && (ix.program === "spl-token" || ix.program === "spl-token-2022")){
            const info = p.info || {};
            if(info.mint !== MINT) continue;
            if(author && info.authority !== author && info.owner !== author) continue;
            let raw = null;
            try {
              if(info.tokenAmount && info.tokenAmount.amount != null){
                raw = BigInt(String(info.tokenAmount.amount));
              } else if(info.amount != null){
                raw = BigInt(String(info.amount));
              }
            } catch(_){}
            if(raw != null && raw > bestRaw) bestRaw = raw;
          }
        }
      }
      if(bestRaw > 0n) return { ok:true, rawAmount: bestRaw, online:true };
      return { ok:false, online:true, reason:"no-fartprint-burn" };
    } catch(_){}
  }
  return { ok:null, online:false };
}

// --- seed merge ---------------------------------------------------------
// Combines: KV-stored boosted coins → curated PRINTR_SEEDS → live Printr API → live Bags API.
// Stored coins always win; seeds fill gaps; API discoveries fill more gaps.
function mergeSeeds(stored, printrTop, bagsTop){
  const byMint = new Map();
  for(const c of stored) byMint.set(c.mint, c);
  const addIfNew = (s, source) => {
    if(!s || !s.mint || byMint.has(s.mint)) return;
    if(s.mint === MINT) return; // never list $FARTPRINT itself
    byMint.set(s.mint, {
      mint: s.mint,
      sym: s.sym || "(?)",
      name: s.name || "",
      image: s.image || null,
      source: source || s.source || inferSource(s.mint),
      totalBurned: 0, burnsCount: 0,
      listedBy: null, listedAt: 0, lastBoostAt: 0,
      boosters: {},
      seed: true,
    });
  };
  for(const s of PRINTR_SEEDS) addIfNew(s, "printr");
  for(const s of (printrTop || [])) addIfNew(s, "printr");
  for(const s of (bagsTop || []))   addIfNew(s, "bags");
  return Array.from(byMint.values());
}

// --- shape for response (top boosters, no raw maps) ---------------------
function shape(c, includeAllBoosters){
  const boostersObj = c.boosters || {};
  const entries = Object.entries(boostersObj)
    .map(([w,a])=> [w, Number(a)||0])
    .filter(([,a])=> a > 0)
    .sort((a,b)=> b[1] - a[1]);
  const topBoosters = entries.slice(0, includeAllBoosters ? 200 : 10)
    .map(([wallet, amount])=> ({ wallet, amount }));
  return {
    mint: c.mint,
    sym: c.sym || "",
    name: c.name || "",
    image: c.image || null,
    source: c.source || "custom",
    totalBurned: Number(c.totalBurned) || 0,
    burnsCount: Number(c.burnsCount) || 0,
    boostersCount: entries.length,
    listedBy: c.listedBy || null,
    listedAt: c.listedAt || 0,
    lastBoostAt: c.lastBoostAt || 0,
    topBoosters,
    seed: !!c.seed,
  };
}

function totalBurnedAcross(coins){
  return coins.reduce((s,c)=> s + (Number(c.totalBurned)||0), 0);
}

// --- handler ------------------------------------------------------------
export default async function handler(req, res){
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "content-type");
  if(req.method === "OPTIONS") { res.status(204).end(); return; }

  const backend = hasKV() ? "kv" : "ntfy";

  try {
    if(req.method === "GET"){
      const url = new URL(req.url, "http://x");
      const mintQ = url.searchParams.get("mint");
      // Run KV fetch + both API fetches in parallel
      const [all, printrTop, bagsTop] = await Promise.all([
        getAllCoins(),
        getPrintrTopCoins(),
        getBagsTopCoins(),
      ]);
      const merged = mergeSeeds(all, printrTop, bagsTop);
      if(mintQ){
        const c = merged.find(c => c.mint === mintQ);
        if(!c){ res.status(404).json({ ok:false, error:"not-found" }); return; }
        res.status(200).json({ ok:true, coin: shape(c, true), totalBurned: totalBurnedAcross(merged), backend });
        return;
      }
      const coins = merged.map(c => shape(c, false));
      const seedCount = PRINTR_SEEDS.length + (printrTop ? printrTop.length : 0) + (bagsTop ? bagsTop.length : 0);
      res.status(200).json({
        ok: true,
        coins,
        totalBurned: totalBurnedAcross(merged),
        seeds: seedCount,
        printrApi: printrTop ? printrTop.length : 0,
        bagsApi:   bagsTop   ? bagsTop.length   : 0,
        custom: merged.filter(c => !c.seed).length,
        minBoostTokens: MIN_BOOST_TOKENS,
        minListTokens: MIN_LIST_TOKENS,
        backend,
      });
      return;
    }

    if(req.method !== "POST"){
      res.status(405).json({ ok:false, error:"method-not-allowed" }); return;
    }

    const url = new URL(req.url, "http://x");
    const kind = url.searchParams.get("kind");
    const body = await readBody(req);
    if(!body || typeof body !== "object"){
      res.status(400).json({ ok:false, error:"bad-body" }); return;
    }

    const mint = body.mint;
    const sig  = typeof body.sig === "string" ? body.sig.trim() : "";
    const author = body.author;

    if(!isSolMint(mint)){ res.status(400).json({ ok:false, error:"bad-mint" }); return; }
    if(!isWallet(author)){ res.status(400).json({ ok:false, error:"bad-author" }); return; }
    if(!sig || sig.length < 32 || sig.length > 200){ res.status(400).json({ ok:false, error:"bad-sig" }); return; }

    // Reject a wallet trying to burn FARTPRINT against the FARTPRINT mint (degenerate)
    if(mint === MINT){ res.status(400).json({ ok:false, error:"cant-boost-fartprint" }); return; }

    // Verify the burn first (might fail). Do not consume sig on a non-qualifying tx.
    const v = await verifyBurnAmount(sig, author);
    if(v.ok === false){
      res.status(400).json({ ok:false, error:"burn-not-found", message:"That transaction isn't a $FARTPRINT burn from your wallet." });
      return;
    }
    // v.ok === null means RPCs unreachable — we accept (treat amount as min requested)
    // v.ok === true means we have a verified rawAmount

    // Determine if this is a first-listing or a boost
    const existing = await getCoin(mint);
    const isFirstList = !existing;
    const minRaw = isFirstList ? MIN_LIST_RAW : MIN_BOOST_RAW;
    const minTokens = isFirstList ? MIN_LIST_TOKENS : MIN_BOOST_TOKENS;

    let rawAmount = v.rawAmount;
    if(!rawAmount){
      // RPC unreachable; we cannot enforce a minimum on-chain, so we trust
      // the client's claim of the bare minimum and flag it unverified.
      rawAmount = minRaw;
    }
    if(rawAmount < minRaw){
      res.status(400).json({
        ok:false, error:"under-minimum",
        message: `Need to burn at least ${minTokens.toLocaleString()} $FARTPRINT (you burned ${(Number(rawAmount) / Number(ONE)).toLocaleString()}).`,
      });
      return;
    }

    // Reserve the sig — single use ever.
    const fresh = await reserveSig(sig);
    if(!fresh){
      res.status(409).json({ ok:false, error:"sig-reused", message:"That burn signature has already been counted." });
      return;
    }

    const now = Date.now();
    const amountTokens = Number(rawAmount) / Number(ONE);

    // Authoritative source from mint suffix — clients can't fake this.
    const suffixSource = inferSource(mint);
    // Allow client to override only if the suffix is ambiguous (no pump/brrr suffix)
    const clientSource = ["printr","pump","bags","custom"].includes(body.source) ? body.source : "custom";
    const finalSource = (suffixSource !== "custom") ? suffixSource : clientSource;

    let coin;
    if(isFirstList){
      coin = {
        mint,
        sym: sanitize(body.sym, 16) || "(?)",
        name: sanitize(body.name, 60) || "Untitled",
        image: sanitizeUrl(body.image),
        source: finalSource,
        totalBurned: amountTokens,
        burnsCount: 1,
        listedBy: author,
        listedAt: now,
        lastBoostAt: now,
        boosters: { [author]: amountTokens },
        verified: v.ok === true,
      };
    } else {
      coin = { ...existing };
      coin.boosters = coin.boosters && typeof coin.boosters === "object" ? { ...coin.boosters } : {};
      coin.boosters[author] = (Number(coin.boosters[author])||0) + amountTokens;
      coin.totalBurned = (Number(coin.totalBurned)||0) + amountTokens;
      coin.burnsCount = (Number(coin.burnsCount)||0) + 1;
      coin.lastBoostAt = now;
      // If a seed-only coin is getting its first real boost, optionally set listedBy
      if(!coin.listedBy){ coin.listedBy = author; coin.listedAt = now; }
      // Allow client to fill in missing image/sym/name (helpful for seeds)
      const img = sanitizeUrl(body.image); if(img && !coin.image) coin.image = img;
      const sym = sanitize(body.sym, 16); if(sym && (!coin.sym || coin.sym === "(?)" || coin.sym === "FART?")) coin.sym = sym;
      const nm  = sanitize(body.name, 60); if(nm && (!coin.name || coin.name === "Printr Mint")) coin.name = nm;
      // Pin source to whatever the mint suffix says — fixes any stale tag.
      if(suffixSource !== "custom") coin.source = suffixSource;
    }

    await setCoin(coin);
    res.status(200).json({
      ok: true,
      coin: shape(coin, false),
      verifiedAmount: amountTokens,
      verified: v.ok === true,
      kind: isFirstList ? "list" : "boost",
      backend,
    });

  } catch(e){
    console.error("fartlist error", e);
    res.status(500).json({ ok:false, error: String((e && e.message) || e) });
  }
}
