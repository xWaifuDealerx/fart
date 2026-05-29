// ============================================================
// functions/api/fartidler.js — FartIdler backend (idle game leaderboard)
// ============================================================
// GET  /api/fartidler              → leaderboards + pool + entry stats
// POST /api/fartidler              → player save (monotonic, FPS-checked)
// POST /api/fartidler?entry=1      → burn 10k FARTPRINT to unlock
// POST /api/fartidler?admin=1      → credit/set FARTPRINT earnings (admin only)
// ============================================================

const PLAYERS_HASH    = "fart_idler_players";
const ENTRY_SIGS_SET  = "fart_idler_entry_sigs";
const POOL_TOTAL      = 1_000_000;
const NTFY_TOPIC      = "fartprint-idler-v1-9k3xq";
const NTFY_BASE       = "https://ntfy.sh";

const MINT             = "AA1GFBvxU39PxnrCY5eiQPgsTH5vuA7zGQoxgP6LMEaY";
const MINT_DECIMALS    = 6;
const ENTRY_FEE_TOKENS = 10_000;
const ENTRY_FEE_RAW    = BigInt(ENTRY_FEE_TOKENS) * (10n ** BigInt(MINT_DECIMALS));
const RPCS = [
  "https://api.mainnet-beta.solana.com",
  "https://solana-rpc.publicnode.com",
  "https://rpc.ankr.com/solana",
];

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
}
async function readBody(request) { try { return await request.json(); } catch { return null; } }

function isSolPubkey(s) {
  if (typeof s !== "string") return false;
  if (s.length < 32 || s.length > 44) return false;
  return /^[1-9A-HJ-NP-Za-km-z]+$/.test(s);
}
function sanitizeName(s) {
  if (typeof s !== "string") return "";
  return s.replace(/[\x00-\x1f<>]/g, "").trim().slice(0, 24);
}
function num(x) {
  const n = Number(x);
  return (Number.isFinite(n) && n >= 0) ? n : NaN;
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

  async function getPlayer(wallet) {
    if (hasKV()) {
      const raw = await kv(["HGET", PLAYERS_HASH, wallet]);
      if (!raw) return null;
      try { return JSON.parse(raw); } catch (_) { return null; }
    }
    const all = await getAllPlayersNtfy();
    return all.find(p => p.wallet === wallet) || null;
  }

  async function setPlayer(p) {
    if (hasKV()) {
      await kv(["HSET", PLAYERS_HASH, p.wallet, JSON.stringify(p)]);
      return p;
    }
    await fetch(`${NTFY_BASE}/${NTFY_TOPIC}`, {
      method: "POST",
      body: JSON.stringify(p),
      headers: { "Title": "fartidler", "Tags": "save" }
    });
    return p;
  }

  async function getAllPlayers() {
    if (hasKV()) {
      const vals = await kv(["HVALS", PLAYERS_HASH]) || [];
      const out = [];
      for (const v of vals) {
        try { const p = JSON.parse(v); if (p && p.wallet) out.push(p); } catch (_) {}
      }
      return out;
    }
    return getAllPlayersNtfy();
  }

  async function getAllPlayersNtfy() {
    try {
      const r = await fetch(`${NTFY_BASE}/${NTFY_TOPIC}/json?poll=1&since=all`);
      const text = await r.text();
      const lines = text.split("\n").filter(Boolean);
      const latest = new Map();
      for (const line of lines) {
        try {
          const m = JSON.parse(line);
          const p = m.message ? JSON.parse(m.message) : null;
          if (!p || !p.wallet) continue;
          const prev = latest.get(p.wallet);
          if (!prev || (p.ts || 0) > (prev.ts || 0)) latest.set(p.wallet, p);
        } catch (_) {}
      }
      return Array.from(latest.values());
    } catch (_) { return []; }
  }

  async function reserveEntrySig(sig) {
    if (hasKV()) {
      const added = await kv(["SADD", ENTRY_SIGS_SET, sig]);
      return Number(added) === 1;
    }
    const all = await getAllPlayersNtfy();
    return !all.some(p => p && p.entrySig === sig);
  }

  return { hasKV, getPlayer, setPlayer, getAllPlayers, reserveEntrySig };
}

