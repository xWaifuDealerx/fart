// ============================================================
// api/fartidler.js — FartIdler backend (idle game leaderboard)
// ============================================================
// An idle "fart printer" game. Each player has:
//   • wallet (Solana pubkey, primary key)
//   • name   (player-chosen display name, ≤24 chars)
//   • farts  (off-chain game currency, monotonic)
//   • fps    (claimed farts-per-second, used for cheat guard)
//   • earned (on-chain $FARTPRINT airdropped by admin)
//
//   GET  /api/fartidler
//     → { players:[...top 200 by farts], pool:{total,distributed,remaining},
//         topByFarts:[...], topByEarned:[...] }
//
//   POST /api/fartidler
//     body: { wallet, name?, farts, fps }
//     Save a player tick. Server enforces:
//       • farts must be a finite non-negative number
//       • farts must NOT decrease from previous save
//       • growth since last save must be ≤ (lastFps * elapsed + clickHeadroom) * 1.5
//     → { ok:true, player:{...}, accepted:true|false, reason? }
//
//   POST /api/fartidler?admin=1
//     headers: x-admin-secret: <FARTIDLER_ADMIN_SECRET env>
//     body:   { wallet, addEarned:number }   (positive credit)
//          OR { wallet, setEarned:number }   (overwrite)
//     → { ok:true, player:{...}, pool:{...} }
//
// Storage: Vercel KV (HSET per-player) when configured, ntfy.sh fallback
// otherwise. Mirrors the registry / fartforum pattern.
// ============================================================

const KV_URL   = process.env.KV_REST_API_URL;
const KV_TOKEN = process.env.KV_REST_API_TOKEN;
const ADMIN_SECRET = process.env.FARTIDLER_ADMIN_SECRET || "";

const PLAYERS_HASH    = "fart_idler_players";       // wallet → JSON
const ENTRY_SIGS_SET  = "fart_idler_entry_sigs";    // set of used burn sigs
const POOL_TOTAL      = 1_000_000;                  // 1M $FARTPRINT first event
const NTFY_TOPIC      = "fartprint-idler-v1-9k3xq";
const NTFY_BASE       = "https://ntfy.sh";

