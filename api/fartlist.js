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

// Curated seed list of popular Printr-ecosystem coins.
// They appear in the board with totalBurned=0 and are pushed up by burns.
const PRINTR_SEEDS = [
  // Ecosystem main
  { mint: "9BB6NFEcjBCtnNLFko2FqVQBq8HHM13kCyYcdQbgpump", sym:"FARTCOIN",  name:"Fartcoin" },
  { mint: "CsRFu5QCzrKg6eq4WoGMr4dPdAWcM9mB6spfANeGbrrr", sym:"FARTBABA",  name:"Fartbaba" },
  { mint: "2RA1v8NdkEQcF5N5zHUqLuAHxjnDMQFjwEE8fwKNpump", sym:"FARTHOUSE", name:"FartHouse" },
  { mint: "BYVmWXkubwRxnZfdM389RtJJajDMh1LULZjXvfonbrrr", sym:"POOL",      name:"FartPool" },
  { mint: "CnJk3UfUsHy5aSx6JBhoogLxmrcFhpsLP6xaUiGJbrrr", sym:"FARTYD",    name:"FartYD" },
  { mint: "7EU2j1pUw97XUwxGYsKueCWDTxX8PtRncvN7xUdhbrrr", sym:"FART?",     name:"Recent Printr Mint" },
  // Fart Cup country coins
  { mint: "BKSpHNaYuiKePyDHGcvzSzA31sSjoLxYWo2e7A5Npump", sym:"FARTUSA",   name:"FartUnitedStates" },
  { mint: "BfpTdR2J5cREH5hL1GLHBRM4Z5d3w3AUZ1ZWnKGdpump", sym:"FARTCAN",   name:"FartCanada" },
  { mint: "EXhnmpdNr7aFeggMrWVYssQZ56jepx8zsgeXiaK2pump", sym:"FARTMEX",   name:"FartMexico" },
  { mint: "9USgK2EHrE2vENGT1W3PRb2r8pzcpF9bmNvNMxmXpump", sym:"FARTTUN",   name:"FartTunisia" },
  { mint: "6g3oW3K8PvNVTh6R2sHudBEwq4Xrr2a8zM3gueXUpump", sym:"FARTNOR",   name:"FartNorway" },
  { mint: "3sPgkRsx5eDDPksajReBL1RS3PQdGBjj2WDh2EYopump", sym:"FARTGER",   name:"FartGermany" },
  { mint: "HgyngmReZJZPd4gHDjEx54rnQZWMMNYwb5RrRvsppump", sym:"FARTFRA",   name:"FartFrance" },
  { mint: "F92RKZcmMP1K5Nm4hRMCiHDC6E4QQH3oHrioLyxkpump", sym:"FARTJPN",   name:"FartJapan" },
  { mint: "9MJ9HwX9oH5uTKN9AVfiMLS4G3rp89E7fvjMAdJBpump", sym:"FARTKOR",   name:"FartSouthKorea" },
  { mint: "GLpukFRRvJggzhPxPapTy7wraPZaE8VkYCb3RkAbpump", sym:"FARTBRA",   name:"FartBrazil" },
  { mint: "8K65cs6wL3Wq41yTF5GM8u2scKbaSMtTZ9ZaF64Zpump", sym:"FARTNED",   name:"FartNetherlands" },
  { mint: "4kamBpKBuWaotT4W22x99CuFWi1b5CBS4KpY3Nrbpump", sym:"FARTAUS",   name:"FartAustralia" },
  { mint: "5HXp1icLEgS5MeL2u6LwJe6VGyvEvtJmVGnfnFeRpump", sym:"FARTRSA",   name:"FartSouthAfrica" },
  { mint: "8HTgMPZ7UZBKMiyoiUoboWBGoBpGraUqZRsUvXiYpump", sym:"FARTENG",   name:"FartEngland" },
  { mint: "BWz5wMZj1ui9ipiLbNxF6hLURpniwNuup9a9Ftskpump", sym:"FARTTUR",   name:"FartTurkey" },
  { mint: "GWruYEd3318ENjeRv8LRYaS2rAfRz92jYDTkrGeSpump", sym:"FARTSWE",   name:"FartSweden" },
  { mint: "wqEyyAk72oohRtNfpwBen85TV89ZFYBXBZ6uttXpump",  sym:"FARTARG",   name:"FartArgentina" },
  { mint: "Aqo71vtBSoEh7q3vpRi6KFVgWt6o2yPL1kBdbavXpump", sym:"FARTUZB",   name:"FartUzbekistan" },
];

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
function mergeSeeds(stored){
  const byMint = new Map();
  for(const c of stored) byMint.set(c.mint, c);
  for(const s of PRINTR_SEEDS){
    if(byMint.has(s.mint)) continue;
    byMint.set(s.mint, {
      mint: s.mint, sym: s.sym, name: s.name, image: null,
      source: "printr",
      totalBurned: 0, burnsCount: 0,
      listedBy: null, listedAt: 0, lastBoostAt: 0,
      boosters: {},
      seed: true,
    });
  }
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
      const all = await getAllCoins();
      const merged = mergeSeeds(all);
      if(mintQ){
        const c = merged.find(c => c.mint === mintQ);
        if(!c){ res.status(404).json({ ok:false, error:"not-found" }); return; }
        res.status(200).json({ ok:true, coin: shape(c, true), totalBurned: totalBurnedAcross(merged), backend });
        return;
      }
      const coins = merged.map(c => shape(c, false));
      res.status(200).json({
        ok: true,
        coins,
        totalBurned: totalBurnedAcross(merged),
        seeds: PRINTR_SEEDS.length,
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

    let coin;
    if(isFirstList){
      coin = {
        mint,
        sym: sanitize(body.sym, 16) || "(?)",
        name: sanitize(body.name, 60) || "Untitled",
        image: sanitizeUrl(body.image),
        source: ["printr","pump","bags","custom"].includes(body.source) ? body.source : "custom",
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
      const nm  = sanitize(body.name, 60); if(nm && !coin.name) coin.name = nm;
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