async function verifyBurn(sig, author) {
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
            if (raw == null) continue;
            if (raw >= ENTRY_FEE_RAW) return true;
          }
        }
      }
      return false;
    } catch (_) {}
  }
  return null;
}

function buildBoards(players) {
  const distributed = players.reduce((s, p) => s + (Number(p.earned) || 0), 0);
  const paidPlayers = players.filter(p => p && p.paid === true);
  const entriesBurned = paidPlayers.length * ENTRY_FEE_TOKENS;
  const topByFarts = [...players]
    .filter(p => (Number(p.farts) || 0) > 0)
    .sort((a, b) => (Number(b.farts) || 0) - (Number(a.farts) || 0))
    .slice(0, 200);
  const topByEarned = [...players]
    .filter(p => (Number(p.earned) || 0) > 0)
    .sort((a, b) => (Number(b.earned) || 0) - (Number(a.earned) || 0))
    .slice(0, 200);
  const recentEntries = paidPlayers
    .filter(p => p.entrySig && p.paidAt)
    .sort((a, b) => (Number(b.paidAt) || 0) - (Number(a.paidAt) || 0))
    .slice(0, 100)
    .map(p => ({
      wallet:  p.wallet,
      name:    p.name || "",
      sig:     p.entrySig,
      ts:      Number(p.paidAt) || 0,
      amount:  Number(p.entryFeeTokens) || ENTRY_FEE_TOKENS,
      verified: p.entryVerified !== false,
    }));
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
    recentEntries,
    topByFarts,
    topByEarned,
    totalPlayers: players.length,
  };
}