// Entry fee config
const MINT          = "AA1GFBvxU39PxnrCY5eiQPgsTH5vuA7zGQoxgP6LMEaY";  // $FARTPRINT
const MINT_DECIMALS = 6;
const ENTRY_FEE_TOKENS = 10_000;
const ENTRY_FEE_RAW    = BigInt(ENTRY_FEE_TOKENS) * (10n ** BigInt(MINT_DECIMALS));
const RPCS = [
  "https://api.mainnet-beta.solana.com",
  "https://solana-rpc.publicnode.com",
  "https://rpc.ankr.com/solana",
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

// --- request body --------------------------------------------------------
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
function isSolPubkey(s){
  if(typeof s !== "string") return false;
  if(s.length < 32 || s.length > 44) return false;
  return /^[1-9A-HJ-NP-Za-km-z]+$/.test(s);
}
function sanitizeName(s){
  if(typeof s !== "string") return "";
  return s.replace(/[\x00-\x1f<>]/g, "").trim().slice(0, 24);
}
function num(x){
  const n = Number(x);
  return (Number.isFinite(n) && n >= 0) ? n : NaN;
}

// --- player store -------------------------------------------------------
async function getPlayer(wallet){
  if(hasKV()){
    const raw = await kv(["HGET", PLAYERS_HASH, wallet]);
    if(!raw) return null;
    try { return JSON.parse(raw); } catch(_){ return null; }
  }
  const all = await getAllPlayersNtfy();
  return all.find(p => p.wallet === wallet) || null;
}

async function setPlayer(p){
  if(hasKV()){
    await kv(["HSET", PLAYERS_HASH, p.wallet, JSON.stringify(p)]);
    return p;
  }
  // ntfy fallback: append-only log; we read latest per wallet on getAll
  await fetch(`${NTFY_BASE}/${NTFY_TOPIC}`, {
    method: "POST",
    body: JSON.stringify(p),
    headers: { "Title": "fartidler", "Tags": "save" }
  });
  return p;
}

async function getAllPlayers(){
  if(hasKV()){
    const vals = await kv(["HVALS", PLAYERS_HASH]) || [];
    const out = [];
    for(const v of vals){
      try { const p = JSON.parse(v); if(p && p.wallet) out.push(p); } catch(_){}
    }
    return out;
  }
  return getAllPlayersNtfy();
}

async function getAllPlayersNtfy(){
  try {
    const r = await fetch(`${NTFY_BASE}/${NTFY_TOPIC}/json?poll=1&since=all`);
    const text = await r.text();
    const lines = text.split("\n").filter(Boolean);
    const latest = new Map();
    for(const line of lines){
      try {
        const m = JSON.parse(line);
        const p = m.message ? JSON.parse(m.message) : null;
        if(!p || !p.wallet) continue;
        const prev = latest.get(p.wallet);
        if(!prev || (p.ts||0) > (prev.ts||0)) latest.set(p.wallet, p);
      } catch(_){}
    }
    return Array.from(latest.values());
  } catch(_){ return []; }
}

// --- entry sigs (one wallet pays once) ----------------------------------
async function reserveEntrySig(sig){
  if(hasKV()){
    const added = await kv(["SADD", ENTRY_SIGS_SET, sig]);
    return Number(added) === 1;
  }
  // ntfy fallback: scan existing player records for the sig
  const all = await getAllPlayersNtfy();
  return !all.some(p => p && p.entrySig === sig);
}

// Best-effort on-chain verification of a burn transaction.
// Returns:
//   true  → confirmed: spl-token burn of MINT, by `author`, amount >= ENTRY_FEE_RAW
//   false → tx exists but no qualifying burn (reject)
//   null  → couldn't fetch tx from any RPC (accept w/ verified=null)
async function verifyBurn(sig, author){
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
      for(const ixs of groups){
        for(const ix of ixs){
          const p = ix && ix.parsed;
          if(!p) continue;
          if((p.type === "burn" || p.type === "burnChecked") && (ix.program === "spl-token" || ix.program === "spl-token-2022")){
            const info = p.info || {};
            if(info.mint !== MINT) continue;
            if(author && info.authority !== author && info.owner !== author) continue;
            // amount check — burnChecked has info.tokenAmount.amount (raw string),
            // burn has info.amount (raw string)
            let raw = null;
            try {
              if(info.tokenAmount && info.tokenAmount.amount != null){
                raw = BigInt(String(info.tokenAmount.amount));
              } else if(info.amount != null){
                raw = BigInt(String(info.amount));
              }
            } catch(_){}
            if(raw == null) continue;
            if(raw >= ENTRY_FEE_RAW) return true;
          }
        }
      }
      return false; // tx loaded, no qualifying burn
    } catch(_){}
  }
  return null;     // RPCs unreachable
}

// --- leaderboard building ----------------------------------------------
function buildBoards(players){
  const distributed = players.reduce((s,p)=> s + (Number(p.earned)||0), 0);
  const paidPlayers = players.filter(p => p && p.paid === true);
  const entriesBurned = paidPlayers.length * ENTRY_FEE_TOKENS;
  const topByFarts = [...players]
    .filter(p => (Number(p.farts)||0) > 0)
    .sort((a,b)=> (Number(b.farts)||0) - (Number(a.farts)||0))
    .slice(0, 200);
  const topByEarned = [...players]
    .filter(p => (Number(p.earned)||0) > 0)
    .sort((a,b)=> (Number(b.earned)||0) - (Number(a.earned)||0))
    .slice(0, 200);
  return {
    pool: {
      total: POOL_TOTAL,
      distributed: Math.min(distributed, POOL_TOTAL),
      remaining: Math.max(0, POOL_TOTAL - distributed),
    },
    entry: {
      feeTokens: ENTRY_FEE_TOKENS,
      paidPlayers: paidPlayers.length,
      totalBurned: entriesBurned,
    },
    topByFarts,
    topByEarned,
    totalPlayers: players.length,
  };
}

