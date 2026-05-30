// ============================================================
// functions/api/fartworker.js — FartWorker grant applications
// ============================================================
// Public registry of $FARTPRINT stake-grant applications. Anyone can apply
// (Phantom + X handle + signed message); the protocol decides amounts and
// stake durations. Every submission is public regardless of approval.
//
//   GET  /api/fartworker
//     → { applications:[…recent 200…], grants:[…accepted only…], backend }
//
//   POST /api/fartworker
//     body: { wallet, xHandle, pitch, signature, signedMessage }
//     → { ok, application }
//     One application per wallet — subsequent POSTs from the same wallet
//     overwrite (if still pending) or are rejected (if already accepted).
//
//   POST /api/fartworker?admin=1
//     headers: x-admin-secret: <FARTWORKER_ADMIN_SECRET>
//     body:    { id, action:"accept"|"reject", grantAmount?, stakeDays?,
//                role?, printrStakeTx? }
//     → { ok, application }
//
// Storage: Vercel/Upstash KV when configured, ntfy.sh fallback.
// ============================================================

const APPS_HASH      = "fart_worker_apps";        // wallet → JSON
const NTFY_TOPIC     = "fartprint-worker-v1-9k3xq";
const NTFY_BASE      = "https://ntfy.sh";

const MAX_PITCH     = 800;
const MAX_X_HANDLE  = 40;
const MAX_STAKE_DAYS = 180;

