// ============================================================
// functions/api/fartflip.js — FartFlip backend (server-signed coin flip)
// ============================================================
// GET  /api/fartflip → recent flips + stats + treasury status
// POST /api/fartflip → body { sig, bet, side, author }
//                    → verify bet, flip coin, sign payout if won, log
//
// Env vars (Cloudflare Pages → Settings → Environment variables):
//   KV_REST_API_URL, KV_REST_API_TOKEN     (Upstash REST)
//   FARTFLIP_TREASURY_PUBKEY               (treasury wallet address)
//   FARTFLIP_TREASURY_SK                   (base58-encoded 64-byte secret)
//
// Compatibility flag required: nodejs_compat
// ============================================================

import {
  Connection, PublicKey, Keypair,
  TransactionMessage, VersionedTransaction,
} from "@solana/web3.js";
import {
  createTransferCheckedInstruction,
  createAssociatedTokenAccountIdempotentInstruction,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import bs58 from "bs58";

const LOG_KEY  = "fart_flip_log";
const SIGS_SET = "fart_flip_sigs";
const MAX_LOG  = 500;
const NTFY_TOPIC = "fartprint-flip-v1-9k3xq";
const NTFY_BASE  = "https://ntfy.sh";

const MINT_STR = "AA1GFBvxU39PxnrCY5eiQPgsTH5vuA7zGQoxgP6LMEaY";
const MINT_PK  = new PublicKey(MINT_STR);
const MINT_DECIMALS = 6;
const ONE = 10n ** BigInt(MINT_DECIMALS);

const MIN_BET = 1;
const MAX_BET = 100_000;
const PAYOUT_MULTIPLIER = 2;

const RPCS = [
  "https://api.mainnet-beta.solana.com",
  "https://solana-rpc.publicnode.com",
  "https://rpc.ankr.com/solana",
];

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
}
async function readBody(request) { try { return await request.json(); } catch { return null; } }

function isPubkey(s) {
  if (typeof s !== "string") return false;
  if (s.length < 32 || s.length > 44) return false;
  return /^[1-9A-HJ-NP-Za-km-z]+$/.test(s);
}

// Web Crypto replacement for Node's randomInt(0, 2) — fair single-bit flip.
function flipCoinBit() {
  const buf = new Uint8Array(1);
  crypto.getRandomValues(buf);
  return buf[0] & 1;        // 0 or 1, uniform
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

  async function appendFlip(record) {
    if (hasKV()) {
      await kv(["RPUSH", LOG_KEY, JSON.stringify(record)]);
      await kv(["LTRIM", LOG_KEY, String(-MAX_LOG), "-1"]);
      return;
    }
    await fetch(`${NTFY_BASE}/${NTFY_TOPIC}`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(record),
    });
  }

  async function getRecentFlips(limit = 200) {
    if (hasKV()) {
      const raw = await kv(["LRANGE", LOG_KEY, "0", "-1"]);
      const arr = (raw || []).map((s) => { try { return JSON.parse(s); } catch (_) { return null; } }).filter(Boolean);
      arr.sort((a, b) => (b.ts || 0) - (a.ts || 0));
      return arr.slice(0, limit);
    }
    try {
      const r = await fetch(`${NTFY_BASE}/${NTFY_TOPIC}/json?poll=1&since=all`);
      const text = await r.text();
      const out = [];
      for (const line of text.split("\n")) {
        try { const m = JSON.parse(line); if (m.message) { try { out.push(JSON.parse(m.message)); } catch (_) {} } } catch (_) {}
      }
      out.sort((a, b) => (b.ts || 0) - (a.ts || 0));
      return out.slice(0, limit);
    } catch (_) { return []; }
  }

  async function reserveSig(sig) {
    if (hasKV()) {
      const added = await kv(["SADD", SIGS_SET, sig]);
      return Number(added) === 1;
    }
    const all = await getRecentFlips(1000);
    return !all.some(r => r && r.betSig === sig);
  }

  return { hasKV, appendFlip, getRecentFlips, reserveSig };
}

function treasuryKeypair(env) {
  if (!env.FARTFLIP_TREASURY_PUBKEY || !env.FARTFLIP_TREASURY_SK) return null;
  try {
    const bytes = bs58.decode(env.FARTFLIP_TREASURY_SK);
    if (bytes.length !== 64) throw new Error("expected 64-byte secret key, got " + bytes.length);
    return Keypair.fromSecretKey(bytes);
  } catch (e) {
    console.error("Bad FARTFLIP_TREASURY_SK:", e.message);
    return null;
  }
}

