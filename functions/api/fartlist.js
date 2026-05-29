// ============================================================
// functions/api/fartlist.js — FartList backend (boost-to-rank coin board)
// ============================================================
//   GET  /api/fartlist               → list
//   GET  /api/fartlist?mint=X        → one coin (with full booster list)
//   POST /api/fartlist?kind=boost    → boost (≥100 $FARTPRINT)
//   POST /api/fartlist?kind=list     → first-list (≥1,000 $FARTPRINT)
// ============================================================

const COINS_HASH = "fart_list_coins";
const SIGS_SET   = "fart_list_sigs";
const NTFY_TOPIC = "fartprint-list-v1-9k3xq";
const NTFY_BASE  = "https://ntfy.sh";

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

const PRINTR_SEEDS = [
  { mint: "CsRFu5QCzrKg6eq4WoGMr4dPdAWcM9mB6spfANeGbrrr", sym: "FARTBABA", name: "Fartbaba" },
  { mint: "BYVmWXkubwRxnZfdM389RtJJajDMh1LULZjXvfonbrrr", sym: "POOL",     name: "FartPool" },
  { mint: "CnJk3UfUsHy5aSx6JBhoogLxmrcFhpsLP6xaUiGJbrrr", sym: "FARTYD",   name: "FartYD" },
  { mint: "BCwvw9XJCzA8WixpMH2tjQxePZRq92vu2PAyo78obrrr", sym: "FARTSUNG", name: "FartSung" },
  { mint: "4MXy1b8txv4uDY3bCTmtJHJ7gFdZPd9h3oT7CktKbrrr", sym: "FARTMART", name: "FartMart" },
  { mint: "ANVebgjHnUThghDZMACZtpbeFXDiiXmLwNby6c6Kbrrr", sym: "FARTX",    name: "FartX" },
  { mint: "4A25VeiisiUeBDdYmsxMyM16kQu4EnGkqVESNcHrbrrr", sym: "FARTSFT",  name: "FartSFT" },
  { mint: "7EU2j1pUw97XUwxGYsKueCWDTxX8PtRncvN7xUdhbrrr", sym: "FART",     name: "Printr Mint" },
  { mint: "2iCTndXvsRc5XS4PgoPffg4uxnaftxp3XmsEXYSSbrrr", sym: "FART",     name: "Printr Mint" },
  { mint: "8YWLJnkiggWvuMTViFGtSfMTkRFysUuhvnhz8xJmbrrr", sym: "FART",     name: "Printr Mint" },
  { mint: "DHxKCdydJaHrgnzFJfJo4vNQv5fN8ooQXGTxfs8gbrrr", sym: "FART",     name: "Printr Mint" },
  { mint: "3XTQFSvfBkNZZ5k26xD5nHex5CUtAyC9X5ckjMFHbrrr", sym: "FART",     name: "Printr Mint" },
  { mint: "8Etxo4Z6ixYpu7kh8xgX67M5chwRkqxXwjXRi5rcbrrr", sym: "FART",     name: "Printr Mint" },
  { mint: "12519nzTv29udANTwk1RthGWcjpHaKyYunuPetmqbrrr", sym: "FART",     name: "Printr Mint" },
  { mint: "EoBaF6Kj8jSQQYzE2psw151VTkoEsmtstUQ1xZMtbrrr", sym: "FART",     name: "Printr Mint" },
  { mint: "2mDz9haqq51iFTQnHeVnABGcUCpwdVuivWEdR1SMbrrr", sym: "FART",     name: "Printr Mint" },
  { mint: "3bRN6aEr82qw95P7vVwwyFBPnN5Z3eDu9HMrtk99brrr", sym: "FART",     name: "Printr Mint" },
];

const PRINTR_BASE = "https://api-preview.printr.money/v0";
const PRINTR_JWT  = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJkYXJrc3UifQ.Oij3d5eNtIdcQ4fSUKIgZg-KKxtW-qHumOEVb95_aU0";
const SOL_CAIP    = "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp";
const PRINTR_TELECOIN_IDS = [
  "0xa8a31cf9c7754ea3a7de3dc9ccf65cc919d3064eccb6046627061f7f85bd3df6",
  "0xd1f813e670765bf55d92f981a4f1cee55c82d1a6751eb6209bac191f8337a0b4",
];

