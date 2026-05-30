// ============================================================
// api/registry.js — FART derivatives registry
// ============================================================
// The public list of every derivative minted through the app.
//
//   GET  /api/registry  → { tokens: [...], count: N, backend: "kv" | "ntfy" }
//   POST /api/registry  → body = one token record:
//                         { tid, sym, name, img, by, tx, ts, ma }
//                       → { ok: true, backend, count }
//
// Storage backend:
//   • Vercel KV  — used automatically if KV_REST_API_URL + KV_REST_API_TOKEN
//                  env vars exist. Permanent, reliable, recommended.
//   • ntfy.sh    — fallback when KV isn't configured.
// ============================================================

const KV_URL   = process.env.KV_REST_API_URL;
const KV_TOKEN = process.env.KV_REST_API_TOKEN;
const KV_KEY   = "fart_derivatives";

const NTFY_TOPIC = "fartprint-derivatives-mints-v1-9k3xq";
const NTFY_BASE  = "https://ntfy.sh";

const hasKV = () => !!(KV_URL && KV_TOKEN);

// --- Vercel KV / Upstash REST helper ------------------------------------
async function kv(command) {
  const r = await fetch(KV_URL, {
    method: "POST",
    headers: {
      "Authorization": "Bearer " + KV_TOKEN,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(command),
  });
  let j = null;
  try { j = await r.json(); } catch (_) {}
  if (!r.ok) {
    throw new Error("KV HTTP " + r.status + (j && j.error ? " — " + j.error : ""));
  }
  if (j && j.error) {
    throw new Error("KV error — " + j.error);
  }
  return j ? j.result : null;
}

// --- Robust request-body reader -----------------------------------------
// Vercel usually pre-parses JSON bodies, but not always (depends on runtime
// + headers). This handles object, string, and raw-stream cases.
async function readBody(req) {
  if (req.body) {
    if (typeof req.body === "object") return req.body;
    if (typeof req.body === "string") {
      try { return JSON.parse(req.body); } catch (_) { return null; }
    }
  }
  try {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const raw = Buffer.concat(chunks).toString("utf8").trim();
    return raw ? JSON.parse(raw) : null;
  } catch (_) {
    return null;
  }
}

// --- Storage operations -------------------------------------------------
async function getTokens() {
  if (hasKV()) {
    const raw = await kv(["HVALS", KV_KEY]);
    return (raw || [])
      .map((s) => { try { return JSON.parse(s); } catch (_) { return null; } })
      .filter(Boolean);
  }
  // Fallback: ntfy.sh history (server-side fetch — no browser CORS)
  const r = await fetch(`${NTFY_BASE}/${NTFY_TOPIC}/json?poll=1&since=all`);
  if (!r.ok) return [];
  const text = await r.text();
  if (!text.trim()) return [];
  const out = [];
  for (const line of text.trim().split("\n")) {
    try {
      const evt = JSON.parse(line);
      if (evt.event === "message" && evt.message) {
        try { out.push(JSON.parse(evt.message)); } catch (_) {}
      }
    } catch (_) {}
  }
  return out;
}

async function putToken(rec) {
  if (hasKV()) {
    // HSET keyed by tid → idempotent; backfills (mint addr / image) overwrite.
    await kv(["HSET", KV_KEY, String(rec.tid), JSON.stringify(rec)]);
    return;
  }
  await fetch(`${NTFY_BASE}/${NTFY_TOPIC}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(rec),
  });
}

// --- Handler ------------------------------------------------------------
export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Cache-Control", "no-store");

  if (req.method === "OPTIONS") { res.status(200).end(); return; }

  try {
    if (req.method === "GET") {
      const tokens = await getTokens();
      res.status(200).json({ tokens, count: tokens.length, backend: hasKV() ? "kv" : "ntfy" });
      return;
    }

    if (req.method === "POST") {
      const rec = await readBody(req);
      if (!rec || typeof rec !== "object") {
        res.status(400).json({ ok: false, message: "Could not read JSON body." });
        return;
      }
      if (!rec.tid || !rec.sym) {
        res.status(400).json({
          ok: false,
          message: "Record must include 'tid' and 'sym'.",
          received: Object.keys(rec),
        });
        return;
      }
      await putToken(rec);
      // Read back so the client can confirm the write landed
      const tokens = await getTokens();
      res.status(200).json({ ok: true, backend: hasKV() ? "kv" : "ntfy", count: tokens.length });
      return;
    }

    res.status(405).json({ ok: false, message: "Use GET or POST." });
  } catch (e) {
    res.status(500).json({ ok: false, message: String((e && e.message) || e) });
  }
}