// Seeded grants — always present in the response, even on a fresh KV.
// First grant on the books: @zoomkins232.
const SEED_GRANTS = [
  {
    id: "seed-zoomkins232",
    wallet: null,
    xHandle: "zoomkins232",
    pitch: "Community role — driving engagement, helping new users navigate the $FARTPRINT ecosystem, and keeping the timeline warm.",
    ts: Date.UTC(2026, 4, 15),       // 2026-05-15 (the first day of grants)
    status: "accepted",
    grantAmount: 5_000_000,
    stakeDays: 90,
    role: "Community",
    approvedAt: Date.UTC(2026, 4, 15),
    printrStakeTx: null,
    seed: true,
  },
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

function sanitize(s, max) {
  if (typeof s !== "string") return "";
  return s.replace(/[\x00-\x1f<>]/g, " ").trim().slice(0, max || 200);
}
function sanitizeHandle(s) {
  if (typeof s !== "string") return "";
  return s.replace(/^@+/, "").replace(/[^a-zA-Z0-9_]/g, "").slice(0, MAX_X_HANDLE);
}
function sanitizeSig(s) {
  if (typeof s !== "string") return "";
  return s.trim().slice(0, 400);
}
function sanitizePrintrTx(s) {
  if (typeof s !== "string") return "";
  s = s.trim();
  if (s.length > 200) return "";
  return s;
}
function shortId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
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

  async function getApp(walletOrId) {
    if (hasKV()) {
      const raw = await kv(["HGET", APPS_HASH, walletOrId]);
      if (raw) { try { return JSON.parse(raw); } catch (_) { return null; } }
      // fall back: scan for matching id
      const all = await getAllApps();
      return all.find(a => a.id === walletOrId || a.wallet === walletOrId) || null;
    }
    const all = await getAllApps();
    return all.find(a => a.id === walletOrId || a.wallet === walletOrId) || null;
  }

  async function setApp(a) {
    if (hasKV()) {
      await kv(["HSET", APPS_HASH, a.wallet || a.id, JSON.stringify(a)]);
      return a;
    }
    await fetch(`${NTFY_BASE}/${NTFY_TOPIC}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(a),
    });
    return a;
  }

  async function getAllApps() {
    if (hasKV()) {
      const vals = await kv(["HVALS", APPS_HASH]) || [];
      const out = [];
      for (const v of vals) {
        try { const a = JSON.parse(v); if (a && a.id) out.push(a); } catch (_) {}
      }
      return out;
    }
    // ntfy fallback: scan event log
    try {
      const r = await fetch(`${NTFY_BASE}/${NTFY_TOPIC}/json?poll=1&since=all`);
      const text = await r.text();
      const lines = text.split("\n").filter(Boolean);
      const latest = new Map();
      for (const line of lines) {
        try {
          const m = JSON.parse(line);
          const a = m.message ? JSON.parse(m.message) : null;
          if (!a || !a.id) continue;
          // last write wins
          latest.set(a.wallet || a.id, a);
        } catch (_) {}
      }
      return Array.from(latest.values());
    } catch (_) { return []; }
  }

  return { hasKV, getApp, setApp, getAllApps };
}

function shapeApp(a, isAdmin = false) {
  // Strip nothing for public consumption — submissions are explicitly public.
  // We do, however, trim the signed-message field unless the request is admin.
  const out = {
    id: a.id,
    wallet: a.wallet || null,
    xHandle: a.xHandle || "",
    pitch: a.pitch || "",
    ts: a.ts || 0,
    status: a.status || "pending",
    grantAmount: a.grantAmount || null,
    stakeDays:   a.stakeDays   || null,
    role: a.role || null,
    approvedAt: a.approvedAt || null,
    printrStakeTx: a.printrStakeTx || null,
    seed: !!a.seed,
  };
  if (isAdmin) {
    out.signature = a.signature || null;
    out.signedMessage = a.signedMessage || null;
  }
  return out;
}

export async function onRequest({ request, env }) {
  const { hasKV, getApp, setApp, getAllApps } = makeStore(env);
  const ADMIN_SECRET = env.FARTWORKER_ADMIN_SECRET || "";

  try {
    const backend = hasKV() ? "kv" : "ntfy";
    const url = new URL(request.url);

    if (request.method === "GET") {
      const stored = await getAllApps();
      const seenWallet = new Set(stored.map(a => a.wallet).filter(Boolean));
      const seenHandle = new Set(stored.map(a => (a.xHandle || "").toLowerCase()).filter(Boolean));
      const merged = stored.slice();
      for (const s of SEED_GRANTS) {
        // Don't duplicate the seed if a real KV entry exists for the same handle/wallet
        if (s.xHandle && seenHandle.has(s.xHandle.toLowerCase())) continue;
        if (s.wallet  && seenWallet.has(s.wallet)) continue;
        merged.push(s);
      }
      // Sort: accepted (newest first), then pending (newest first), then rejected
      const order = { accepted: 0, pending: 1, rejected: 2 };
      merged.sort((a, b) => {
        const oa = order[a.status] ?? 3, ob = order[b.status] ?? 3;
        if (oa !== ob) return oa - ob;
        const ta = a.approvedAt || a.ts || 0, tb = b.approvedAt || b.ts || 0;
        return tb - ta;
      });
      const applications = merged.slice(0, 200).map(a => shapeApp(a));
      const grants = applications.filter(a => a.status === "accepted");
      const totalGranted = grants.reduce((s, g) => s + (Number(g.grantAmount) || 0), 0);
      return json({
        ok: true,
        applications,
        grants,
        totalGranted,
        counts: {
          accepted: applications.filter(a => a.status === "accepted").length,
          pending:  applications.filter(a => a.status === "pending").length,
          rejected: applications.filter(a => a.status === "rejected").length,
        },
        backend,
      });
    }

    if (request.method !== "POST") return json({ ok: false, error: "method-not-allowed" }, 405);

    const isAdmin = url.searchParams.get("admin") === "1";
    const body = await readBody(request);
    if (!body || typeof body !== "object") return json({ ok: false, error: "bad-body" }, 400);

    // -------- admin: accept/reject ----------------------------------
    if (isAdmin) {
      const secret = request.headers.get("x-admin-secret") || "";
      if (!ADMIN_SECRET || secret !== ADMIN_SECRET) return json({ ok: false, error: "unauthorized" }, 401);

      const id = body.id;
      const action = body.action;
      if (!id || (action !== "accept" && action !== "reject")) {
        return json({ ok: false, error: "bad-action", message: "Provide { id, action:'accept'|'reject', grantAmount?, stakeDays?, role?, printrStakeTx? }" }, 400);
      }
      const existing = await getApp(id);
      if (!existing) return json({ ok: false, error: "not-found" }, 404);
      if (existing.seed) return json({ ok: false, error: "cant-modify-seed" }, 400);

      const updated = { ...existing };
      if (action === "accept") {
        const amt  = Math.max(0, Math.floor(Number(body.grantAmount) || 0));
        const days = Math.min(MAX_STAKE_DAYS, Math.max(1, Math.floor(Number(body.stakeDays) || 0)));
        if (!amt)  return json({ ok: false, error: "bad-amount", message: "grantAmount (>0) required when accepting." }, 400);
        if (!days) return json({ ok: false, error: "bad-days",   message: "stakeDays (1-180) required when accepting." }, 400);
        updated.status = "accepted";
        updated.grantAmount = amt;
        updated.stakeDays = days;
        updated.role = sanitize(body.role || updated.role || "Contributor", 40);
        updated.approvedAt = Date.now();
        updated.printrStakeTx = sanitizePrintrTx(body.printrStakeTx || "");
      } else {
        updated.status = "rejected";
        updated.rejectedAt = Date.now();
        updated.rejectionNote = sanitize(body.note || "", 240);
      }
      await setApp(updated);
      return json({ ok: true, application: shapeApp(updated, true), backend });
    }

    // -------- public: submit an application -------------------------
    const wallet  = body.wallet;
    const xHandle = sanitizeHandle(body.xHandle);
    const pitch   = sanitize(body.pitch, MAX_PITCH);
    const signature     = sanitizeSig(body.signature);
    const signedMessage = sanitize(body.signedMessage, 600);

    if (!isSolPubkey(wallet)) return json({ ok: false, error: "bad-wallet" }, 400);
    if (!xHandle || xHandle.length < 2) return json({ ok: false, error: "bad-handle", message: "Your X handle (without @)." }, 400);
    if (!pitch || pitch.length < 30) return json({ ok: false, error: "thin-pitch", message: "Tell us what you'd contribute (at least 30 characters)." }, 400);
    if (!signature || !signedMessage) return json({ ok: false, error: "missing-signature", message: "Sign the application message with Phantom to prove the wallet is yours." }, 400);

    // One application per wallet. If pending → overwrite. If accepted → block re-submission.
    const existing = await getApp(wallet);
    if (existing && existing.status === "accepted") {
      return json({ ok: false, error: "already-accepted", message: "This wallet already has an accepted grant.", application: shapeApp(existing) }, 409);
    }

    const now = Date.now();
    const app = {
      id: (existing && existing.id) || shortId(),
      wallet,
      xHandle,
      pitch,
      ts: (existing && existing.ts) || now,
      lastEditedAt: now,
      status: "pending",
      signature,
      signedMessage,
    };
    await setApp(app);
    return json({ ok: true, application: shapeApp(app), backend });

  } catch (e) {
    console.error("fartworker error", e);
    return json({ ok: false, error: String((e && e.message) || e) }, 500);
  }
}
