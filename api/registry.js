// ============================================================
// api/registry.js — FART derivatives registry
// ============================================================
// The public list of every derivative minted through the app.
//
//   GET  /api/registry  → { tokens: [...], backend: "kv" | "ntfy" }
//   POST /api/registry  → body = one token record:
//                         { tid, sym, name, img, by, tx, ts, ma }
//
// Storage backend:
//   • Vercel KV  — used automatically if KV_REST_API_URL + KV_REST_API_TOKEN
//                  env vars exist. Permanent, reliable, recommended.
//   • ntfy.sh    — fallback when KV isn't configured. Called server-side
//                  (no browser CORS issues) but only ~12h retention.
//
// ── To enable permanent storage (one-time, ~5 clicks) ──────────
//   1. Vercel dashboard → your project → "Storage" tab
//   2. "Create Database" → choose KV (Upstash for Redis)
//   3. Connect it to this project
//   4. Redeploy (Vercel auto-injects the env vars)
// That's it — no code change needed; this file auto-detects KV.
// ============================================================

const KV_URL   = process.env.KV_REST_API_URL;
const KV_TOKEN = process.env.KV_REST_API_TOKEN;
const KV_KEY   = "fart_derivatives";

const NTFY_TOPIC = "fartprint-derivatives-mints-v1-9k3xq";
const NTFY_BASE  = "https://ntfy.sh";

const hasKV = () => !!(KV_URL && KV_TOKEN);

// Run a Redis command against the Vercel KV REST API.
async function kv(command) {
  const r = await fetch(KV_URL, {
    method: "POST",
    headers: {
      "Authorization": "Bearer " + KV_TOKEN,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(command),
  });
  if (!r.ok) throw new Error("KV HTTP " + r.status);
  const j = await r.json();
  return j.result;
}

async function getTokens() {
  if (hasKV()) {
    // Each token stored under its tid in a hash → re-publishing just overwrites.
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
    await kv(["HSET", KV_KEY, rec.tid, JSON.stringify(rec)]);
    return;
  }
  // Fallback: publish to ntfy.sh server-side
  await fetch(`${NTFY_BASE}/${NTFY_TOPIC}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(rec),
  });
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Cache-Control", "no-store");

  if (req.method === "OPTIONS") { res.status(200).end(); return; }

  try {
    if (req.method === "GET") {
      const tokens = await getTokens();
      res.status(200).json({ tokens, backend: hasKV() ? "kv" : "ntfy" });
      return;
    }

    if (req.method === "POST") {
      const rec = req.body;
      if (!rec || !rec.tid || !rec.sym) {
        res.status(400).json({ ok: false, message: "record must include tid and sym" });
        return;
      }
      await putToken(rec);
      res.status(200).json({ ok: true, backend: hasKV() ? "kv" : "ntfy" });
      return;
    }

    res.status(405).json({ ok: false, message: "Use GET or POST." });
  } catch (e) {
    res.status(500).json({ ok: false, message: String((e && e.message) || e) });
  }
}