const BAGS_API_KEY   = "bags_prod_4CFspFz1h5xt8jH0jyOJTyu2Dlclu4c1u1Y4CqrmJxw";
const BAGS_USER_UUID = "2737eeee-d1b1-4caa-a93e-476b97f2619a";
const BAGS_BASES = [
  "https://public-api-v2.bags.fm/api/v1",
  "https://public-api.bags.fm/api/v1",
  "https://api.bags.fm/v1",
  "https://api.bags.fm",
  "https://www.bags.fm/api/v1",
];

// Module-level caches (5 min TTL). Warm starts reuse; cold starts re-fetch.
let _printrCache = { coins: [], at: 0 };
let _bagsCache   = { coins: [], at: 0 };
const PRINTR_CACHE_TTL = 5 * 60 * 1000;

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
}
async function readBody(request) { try { return await request.json(); } catch { return null; } }

function isSolMint(s) {
  if (typeof s !== "string") return false;
  if (s.length < 32 || s.length > 44) return false;
  return /^[1-9A-HJ-NP-Za-km-z]+$/.test(s);
}
const isWallet = isSolMint;

function sanitize(s, max) {
  if (typeof s !== "string") return "";
  return s.replace(/[\x00-\x1f<>]/g, "").trim().slice(0, max || 80);
}
function sanitizeUrl(s) {
  if (typeof s !== "string") return "";
  s = s.trim();
  if (!/^https?:\/\//i.test(s)) return "";
  if (s.length > 500) return "";
  return s;
}

function inferSource(mint) {
  if (typeof mint !== "string") return "custom";
  if (/pump$/i.test(mint)) return "pump";
  if (/brrr$/i.test(mint)) return "printr";
  if (/bags$/i.test(mint)) return "bags";
  if (/BAGS$/.test(mint))  return "bags";
  if (/bonk$/i.test(mint)) return "custom";
  return "custom";
}

function extractPrintrMint(t) {
  if (!t || typeof t !== "object") return null;
  const direct = t.contract_address || t.contract || t.mint || t.address || t.solana_address || t.tokenAddress;
  if (typeof direct === "string" && /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(direct)) return direct;
  const id = t.id || t.tokenId || t.token_id;
  if (typeof id === "string") {
    const last = id.split(":").pop();
    if (/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(last)) return last;
  }
  if (Array.isArray(t.deployments)) {
    for (const d of t.deployments) {
      const a = d && (d.contract_address || d.address || d.contract);
      if (typeof a === "string" && /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(a)) return a;
    }
  }
  return null;
}

function extractPrintrCoin(t) {
  const mint = extractPrintrMint(t);
  if (!mint || mint === MINT) return null;
  return {
    mint,
    sym: t.symbol || t.ticker || t.sym || "(?)",
    name: t.name || "",
    image: t.image_url || t.image || t.imageUrl || t.logo || null,
    source: inferSource(mint),
  };
}
function extractBagsCoin(t) {
  const mint = extractPrintrMint(t);
  if (!mint || mint === MINT) return null;
  return {
    mint,
    sym: t.symbol || t.ticker || t.sym || "(?)",
    name: t.name || t.title || "",
    image: t.image_url || t.image || t.imageUrl || t.logo || t.icon || null,
    source: "bags",
  };
}

async function resolvePrintrToken(id) {
  try {
    const ctrl = new AbortController();
    const tt = setTimeout(() => ctrl.abort(), 4000);
    const r = await fetch(PRINTR_BASE + "/tokens/" + encodeURIComponent(id), {
      headers: { Authorization: "Bearer " + PRINTR_JWT, Accept: "application/json" },
      signal: ctrl.signal,
    });
    clearTimeout(tt);
    if (!r.ok) return null;
    const j = await r.json();
    if (!j || typeof j !== "object") return null;
    let mint = extractPrintrMint(j);
    if (!mint) {
      const chains = j.chains || [];
      for (const c of chains) {
        if (typeof c === "string") {
          const last = c.split(":").pop();
          if (/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(last)) mint = last;
        }
      }
    }
    if (!mint || mint === MINT) return null;
    return {
      mint,
      sym: j.symbol || "(?)",
      name: j.name || "",
      image: j.imageUrl || j.image_url || null,
      source: "printr",
    };
  } catch { return null; }
}

async function fetchPrintrTopCoins() {
  const listCandidates = [
    "/tokens?limit=100", "/tokens",
    "/tokens/popular?limit=100", "/tokens?popular=true&limit=100",
    "/tokens?sort=popular&limit=100", "/tokens?sort=mcap&limit=100",
    "/tokens/trending?limit=100", "/leaderboard?limit=100",
    "/tokens/leaderboard?limit=100", "/projects?limit=100",
  ];
  const headers = { Authorization: "Bearer " + PRINTR_JWT, Accept: "application/json" };
  for (const path of listCandidates) {
    try {
      const ctrl = new AbortController();
      const tt = setTimeout(() => ctrl.abort(), 4000);
      const r = await fetch(PRINTR_BASE + path, { headers, signal: ctrl.signal });
      clearTimeout(tt);
      if (!r.ok) continue;
      const j = await r.json();
      const arr = Array.isArray(j) ? j : (j.tokens || j.data || j.results || j.items || j.projects || j.coins);
      if (!Array.isArray(arr) || arr.length === 0) continue;
      const coins = arr.map(extractPrintrCoin).filter(Boolean);
      if (coins.length > 0) {
        console.log("[fartlist] printr list ok:", path, "→", coins.length, "coins");
        return coins;
      }
    } catch (_) {}
  }
  // Fallback: per-token resolution
  const ids = [
    ...PRINTR_SEEDS.map(s => `${SOL_CAIP}:${s.mint}`),
    ...PRINTR_TELECOIN_IDS,
  ];
  const resolved = await Promise.all(ids.map(id => resolvePrintrToken(id)));
  const coins = resolved.filter(Boolean);
  console.log("[fartlist] printr resolved", coins.length, "/", ids.length, "via /tokens/{id}");
  return coins;
}

async function getPrintrTopCoins() {
  const now = Date.now();
  if (_printrCache.coins.length > 0 && (now - _printrCache.at) < PRINTR_CACHE_TTL) return _printrCache.coins;
  try {
    const coins = await fetchPrintrTopCoins();
    if (coins.length > 0) _printrCache = { coins, at: now };
    else if (_printrCache.coins.length === 0) _printrCache.at = now;
  } catch (_) {}
  return _printrCache.coins;
}

async function fetchBagsTopCoins() {
  const paths = [
    "/tokens?limit=100", "/tokens",
    "/tokens/popular?limit=100", "/tokens/trending?limit=100",
    "/tokens/feed?limit=100", "/explore/tokens?limit=100",
    "/explore?limit=100", "/leaderboard?limit=100",
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
  for (const base of BAGS_BASES) {
    for (const path of paths) {
      try {
        const ctrl = new AbortController();
        const tt = setTimeout(() => ctrl.abort(), 4000);
        const r = await fetch(base + path, { headers, signal: ctrl.signal });
        clearTimeout(tt);
        if (!r.ok) continue;
        const j = await r.json();
        const arr = Array.isArray(j) ? j : (j.tokens || j.data || j.results || j.items || j.feed || j.coins);
        if (!Array.isArray(arr) || arr.length === 0) continue;
        const coins = arr.map(extractBagsCoin).filter(Boolean);
        if (coins.length > 0) {
          console.log("[fartlist] bags ok:", base + path, "→", coins.length, "coins");
          return coins;
        }
      } catch (_) {}
    }
  }
  return [];
}

async function getBagsTopCoins() {
  const now = Date.now();
  if (_bagsCache.coins.length > 0 && (now - _bagsCache.at) < PRINTR_CACHE_TTL) return _bagsCache.coins;
  try {
    const coins = await fetchBagsTopCoins();
    if (coins.length > 0) _bagsCache = { coins, at: now };
    else if (_bagsCache.coins.length === 0) _bagsCache.at = now;
  } catch (_) {}
  return _bagsCache.coins;
}

function makeStore(env) {
  const hasKV = () => !!(env.KV_REST_API_URL && env.KV_REST_API_TOKEN);

  async function kv(command) {
    const r = await fetch(env.KV_REST_API_URL, {
      method: "POST",
      headers: { Authorization: "Bearer " + env.KV_REST_API_TOKEN, "Content-Type": "application/json" },
      body: JSON.stringify(command),
    });
    let j = null;
    try { j = await r.json(); } catch (_) {}
    if (!r.ok) throw new Error("KV HTTP " + r.status + (j && j.error ? " — " + j.error : ""));
    if (j && j.error) throw new Error("KV error — " + j.error);
    return j ? j.result : null;
  }

  async function getCoin(mint) {
    if (hasKV()) {
      const raw = await kv(["HGET", COINS_HASH, mint]);
      if (!raw) return null;
      try { return JSON.parse(raw); } catch (_) { return null; }
    }
    const all = await getAllCoinsNtfy();
    return all.find(c => c.mint === mint) || null;
  }

  async function setCoin(c) {
    if (hasKV()) {
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

  async function getAllCoins() {
    if (hasKV()) {
      const vals = await kv(["HVALS", COINS_HASH]) || [];
      const out = [];
      for (const v of vals) {
        try { const c = JSON.parse(v); if (c && c.mint) out.push(c); } catch (_) {}
      }
      return out;
    }
    return getAllCoinsNtfy();
  }

  async function getAllCoinsNtfy() {
    try {
      const r = await fetch(`${NTFY_BASE}/${NTFY_TOPIC}/json?poll=1&since=all`);
      const text = await r.text();
      const lines = text.split("\n").filter(Boolean);
      const latest = new Map();
      for (const line of lines) {
        try {
          const m = JSON.parse(line);
          const c = m.message ? JSON.parse(m.message) : null;
          if (!c || !c.mint) continue;
          latest.set(c.mint, c);
        } catch (_) {}
      }
      return Array.from(latest.values());
    } catch (_) { return []; }
  }

  async function reserveSig(sig) {
    if (hasKV()) {
      const added = await kv(["SADD", SIGS_SET, sig]);
      return Number(added) === 1;
    }
    const all = await getAllCoinsNtfy();
    return !all.some(c => c && c.boostSigs && c.boostSigs.includes(sig));
  }

  return { hasKV, getCoin, setCoin, getAllCoins, reserveSig };
}

async function verifyBurnAmount(sig, author) {
  for (const rpc of RPCS) {
    try {
      const r = await fetch(rpc, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0", id: 1, method: "getTransaction",
          params: [sig, { encoding: "jsonParsed", maxSupportedTransactionVersion: 0, commitment: "confirmed" }],
        }),
      });
      if (!r.ok) continue;
      const j = await r.json();
      const tx = j && j.result;
      if (!tx) continue;
      const groups = [];
      const msg = tx.transaction && tx.transaction.message;
      if (msg && Array.isArray(msg.instructions)) groups.push(msg.instructions);
      const inner = tx.meta && tx.meta.innerInstructions;
      if (Array.isArray(inner)) for (const ig of inner) if (Array.isArray(ig.instructions)) groups.push(ig.instructions);
      let bestRaw = 0n;
      for (const ixs of groups) {
        for (const ix of ixs) {
          const p = ix && ix.parsed;
          if (!p) continue;
          if ((p.type === "burn" || p.type === "burnChecked") && (ix.program === "spl-token" || ix.program === "spl-token-2022")) {
            const info = p.info || {};
            if (info.mint !== MINT) continue;
            if (author && info.authority !== author && info.owner !== author) continue;
            let raw = null;
            try {
              if (info.tokenAmount && info.tokenAmount.amount != null) raw = BigInt(String(info.tokenAmount.amount));
              else if (info.amount != null) raw = BigInt(String(info.amount));
            } catch (_) {}
            if (raw != null && raw > bestRaw) bestRaw = raw;
          }
        }
      }
      if (bestRaw > 0n) return { ok: true, rawAmount: bestRaw, online: true };
      return { ok: false, online: true, reason: "no-fartprint-burn" };
    } catch (_) {}
  }
  return { ok: null, online: false };
}

function mergeSeeds(stored, printrTop, bagsTop) {
  const byMint = new Map();
  for (const c of stored) byMint.set(c.mint, c);
  const addIfNew = (s, source) => {
    if (!s || !s.mint || byMint.has(s.mint)) return;
    if (s.mint === MINT) return;
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
  for (const s of PRINTR_SEEDS) addIfNew(s, "printr");
  for (const s of (printrTop || [])) addIfNew(s, "printr");
  for (const s of (bagsTop   || [])) addIfNew(s, "bags");
  return Array.from(byMint.values());
}

function shape(c, includeAllBoosters) {
  const boostersObj = c.boosters || {};
  const entries = Object.entries(boostersObj)
    .map(([w, a]) => [w, Number(a) || 0])
    .filter(([, a]) => a > 0)
    .sort((a, b) => b[1] - a[1]);
  const topBoosters = entries.slice(0, includeAllBoosters ? 200 : 10)
    .map(([wallet, amount]) => ({ wallet, amount }));
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

function totalBurnedAcross(coins) {
  return coins.reduce((s, c) => s + (Number(c.totalBurned) || 0), 0);
}

export async function onRequest({ request, env }) {
  const { hasKV, getCoin, setCoin, getAllCoins, reserveSig } = makeStore(env);
  const backend = hasKV() ? "kv" : "ntfy";

  try {
    if (request.method === "GET") {
      const url = new URL(request.url);
      const mintQ = url.searchParams.get("mint");
      const [all, printrTop, bagsTop] = await Promise.all([
        getAllCoins(), getPrintrTopCoins(), getBagsTopCoins(),
      ]);
      const merged = mergeSeeds(all, printrTop, bagsTop);
      if (mintQ) {
        const c = merged.find(c => c.mint === mintQ);
        if (!c) return json({ ok: false, error: "not-found" }, 404);
        return json({ ok: true, coin: shape(c, true), totalBurned: totalBurnedAcross(merged), backend });
      }
      const coins = merged.map(c => shape(c, false));
      const seedCount = PRINTR_SEEDS.length + (printrTop ? printrTop.length : 0) + (bagsTop ? bagsTop.length : 0);
      return json({
        ok: true, coins,
        totalBurned: totalBurnedAcross(merged),
        seeds: seedCount,
        printrApi: printrTop ? printrTop.length : 0,
        bagsApi:   bagsTop   ? bagsTop.length   : 0,
        custom: merged.filter(c => !c.seed).length,
        minBoostTokens: MIN_BOOST_TOKENS,
        minListTokens: MIN_LIST_TOKENS,
        backend,
      });
    }

    if (request.method !== "POST") return json({ ok: false, error: "method-not-allowed" }, 405);

    const url = new URL(request.url);
    const kind = url.searchParams.get("kind");
    const body = await readBody(request);
    if (!body || typeof body !== "object") return json({ ok: false, error: "bad-body" }, 400);

    const mint   = body.mint;
    const sig    = typeof body.sig === "string" ? body.sig.trim() : "";
    const author = body.author;

    if (!isSolMint(mint))     return json({ ok: false, error: "bad-mint" }, 400);
    if (!isWallet(author))    return json({ ok: false, error: "bad-author" }, 400);
    if (!sig || sig.length < 32 || sig.length > 200) return json({ ok: false, error: "bad-sig" }, 400);
    if (mint === MINT)        return json({ ok: false, error: "cant-boost-fartprint" }, 400);

    const v = await verifyBurnAmount(sig, author);
    if (v.ok === false) {
      return json({ ok: false, error: "burn-not-found", message: "That transaction isn't a $FARTPRINT burn from your wallet." }, 400);
    }

    const existing = await getCoin(mint);
    const isFirstList = !existing;
    const minRaw = isFirstList ? MIN_LIST_RAW : MIN_BOOST_RAW;
    const minTokens = isFirstList ? MIN_LIST_TOKENS : MIN_BOOST_TOKENS;

    let rawAmount = v.rawAmount;
    if (!rawAmount) rawAmount = minRaw;
    if (rawAmount < minRaw) {
      return json({
        ok: false, error: "under-minimum",
        message: `Need to burn at least ${minTokens.toLocaleString()} $FARTPRINT (you burned ${(Number(rawAmount) / Number(ONE)).toLocaleString()}).`,
      }, 400);
    }

    const fresh = await reserveSig(sig);
    if (!fresh) return json({ ok: false, error: "sig-reused", message: "That burn signature has already been counted." }, 409);

    const now = Date.now();
    const amountTokens = Number(rawAmount) / Number(ONE);

    const suffixSource = inferSource(mint);
    const clientSource = ["printr", "pump", "bags", "custom"].includes(body.source) ? body.source : "custom";
    const finalSource = (suffixSource !== "custom") ? suffixSource : clientSource;

    let coin;
    if (isFirstList) {
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
      coin.boosters[author] = (Number(coin.boosters[author]) || 0) + amountTokens;
      coin.totalBurned = (Number(coin.totalBurned) || 0) + amountTokens;
      coin.burnsCount = (Number(coin.burnsCount) || 0) + 1;
      coin.lastBoostAt = now;
      if (!coin.listedBy) { coin.listedBy = author; coin.listedAt = now; }
      const img = sanitizeUrl(body.image); if (img && !coin.image) coin.image = img;
      const sym = sanitize(body.sym, 16);  if (sym && (!coin.sym || coin.sym === "(?)" || coin.sym === "FART?")) coin.sym = sym;
      const nm  = sanitize(body.name, 60); if (nm && (!coin.name || coin.name === "Printr Mint")) coin.name = nm;
      if (suffixSource !== "custom") coin.source = suffixSource;
    }

    await setCoin(coin);
    return json({
      ok: true, coin: shape(coin, false),
      verifiedAmount: amountTokens, verified: v.ok === true,
      kind: isFirstList ? "list" : "boost", backend,
    });

  } catch (e) {
    console.error("fartlist error", e);
    return json({ ok: false, error: String((e && e.message) || e) }, 500);
  }
}