async function pickConnection() {
  for (const url of RPCS) {
    try {
      const c = new Connection(url, "confirmed");
      await c.getLatestBlockhash("confirmed");
      return c;
    } catch (_) {}
  }
  throw new Error("All RPCs unreachable");
}

async function verifyBetTransfer(sig, author, expectedTokens, treasuryPk) {
  const treasuryAta = getAssociatedTokenAddressSync(MINT_PK, treasuryPk, true);
  for (const rpc of RPCS) {
    try {
      const r = await fetch(rpc, {
        method: "POST", headers: { "Content-Type": "application/json" },
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
      const targetAta = treasuryAta.toBase58();
      for (const ixs of groups) {
        for (const ix of ixs) {
          const p = ix && ix.parsed;
          if (!p) continue;
          if (p.type !== "transferChecked" && p.type !== "transfer") continue;
          if (ix.program !== "spl-token" && ix.program !== "spl-token-2022") continue;
          const info = p.info || {};
          if (p.type === "transferChecked" && info.mint !== MINT_STR) continue;
          if (info.destination !== targetAta) continue;
          if (info.authority !== author && info.owner !== author) continue;
          let raw = null;
          try {
            if (info.tokenAmount && info.tokenAmount.amount != null) raw = BigInt(String(info.tokenAmount.amount));
            else if (info.amount != null) raw = BigInt(String(info.amount));
          } catch (_) {}
          if (raw == null) continue;
          const required = BigInt(expectedTokens) * ONE;
          if (raw >= required) return { ok: true, rawAmount: raw };
        }
      }
      return { ok: false, reason: "no-matching-transfer" };
    } catch (_) {}
  }
  return { ok: null, reason: "rpcs-unreachable" };
}

async function sendPayout(toAuthor, amountTokens, treasury, conn) {
  const amount = BigInt(amountTokens) * ONE;
  const recipient = new PublicKey(toAuthor);
  const treasuryAta  = getAssociatedTokenAddressSync(MINT_PK, treasury.publicKey, true);
  const recipientAta = getAssociatedTokenAddressSync(MINT_PK, recipient, true);

  const ixs = [
    createAssociatedTokenAccountIdempotentInstruction(
      treasury.publicKey, recipientAta, recipient, MINT_PK
    ),
    createTransferCheckedInstruction(
      treasuryAta, MINT_PK, recipientAta, treasury.publicKey, amount, MINT_DECIMALS
    ),
  ];
  const { blockhash } = await conn.getLatestBlockhash("confirmed");
  const msg = new TransactionMessage({
    payerKey: treasury.publicKey,
    recentBlockhash: blockhash,
    instructions: ixs,
  }).compileToV0Message();
  const tx = new VersionedTransaction(msg);
  tx.sign([treasury]);
  const sig = await conn.sendRawTransaction(tx.serialize(), { skipPreflight: false });
  try { await conn.confirmTransaction(sig, "confirmed"); } catch (_) {}
  return sig;
}

async function treasuryBalances(treasury, conn) {
  const treasuryAta = getAssociatedTokenAddressSync(MINT_PK, treasury.publicKey, true);
  let sol = 0, fart = 0;
  try { sol = (await conn.getBalance(treasury.publicKey)) / 1e9; } catch (_) {}
  try {
    const r = await conn.getTokenAccountBalance(treasuryAta);
    fart = Number(r.value.uiAmount) || 0;
  } catch (_) {}
  return { sol, fart };
}

function buildStats(flips) {
  let totalBet = 0, totalWon = 0, biggestWin = 0, biggestLoss = 0;
  for (const f of flips) {
    totalBet += Number(f.bet) || 0;
    if (f.won) totalWon += (Number(f.payout) || 0);
    if (f.won && (Number(f.payout) - Number(f.bet)) > biggestWin) biggestWin = Number(f.payout) - Number(f.bet);
    if (!f.won && Number(f.bet) > biggestLoss) biggestLoss = Number(f.bet);
  }
  return { flips: flips.length, totalBet, totalWon, biggestWin, biggestLoss };
}

export async function onRequest({ request, env }) {
  const { appendFlip, getRecentFlips, reserveSig } = makeStore(env);
  const treasuryConfigured = () => !!(env.FARTFLIP_TREASURY_PUBKEY && env.FARTFLIP_TREASURY_SK);

  try {
    if (request.method === "GET") {
      const recent = await getRecentFlips(20);
      const all    = await getRecentFlips(1000);
      const stats  = buildStats(all);
      let treasury = null;
      try {
        if (treasuryConfigured()) {
          const kp = treasuryKeypair(env);
          if (kp) {
            const conn = await pickConnection();
            const bal = await treasuryBalances(kp, conn);
            treasury = { pubkey: kp.publicKey.toBase58(), sol: bal.sol, fart: bal.fart };
          }
        }
      } catch (_) {}
      return json({
        ok: true,
        configured: treasuryConfigured(),
        treasury,
        recent: recent.map(r => ({
          ts: r.ts, author: r.author, bet: r.bet, side: r.side,
          result: r.result, won: r.won, payout: r.payout,
          betSig: r.betSig, payoutSig: r.payoutSig,
        })),
        stats,
        minBet: MIN_BET, maxBet: MAX_BET, payoutMultiplier: PAYOUT_MULTIPLIER,
      });
    }

    if (request.method !== "POST") return json({ ok: false, error: "method-not-allowed" }, 405);

    if (!treasuryConfigured()) {
      return json({
        ok: false, error: "house-not-configured",
        message: "Treasury wallet env vars (FARTFLIP_TREASURY_PUBKEY and FARTFLIP_TREASURY_SK) are missing — set them in Cloudflare Pages and fund the wallet with $FARTPRINT.",
      }, 503);
    }

    const body = await readBody(request);
    if (!body || typeof body !== "object") return json({ ok: false, error: "bad-body" }, 400);

    const author = body.author;
    const sig    = typeof body.sig === "string" ? body.sig.trim() : "";
    const bet    = Math.floor(Number(body.bet) || 0);
    const side   = body.side === "tails" ? "tails" : "heads";
    if (!isPubkey(author))   return json({ ok: false, error: "bad-author" }, 400);
    if (!sig || sig.length < 32 || sig.length > 200) return json({ ok: false, error: "bad-sig" }, 400);
    if (bet < MIN_BET)       return json({ ok: false, error: "bet-too-small", message: `Min bet is ${MIN_BET} $FARTPRINT.` }, 400);
    if (bet > MAX_BET)       return json({ ok: false, error: "bet-too-big",   message: `Max bet is ${MAX_BET.toLocaleString()} $FARTPRINT.` }, 400);

    const treasury = treasuryKeypair(env);
    if (!treasury) return json({ ok: false, error: "bad-treasury-key" }, 503);

    const ver = await verifyBetTransfer(sig, author, bet, treasury.publicKey);
    if (ver.ok === false) {
      return json({ ok: false, error: "bet-not-found",
        message: "That transaction isn't a $FARTPRINT transfer of the bet amount from your wallet to the treasury." }, 400);
    }

    const fresh = await reserveSig(sig);
    if (!fresh) return json({ ok: false, error: "sig-reused", message: "That bet transaction has already been used." }, 409);

    // Fair 50/50 — Web Crypto random bit
    const r = flipCoinBit();
    const result = r === 0 ? "heads" : "tails";
    const won = result === side;
    const payout = won ? bet * PAYOUT_MULTIPLIER : 0;

    let payoutSig = null;
    let treasuryLow = false;
    if (won) {
      try {
        const conn = await pickConnection();
        try {
          const bal = await treasuryBalances(treasury, conn);
          if (bal.fart < payout) treasuryLow = true;
        } catch (_) {}
        if (!treasuryLow) payoutSig = await sendPayout(author, payout, treasury, conn);
      } catch (e) {
        console.error("payout failed", e);
        treasuryLow = true;
      }
    }

    const record = {
      ts: Date.now(),
      author, bet, side, result, won, payout,
      betSig: sig, payoutSig,
      treasuryLow: treasuryLow || false,
      verified: ver.ok === true,
    };
    await appendFlip(record);

    return json({
      ok: true,
      result, won, payout, payoutSig, treasuryLow,
      betSig: sig,
    });
  } catch (e) {
    console.error("fartflip error", e);
    return json({ ok: false, error: String((e && e.message) || e) }, 500);
  }
}