// --- handler ------------------------------------------------------------
export default async function handler(req, res){
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "content-type,x-admin-secret");
  if(req.method === "OPTIONS") { res.status(204).end(); return; }

  try {
    if(req.method === "GET"){
      const all = await getAllPlayers();
      const boards = buildBoards(all);
      // include a "self" hint if ?wallet= passed
      const url = new URL(req.url, "http://x");
      const w = url.searchParams.get("wallet");
      const self = w ? (all.find(p => p.wallet === w) || null) : null;
      res.status(200).json({ ok:true, ...boards, self, backend: hasKV() ? "kv" : "ntfy" });
      return;
    }

    if(req.method !== "POST"){
      res.status(405).json({ ok:false, error:"method-not-allowed" }); return;
    }

    const url = new URL(req.url, "http://x");
    const isAdmin = url.searchParams.get("admin") === "1";
    const isEntry = url.searchParams.get("entry") === "1";
    const body = await readBody(req);
    if(!body || typeof body !== "object"){
      res.status(400).json({ ok:false, error:"bad-body" }); return;
    }

    // -------- entry: burn 10k FARTPRINT to play ----------------------
    if(isEntry){
      const wallet = body.wallet;
      const sig = typeof body.sig === "string" ? body.sig.trim() : "";
      if(!isSolPubkey(wallet)){
        res.status(400).json({ ok:false, error:"bad-wallet" }); return;
      }
      if(!sig || sig.length < 32 || sig.length > 200){
        res.status(400).json({ ok:false, error:"bad-sig" }); return;
      }
      // If this player has already paid, idempotently succeed.
      const existing = await getPlayer(wallet);
      if(existing && existing.paid === true){
        const all = await getAllPlayers();
        res.status(200).json({ ok:true, alreadyPaid:true, player:existing, ...buildBoards(all) });
        return;
      }
      // Verify the burn on-chain (best-effort).
      const verified = await verifyBurn(sig, wallet);
      if(verified === false){
        res.status(400).json({ ok:false, error:"burn-not-found", message:"That transaction isn't a 10,000 $FARTPRINT burn from your wallet." });
        return;
      }
      // Reserve the sig so it can't be reused for another wallet.
      const fresh = await reserveEntrySig(sig);
      if(!fresh){
        res.status(409).json({ ok:false, error:"sig-reused", message:"That burn signature has already been used." });
        return;
      }
      const now = Date.now();
      const player = existing ? { ...existing } : {
        wallet,
        name: sanitizeName(body.name || ""),
        farts: 0, fps: 0, earned: 0,
        createdAt: now, lastSaved: now,
      };
      player.paid = true;
      player.paidAt = now;
      player.entrySig = sig;
      player.entryFeeTokens = ENTRY_FEE_TOKENS;
      player.entryVerified = verified === true;
      if(typeof body.name === "string"){
        const nm = sanitizeName(body.name);
        if(nm) player.name = nm;
      }
      await setPlayer(player);
      const all = await getAllPlayers();
      res.status(200).json({ ok:true, player, verified, ...buildBoards(all) });
      return;
    }

    // -------- admin: credit / set earnings ---------------------------
    if(isAdmin){
      const secret = req.headers["x-admin-secret"] || "";
      if(!ADMIN_SECRET || secret !== ADMIN_SECRET){
        res.status(401).json({ ok:false, error:"unauthorized" }); return;
      }
      const wallet = body.wallet;
      if(!isSolPubkey(wallet)){
        res.status(400).json({ ok:false, error:"bad-wallet" }); return;
      }
      let existing = await getPlayer(wallet) || {
        wallet, name:"", farts:0, fps:0, earned:0,
        createdAt: Date.now(), lastSaved: Date.now(),
      };
      if(body.setEarned != null){
        const v = num(body.setEarned);
        if(isNaN(v)){ res.status(400).json({ ok:false, error:"bad-amount" }); return; }
        existing.earned = v;
      } else if(body.addEarned != null){
        const v = num(body.addEarned);
        if(isNaN(v)){ res.status(400).json({ ok:false, error:"bad-amount" }); return; }
        existing.earned = (Number(existing.earned)||0) + v;
      } else {
        res.status(400).json({ ok:false, error:"missing-amount" }); return;
      }
      existing.lastSaved = Date.now();
      if(typeof body.name === "string"){
        const nm = sanitizeName(body.name);
        if(nm) existing.name = nm;
      }
      await setPlayer(existing);
      const all = await getAllPlayers();
      res.status(200).json({ ok:true, player:existing, ...buildBoards(all) });
      return;
    }

    // -------- player save -------------------------------------------
    const wallet = body.wallet;
    if(!isSolPubkey(wallet)){
      res.status(400).json({ ok:false, error:"bad-wallet" }); return;
    }
    const farts = num(body.farts);
    const fps   = num(body.fps);
    if(isNaN(farts) || isNaN(fps)){
      res.status(400).json({ ok:false, error:"bad-numbers" }); return;
    }
    // cap absurd values
    const HARD_CAP = 1e18;
    if(farts > HARD_CAP || fps > HARD_CAP){
      res.status(400).json({ ok:false, error:"too-big" }); return;
    }

    const now = Date.now();
    const existing = await getPlayer(wallet);

    // Burn-to-participate gate: only paid players can record scores.
    if(!existing || existing.paid !== true){
      res.status(402).json({
        ok:false, error:"entry-fee-required",
        message:"Burn " + ENTRY_FEE_TOKENS + " $FARTPRINT to start playing.",
        feeTokens: ENTRY_FEE_TOKENS,
      });
      return;
    }

    // Monotonic: server-stored farts is the floor
    const prevFarts = Number(existing.farts) || 0;
    const prevFps   = Number(existing.fps)   || 0;
    const prevTs    = Number(existing.lastSaved) || now;
    let accepted = true;
    let reason = "ok";

    if(farts < prevFarts){
      // rollback attempt — keep server value, refuse new
      accepted = false;
      reason = "monotonic-violation";
    } else {
      // FPS sanity: gain must be plausible given previous claimed FPS
      const elapsedSec = Math.max(1, (now - prevTs) / 1000);
      const gain = farts - prevFarts;
      // headroom: click bursts (~10/s @ 50 per click = 500/s), plus 1.5x slack
      const allowance = (prevFps * elapsedSec + 500 * elapsedSec) * 1.5;
      if(gain > allowance && elapsedSec < 60 * 60 * 6){
        // suspicious — only accept up to the allowance
        accepted = false;
        reason = "fps-cap-exceeded";
      }
    }

    if(!accepted){
      // Still bump name/fps if name was set by player, but keep farts at floor
      const updated = { ...existing };
      if(typeof body.name === "string"){
        const nm = sanitizeName(body.name);
        if(nm) updated.name = nm;
      }
      updated.lastSaved = now;
      await setPlayer(updated);
      res.status(200).json({ ok:true, player:updated, accepted:false, reason });
      return;
    }

    const updated = {
      ...existing,
      name: typeof body.name === "string" ? (sanitizeName(body.name) || existing.name) : existing.name,
      farts,
      fps,
      lastSaved: now,
    };
    await setPlayer(updated);
    res.status(200).json({ ok:true, player:updated, accepted:true, reason });

  } catch (e) {
    console.error("fartidler error", e);
    res.status(500).json({ ok:false, error: String(e && e.message || e) });
  }
}