export async function onRequest({ request, env }) {
  const ADMIN_SECRET = env.FARTIDLER_ADMIN_SECRET || "";
  const { hasKV, getPlayer, setPlayer, getAllPlayers, reserveEntrySig } = makeStore(env);

  try {
    if (request.method === "GET") {
      const all = await getAllPlayers();
      const boards = buildBoards(all);
      const url = new URL(request.url);
      const w = url.searchParams.get("wallet");
      const self = w ? (all.find(p => p.wallet === w) || null) : null;
      return json({ ok: true, ...boards, self, backend: hasKV() ? "kv" : "ntfy" });
    }

    if (request.method !== "POST") return json({ ok: false, error: "method-not-allowed" }, 405);

    const url = new URL(request.url);
    const isAdmin = url.searchParams.get("admin") === "1";
    const isEntry = url.searchParams.get("entry") === "1";
    const body = await readBody(request);
    if (!body || typeof body !== "object") return json({ ok: false, error: "bad-body" }, 400);

    // -------- entry: burn 10k FARTPRINT to play ----------------------
    if (isEntry) {
      const wallet = body.wallet;
      const sig = typeof body.sig === "string" ? body.sig.trim() : "";
      if (!isSolPubkey(wallet)) return json({ ok: false, error: "bad-wallet" }, 400);
      if (!sig || sig.length < 32 || sig.length > 200) return json({ ok: false, error: "bad-sig" }, 400);

      const existing = await getPlayer(wallet);
      if (existing && existing.paid === true) {
        const all = await getAllPlayers();
        return json({ ok: true, alreadyPaid: true, player: existing, ...buildBoards(all) });
      }
      const verified = await verifyBurn(sig, wallet);
      if (verified === false) {
        return json({ ok: false, error: "burn-not-found", message: "That transaction isn't a 10,000 $FARTPRINT burn from your wallet." }, 400);
      }
      const fresh = await reserveEntrySig(sig);
      if (!fresh) return json({ ok: false, error: "sig-reused", message: "That burn signature has already been used." }, 409);

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
      if (typeof body.name === "string") {
        const nm = sanitizeName(body.name);
        if (nm) player.name = nm;
      }
      await setPlayer(player);
      const all = await getAllPlayers();
      return json({ ok: true, player, verified, ...buildBoards(all) });
    }

    // -------- admin: credit / set earnings ---------------------------
    if (isAdmin) {
      const secret = request.headers.get("x-admin-secret") || "";
      if (!ADMIN_SECRET || secret !== ADMIN_SECRET) return json({ ok: false, error: "unauthorized" }, 401);
      const wallet = body.wallet;
      if (!isSolPubkey(wallet)) return json({ ok: false, error: "bad-wallet" }, 400);
      let existing = await getPlayer(wallet) || {
        wallet, name: "", farts: 0, fps: 0, earned: 0,
        createdAt: Date.now(), lastSaved: Date.now(),
      };
      if (body.setEarned != null) {
        const v = num(body.setEarned);
        if (isNaN(v)) return json({ ok: false, error: "bad-amount" }, 400);
        existing.earned = v;
      } else if (body.addEarned != null) {
        const v = num(body.addEarned);
        if (isNaN(v)) return json({ ok: false, error: "bad-amount" }, 400);
        existing.earned = (Number(existing.earned) || 0) + v;
      } else {
        return json({ ok: false, error: "missing-amount" }, 400);
      }
      existing.lastSaved = Date.now();
      if (typeof body.name === "string") {
        const nm = sanitizeName(body.name);
        if (nm) existing.name = nm;
      }
      await setPlayer(existing);
      const all = await getAllPlayers();
      return json({ ok: true, player: existing, ...buildBoards(all) });
    }

    // -------- player save -------------------------------------------
    const wallet = body.wallet;
    if (!isSolPubkey(wallet)) return json({ ok: false, error: "bad-wallet" }, 400);
    const farts = num(body.farts);
    const fps   = num(body.fps);
    if (isNaN(farts) || isNaN(fps)) return json({ ok: false, error: "bad-numbers" }, 400);
    const HARD_CAP = 1e18;
    if (farts > HARD_CAP || fps > HARD_CAP) return json({ ok: false, error: "too-big" }, 400);

    const now = Date.now();
    const existing = await getPlayer(wallet);

    if (!existing || existing.paid !== true) {
      return json({
        ok: false, error: "entry-fee-required",
        message: "Burn " + ENTRY_FEE_TOKENS + " $FARTPRINT to start playing.",
        feeTokens: ENTRY_FEE_TOKENS,
      }, 402);
    }

    const prevFarts = Number(existing.farts) || 0;
    const prevFps   = Number(existing.fps)   || 0;
    const prevTs    = Number(existing.lastSaved) || now;
    let accepted = true;
    let reason = "ok";

    if (farts < prevFarts) {
      accepted = false;
      reason = "monotonic-violation";
    } else {
      const elapsedSec = Math.max(1, (now - prevTs) / 1000);
      const gain = farts - prevFarts;
      const allowance = (prevFps * elapsedSec + 500 * elapsedSec) * 1.5;
      if (gain > allowance && elapsedSec < 60 * 60 * 6) {
        accepted = false;
        reason = "fps-cap-exceeded";
      }
    }

    if (!accepted) {
      const updated = { ...existing };
      if (typeof body.name === "string") {
        const nm = sanitizeName(body.name);
        if (nm) updated.name = nm;
      }
      updated.lastSaved = now;
      await setPlayer(updated);
      return json({ ok: true, player: updated, accepted: false, reason });
    }

    const updated = {
      ...existing,
      name: typeof body.name === "string" ? (sanitizeName(body.name) || existing.name) : existing.name,
      farts,
      fps,
      lastSaved: now,
    };
    await setPlayer(updated);
    return json({ ok: true, player: updated, accepted: true, reason });

  } catch (e) {
    console.error("fartidler error", e);
    return json({ ok: false, error: String(e && e.message || e) }, 500);
  }
}
